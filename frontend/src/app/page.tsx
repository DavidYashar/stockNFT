"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import Link from "next/link";
import { useGOOGLonPrice } from "@/hooks/useGOOGLonPrice";
import { CONTRACT_ADDRESSES } from "@/lib/contracts";

export default function HomePage() {
  const { price: googlPrice, isLive } = useGOOGLonPrice();
  const [scrolled, setScrolled] = useState(false);
  const [mintedCount, setMintedCount] = useState(0);
  const [totalBurned, setTotalBurned] = useState(0);
  const [maxSupply, setMaxSupply] = useState(4_083);

  // Read live supply data from chain
  useEffect(() => {
    const p = new ethers.JsonRpcProvider(
      process.env.NEXT_PUBLIC_MAINNET_RPC || "https://eth-mainnet.g.alchemy.com/v2/demo"
    );
    async function load() {
      try {
        const nft = new ethers.Contract(
          CONTRACT_ADDRESSES.googleStockNFT,
          ["function totalSupply() view returns (uint256)", "function MAX_SUPPLY() view returns (uint256)"],
          p
        );
        const pm = new ethers.Contract(
          CONTRACT_ADDRESSES.platformManager,
          ["function totalBurned() view returns (uint256)"],
          p
        );
        const [ts, ms, tb] = await Promise.all([
          nft.totalSupply().catch(() => 0n),
          nft.MAX_SUPPLY().catch(() => 4083n),
          pm.totalBurned().catch(() => 0n),
        ]);
        setMintedCount(Number(ts));
        setMaxSupply(Number(ms));
        setTotalBurned(Number(tb));
      } catch {}
    }
    load();
  }, []);

  const effectiveMax = maxSupply - totalBurned;

  return (
    <div className="landing">
      {/* ===== NAV ===== */}
      <nav className={`landing-nav${scrolled ? " scrolled" : ""}`}>
        <div className="landing-nav-inner">
          <a href="/" className="landing-brand">
            <span className="landing-logo">
              <span className="landing-logo-dot d1" />
              <span className="landing-logo-dot d2" />
              <span className="landing-logo-dot d3" />
              <span className="landing-logo-dot d4" />
            </span>
            <span>Stock NFT</span>
          </a>
          <div className="landing-nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#faq">FAQ</a>
          </div>
          <Link href="/mint" className="landing-btn">
            Open App
          </Link>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section className="landing-hero">
        <div className="landing-container landing-hero-grid">
          <div>
            <div className="landing-eyebrow">
              <span className="landing-pulse" />
              RWA × NFT × DeFi on Ethereum
            </div>
            <h1>
              Tokenized Stocks<br />
              <span className="landing-gradient">Ownership via NFT.</span>
            </h1>
            <p className="landing-hero-copy">
              Google Stock NFT packages Google-linked exposure, DeFi yield,
              secondary-market liquidity, and a redemption-to-token flow into
              one programmable NFT certificate on Ethereum.
            </p>
            <div className="landing-hero-actions">
              <Link href="/mint" className="landing-btn">
                Mint G-Pass
              </Link>
              <a href="#how-it-works" className="landing-btn secondary">
                How It Works
              </a>
            </div>
            <p className="landing-micro">
              Tokenized stock ownership on Ethereum. GOOGLon is a
              mock token for testing. All values are simulated.
            </p>
          </div>

          {/* Pass Card */}
          <div className="landing-pass-wrap">
            <div className="landing-pass">
              <div className="landing-pass-top">
                <span className="landing-tag">GENESIS · G-PASS NFT</span>
                <div className="landing-google-dots">
                  <span className="landing-gdot g1" />
                  <span className="landing-gdot g2" />
                  <span className="landing-gdot g3" />
                  <span className="landing-gdot g4" />
                </div>
              </div>

              <h2 className="landing-pass-title">
                Stock-linked NFT
              </h2>
              <p className="landing-pass-sub">
                A 10,000-supply NFT issuance representing stock-linked exposure
                with a 3.9% target APY layer distributed via Aave.
              </p>

              <div className="landing-metrics">
                <div className="landing-metric">
                  <small>Mint Price</small>
                  <strong>10 USDC</strong>
                </div>
                <div className="landing-metric">
                  <small>Total Supply</small>
                  <strong>10,000</strong>
                </div>
                <div className="landing-metric">
                  <small>Target APY</small>
                  <strong className="landing-green">3.9%</strong>
                </div>
                <div className="landing-metric">
                  <small>Yield Claim</small>
                  <strong>Weekly</strong>
                </div>
              </div>

              <div className="landing-progress-wrap">
                <div className="landing-progress-head">
                  <span>Mint Progress</span>
                  <span><b>{mintedCount}</b> / {effectiveMax}</span>
                </div>
                <div className="landing-progress-bar">
                  <div className="landing-bar-fill" style={{
                    width: effectiveMax > 0 ? Math.min((mintedCount / effectiveMax) * 100, 100) + '%' : '0%',
                  }} />
                </div>
              </div>

              <div className="landing-pass-price">
                <span>GOOGL</span>
                <span className="landing-pass-price-val">
                  ${isLive ? googlPrice.toFixed(2) : "..."}
                </span>
                {isLive && <span className="landing-live-dot">● Live</span>}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section id="features" className="landing-section">
        <div className="landing-container">
          <div className="landing-section-head">
            <h3>Why Google Stock NFT?</h3>
            <p>
              A new interface for stock-linked assets: understandable like
              stocks, portable like NFTs, programmable like DeFi.
            </p>
          </div>
          <div className="landing-grid-3">
            {[
              { n: "01", title: "Stock-linked NFT", desc: "Each NFT represents fractional Google stock-linked exposure, replacing complex dashboards with one wallet-native asset." },
              { n: "02", title: "DeFi Yield Layer", desc: "3.9% target APR from Aave. 20% of every mint routes into DeFi — yield is claimable weekly." },
              { n: "03", title: "Principal Protection", desc: "80% of mint proceeds are reserved for the Google purchase pool. Your principal is shielded from yield strategies." },
              { n: "04", title: "Secondary Liquidity", desc: "Trade freely on any NFT marketplace. 10% royalty on every transfer feeds back into the purchase pool." },
              { n: "05", title: "Redeem to Token", desc: "After the bulk GOOGLon purchase triggers, redeem your NFT for real tokenized Google stock tokens minus a 5% fee." },
              { n: "06", title: "Genesis Identity", desc: "First 10,000 holders become Genesis Passport Holders — the founding community for tokenized stock ownership." },
            ].map((f) => (
              <div key={f.n} className="landing-card">
                <div className="landing-card-icon">{f.n}</div>
                <h4>{f.title}</h4>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section id="how-it-works" className="landing-section">
        <div className="landing-container">
          <div className="landing-section-head">
            <h3>Capital Flow Engine</h3>
            <p>Four steps from mint to redemption — fully on-chain.</p>
          </div>
          <div className="landing-asset-panel">
            <div className="landing-asset-left">
              <div className="landing-asset-title">
                <h3>Issuance Terms</h3>
                <span className="landing-pill-green">Genesis Launch</span>
              </div>
              {[
                ["Asset wrapper", "G-Pass NFT"],
                ["Underlying reference", "Google stock exposure"],
                ["Mint price", "10 USDC"],
                ["Supply cap", "10,000 NFTs"],
                ["Target APY", "3.9%"],
                ["Yield distribution", "Weekly claim"],
                ["Post-mint utility", "Trade / Claim / Redeem"],
              ].map(([label, value]) => (
                <div key={label} className="landing-row">
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>

            <div className="landing-asset-right">
              <div className="landing-asset-title">
                <h3>How It Works</h3>
                <span className="landing-pill-green">Principal Shield</span>
              </div>
              <div className="landing-flow">
                {[
                  { n: "1", title: "Mint and lock entry", desc: "Connect wallet, mint G-Pass for 10 USDC. 80% goes to Google purchase pool, 20% earns DeFi yield in Aave." },
                  { n: "2", title: "Exposure + yield layers", desc: "Capital is routed into stock-exposure layer and yield layer. Weekly interest accrues from Aave deposits." },
                  { n: "3", title: "Trade or hold", desc: "NFTs are fully transferable. List on marketplaces. 10% royalty on every secondary sale funds the purchase pool." },
                  { n: "4", title: "Redeem for GOOGLon", desc: "After mint ends and loyalty fees meet the 20% gap, the bulk GOOGLon purchase triggers. Redeem your NFT for real tokens." },
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
            </div>
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="landing-section">
        <div className="landing-container">
          <div className="landing-section-head">
            <h3>Designed for clarity.</h3>
            <p>Straight answers about the product.</p>
          </div>
          <div className="landing-faq">
            {[
              { q: "What does one G-Pass represent?", a: "One G-Pass is an NFT certificate for Google stock-linked exposure, plus a DeFi yield layer and redemption rights under protocol rules." },
              { q: "How does yield work?", a: "20% of mint proceeds are deposited into Aave v3. Yield accrues continuously and is distributed weekly to NFT holders via the Interest Distributor contract." },
              { q: "Can I trade the NFT?", a: "Yes. G-Pass is a standard ERC-721 token, fully transferable and listable on any NFT marketplace. A 10% royalty applies on secondary sales." },
              { q: "How does redemption work?", a: "After the Google purchase triggers, request redemption to burn your NFT. After a 48-hour delay, claim your GOOGLon tokens minus a 5% fee." },
              { q: "What is the 80/20 split?", a: "80% of your mint payment is reserved for the Google stock purchase. 20% is routed into Aave DeFi to generate yield. Both pools are verifiable on-chain." },
              { q: "When does the Google purchase happen?", a: "After minting ends AND loyalty fees from secondary trades reach 20% of total mint principal. The Treasury Vault then triggers the one-time bulk purchase." },
            ].map((faq, i) => (
              <details key={i} open={i === 0}>
                <summary>{faq.q}</summary>
                <p>{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="landing-section" style={{ textAlign: "center" }}>
        <div className="landing-container">
          <h3 style={{ fontSize: "clamp(34px, 4vw, 54px)", letterSpacing: "-0.055em", marginBottom: 16, fontWeight: 700 }}>
            Ready to get started?
          </h3>
          <p style={{ color: "var(--muted-landing)", fontSize: 18, marginBottom: 32 }}>
            Connect your wallet and mint your first Google Stock NFT on Ethereum mainnet.
          </p>
          <Link href="/mint" className="landing-btn" style={{ fontSize: 16, padding: "16px 48px" }}>
            Open App &amp; Mint
          </Link>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="landing-footer">
        <div className="landing-container landing-footer-inner">
          <div>
            <div className="landing-brand">
              <span className="landing-logo">
                <span className="landing-logo-dot d1" />
                <span className="landing-logo-dot d2" />
                <span className="landing-logo-dot d3" />
                <span className="landing-logo-dot d4" />
              </span>
              <span>Stock NFT</span>
            </div>
            <p>Tokenized stock ownership on Ethereum.</p>
          </div>
          <div>
            Not financial advice. Public
            launch requires legal review, securities compliance, custody
            integrations, and smart contract audits.
          </div>
        </div>
      </footer>
    </div>
  );
}
