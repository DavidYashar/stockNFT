import { ethers } from "hardhat";

/**
 * Full Reset Deploy — All contracts from scratch
 * V21.1: Marketplace V2 (PM auto-loyalty), MockAavePool V3 (yield-cap), InterestDistributor V2 (equal-dist)
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const treasuryEOA = process.env.TREASURY_EOA || deployer.address;
  const treasuryVault = process.env.TREASURY_VAULT_ADDRESS || treasuryEOA;
  const pmDeployer = deployer.address; // PM deployed by deployer, ownership transferred later

  // ============ 1. Mock Tokens ============
  console.log("\n=== Mock Tokens ===");
  
  const MockGOOGLon = await ethers.getContractFactory("MockGOOGLon");
  const googlon = await MockGOOGLon.deploy();
  await googlon.waitForDeployment();
  const googlonAddr = await googlon.getAddress();
  console.log("MockGOOGLon:", googlonAddr);

  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const usdcAddr = await usdc.getAddress();
  console.log("MockUSDC:", usdcAddr);

  // ============ 2. MockAavePool ============
  console.log("\n=== MockAavePool ===");
  const MockAavePool = await ethers.getContractFactory("MockAavePool");
  const aave = await MockAavePool.deploy();
  await aave.waitForDeployment();
  const aaveAddr = await aave.getAddress();
  console.log("MockAavePool:", aaveAddr);

  // ============ 2b. MockSwap ============
  console.log("\n=== MockSwap ===");
  const MockSwap = await ethers.getContractFactory("MockSwap");
  const mswap = await MockSwap.deploy(usdcAddr);
  await mswap.waitForDeployment();
  const mswapAddr = await mswap.getAddress();
  console.log("MockSwap:", mswapAddr);

  // Pre-fund MockSwap with 0.01 ETH
  const fundTx = await deployer.sendTransaction({ to: mswapAddr, value: ethers.parseEther("0.01") });
  await fundTx.wait();
  console.log("MockSwap pre-funded with 0.01 ETH");

  // ============ 3. PlatformManager ============
  console.log("\n=== PlatformManager ===");
  const PM = await ethers.getContractFactory("PlatformManager");
  const pm = await PM.deploy(pmDeployer);
  await pm.waitForDeployment();
  const pmAddr = await pm.getAddress();
  console.log("PlatformManager:", pmAddr);

  // ============ 4. StockVault ============
  console.log("\n=== StockVault ===");
  const SV = await ethers.getContractFactory("StockVault");
  const sv = await SV.deploy(
    deployer.address, // placeholder USDC (not used in ETH-native testnet flow)
    googlonAddr,
    deployer.address
  );
  await sv.waitForDeployment();
  const svAddr = await sv.getAddress();
  console.log("StockVault:", svAddr);

  // ============ 5. InterestDistributor ============
  console.log("\n=== InterestDistributor ===");
  const ID = await ethers.getContractFactory("InterestDistributor");
  const id = await ID.deploy(deployer.address);
  await id.waitForDeployment();
  const idAddr = await id.getAddress();
  console.log("InterestDistributor:", idAddr);

  // ============ 6. GoogleStockNFT ============
  console.log("\n=== GoogleStockNFT ===");
  const NFT = await ethers.getContractFactory("GoogleStockNFT");
  const initialPrice = ethers.parseEther("0.01");
  const nft = await NFT.deploy(deployer.address, initialPrice);
  await nft.waitForDeployment();
  const nftAddr = await nft.getAddress();
  console.log("GoogleStockNFT:", nftAddr);

  // ============ 7. Marketplace ============
  console.log("\n=== Marketplace ===");
  const MP = await ethers.getContractFactory("Marketplace");
  const mp = await MP.deploy(pmAddr);
  await mp.waitForDeployment();
  const mpAddr = await mp.getAddress();
  console.log("Marketplace:", mpAddr);

  // ============ WIRING ============
  console.log("\n=== Wiring ===");

  // NFT
  await (await nft.setTreasuryEOA(treasuryEOA)).wait();
  await (await nft.setPlatformManager(pmAddr)).wait();
  await (await nft.setStockVault(svAddr)).wait();
  await (await nft.setInterestDistributor(idAddr)).wait();
  await (await nft.setMintPrice(ethers.parseEther("0.005"))).wait(); // $10 at $2000/ETH
  console.log("  NFT wired ✓");

  // PM
  await (await pm.setGoogleStockNFT(nftAddr)).wait();
  await (await pm.setStockVault(svAddr)).wait();
  console.log("  PM wired ✓");

  // SV
  await (await sv.setPlatformManager(pmAddr)).wait();
  await (await sv.setGoogleStockNFT(nftAddr)).wait();
  await (await sv.setTreasuryVault(treasuryEOA)).wait();
  await (await sv.setFeeRecipient(treasuryEOA)).wait(); // 5% fee goes to treasury
  console.log("  SV wired ✓");

  // ID
  await (await id.setGoogleStockNFT(nftAddr)).wait();
  await (await id.setTreasuryVault(treasuryVault)).wait();
  await (await id.setPlatformManager(pmAddr)).wait();
  console.log("  ID wired ✓");

  // Set sweepOperator on PM (treasury vault) for DeFi operations
  console.log("\n=== sweepOperator ===");
  await (await pm.setSweepOperator(treasuryVault)).wait();
  console.log("  PM.sweepOperator →", treasuryVault);

  // Transfer ownership: PM stays with deployer (mint controls), SV+ID go to treasury vault
  console.log("\n=== Ownership ===");
  console.log("  PM owner stays as deployer (for mint lifecycle controls)");
  await (await sv.transferOwnership(treasuryVault)).wait();
  console.log("  SV owner → treasury vault");
  await (await id.transferOwnership(treasuryVault)).wait();
  console.log("  ID owner → treasury vault");
  // NFT stays with deployer

  // ============ SUMMARY ============
  console.log("\n========================================");
  console.log("FULL RESET DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log("GoogleStockNFT:       ", nftAddr);
  console.log("PlatformManager:      ", pmAddr);
  console.log("StockVault:           ", svAddr);
  console.log("InterestDistributor:  ", idAddr);
  console.log("Marketplace:          ", mpAddr);
  console.log("MockGOOGLon:          ", googlonAddr);
  console.log("MockUSDC:             ", usdcAddr);
  console.log("MockAavePool:         ", aaveAddr);
  console.log("MockSwap:             ", mswapAddr);
  console.log("Treasury EOA:         ", treasuryEOA);
  console.log("Treasury Vault:       ", treasuryVault);
  console.log("========================================");

  // Save
  const fs = require("fs");
  const path = require("path");
  fs.writeFileSync(path.join(__dirname, "..", "deployed.json"), JSON.stringify({
    googleStockNFT: nftAddr,
    platformManager: pmAddr,
    stockVault: svAddr,
    interestDistributor: idAddr,
    marketplace: mpAddr,
    googlon: googlonAddr,
    mockUsdc: usdcAddr,
    mockAavePool: aaveAddr,
    mockSwap: mswapAddr,
    treasuryEOA,
    treasuryVault,
    network: "sepolia",
  }, null, 2));
  console.log("Saved to deployed.json");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
