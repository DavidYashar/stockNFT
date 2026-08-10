"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ADDRESSES } from "@/lib/contracts";
import Link from "next/link";

const TABS = [
  { href: "/mint", label: "Mint", icon: "add_circle" },
  { href: "/dashboard", label: "Portfolio", icon: "account_balance_wallet" },
  { href: "/redeem", label: "Redeem", icon: "swap_horiz" },
];

export default function DAppSidebar() {
  const pathname = usePathname();
  const { address } = useAccount();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isAdmin = mounted && address && address.toLowerCase() === ADDRESSES.treasury.toLowerCase();
  const tabs = isAdmin ? [...TABS, { href: "/admin", label: "Admin", icon: "settings" }] : TABS;

  return (
    <>
      {/* Mobile header */}
      <header className="dapp-mobile-header">
        <button className="dapp-menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
          <span className="material-icons-round">menu</span>
        </button>
        <Link href="/" className="dapp-mobile-logo">stockNFT</Link>
        <div className="dapp-mobile-wallet">
          <ConnectButton.Custom>
            {({ openConnectModal, account, chain, mounted: rdMounted }) => {
              if (!rdMounted) return <span style={{ fontSize: 12, opacity: 0.5 }}>Loading...</span>;
              if (!account) return <button onClick={openConnectModal} className="btn-connect" style={{ padding: "6px 14px", fontSize: 12 }}>Connect</button>;
              return <span style={{ fontSize: 12, color: "#CCFF00", fontFamily: "monospace" }}>{account.address.slice(0, 6)}...{account.address.slice(-4)}</span>;
            }}
          </ConnectButton.Custom>
        </div>
      </header>

      {/* Overlay */}
      {sidebarOpen && <div className="dapp-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`dapp-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="dapp-sidebar-header">
          <Link href="/" className="dapp-logo">⬡ stockNFT</Link>
          <button className="dapp-sidebar-close" onClick={() => setSidebarOpen(false)}>
            <span className="material-icons-round">close</span>
          </button>
        </div>

        <nav className="dapp-nav">
          {tabs.map(t => (
            <Link key={t.href} href={t.href}
              className={`dapp-nav-item ${pathname === t.href ? "active" : ""}`}
              onClick={() => setSidebarOpen(false)}>
              <span className="material-icons-round">{t.icon}</span>
              <span>{t.label}</span>
            </Link>
          ))}
        </nav>

        <div className="dapp-sidebar-footer">
          <ConnectButton.Custom>
            {({ openConnectModal, account, chain, mounted: rdMounted }) => {
              if (!rdMounted) return <button className="btn-connect" style={{ width: "100%" }} disabled>Loading...</button>;
              if (!account) return <button onClick={openConnectModal} className="btn-connect" style={{ width: "100%" }}>Connect Wallet</button>;
              return (
                <div className="dapp-wallet-info">
                  <span className="material-icons-round" style={{ color: "#CCFF00", fontSize: 10 }}>circle</span>
                  <span style={{ fontFamily: "monospace", fontSize: 11 }}>{account.address.slice(0, 6)}...{account.address.slice(-4)}</span>
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </aside>
    </>
  );
}
