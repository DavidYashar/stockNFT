/**
 * Resume Mainnet Deploy — GooglonSwapAdapter already deployed.
 * Deploys remaining 4 contracts + wires all 5.
 *
 * Usage:
 *   npx hardhat run scripts/deploy-resume3.ts --network mainnet
 */

import { ethers } from "hardhat";

// Already deployed (tx 0xfab65df9...)
const SWAP_ADAPTER = "0x1b59283C54538E3ab0c3Df36C5c6f0FEA91E0bc5";

/** Robust deploy helper — avoids waitForDeployment() bug */
async function deployAndWait(factory: any, ...args: any[]): Promise<string> {
  const contract = await factory.deploy(...args);
  const tx = contract.deploymentTransaction();
  if (!tx) throw new Error("No deployment tx");
  await tx.wait();
  return await contract.getAddress();
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Resuming — SwapAdapter already at:", SWAP_ADAPTER, "\n");

  const feeData = await ethers.provider.getFeeData();
  const gasPrice = feeData.gasPrice || 0n;
  const gasGwei = Number(ethers.formatUnits(gasPrice, "gwei"));
  console.log(`⚡ Gas: ${gasGwei.toFixed(2)} gwei\n`);

  // ── Env vars ──
  const treasuryEOA = process.env.TREASURY_EOA;
  const treasuryVault = process.env.TREASURY_VAULT_ADDRESS || treasuryEOA;
  if (!treasuryEOA) throw new Error("TREASURY_EOA not set");

  const googlonAddr = process.env.GOOGLON_TOKEN;
  const usdcAddr = process.env.USDC_TOKEN || "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const wethAddr = process.env.WETH_TOKEN || "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

  if (!googlonAddr) throw new Error("GOOGLON_TOKEN not set");

  const swapAdapterAddr = SWAP_ADAPTER;

  // ============ 2. PlatformManager ============
  console.log("=== PlatformManager ===");
  const PM = await ethers.getContractFactory("PlatformManager");
  const pmAddr = await deployAndWait(PM, deployer.address);
  console.log("PlatformManager:", pmAddr);

  // ============ 3. StockVault ============
  console.log("\n=== StockVault ===");
  const SV = await ethers.getContractFactory("StockVault");
  const svAddr = await deployAndWait(SV, usdcAddr, googlonAddr, deployer.address);
  console.log("StockVault:", svAddr);

  // ============ 4. InterestDistributor ============
  console.log("\n=== InterestDistributor ===");
  const ID = await ethers.getContractFactory("InterestDistributor");
  const idAddr = await deployAndWait(ID, deployer.address);
  console.log("InterestDistributor:", idAddr);

  // ============ 5. GoogleStockNFT ============
  console.log("\n=== GoogleStockNFT ===");
  const NFT = await ethers.getContractFactory("GoogleStockNFT");
  const mintPriceEnv = process.env.MAINNET_MINT_PRICE_ETH || "0.005";
  const initialPrice = ethers.parseEther(mintPriceEnv);
  const nftAddr = await deployAndWait(NFT, deployer.address, initialPrice);
  console.log("GoogleStockNFT:", nftAddr);
  console.log("Initial mint price:", mintPriceEnv, "ETH");

  // ============ WIRING ============
  console.log("\n=== Wiring ===");

  const nft = await ethers.getContractAt("GoogleStockNFT", nftAddr, deployer);
  const pm = await ethers.getContractAt("PlatformManager", pmAddr, deployer);
  const sv = await ethers.getContractAt("StockVault", svAddr, deployer);
  const id = await ethers.getContractAt("InterestDistributor", idAddr, deployer);
  const swapAdapter = await ethers.getContractAt("GooglonSwapAdapter", swapAdapterAddr, deployer);

  // NFT
  await (await nft.setTreasuryEOA(treasuryEOA, { gasLimit: 100000 })).wait();
  await (await nft.setPlatformManager(pmAddr, { gasLimit: 100000 })).wait();
  await (await nft.setStockVault(svAddr, { gasLimit: 100000 })).wait();
  await (await nft.setInterestDistributor(idAddr, { gasLimit: 100000 })).wait();
  console.log("  NFT wired ✓");

  // PM
  await (await pm.setGoogleStockNFT(nftAddr, { gasLimit: 100000 })).wait();
  await (await pm.setStockVault(svAddr, { gasLimit: 100000 })).wait();
  console.log("  PM wired ✓");

  // SV
  await (await sv.setPlatformManager(pmAddr, { gasLimit: 100000 })).wait();
  await (await sv.setGoogleStockNFT(nftAddr, { gasLimit: 100000 })).wait();
  await (await sv.setTreasuryVault(treasuryEOA, { gasLimit: 100000 })).wait();
  await (await sv.setFeeRecipient(treasuryEOA, { gasLimit: 100000 })).wait();
  await (await sv.setGooglonSwap(swapAdapterAddr, { gasLimit: 100000 })).wait();
  console.log("  SV wired ✓ (swap adapter configured)");

  // SwapAdapter — authorize StockVault
  await (await swapAdapter.setStockVault(svAddr, { gasLimit: 100000 })).wait();
  console.log("  SwapAdapter wired ✓");

  // ID
  await (await id.setGoogleStockNFT(nftAddr, { gasLimit: 100000 })).wait();
  await (await id.setTreasuryVault(treasuryVault, { gasLimit: 100000 })).wait();
  await (await id.setPlatformManager(pmAddr, { gasLimit: 100000 })).wait();
  console.log("  ID wired ✓");

  // Set sweepOperator on PM
  console.log("\n=== sweepOperator ===");
  await (await pm.setSweepOperator(treasuryVault, { gasLimit: 100000 })).wait();
  console.log("  PM.sweepOperator →", treasuryVault);

  // Transfer ownership
  console.log("\n=== Ownership ===");
  console.log("  PM owner stays as deployer (mint lifecycle controls)");
  await (await sv.transferOwnership(treasuryVault, { gasLimit: 100000 })).wait();
  console.log("  SV owner → treasury vault");
  await (await id.transferOwnership(treasuryVault, { gasLimit: 100000 })).wait();
  console.log("  ID owner → treasury vault");
  await (await swapAdapter.transferOwnership(treasuryVault, { gasLimit: 100000 })).wait();
  console.log("  SwapAdapter owner → treasury vault");

  // ============ SUMMARY ============
  console.log("\n========================================");
  console.log("MAINNET DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log("GoogleStockNFT:       ", nftAddr);
  console.log("PlatformManager:      ", pmAddr);
  console.log("StockVault:           ", svAddr);
  console.log("GooglonSwapAdapter:   ", swapAdapterAddr);
  console.log("InterestDistributor:  ", idAddr);
  console.log("USDC (real):          ", usdcAddr);
  console.log("GOOGLon (real):       ", googlonAddr);
  console.log("Treasury EOA:         ", treasuryEOA);
  console.log("Treasury Vault:       ", treasuryVault);
  console.log("========================================");

  // Save deployed.json
  const fs = require("fs");
  const path = require("path");
  fs.writeFileSync(path.join(__dirname, "..", "deployed.json"), JSON.stringify({
    googleStockNFT: nftAddr,
    platformManager: pmAddr,
    stockVault: svAddr,
    googlonSwapAdapter: swapAdapterAddr,
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
