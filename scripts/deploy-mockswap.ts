import { ethers } from "hardhat";

/**
 * Deploy MockSwap — USDC→ETH testnet swap (1:1 mock rate).
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying MockSwap with:", deployer.address);

  const USDC = "0x863DC1544afC1C75cb4661C6FCBc26661f63B00B";
  const FUND_AMOUNT = ethers.parseEther("0.01"); // Pre-fund with 0.01 ETH

  console.log("\n--- Deploying MockSwap ---");
  const MockSwap = await ethers.getContractFactory("MockSwap");
  const swap = await MockSwap.deploy(USDC);
  await swap.waitForDeployment();
  const swapAddr = await swap.getAddress();
  console.log("MockSwap:", swapAddr);

  // Pre-fund with ETH for liquidity
  console.log("\n--- Pre-funding with", ethers.formatEther(FUND_AMOUNT), "ETH ---");
  const tx = await deployer.sendTransaction({
    to: swapAddr,
    value: FUND_AMOUNT,
  });
  await tx.wait();
  console.log("MockSwap ETH balance:", ethers.formatEther(await ethers.provider.getBalance(swapAddr)), "ETH");

  console.log("\n========================================");
  console.log("MOCKSWAP DEPLOYED");
  console.log("========================================");
  console.log("Address:", swapAddr);
  console.log("USDC token:", USDC);
  console.log("Rate: 1 USDC = 1 ETH (mock)");
  console.log("========================================");
  console.log("");
  console.log("Add to frontend .env.local:");
  console.log("NEXT_PUBLIC_MOCK_SWAP_ADDRESS=" + swapAddr);
}

main().catch(console.error);
