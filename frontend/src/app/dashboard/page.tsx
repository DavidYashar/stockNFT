"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useAccount } from "wagmi";
import { CONTRACT_ADDRESSES, GOOGLE_STOCK_NFT_ABI, INTEREST_DISTRIBUTOR_ABI, STOCK_VAULT_ABI, PLATFORM_MANAGER_ABI } from "@/lib/contracts";

interface NFTInfo { tokenId: number; principal: number; googlPrice: number; pendingInterest: number; shares: number; canRedeem: boolean; metadataUri: string; metadataImage: string; metadataName: string; metadataAttributes: { trait_type: string; value: string }[]; }

export default function DashboardPage() {
  const { address } = useAccount();
  const [nfts, setNfts] = useState<NFTInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [selectedNFT, setSelectedNFT] = useState<NFTInfo | null>(null);
  const [mintEnded, setMintEnded] = useState(false);

  useEffect(() => {
    if (address && window.ethereum) {
      const p = new ethers.BrowserProvider(window.ethereum);
      loadNFTs(p, address);
    }
  }, [address]);

  async function loadNFTs(p: ethers.BrowserProvider, addr: string) {
    setLoading(true);
    const nft = new ethers.Contract(CONTRACT_ADDRESSES.googleStockNFT, GOOGLE_STOCK_NFT_ABI, p);
    const stock = new ethers.Contract(CONTRACT_ADDRESSES.stockVault, STOCK_VAULT_ABI, p);
    const interest = new ethers.Contract(CONTRACT_ADDRESSES.interestDistributor, INTEREST_DISTRIBUTOR_ABI, p);

    // Check if mint has ended (claims only allowed after mint ends)
    try {
      const pm = new ethers.Contract(CONTRACT_ADDRESSES.platformManager, PLATFORM_MANAGER_ABI, p);
      setMintEnded(await pm.mintEnded());
    } catch {}

    const found: NFTInfo[] = [];
    try {
      // ERC-721: use balanceOf + tokenOfOwnerByIndex for efficient enumeration
      const balance = Number(await nft.balanceOf(addr));
      for (let i = 0; i < balance; i++) {
        try {
          const id = Number(await nft.tokenOfOwnerByIndex(addr, i));
          const principal = await nft.mintPrincipal(id);
          if (principal === 0n) continue;
          const googlPrice = await nft.googlPriceAtMint(id);
          let pending = 0n; try { pending = await interest.getPendingInterest(id); } catch {}
          let shares = 0n;
          try { shares = await stock.nftShares(id); } catch {}
          // Fallback to dynamic getShares() if nftShares not assigned yet
          if (shares === 0n) {
            try { shares = await stock.getShares(id); } catch {}
          }
          found.push({
            tokenId: id,
            principal: Number(ethers.formatEther(principal)),
            googlPrice: Number(ethers.formatUnits(googlPrice, 8)),
            pendingInterest: Number(ethers.formatEther(pending)),
            shares: Number(ethers.formatUnits(shares, 18)),
            canRedeem: shares > 0n,
            metadataUri: "",
            metadataImage: "",
            metadataName: `Google Stock NFT #${id}`,
            metadataAttributes: [],
          });
        } catch { break; }
      }
    } catch {}

    // Fetch IRYS metadata for each found token
    for (const f of found) {
      try {
        const uri = await nft.tokenURI(f.tokenId);
        f.metadataUri = uri;
        if (uri) {
          const res = await fetch(uri);
          if (res.ok) {
            const meta = await res.json();
            f.metadataName = meta.name || f.metadataName;
            f.metadataImage = meta.image || "";
            f.metadataAttributes = meta.attributes || [];
          }
        }
      } catch {}
    }

    setNfts(found); setLoading(false);
  }

  async function claimInterest(tokenId: number) {
    if (!address || !window.ethereum) return;
    setClaimingId(tokenId);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const interest = new ethers.Contract(CONTRACT_ADDRESSES.interestDistributor, INTEREST_DISTRIBUTOR_ABI, signer);
      const tx = await interest.claimInterest(tokenId);
      await tx.wait();
      loadNFTs(provider, address);
    } catch (err: any) { alert(`Claim failed: ${err.message?.slice(0, 100)}`); }
    setClaimingId(null);
  }

  const totalInterest = nfts.reduce((s, n) => s + n.pendingInterest, 0);
  const totalShares = nfts.reduce((s, n) => s + n.shares, 0);

  return (
    <div className="app-page">
      <div className="landing-container">
      <div className="landing-section-head" style={{ marginBottom: 40 }}>
        <h3>Portfolio</h3>
        <p>Your Google Stock NFT holdings</p>
      </div>

      {!address && (
        <div className="landing-card" style={{ textAlign: 'center', padding: 60 }}>
          <p style={{ fontSize: 18, color: 'var(--muted-landing)', margin: 0 }}>Connect your wallet to view your portfolio</p>
        </div>
      )}

      {address && loading && <p style={{ textAlign: 'center', color: 'var(--muted-landing)', padding: 60 }}>Loading your NFTs...</p>}

      {address && !loading && (
        <>
          {!mintEnded && (
            <div style={{ padding: '10px 16px', marginBottom: 24, background: 'rgba(251,191,36,.06)', border: '1px solid rgba(251,191,36,.3)', borderRadius: 22, fontSize: 13, color: 'var(--yellow)', textAlign: 'center' }}>
              ⏳ Minting is still active — interest claims open after mint ends
            </div>
          )}

          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
            {[
              { v: nfts.length, l: 'NFTs Owned' },
              { v: totalInterest.toFixed(6), l: 'Pending Interest (ETH)', c: 'var(--green-landing)' },
              { v: totalShares.toFixed(6), l: 'GOOGLon Shares' },
            ].map((s) => (
              <div key={s.l} className="landing-metric" style={{ textAlign: 'center' }}>
                <small>{s.l}</small>
                <strong style={{ color: s.c || 'var(--text-landing)' }}>{s.v}</strong>
              </div>
            ))}
          </div>

          {nfts.length === 0 ? (
            <div className="landing-card" style={{ textAlign: 'center', padding: 60 }}>
              <p style={{ fontSize: 18, marginBottom: 8 }}>No NFTs yet</p>
              <p style={{ color: 'var(--muted-landing)', fontSize: 14, margin: 0 }}>Head to the Mint page to get your first Google Stock NFT.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {nfts.map((n) => (
                <div key={n.tokenId} className="landing-card" style={{ padding: 24, minHeight: 'auto', cursor: 'pointer' }}
                  onClick={() => setSelectedNFT(n)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {n.metadataImage && !n.metadataImage.includes('GOOGLE_STOCK_NFT_ART') ? (
                        <img src={n.metadataImage} alt={n.metadataName} style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', background: 'rgba(255,255,255,.05)' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <img src="/certificate-template.png" alt="Certificate" style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', background: 'rgba(255,255,255,.05)' }} />
                      )}
                      <div>
                        <h3 style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>{n.metadataName}</h3>
                        <span className="landing-pill-green" style={{ marginTop: 4, display: 'inline-block' }}>{n.canRedeem ? 'Redeemable' : 'Pre-Purchase'}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); claimInterest(n.tokenId); }}
                      disabled={n.pendingInterest <= 0 || claimingId === n.tokenId || !mintEnded}
                      className="landing-btn"
                      style={{ padding: '10px 20px', fontSize: 13, opacity: (n.pendingInterest > 0 && mintEnded) ? 1 : 0.4 }}
                    >
                      {claimingId === n.tokenId ? 'Claiming...' : !mintEnded ? '⏳ Mint Active' : n.pendingInterest > 0 ? `Claim ${n.pendingInterest.toFixed(6)} ETH` : 'No Interest Yet'}
                    </button>
                  </div>
                  <div className="nft-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, fontSize: 13 }}>
                    <div><span style={{ color: 'var(--muted-landing)' }}>Mint Price</span><br /><span style={{ fontWeight: 600 }}>{n.principal} ETH</span></div>
                    <div><span style={{ color: 'var(--muted-landing)' }}>GOOGL at Mint</span><br /><span style={{ fontWeight: 600 }}>${n.googlPrice}</span></div>
                    <div><span style={{ color: 'var(--muted-landing)' }}>Accrued Interest</span><br /><span style={{ fontWeight: 600, color: 'var(--green-landing)' }}>{n.pendingInterest.toFixed(6)} ETH</span></div>
                    <div><span style={{ color: 'var(--muted-landing)' }}>GOOGLon Shares</span><br /><span style={{ fontWeight: 600 }}>{n.shares.toFixed(6)}</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* NFT Detail Modal */}
      {selectedNFT && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20
        }} onClick={() => setSelectedNFT(null)}>
          <div style={{
            background: '#0d1019', borderRadius: 30,
            border: '1px solid rgba(255,255,255,.13)',
            boxShadow: '0 32px 100px rgba(0,0,0,.55)',
            maxWidth: 520, width: '100%', maxHeight: '90vh',
            overflow: 'auto', padding: 32
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button onClick={() => setSelectedNFT(null)} style={{
                background: 'none', border: 'none', color: 'var(--muted-landing)',
                fontSize: 24, cursor: 'pointer', padding: '4px 8px', lineHeight: 1
              }}>✕</button>
            </div>

            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              {selectedNFT.metadataImage && !selectedNFT.metadataImage.includes('GOOGLE_STOCK_NFT_ART') ? (
                <img src={selectedNFT.metadataImage} alt={selectedNFT.metadataName}
                  style={{ width: '100%', maxWidth: 360, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
                  onError={(e) => { (e.target as HTMLImageElement).src = '/certificate-template.png'; }} />
              ) : (
                <img src="/certificate-template.png" alt="Certificate"
                  style={{ width: '100%', maxWidth: 360, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }} />
              )}
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 800, textAlign: 'center', marginBottom: 4 }}>
              {selectedNFT.metadataName}
            </h2>
            <p style={{ textAlign: 'center', color: 'var(--muted-landing)', fontSize: 13, marginBottom: 24 }}>
              Token ID: #{selectedNFT.tokenId} · {selectedNFT.canRedeem ? 'Redeemable' : 'Pre-Purchase'}
            </p>

            {(selectedNFT.metadataAttributes?.length ?? 0) > 0 && (
              <>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--muted-landing)', textTransform: 'uppercase', letterSpacing: 1 }}>
                  📋 Metadata Attributes
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selectedNFT.metadataAttributes.map((attr, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.09)' }}>
                      <span style={{ color: 'var(--muted-landing)', fontSize: 13 }}>{attr.trait_type}</span>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{attr.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <button
                onClick={() => { claimInterest(selectedNFT.tokenId); }}
                disabled={selectedNFT.pendingInterest <= 0 || claimingId === selectedNFT.tokenId}
                className="landing-btn"
                style={{ padding: '12px 28px', fontSize: 14, opacity: selectedNFT.pendingInterest <= 0 ? 0.4 : 1 }}
              >
                {claimingId === selectedNFT.tokenId ? 'Claiming...' : selectedNFT.pendingInterest > 0 ? `Claim ${selectedNFT.pendingInterest.toFixed(6)} ETH` : 'No Interest Accrued Yet'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .dash-stats {
            grid-template-columns: 1fr !important;
          }
          .nft-grid-4 {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 480px) {
          .nft-grid-4 {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
