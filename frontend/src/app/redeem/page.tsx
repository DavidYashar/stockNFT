"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useAccount } from "wagmi";
import { CONTRACT_ADDRESSES, GOOGLE_STOCK_NFT_ABI, STOCK_VAULT_ABI } from "@/lib/contracts";
import { NFT_CONFIG, STORAGE_KEYS } from "@/lib/constants";

interface RedeemableNFT { tokenId: number; shares: number; googlPrice: number; status: "available" | "pending" | "claimable" | "claimed"; availableAt?: number; }

const PENDING_KEY = STORAGE_KEYS.PENDING_REDEMPTIONS; // localStorage key

export default function RedeemPage() {
  const { address } = useAccount();
  const [nfts, setNfts] = useState<RedeemableNFT[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [purchaseComplete, setPurchaseComplete] = useState(false);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  // Live clock for countdown timers + auto-transition pending → claimable
  useEffect(() => {
    const timer = setInterval(() => {
      const currentNow = Math.floor(Date.now() / 1000);
      setNow(currentNow);
      // Auto-switch status when countdown expires (no page refresh needed)
      setNfts(prev => {
        let changed = false;
        const updated = prev.map(n => {
          if (n.status === "pending" && n.availableAt && currentNow >= n.availableAt) {
            changed = true;
            return { ...n, status: "claimable" as const };
          }
          return n;
        });
        return changed ? updated : prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (address && window.ethereum) {
      const p = new ethers.BrowserProvider(window.ethereum);
      loadState(p, address);
    }
  }, [address]);

  async function loadState(p: ethers.BrowserProvider, addr: string) {
    setLoading(true);
    const nft = new ethers.Contract(CONTRACT_ADDRESSES.googleStockNFT, GOOGLE_STOCK_NFT_ABI, p);
    const stock = new ethers.Contract(CONTRACT_ADDRESSES.stockVault, STOCK_VAULT_ABI, p);
    
    const complete = await stock.purchaseComplete().catch(() => false);
    setPurchaseComplete(complete);
    if (!complete) { setLoading(false); return; }

    const found: RedeemableNFT[] = [];
    const seenIds = new Set<number>();

    // 1. Scan owned NFTs (pre-burn)
    try {
      const balance = Number(await nft.balanceOf(addr));
      for (let i = 0; i < balance; i++) {
        try {
          const id = Number(await nft.tokenOfOwnerByIndex(addr, i));
          seenIds.add(id);
          await addNFTCard(nft, stock, id, found);
        } catch { break; }
      }
    } catch {}

    // 2. Scan pending redemptions from localStorage + on-chain event fallback
    try {
      const raw = localStorage.getItem(PENDING_KEY + "_" + addr.toLowerCase());
      const pendingIds: number[] = raw ? JSON.parse(raw) : [];
      // Also scan on-chain RedemptionRequested events (recovers from cleared localStorage)
      try {
        const reqTopic = ethers.id("RedemptionRequested(uint256,address,uint256)");
        const logs = await p.getLogs({
          address: CONTRACT_ADDRESSES.stockVault,
          fromBlock: 0, toBlock: "latest",
          topics: [reqTopic, null, ethers.zeroPadValue(addr, 32)],
        });
        const iface = new ethers.Interface(["event RedemptionRequested(uint256 indexed tokenId, address indexed owner, uint256 googlonAmount)"]);
        for (const log of logs) {
          try {
            const parsed = iface.parseLog({ topics: log.topics as any, data: log.data });
            if (parsed && !pendingIds.includes(Number(parsed.args.tokenId))) {
              pendingIds.push(Number(parsed.args.tokenId));
            }
          } catch {}
        }
      } catch {}
      for (const id of pendingIds) {
        if (!seenIds.has(id)) {
          await addNFTCard(nft, stock, id, found);
        }
      }
    } catch {}

    setNfts(found); setLoading(false);
  }

  async function addNFTCard(nft: ethers.Contract, stock: ethers.Contract, id: number, found: RedeemableNFT[]) {
    try {
      // Use getShares (dynamic) instead of nftShares (static)
      const shares = await stock.getShares(id).catch(() => 0n);
      if (shares === 0n) return;
      const googlPrice = await nft.googlPriceAtMint(id).catch(() => 0n);
      let status: RedeemableNFT["status"] = "available";
      let availableAt: number | undefined;
      try {
        const req = await stock.redemptionRequest(id);
        if (Number(req) > 0) {
          const now = Math.floor(Date.now() / 1000);
          const readyAt = Number(req) + NFT_CONFIG.REDEMPTION_WAIT_SECONDS;
          status = readyAt > now ? "pending" : "claimable";
          availableAt = readyAt;
        }
      } catch {}
      found.push({
        tokenId: id,
        shares: Number(ethers.formatUnits(shares, 18)),
        googlPrice: Number(ethers.formatUnits(googlPrice, 8)),
        status,
        availableAt,
      });
    } catch {}
  }

  // Save pending token ID to localStorage after successful request
  function savePendingToken(addr: string, tokenId: number) {
    try {
      const key = PENDING_KEY + "_" + addr.toLowerCase();
      const raw = localStorage.getItem(key);
      const ids: number[] = raw ? JSON.parse(raw) : [];
      if (!ids.includes(tokenId)) {
        ids.push(tokenId);
        localStorage.setItem(key, JSON.stringify(ids));
      }
    } catch {}
  }

  // Remove from localStorage after successful claim
  function removePendingToken(addr: string, tokenId: number) {
    try {
      const key = PENDING_KEY + "_" + addr.toLowerCase();
      const raw = localStorage.getItem(key);
      if (raw) {
        const ids: number[] = JSON.parse(raw).filter((id: number) => id !== tokenId);
        localStorage.setItem(key, JSON.stringify(ids));
      }
    } catch {}
  }

  async function requestRedemption(tokenId: number) {
    if (!address || !window.ethereum) return; setActionId(tokenId);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const stock = new ethers.Contract(CONTRACT_ADDRESSES.stockVault, STOCK_VAULT_ABI, signer);
      await (await stock.requestRedemption(tokenId)).wait();
      savePendingToken(address, tokenId); // track for post-burn
      loadState(provider, address);
    } catch (err: any) { alert(`Request failed: ${err.message?.slice(0, 100)}`); }
    setActionId(null);
  }

  async function claimRedemption(tokenId: number) {
    if (!address || !window.ethereum) return; setActionId(tokenId);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const stock = new ethers.Contract(CONTRACT_ADDRESSES.stockVault, STOCK_VAULT_ABI, signer);
      await (await stock.claimRedemption(tokenId)).wait();
      if (address) removePendingToken(address, tokenId); // cleanup
      loadState(provider, address);
    } catch (err: any) { alert(`Claim failed: ${err.message?.slice(0, 100)}`); }
    setActionId(null);
  }

  const totalRedeemable = nfts.filter(n => n.status === "available").reduce((s, n) => s + n.shares, 0);

  function timeLeft(availableAt?: number): number {
    if (!availableAt) return 0;
    return Math.max(0, availableAt - now);
  }

  return (
    <div className="app-page">
      <div className="landing-container">
      <div className="landing-section-head" style={{ marginBottom: 40 }}>
        <h3>Redeem Shares</h3>
        <p>Convert your NFT into real GOOGLon tokens</p>
      </div>

      {!address && (
        <div className="landing-card" style={{ textAlign: 'center', padding: 60 }}>
          <p style={{ fontSize: 18, color: 'var(--muted-landing)', margin: 0 }}>Connect your wallet to redeem</p>
        </div>
      )}

      {address && !purchaseComplete && (
        <div className="landing-card" style={{ textAlign: 'center', padding: 48 }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Purchase Not Yet Complete</h3>
          <p style={{ color: 'var(--muted-landing)', fontSize: 14, maxWidth: 480, margin: '0 auto', lineHeight: 1.8 }}>
            The one-time GOOGLon bulk purchase hasn&apos;t been triggered yet.
            This happens when minting ends AND loyalty fees from secondary trades cover the 20% gap.
          </p>
        </div>
      )}

      {address && purchaseComplete && nfts.length === 0 && !loading && (
        <div className="landing-card" style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ fontSize: 16, color: 'var(--muted-landing)', margin: 0 }}>No redeemable NFTs in your wallet.</p>
        </div>
      )}

      {nfts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {nfts.map((n) => (
            <div key={n.tokenId} className="landing-card" style={{ padding: 24, minHeight: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="landing-num">🔓</div>
                  <div>
                    <h3 style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>Stock NFT #{n.tokenId}</h3>
                    <span className="landing-pill-green" style={{ marginTop: 4, display: 'inline-block' }}>
                      {n.status === 'available' ? 'Ready' : n.status === 'pending' ? 'Pending' : n.status === 'claimable' ? 'Ready to Claim' : 'Claimed'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="redeem-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, fontSize: 13, marginBottom: 16 }}>
                <div><span style={{ color: 'var(--muted-landing)' }}>GOOGLon Shares</span><br /><span style={{ fontWeight: 600, fontSize: 15 }}>{n.shares.toFixed(6)}</span></div>
                <div><span style={{ color: 'var(--muted-landing)' }}>Price at Mint</span><br /><span style={{ fontWeight: 600 }}>${n.googlPrice}</span></div>
                <div><span style={{ color: 'var(--muted-landing)' }}>Fee ({NFT_CONFIG.REDEMPTION_FEE_BPS / 100}%)</span><br /><span style={{ fontWeight: 600, color: 'var(--red-landing)' }}>{(n.shares * NFT_CONFIG.REDEMPTION_FEE_PCT).toFixed(6)}</span></div>
                <div><span style={{ color: 'var(--muted-landing)' }}>You Receive</span><br /><span style={{ fontWeight: 600, color: 'var(--green-landing)', fontSize: 15 }}>{(n.shares * NFT_CONFIG.REDEMPTION_NET_PCT).toFixed(6)} GOOGLon</span></div>
              </div>
              {n.status === 'available' && (
                <button onClick={() => requestRedemption(n.tokenId)} disabled={actionId === n.tokenId} className="landing-btn" style={{ width: '100%', padding: 14, fontSize: 14 }}>
                    {actionId === n.tokenId ? 'Requesting...' : `Request Redemption (${Math.floor(NFT_CONFIG.REDEMPTION_WAIT_SECONDS / 3600)}h wait)`}
                </button>
              )}
              {n.status === 'pending' && (
                <button disabled className="landing-btn secondary" style={{ width: '100%', padding: 14, fontSize: 14 }}>
                  {timeLeft(n.availableAt)}s remaining...
                </button>
              )}
              {n.status === 'claimable' && (
                <button onClick={() => claimRedemption(n.tokenId)} disabled={actionId === n.tokenId} className="landing-btn" style={{ width: '100%', padding: 14, fontSize: 14, background: 'linear-gradient(135deg, #34d399, #10b981)', color: '#090a0f' }}>
                  {actionId === n.tokenId ? 'Claiming...' : `Claim ${(n.shares * 0.95).toFixed(6)} GOOGLon`}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .redeem-grid-4 {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 480px) {
          .redeem-grid-4 {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
