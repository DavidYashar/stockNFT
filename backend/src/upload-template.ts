/**
 * One-time script: upload certificate template to IRYS and print the permanent URL.
 * Run: npx ts-node backend/src/upload-template.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { config } from "./config";

async function getIrys() {
  const { Uploader } = await import("@irys/upload");
  const { Ethereum } = await import("@irys/upload-ethereum");
  return (Uploader(Ethereum) as any)
    .withWallet(config.privateKey)
    .withRpc(config.rpcUrl)
    .devnet();
}

async function main() {
  const irys: any = await getIrys();

  // Fund if needed
  const bal = await irys.getBalance();
  console.log(`IRYS balance: ${irys.utils.fromAtomic(bal)} ${irys.token}`);
  if (bal < irys.utils.toAtomic(config.irys.minBalance)) {
    console.log(`Funding ${config.irys.fundAmount}...`);
    const fundTx = await irys.fund(irys.utils.toAtomic(config.irys.fundAmount), config.irys.fundMultiplier);
    console.log(`Funded: ${irys.utils.fromAtomic(fundTx.quantity)} ${irys.token}`);
  }

  const pngPath = resolve(__dirname, "../../frontend/public/certificate-template.png");
  const pngBuffer = readFileSync(pngPath);
  console.log(`Template size: ${(pngBuffer.length / 1024).toFixed(1)} KB`);

  const receipt = await irys.upload(pngBuffer, {
    tags: [
      { name: "Content-Type", value: "image/png" },
      { name: "App-Name", value: "GoogleStockNFT" },
      { name: "Type", value: "certificate-template" },
    ],
  });

  console.log(`\n✅ Template uploaded!`);
  console.log(`URL: https://gateway.irys.xyz/${receipt.id}`);
  console.log(`\nAdd this to your config/env as CERTIFICATE_TEMPLATE_URL`);
}

main().catch(console.error);
