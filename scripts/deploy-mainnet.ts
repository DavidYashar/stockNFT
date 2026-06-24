import { ethers } from "hardhat";

/**
 * Mainnet Deploy — Google Stock NFT Platform
 *
 * Uses REAL token addresses (no mocks). Reads configuration from environment.
 *
 * Required env vars:
 *   MAINNET_RPC_URL                  — Ethereum mainnet RPC
 *   PRIVATE_KEY                      — Deployer private key (fresh, never used on testnet)
 *   TREASURY_EOA                     — Treasury EOA address
 *   GOOGLON_TOKEN                    — Real GOOGLon (Ondo Finance) token address
 *   USDC_TOKEN                       — (optional, default: 0xA0b86991...)
 *   WETH_TOKEN                       — (optional, default: 0xC02aaA39...)
 *   UNISWAP_V3_ROUTER                — (optional, default: 0xE592427A...)
 *   UNISWAP_V3_WETH_USDC_FEE         — (optional, default: 500 = 0.05%)
 *   UNISWAP_V3_USDC_GOOGLON_FEE      — (optional, default: 10000 = 1%)
 *   AAVE_V3_POOL                     — (optional, default: 0x87870Bca...)
 *   MAINNET_MINT_PRICE_ETH           — Initial mint price in ETH (default: 0.005)
 *
 * Usage:
 *   npx hardhat run scripts/deploy-mainnet.ts --network mainnet
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Network: MAINNET — using REAL token addresses\n");

  // ── Real token addresses (from env) ──
  const treasuryEOA = process.env.TREASURY_EOA;
  const treasuryVault = process.env.TREASURY_VAULT_ADDRESS || treasuryEOA;
  if (!treasuryEOA) throw new Error("TREASURY_EOA not set");

  const googlonAddr = process.env.GOOGLON_TOKEN;
  const usdcAddr = process.env.USDC_TOKEN || "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const wethAddr = process.env.WETH_TOKEN || "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const uniRouter = process.env.UNISWAP_V3_ROUTER || "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  const wethUsdcFee = parseInt(process.env.UNISWAP_V3_WETH_USDC_FEE || "500");     // 0.05%
  const usdcGooglonFee = parseInt(process.env.UNISWAP_V3_USDC_GOOGLON_FEE || "10000"); // 1%
  const aavePoolAddr = process.env.AAVE_V3_POOL || "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2";

  if (!googlonAddr) throw new Error("GOOGLON_TOKEN not set — must provide real GOOGLon address");

  console.log("USDC:", usdcAddr);
  console.log("WETH:", wethAddr);
  console.log("GOOGLon:", googlonAddr);
  console.log("Uniswap V3 Router:", uniRouter);
  console.log("Pool WETH/USDC fee:", wethUsdcFee, "| USDC/GOOGLon fee:", usdcGooglonFee);
  console.log("Aave V3 Pool:", aavePoolAddr);
  console.log("Treasury EOA:", treasuryEOA);
  console.log("");

  // ============ 1. GooglonSwapAdapter ============
  console.log("=== GooglonSwapAdapter ===");
  const SwapAdapter = await ethers.getContractFactory("GooglonSwapAdapter");
  const swapAdapter = await SwapAdapter.deploy(
    wethAddr,
    usdcAddr,
    googlonAddr,
    uniRouter,
    wethUsdcFee,
    usdcGooglonFee,
    deployer.address
  );
  await swapAdapter.waitForDeployment();
  const swapAdapterAddr = await swapAdapter.getAddress();
  console.log("GooglonSwapAdapter:", swapAdapterAddr);

  // ============ 2. PlatformManager ============
  console.log("\n=== PlatformManager ===");
  const PM = await ethers.getContractFactory("PlatformManager");
  const pm = await PM.deploy(deployer.address);
  await pm.waitForDeployment();
  const pmAddr = await pm.getAddress();
  console.log("PlatformManager:", pmAddr);

  // ============ 3. StockVault ============
  console.log("\n=== StockVault ===");
  const SV = await ethers.getContractFactory("StockVault");
  const sv = await SV.deploy(
    usdcAddr,         // real USDC
    googlonAddr,      // real GOOGLon
    deployer.address  // initial owner
  );
  await sv.waitForDeployment();
  const svAddr = await sv.getAddress();
  console.log("StockVault:", svAddr);

  // ============ 4. InterestDistributor ============
  console.log("\n=== InterestDistributor ===");
  const ID = await ethers.getContractFactory("InterestDistributor");
  const id = await ID.deploy(deployer.address);
  await id.waitForDeployment();
  const idAddr = await id.getAddress();
  console.log("InterestDistributor:", idAddr);

  // ============ 5. GoogleStockNFT ============
  console.log("\n=== GoogleStockNFT ===");
  const NFT = await ethers.getContractFactory("GoogleStockNFT");
  const mintPriceEnv = process.env.MAINNET_MINT_PRICE_ETH || "0.005";
  const initialPrice = ethers.parseEther(mintPriceEnv);
  const nft = await NFT.deploy(deployer.address, initialPrice);
  await nft.waitForDeployment();
  const nftAddr = await nft.getAddress();
  console.log("GoogleStockNFT:", nftAddr);
  console.log("Initial mint price:", mintPriceEnv, "ETH");

  // ============ WIRING ============
  console.log("\n=== Wiring ===");

  // NFT
  await (await nft.setTreasuryEOA(treasuryEOA)).wait();
  await (await nft.setPlatformManager(pmAddr)).wait();
  await (await nft.setStockVault(svAddr)).wait();
  await (await nft.setInterestDistributor(idAddr)).wait();
  console.log("  NFT wired ✓");

  // PM
  await (await pm.setGoogleStockNFT(nftAddr)).wait();
  await (await pm.setStockVault(svAddr)).wait();
  console.log("  PM wired ✓");

  // SV
  await (await sv.setPlatformManager(pmAddr)).wait();
  await (await sv.setGoogleStockNFT(nftAddr)).wait();
  await (await sv.setTreasuryVault(treasuryEOA)).wait();
  await (await sv.setFeeRecipient(treasuryEOA)).wait();
  await (await sv.setGooglonSwap(swapAdapterAddr)).wait();
  console.log("  SV wired ✓ (swap adapter configured)");

  // SwapAdapter — authorize StockVault
  await (await swapAdapter.setStockVault(svAddr)).wait();
  console.log("  SwapAdapter wired ✓");

  // ID
  await (await id.setGoogleStockNFT(nftAddr)).wait();
  await (await id.setTreasuryVault(treasuryVault)).wait();
  await (await id.setPlatformManager(pmAddr)).wait();
  console.log("  ID wired ✓");

  // Set sweepOperator on PM
  console.log("\n=== sweepOperator ===");
  await (await pm.setSweepOperator(treasuryVault)).wait();
  console.log("  PM.sweepOperator →", treasuryVault);

  // Transfer ownership
  console.log("\n=== Ownership ===");
  console.log("  PM owner stays as deployer (mint lifecycle controls)");
  await (await sv.transferOwnership(treasuryVault)).wait();
  console.log("  SV owner → treasury vault");
  await (await id.transferOwnership(treasuryVault)).wait();
  console.log("  ID owner → treasury vault");
  await (await swapAdapter.transferOwnership(treasuryVault)).wait();
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
  console.log("Aave V3 Pool (real):  ", aavePoolAddr);
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
    aaveV3Pool: aavePoolAddr,
    treasuryEOA,
    treasuryVault,
    network: "mainnet",
  }, null, 2));
  console.log("Saved to deployed.json");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
