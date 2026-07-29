/**
 * Google Stock NFT V3 — Backend Entry Point
 *
 * Whitelist submission API. Metadata is fully on-chain (SVG certificate in tokenURI).
 * Run: npx ts-node src/index.ts
 */

import * as dotenv from "dotenv";
dotenv.config();

import * as http from "http";
import { handleWhitelistRoutes } from "./routes/whitelist-verify";

const API_PORT = parseInt(process.env.API_PORT || "3002", 10);
const ALLOWED_ORIGIN = process.env.FRONTEND_URL || "http://localhost:3000";
const MAX_BODY_SIZE = 8_192; // 8 KB

console.log("═══════════════════════════════════════");
console.log("  Google Stock NFT V3 — Backend Running");
console.log("  Whitelist: /api/whitelist/*");
console.log("  CORS:      " + ALLOWED_ORIGIN);
console.log("  Press Ctrl+C to stop.");
console.log("═══════════════════════════════════════\n");

// ─── Helpers ───

function readBody(req: http.IncomingMessage, maxSize: number): Promise<string | null> {
  return new Promise((resolve) => {
    let body = "";
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxSize) {
        resolve(null); // exceeded limit
        req.destroy();
        return;
      }
      body += chunk.toString();
    });
    req.on("end", () => resolve(body));
    req.on("error", () => resolve(null));
  });
}

// ─── API Server ───

http.createServer(async (req, res) => {
  // CORS — only allow configured frontend origin
  const origin = req.headers.origin || "";
  if (origin === ALLOWED_ORIGIN || ALLOWED_ORIGIN === "*") {
    res.setHeader("Access-Control-Allow-Origin", origin || ALLOWED_ORIGIN);
  } else {
    res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Body size check for POST endpoints
  if (req.method === "POST") {
    const contentLength = parseInt(req.headers["content-length"] || "0", 10);
    if (contentLength > MAX_BODY_SIZE) {
      res.writeHead(413);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Request body too large" }));
      return;
    }
  }

  // ─── Whitelist Routes ───
  if (await handleWhitelistRoutes(req, res)) return;

  // Fallback
  res.setHeader("Content-Type", "application/json");
  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
}).listen(API_PORT, () => {
  console.log(`  📡 API server on http://localhost:${API_PORT}`);
});

