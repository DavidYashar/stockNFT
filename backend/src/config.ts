import * as dotenv from "dotenv";
dotenv.config();

export const config = {
  rpcUrl: process.env.RPC_URL || "https://eth-mainnet.g.alchemy.com/v2/demo",
  privateKey: process.env.PRIVATE_KEY || "",

  contracts: {
    googleStockNFT: process.env.GOOGLE_STOCK_NFT || "",
    stockVault: process.env.STOCK_VAULT || "",
    platformManager: process.env.PLATFORM_MANAGER || "",
    interestDistributor: process.env.INTEREST_DISTRIBUTOR || "",
    treasuryEOA: process.env.TREASURY_EOA || "",
  },

  intervals: {
    defiSweepMinutes: parseInt(process.env.DEFI_SWEEP_INTERVAL_MINUTES || "240", 10),
    yieldHarvestMinutes: parseInt(process.env.YIELD_HARVEST_INTERVAL_MINUTES || "10080", 10),
    triggerMonitorMinutes: parseInt(process.env.TRIGGER_MONITOR_INTERVAL_MINUTES || "10", 10),
  },

  // ETH price in USD — primary source: CoinGecko API (getETHPrice in irys.service)
  // This env var is the fallback when CoinGecko is unavailable
  ethPriceUsd: Number(process.env.ETH_PRICE_USD) || 2000,

  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
    mainnetUrl: "https://api.etherscan.io/api",
  },

  irys: {
    privateKey: process.env.IRYS_PRIVATE_KEY || "",
    network: (process.env.IRYS_NETWORK || "mainnet") as "devnet" | "mainnet",
    rpcUrl: process.env.IRYS_RPC_URL || process.env.RPC_URL || "https://eth-mainnet.g.alchemy.com/v2/demo",
    // IRYS fund configuration
    minBalance: 0.002,          // Fund when balance drops below 0.002 ETH
    fundAmount: 0.004,          // Base fund amount in ETH
    fundMultiplier: 1.0,        // Actual funded = fundAmount × multiplier = 0.004 ETH
  },

  // Gateway base URL for IRYS/Arweave (changes per network)
  irysGateway: process.env.IRYS_NETWORK === "devnet"
    ? "https://devnet.irys.xyz"
    : "https://gateway.irys.xyz",

  certificateTemplateUrl:
    process.env.CERTIFICATE_TEMPLATE_URL ||
    "https://gateway.irys.xyz/DZqDgm2LqH8pDXTtuC7uUByYPaCHiibmR3vQtbBf17DK",

  // Certificate layout — shared with frontend/src/lib/constants.ts
  certificate: {
    width: 1414,
    height: 2000,
    valueX: 650,
    fieldY: {
      certificateNo: 920,
      owner: 1030,
      share: 1140,
      value: 1255,
      issueDate: 1370,
      network: 1480,
      googlPrice: 1585,
    },
  },
};
