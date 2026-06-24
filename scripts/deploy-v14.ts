/**
 * Fresh Mainnet Deploy — All 5 Contracts (G-pass NFT)
 *
 * Uses direct JsonRpcProvider + ethers.Wallet to bypass Hardhat ethers plugin bug.
 *
 * Usage:
 *   npx hardhat run scripts/deploy-v14.ts --network mainnet
 */

import { ethers, artifacts } from "hardhat";

/** Deploy using raw ethers Wallet + provider.waitForTransaction */
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

  const feeData = await provider.getFeeData();
  console.log(`⚡ Gas: ${Number(ethers.formatUnits(feeData.gasPrice || 0n, "gwei")).toFixed(2)} gwei\n`);

  // ── Env vars ──
  const treasuryEOA = process.env.TREASURY_EOA;
  const treasuryVault = process.env.TREASURY_VAULT_ADDRESS || treasuryEOA;
  if (!treasuryEOA) throw new Error("TREASURY_EOA not set");

  const googlonAddr = process.env.GOOGLON_TOKEN;
  const usdcAddr = process.env.USDC_TOKEN || "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const wethAddr = process.env.WETH_TOKEN || "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const uniRouter = process.env.UNISWAP_V3_ROUTER || "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  const wethUsdcFee = parseInt(process.env.UNISWAP_V3_WETH_USDC_FEE || "500");
  const usdcGooglonFee = parseInt(process.env.UNISWAP_V3_USDC_GOOGLON_FEE || "10000");

  if (!googlonAddr) throw new Error("GOOGLON_TOKEN not set");

  console.log("Treasury EOA:", treasuryEOA);
  console.log("GOOGLon:", googlonAddr);
  console.log("USDC:", usdcAddr);
  console.log("");

  // ============ DEPLOY ALL 5 ============

  console.log("=== 1/5 GooglonSwapAdapter ===");
  const swapAdapterAddr = await rawDeploy(signer, "GooglonSwapAdapter", [
    wethAddr, usdcAddr, googlonAddr, uniRouter,
    wethUsdcFee, usdcGooglonFee, signer.address
  ]);

  console.log("\n=== 2/5 PlatformManager ===");
  const pmAddr = await rawDeploy(signer, "PlatformManager", [signer.address]);

  console.log("\n=== 3/5 StockVault ===");
  const svAddr = await rawDeploy(signer, "StockVault", [usdcAddr, googlonAddr, signer.address]);

  console.log("\n=== 4/5 InterestDistributor ===");
  const idAddr = await rawDeploy(signer, "InterestDistributor", [signer.address]);

  console.log("\n=== 5/5 G-pass NFT ===");
  const mintPriceEnv = process.env.MAINNET_MINT_PRICE_ETH || "0.005";
  const nftAddr = await rawDeploy(signer, "GoogleStockNFT", [signer.address, ethers.parseEther(mintPriceEnv)]);
  console.log("  Mint price:", mintPriceEnv, "ETH | Symbol: GPASS | Name: G-pass NFT");

  // ============ WIRING ============
  console.log("\n=== Wiring ===");

  const nft = new ethers.Contract(nftAddr, (await artifacts.readArtifact("GoogleStockNFT")).abi, signer);
  const pm = new ethers.Contract(pmAddr, (await artifacts.readArtifact("PlatformManager")).abi, signer);
  const sv = new ethers.Contract(svAddr, (await artifacts.readArtifact("StockVault")).abi, signer);
  const id = new ethers.Contract(idAddr, (await artifacts.readArtifact("InterestDistributor")).abi, signer);
  const swap = new ethers.Contract(swapAdapterAddr, (await artifacts.readArtifact("GooglonSwapAdapter")).abi, signer);

  async function tx(fn: Promise<ethers.ContractTransactionResponse>) {
    await (await fn).wait();
  }

  await tx(nft.setTreasuryEOA(treasuryEOA));
  await tx(nft.setPlatformManager(pmAddr));
  await tx(nft.setStockVault(svAddr));
  await tx(nft.setInterestDistributor(idAddr));
  console.log("  ✓ NFT wired");

  await tx(pm.setGoogleStockNFT(nftAddr));
  await tx(pm.setStockVault(svAddr));
  console.log("  ✓ PM wired");

  await tx(sv.setPlatformManager(pmAddr));
  await tx(sv.setGoogleStockNFT(nftAddr));
  await tx(sv.setTreasuryVault(treasuryEOA));
  await tx(sv.setFeeRecipient(treasuryEOA));
  await tx(sv.setGooglonSwap(swapAdapterAddr));
  console.log("  ✓ SV wired");

  await tx(swap.setStockVault(svAddr));
  console.log("  ✓ SwapAdapter wired");

  await tx(id.setGoogleStockNFT(nftAddr));
  await tx(id.setTreasuryVault(treasuryVault));
  await tx(id.setPlatformManager(pmAddr));
  console.log("  ✓ ID wired");

  await tx(pm.setSweepOperator(treasuryVault));
  console.log("  ✓ sweepOperator");

  console.log("\n=== Ownership ===");
  console.log("  PM + NFT → deployer (mint lifecycle controls)");
  await tx(sv.transferOwnership(treasuryVault));
  console.log("  ✓ SV → treasury");
  await tx(id.transferOwnership(treasuryVault));
  console.log("  ✓ ID → treasury");
  await tx(swap.transferOwnership(treasuryVault));
  console.log("  ✓ SwapAdapter → treasury");

  // ============ SUMMARY ============
  console.log("\n========================================");
  console.log("DEPLOYMENT COMPLETE — G-pass NFT Platform");
  console.log("========================================");
  console.log("G-pass NFT:          ", nftAddr);
  console.log("PlatformManager:     ", pmAddr);
  console.log("StockVault:          ", svAddr);
  console.log("GooglonSwapAdapter:  ", swapAdapterAddr);
  console.log("InterestDistributor: ", idAddr);
  console.log("Treasury:            ", treasuryEOA);
  console.log("========================================");

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
