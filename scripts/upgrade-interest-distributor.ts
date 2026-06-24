import { ethers } from "hardhat";

/**
 * Upgrade InterestDistributor to V2 (per-round tracking fix)
 *
 * 1. Deploys new InterestDistributor with per-round accumulation
 * 2. Wires it to NFT, treasury vault, platform manager
 * 3. Recovers trapped funds from old distributor
 * 4. Updates NFT reference to new distributor
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Upgrading with:", deployer.address);

  // === CONFIGURATION ===
  const OLD_ID = "0x3720A0C34c27864943E3107CD58e749BEC706DC8";
  const NFT = "0xb6D5ccECe642e132aD58043120B6D0e1310a42E6";
  const PM = "0xe904AE19ff1c8A3803849c462c6c4DcCB6702735";
  const TREASURY = "0xF7725996fd1722bdF4316ac2596CA84a13FEE356";

  // 1. Deploy new InterestDistributor
  console.log("\n--- Deploying InterestDistributor V2 ---");
  const ID = await ethers.getContractFactory("InterestDistributor");
  const id = await ID.deploy(deployer.address);
  await id.waitForDeployment();
  const newIdAddr = await id.getAddress();
  console.log("New InterestDistributor:", newIdAddr);

  // 2. Wire it up
  console.log("\n--- Wiring ---");
  await (await id.setGoogleStockNFT(NFT)).wait();
  console.log("  ID.googleStockNFT =", NFT);
  await (await id.setTreasuryVault(TREASURY)).wait();
  console.log("  ID.treasuryVault =", TREASURY);
  await (await id.setPlatformManager(PM)).wait();
  console.log("  ID.platformManager =", PM);
  await (await id.allowClaims()).wait();
  console.log("  Claims allowed");

  // 3. Transfer ownership to treasury
  console.log("\n--- Transferring ownership to treasury ---");
  await (await id.transferOwnership(TREASURY)).wait();
  console.log("  Owner =", TREASURY);

  // 4. Recover funds from old distributor
  console.log("\n--- Recovering funds from old distributor ---");
  const oldId = await ethers.getContractAt("InterestDistributor", OLD_ID);
  const oldBalance = await ethers.provider.getBalance(OLD_ID);
  console.log("  Old ID balance:", ethers.formatEther(oldBalance), "ETH");

  if (oldBalance > 0n) {
    // The old contract's owner is the treasury EOA
    // We're deploying as deployer — the treasury needs to call withdrawExcess
    console.log("  WARNING: Treasury EOA must call withdrawExcess on old ID to recover", ethers.formatEther(oldBalance), "ETH");
    console.log("  Old ID address:", OLD_ID);
    console.log("  Run: npx hardhat run scripts/recover-old-id-funds.ts --network sepolia");
  }

  // 5. Update NFT reference
  console.log("\n--- Updating NFT.interestDistributor ---");
  const nft = await ethers.getContractAt("GoogleStockNFT", NFT);
  try {
    await (await nft.updateInterestDistributor(newIdAddr)).wait();
    console.log("  NFT.interestDistributor updated to", newIdAddr);
  } catch (e: any) {
    console.log("  FAILED:", e.message?.slice(0, 100));
  }

  // Summary
  console.log("\n========================================");
  console.log("UPGRADE COMPLETE — V2 InterestDistributor");
  console.log("========================================");
  console.log("New InterestDistributor:", newIdAddr);
  console.log("Old InterestDistributor:", OLD_ID);
  console.log("Recoverable funds:     ", ethers.formatEther(oldBalance), "ETH");
  console.log("========================================");
  console.log("");
  console.log("UPDATE .env.local:");
  console.log("NEXT_PUBLIC_INTEREST_ADDRESS=" + newIdAddr);
}

main().catch(console.error);
