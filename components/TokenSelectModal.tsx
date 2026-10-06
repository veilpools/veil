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
    iconBg: "rgba(98, 126, 234, 0.1) text-slate-800",
    iconSvg: (
      <svg className="w-full h-full" viewBox="0 0 256 417" fill="none">
        <path d="M127.961 0L125.166 9.5V285.168L127.961 287.958L255.923 212.32L127.961 0Z" fill="#343434" />
        <path d="M127.962 0L0 212.32L127.962 287.958V157.252V0Z" fill="#8C8C8C" />
        <path d="M127.962 312.187L126.386 314.106V413.404L127.962 417L255.998 236.593L127.962 312.187Z" fill="#3C3C3B" />
        <path d="M127.962 417V312.187L0 236.593L127.962 417Z" fill="#8C8C8C" />
        <path d="M127.961 287.958L255.922 212.32L127.961 157.253V287.958Z" fill="#141414" />
        <path d="M0 212.32L127.962 287.958V157.253L0 212.32Z" fill="#393939" />
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
    iconBg: "rgba(236, 72, 153, 0.1) text-pink-600",
    iconSvg: (
      <svg className="w-full h-full" viewBox="0 0 256 417" fill="none">
        <path d="M127.961 0L125.166 9.5V285.168L127.961 287.958L255.923 212.32L127.961 0Z" fill="#EC4899" />
        <path d="M127.962 0L0 212.32L127.962 287.958V157.252V0Z" fill="#F472B6" />
        <path d="M127.962 312.187L126.386 314.106V413.404L127.962 417L255.998 236.593L127.962 312.187Z" fill="#BE185D" />
        <path d="M127.962 417V312.187L0 236.593L127.962 417Z" fill="#F472B6" />
        <path d="M127.961 287.958L255.922 212.32L127.961 157.253V287.958Z" fill="#9D174D" />
        <path d="M0 212.32L127.962 287.958V157.253L0 212.32Z" fill="#E11D48" />
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
    iconBg: "rgba(255, 140, 0, 0.15) text-[#FF8C00]",
    iconSvg: (
      <svg className="w-full h-full" viewBox="0 0 145 97" fill="none">
        <polygon points="0,0 26,0 66,74 106,0 132,0 79,97 53,97" fill="#FF8C00" />
        <circle cx="134" cy="85" r="11" fill="#FF8C00" />
      </svg>
    ),
  },
  {
    symbol: "PONS",
    name: "Pons Robinhood",
    address: "0x39dbed3a2bd333467115de45665cc57f813c4571",
    decimals: 18,
    balance: "12,450.00",
    priceUsd: 0.384,
    verified: true,
    isPoolSupported: true,
    poolDenomination: "1,000 PONS",
    badge: "Pons Launchpad",
    iconBg: "#ffffff",
    iconSvg: (
      <img src="/tokens/pons.png" alt="PONS" className="w-full h-full object-contain" />
    ),
  },
  {
    symbol: "QUANTA",
    name: "Quanta Pools",
    address: "0x1da81ca017949efbe07972776580d04592ba9b63",
    decimals: 18,
    balance: "850.00",
    priceUsd: 1.15,
    verified: true,
    isPoolSupported: true,
    poolDenomination: "100 QUANTA",
    badge: "Robinhood DeFi",
    iconBg: "#ffffff",
    iconSvg: (
      <img src="/tokens/quanta.png" alt="QUANTA" className="w-full h-full object-contain" />
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
    iconBg: "rgba(39, 117, 202, 0.15) text-[#2775CA]",
    iconSvg: (
      <svg className="w-full h-full" viewBox="0 0 2000 2000" fill="none">
        <circle cx="1000" cy="1000" r="1000" fill="#2775CA" />
        <path d="M1275 1158c0-129-77-173-230-192-107-14-129-37-129-87 0-48 37-79 104-79 64 0 99 24 116 71l108-45c-29-73-88-115-171-125V600h-90v100c-112 15-180 84-180 180 0 120 73 167 220 187 113 16 139 37 139 92 0 57-48 93-118 93-84 0-128-36-146-95l-111 43c31 92 98 143 205 156v104h90v-103c115-15 188-82 188-199z" fill="#FFFFFF" />
        <path d="M783 1485c-270-98-443-356-443-645 0-375 305-680 680-680 202 0 391 88 519 237l76-76C1476 177 1246 72 1000 72 488 72 72 488 72 1000c0 388 238 731 599 865l112-380z" fill="#FFFFFF" fillOpacity="0.4" />
        <path d="M1217 515c270 98 443 356 443 645 0 375-305 680-680 680-202 0-391-88-519-237l-76 76c139 144 369 249 615 249 512 0 928-416 928-928 0-388-238-731-599-865l-112 380z" fill="#FFFFFF" fillOpacity="0.4" />
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
    iconBg: "rgba(38, 161, 123, 0.15) text-[#26A17B]",
    iconSvg: (
      <svg className="w-full h-full" viewBox="0 0 2000 2000" fill="none">
        <circle cx="1000" cy="1000" r="1000" fill="#26A17B" />
        <path d="M1150 970v-83h318V733H532v154h318v83c-273 13-477 64-477 125s204 112 477 125v375h300v-375c272-13 475-64 475-125s-203-112-475-125zm0 193c-23 2-98 7-150 7s-127-5-150-7c-214-10-373-45-373-88s159-78 373-88c23-2 98-7 150-7s127 5 150 7c214 10 373 45 373 88s-159 78-373 88z" fill="#FFFFFF" />
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
                        width: "40px",
                        height: "40px",
                        borderRadius: "var(--radius-full)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        backgroundColor: "#ffffff",
                        border: "1px solid var(--color-border)",
                        boxShadow: "0 2px 5px rgba(26, 26, 26, 0.05)",
                        padding: "6px",
                        boxSizing: "border-box",
                        overflow: "hidden",
                      }}
                    >
                      <div style={{ width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {token.iconSvg}
                      </div>
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
                        ${((parseFloat(token.balance.replace(/,/g, "")) || 0) * token.priceUsd).toFixed(2)}
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
