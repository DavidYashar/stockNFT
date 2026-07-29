"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { defineChain } from "viem";

const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "46630", 10);
const isTestnet = process.env.NEXT_PUBLIC_NETWORK === "testnet";

// Public RPC for wallet connection (add chain to wallet)
const publicRpc = process.env.NEXT_PUBLIC_PUBLIC_RPC
  || (isTestnet ? "https://rpc.testnet.chain.robinhood.com" : "https://rpc.mainnet.chain.robinhood.com");

// Alchemy RPC for DAPP operations (mint, admin, queries) — from env only
const platformRpc = process.env.NEXT_PUBLIC_MAINNET_RPC;
if (!platformRpc) {
  throw new Error("NEXT_PUBLIC_MAINNET_RPC is required — set your Alchemy RPC URL in .env.local");
}

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

export const robinhood = defineChain({
  id: chainId,
  name: process.env.NEXT_PUBLIC_NETWORK_DISPLAY_NAME || "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [publicRpc] } },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL || "https://explorer.testnet.chain.robinhood.com",
    },
  },
  testnet: isTestnet,
});

export const config = getDefaultConfig({
  appName: "StockNFT",
  projectId,
  chains: [robinhood],
  transports: { [robinhood.id]: http(platformRpc) },
  ssr: false,
});
