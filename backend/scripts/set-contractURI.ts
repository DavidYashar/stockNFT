/**
 * Upload collection metadata to IRYS and set contractURI on G-pass NFT.
 * Run: npx ts-node scripts/set-contractURI.ts
 */
import { config } from "./config";
import { ethers } from "ethers";

async function main() {
  console.log("Connecting to IRYS...");
  const { Uploader } = await import("@irys/upload");
  const { Ethereum } = await import("@irys/upload-ethereum");

  const irys = Uploader(Ethereum)
    .withWallet(config.irys.privateKey || config.privateKey)
    .withRpc(config.irys.rpcUrl);

  const irysNode = config.irys.network === "mainnet" ? irys : irys.devnet();
  console.log("Network:", config.irys.network);

  // Fund if needed
  try {
    const bal = await irysNode.getBalance();
    const eth = Number(irysNode.utils.fromAtomic(bal));
    console.log("IRYS balance:", eth.toFixed(6), irysNode.token);
    if (eth < 0.002) {
      console.log("Funding 0.004 ETH...");
      const ftx = await irysNode.fund(irysNode.utils.toAtomic(0.004));
      console.log("Funded:", irysNode.utils.fromAtomic(ftx.quantity));
    }
  } catch (e: any) {
    console.log("Balance check skipped:", e.message?.slice(0, 60));
  }

  const meta = {
    name: "G-pass NFT",
    description:
      "Tokenized fractional ownership of Alphabet Class A (GOOGL) stock via Ondo Finance GOOGLon. Each G-pass NFT entitles the holder to a proportional claim on GOOGLon held in the StockVault, plus DeFi yield earned through Aave V3 on Ethereum mainnet.",
    image: config.certificateTemplateUrl,
    external_link: "",
    seller_fee_basis_points: 1000,
    fee_recipient: config.contracts.treasuryEOA,
  };

  console.log("Uploading metadata...");
  const receipt = await irysNode.upload(JSON.stringify(meta), {
    tags: [
      { name: "Content-Type", value: "application/json" },
      { name: "App-Name", value: "G-pass NFT" },
    ],
  });

  const uri = `${config.irysGateway}/${receipt.id}`;
  console.log("Collection metadata:", uri);

  // Set on-chain
  console.log("Setting contractURI on-chain...");
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const signer = new ethers.Wallet(config.privateKey, provider);
  const nft = new ethers.Contract(
    config.contracts.googleStockNFT,
    ["function setContractURI(string)", "function contractURI() view returns (string)"],
    signer
  );

  const tx = await nft.setContractURI(uri);
  await tx.wait();
  console.log("✅ contractURI set!");
  console.log("Verified:", await nft.contractURI());
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
