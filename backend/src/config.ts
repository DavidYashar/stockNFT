import * as dotenv from "dotenv";
dotenv.config();

export const config = {
  rpcUrl: process.env.RPC_URL || "",
  privateKey: process.env.PRIVATE_KEY || "",

  contracts: {
    googleStockNFT: process.env.GOOGLE_STOCK_NFT || "",
    stockVault: process.env.STOCK_VAULT || "",
    platformManager: process.env.PLATFORM_MANAGER || "",
    ourToken: process.env.OUR_TOKEN || "",
    diamondHands: process.env.DIAMOND_HANDS || "",
    erc6551Account: process.env.ERC6551_ACCOUNT || "",
    treasuryEOA: process.env.TREASURY_EOA || "",
  },

  intervals: {
    triggerMonitorMinutes: parseInt(process.env.TRIGGER_MONITOR_INTERVAL_MINUTES || "10", 10),
  },

  // Network display name (used in certificates)
  networkDisplayName: process.env.NETWORK_DISPLAY_NAME || "Robinhood Chain",
};
