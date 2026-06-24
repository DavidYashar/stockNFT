import { ethers } from "hardhat";
import { JsonRpcProvider, Wallet } from "ethers";

/**
 * Recover funds from OLD InterestDistributor and send to new one.
 *
 * Uses TREASURY_PRIVATE_KEY from .env if set (recommended).
 * Otherwise falls back to default Hardhat signer.
 *
 * Required env vars:
 *   NEW_INTEREST_ADDRESS=0xB7Ddc14BAD071Ba1cc44bA763bAA5d63118D6B8c
 *   TREASURY_PRIVATE_KEY=<treasury EOA private key>  (optional, uses default signer if absent)
 */

async function main() {
  const OLD_ID = "0x3720A0C34c27864943E3107CD58e749BEC706DC8";
  const NEW_ID = process.env.NEW_INTEREST_ADDRESS || "";
  const treasuryKey = process.env.TREASURY_PRIVATE_KEY || "";

  if (!NEW_ID) {
    console.error("Set NEW_INTEREST_ADDRESS in .env");
    process.exit(1);
  }

  // Use treasury key if provided, otherwise default Hardhat signer
  let signer: any;
  if (treasuryKey) {
    const provider = new JsonRpcProvider(process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/LLcfShXkzvLwjEDQQgw0b");
    signer = new Wallet(treasuryKey, provider);
    console.log("Using treasury signer:", signer.address);
  } else {
    const [defaultSigner] = await ethers.getSigners();
    signer = defaultSigner;
    console.log("Using default Hardhat signer:", signer.address);
  }

  console.log("Old ID:", OLD_ID);
  console.log("New ID:", NEW_ID);

  // Check old ID balance
  const oldBalance = await signer.provider!.getBalance(OLD_ID);
  console.log("Old ID balance:", ethers.formatEther(oldBalance), "ETH");

  if (oldBalance === 0n) {
    console.log("Nothing to recover.");
    return;
  }

  // Connect to old ID as treasury signer
  const oldId = new ethers.Contract(OLD_ID, [
    "function withdrawExcess(uint256) external",
    "function owner() view returns (address)",
  ], signer);

  const oldOwner = await oldId.owner();
  console.log("Old ID owner:", oldOwner);
  if (oldOwner.toLowerCase() !== signer.address.toLowerCase()) {
    console.error("ERROR: Signer", signer.address, "is not the owner of the old ID!");
    console.error("Old ID owner is:", oldOwner);
    console.error("Set TREASURY_PRIVATE_KEY to the private key of", oldOwner);
    process.exit(1);
  }

  // Withdraw all funds from old ID
  console.log("\nWithdrawing funds from old ID...");
  const tx = await oldId.withdrawExcess(oldBalance);
  await tx.wait();
  console.log("Withdrawn:", ethers.formatEther(oldBalance), "ETH →", signer.address);

  // Send to new ID via fundEqualDistribution (treasury must call this)
  console.log("\nFunding new ID...");
  const newId = new ethers.Contract(NEW_ID, [
    "function fundEqualDistribution() payable",
  ], signer);
  const fundTx = await newId.fundEqualDistribution({ value: oldBalance });
  await fundTx.wait();
  console.log("Funded new ID with:", ethers.formatEther(oldBalance), "ETH");

  console.log("\nDone — recovered and redistributed via V2 with per-round tracking.");
}

main().catch(console.error);
