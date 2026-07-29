"use client";

import { useState } from "react";
import Link from "next/link";
import "./doc.css";

const SECTIONS = [
  { id: "what-is", label: "What Is Google Stock NFT?" },
  { id: "how-it-works", label: "How It Works" },
  { id: "tokens", label: "Token Information" },
  { id: "network", label: "Add Robinhood Chain" },
  { id: "participate", label: "How to Participate" },
  { id: "certificate", label: "NFT Certificate" },
  { id: "phases", label: "Phases Summary" },
  { id: "faq", label: "FAQ" },
  { id: "links", label: "Resources" },
];

export default function DocPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleNav = (id: string) => {
    // Only close sidebar on mobile (≤900px)
    if (window.innerWidth <= 900) setSidebarOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="doc-shell">
      {/* ─── Header ─── */}
      <header className="doc-header">
        <Link href="/" className="doc-logo-link">
          <img src="/logo.jpg" alt="stockNFT" className="doc-logo" />
          <span className="doc-brand">stockNFT</span>
        </Link>
        <nav className="doc-nav">
          <Link href="/">Home</Link>
          <Link href="/app">DAPP</Link>
        </nav>
      </header>

      {/* ─── Content ─── */}
      {/* Mobile sidebar toggle — outside main so it sticks properly */}
      <button
        className={`doc-sidebar-toggle${sidebarOpen ? " open" : ""}`}
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        On this page
      </button>
      {/* Mobile sidebar dropdown */}
      <aside className={`doc-sidebar doc-sidebar--mobile${sidebarOpen ? " open" : ""}`}>
        <h4>Contents</h4>
        {SECTIONS.map(s => (
          <a key={s.id} href={`#${s.id}`} onClick={(e) => { e.preventDefault(); handleNav(s.id); }}>
            {s.label}
          </a>
        ))}
      </aside>

      <main className="doc-main">
        {/* Desktop sidebar — always visible */}
        <aside className="doc-sidebar doc-sidebar--desktop">
          <h4>Contents</h4>
          {SECTIONS.map(s => (
            <a key={s.id} href={`#${s.id}`} onClick={(e) => { e.preventDefault(); handleNav(s.id); }}>
              {s.label}
            </a>
          ))}
        </aside>

        <article className="doc-content">
          <h1>User Guide</h1>
          <p className="doc-subtitle">
            Google Stock NFT V3 · Robinhood Chain (Arbitrum Orbit L2)
          </p>

          {/* ═══ What Is ═══ */}
          <section id="what-is">
            <h2>What Is Google Stock NFT?</h2>
            <p>
              Google Stock NFT lets you own a fraction of <strong>Alphabet Class A (GOOGL)</strong> stock
              through a single NFT. Each NFT represents:
            </p>
            <ul>
              <li><strong>$4 worth of GOOGL stock</strong> — held in your NFT&apos;s own smart wallet</li>
              <li><strong>$1 worth of PILE tokens</strong> — airdropped to every holder</li>
              <li><strong>Total value per NFT:</strong> $5.00</li>
            </ul>
            <p>
              No brokerage account. No six-figure minimum. Just connect your wallet and mint.
            </p>
          </section>

          {/* ═══ How It Works ═══ */}
          <section id="how-it-works">
            <h2>How It Works</h2>
            <div className="doc-flow">
              <div className="doc-flow-step">
                <span className="doc-flow-num">1</span>
                <strong>You Mint an NFT</strong>
                <p>Pay 4 or 6 USDG depending on phase</p>
              </div>
              <div className="doc-flow-arrow">→</div>
              <div className="doc-flow-step">
                <span className="doc-flow-num">2</span>
                <strong>Smart Wallet Created</strong>
                <p>ERC-6551 Token Bound Account (TBA) deployed</p>
              </div>
              <div className="doc-flow-arrow">→</div>
              <div className="doc-flow-step">
                <span className="doc-flow-num">3</span>
                <strong>PILE + GOOGL Held Inside</strong>
                <p>Assets sit in your TBA until claimed</p>
              </div>
              <div className="doc-flow-arrow">→</div>
              <div className="doc-flow-step">
                <span className="doc-flow-num">4</span>
                <strong>Claim &amp; Withdraw</strong>
                <p>Move tokens to your wallet. NFT becomes a collectible.</p>
              </div>
            </div>
            <p>
              Every NFT has its own <strong>ERC-6551 Token Bound Account (TBA)</strong> — a smart
              wallet that holds your PILE tokens and GOOGL shares. Only you (the NFT owner) can
              access it.
            </p>
          </section>

          {/* ═══ Token Information ═══ */}
          <section id="tokens">
            <h2>Token Information</h2>
            <h3>Mainnet Addresses</h3>
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Address</th>
                  <th>Decimals</th>
                  <th>Purpose</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>USDG</strong></td>
                  <td><code>0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168</code></td>
                  <td>6</td>
                  <td>Stablecoin for mint payment</td>
                </tr>
                <tr>
                  <td><strong>GOOGL</strong></td>
                  <td><code>0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3</code></td>
                  <td>18</td>
                  <td>Alphabet Class A stock token</td>
                </tr>
                <tr>
                  <td><strong>PILE</strong></td>
                  <td>Announced at launch</td>
                  <td>6</td>
                  <td>Airdrop token for all holders</td>
                </tr>
              </tbody>
            </table>

            <h3>NFTs</h3>
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Detail</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Collection</td><td>Google Stock NFT (GSNFT)</td></tr>
                <tr><td>Standard</td><td>ERC-721</td></tr>
                <tr><td>Max Supply</td><td>4,083</td></tr>
                <tr><td>WL Price</td><td>4 USDG</td></tr>
                <tr><td>Public Price</td><td>6 USDG</td></tr>
              </tbody>
            </table>
          </section>

          {/* ═══ Add Chain ═══ */}
          <section id="network">
            <h2>Add Robinhood Chain to Your Wallet</h2>
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Setting</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr><td><strong>Network Name</strong></td><td>Robinhood Chain</td></tr>
                <tr><td><strong>Chain ID</strong></td><td><code>4663</code></td></tr>
                <tr><td><strong>Currency Symbol</strong></td><td>ETH</td></tr>
                <tr><td><strong>RPC URL</strong></td><td><code>https://rpc.mainnet.chain.robinhood.com</code></td></tr>
                <tr><td><strong>Block Explorer</strong></td><td><code>https://robinhoodchain.blockscout.com</code></td></tr>
              </tbody>
            </table>
            <p className="doc-note">
              💡 You need ETH for gas fees. ETH on Robinhood Chain functions like ETH on Ethereum —
              tiny fees per transaction (~$0.01).
            </p>

            <h3>Getting USDG</h3>
            <p>USDG is the native stablecoin on Robinhood Chain. You can acquire it through:</p>
            <ul>
              <li><strong>Robinhood Crypto</strong> — on/off ramp</li>
              <li><strong>Uniswap</strong> — swap ETH for USDG</li>
            </ul>
          </section>

          {/* ═══ How to Participate ═══ */}
          <section id="participate">
            <h2>How to Participate</h2>

            <h3>Step 1: Whitelist (Early Access)</h3>
            <p>Whitelisted users mint at <strong>4 USDG</strong> instead of 6 USDG.</p>
            <ol>
              <li>Go to the DAPP → <strong>Whitelist</strong> tab</li>
              <li>Connect your wallet</li>
              <li>Complete these tasks on Twitter/X:
                <ul>
                  <li>Follow our account</li>
                  <li>Like &amp; Retweet the project tweet</li>
                  <li>Comment on the project tweet</li>
                  <li>Post the required tweet from the template shown</li>
                </ul>
              </li>
              <li>Fill in your <strong>Twitter username</strong>, <strong>retweet link</strong>, and <strong>tweet link</strong></li>
              <li>Your wallet address is filled automatically</li>
              <li>Click <strong>Submit</strong></li>
            </ol>
            <p className="doc-note">
              ⚠️ One wallet = one whitelist entry. One Twitter account = one wallet. No duplicates.
            </p>
            <p>After the submission period ends, we verify all entries and publish the whitelist.</p>

            <h3>Step 2: Mint</h3>
            <ol>
              <li>Go to the DAPP → <strong>Mint</strong> tab</li>
              <li>If whitelisted, you&apos;ll see &quot;Whitelist · 4 USDG/share&quot;</li>
              <li>Click <strong>Mint Stock NFT</strong></li>
              <li>Approve the USDG transaction in your wallet</li>
              <li>Your NFT arrives with a unique on-chain certificate</li>
            </ol>

            <h3>Step 3: Claim PILE</h3>
            <ol>
              <li>Go to <strong>Portfolio</strong> tab</li>
              <li>Find your NFT</li>
              <li>Click <strong>Claim $PILE</strong></li>
              <li>PILE tokens are sent to your NFT&apos;s smart wallet</li>
            </ol>

            <h3>Step 4: Claim GOOGL</h3>
            <ol>
              <li>Go to <strong>Portfolio</strong> tab</li>
              <li>Find your NFT</li>
              <li>Click <strong>Claim GOOGL</strong></li>
              <li>GOOGL shares are sent to your NFT&apos;s smart wallet</li>
            </ol>

            <h3>Step 5: Withdraw</h3>
            <ol>
              <li>In Portfolio, click on your NFT to open details</li>
              <li>Use <strong>Withdraw PILE</strong> and <strong>Withdraw GOOGL</strong></li>
              <li>After both are withdrawn, your NFT becomes a <strong>soulbound collectible</strong> — it stays in your wallet forever as proof of ownership</li>
            </ol>
          </section>

          {/* ═══ Certificate ═══ */}
          <section id="certificate">
            <h2>NFT Certificate</h2>
            <p>Every NFT has a unique on-chain SVG certificate showing:</p>
            <ul>
              <li>Token ID</li>
              <li>GOOGL shares held</li>
              <li>PILE value ($1.00)</li>
              <li>GOOGL price at mint (live oracle)</li>
              <li>Mint date</li>
              <li>Your TBA smart account address</li>
              <li>Network: Robinhood Chain</li>
            </ul>
            <p className="doc-note">
              No external image hosting — everything lives on-chain.
            </p>
          </section>

          {/* ═══ Phases ═══ */}
          <section id="phases">
            <h2>Phases Summary</h2>
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Phase</th>
                  <th>What Happens</th>
                </tr>
              </thead>
              <tbody>
                <tr><td><strong>Whitelist Mint</strong></td><td>1,500 NFTs at 4 USDG (2-hour window, Merkle proof)</td></tr>
                <tr><td><strong>Public Mint</strong></td><td>Remaining 2,583 NFTs at 6 USDG (open to all)</td></tr>
                <tr><td><strong>Mint Ends</strong></td><td>No more NFTs minted</td></tr>
                <tr><td><strong>LP Creation</strong></td><td>PILE/USDG liquidity pool created on Uniswap V3</td></tr>
                <tr><td><strong>PILE Airdrop</strong></td><td>50% of PILE distributed to all NFT holders</td></tr>
                <tr><td><strong>GOOGL Purchase</strong></td><td>Pool80 USDG swapped for GOOGL on Uniswap</td></tr>
                <tr><td><strong>GOOGL Claims</strong></td><td>Holders claim proportional GOOGL shares</td></tr>
                <tr><td><strong>Soulbound</strong></td><td>After full redemption, NFT becomes non-transferable</td></tr>
              </tbody>
            </table>
          </section>

          {/* ═══ FAQ ═══ */}
          <section id="faq">
            <h2>FAQ</h2>

            <details className="doc-faq">
              <summary>Can I sell my NFT before claiming?</summary>
              <p>Yes. Before claiming both PILE and GOOGL, your NFT is fully transferable and can be listed on any NFT marketplace.</p>
            </details>

            <details className="doc-faq">
              <summary>What happens after I claim everything?</summary>
              <p>Your NFT becomes soulbound — it can&apos;t be transferred or sold. It stays in your wallet as a permanent certificate proving you owned the stock assets.</p>
            </details>

            <details className="doc-faq">
              <summary>How is the GOOGL price determined?</summary>
              <p>GOOGL is a tokenized stock on Robinhood Chain that tracks Alphabet&apos;s real stock price via oracles.</p>
            </details>

            <details className="doc-faq">
              <summary>What&apos;s PILE worth?</summary>
              <p>PILE gets its initial price from the Uniswap V3 liquidity pool. The DAPP shows the live market cap and price.</p>
            </details>

            <details className="doc-faq">
              <summary>Is this audited?</summary>
              <p>Our contracts are built on OpenZeppelin&apos;s audited libraries. A full security audit report is available upon request.</p>
            </details>
          </section>

          {/* ═══ Links ═══ */}
          <section id="links">
            <h2>Links</h2>
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Resource</th>
                  <th>URL</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Explorer</td><td><a href="https://robinhoodchain.blockscout.com" target="_blank" rel="noopener noreferrer">robinhoodchain.blockscout.com</a></td></tr>
                <tr><td>Robinhood Chain Docs</td><td><a href="https://docs.robinhood.com/chain" target="_blank" rel="noopener noreferrer">docs.robinhood.com/chain</a></td></tr>
              </tbody>
            </table>
          </section>

          <p className="doc-footer-text">In Chain We Trust — Google Stock NFT</p>
        </article>
      </main>
    </div>
  );
}
