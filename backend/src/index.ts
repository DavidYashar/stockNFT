/**
 * Google Stock NFT — Backend Entry Point
 *
 * Starts the IRYS metadata service (certificate inscription).
 * DeFi bots removed in V21 — treasury operations are manual via WalletConnect.
 * Run: npx ts-node src/index.ts
 */

import "./services/irys.service";
import { startLoyaltyBot, getLoyaltyFees } from "./services/loyalty-bot";
import { startMintPriceBot } from "./services/mint-price-bot";
import * as http from "http";

console.log("═══════════════════════════════════════");
console.log("  Google Stock NFT — Backend Running");
console.log("  IRYS metadata service active.");
console.log("  Loyalty Fee Bot active.");
console.log("  Mint Price Bot active.");
console.log("  DeFi operations: use admin page + WalletConnect.");
console.log("  Press Ctrl+C to stop.");
console.log("═══════════════════════════════════════\n");

startLoyaltyBot();
startMintPriceBot();

// Simple API server for admin page to query detected loyalty fees
const API_PORT = parseInt(process.env.API_PORT || "3002", 10);
http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  
  if (req.url === "/api/loyalty-fees") {
    const data = getLoyaltyFees();
    res.writeHead(200);
    res.end(JSON.stringify(data));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
  }
}).listen(API_PORT, () => {
  console.log(`  📡 API server on http://localhost:${API_PORT}`);
});
