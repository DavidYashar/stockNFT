/**
 * Quick test: generate a certificate PNG and upload to IRYS devnet.
 * Run: npx ts-node backend/src/test-irys-inscription.ts
 */
import dotenv from "dotenv";
dotenv.config();

import sharp from "sharp";
import { resolve } from "path";
import { readFileSync } from "fs";
import { config } from "./config";

const TEMPLATE_PATH = resolve(__dirname, "../../frontend/public/certificate-template.png");
const CERT = config.certificate;

async function generateTestPNG(): Promise<Buffer> {
  const textOverlay = `<svg width="${CERT.width}" height="${CERT.height}" xmlns="http://www.w3.org/2000/svg">
    <text x="${CERT.valueX}" y="${CERT.fieldY.certificateNo}" font-family="Georgia,serif" font-size="28" fill="#1e293b" font-weight="bold">#TEST-1</text>
    <text x="${CERT.valueX}" y="${CERT.fieldY.owner}" font-family="Courier New,monospace" font-size="22" fill="#334155" font-weight="bold">0xTest...Wallet</text>
    <text x="${CERT.valueX}" y="${CERT.fieldY.share}" font-family="Georgia,serif" font-size="28" fill="#1e293b" font-weight="bold">0.027397</text>
    <text x="${CERT.valueX}" y="${CERT.fieldY.value}" font-family="Georgia,serif" font-size="28" fill="#1e293b" font-weight="bold">$10</text>
    <text x="${CERT.valueX}" y="${CERT.fieldY.issueDate}" font-family="Courier New,monospace" font-size="22" fill="#334155" font-weight="bold">2026-06-14</text>
    <text x="${CERT.valueX}" y="${CERT.fieldY.network}" font-family="Courier New,monospace" font-size="22" fill="#334155" font-weight="bold">Ethereum Mainnet</text>
    <text x="${CERT.valueX}" y="${CERT.fieldY.googlPrice}" font-family="Georgia,serif" font-size="28" fill="#1e293b" font-weight="bold">$359.68</text>
  </svg>`;

  return sharp(TEMPLATE_PATH)
    .composite([{ input: Buffer.from(textOverlay), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

async function main() {
  const { Uploader } = await import("@irys/upload");
  const { Ethereum } = await import("@irys/upload-ethereum");

  const key = process.env.IRYS_PRIVATE_KEY || process.env.PRIVATE_KEY || "";
  const rpc = process.env.IRYS_RPC_URL || process.env.RPC_URL || "https://eth-mainnet.g.alchemy.com/v2/demo";
  const network = process.env.IRYS_NETWORK || "devnet";

  const irys: any = network === "mainnet"
    ? await Uploader(Ethereum).withWallet(key).withRpc(rpc)
    : await Uploader(Ethereum).withWallet(key).withRpc(rpc).devnet();

  console.log(`IRYS network: ${network}`);
  const bal = await irys.getBalance();
  console.log(`Balance: ${irys.utils.fromAtomic(bal)} ${irys.token}`);

  console.log("Generating certificate PNG...");
  const png = await generateTestPNG();
  console.log(`PNG size: ${(png.length / 1024).toFixed(1)} KB`);

  console.log("Uploading to IRYS...");
  const receipt = await irys.upload(png, {
    tags: [
      { name: "Content-Type", value: "image/png" },
      { name: "App-Name", value: "GoogleStockNFT-TEST" },
    ],
  });

  const gatewayBase = network === "mainnet" ? "https://gateway.irys.xyz" : "https://devnet.irys.xyz";
  const imageUrl = `${gatewayBase}/${receipt.id}`;
  console.log(`\n✅ Certificate: ${imageUrl}`);

  // Upload metadata
  const metadata = {
    name: "Google Stock NFT #TEST-1",
    description: "Test certificate — Google Stock NFT inscription via sharp PNG compositing",
    image: imageUrl,
    attributes: [
      { trait_type: "Google Shares (GOOGLon)", value: 0.027397 },
      { trait_type: "USDC Paid at Mint", value: 10 },
      { trait_type: "GOOGL Price at Mint (USD)", value: 359.68 },
      { trait_type: "Mint Date", value: "2026-06-14" },
      { trait_type: "Current Owner", value: "0xTest...Wallet" },
    ],
  };

  const metaReceipt = await irys.upload(JSON.stringify(metadata), {
    tags: [
      { name: "Content-Type", value: "application/json" },
      { name: "App-Name", value: "GoogleStockNFT-TEST" },
    ],
  });

  console.log(`Metadata: ${gatewayBase}/${metaReceipt.id}`);
  console.log("\n✅ IRYS inscription test complete!");
}

main().catch((e) => console.error(e.message || e));
