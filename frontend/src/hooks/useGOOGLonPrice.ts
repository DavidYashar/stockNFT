"use client";

import { useState, useEffect, useCallback } from "react";

// Server-side API route — proxies Yahoo Finance, no CORS issues
const API_URL = "/api/googl-price";

const FALLBACK_PRICE = 365;
const REFRESH_MS = 30 * 60 * 1000;

let cachedPrice: number | null = null;
let lastFetch = 0;

export function useGOOGLonPrice() {
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
      const price = data?.price;
      if (typeof price === "number" && price > 0) {
        cachedPrice = price;
        lastFetch = now;
        setPrice(price);
        setIsLive(true);
      } else {
        throw new Error("Invalid price");
      }
    } catch {
      if (cachedPrice) {
        setPrice(cachedPrice);
      } else {
        setPrice(FALLBACK_PRICE);
      }
      setIsLive(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPrice();
    const interval = setInterval(fetchPrice, REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchPrice]);

  return { price, loading, isLive };
}
