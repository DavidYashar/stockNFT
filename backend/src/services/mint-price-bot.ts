/**
 * Mint Price Bot
 *
 * Polls CoinGecko for ETH price, calculates $10 / ETH_price,
 * and updates the NFT contract's mintPrice if changed by ≥0.5%.
 * Uses deployer key (NFT owner).
 *
 * Single source of truth for mint pricing across the entire platform.
 */

import { ethers } from "ethers";
import { config } from "../config";
import { getWallet } from "../contracts";

const POLL_MS = 5 * 60 * 1000; // 5 minutes
const MIN_CHANGE_PCT = 0.5;     // Only update if price changed >0.5%

let lastEthPrice = 0;

async function fetchETHPrice(): Promise<number> {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
    if (!res.ok) throw new Error("CoinGecko fetch failed");
    const data = await res.json();
    const price = data?.ethereum?.usd;
    if (typeof price === "number" && price > 0) return price;
    throw new Error("Invalid price");
  } catch (err: any) {
    console.log(`  ⚠️ MintPriceBot: CoinGecko error: ${err.message?.slice(0, 80)}`);
    return 0;
  }
}

async function updateMintPrice() {
  const ethPrice = await fetchETHPrice();
  if (ethPrice <= 0) return;

  // Calculate $10 worth of ETH (configurable via TARGET_USD_PER_MINT)
  const targetUsd = Number(process.env.TARGET_USD_PER_MINT) || 10;
  const mintPriceEth = targetUsd / ethPrice;
  const mintPriceWei = ethers.parseEther(mintPriceEth.toFixed(8));

  // Only update if price changed significantly
  if (lastEthPrice > 0) {
    const pctChange = Math.abs(ethPrice - lastEthPrice) / lastEthPrice * 100;
    if (pctChange < MIN_CHANGE_PCT) return;
  }

  try {
    const wallet = getWallet();
    const nftAddr = config.contracts.googleStockNFT;
    if (!nftAddr) return;

    const nft = new ethers.Contract(nftAddr, [
      "function mintPrice() view returns (uint256)",
      "function setMintPrice(uint256)"
    ], wallet);

    const currentPrice = await nft.mintPrice();
    if (currentPrice === mintPriceWei) return; // No change

    const tx = await nft.setMintPrice(mintPriceWei);
    await tx.wait();

    lastEthPrice = ethPrice;
    console.log(`💰 [MintPriceBot] ETH: $${ethPrice} → Mint price: ${mintPriceEth.toFixed(6)} ETH (${ethers.formatEther(mintPriceWei)} ETH)`);
  } catch (err: any) {
    console.log(`  ⚠️ MintPriceBot: update failed: ${err.message?.slice(0, 80)}`);
  }
}

export function startMintPriceBot() {
  console.log("💰 Mint Price Bot — keeping mintPrice at $10 worth of ETH");
  updateMintPrice();
  setInterval(updateMintPrice, POLL_MS);
}
