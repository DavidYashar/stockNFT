/**
 * ETH/USD Price — Shared Utility
 *
 * Multi-source: Coinbase (primary, cloud-friendly) → CoinGecko (fallback) → cached
 * Used by: IRYS metadata service + Mint Price Bot
 */

import { config } from "../config";

// ─── Cache ───
let cachedPrice = config.ethPriceUsd;
let lastFetch = 0;
const CACHE_MS = 5 * 60 * 1000; // 5 minutes

// ─── Sources ───

async function fetchCoinbase(): Promise<number> {
  const res = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot");
  if (!res.ok) throw new Error(`Coinbase ${res.status}`);
  const json = await res.json();
  const price = Number(json?.data?.amount);
  if (price > 0) return price;
  throw new Error("Coinbase: bad price");
}

async function fetchCoinGecko(): Promise<number> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
  );
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const json = await res.json();
  const price = Number(json?.ethereum?.usd);
  if (price > 0) return price;
  throw new Error("CoinGecko: bad price");
}

// ─── Main ───

export async function getETHPrice(): Promise<number> {
  const now = Date.now();
  if (now - lastFetch < CACHE_MS) return cachedPrice;

  // Try Coinbase first (cloud-friendly, generous free tier)
  for (const [name, fn] of [
    ["Coinbase", fetchCoinbase],
    ["CoinGecko", fetchCoinGecko],
  ] as const) {
    try {
      const price = await fn();
      cachedPrice = price;
      lastFetch = now;
      return price;
    } catch (err: any) {
      // Only log if both fail on the next iteration
    }
  }

  // Both failed — return cached (or env fallback)
  console.log(`  ⚠️  ETH price: Coinbase + CoinGecko both unavailable, using cached $${cachedPrice}`);
  return cachedPrice;
}

/** Force-refresh cache (useful after long downtime) */
export function clearPriceCache() {
  lastFetch = 0;
}
