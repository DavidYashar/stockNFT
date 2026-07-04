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
            <img src="/logo.jpg" alt="StockNFT" style={{ width: 38, height: 38, borderRadius: 12 }} />
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
              G-Pass NFT records your Google share amount at mint and adds a
              3.5% stablecoin yield layer. If Google rises, redemption captures
              the stock upside; if Google falls, the yield helps offset the decline.
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
              Your recorded Google share amount does not change after mint,
              no matter how Google price moves. All values are simulated.
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
                Google Share NFT
              </h2>
              <p className="landing-pass-sub">
                A 4,083-supply NFT issuance that records the Google share amount
                at mint and adds a 3.5% stablecoin yield layer.
              </p>

              <div className="landing-metrics">
                <div className="landing-metric">
                  <small>Mint Price</small>
                  <strong>10 USDC</strong>
                </div>
                <div className="landing-metric">
                  <small>Total Supply</small>
                  <strong>4,083</strong>
                </div>
                <div className="landing-metric">
                  <small>Target APY</small>
                  <strong className="landing-green">3.5%</strong>
                </div>
                <div className="landing-metric">
                  <small>Share Amount</small>
                  <strong>Fixed</strong>
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
            <h3>Why G-Pass NFT?</h3>
            <p>
              Two core benefits: a fixed Google share amount recorded at mint,
              plus a 3.5% stablecoin yield layer designed to add steady income
              on top of the stock exposure.
            </p>
          </div>
          <div className="landing-grid-3">
            {[
              { n: "01", title: "Fixed Google Shares", desc: "When you mint, the protocol converts your ETH payment into its current USDC value and divides it by the current Google price. That becomes your recorded Google share amount — and it stays fixed after mint." },
              { n: "02", title: "Stock Upside Exposure", desc: "If Google rises after mint, you benefit from the increase because redemption is based on your fixed recorded share amount multiplied by the current Google price." },
              { n: "03", title: "3.5% Stablecoin Yield", desc: "In addition to your recorded Google share amount, each NFT receives a 3.5% stablecoin yield layer. If Google price falls, this yield can help offset part of the decline." },
              { n: "04", title: "Secondary Liquidity", desc: "G-Pass NFTs can trade freely after mint begins. The recorded Google share amount and stablecoin yield rights follow the NFT when transferred. 10% royalty on every secondary sale." },
              { n: "05", title: "Redeem in ETH", desc: "After all NFTs are minted and the redemption mechanism opens, holders may redeem. The protocol calculates shares × current Google price, converts into ETH, and returns it minus a 5% management fee." },
              { n: "06", title: "Genesis Identity", desc: "First 4,083 holders become Genesis Passport Holders — the founding community for Google share NFTs with stablecoin yield." },
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
            <h3>How G-Pass Works</h3>
            <p>Four simple steps: mint, lock your Google share amount, earn stablecoin yield, then redeem in ETH after redemption opens.</p>
          </div>
          <div className="landing-asset-panel">
            <div className="landing-asset-left">
              <div className="landing-asset-title">
                <h3>Issuance Terms</h3>
                <span className="landing-pill-green">Genesis Launch</span>
              </div>
              {[
                ["Asset wrapper", "G-Pass NFT"],
                ["Underlying reference", "Google share exposure"],
                ["Mint price", "10 USDC worth of ETH"],
                ["Supply cap", "4,083 NFTs"],
                ["Share basis", "ETH → USDC → Google shares"],
                ["Share formula", "ETH value in USDC ÷ Google price"],
                ["Target APY", "3.5%"],
                ["Yield layer", "3.5% stablecoin yield"],
                ["Fees", "10% trading royalty / 5% redemption fee"],
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
                <span className="landing-pill-green">Fixed Shares</span>
              </div>
              <div className="landing-flow">
                {[
                  { n: "1", title: "Mint G-Pass", desc: "Connect wallet and mint one G-Pass. At mint, the protocol converts the ETH payment into its current USDC value and records your Google share amount." },
                  { n: "2", title: "Record Google shares", desc: "Your Google share amount = USDC value of your ETH ÷ current Google price. This recorded share amount stays fixed after mint and remains attached to your NFT." },
                  { n: "3", title: "Trade or hold", desc: "G-Pass NFTs are fully transferable. List on marketplaces. 10% royalty on every secondary sale. Your fixed recorded Google share amount and yield rights follow the NFT." },
                  { n: "4", title: "Redeem in ETH", desc: "After all NFTs are minted and redemption opens, redeem anytime. Protocol calculates shares × Google price, converts to ETH, and returns it minus a 5% fee." },
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
              { q: "What does one G-Pass represent?", a: "One G-Pass is an NFT certificate that records a fixed Google share amount. At mint, the protocol converts your ETH payment into USDC, divides it by the current Google price, and records the resulting share amount inside the NFT. After mint, that share amount does not change." },
              { q: "How does yield work?", a: "Each NFT is designed to receive a 3.5% stablecoin yield layer in addition to its fixed recorded Google share amount. This gives holders stablecoin income while keeping Google stock exposure." },
              { q: "Can I trade the NFT?", a: "Yes. G-Pass is a transferable ERC-721 token. Once mint starts, minted NFTs may enter secondary markets. The recorded Google share amount and yield rights remain attached to the NFT. Secondary trades carry a 10% royalty." },
              { q: "How is the Google share amount calculated?", a: "The formula is: current USDC value of your ETH payment ÷ current Google price. This means the NFT records the Google share amount corresponding to the full mint value. Once recorded, the share amount stays fixed." },
              { q: "How is redemption handled?", a: "After all NFTs are minted and the redemption mechanism opens, holders may redeem at any time. The protocol calculates fixed recorded Google shares × current Google price, converts into ETH, and returns it minus a 5% management fee. If Google is higher, you capture the upside; if lower, the stablecoin yield helps offset the decline." },
              { q: "Is this financial advice?", a: "No. This is an experimental protocol. All values are simulated. Past performance does not guarantee future results. Always do your own research." },
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
            Mint Google share exposure with one NFT.
          </h3>
          <p style={{ color: "var(--muted-landing)", fontSize: 18, marginBottom: 32 }}>
            Mint G-Pass, lock your Google share amount, receive a 3.5% stablecoin yield layer, and redeem in ETH after redemption opens.
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
              <img src="/logo.jpg" alt="StockNFT" style={{ width: 38, height: 38, borderRadius: 12 }} />
              <span>G-pass</span>
            </div>
            <p>Fixed Google share NFTs with stablecoin yield on Ethereum.</p>
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
