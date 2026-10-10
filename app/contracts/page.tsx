"use client";

import { useEffect, useState } from "react";
import type { Address } from "viem";
import { publicClient } from "@/lib/balances";
import { CONTRACT_ADDRESSES, CONTRACT_ABIS } from "@/lib/contracts";
import { appChain, APP_CHAIN_ID } from "@/lib/chains";

const EXPLORER = appChain.blockExplorers.default.url;

type AddressBook = Record<string, string>;

const BOOK = CONTRACT_ADDRESSES as unknown as AddressBook;

interface ContractRow {
  key: string;
  label: string;
  address: string;
  note?: string;
}

const ROWS: ContractRow[] = [
  {
    key: "router",
    label: "Veil Shield Router",
    address: BOOK.router || "0x01a05f87c2c227a1b382cbc2e7e63b186538c86d",
  },
  {
    key: "hook",
    label: "Veil Hook (Uniswap v4)",
    address: BOOK.hook || "0x9df0b52bf290a13e11c73c56c4c533e3887760c4",
  },
  {
    key: "poolEth",
    label: "Shielded Pool (ETH)",
    address: BOOK.poolEth || "0xdd0fb7fc7f1398fd1398a594f7a0ce934caa7ea0",
  },
  {
    key: "treasury",
    label: "Veil Treasury",
    address: BOOK.treasury || "0x8cd39f9195bd00b193a164f0790f3fc0dc4f3b34",
  },
  {
    key: "registry",
    label: "Attestation Registry",
    address: BOOK.registry || "0xa7f7e7887a4fa00cc934abe39cdd470cfdc9a855",
  },
  {
    key: "verifier",
    label: "Shielded Verifier",
    address: BOOK.verifier || "0x797e2aa1f3225ab38bfc6441a3f4b44e95158cda",
    note: "Provisional verifier (old notes only)",
  },
  {
    key: "deployer",
    label: "Create2 Deployer",
    address: BOOK.deployer || "0xe4c3615db1bdeaf7b82b5568bd73f20f5666f008",
  },
  {
    key: "token",
    label: "Veil Token (temporary)",
    address: BOOK.token || "0xe0e11ec0d62eda12de796d025d6334fadfe5ab2a",
    note: "Temporary token; canonical token launches on Pons",
  },
];

export default function ContractsPage() {
  const [permissions, setPermissions] = useState<Record<string, boolean> | null>(null);
  const [loading, setLoading] = useState(true);
  const [rpcError, setRpcError] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const hookRow = ROWS.find((r) => r.key === "hook");
        const perms = await publicClient.readContract({
          address: (hookRow ? hookRow.address : BOOK.hook) as Address,
          abi: CONTRACT_ABIS.VeilHook,
          functionName: "getHookPermissions",
        });
        if (mounted) {
          setPermissions({ ...(perms as unknown as Record<string, boolean>) });
          setLoading(false);
          setRpcError(false);
        }
      } catch (e) {
        console.warn("Contracts page read failed:", e);
        if (mounted) {
          setLoading(false);
          setRpcError(true);
        }
      }
    }
    load();
    const timer = setInterval(load, 15000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", width: "100%" }}>
      {/* Editorial Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: "var(--space-4)",
          paddingBottom: "var(--space-5)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--color-muted)",
              marginBottom: "var(--space-2)",
            }}
          >
            Robinhood {appChain.name} {APP_CHAIN_ID} // Smart Contracts
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-headline)",
              fontSize: "clamp(2rem, 3vw, 2.5rem)",
              lineHeight: 1.15,
              color: "var(--color-text)",
              letterSpacing: "-0.02em",
              fontWeight: 500,
            }}
          >
            Verified Contracts Registry
          </h1>
          <p
            style={{
              margin: "var(--space-2) 0 0 0",
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-body-sm)",
              color: "var(--color-muted)",
              maxWidth: "680px",
              lineHeight: "1.6",
            }}
          >
            Live smart contract deployments on Robinhood {appChain.name} ({APP_CHAIN_ID}).
            All bytecode, ABIs, and interfaces are verified on Blockscout and bound to immutable governance rules.
          </p>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "var(--space-3)",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            color: "var(--color-muted)",
          }}
        >
          <span>Solidity 0.8.26</span>
          <span style={{ opacity: 0.3 }}>/</span>
          <span>Cancun EVM</span>
          <span style={{ opacity: 0.3 }}>/</span>
          <span>Blockscout Verified</span>
        </div>
      </div>

      {/* Main 2-Column Workstation Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(480px, 100%), 1fr))",
          gap: "var(--space-6)",
          alignItems: "start",
          width: "100%",
        }}
      >
        {/* Column 1: Core Contracts List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-1)" }}>
            <span style={{ fontSize: "var(--text-caption)", fontWeight: 700, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono)" }}>
              Core Protocol Deployments ({ROWS.length})
            </span>
          </div>

          {ROWS.map((row) => (
            <div
              key={row.key}
              className="veil-card-white"
              style={{
                padding: "var(--space-5)",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--color-border)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3)",
                transition: "all var(--duration-fast)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-2)" }}>
                <div>
                  <div style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h4)", fontWeight: 600, color: "var(--color-text)" }}>
                    {row.label}
                  </div>
                  {row.note && (
                    <div style={{ marginTop: "4px" }}>
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: "11px",
                          color: "var(--color-accent)",
                          backgroundColor: "rgba(255, 140, 0, 0.08)",
                          border: "1px solid rgba(255, 140, 0, 0.2)",
                          borderRadius: "var(--radius-sm)",
                          padding: "2px 8px",
                          fontWeight: 500,
                        }}
                      >
                        {row.note}
                      </span>
                    </div>
                  )}
                </div>

                <a
                  href={`${EXPLORER}/address/${row.address}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "5px 12px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: "rgba(26, 26, 26, 0.04)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                    fontSize: "12px",
                    fontFamily: "var(--font-body)",
                    fontWeight: 600,
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  Blockscout ↗
                </a>
              </div>

              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "rgba(26, 26, 26, 0.025)",
                  border: "1px solid var(--color-border)",
                  fontFamily: "monospace",
                  fontSize: "12px",
                  color: "var(--color-text)",
                  overflowWrap: "anywhere",
                  wordBreak: "break-all",
                }}
              >
                {row.address}
              </div>
            </div>
          ))}
        </div>

        {/* Column 2: Hook Permissions & Architecture Details */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-1)" }}>
            <span style={{ fontSize: "var(--text-caption)", fontWeight: 700, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono)" }}>
              Uniswap v4 Hook Permissions
            </span>
          </div>

          <div
            className="veil-card-white"
            style={{
              padding: "var(--space-6)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-border-strong)",
              boxShadow: "0 4px 20px rgba(26, 26, 26, 0.04)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontFamily: "var(--font-headline)", fontSize: "var(--text-h3)", color: "var(--color-text)" }}>
                Hook Bitflags (Live Onchain)
              </h2>
              <p style={{ margin: "4px 0 0 0", fontSize: "var(--text-body-sm)", color: "var(--color-muted)", fontFamily: "var(--font-body)" }}>
                Verified bitmap permissions queried directly from <code>VeilHook.getHookPermissions()</code>.
              </p>
            </div>

            {loading && (
              <div style={{ padding: "var(--space-6)", textAlign: "center", color: "var(--color-muted)", fontFamily: "monospace", fontSize: "12px" }}>
                Reading live hook permissions…
              </div>
            )}
            {rpcError && (
              <div style={{ padding: "var(--space-4)", borderRadius: "var(--radius-sm)", backgroundColor: "rgba(180, 83, 9, 0.08)", color: "#b45309", fontFamily: "monospace", fontSize: "12px" }}>
                RPC unreachable, retrying…
              </div>
            )}

            {permissions && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {Object.entries(permissions).map(([flag, on]) => (
                  <div
                    key={flag}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: on ? "rgba(255, 140, 0, 0.06)" : "rgba(26, 26, 26, 0.02)",
                      border: on ? "1px solid rgba(255, 140, 0, 0.25)" : "1px solid var(--color-border)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontFamily: "monospace",
                      fontSize: "12px",
                    }}
                  >
                    <span style={{ color: "var(--color-text)", fontWeight: 500 }}>{flag}</span>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "11px",
                        fontWeight: 700,
                        backgroundColor: on ? "rgba(255, 140, 0, 0.15)" : "rgba(26, 26, 26, 0.06)",
                        color: on ? "var(--color-accent-ink)" : "var(--color-muted)",
                      }}
                    >
                      {String(on).toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Verification Pillar Card */}
          <div
            className="veil-card-white"
            style={{
              padding: "var(--space-6)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-border)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
            }}
          >
            <h3 style={{ margin: 0, fontFamily: "var(--font-headline)", fontSize: "var(--text-h4)", color: "var(--color-text)" }}>
              Blockscout Verification Mandate (§6.8)
            </h3>
            <p style={{ margin: 0, color: "var(--color-muted)", fontSize: "var(--text-body-sm)", lineHeight: 1.6, fontFamily: "var(--font-body)" }}>
              Per binding owner decision #15, no pool or router opens for active user deposits before its source code
              and ABI are verified on Blockscout. In the event of explorer verification delays, vendored source
              and byte-identical compilation proofs are permanently published in the repository.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
