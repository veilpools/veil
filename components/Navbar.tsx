"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, LogOut, Copy, Check, ChevronDown } from "lucide-react";
import { WalletModal } from "./WalletModal";
import { VeilLogo } from "./VeilLogo";
import { APP_CHAIN_ID, appChain } from "@/lib/chains";
import { fetchAllTokenBalances } from "@/lib/balances";
import { SUPPORTED_TOKENS } from "./TokenSelectModal";
import {
  EVM_WALLETS,
  loadWallet,
  clearWallet,
  subscribeWalletChange,
  silentEvmAccount,
  type EvmWalletId,
} from "@/lib/wallets";

export function Navbar() {
  const [wallet, setWallet] = useState<{ id: EvmWalletId; address: string } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [balancesLoading, setBalancesLoading] = useState(false);
  const walletMenuRef = useRef<HTMLDivElement>(null);

  // Close the wallet menu on outside click or Escape (standard disclosure).
  useEffect(() => {
    if (!isMenuOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (!walletMenuRef.current?.contains(e.target as Node)) setIsMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen || !wallet?.address) return;
    let cancelled = false;
    setBalancesLoading(true);
    fetchAllTokenBalances(wallet.address as `0x${string}`, SUPPORTED_TOKENS)
      .then((b) => {
        if (!cancelled) setBalances(b);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBalancesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isMenuOpen, wallet?.address]);

  useEffect(() => {
    const sync = () => {
      const saved = loadWallet();
      setWallet(saved);
      if (saved) {
        silentEvmAccount(saved.id).then((fresh) => {
          if (!fresh) {
            // disconnected in extension
            clearWallet();
          }
        });
      }
    };

    sync();
    const unsub = subscribeWalletChange(sync);
    return () => unsub();
  }, []);

  const handleCopy = () => {
    if (!wallet?.address) return;
    navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDisconnect = () => {
    clearWallet();
    setIsMenuOpen(false);
  };

  const walletMeta = wallet ? EVM_WALLETS.find((w) => w.id === wallet.id) : null;

  return (
    <>
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
              className="group"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-2)",
                padding: "6px 12px",
                borderRadius: "var(--radius-full)",
                backgroundColor: "rgba(26, 26, 26, 0.04)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
                textDecoration: "none",
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-body-sm)",
                fontWeight: 500,
                transition: "all var(--duration-fast) var(--ease-out)",
              }}
            >
              <ArrowLeft
                size={14}
                className="transition-transform duration-200 group-hover:-translate-x-0.5"
                style={{ color: "var(--color-muted)" }}
              />
              <span>Back to Home</span>
            </Link>

            <div
              style={{
                width: "1px",
                height: "18px",
                backgroundColor: "var(--color-border)",
                margin: "0 4px",
              }}
            />

            <VeilLogo href="/" size="md" />
          </div>

          {/* Right: Network Indicator & Multi-Wallet Connect */}
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", position: "relative" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "rgba(26, 26, 26, 0.04)",
                border: "1px solid var(--color-border)",
                fontFamily: "monospace",
                fontSize: "var(--text-caption)",
                color: "var(--color-text)",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: "#16a34a",
                }}
              />
              <span>Robinhood {APP_CHAIN_ID}</span>
            </div>

            {wallet ? (
              <div style={{ position: "relative" }} ref={walletMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  aria-haspopup="true"
                  aria-expanded={isMenuOpen}
                  aria-label={`Wallet ${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}, open account menu`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    backgroundColor: "#ffffff",
                    color: "var(--color-text)",
                    fontFamily: "monospace",
                    fontSize: "var(--text-body-sm)",
                    fontWeight: 600,
                    minHeight: "2.25rem",
                    padding: "0 12px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border-strong)",
                    boxShadow: "0 2px 6px rgba(26, 26, 26, 0.06)",
                    cursor: "pointer",
                    transition: "all var(--duration-fast)",
                  }}
                  className="hover:border-[#FF8C00]"
                >
                  {walletMeta && (
                    <img
                      src={walletMeta.icon}
                      alt={walletMeta.name}
                      width={18}
                      height={18}
                      style={{ borderRadius: "4px" }}
                    />
                  )}
                  <span>
                    {wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}
                  </span>
                  <ChevronDown size={14} className="text-neutral-400" />
                </button>

                {isMenuOpen && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "calc(100% + 8px)",
                      width: "250px",
                      backgroundColor: "#ffffff",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--color-border-strong)",
                      boxShadow: "0 12px 32px rgba(26, 26, 26, 0.12)",
                      padding: "6px",
                      zIndex: 50,
                    }}
                  >
                    <div
                      style={{
                        padding: "8px 10px",
                        fontSize: "11px",
                        fontFamily: "monospace",
                        color: "var(--color-muted)",
                        borderBottom: "1px solid var(--color-border)",
                        marginBottom: "4px",
                      }}
                    >
                      <div>Connected via {walletMeta?.name || "EVM Wallet"}</div>
                      <div style={{ marginTop: "2px", color: "var(--color-text)", fontWeight: 600 }}>
                        {appChain.name} ({APP_CHAIN_ID})
                      </div>
                    </div>

                    <div
                      style={{
                        padding: "4px 10px 8px 10px",
                        borderBottom: "1px solid var(--color-border)",
                        marginBottom: "4px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "2px",
                      }}
                    >
                      {balancesLoading ? (
                        <span style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--color-faint)" }}>
                          Loading balances…
                        </span>
                      ) : (
                        SUPPORTED_TOKENS.map((t) => (
                          <div
                            key={t.symbol}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: "11px",
                              fontFamily: "monospace",
                              color: "var(--color-text)",
                            }}
                          >
                            <span style={{ color: "var(--color-muted)" }}>{t.symbol}</span>
                            <span>{balances[t.symbol] ?? "—"}</span>
                          </div>
                        ))
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleCopy}
                      aria-label={copied ? "Address copied to clipboard" : "Copy wallet address"}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 10px",
                        borderRadius: "var(--radius-sm)",
                        border: "none",
                        backgroundColor: "transparent",
                        fontSize: "12px",
                        fontFamily: "var(--font-body)",
                        color: "var(--color-text)",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                      className="hover:bg-slate-50"
                    >
                      {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      <span>{copied ? "Address Copied!" : "Copy Address"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDisconnect}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 10px",
                        borderRadius: "var(--radius-sm)",
                        border: "none",
                        backgroundColor: "transparent",
                        fontSize: "12px",
                        fontFamily: "var(--font-body)",
                        color: "var(--color-danger-ink)",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                      className="hover:bg-red-50"
                    >
                      <LogOut size={14} aria-hidden="true" />
                      <span>Disconnect Wallet</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
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
                <span>Connect Wallet</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <WalletModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onPick={(_id, _addr) => {
          setIsModalOpen(false);
        }}
      />
    </>
  );
}
