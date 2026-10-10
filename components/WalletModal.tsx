"use client";

import React, { useEffect, useState } from "react";
import { X, ExternalLink, Check, AlertCircle } from "lucide-react";
import { ModalWrapper } from "./ModalWrapper";
import { APP_CHAIN_ID, appChain } from "@/lib/chains";
import {
  EVM_WALLETS,
  connectEvm,
  detectEvm,
  walletLabel,
  onWalletsChanged,
  requestEip6963Providers,
  type EvmWalletId,
} from "@/lib/wallets";

export function WalletModal({
  open,
  onClose,
  onPick,
  ariaLabel = "Connect a wallet",
}: {
  open: boolean;
  onClose: () => void;
  onPick: (id: EvmWalletId, address: string) => void;
  ariaLabel?: string;
}) {
  const [detected, setDetected] = useState<EvmWalletId[]>([]);
  const [pending, setPending] = useState<EvmWalletId | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setErr("");
    setPending(null);

    const refresh = () => {
      setDetected(
        (EVM_WALLETS.map((w) => w.id) as EvmWalletId[]).filter((id) => detectEvm(id) !== null)
      );
    };

    refresh();
    requestEip6963Providers();

    const unsub = onWalletsChanged(refresh);
    const t1 = setTimeout(refresh, 80);
    const t2 = setTimeout(refresh, 300);

    return () => {
      unsub();
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [open]);

  async function pick(id: EvmWalletId) {
    if (!detectEvm(id)) return;
    setErr("");
    setPending(id);
    try {
      const { address } = await connectEvm(id);
      onPick(id, address);
      onClose();
    } catch (e: unknown) {
      setErr(walletLabel(e));
    } finally {
      setPending(null);
    }
  }

  return (
    <ModalWrapper
      isOpen={open}
      onClose={onClose}
      maxWidth="440px"
      ariaLabel={ariaLabel}
      contentStyle={{
        padding: "var(--space-6)",
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      }}
    >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "1.25rem",
                fontFamily: "var(--font-headline)",
                fontWeight: 600,
                color: "var(--color-text)",
              }}
            >
              Connect Wallet
            </h2>
            <span
              style={{
                fontSize: "11px",
                fontFamily: "monospace",
                color: "var(--color-muted)",
              }}
            >
              {appChain.name} ({APP_CHAIN_ID})
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              padding: "6px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border)",
              backgroundColor: "transparent",
              color: "var(--color-muted)",
              cursor: "pointer",
            }}
          >
            <X size={16} />
          </button>
        </div>

        <p
          style={{
            fontSize: "var(--text-body-sm)",
            color: "var(--color-muted)",
            margin: "0 0 var(--space-4)",
            lineHeight: "1.5",
          }}
        >
          Select an installed web3 wallet extension or mobile connector to interact with Robinhood privacy pools.
        </p>

        <p
          style={{
            fontSize: "11px",
            fontFamily: "monospace",
            color: "var(--color-faint)",
            margin: "0 0 var(--space-4)",
            lineHeight: "1.5",
          }}
        >
          Connection failing? Keep only one wallet extension enabled (disable the rest in chrome://extensions), then try again.
        </p>

        {/* Wallet list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {EVM_WALLETS.map((w) => {
            const installed = detected.includes(w.id);
            const busy = pending === w.id;

            return (
              <div key={w.id}>
                {installed ? (
                  <button
                    type="button"
                    onClick={() => pick(w.id)}
                    disabled={busy}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px 14px",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "rgba(26, 26, 26, 0.025)",
                      border: "1px solid var(--color-border)",
                      cursor: busy ? "wait" : "pointer",
                      transition: "all var(--duration-fast)",
                    }}
                    className="hover:border-[#FF8C00] hover:bg-[rgba(255,140,0,0.04)]"
                  >
                    <img
                      src={w.icon}
                      alt=""
                      width={28}
                      height={28}
                      style={{ borderRadius: "6px", flexShrink: 0 }}
                    />
                    <span
                      style={{
                        flex: 1,
                        textAlign: "left",
                        fontWeight: 600,
                        fontSize: "var(--text-body-sm)",
                        color: "var(--color-text)",
                      }}
                    >
                      {w.name}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontFamily: "monospace",
                        color: busy ? "var(--color-accent-ink)" : "var(--color-success-ink)",
                        backgroundColor: busy ? "rgba(255,140,0,0.1)" : "var(--color-success-bg)",
                        padding: "2px 8px",
                        borderRadius: "var(--radius-sm)",
                        fontWeight: 600,
                      }}
                    >
                      {busy ? "Confirming..." : "Detected"}
                    </span>
                  </button>
                ) : (
                  <a
                    href={w.installUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px 14px",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "rgba(26, 26, 26, 0.015)",
                      border: "1px dashed var(--color-border)",
                      color: "var(--color-muted)",
                      textDecoration: "none",
                      boxSizing: "border-box",
                      transition: "all var(--duration-fast)",
                    }}
                    className="hover:border-slate-400"
                  >
                    <img
                      src={w.icon}
                      alt=""
                      width={28}
                      height={28}
                      style={{ borderRadius: "6px", opacity: 0.6, flexShrink: 0 }}
                    />
                    <span
                      style={{
                        flex: 1,
                        textAlign: "left",
                        fontWeight: 500,
                        fontSize: "var(--text-body-sm)",
                        color: "var(--color-muted)",
                      }}
                    >
                      {w.name}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontFamily: "monospace",
                        color: "var(--color-faint)",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      Install <ExternalLink size={11} />
                    </span>
                  </a>
                )}
              </div>
            );
          })}
        </div>

        {err && (
          <div
            role="alert"
            style={{
              marginTop: "var(--space-4)",
              padding: "10px 12px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--color-danger-bg)",
              border: "1px solid var(--color-danger-border)",
              color: "var(--color-danger-ink)",
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <AlertCircle size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span>{err}</span>
          </div>
        )}
    </ModalWrapper>
  );
}
