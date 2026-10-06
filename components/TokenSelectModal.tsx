"use client";

import React, { useState, useEffect } from "react";
import { Search, X, Check, ShieldCheck } from "lucide-react";

import { ModalWrapper } from "./ModalWrapper";

export interface TokenItem {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  balance: string;
  priceUsd: number;
  verified: boolean;
  isPoolSupported: boolean;
  poolDenomination?: string;
  badge?: string;
  iconBg: string;
  iconSvg: React.ReactNode;
}

export const SUPPORTED_TOKENS: TokenItem[] = [
  {
    symbol: "ETH",
    name: "Native Ether",
    address: "0x0000000000000000000000000000000000000000",
    decimals: 18,
    balance: "1.428",
    priceUsd: 3240.5,
    verified: true,
    isPoolSupported: true,
    poolDenomination: "0.001 ETH",
    badge: "Native Gas",
    iconBg: "rgba(255, 255, 255, 0.1) text-white",
    iconSvg: (
      <svg className="w-5 h-5" viewBox="0 0 784.37 1277.39" fill="currentColor">
        <polygon fill="#fff" points="392.07 0 383.5 29.11 383.5 873.74 392.07 882.29 784.13 650.54 392.07 0" />
        <polygon fill="#c0c0c0" points="392.07 0 0 650.54 392.07 882.29 392.07 472.33 392.07 0" />
        <polygon fill="#fff" points="392.07 956.52 387.24 962.41 387.24 1263.28 392.07 1277.38 784.37 724.89 392.07 956.52" />
        <polygon fill="#c0c0c0" points="392.07 1277.38 392.07 956.52 0 724.89 392.07 1277.38" />
        <polygon fill="#909090" points="392.07 882.29 784.13 650.54 392.07 472.33 392.07 882.29" />
        <polygon fill="#606060" points="0 650.54 392.07 882.29 392.07 472.33 0 650.54" />
      </svg>
    ),
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    address: "0x4200000000000000000000000000000000000006",
    decimals: 18,
    balance: "0.850",
    priceUsd: 3240.5,
    verified: true,
    isPoolSupported: true,
    poolDenomination: "0.001 ETH",
    badge: "Canonical v4",
    iconBg: "rgba(255, 140, 0, 0.15) text-[#FF8C00] border border-[rgba(255,140,0,0.3)]",
    iconSvg: (
      <svg className="w-5 h-5" viewBox="0 0 784.37 1277.39" fill="currentColor">
        <polygon points="392.07 0 383.5 29.11 383.5 873.74 392.07 882.29 784.13 650.54 392.07 0" />
        <polygon points="392.07 0 0 650.54 392.07 882.29 392.07 472.33 392.07 0" />
        <polygon points="392.07 956.52 387.24 962.41 387.24 1263.28 392.07 1277.38 784.37 724.89 392.07 956.52" />
        <polygon points="392.07 1277.38 392.07 956.52 0 724.89 392.07 1277.38" />
      </svg>
    ),
  },
  {
    symbol: "VEIL",
    name: "Veil Protocol Token",
    address: "0x1b631ab61b99b364e3a880bd43adfe1b665bce16",
    decimals: 18,
    balance: "15,200.00",
    priceUsd: 0.185,
    verified: true,
    isPoolSupported: true,
    poolDenomination: "1,000 VEIL",
    badge: "Protocol Token",
    iconBg: "rgba(255, 140, 0, 0.2) text-[#FF8C00]",
    iconSvg: (
      <span className="font-bold font-mono text-sm tracking-tighter text-[#FF8C00]">V</span>
    ),
  },
  {
    symbol: "PONS",
    name: "Pons Robinhood",
    address: "0x96B21dBc3022933C40a1B7D10d86E3A3e47e8711",
    decimals: 18,
    balance: "38,500.00",
    priceUsd: 0.042,
    verified: true,
    isPoolSupported: true,
    poolDenomination: "10,000 PONS",
    badge: "Pons Launchpad",
    iconBg: "rgba(16, 185, 129, 0.15) text-emerald-600",
    iconSvg: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="11" fill="#10B981" />
        <path d="M8.5 17V7H13.5C15.433 7 17 8.567 17 10.5C17 12.433 15.433 14 13.5 14H11V17H8.5Z" fill="white" />
      </svg>
    ),
  },
  {
    symbol: "QNTA",
    name: "Quanta Network",
    address: "0x7F219cD094896e0534C08c1A77519Ac0F9f21d62",
    decimals: 18,
    balance: "920.00",
    priceUsd: 1.15,
    verified: true,
    isPoolSupported: true,
    poolDenomination: "100 QNTA",
    badge: "Robinhood DeFi",
    iconBg: "rgba(99, 102, 241, 0.15) text-indigo-600",
    iconSvg: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="11" fill="#6366F1" />
        <path d="M12 7C9.24 7 7 9.24 7 12C7 14.76 9.24 17 12 17C13.25 17 14.39 16.54 15.28 15.78L16.29 16.79C16.49 16.99 16.8 16.99 17 16.79C17.2 16.59 17.2 16.27 17 16.08L15.96 15.04C16.61 14.18 17 13.13 17 12C17 9.24 14.76 7 12 7ZM12 9C13.66 9 15 10.34 15 12C15 13.66 13.66 15 12 15C10.34 15 9 13.66 9 12C9 10.34 10.34 9 12 9Z" fill="white" />
      </svg>
    ),
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x2A2C6C1B14C5D65C13D75D5F00C81F78A86BC8C1",
    decimals: 6,
    balance: "1,245.50",
    priceUsd: 1.0,
    verified: true,
    isPoolSupported: true,
    poolDenomination: "100 USDC",
    badge: "Fiat Stable",
    iconBg: "rgba(37, 99, 235, 0.15) text-blue-600",
    iconSvg: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="11" fill="#2563EB" />
        <path d="M12 6.5C8.96 6.5 6.5 8.96 6.5 12C6.5 15.04 8.96 17.5 12 17.5C15.04 17.5 17.5 15.04 17.5 12" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M12 8.5V15.5M10.2 10.2C10.2 9.5 11 9 12 9C13 9 13.8 9.5 13.8 10.4C13.8 11.8 10.2 11.2 10.2 12.8C10.2 13.8 11 14.5 12 14.5C13 14.5 13.8 14 13.8 13.2" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    address: "0x55d398326f99059fF775485246999027B3197955",
    decimals: 6,
    balance: "650.00",
    priceUsd: 1.0,
    verified: true,
    isPoolSupported: true,
    poolDenomination: "100 USDT",
    badge: "Stablecoin",
    iconBg: "rgba(13, 148, 136, 0.15) text-teal-600",
    iconSvg: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="11" fill="#0D9488" />
        <path d="M7.5 9H16.5M12 9V17M9 12.5C9 14 10.3 14.8 12 14.8C13.7 14.8 15 14 15 12.5C15 11 13.7 10.2 12 10.2C10.3 10.2 9 11 9 12.5Z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

interface TokenSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectToken: (token: TokenItem) => void;
  selectedSymbol: string;
}

export const TokenSelectModal: React.FC<TokenSelectModalProps> = ({
  isOpen,
  onClose,
  onSelectToken,
  selectedSymbol,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = SUPPORTED_TOKENS.filter(
    (t) =>
      t.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="460px"
      contentStyle={{
        maxHeight: "85vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
        {/* Header */}
        <div
          style={{
            padding: "var(--space-4) var(--space-5)",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h4)", color: "var(--color-text)", fontWeight: 600 }}>
              Select a Token
            </span>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "11px",
                padding: "2px 8px",
                borderRadius: "var(--radius-sm)",
                background: "rgba(255, 140, 0, 0.12)",
                border: "1px solid rgba(255, 140, 0, 0.3)",
                color: "var(--color-accent)",
                fontWeight: 600,
              }}
            >
              Robinhood 4663
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close token selector"
            style={{
              background: "rgba(26, 26, 26, 0.05)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              padding: "6px",
              color: "var(--color-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all var(--duration-fast)",
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: "var(--space-4) var(--space-5)", borderBottom: "1px solid var(--color-border)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search className="w-4 h-4" style={{ position: "absolute", left: "14px", color: "var(--color-faint)", pointerEvents: "none" }} />
            <input
              type="text"
              placeholder="Search by name, symbol, or paste address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                paddingLeft: "42px",
                paddingRight: "16px",
                paddingTop: "11px",
                paddingBottom: "11px",
                backgroundColor: "rgba(26, 26, 26, 0.04)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border-strong)",
                fontSize: "var(--text-body-sm)",
                color: "var(--color-text)",
                outline: "none",
                boxSizing: "border-box",
                fontFamily: "var(--font-body)",
                transition: "border-color var(--duration-fast)",
              }}
              autoFocus
            />
          </div>

          {/* Quick Select Chips */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            {SUPPORTED_TOKENS.map((token) => (
              <button
                key={token.symbol}
                onClick={() => {
                  onSelectToken(token);
                  onClose();
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "5px 10px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "var(--text-caption)",
                  fontFamily: "monospace",
                  cursor: "pointer",
                  fontWeight: 600,
                  transition: "all var(--duration-fast)",
                  border:
                    selectedSymbol === token.symbol
                      ? "1px solid var(--color-accent)"
                      : "1px solid var(--color-border)",
                  backgroundColor:
                    selectedSymbol === token.symbol
                      ? "rgba(255, 140, 0, 0.15)"
                      : "rgba(26, 26, 26, 0.04)",
                  color: selectedSymbol === token.symbol ? "var(--color-accent)" : "var(--color-text)",
                }}
              >
                <span>{token.symbol}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Token List */}
        <div style={{ overflowY: "auto", flex: 1, padding: "var(--space-2)" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "var(--space-8) 0", textAlign: "center", fontSize: "var(--text-body-sm)", color: "var(--color-muted)" }}>
              No matching tokens found on Robinhood Chain.
            </div>
          ) : (
            filtered.map((token) => {
              const isSelected = selectedSymbol === token.symbol;
              return (
                <button
                  key={token.symbol}
                  onClick={() => {
                    onSelectToken(token);
                    onClose();
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "var(--radius-md)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    textAlign: "left",
                    backgroundColor: isSelected ? "rgba(255, 140, 0, 0.12)" : "transparent",
                    border: "none",
                    cursor: "pointer",
                    transition: "background var(--duration-fast)",
                    boxSizing: "border-box",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "var(--radius-md)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        backgroundColor: "rgba(26, 26, 26, 0.06)",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      {token.iconSvg}
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontWeight: 600, color: "var(--color-text)", fontSize: "var(--text-body-sm)" }}>{token.symbol}</span>
                        {token.verified && (
                          <ShieldCheck className="w-3.5 h-3.5 text-[#FF8C00]" />
                        )}
                        {token.badge && (
                          <span
                            style={{
                              fontSize: "10px",
                              fontFamily: "monospace",
                              padding: "1px 6px",
                              borderRadius: "var(--radius-sm)",
                              backgroundColor: "rgba(26, 26, 26, 0.06)",
                              color: "var(--color-muted)",
                            }}
                          >
                            {token.badge}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: "var(--text-caption)", color: "var(--color-muted)", display: "block" }}>{token.name}</span>
                    </div>
                  </div>

                  <div style={{ textAlign: "right", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <div>
                      <div style={{ fontSize: "var(--text-body-sm)", fontFamily: "monospace", fontWeight: 600, color: "var(--color-text)" }}>
                        {token.balance}
                      </div>
                      <div style={{ fontSize: "var(--text-caption)", color: "var(--color-faint)", fontFamily: "monospace" }}>
                        ${((parseFloat(token.balance.replace(/,/g, "")) || 0) * token.priceUsd).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[#FF8C00]" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div
          style={{
            padding: "var(--space-3) var(--space-4)",
            backgroundColor: "rgba(26, 26, 26, 0.03)",
            borderTop: "1px solid var(--color-border)",
            fontSize: "var(--text-caption)",
            color: "var(--color-muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>Shielded Pool Denominations Supported</span>
          <span style={{ color: "var(--color-accent)", fontFamily: "monospace", fontWeight: 600 }}>LeanIMT Verified</span>
        </div>
    </ModalWrapper>
  );
};
