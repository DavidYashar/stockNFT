/**
 * Final Resume — 2 of 5 contracts already deployed.
 * Deploys: StockVault, InterestDistributor, GoogleStockNFT
 * Then wires all 5.
 *
 * Already deployed:
 *   GooglonSwapAdapter: 0x1b59283C54538E3ab0c3Df36C5c6f0FEA91E0bc5
 *   PlatformManager:    0x53872Fc79f06799E4a15Ca29eCe4EA357C46e37B
 *
 * Usage:
 *   npx hardhat run scripts/deploy-final.ts --network mainnet
 */

import { ethers, artifacts } from "hardhat";

const SWAP_ADAPTER = "0x1b59283C54538E3ab0c3Df36C5c6f0FEA91E0bc5";
const PM_ADDR = "0x53872Fc79f06799E4a15Ca29eCe4EA357C46e37B";

async function rawDeploy(signer: ethers.Wallet, artifactName: string, args: any[]): Promise<string> {
  const art = await artifacts.readArtifact(artifactName);
  const factory = new ethers.ContractFactory(art.abi, art.bytecode, signer);
  const tx = await factory.getDeployTransaction(...args);
  if (!tx.data) throw new Error("No deploy data");
  const res = await signer.sendTransaction({ data: tx.data, gasLimit: 5000000 });
  console.log(`  Tx: ${res.hash}`);
  const receipt = await signer.provider!.waitForTransaction(res.hash);
  if (!receipt || receipt.status !== 1) throw new Error(`Deploy failed: ${artifactName}`);
  console.log(`  ✅ ${artifactName}: ${receipt.contractAddress}`);
  return receipt.contractAddress!;
}

async function main() {
  const rpcUrl = process.env.MAINNET_RPC_URL;
  const pk = process.env.PRIVATE_KEY;
  if (!rpcUrl) throw new Error("MAINNET_RPC_URL not set");
  if (!pk) throw new Error("PRIVATE_KEY not set");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(pk, provider);

  console.log("Deployer:", signer.address);
  console.log("SwapAdapter:", SWAP_ADAPTER);
  console.log("PlatformManager:", PM_ADDR, "\n");

  const feeData = await provider.getFeeData();
  console.log(`⚡ Gas: ${Number(ethers.formatUnits(feeData.gasPrice || 0n, "gwei")).toFixed(2)} gwei\n`);

  // ── Env ──
  const treasuryEOA = process.env.TREASURY_EOA;
  const treasuryVault = process.env.TREASURY_VAULT_ADDRESS || treasuryEOA;
  if (!treasuryEOA) throw new Error("TREASURY_EOA not set");

  const googlonAddr = process.env.GOOGLON_TOKEN;
  const usdcAddr = process.env.USDC_TOKEN || "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  if (!googlonAddr) throw new Error("GOOGLON_TOKEN not set");

  const mintPriceEnv = process.env.MAINNET_MINT_PRICE_ETH || "0.005";

  // ============ Deploy remaining 3 ============

  const svAddr = await rawDeploy(signer, "StockVault", [usdcAddr, googlonAddr, signer.address]);
  const idAddr = await rawDeploy(signer, "InterestDistributor", [signer.address]);
  const nftAddr = await rawDeploy(signer, "GoogleStockNFT", [signer.address, ethers.parseEther(mintPriceEnv)]);

  console.log(`\nInitial mint price: ${mintPriceEnv} ETH\n`);

  // ============ Wiring ============
  console.log("=== Wiring ===");

  const nft = new ethers.Contract(nftAddr, (await artifacts.readArtifact("GoogleStockNFT")).abi, signer);
  const pm = new ethers.Contract(PM_ADDR, (await artifacts.readArtifact("PlatformManager")).abi, signer);
  const sv = new ethers.Contract(svAddr, (await artifacts.readArtifact("StockVault")).abi, signer);
  const id = new ethers.Contract(idAddr, (await artifacts.readArtifact("InterestDistributor")).abi, signer);
  const swapAdapter = new ethers.Contract(SWAP_ADAPTER, (await artifacts.readArtifact("GooglonSwapAdapter")).abi, signer);

  async function tx(fn: Promise<ethers.ContractTransactionResponse>) {
    const t = await fn;
    await t.wait();
    return t;
  }

  await tx(nft.setTreasuryEOA(treasuryEOA));
  await tx(nft.setPlatformManager(PM_ADDR));
  await tx(nft.setStockVault(svAddr));
  await tx(nft.setInterestDistributor(idAddr));
  console.log("  NFT wired ✓");

  await tx(pm.setGoogleStockNFT(nftAddr));
  await tx(pm.setStockVault(svAddr));
  console.log("  PM wired ✓");

  await tx(sv.setPlatformManager(PM_ADDR));
  await tx(sv.setGoogleStockNFT(nftAddr));
  await tx(sv.setTreasuryVault(treasuryEOA));
  await tx(sv.setFeeRecipient(treasuryEOA));
  await tx(sv.setGooglonSwap(SWAP_ADAPTER));
  console.log("  SV wired ✓");

  await tx(swapAdapter.setStockVault(svAddr));
  console.log("  SwapAdapter wired ✓");

  await tx(id.setGoogleStockNFT(nftAddr));
  await tx(id.setTreasuryVault(treasuryVault));
  await tx(id.setPlatformManager(PM_ADDR));
  console.log("  ID wired ✓");

  await tx(pm.setSweepOperator(treasuryVault));
  console.log("  PM.sweepOperator →", treasuryVault);

  console.log("\n=== Ownership ===");
  console.log("  PM owner stays as deployer");
  await tx(sv.transferOwnership(treasuryVault));
  console.log("  SV owner → treasury vault");
  await tx(id.transferOwnership(treasuryVault));
  console.log("  ID owner → treasury vault");
  await tx(swapAdapter.transferOwnership(treasuryVault));
  console.log("  SwapAdapter owner → treasury vault");

  console.log("\n========================================");
  console.log("MAINNET DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log("GoogleStockNFT:       ", nftAddr);
  console.log("PlatformManager:      ", PM_ADDR);
  console.log("StockVault:           ", svAddr);
  console.log("GooglonSwapAdapter:   ", SWAP_ADAPTER);
  console.log("InterestDistributor:  ", idAddr);
  console.log("========================================");

  const fs = require("fs");
  const path = require("path");
  fs.writeFileSync(path.join(__dirname, "..", "deployed.json"), JSON.stringify({
    googleStockNFT: nftAddr,
    platformManager: PM_ADDR,
    stockVault: svAddr,
    googlonSwapAdapter: SWAP_ADAPTER,
    interestDistributor: idAddr,
    usdc: usdcAddr,
    googlon: googlonAddr,
    treasuryEOA,
    treasuryVault,
    network: "mainnet",
  }, null, 2));
  console.log("Saved to deployed.json");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
