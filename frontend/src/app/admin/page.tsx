"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useAccount } from "wagmi";
import { CONTRACT_ADDRESSES, PLATFORM_MANAGER_ABI, GOOGLE_STOCK_NFT_ABI, INTEREST_DISTRIBUTOR_ABI, STOCK_VAULT_ABI, AAVE_V3_POOL_ABI_EXTENDED, ATOKEN_ABI, UNISWAP_V3_ROUTER_ABI, ERC20_ABI, WETH_ABI } from "@/lib/contracts";
import { NFT_CONFIG } from "@/lib/constants";
import { useETHPrice } from "@/hooks/useETHPrice";

export default function AdminPage() {
  const { address } = useAccount();
  const { price: ethPriceUsd } = useETHPrice();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTreasury, setIsTreasury] = useState(false);
  const [isDeployer, setIsDeployer] = useState(false);
  const [contractOwner, setContractOwner] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLabel, setActionLabel] = useState("");

  const [treasuryBalance, setTreasuryBalance] = useState("0");
  const [pool80, setPool80] = useState("0");
  const [pool20, setPool20] = useState("0");
  const [loyaltyFees, setLoyaltyFees] = useState("0");
  const [defiPrincipal, setDefiPrincipal] = useState("0");
  const [mintPrincipal, setMintPrincipal] = useState("0");
  const [canTrigger, setCanTrigger] = useState(false);
  const [mintEnded, setMintEnded] = useState(false);
  const [triggerFired, setTriggerFired] = useState(false);
  const [totalBurned, setTotalBurned] = useState("0");
  const [mintActive, setMintActive] = useState(false);
  const [interestPool, setInterestPool] = useState("0");
  const [sweepInterval, setSweepInterval] = useState("0");
  const [burnAmount, setBurnAmount] = useState("10");
  const [interestFundAmount, setInterestFundAmount] = useState("0.01");

  // DeFi state
  const [aaveDeposited, setAaveDeposited] = useState("0");
  const [aaveYield, setAaveYield] = useState("0");
  const [aaveDepositTime, setAaveDepositTime] = useState("0");
  const [usdcBalance, setUsdcBalance] = useState("0");
  const [harvestAmount, setHarvestAmount] = useState("");
  const [distributeAmount, setDistributeAmount] = useState("");
  const [botLoyalty, setBotLoyalty] = useState<string>("0");
  const [botLoyaltyDetected, setBotLoyaltyDetected] = useState<string>("0");
  const [botLoyaltyFees, setBotLoyaltyFees] = useState<any[]>([]);

  // Google Purchase state
  const [svPool80, setSvPool80] = useState("0");
  const [svLoyalty, setSvLoyalty] = useState("0");
  const [purchaseComplete, setPurchaseComplete] = useState(false);
  const [totalGooglon, setTotalGooglon] = useState("0");
  const [mintPriceEth, setMintPriceEth] = useState("0.005");
  const [mintedCount, setMintedCount] = useState(0);

  const treasuryVaultAddr = CONTRACT_ADDRESSES.treasuryVaultAddress?.toLowerCase() || "";
  const deployerAddr = CONTRACT_ADDRESSES.deployerAddress?.toLowerCase() || "";

  useEffect(() => { if (address) loadAll(); }, [address]);

  async function loadAll() {
    if (!window.ethereum) return;
    const p = new ethers.BrowserProvider(window.ethereum);
    const pm = new ethers.Contract(CONTRACT_ADDRESSES.platformManager, PLATFORM_MANAGER_ABI, p);
    const nft = new ethers.Contract(CONTRACT_ADDRESSES.googleStockNFT, GOOGLE_STOCK_NFT_ABI, p);
    const id = new ethers.Contract(CONTRACT_ADDRESSES.interestDistributor, INTEREST_DISTRIBUTOR_ABI, p);

    // Permissions — must not fail
    try {
      const owner = (await pm.owner()).toLowerCase();
      setContractOwner(owner);
      const addr = address?.toLowerCase() || "";
      setIsAdmin(addr === owner || addr === treasuryVaultAddr || addr === deployerAddr);
      setIsTreasury(addr === treasuryVaultAddr);
      setIsDeployer(addr === deployerAddr || addr === owner); // deployer = contract owner or env deployer
    } catch (e) { console.error("pm.owner failed", e); }

    // Treasury balance
    try { if (CONTRACT_ADDRESSES.treasuryEOA) setTreasuryBalance(ethers.formatEther(await p.getBalance(CONTRACT_ADDRESSES.treasuryEOA))); } catch {}

    // Read contract mint price + actual token count
    try { setMintPriceEth(ethers.formatEther(await nft.mintPrice())); } catch {}
    try { setMintedCount(Number(await nft.totalSupply())); } catch {}

    // PlatformManager accounting — each call in its own try-catch
    try { setPool80(ethers.formatEther(await pm.pool80())); } catch {}
    try { setPool20(ethers.formatEther(await pm.pool20())); } catch {}
    try { setLoyaltyFees(ethers.formatEther(await pm.totalLoyaltyFees())); } catch {}
    try { setDefiPrincipal(ethers.formatEther(await pm.totalDeFiPrincipal())); } catch {}
    try { setMintPrincipal(ethers.formatEther(await pm.totalMintPrincipal())); } catch {}
    try { setCanTrigger(await pm.canTrigger()); } catch {}
    try { setMintEnded(await pm.mintEnded()); } catch {}
    try { setTriggerFired(await pm.triggerFired()); } catch {}
    try { setTotalBurned((await pm.totalBurned()).toString()); } catch {}
    try { setSweepInterval((Number(await pm.sweepInterval()) / 60).toFixed(0)); } catch {}

    try { setMintActive(await nft.mintActive()); } catch {}
    try { setInterestPool(ethers.formatEther(await id.interestPool())); } catch {}

    // StockVault state (Google Purchase)
    try {
      const sv = new ethers.Contract(CONTRACT_ADDRESSES.stockVault, STOCK_VAULT_ABI, p);
      setSvPool80(ethers.formatEther(await sv.pool80Funds()));
      setSvLoyalty(ethers.formatEther(await sv.loyaltyFunds()));
      setPurchaseComplete(await sv.purchaseComplete());
      try { setTotalGooglon(ethers.formatUnits(await sv.totalGooglonHeld(), 18)); } catch {}
    } catch {}

    // Fetch bot-detected loyalty fees from backend API
    try {
      const res = await fetch("http://localhost:3002/api/loyalty-fees");
      if (res.ok) {
        const data = await res.json();
        setBotLoyalty(data.total || "0");
        setBotLoyaltyDetected(data.detected || "0");
        setBotLoyaltyFees(data.fees || []);
      }
    } catch {}
    if (CONTRACT_ADDRESSES.aavePool && CONTRACT_ADDRESSES.aToken) {
      try {
        const tvAddr = CONTRACT_ADDRESSES.treasuryVaultAddress || CONTRACT_ADDRESSES.treasuryEOA;
        // Read Aave V3 reserve data + aToken scaled balance
        const aave = new ethers.Contract(CONTRACT_ADDRESSES.aavePool, AAVE_V3_POOL_ABI_EXTENDED, p);
        const aToken = new ethers.Contract(CONTRACT_ADDRESSES.aToken, ATOKEN_ABI, p);
        const usdcAddr = CONTRACT_ADDRESSES.usdc!;
        const reserveData = await aave.getReserveData(usdcAddr);
        const liquidityIndex = BigInt(reserveData.liquidityIndex);
        const scaledBalance = await aToken.scaledBalanceOf(tvAddr);
        const RAY = 10n ** 27n;
        const currentValue = (scaledBalance * liquidityIndex) / RAY;
        setAaveDeposited(ethers.formatUnits(currentValue, 6));
        // Show current Aave position value (principal + yield). Actual yield = currentValue - principalDeposited
        setAaveYield(ethers.formatUnits(currentValue, 6));
        const usdc = new ethers.Contract(usdcAddr, ["function balanceOf(address) view returns (uint256)"], p);
        if (tvAddr) setUsdcBalance(ethers.formatUnits(await usdc.balanceOf(tvAddr), 6));
      } catch {}
    }
  }

  async function doAction(label: string, fn: () => Promise<void>) {
    setActionLabel(label); setLoading(true);
    try { await fn(); await loadAll(); }
    catch (err: any) { alert(label + " failed: " + (err.message?.slice(0, 100))); }
    setLoading(false); setActionLabel("");
  }

  async function getSignerPm() {
    const p = new ethers.BrowserProvider(window.ethereum!);
    return new ethers.Contract(CONTRACT_ADDRESSES.platformManager, PLATFORM_MANAGER_ABI, await p.getSigner());
  }

  async function getSignerSv() {
    const p = new ethers.BrowserProvider(window.ethereum!);
    return new ethers.Contract(CONTRACT_ADDRESSES.stockVault, STOCK_VAULT_ABI, await p.getSigner());
  }

  const mintPriceNum = Number(mintPriceEth) || 0.005;

  const statStyle: React.CSSProperties = {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', padding: '20px', textAlign: 'center'
  };

  return (
    <div className="app-page">
      <div className="landing-container">
        <div className="landing-section-head" style={{ marginBottom: 40 }}>
          <h3>Platform Admin</h3>
          <p>Manage mint lifecycle, DeFi operations, and Google purchase trigger.</p>
        </div>

        {!address && (
          <div className="landing-card" style={{ textAlign: 'center', padding: 60 }}>
            <p style={{ color: 'var(--muted-landing)', fontSize: 18, margin: 0 }}>Connect wallet to view admin panel.</p>
          </div>
        )}

        {address && !isAdmin && (
          <div className="landing-card" style={{ textAlign: 'center', padding: 32 }}>
            <p style={{ fontSize: 18, marginBottom: 8 }}>Access Restricted</p>
            <p style={{ color: 'var(--muted-landing)', fontSize: 14, margin: 0 }}>
              Only the platform owner or treasury vault can access the admin panel.
            </p>
            <p style={{ color: 'var(--muted2-landing)', fontSize: 12, marginTop: 12, marginBottom: 0 }}>
              Treasury: {treasuryVaultAddr.slice(0, 10)}...{treasuryVaultAddr.slice(-6)}
            </p>
          </div>
        )}

        {address && isAdmin && (
          <>
            {/* Role badge */}
            <div style={{ marginBottom: 24, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="landing-pill-green" style={{ fontSize: 13, padding: '8px 14px' }}>
                {isTreasury ? 'Treasury Vault' : isDeployer ? 'Deployer (mint controls)' : 'Viewer'}
              </span>
              {!isTreasury && !isDeployer && (
                <span style={{ fontSize: 12, color: 'var(--muted-landing)' }}>Connect with deployer or treasury vault wallet</span>
              )}
              {isDeployer && !isTreasury && (
                <span style={{ fontSize: 12, color: 'var(--muted-landing)' }}>Mint controls available. For DeFi, connect treasury vault ({treasuryVaultAddr.slice(0, 8)}...)</span>
              )}
            </div>

            {/* ====== DEFI STATUS ====== */}
            <div className="landing-card" style={{ padding: 24, marginBottom: 24, minHeight: 'auto' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, letterSpacing: '-.03em' }}>DeFi Status — Aave Yield</h3>
              <p style={{ fontSize: 12, color: 'var(--muted-landing)', marginBottom: 16 }}>
                <strong>20% Budget:</strong> {(Number(pool20) + Number(defiPrincipal)).toFixed(4)} ETH total ·{' '}
                <span style={{ color: 'var(--green-landing)' }}>{pool20} ETH available to sweep</span> ·{' '}
                <span style={{ color: 'var(--gold)' }}>{defiPrincipal} ETH already in Aave</span>
              </p>
              <div className="landing-metrics" style={{ marginTop: 0, marginBottom: 16 }}>
                <div className="landing-metric">
                  <small>USDC Deposited</small>
                  <strong>{Number(aaveDeposited).toFixed(2)} USDC</strong>
                </div>
                <div className="landing-metric">
                  <small>Accrued Yield</small>
                  <strong className="landing-green">{Number(aaveYield).toFixed(6)} USDC</strong>
                </div>
                <div className="landing-metric">
                  <small>Time in Aave</small>
                  <strong>{Number(aaveDepositTime) > 0 ? `${Math.floor((Date.now()/1000 - Number(aaveDepositTime)) / 60)} min` : '—'}</strong>
                </div>
                <div className="landing-metric">
                  <small>Rate</small>
                  <strong style={{ color: 'var(--gold)' }}>3.5% APY</strong>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <button onClick={() => doAction("Sweep to Aave", async () => {
                  const p = new ethers.BrowserProvider(window.ethereum!);
                  const signer = await p.getSigner();
                  if (Number(pool20) <= 0) return alert("No DeFi budget available");
                  const sweepAmountEth = ethers.parseEther(pool20 || "0");
                  const tv = CONTRACT_ADDRESSES.treasuryVaultAddress!;
                  const pm = new ethers.Contract(CONTRACT_ADDRESSES.platformManager!, PLATFORM_MANAGER_ABI, signer);
                  const poolFee = Number(process.env.NEXT_PUBLIC_UNISWAP_POOL_FEE) || 500;

                  // Swap ETH→USDC via Uniswap V3, then deposit to Aave
                  const usdcAddr = CONTRACT_ADDRESSES.usdc!;
                  const routerAddr = CONTRACT_ADDRESSES.uniswapV3Router!;
                  const wethAddr = CONTRACT_ADDRESSES.weth!;
                  const aaveAddr = CONTRACT_ADDRESSES.aavePool!;

                  // Step 1: Wrap ETH→WETH + approve router
                  const weth = new ethers.Contract(wethAddr, WETH_ABI, signer);
                  await (await weth.deposit({ value: sweepAmountEth })).wait();
                  await (await weth.approve(routerAddr, sweepAmountEth)).wait();

                  // Step 2: Swap WETH→USDC via Uniswap V3 (1% slippage)
                  const router = new ethers.Contract(routerAddr, UNISWAP_V3_ROUTER_ABI, signer);
                  const minUsdcOut = sweepAmountEth * BigInt(Math.round(ethPriceUsd * 1e6)) * 99n / 100n / ethers.parseEther("1") * 1n;
                  const swapTx = await router.exactInputSingle({
                    tokenIn: wethAddr, tokenOut: usdcAddr, fee: poolFee,
                    recipient: tv, deadline: Math.floor(Date.now() / 1000) + 300,
                    amountIn: sweepAmountEth, amountOutMinimum: 0, sqrtPriceLimitX96: 0,
                  });
                  await swapTx.wait();

                  // Step 3: Approve Aave + deposit
                  const usdc = new ethers.Contract(usdcAddr, ERC20_ABI, signer);
                  const usdcBal = await usdc.balanceOf(tv);
                  if (usdcBal === 0n) return alert("Swap produced 0 USDC");
                  await (await usdc.approve(aaveAddr, usdcBal)).wait();
                  const aave = new ethers.Contract(aaveAddr, AAVE_V3_POOL_ABI_EXTENDED, signer);
                  await (await aave.supply(usdcAddr, usdcBal, tv, 0)).wait();
                  await (await pm.recordSweep(sweepAmountEth)).wait();
                })} disabled={loading || !isTreasury || Number(pool20) <= 0} className="landing-btn" style={{ padding: 14, fontSize: 14, opacity: (isTreasury && Number(pool20) > 0) ? 1 : 0.4 }}>
                  {actionLabel === "Sweep to Aave" ? "⏳ ..." : `Sweep ${pool20} ETH → ~${(Number(pool20) * ethPriceUsd).toFixed(2)} USDC`}
                </button>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="number" value={harvestAmount} onChange={(e) => setHarvestAmount(e.target.value)}
                      placeholder="USDC to harvest" step="0.000001" min="0"
                      style={{ flex: 1, padding: '10px 14px', fontSize: 13, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, color: '#fff' }} />
                    <span style={{ fontSize: 11, color: 'var(--muted-landing)', whiteSpace: 'nowrap' }}>USDC</span>
                  </div>
                  <button onClick={() => doAction("Distribute Yield", async () => {
                    const p = new ethers.BrowserProvider(window.ethereum!);
                    const signer = await p.getSigner();
                    const tv = CONTRACT_ADDRESSES.treasuryVaultAddress!;
                    const id = new ethers.Contract(CONTRACT_ADDRESSES.interestDistributor!, INTEREST_DISTRIBUTOR_ABI, signer);
                    const pm = new ethers.Contract(CONTRACT_ADDRESSES.platformManager!, PLATFORM_MANAGER_ABI, signer);
                    const poolFee = Number(process.env.NEXT_PUBLIC_UNISWAP_POOL_FEE) || 500;

                    if (!harvestAmount || Number(harvestAmount) <= 0) return alert("Enter USDC amount to harvest");

                    const usdcAddr = CONTRACT_ADDRESSES.usdc!;
                    const aaveAddr = CONTRACT_ADDRESSES.aavePool!;
                    const routerAddr = CONTRACT_ADDRESSES.uniswapV3Router!;
                    const wethAddr = CONTRACT_ADDRESSES.weth!;

                    // Step 1: Withdraw specified USDC amount from Aave V3
                    const aave = new ethers.Contract(aaveAddr, AAVE_V3_POOL_ABI_EXTENDED, signer);
                    const usdcYield = ethers.parseUnits(harvestAmount, 6);
                    if (usdcYield === 0n) return alert("Invalid amount");

                    // Verify there's enough in Aave
                    const aToken = new ethers.Contract(CONTRACT_ADDRESSES.aToken!, ATOKEN_ABI, signer);
                    const scaledBalance = await aToken.scaledBalanceOf(tv);
                    const reserveData = await aave.getReserveData(usdcAddr);
                    const RAY = 10n ** 27n;
                    const currentValue = (scaledBalance * BigInt(reserveData.liquidityIndex)) / RAY;
                    if (usdcYield > currentValue) return alert(`Insufficient Aave balance. Max available: ${ethers.formatUnits(currentValue, 6)} USDC`);

                    await (await aave.withdraw(usdcAddr, usdcYield, tv)).wait();
                    await (await pm.recordHarvest(usdcYield)).wait();

                    // Step 2: Swap USDC→WETH via Uniswap V3 (1% slippage)
                    const usdc = new ethers.Contract(usdcAddr, ERC20_ABI, signer);
                    await (await usdc.approve(routerAddr, usdcYield)).wait();
                    const router = new ethers.Contract(routerAddr, UNISWAP_V3_ROUTER_ABI, signer);
                    const ethPrice = BigInt(Math.round(ethPriceUsd * 1e8));
                    const minEthOut = usdcYield * BigInt(1e20) * 99n / 100n / ethPrice;
                    const swapTx = await router.exactInputSingle({
                      tokenIn: usdcAddr, tokenOut: wethAddr, fee: poolFee,
                      recipient: tv, deadline: Math.floor(Date.now() / 1000) + 300,
                      amountIn: usdcYield, amountOutMinimum: minEthOut, sqrtPriceLimitX96: 0,
                    });
                    await swapTx.wait();

                    // Step 3: Unwrap WETH→ETH
                    const weth = new ethers.Contract(wethAddr, WETH_ABI, signer);
                    const wethBal = await new ethers.Contract(wethAddr, ERC20_ABI, signer).balanceOf(tv);
                    if (wethBal > 0n) await (await weth.withdraw(wethBal)).wait();
                    const ethReceived = wethBal;
                    if (ethReceived === 0n) return alert("Swap produced 0 ETH");

                    // Step 4: Fund InterestDistributor
                    await (await id.fundEqualDistribution({ value: ethReceived })).wait();
                    try { await (await id.allowClaims()).wait(); } catch {}
                    setHarvestAmount("");
                  })} disabled={loading || !isTreasury || Number(aaveYield) <= 0} className="landing-btn" style={{ padding: 14, fontSize: 14, width: '100%', background: 'linear-gradient(135deg, #34d399, #10b981)', color: '#090a0f', opacity: (isTreasury && Number(aaveYield) > 0) ? 1 : 0.4 }}>
                    {actionLabel === "Distribute Yield" ? "⏳ ..." : "Harvest & Distribute"}
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--muted-landing)' }}>
                  ETH: ${ethPriceUsd.toFixed(2)} · Current Aave position: {Number(aaveYield).toFixed(2)} USDC · Enter yield amount above
                </span>
              </div>
            </div>

            {/* Treasury Stats */}
            <div className="landing-metrics" style={{ marginBottom: 24 }}>
              <div className="landing-metric">
                <small>Treasury ETH</small>
                <strong style={{ color: 'var(--gold)' }}>{Number(treasuryBalance).toFixed(4)}</strong>
              </div>
              <div className="landing-metric">
                <small>Google Budget (80%)</small>
                <strong>{pool80}</strong>
              </div>
              <div className="landing-metric">
                <small>DeFi Available (20%)</small>
                <strong className="landing-green">{pool20}</strong>
              </div>
              <div className="landing-metric">
                <small>Loyalty Fees (on-chain)</small>
                <strong className="landing-green">{loyaltyFees}</strong>
              </div>
            </div>

            {/* Supply Stats */}
            <div className="landing-metrics" style={{ marginBottom: 24 }}>
              <div className="landing-metric">
                <small>NFTs Minted</small>
                <strong style={{ color: 'var(--gold)' }}>{mintedCount}</strong>
              </div>
              <div className="landing-metric">
                <small>Supply Burned</small>
                <strong style={{ color: 'var(--red-landing)' }}>{totalBurned}</strong>
              </div>
              <div className="landing-metric">
                <small>Effective Max</small>
                <strong>{NFT_CONFIG.MAX_SUPPLY - Number(totalBurned)}</strong>
              </div>
              <div className="landing-metric">
                <small>DeFi Principal (ETH)</small>
                <strong className="landing-green">{defiPrincipal}</strong>
              </div>
            </div>

            {/* State Flags */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
              <span className="landing-pill-green" style={{ fontSize: 12 }}>Mint: {mintActive ? 'Active' : 'Closed'}</span>
              <span className="landing-pill-green" style={{ fontSize: 12 }}>Mint Ended: {mintEnded ? 'Yes' : 'No'}</span>
              <span className="landing-pill-green" style={{ fontSize: 12 }}>Trigger: {triggerFired ? 'Fired' : 'Ready'}</span>
              <span className="landing-pill-green" style={{ fontSize: 12 }}>Sweep: every {sweepInterval} min</span>
              <span className="landing-pill-green" style={{ fontSize: 12 }}>Interest Pool: {Number(interestPool).toFixed(6)} ETH</span>
              <span className="landing-pill-green" style={{ fontSize: 12 }}>Mint Price: {mintPriceEth} ETH</span>
            </div>

            {/* Progress */}
            <div className="landing-progress-wrap" style={{ marginBottom: 24, padding: '10px 14px' }}>
              <div className="landing-progress-head" style={{ marginBottom: 6, fontSize: 12 }}>
                <span>Mint Progress</span>
                <span><b>{mintedCount}</b> / {NFT_CONFIG.MAX_SUPPLY - Number(totalBurned)}</span>
              </div>
              <div className="landing-progress-bar" style={{ height: 6 }}>
                <div className="landing-bar-fill" style={{
                  width: Math.min((() => {
                    const em = NFT_CONFIG.MAX_SUPPLY - Number(totalBurned);
                    return em > 0 ? (mintedCount / em) * 100 : 100;
                  })(), 100) + '%',
                }} />
              </div>
            </div>

            {/* Platform Controls */}
            <div className="landing-card" style={{ padding: 28, marginBottom: 24, minHeight: 'auto' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, letterSpacing: '-.03em' }}>Platform Controls</h3>
              {!isDeployer && (
                <p style={{ fontSize: 12, color: 'var(--yellow)', marginBottom: 20 }}>Connect with the Deployer wallet to control mint lifecycle.</p>
              )}

              <p style={{ fontSize: 13, color: 'var(--muted-landing)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Mint Lifecycle</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24 }}>
                <button onClick={() => doAction(mintActive ? "Pause Mint" : "Resume Mint", async () => {
                  const pm = await getSignerPm();
                  mintActive ? await (await pm.pauseMint()).wait() : await (await pm.resumeMint()).wait();
                })} disabled={loading || mintEnded || !isDeployer} className="landing-btn secondary" style={{ padding: 14, width: '100%', opacity: (mintEnded || !isDeployer) ? 0.4 : 1 }}>
                  {actionLabel === "Pause Mint" || actionLabel === "Resume Mint" ? "⏳ ..." : mintActive ? "Pause Mint" : "Resume Mint"}
                </button>
                <button onClick={() => doAction("End Mint", async () => {
                  const remaining = NFT_CONFIG.MAX_SUPPLY - Number(totalBurned) - mintedCount;
                  const pm = await getSignerPm();
                  await (await pm.stopMintAndBurn(remaining > 0 ? remaining : 0)).wait();
                })} disabled={loading || mintEnded || !isDeployer} className="landing-btn secondary" style={{ padding: 14, width: '100%', opacity: (mintEnded || !isDeployer) ? 0.4 : 1 }}>
                  {actionLabel === "End Mint" ? "⏳ ..." : "End Mint Permanently"}
                </button>
              </div>

              <p style={{ fontSize: 13, color: 'var(--muted-landing)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Burn Unminted</p>
              <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'flex-end' }}>
                <input type="number" value={burnAmount} onChange={(e) => setBurnAmount(e.target.value)}
                  style={{ padding: '10px 14px', fontSize: 14, flex: 1, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, color: '#fff' }} placeholder="10" />
                <button onClick={() => doAction("Burn", async () => {
                  const pm = await getSignerPm();
                  await (await pm.pauseAndBurn(Number(burnAmount))).wait();
                })} disabled={loading || !mintActive || !isDeployer} className="landing-btn secondary" style={{ padding: '10px 20px', whiteSpace: 'nowrap', opacity: (!mintActive || !isDeployer) ? 0.4 : 1 }}>
                  {actionLabel === "Burn" ? "⏳ ..." : `Burn ${burnAmount}`}
                </button>
              </div>

              {/* Google Purchase */}
              <p style={{ fontSize: 13, color: 'var(--muted-landing)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Google Purchase</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <button onClick={() => doAction("Send Pool80", async () => {
                  const sv = await getSignerSv();
                  await (await sv.receivePool80Funds({ value: ethers.parseEther(pool80 || "0") })).wait();
                })} disabled={loading || !isTreasury || Number(pool80) <= 0} className="landing-btn secondary" style={{ padding: 14, opacity: (isTreasury && Number(pool80) > 0) ? 1 : 0.4 }}>
                  {actionLabel === "Send Pool80" ? "⏳ ..." : "Send 80% (Pool80)"}
                </button>
                <button onClick={() => doAction("Send Loyalty", async () => {
                  const sv = await getSignerSv();
                  // Only send enough loyalty to fill the 20% gap — excess stays in Treasury
                  const gap20Amount = Number(mintPrincipal) * 0.2;
                  const sendAmount = Math.min(Number(loyaltyFees), gap20Amount);
                  await (await sv.receiveLoyaltyFunds({ value: ethers.parseEther(sendAmount.toFixed(6)) })).wait();
                })} disabled={loading || !isTreasury || Number(loyaltyFees) <= 0} className="landing-btn secondary" style={{ padding: 14, opacity: (isTreasury && Number(loyaltyFees) > 0) ? 1 : 0.4 }}>
                  {actionLabel === "Send Loyalty" ? "⏳ ..." : `Send Loyalty (${Math.min(Number(loyaltyFees), Number(mintPrincipal) * 0.2).toFixed(4)} ETH)`}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 11, color: 'var(--muted-landing)' }}>
                <span>SV Pool80: {Number(svPool80).toFixed(6)} ETH</span>
                <span>SV Loyalty: {Number(svLoyalty).toFixed(6)} ETH</span>
                <span>SV Total: {(Number(svPool80) + Number(svLoyalty)).toFixed(6)} ETH</span>
              </div>
              <button onClick={() => doAction("Trigger", async () => {
                const pm = await getSignerPm();
                // 1% slippage on GOOGLon purchase — adjust via env if needed
                const slippageBps = 100; // 1% = 100 bps
                const estimatedGooglon = ethers.parseEther(pool80 || "0") * 2000n / 365n; // rough estimate
                const minGooglonOut = estimatedGooglon * (10000n - BigInt(slippageBps)) / 10000n;
                await (await pm.triggerGooglePurchase(minGooglonOut)).wait();
              })} disabled={loading || !canTrigger || !isTreasury} className="landing-btn" style={{ padding: 16, width: '100%', fontSize: 16, opacity: (canTrigger && isTreasury) ? 1 : 0.4 }}>
                {actionLabel === "Trigger" ? "⏳ ..." : "Step 3: Trigger Google Purchase"}
              </button>
              <p style={{ fontSize: 11, color: 'var(--muted2-landing)', marginTop: 8, textAlign: 'center' }}>
                Steps 1 & 2 send ETH from Treasury to StockVault. Step 3 triggers the GOOGLon purchase.
              </p>


            </div>

            {/* Contract Addresses */}
            <div className="landing-card" style={{ padding: 24, minHeight: 'auto' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, letterSpacing: '-.03em' }}>Contract Addresses</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                {[
                  ['NFT', CONTRACT_ADDRESSES.googleStockNFT],
                  ['Platform Manager', CONTRACT_ADDRESSES.platformManager],
                  ['Stock Vault', CONTRACT_ADDRESSES.stockVault],
                  ['Interest Distributor', CONTRACT_ADDRESSES.interestDistributor],
                  ['Treasury EOA', CONTRACT_ADDRESSES.treasuryEOA],
                  ['GOOGLon', CONTRACT_ADDRESSES.googlon],
                ].map(([label, addr]) => (
                  <div key={label} className="landing-row" style={{ padding: '6px 0' }}>
                    <span style={{ color: 'var(--muted-landing)' }}>{label}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600 }}>{addr?.slice(0, 10)}...{addr?.slice(-6)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
