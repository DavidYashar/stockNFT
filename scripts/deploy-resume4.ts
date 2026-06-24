/**
 * Resume Mainnet Deploy — using raw ethers.js to bypass Hardhat ethers plugin bug.
 * GooglonSwapAdapter already deployed at 0x1b59283C54538E3ab0c3Df36C5c6f0FEA91E0bc5
 *
 * Usage:
 *   npx hardhat run scripts/deploy-resume4.ts --network mainnet
 */

import { ethers, artifacts } from "hardhat";

// Already deployed
const SWAP_ADAPTER = "0x1b59283C54538E3ab0c3Df36C5c6f0FEA91E0bc5";

/** Deploy using direct JsonRpcProvider — bypasses HardhatEthersProvider's broken getTransaction */
async function rawDeploy(
  signer: ethers.Wallet,
  artifactName: string,
  args: any[]
): Promise<string> {
  const art = await artifacts.readArtifact(artifactName);
  const factory = new ethers.ContractFactory(art.abi, art.bytecode, signer);
  const tx = await factory.getDeployTransaction(...args);
  if (!tx.data) throw new Error("No deploy data");
  const res = await signer.sendTransaction({ data: tx.data, gasLimit: tx.gasLimit || 5000000 });
  console.log(`  Tx: ${res.hash}`);
  // Use provider directly (not HardhatEthersProvider) to wait
  const receipt = await signer.provider!.waitForTransaction(res.hash);
  if (!receipt || receipt.status !== 1) throw new Error(`Deploy failed: ${artifactName}`);
  const addr = receipt.contractAddress;
  if (!addr) throw new Error("No contract address in receipt");
  console.log(`  ✅ ${artifactName}: ${addr}`);
  return addr;
}

async function main() {
  // Use DIRECT JsonRpcProvider (not hardhat's wrapped provider)
  const rpcUrl = process.env.MAINNET_RPC_URL;
  const pk = process.env.PRIVATE_KEY;
  if (!rpcUrl) throw new Error("MAINNET_RPC_URL not set");
  if (!pk) throw new Error("PRIVATE_KEY not set");
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(pk, provider);
  console.log("Deployer:", signer.address);
  console.log("Resuming — SwapAdapter:", SWAP_ADAPTER, "\n");

  const feeData = await ethers.provider.getFeeData();
  console.log(`⚡ Gas: ${Number(ethers.formatUnits(feeData.gasPrice || 0n, "gwei")).toFixed(2)} gwei\n`);

  // ── Env ──
  const treasuryEOA = process.env.TREASURY_EOA;
  const treasuryVault = process.env.TREASURY_VAULT_ADDRESS || treasuryEOA;
  if (!treasuryEOA) throw new Error("TREASURY_EOA not set");

  const googlonAddr = process.env.GOOGLON_TOKEN;
  const usdcAddr = process.env.USDC_TOKEN || "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  if (!googlonAddr) throw new Error("GOOGLON_TOKEN not set");

  const swapAdapterAddr = SWAP_ADAPTER;
  const mintPriceEnv = process.env.MAINNET_MINT_PRICE_ETH || "0.005";

  // ============ Deploy 4 remaining contracts ============

  const pmAddr = await rawDeploy(signer, "PlatformManager", [signer.address]);
  const svAddr = await rawDeploy(signer, "StockVault", [usdcAddr, googlonAddr, signer.address]);
  const idAddr = await rawDeploy(signer, "InterestDistributor", [signer.address]);
  const nftAddr = await rawDeploy(signer, "GoogleStockNFT", [signer.address, ethers.parseEther(mintPriceEnv)]);

  console.log(`\nInitial mint price: ${mintPriceEnv} ETH\n`);

  // ============ Wiring (using contract instances — read/write are fine) ============
  console.log("=== Wiring ===");

  const nft = await ethers.getContractAt("GoogleStockNFT", nftAddr, signer);
  const pm = await ethers.getContractAt("PlatformManager", pmAddr, signer);
  const sv = await ethers.getContractAt("StockVault", svAddr, signer);
  const id = await ethers.getContractAt("InterestDistributor", idAddr, signer);
  const swapAdapter = await ethers.getContractAt("GooglonSwapAdapter", swapAdapterAddr, signer);

  // NFT wiring
  await (await nft.setTreasuryEOA(treasuryEOA)).wait();
  await (await nft.setPlatformManager(pmAddr)).wait();
  await (await nft.setStockVault(svAddr)).wait();
  await (await nft.setInterestDistributor(idAddr)).wait();
  console.log("  NFT wired ✓");

  // PM wiring
  await (await pm.setGoogleStockNFT(nftAddr)).wait();
  await (await pm.setStockVault(svAddr)).wait();
  console.log("  PM wired ✓");

  // SV wiring
  await (await sv.setPlatformManager(pmAddr)).wait();
  await (await sv.setGoogleStockNFT(nftAddr)).wait();
  await (await sv.setTreasuryVault(treasuryEOA)).wait();
  await (await sv.setFeeRecipient(treasuryEOA)).wait();
  await (await sv.setGooglonSwap(swapAdapterAddr)).wait();
  console.log("  SV wired ✓");

  // SwapAdapter wiring
  await (await swapAdapter.setStockVault(svAddr)).wait();
  console.log("  SwapAdapter wired ✓");

  // ID wiring
  await (await id.setGoogleStockNFT(nftAddr)).wait();
  await (await id.setTreasuryVault(treasuryVault)).wait();
  await (await id.setPlatformManager(pmAddr)).wait();
  console.log("  ID wired ✓");

  // sweepOperator
  await (await pm.setSweepOperator(treasuryVault)).wait();
  console.log("  PM.sweepOperator →", treasuryVault);

  // Ownership transfers
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
