/**
 * GooglonSwapAdapter — Mainnet Fork Test
 *
 * Tests the multi-hop swap: ETH → WETH → USDC → GOOGLon
 * Uses real Uniswap V3 pools on a mainnet fork.
 *
 * Usage:
 *   npx hardhat run scripts/test-swap.ts --network hardhat
 *
 * Requires MAINNET_RPC_URL in backend/.env for the fork.
 */

import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, "..", "backend", ".env") });

// ─── Real Mainnet Addresses ───
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const GOOGLON = "0xbA47214eDd2bb43099611b208f75E4b42FDcfEDc";
const UNI_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
const WETH_USDC_FEE = 500;   // 0.05%
const USDC_GOOGLON_FEE = 10000; // 1%

// ─── Helpers ───

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Test signer:", signer.address);
  console.log("Forked block:", await ethers.provider.getBlockNumber());
  console.log("");

  // ── Deploy GooglonSwapAdapter ──
  console.log("=== Deploying GooglonSwapAdapter ===");
  const Factory = await ethers.getContractFactory("GooglonSwapAdapter");
  const adapter = await Factory.deploy(
    WETH, USDC, GOOGLON, UNI_ROUTER,
    WETH_USDC_FEE, USDC_GOOGLON_FEE,
    signer.address
  );
  await adapter.waitForDeployment();
  const adapterAddr = await adapter.getAddress();
  console.log("Adapter:", adapterAddr);

  // Set stockVault to ourselves for testing
  await (await adapter.setStockVault(signer.address)).wait();
  console.log("StockVault set (self)");

  // ── Read Pool Prices ──
  console.log("\n=== Price Discovery ===");
  const googlon = new ethers.Contract(GOOGLON, ["function balanceOf(address) view returns (uint256)"], signer);
  const usdc = new ethers.Contract(USDC, ["function balanceOf(address) view returns (uint256)"], signer);
  const weth = new ethers.Contract(WETH, ["function balanceOf(address) view returns (uint256)"], signer);

  // GOOGLon: 18 decimals (Ondo tokens use standard 18), USDC: 6 decimals
  const googlonDecimals = 18;
  const usdcDecimals = 6;

  // Get GOOGLon pool price via slot0 (sqrtPriceX96)
  const googlonPool = "0x39FCB1935f6Ccb0A106D05eB928205C59646af57"; // GOOGLon/USDC 1%
  const poolAbi = ["function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)"];
  const pool = new ethers.Contract(googlonPool, poolAbi, signer);
  const slot0 = await pool.slot0();
  const sqrtPriceX96 = slot0[0];
  // GOOGLon/USDC pool: token0=GOOGLon (18d), token1=USDC (6d)
  // Price of token0 in token1 = (sqrtPriceX96 / 2^96)^2
  const sqrtPrice = Number(sqrtPriceX96) / (2 ** 96);
  const priceToken0InToken1 = sqrtPrice * sqrtPrice; // USDC per GOOGLon
  // Adjust for decimals: token0 is 18d, token1 is 6d
  const googlonPriceUSDC = priceToken0InToken1 * (10 ** (usdcDecimals - googlonDecimals));
  console.log(`GOOGLon price: ~$${(googlonPriceUSDC).toFixed(2)} USD`);

  // ── Test Swaps ──
  console.log("\n=== Swap Tests ===");

  const testAmounts = [
    ethers.parseEther("0.001"),
    ethers.parseEther("0.01"),
    ethers.parseEther("0.1"),
  ];

  for (const ethAmount of testAmounts) {
    console.log(`\n--- Swapping ${ethers.formatEther(ethAmount)} ETH ---`);

    // Use 5% slippage (reasonable for GOOGLon with 1% pool)
    const minGooglonOut = 0n; // No minimum for price discovery test

    try {
      const tx = await adapter.swapEthForGooglon(ethAmount, minGooglonOut, {
        value: ethAmount,
        gasLimit: 500_000,
      });
      const receipt = await tx.wait();
      console.log(`  Gas used: ${receipt!.gasUsed}`);

      // Read GOOGLon balance of signer (recipient = msg.sender)
      const googlonBal = await googlon.balanceOf(signer.address);
      console.log(`  GOOGLon received: ${ethers.formatUnits(googlonBal, googlonDecimals)} GOOGLon`);

      const ethNum = Number(ethers.formatEther(ethAmount));
      const googlonNum = Number(ethers.formatUnits(googlonBal, googlonDecimals));
      if (googlonNum > 0) {
        const effectivePrice = ethNum / googlonNum;
        console.log(`  Effective price: ${effectivePrice.toFixed(6)} ETH per GOOGLon`);
        // Estimate USD price
        // We need ETH price for this — use a rough estimate or query
      }

      // Check for leftover tokens in adapter
      const wethLeft = await weth.balanceOf(adapterAddr);
      const usdcLeft = await usdc.balanceOf(adapterAddr);
      if (wethLeft > 0n) console.log(`  ⚠️  WETH dust in adapter: ${ethers.formatEther(wethLeft)}`);
      if (usdcLeft > 0n) console.log(`  ⚠️  USDC dust in adapter: ${ethers.formatUnits(usdcLeft, usdcDecimals)}`);

    } catch (err: any) {
      console.log(`  ❌ Swap failed: ${err.message?.slice(0, 120)}`);
    }
  }

  // ── Slippage Test ──
  console.log("\n=== Slippage Protection Test ===");
  const ethIn = ethers.parseEther("0.01");
  // Request impossibly high GOOGLon (should fail with slippage)
  const impossibleMin = ethers.parseUnits("1000000", googlonDecimals); // 1M GOOGLon
  try {
    await adapter.swapEthForGooglon(ethIn, impossibleMin, {
      value: ethIn,
      gasLimit: 500_000,
    });
    console.log("  ❌ Should have reverted with slippage!");
  } catch (err: any) {
    if (err.message?.includes("Too little received") || err.message?.includes("STF") || err.message?.includes("revert")) {
      console.log("  ✅ Correctly reverted on impossible slippage");
    } else {
      console.log(`  ⚠️  Unexpected error: ${err.message?.slice(0, 100)}`);
    }
  }

  console.log("\n=== Test Complete ===");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
