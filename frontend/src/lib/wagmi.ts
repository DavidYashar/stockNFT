"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  okxWallet,
  phantomWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { mainnet } from "wagmi/chains";
import { http } from "viem";

const chain = mainnet;
const rpcUrl = process.env.NEXT_PUBLIC_MAINNET_RPC || "https://eth-mainnet.g.alchemy.com/v2/demo";

export const config = getDefaultConfig({
  appName: "Stock NFT",
  projectId: "stock-nft-v1",
  chains: [chain],
  transports: {
    [chain.id]: http(rpcUrl),
  },
  ssr: true,
  wallets: [
    {
      groupName: "Popular",
      wallets: [metaMaskWallet, okxWallet, phantomWallet, walletConnectWallet],
    },
  ],
});
