"use client";

import { useState, useEffect, useCallback } from "react";

// CoinGecko free API — no key needed, rate-limited ~30 calls/min
const API_URL = "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd";

const FALLBACK_PRICE = 2000;
const REFRESH_MS = 5 * 60 * 1000; // 5 min

let cachedPrice: number | null = null;
let lastFetch = 0;

export function useETHPrice() {
  const [price, setPrice] = useState<number>(cachedPrice ?? FALLBACK_PRICE);
  const [loading, setLoading] = useState(!cachedPrice);
  const [isLive, setIsLive] = useState(!!cachedPrice);

  const fetchPrice = useCallback(async () => {
    const now = Date.now();
    if (cachedPrice && now - lastFetch < REFRESH_MS) {
      setPrice(cachedPrice);
      setIsLive(true);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      const ethPrice = data?.ethereum?.usd;
      if (typeof ethPrice === "number" && ethPrice > 0) {
        cachedPrice = ethPrice;
        lastFetch = now;
        setPrice(ethPrice);
        setIsLive(true);
      } else {
        throw new Error("Invalid price");
      }
    } catch {
      setIsLive(false);
      setPrice(cachedPrice ?? FALLBACK_PRICE);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrice();
    const interval = setInterval(fetchPrice, REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchPrice]);

  return { price, loading, isLive, refetch: fetchPrice };
}
