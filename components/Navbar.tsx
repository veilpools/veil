"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function Navbar() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && (window as unknown as { ethereum?: { selectedAddress?: string } }).ethereum) {
      const eth = (window as unknown as { ethereum: { selectedAddress?: string } }).ethereum;
      if (eth.selectedAddress) {
        setWalletAddress(eth.selectedAddress);
      }
    }
  }, []);

  async function handleConnectWallet() {
    if (typeof window !== "undefined" && (window as unknown as { ethereum?: { request: (args: { method: string }) => Promise<string[]> } }).ethereum) {
      try {
        const eth = (window as unknown as { ethereum: { request: (args: { method: string }) => Promise<string[]> } }).ethereum;
        const accounts = await eth.request({ method: "eth_requestAccounts" });
        if (accounts && accounts[0]) {
          setWalletAddress(accounts[0]);
        }
      } catch (e) {
        console.error("User rejected wallet connection", e);
      }
    } else {
      alert("Please install MetaMask or Rabby Wallet to interact with Veil on Robinhood Chain.");
    }
  }

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        width: "100%",
        backgroundColor: "transparent",
        borderBottom: "1px solid rgba(26, 26, 26, 0.06)",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: "var(--page-max)",
          margin: "0 auto",
          padding: "0 var(--page-gutter)",
          height: "68px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxSizing: "border-box",
        }}
      >
        {/* Left: Back Button & Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <Link
            href="/"
            title="Return to Landing Page"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              borderRadius: "var(--radius-full)",
              backgroundColor: "rgba(255, 255, 255, 0.65)",
              border: "1px solid var(--color-border-strong)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              color: "var(--color-text)",
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-body-sm)",
              fontWeight: 600,
              textDecoration: "none",
              transition: "all var(--duration-fast) var(--ease-out)",
              boxShadow: "0 2px 6px rgba(26, 26, 26, 0.04)",
            }}
          >
            <ArrowLeft className="w-4 h-4 text-[#FF8C00]" />
            <span>Back to Home</span>
          </Link>

          <div
            style={{
              width: "1px",
              height: "22px",
              backgroundColor: "var(--color-border-strong)",
              opacity: 0.7,
            }}
          />

          <Link href="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
            <img
              src="/assets/figma/logo.svg"
              alt="Veil Protocol"
              style={{
                height: "24px",
                width: "auto",
                display: "block",
              }}
            />
          </Link>
        </div>

        {/* Right Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <div
            className="hidden sm:inline-flex"
            style={{
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "rgba(26, 26, 26, 0.06)",
              border: "var(--border-thin) solid var(--color-border)",
              fontFamily: "monospace",
              fontSize: "var(--text-caption)",
              color: "var(--color-text)",
            }}
          >
            <span>Robinhood Mainnet 4663</span>
          </div>

          <button
            onClick={handleConnectWallet}
            className="lp-btn lp-btn--filled"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-2)",
              backgroundColor: "var(--color-text)",
              color: "var(--color-bg)",
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-body-sm)",
              fontWeight: 500,
              minHeight: "2.25rem",
              padding: "0 var(--space-4)",
              borderRadius: "var(--radius-md)",
              border: "none",
              cursor: "pointer",
              transition: "all var(--duration-fast) var(--ease-out)",
              whiteSpace: "nowrap",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path d="M12 12h.01" />
              <path d="M17 12h.01" />
              <path d="M7 12h.01" />
            </svg>
            <span>
              {walletAddress
                ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                : "Connect Wallet"}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
