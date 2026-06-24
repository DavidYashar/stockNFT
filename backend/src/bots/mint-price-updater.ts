/**
 * Mint Price Updater Bot
 *
 * Keeps the on-chain mintPrice pegged to $10 USD worth of ETH.
 * Fetches live ETH/USD from CoinGecko every 5 minutes and calls
 * setMintPrice() on the NFT contract.
 *
 * Run: npx tsx src/bots/mint-price-updater.ts
 */

import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

// ─── Config ───
const TARGET_USD = 10;
const UPDATE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd";
const MIN_ETH_PRICE = 0.0001; // safety floor — don't send 0 ETH

const NFT_ABI = [
  "function mintPrice() view returns (uint256)",
  "function setMintPrice(uint256) external",
  "function owner() view returns (address)",
];

// ─── Helpers ───

async function fetchEthPrice(): Promise<number> {
  const res = await fetch(COINGECKO_URL);
  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);
  const data = await res.json();
  const price = data?.ethereum?.usd;
  if (typeof price !== "number" || price <= 0) throw new Error("Invalid ETH price");
  return price;
}

function ethForUsd(ethPrice: number, targetUsd: number): string {
  const eth = targetUsd / ethPrice;
  if (eth < MIN_ETH_PRICE) return MIN_ETH_PRICE.toFixed(18);
  // Round up to avoid "below minimum" — add 0.5% buffer
  const withBuffer = eth * 1.005;
  return withBuffer.toFixed(18);
}

// ─── Main ───

async function main() {
  const rpcUrl = process.env.RPC_URL || process.env.MAINNET_RPC_URL;
  const privateKey = process.env.PRIVATE_KEY;
  const nftAddress = process.env.GOOGLE_STOCK_NFT;

  if (!rpcUrl || !privateKey || !nftAddress) {
    console.error("Missing env vars: RPC_URL, PRIVATE_KEY, GOOGLE_STOCK_NFT");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const nft = new ethers.Contract(nftAddress, NFT_ABI, wallet);

  // Verify ownership
  const owner = await nft.owner();
  if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error(`❌ Bot wallet is not owner. Owner: ${owner}, Bot: ${wallet.address}`);
    process.exit(1);
  }
  console.log(`✅ Bot is owner of NFT contract ${nftAddress}`);

  // ─── Update Loop ───
  async function updateOnce() {
    try {
      const ethPrice = await fetchEthPrice();
      const currentMintPrice = await nft.mintPrice();
      const currentEth = Number(ethers.formatEther(currentMintPrice));
      const currentUsd = currentEth * ethPrice;
      const targetEth = ethForUsd(ethPrice, TARGET_USD);
      const targetWei = ethers.parseEther(targetEth);
      const targetEthNum = Number(targetEth);
      const targetUsdDisplay = targetEthNum * ethPrice;

      // Skip if within 1% of target
      const diffPct = Math.abs(currentEth - targetEthNum) / targetEthNum;
      if (diffPct < 0.01) {
        console.log(
          `⏭  ETH: $${ethPrice.toFixed(0)} | mintPrice: ${currentEth.toFixed(6)} ETH ($${currentUsd.toFixed(2)}) — within 1%, skipping`
        );
        return;
      }

      console.log(
        `🔄 ETH: $${ethPrice.toFixed(0)} | Old: ${currentEth.toFixed(6)} ETH ($${currentUsd.toFixed(2)}) → New: ${targetEthNum.toFixed(6)} ETH ($${targetUsdDisplay.toFixed(2)})`
      );

      const tx = await nft.setMintPrice(targetWei);
      console.log(`   Tx: ${tx.hash}`);
      await tx.wait();
      console.log(`   ✅ Confirmed`);
    } catch (err: any) {
      console.error(`   ❌ Error: ${err.message?.slice(0, 200)}`);
    }
  }

  // Run immediately, then on interval
  await updateOnce();
  setInterval(updateOnce, UPDATE_INTERVAL_MS);
  console.log(`⏱  Updating every ${UPDATE_INTERVAL_MS / 60000} minutes...`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
