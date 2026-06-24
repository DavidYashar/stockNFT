"use client";

import Link from "next/link";
import { CONTRACT_ADDRESSES } from "@/lib/contracts";

export default function DocsPage() {
  return (
    <div className="app-page">
      <div className="landing-container">

        {/* Hero */}
        <div className="landing-section-head">
          <h3>G‑pass NFT</h3>
          <p>
            Tokenized fractional ownership of Alphabet Class&nbsp;A (GOOGL) stock
            via Ondo Finance GOOGLon — on Ethereum mainnet.
          </p>
        </div>

        {/* Quick Stats — 2 rows × 3 columns */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
          gap: 14, marginBottom: 48,
        }}>
          {[
            ["Supply", "4,083 NFTs"],
            ["Mint Price", "0.005 ETH"],
            ["Yield", "3.5% APY"],
            ["Royalty", "10%"],
            ["Redemption Fee", "5%"],
            ["Redemption Delay", "48 hours"],
          ].map(([label, value]) => (
            <div key={label} className="landing-card" style={{
              padding: "28px 24px", textAlign: "center", minHeight: "auto",
            }}>
              <small style={{
                display: "block", color: "var(--muted2-landing)", fontWeight: 700,
                marginBottom: 8, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px",
              }}>{label}</small>
              <strong style={{ fontSize: 24, letterSpacing: "-.04em", color: "var(--text-landing)" }}>{value}</strong>
            </div>
          ))}
        </div>

        {/* How It Works */}
        <div className="landing-section-head">
          <h3>How It Works</h3>
          <p>Five steps from mint to redemption.</p>
        </div>
        <div style={{ display: "grid", gap: 16, marginBottom: 48 }}>
          {[
            { n: 1, title: "Mint", desc: "Pay 0.005 ETH to mint a G‑pass NFT. 80% of your payment enters the Google purchase pool. 20% is deployed to Aave V3 to earn yield for all holders." },
            { n: 2, title: "Earn Yield", desc: "The DeFi portion compounds in Aave V3 (USDC lending market). Yield is distributed equally to all NFT holders after minting ends. Target: 3.5% APY." },
            { n: 3, title: "Secondary Market", desc: "Trade your NFT on OpenSea, Blur, or any ERC‑721 marketplace. Every sale generates a 10% royalty paid to the treasury — funding the Google share purchase." },
            { n: 4, title: "Google Purchase Trigger", desc: "When minting ends and royalty fees accumulate to match the DeFi portion, the platform executes a one‑time GOOGLon purchase via Uniswap V3. All ETH is swapped for real GOOGLon tokens held in the StockVault." },
            { n: 5, title: "Redeem", desc: "After the Google purchase, any holder can redeem their NFT for actual GOOGLon tokens. There is a 48‑hour waiting period and a 5% management fee. GOOGLon is sent directly to your wallet." },
          ].map((s) => (
            <div key={s.n} className="landing-flow-step">
              <div className="landing-num">{s.n}</div>
              <div>
                <b>{s.title}</b>
                <span>{s.desc}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Two-column sections */}
        <div className="docs-2col" style={{ gap: 18, marginBottom: 48 }}>
          {/* Token Details */}
          <div className="landing-card" style={{ minHeight: "auto" }}>
            <h4>GOOGLon — The Underlying Asset</h4>
            <p>
              GOOGLon is an ERC‑20 token issued by Ondo Finance that tracks the price of
              Alphabet Class&nbsp;A (GOOGL) stock. It is fully backed and regulated.
              Each G‑pass NFT represents a proportional claim on GOOGLon held in the
              StockVault after the purchase trigger fires.
            </p>
            <p style={{ fontSize: 12, color: "var(--muted2-landing)", wordBreak: "break-all", marginTop: 12 }}>
              {CONTRACT_ADDRESSES.googlon}
            </p>
          </div>

          {/* Yield Details */}
          <div className="landing-card" style={{ minHeight: "auto" }}>
            <h4>Yield Mechanics</h4>
            <ul style={{ paddingLeft: 20, lineHeight: 1.8, fontSize: 14, color: "var(--muted-landing)", margin: 0 }}>
              <li><strong style={{ color: "var(--text-landing)" }}>Source:</strong> Aave V3 USDC lending pool</li>
              <li><strong style={{ color: "var(--text-landing)" }}>Allocation:</strong> 20% of every mint</li>
              <li><strong style={{ color: "var(--text-landing)" }}>Distribution:</strong> Equal per‑NFT, post‑mint</li>
              <li><strong style={{ color: "var(--text-landing)" }}>Rate:</strong> Target 3.5% APY</li>
              <li><strong style={{ color: "var(--text-landing)" }}>Frequency:</strong> Periodic distributions</li>
            </ul>
          </div>

          {/* Redemption */}
          <div className="landing-card" style={{ minHeight: "auto" }}>
            <h4>Redemption Process</h4>
            <ol style={{ paddingLeft: 20, lineHeight: 1.8, fontSize: 14, color: "var(--muted-landing)", margin: 0 }}>
              <li>Holder clicks Redeem on their NFT</li>
              <li>48‑hour waiting period begins</li>
              <li>Once 48 hours pass, holder clicks Claim to receive GOOGLon</li>
            </ol>
          </div>

          {/* Treasury */}
          <div className="landing-card" style={{ minHeight: "auto" }}>
            <h4>Treasury &amp; Fee Structure</h4>
            <div className="landing-row" style={{ paddingTop: 0 }}>
              <span>Mint → Purchase Pool</span><strong>80%</strong>
            </div>
            <div className="landing-row">
              <span>Mint → DeFi (Aave)</span><strong>20%</strong>
            </div>
            <div className="landing-row">
              <span>Secondary Royalty</span><strong>10%</strong>
            </div>
            <div className="landing-row">
              <span>Redemption Fee</span><strong>5%</strong>
            </div>
            <div className="landing-row" style={{ borderBottom: "none" }}>
              <span>Yield Distribution</span><strong style={{ color: "var(--green-landing)" }}>100% to holders</strong>
            </div>
          </div>
        </div>

        {/* Contract Addresses */}
        <div className="landing-section-head">
          <h3>Contract Addresses</h3>
          <p>Ethereum Mainnet</p>
        </div>
        <div className="landing-card" style={{ minHeight: "auto", marginBottom: 48 }}>
          {[
            ["G‑pass NFT (GPASS)", CONTRACT_ADDRESSES.googleStockNFT],
            ["GOOGLon Token", CONTRACT_ADDRESSES.googlon],
          ].map(([name, addr]) => (
            <div key={name} className="landing-row">
              <span>{name}</span>
              <code style={{ wordBreak: "break-all", textAlign: "right", color: "var(--muted2-landing)", fontSize: 12, maxWidth: "60%" }}>
                {addr}
              </code>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="landing-section-head">
          <h3>FAQ</h3>
          <p>Common questions about the platform.</p>
        </div>
        <div className="landing-faq" style={{ marginBottom: 48 }}>
          {[
            { q: "What is the minimum mint price?", a: "0.005 ETH (approximately $8–10 USD)." },
            { q: "Can I mint more than one NFT?", a: "Yes — each mint costs 0.005 ETH and mints one G‑pass NFT." },
            { q: "When can I claim yield?", a: "After minting ends and the platform owner enables claims via allowClaims()." },
            { q: "When can I redeem for GOOGLon?", a: "After the one‑time Google purchase is triggered, which requires minting to end AND royalty fees to accumulate sufficiently." },
            { q: "Is the NFT transferable?", a: "Yes — G‑pass is a standard ERC‑721 token. Trade on any marketplace. Each transfer resets the interest clock for that token." },
            { q: "Who controls the platform?", a: "The deployer controls mint lifecycle (stop/burn). Treasury operations (ownership of StockVault, InterestDistributor, SwapAdapter) are held by the Treasury EOA." },
          ].map((faq, i) => (
            <details key={i} open={i === 0}>
              <summary>{faq.q}</summary>
              <p>{faq.a}</p>
            </details>
          ))}
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", color: "var(--muted2-landing)", fontSize: 13 }}>
          <Link href="/" style={{ color: "var(--gold)" }}>← Back to Home</Link>
        </div>

      </div>
    </div>
  );
}
