"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { CONTRACT_ADDRESSES } from "@/lib/contracts";
import Link from "next/link";

function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({ openConnectModal, openAccountModal, openChainModal, account, chain, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        if (!ready) {
          return <span className="landing-btn secondary" style={{ opacity: 0.5, cursor: 'default' }}>Loading...</span>;
        }

        if (!connected) {
          return <button onClick={openConnectModal} className="landing-btn" type="button">Connect Wallet</button>;
        }

        if (chain?.unsupported) {
          return <button onClick={openChainModal} className="landing-btn secondary" type="button">Wrong network</button>;
        }

        return (
          <button onClick={openAccountModal} className="landing-btn secondary" type="button">
            {account.ensName ?? `${account.address.slice(0, 6)}...${account.address.slice(-4)}`}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}

export function AppHeader() {
  const pathname = usePathname();
  const { address } = useAccount();
  const [menuOpen, setMenuOpen] = useState(false);

  const deployerAddr = CONTRACT_ADDRESSES.deployerAddress?.toLowerCase();
  const treasuryAddr = (CONTRACT_ADDRESSES.treasuryVaultAddress || CONTRACT_ADDRESSES.treasuryEOA)?.toLowerCase();
  const userAddr = address?.toLowerCase();

  const showAdmin = !!(userAddr && (userAddr === deployerAddr || userAddr === treasuryAddr));

  const isHome = pathname === "/";

  const links = [
    { href: "/mint", label: "Mint" },
    { href: "/dashboard", label: "Portfolio" },
    { href: "/redeem", label: "Redeem" },
    { href: "/docs", label: "Docs" },
  ];

  if (showAdmin) {
    links.push({ href: "/admin", label: "Admin" });
  }

  // Lock body scroll when mobile menu open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <header className="landing-nav" style={{ position: 'sticky', top: 0, zIndex: 50, display: isHome ? 'none' : undefined }}>
        <div className="landing-nav-inner">
          <Link href="/" className="landing-brand">
            <span className="landing-logo">
              <span className="landing-logo-dot d1" />
              <span className="landing-logo-dot d2" />
              <span className="landing-logo-dot d3" />
              <span className="landing-logo-dot d4" />
            </span>
            <span>Stock NFT</span>
          </Link>

          {/* Desktop nav links */}
          <div className="landing-nav-links">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  color: pathname === link.href ? 'var(--text-landing)' : 'var(--muted-landing)',
                  fontWeight: pathname === link.href ? 700 : 600,
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop wallet + Hamburger */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="app-header-wallet">
              <WalletButton />
            </div>

            <button
              className="app-hamburger"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              type="button"
            >
              <span className={`app-hamburger-line${menuOpen ? " open" : ""}`} />
              <span className={`app-hamburger-line${menuOpen ? " open" : ""}`} />
              <span className={`app-hamburger-line${menuOpen ? " open" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {menuOpen && (
        <div className="app-mobile-menu" onClick={() => setMenuOpen(false)}>
          <div className="app-mobile-menu-panel" onClick={(e) => e.stopPropagation()}>
            <nav className="app-mobile-nav">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="app-mobile-nav-link"
                  style={{
                    color: pathname === link.href ? 'var(--text-landing)' : 'var(--muted-landing)',
                    fontWeight: pathname === link.href ? 700 : 500,
                  }}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="app-mobile-wallet">
              <WalletButton />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
