"use client";

import { useEffect, useState } from "react";
import type { Address } from "viem";
import { publicClient } from "@/lib/balances";
import { CONTRACT_ADDRESSES, CONTRACT_ABIS } from "@/lib/contracts";

const EXPLORER = "https://explorer.mainnet.chain.robinhood.com";

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
    address: BOOK.router || "0xdce5cf65038f092c283449fda44e23d8820d717f",
  },
  {
    key: "hook",
    label: "Veil Hook (Uniswap v4)",
    address: BOOK.hook || "0x5b2e52fe4f54327d8272327d12e47cba834360c4",
  },
  {
    key: "poolEth",
    label: "Shielded Pool (ETH)",
    address: BOOK.poolEth || "0x3c4700360e23aa2d4671605f35e0fa1d354bc41b",
  },
  {
    key: "treasury",
    label: "Veil Treasury",
    address: BOOK.treasury || "0x1b631ab61b99b364e3a880bd43adfe1b665bce16",
  },
  {
    key: "registry",
    label: "Attestation Registry",
    address: BOOK.registry || "0x411fb0c695152ea02ef48b96940c2b2fef656b7c",
  },
  {
    key: "verifier",
    label: "Shielded Verifier",
    address: BOOK.verifier || "0x12b20b346342d2fc5272f0f708bcd5abaac480fb",
    note: "Provisional verifier",
  },
  {
    key: "deployer",
    label: "Create2 Deployer",
    address: BOOK.deployer || "0x3d1613651c366ce53fd64bada154d1b951b9233f",
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
    <main style={{ padding: "var(--space-12) var(--page-gutter)", maxWidth: "960px", margin: "0 auto" }}>
      <h1
        style={{
          margin: "0 0 var(--space-2) 0",
          fontFamily: "var(--font-headline)",
          fontSize: "var(--text-h2)",
          color: "var(--color-text)",
        }}
      >
        Verified Contracts Registry
      </h1>
      <p
        style={{
          margin: "0 0 var(--space-8) 0",
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-body)",
          color: "var(--color-muted)",
        }}
      >
        Live Robinhood Mainnet 4663 deployments. Every address links to the block explorer.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {ROWS.map((row) => (
          <div
            key={row.key}
            style={{
              padding: "var(--space-4) var(--space-5)",
              borderRadius: "var(--radius-md)",
              backgroundColor: "#ffffff",
              border: "1px solid var(--color-border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "var(--space-2)",
            }}
          >
            <div>
              <div style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h4)", color: "var(--color-text)" }}>
                {row.label}
                {row.note && (
                  <span
                    style={{
                      marginLeft: "8px",
                      fontFamily: "monospace",
                      fontSize: "11px",
                      color: "var(--color-accent)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-sm)",
                      padding: "2px 8px",
                    }}
                  >
                    {row.note}
                  </span>
                )}
              </div>
              <div style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--color-muted)", marginTop: "4px" }}>
                {row.address}
              </div>
            </div>
            <a
              href={`${EXPLORER}/address/${row.address}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "var(--color-accent)", fontWeight: 600 }}
            >
              View on explorer
            </a>
          </div>
        ))}
      </div>

      <h2
        style={{
          margin: "var(--space-10) 0 var(--space-3) 0",
          fontFamily: "var(--font-headline)",
          fontSize: "var(--text-h3)",
          color: "var(--color-text)",
        }}
      >
        Hook permissions (live)
      </h2>
      {loading && (
        <p style={{ fontFamily: "monospace", fontSize: "var(--text-body-sm)", color: "var(--color-muted)" }}>
          Loading live state…
        </p>
      )}
      {rpcError && (
        <p style={{ fontFamily: "monospace", fontSize: "var(--text-body-sm)", color: "#b45309" }}>
          RPC unreachable, retrying…
        </p>
      )}
      {permissions && (
        <div
          style={{
            padding: "var(--space-4) var(--space-5)",
            borderRadius: "var(--radius-md)",
            backgroundColor: "#ffffff",
            border: "1px solid var(--color-border)",
            fontFamily: "monospace",
            fontSize: "12px",
            color: "var(--color-text)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "4px 16px",
          }}
        >
          {Object.entries(permissions).map(([flag, on]) => (
            <div key={flag}>
              {flag}: {String(on)}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
