"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAccount, useReadContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { CONTRACT_ADDRESSES } from "@/lib/contracts";

const PM_ABI = ["function owner() view returns (address)"];

export function NavLinks() {
  const { address } = useAccount();
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: pmOwner } = useReadContract({
    address: CONTRACT_ADDRESSES.platformManager as `0x${string}`,
    abi: PM_ABI,
    functionName: "owner",
  });

  const isAdmin = address && pmOwner && address.toLowerCase() === (pmOwner as string).toLowerCase();

  const links = [
    { href: "/", label: "Home" },
    { href: "/mint", label: "Mint" },
    { href: "/dashboard", label: "Portfolio" },
    { href: "/redeem", label: "Redeem" },
  ];

  if (isAdmin) {
    links.push({ href: "/admin", label: "Admin" });
  }

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const linkStyle = (isMobile?: boolean): React.CSSProperties => ({
    padding: isMobile ? '20px 0' : '10px 24px',
    borderRadius: 200,
    fontSize: isMobile ? 38 : 14,
    fontWeight: 500,
    textDecoration: 'none',
    color: isMobile ? '#fff' : 'var(--text-secondary)',
    transition: 'all var(--transition)',
    display: isMobile ? 'block' : 'inline-block',
    lineHeight: isMobile ? 1.2 : undefined,
  });

  return (
    <>
      {/* Desktop nav pill + wallet */}
      <div className="desktop-nav" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <nav style={{ display: 'flex', gap: 4, background: 'var(--bg-card)', borderRadius: 200, padding: 3, border: '1px solid var(--border)' }}>
          {links.map((link) => (
            <a key={link.href} href={link.href} className="nav-link" style={linkStyle()}>
              {link.label}
            </a>
          ))}
        </nav>
        <div style={{ minWidth: 160, display: 'flex', justifyContent: 'flex-end' }}>
          <ConnectButton.Custom>
            {({ openConnectModal, openAccountModal, openChainModal, account, chain, mounted }) => {
              const ready = mounted;
              const connected = ready && account && chain;

              const btnStyle: React.CSSProperties = {
                borderRadius: 200,
                fontSize: 14,
                fontWeight: 500,
                letterSpacing: 0.3,
                textTransform: 'uppercase',
                transition: 'all var(--transition)',
                background: 'var(--bg-card)',
                color: '#fff',
                border: '1px solid var(--border)',
                padding: '10px 24px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              };

              if (!ready) {
                return (
                  <button style={{ ...btnStyle, opacity: 0.5 }} disabled>
                    Loading...
                  </button>
                );
              }

              if (!connected) {
                return (
                  <button style={btnStyle} onClick={openConnectModal} type="button">
                    Connect Wallet
                  </button>
                );
              }

              // Show chain switcher if on wrong chain
              if (chain.unsupported) {
                return (
                  <button style={{ ...btnStyle, background: '#c0392b', borderColor: '#c0392b' }} onClick={openChainModal} type="button">
                    Wrong Network
                  </button>
                );
              }

              return (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button style={btnStyle} onClick={openChainModal} type="button">
                    {chain.hasIcon && chain.iconUrl ? (
                      <img src={chain.iconUrl} alt={chain.name ?? 'Chain'} style={{ width: 16, height: 16 }} />
                    ) : null}
                    {chain.name}
                  </button>
                  <button style={btnStyle} onClick={openAccountModal} type="button">
                    {account.displayName}
                  </button>
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </div>

      {/* Mobile hamburger button */}
      <button
        className="mobile-menu-btn"
        onClick={() => setMenuOpen(true)}
        aria-label="Open menu"
        style={{
          display: 'none',
          position: 'relative',
          width: 44,
          height: 44,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          zIndex: 1002,
          padding: 10,
          marginRight: -10,
        }}
      >
        <span style={{
          display: 'block', width: 24, height: 1.5,
          background: '#fff', borderRadius: 100,
          transition: 'all 0.3s ease',
          position: 'absolute', top: 14, left: 10,
        }} />
        <span style={{
          display: 'block', width: 24, height: 1.5,
          background: '#fff', borderRadius: 100,
          transition: 'all 0.3s ease',
          position: 'absolute', top: 21, left: 10,
        }} />
        <span style={{
          display: 'block', width: 24, height: 1.5,
          background: '#fff', borderRadius: 100,
          transition: 'all 0.3s ease',
          position: 'absolute', top: 28, left: 10,
        }} />
      </button>

      {/* Mobile full-screen overlay — rendered at body level via Portal */}
      {menuOpen && createPortal(
        <>
          {/* Blur layer */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9998,
              backdropFilter: 'blur(50px)',
              WebkitBackdropFilter: 'blur(50px)',
              background: 'transparent',
            }}
          />
          {/* Dark tint + content layer */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: 'rgba(10, 14, 39, 0.55)',
            }}
          >
            <button
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              style={{
                position: 'absolute',
                top: 16,
                right: '3%',
                width: 48,
                height: 48,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                zIndex: 10000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                color: '#fff',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
            <nav style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              width: '100%',
              padding: '0 10%',
            }}>
              {links.map((link, i) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="mobile-nav-link"
                  style={{
                    ...linkStyle(true),
                    textAlign: 'center',
                    animation: `fadeIn 0.4s ease ${i * 0.08}s both`,
                  }}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <div className="mobile-wallet" style={{ marginTop: 32, animation: `fadeIn 0.4s ease ${links.length * 0.08}s both` }}>
                <ConnectButton.Custom>
                  {({ openConnectModal, openAccountModal, openChainModal, account, chain, mounted }) => {
                    const ready = mounted;
                    const connected = ready && account && chain;

                    const mobileBtn: React.CSSProperties = {
                      display: 'block',
                      width: '100%',
                      padding: '20px 28px',
                      fontSize: 22,
                      fontWeight: 500,
                      textAlign: 'center',
                      background: 'var(--bg-card)',
                      color: '#fff',
                      border: '1px solid var(--border)',
                      borderRadius: 200,
                      cursor: 'pointer',
                      letterSpacing: 0.5,
                      transition: 'all var(--transition)',
                    };

                    if (!ready) return <div style={mobileBtn}>Loading...</div>;
                    if (!connected) return <button style={mobileBtn} onClick={openConnectModal} type="button">Connect Wallet</button>;
                    if (chain.unsupported) return <button style={{ ...mobileBtn, background: '#c0392b', borderColor: '#c0392b' }} onClick={openChainModal} type="button">Wrong Network</button>;

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <button style={mobileBtn} onClick={openChainModal} type="button">{chain.name}</button>
                        <button style={mobileBtn} onClick={openAccountModal} type="button">{account.displayName}</button>
                      </div>
                    );
                  }}
                </ConnectButton.Custom>
              </div>
            </nav>
          </div>
        </>,
        document.body
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: block !important; }
        }
        .mobile-nav-link:hover {
          color: var(--hover-accent) !important;
        }
      `}</style>
    </>
  );
}
