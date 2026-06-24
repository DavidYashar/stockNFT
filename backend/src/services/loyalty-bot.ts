/**
 * Loyalty Fee Bot
 *
 * Monitors treasury wallet for incoming ETH transfers via Etherscan V2 API.
 * Excludes transfers from our own contracts (mint revenue, swap returns, etc.).
 * Everything else = loyalty fee (10% royalty from OpenSea/Blur/any marketplace).
 * Records detected fees on-chain via PM.receiveLoyalty() using deployer key.
 *
 * Configurable via env:
 *   ETHERSCAN_API_KEY — Etherscan V2 API key
 *   LOYALTY_CHAIN_ID — chain ID (1 for mainnet, 11155111 for Sepolia)
 *   LOYALTY_POLL_MS — poll interval in ms (default 30s)
 */

import { ethers } from "ethers";
import { config } from "../config";
import { getWallet } from "../contracts";
import * as fs from "fs";
import * as path from "path";

// ─── Config ───

const DATA_FILE = path.resolve(__dirname, "../../data/loyalty-fees.json");
const STATE_FILE = path.resolve(__dirname, "../../data/loyalty-state.json");
const POLL_MS = parseInt(process.env.LOYALTY_POLL_MS || "30000", 10);
const CHAIN_ID = process.env.LOYALTY_CHAIN_ID || "1";
// Only process transactions after this timestamp (unix seconds). Defaults to now on first start.
const START_TIMESTAMP = parseInt(process.env.LOYALTY_START_TIMESTAMP || "0", 10);
const ETHERSCAN_BASE = "https://api.etherscan.io/v2/api";

// Contracts whose ETH transfers to treasury are NOT loyalty fees
function getBlocklist(): string[] {
  return [
    config.contracts.googleStockNFT,
    config.contracts.platformManager,
    config.contracts.stockVault,
    config.contracts.interestDistributor,
    config.contracts.mockSwap,
  ].filter(Boolean).map(a => a.toLowerCase());
}

// ─── Types ───

interface DetectedFee {
  txHash: string;
  amount: string;
  timestamp: number;
  from: string;
  recorded: boolean;
}

interface LoyaltyData {
  fees: DetectedFee[];
}

interface BotState {
  lastCheckedTxHashes: string[]; // most recent 500 processed tx hashes
}

// ─── Persistence ───

function loadData(): LoyaltyData {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch { return { fees: [] }; }
}

function saveData(data: LoyaltyData) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function loadState(): BotState {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); }
  catch { return { lastCheckedTxHashes: [] }; }
}

function saveState(state: BotState) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

const processedTxs = new Set<string>();

export function getLoyaltyFees() {
  const data = loadData();
  const recorded = data.fees.filter(f => f.recorded);
  return {
    total: recorded.reduce((s, f) => s + Number(f.amount), 0).toFixed(6),
    detected: data.fees.reduce((s, f) => s + Number(f.amount), 0).toFixed(6),
    fees: data.fees,
  };
}

// ─── On-Chain Recording ───

async function recordOnChain(amountWei: bigint): Promise<boolean> {
  try {
    const wallet = getWallet();
    const pmAddr = config.contracts.platformManager;
    if (!pmAddr) return false;
    const pm = new ethers.Contract(pmAddr, ["function receiveLoyalty(uint256)"], wallet);
    const tx = await pm.receiveLoyalty(amountWei);
    await tx.wait();
    return true;
  } catch (err: any) {
    console.log(`  ⚠️ On-chain record failed: ${err.message?.slice(0, 80)}`);
    return false;
  }
}

// ─── Etherscan API ───

async function fetchEtherscan(action: "txlist" | "txlistinternal", address: string): Promise<any[]> {
  const apiKey = process.env.ETHERSCAN_API_KEY || "";
  if (!apiKey) { console.log("  ⚠️ ETHERSCAN_API_KEY not set"); return []; }
  const url = `${ETHERSCAN_BASE}?chainid=${CHAIN_ID}&module=account&action=${action}&address=${address}&page=1&offset=50&sort=desc&apikey=${apiKey}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    if (json.status === "1" && Array.isArray(json.result)) return json.result;
    if (json.status === "0" && json.result?.includes("No transactions")) return [];
    console.log(`  ⚠️ Etherscan ${action}: ${json.result || json.message}`);
    return [];
  } catch (err: any) {
    console.log(`  ⚠️ Etherscan fetch failed: ${err.message?.slice(0, 60)}`);
    return [];
  }
}

// ─── Scanner ───

async function scanForLoyaltyFees() {
  const treasuryAddr = (config.contracts.treasuryEOA || "").toLowerCase();
  if (!treasuryAddr) return;

  const blocklist = getBlocklist();
  if (blocklist.length === 0) return;

  // Fetch both direct and internal transfers
  const [directTxs, internalTxs] = await Promise.all([
    fetchEtherscan("txlist", treasuryAddr),
    fetchEtherscan("txlistinternal", treasuryAddr),
  ]);

  // Merge and dedup by txHash
  const allTxs = [...directTxs, ...internalTxs];
  const seen = new Set<string>();
  const unique: any[] = [];
  for (const tx of allTxs) {
    const hash = tx.hash || tx.transactionHash || "";
    if (!hash || seen.has(hash)) continue;
    seen.add(hash);
    unique.push(tx);
  }

  if (unique.length === 0) return;

  const data = loadData();
  let newFees = 0;

  for (const tx of unique) {
    const txHash = (tx.hash || tx.transactionHash || "").toLowerCase();
    if (!txHash || processedTxs.has(txHash)) continue;
    processedTxs.add(txHash);

    const from = (tx.from || "").toLowerCase();
    const to = (tx.to || "").toLowerCase();
    const value = BigInt(tx.value || "0");
    const isError = tx.isError === "1" || tx.isError === "true";

    // Must be TO treasury, with value, no error
    if (to !== treasuryAddr || value === 0n || isError) continue;

    // Skip transactions before start timestamp
    const txTime = parseInt(tx.timeStamp || "0", 10);
    if (START_TIMESTAMP > 0 && txTime > 0 && txTime < START_TIMESTAMP) continue;

    // Skip our own contracts
    if (blocklist.includes(from)) continue;

    const amount = ethers.formatEther(value);
    console.log(`\n💰 [LoyaltyBot] ${amount} ETH | from ${from.slice(0, 14)}... | ${txHash.slice(0, 20)}...`);

    const recorded = await recordOnChain(value);

    data.fees.push({ txHash, amount, timestamp: Date.now(), from, recorded });
    newFees++;
  }

  if (newFees > 0) {
    saveData(data);
    // Persist processed tx hashes (keep most recent 500)
    const state = loadState();
    const all = [...new Set([...state.lastCheckedTxHashes, ...Array.from(processedTxs)])];
    state.lastCheckedTxHashes = all.slice(-500);
    saveState(state);
    console.log(`  ✅ ${newFees} new loyalty fee(s) recorded`);
  }
}

// ─── Start ───

export function startLoyaltyBot() {
  // Restore processed txs from disk
  const state = loadState();
  for (const h of state.lastCheckedTxHashes) processedTxs.add(h);
  // Also restore from fees file
  const data = loadData();
  for (const f of data.fees) processedTxs.add(f.txHash);

  console.log(`💰 Loyalty Bot — watching treasury (chain ${CHAIN_ID}, every ${POLL_MS / 1000}s)`);
  console.log(`   Blocklist: ${getBlocklist().length} contracts`);
  scanForLoyaltyFees();
  setInterval(scanForLoyaltyFees, POLL_MS);
}
