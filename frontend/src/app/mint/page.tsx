"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useAccount } from "wagmi";
import { CONTRACT_ADDRESSES, GOOGLE_STOCK_NFT_ABI } from "@/lib/contracts";
import { NFT_CONFIG, TOKEN_DECIMALS } from "@/lib/constants";
import { useGOOGLonPrice } from "@/hooks/useGOOGLonPrice";
import { useETHPrice } from "@/hooks/useETHPrice";
import CertificateSVG from "@/components/CertificateSVG";

export default function MintPage() {
  const { address, isConnected } = useAccount();
  const { price: liveGOOGLonPrice, loading: priceLoading, isLive } = useGOOGLonPrice();
  const { price: ethPrice, isLive: ethLive } = useETHPrice();
  const [googlPrice, setGooglPrice] = useState<string>("365.00");
  const [minting, setMinting] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [mintActive, setMintActive] = useState(true);
  const [contractMintPrice, setContractMintPrice] = useState<string>("0.005");
  const [ethBalance, setEthBalance] = useState<string>("0");
  const [totalMinted, setTotalMinted] = useState(0);
  const [totalBurned, setTotalBurned] = useState(0);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (isLive && liveGOOGLonPrice > 0) setGooglPrice(liveGOOGLonPrice.toFixed(2));
  }, [liveGOOGLonPrice, isLive]);

  useEffect(() => {
    if (isConnected && window.ethereum) {
      loadState(new ethers.BrowserProvider(window.ethereum));
    }
  }, [address, isConnected]);

  async function loadState(p: ethers.BrowserProvider) {
    setLoadError(false);
    try {
      const nft = new ethers.Contract(CONTRACT_ADDRESSES.googleStockNFT, GOOGLE_STOCK_NFT_ABI, p);
      setMintActive(await nft.mintActive());
      const onChainMintPrice = await nft.mintPrice();
      setContractMintPrice(ethers.formatEther(onChainMintPrice));
      if (address) setEthBalance(ethers.formatEther(await p.getBalance(address)));
      setTotalMinted(Number(await nft.totalSupply()));
      const pm = new ethers.Contract(CONTRACT_ADDRESSES.platformManager, ["function totalMintPrincipal() view returns (uint256)","function totalBurned() view returns (uint256)"], p);
      setTotalBurned(Number(await pm.totalBurned()));
    } catch { setLoadError(true); }
  }

  async function mint() {
    if (!address || !window.ethereum) return alert("Connect wallet first.");
    setMinting(true); setTxHash("");
    try {
      const p = new ethers.BrowserProvider(window.ethereum);
      const signer = await p.getSigner();
      const nft = new ethers.Contract(CONTRACT_ADDRESSES.googleStockNFT, GOOGLE_STOCK_NFT_ABI, signer);
      const mintPriceWei = ethers.parseEther(contractMintPrice);
      const tx = await nft.mint(ethers.parseUnits(googlPrice, TOKEN_DECIMALS.GOOGL_PRICE), { value: mintPriceWei });
      setTxHash(tx.hash);
      await tx.wait();
      loadState(p);
    } catch (err: any) { alert(`Mint failed: ${err.message?.slice(0, 100)}`); }
    setMinting(false);
  }

  const mintPriceNum = Number(contractMintPrice) || 0.005;
  const safePrice = Math.max(0.01, Number(googlPrice) || 365);
  const targetUsd = NFT_CONFIG.TARGET_USD_PER_MINT;
  const actualDollar = mintPriceNum * ethPrice;
  const shares = (targetUsd / safePrice).toFixed(6);

  return (
    <div className="app-page">
      <div className="landing-container">
      {!mintActive && (
        <div style={{
          textAlign: 'center',
          marginBottom: 32,
          padding: '10px 16px',
          borderRadius: 22,
          background: 'rgba(251,191,36,.06)',
          border: '1px solid rgba(251,191,36,.3)',
        }}>
          <p style={{ fontSize: 18, color: 'var(--yellow)', margin: 0 }}>⏸ Minting is currently closed</p>
        </div>
      )}
      {loadError && (
        <div className="landing-card" style={{ textAlign: 'center', marginBottom: 24, borderColor: 'rgba(255,142,155,.3)', background: 'rgba(255,142,155,.06)' }}>
          <p style={{ fontSize: 14, color: 'var(--red-landing)', margin: 0 }}>⚠️ Could not load on-chain data. Check your connection.</p>
        </div>
      )}

      {/* Progress Bar */}
      <div className="landing-progress-wrap" style={{ marginBottom: 32, padding: '10px 14px' }}>
        <div className="landing-progress-head" style={{ marginBottom: 6, fontSize: 12 }}>
          <span>Mint Progress</span>
          <span><b>{totalMinted}</b> / {NFT_CONFIG.MAX_SUPPLY - totalBurned}</span>
        </div>
        <div className="landing-progress-bar" style={{ height: 6 }}>
          <div className="landing-bar-fill" style={{
            width: Math.min(((NFT_CONFIG.MAX_SUPPLY - totalBurned) > 0 ? (totalMinted / (NFT_CONFIG.MAX_SUPPLY - totalBurned)) * 100 : 100), 100) + '%',
          }} />
        </div>
        <p style={{ fontSize: 11, color: 'var(--muted-landing)', marginTop: 6, marginBottom: 0 }}>
          {totalMinted < (NFT_CONFIG.MAX_SUPPLY - totalBurned) ? `${(NFT_CONFIG.MAX_SUPPLY - totalBurned - totalMinted).toLocaleString()} NFTs remaining` : 'All NFTs minted!'}
        </p>
      </div>

      {/* Section Head */}
      <div className="landing-section-head" style={{ marginBottom: 32 }}>
        <h3>Mint G-Pass</h3>
        <p>Pay 10 USDC worth of ETH. 80% reserved for Google purchase, 20% earns DeFi yield in Aave.</p>
      </div>

      {/* Mint Grid */}
      <div className="mint-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 48 }}>
        {/* Left: Purchase Card */}
        <div className="landing-card" style={{ padding: 32, minHeight: 'auto' }}>
          <div className="landing-row" style={{ marginBottom: 16 }}>
            <span>GOOGL Price</span>
            <strong>
              ${safePrice.toFixed(2)}
              {isLive && <span style={{ color: 'var(--green-landing)', fontSize: 11, marginLeft: 6 }}>● LIVE</span>}
            </strong>
          </div>

          <div style={{ marginBottom: 28 }}>
            <small style={{ color: 'var(--muted2-landing)', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5, fontWeight: 700 }}>Price</small>
            <div style={{ fontSize: 36, fontWeight: 700, marginTop: 4, letterSpacing: '-.03em' }}>10 USDC</div>
            <div style={{ fontSize: 14, color: 'var(--muted-landing)', marginTop: 4 }}>≈ ${safePrice.toFixed(2)} USD</div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,.09)', borderBottom: '1px solid rgba(255,255,255,.09)', padding: '20px 0', marginBottom: 24 }}>
            <small style={{ color: 'var(--muted2-landing)', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5, fontWeight: 700, marginBottom: 12, display: 'block' }}>You Pay</small>
            <div className="landing-row" style={{ padding: '6px 0', borderBottom: 'none' }}>
              <span>NFT Price</span><strong>10 USDC</strong>
            </div>
            <div className="landing-row" style={{ padding: '6px 0', borderBottom: 'none' }}>
              <span>Network Fee (est.)</span><strong style={{ color: 'var(--muted2-landing)' }}>~0.001 ETH</strong>
            </div>
            <div className="landing-row" style={{ padding: '6px 0', borderBottom: 'none' }}>
              <span>You Receive</span><strong style={{ color: 'var(--gold)' }}>~{shares} GOOGLon</strong>
            </div>
          </div>

          {isConnected && (
            <div className="landing-row" style={{ marginBottom: 20, padding: '10px 14px', borderRadius: 12, background: 'rgba(255,255,255,.04)', borderBottom: 'none' }}>
              <span>Your ETH Balance</span>
              <strong style={{ color: Number(ethBalance) < mintPriceNum ? 'var(--red-landing)' : 'var(--green-landing)' }}>{Number(ethBalance).toFixed(4)} ETH</strong>
            </div>
          )}

          <button onClick={mint} disabled={minting || !mintActive} className="landing-btn" style={{ width: '100%', padding: 16, fontSize: 16, marginBottom: 12 }}>
            {minting ? '⏳ Minting...' : !isConnected ? 'Connect Wallet' : 'MINT'}
          </button>

          {isConnected && Number(ethBalance) < mintPriceNum && (
            <div style={{ marginTop: 12, padding: 10, background: 'rgba(255,142,155,.08)', borderRadius: 12, textAlign: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--red-landing)' }}>⚠️ You need at least {contractMintPrice} ETH to mint. Please fund your wallet.</span>
            </div>
          )}

          {txHash && (
            <p style={{ marginTop: 16, fontSize: 12, textAlign: 'center' }}>
              <a href={`https://etherscan.io/tx/${txHash}`} target="_blank" style={{ color: 'var(--gold)' }}>View on Etherscan ↗</a>
            </p>
          )}
        </div>

        {/* Right: Certificate Preview */}
        <div className="landing-card mint-cert" style={{
          padding: 32,
          minHeight: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          perspective: '800px',
          overflow: 'hidden',
        }}>
          <div
            style={{
              transformStyle: 'preserve-3d',
              transition: 'transform 0.15s ease-out',
              cursor: 'default',
              marginBottom: 16,
            }}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              const rotX = ((y / rect.height) - 0.5) * 14;
              const rotY = ((x / rect.width) - 0.5) * -14;
              e.currentTarget.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'rotateX(0deg) rotateY(0deg)';
            }}
          >
            <CertificateSVG
              tokenId="—"
              owner={address ? `${address.slice(0,6)}...${address.slice(-4)}` : '0x...'}
              shares={shares}
              valueUSDC="10"
              issueDate={new Date().toISOString().split('T')[0]}
              network="Ethereum Mainnet"
              googlPrice={safePrice.toFixed(2)}
              width={400}
              height={566}
            />
          </div>
          <p style={{ color: 'var(--muted-landing)', fontSize: 12, maxWidth: 400, textAlign: 'center', margin: 0 }}>
            Your NFT will be stored permanently on Arweave via IRYS on mint
          </p>
        </div>
      </div>

      {/* Economics Section */}
      <div className="landing-section" style={{ paddingTop: 0 }}>
        <EconomicsSlideshow />
      </div>

      <style jsx>{`
        .mint-cert svg {
          max-width: 100%;
          height: auto;
        }
        @media (max-width: 768px) {
          .mint-grid {
            grid-template-columns: 1fr !important;
          }
          .mint-cert svg {
            width: 300px !important;
            height: auto !important;
          }
        }
        @media (max-width: 480px) {
          .mint-grid {
            grid-template-columns: 1fr !important;
          }
          .mint-cert svg {
            width: 260px !important;
          }
        }
      `}</style>
      </div>
    </div>
  );
}

function EconomicsSlideshow() {
  const steps = [
    { v: '10 USDC', l: 'You Pay', sub: 'Fixed mint price per NFT' },
    { v: '8 USDC', l: 'Google Purchase (80%)', sub: 'Directed to GOOGL stock acquisition' },
    { v: '2 USDC', l: 'DeFi Yield (20%)', sub: 'Deposited into Aave for yield generation' },
    { v: '3.9% APR', l: 'Weekly Interest', sub: 'Earned on the DeFi portion via Aave' },
  ];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIdx((i) => (i + 1) % steps.length), 4000);
    return () => clearInterval(timer);
  }, [steps.length]);

  const s = steps[idx];

  return (
    <>
      <div className="landing-section-head" style={{ marginBottom: 28 }}>
        <h3>Per-NFT Economics</h3>
        <p>Where your 10 USDC goes after minting.</p>
      </div>
      <div style={{
        maxWidth: 700, margin: '0 auto',
        padding: '48px 40px',
        borderRadius: 34,
        background: 'linear-gradient(180deg, rgba(255,255,255,.09), rgba(255,255,255,.045))',
        border: '1px solid rgba(255,255,255,.12)',
        boxShadow: '0 16px 55px rgba(0,0,0,.22)',
        minHeight: 180,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <div key={idx} style={{ animation: 'fadeSlideIn 0.5s ease-out', textAlign: 'center' }}>
          <div style={{ fontSize: 48, fontWeight: 700, letterSpacing: '-1px', color: 'var(--gold)', marginBottom: 8 }}>{s.v}</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 6 }}>{s.l}</div>
          <div style={{ fontSize: 13, color: 'var(--muted-landing)' }}>{s.sub}</div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
        {steps.map((_, i) => (
          <div key={i} style={{
            width: i === idx ? 24 : 8, height: 8, borderRadius: 200,
            background: i === idx ? 'var(--gold)' : 'rgba(255,255,255,.15)',
            transition: 'all 0.4s ease',
          }} />
        ))}
      </div>
      <style jsx>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </>
  );
}
