/**
 * Upgrade NFT — add contractURI for OpenSea collection display.
 * Redeploys only the NFT, rewires existing PM/SV/ID.
 *
 * Usage:
 *   npx hardhat run scripts/upgrade-nft-contractURI.ts --network mainnet
 */

import { ethers, artifacts } from "hardhat";

const EXISTING = {
  pm: "0x01bF92912c2236219eaBAd5F230aDC0790B0Db02",
  sv: "0x79A1198914210489d683326EC778C2C99aFBDc00",
  id: "0x2D427F7Ec7E52411Cf42D2Bfec0F09bc9E6906a6",
};

async function rawDeploy(signer: ethers.Wallet, artifactName: string, args: any[]): Promise<string> {
  const art = await artifacts.readArtifact(artifactName);
  const factory = new ethers.ContractFactory(art.abi, art.bytecode, signer);
  const tx = await factory.getDeployTransaction(...args);
  if (!tx.data) throw new Error("No deploy data");
  const res = await signer.sendTransaction({ data: tx.data, gasLimit: 5000000 });
  console.log(`  Tx: ${res.hash}`);
  const receipt = await signer.provider!.waitForTransaction(res.hash);
  if (!receipt || receipt.status !== 1) throw new Error(`Deploy failed: ${artifactName}`);
  return receipt.contractAddress!;
}

async function main() {
  const rpcUrl = process.env.MAINNET_RPC_URL;
  const pk = process.env.PRIVATE_KEY;
  if (!rpcUrl || !pk) throw new Error("Missing env vars");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(pk, provider);
  console.log("Deployer:", signer.address);

  const feeData = await provider.getFeeData();
  console.log(`Gas: ${Number(ethers.formatUnits(feeData.gasPrice || 0n, "gwei")).toFixed(2)} gwei\n`);

  const treasuryEOA = process.env.TREASURY_EOA!;
  const mintPriceEnv = process.env.MAINNET_MINT_PRICE_ETH || "0.005";

  // ============ 1. Deploy new G-pass NFT ============
  console.log("=== Deploying new G-pass NFT (with contractURI) ===");
  const nftAddr = await rawDeploy(signer, "GoogleStockNFT", [signer.address, ethers.parseEther(mintPriceEnv)]);
  console.log("New NFT:", nftAddr);

  // ============ 2. Wire new NFT ============
  console.log("\n=== Wiring new NFT ===");
  const nftAbi = (await artifacts.readArtifact("GoogleStockNFT")).abi;
  const nft = new ethers.Contract(nftAddr, nftAbi, signer);

  async function tx(fn: Promise<ethers.ContractTransactionResponse>) {
    await (await fn).wait();
  }

  await tx(nft.setTreasuryEOA(treasuryEOA));
  await tx(nft.setPlatformManager(EXISTING.pm));
  await tx(nft.setStockVault(EXISTING.sv));
  await tx(nft.setInterestDistributor(EXISTING.id));
  console.log("  ✓ New NFT wired");

  // ============ 3. Update PM/SV/ID to point to new NFT ============
  console.log("\n=== Updating existing contracts → new NFT ===");
  const pmAbi = (await artifacts.readArtifact("PlatformManager")).abi;
  const svAbi = (await artifacts.readArtifact("StockVault")).abi;
  const idAbi = (await artifacts.readArtifact("InterestDistributor")).abi;
  const pm = new ethers.Contract(EXISTING.pm, pmAbi, signer);
  const sv = new ethers.Contract(EXISTING.sv, svAbi, signer);
  const id = new ethers.Contract(EXISTING.id, idAbi, signer);

  await tx(pm.updateGoogleStockNFT(nftAddr));
  console.log("  ✓ PM → new NFT");
  await tx(sv.updateGoogleStockNFT(nftAddr));
  console.log("  ✓ SV → new NFT");
  await tx(id.updateGoogleStockNFT(nftAddr));
  console.log("  ✓ ID → new NFT");

  // ============ 4. Upload contractURI to IRYS ============
  console.log("\n=== Uploading collection metadata to IRYS ===");
  const { Uploader } = await import("@irys/upload");
  const { Ethereum } = await import("@irys/upload-ethereum");

  const irys = Uploader(Ethereum)
    .withWallet(pk)
    .withRpc(rpcUrl)
    .mainnet();

  // Fund IRYS if needed
  const bal = await irys.getBalance();
  const minBal = irys.utils.toAtomic(0.002);
  if (bal < minBal) {
    console.log("  Funding IRYS...");
    const fundTx = await irys.fund(irys.utils.toAtomic(0.004));
    console.log(`  Funded: ${irys.utils.fromAtomic(fundTx.quantity)} ${irys.token}`);
  }

  const collectionMeta = {
    name: "G-pass NFT",
    description: "Tokenized fractional ownership of Alphabet Class A (GOOGL) stock via Ondo Finance GOOGLon. Each G‑pass NFT entitles the holder to a proportional claim on GOOGLon held in the StockVault, plus DeFi yield earned through Aave V3 on Ethereum mainnet.",
    image: process.env.CERTIFICATE_TEMPLATE_URL || "https://gateway.irys.xyz/DZqDgm2LqH8pDXTtuC7uUByYPaCHiibmR3vQtbBf17DK",
    external_link: "",
    seller_fee_basis_points: 1000,
    fee_recipient: treasuryEOA,
  };

  console.log("  Uploading collection metadata...");
  const receipt = await irys.upload(JSON.stringify(collectionMeta), {
    tags: [
      { name: "Content-Type", value: "application/json" },
      { name: "App-Name", value: "G-pass NFT" },
    ],
  });
  const contractURIUrl = `https://gateway.irys.xyz/${receipt.id}`;
  console.log(`  ✓ Uploaded: ${contractURIUrl}`);

  // ============ 5. Set contractURI on new NFT ============
  console.log("\n=== Setting contractURI on-chain ===");
  await tx(nft.setContractURI(contractURIUrl));
  console.log("  ✓ contractURI set");

  // ============ SUMMARY ============
  console.log("\n========================================");
  console.log("NFT UPGRADE COMPLETE");
  console.log("========================================");
  console.log("New G-pass NFT:     ", nftAddr);
  console.log("contractURI:        ", contractURIUrl);
  console.log("PM/SV/ID updated:   ✓");
  console.log("========================================");

  // Update deployed.json
  const fs = require("fs");
  const path = require("path");
  const deployedPath = path.join(__dirname, "..", "deployed.json");
  const d = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
  d.googleStockNFT = nftAddr;
  fs.writeFileSync(deployedPath, JSON.stringify(d, null, 2));
  console.log("Updated deployed.json");
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
