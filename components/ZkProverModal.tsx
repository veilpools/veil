"use client";

import React from "react";
import { Loader2, Shield, ExternalLink, Download, X, CheckCircle2 } from "lucide-react";
import { ModalWrapper } from "./ModalWrapper";
import { explorerTxUrl } from "@/lib/chains";

export interface ZkProverStep {
  title: string;
  detail: string;
  status: "pending" | "running" | "completed";
}

interface ZkProverModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  steps: ZkProverStep[];
  txHash: string | null;
  commitment: string | null;
  onDownloadBackup?: () => void;
}

export const ZkProverModal: React.FC<ZkProverModalProps> = ({
  isOpen,
  onClose,
  title,
  steps,
  txHash,
  commitment,
  onDownloadBackup,
}) => {
  const isAllCompleted = steps.every((s) => s.status === "completed");

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="460px"
      ariaLabel={title}
      closeOnBackdropClick={isAllCompleted}
      closeOnEsc={isAllCompleted}
      contentStyle={{
        maxHeight: "92vh",
        overflowY: "auto",
        padding: "var(--space-4) var(--space-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
      }}
    >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--color-border)",
            paddingBottom: "var(--space-2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "rgba(255, 140, 0, 0.12)",
                border: "1px solid rgba(255, 140, 0, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-accent-ink)",
              }}
            >
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontFamily: "var(--font-headline)",
                  fontSize: "var(--text-h4)",
                  color: "var(--color-text)",
                  fontWeight: 600,
                }}
              >
                {title}
              </h2>
              <p
                style={{
                  margin: "1px 0 0 0",
                  fontSize: "var(--text-caption)",
                  fontFamily: "monospace",
                  color: "var(--color-muted)",
                }}
              >
                Client-Side Prover · Cancun EVM
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={
              isAllCompleted
                ? "Close prover modal"
                : "Hide prover progress — proving continues in the background"
            }
            title={
              isAllCompleted
                ? "Close"
                : "Hide — the proof keeps running and will reopen on completion"
            }
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
              flexShrink: 0,
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Prover Steps Timeline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
            backgroundColor: "rgba(26, 26, 26, 0.025)",
            padding: "10px 12px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border)",
          }}
        >
          {steps.map((step, index) => (
            <div key={index} style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-2)" }}>
              <div style={{ marginTop: "2px", flexShrink: 0 }}>
                {step.status === "completed" ? (
                  <CheckCircle2 className="w-4 h-4 text-[#00c22d]" />
                ) : step.status === "running" ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#FF8C00]" />
                ) : (
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "var(--radius-full)",
                      backgroundColor: "rgba(26, 26, 26, 0.2)",
                      marginTop: "4px",
                      marginLeft: "4px",
                    }}
                  />
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "var(--text-body-sm)",
                    fontWeight: 600,
                    color:
                      step.status === "completed"
                        ? "var(--color-text)"
                        : step.status === "running"
                        ? "var(--color-accent-ink)"
                        : "var(--color-faint)",
                  }}
                >
                  {step.title}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: "var(--text-caption)",
                    fontFamily: "monospace",
                    color:
                      step.status === "pending"
                        ? "var(--color-faint)"
                        : "var(--color-muted)",
                  }}
                >
                  {step.detail}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Commitment Output */}
        {commitment && (
          <div
            style={{
              padding: "8px 12px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "rgba(26, 26, 26, 0.03)",
              border: "1px solid var(--color-border)",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              fontSize: "var(--text-caption)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--color-muted)", fontWeight: 500 }}>
              <span>Commitment:</span>
              <span style={{ color: "var(--color-accent-ink)", fontFamily: "monospace", fontWeight: 600 }}>Leaf Inserted</span>
            </div>
            <div
              style={{
                padding: "6px 8px",
                backgroundColor: "#ffffff",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-border)",
                fontFamily: "monospace",
                fontSize: "11px",
                color: "var(--color-text)",
                wordBreak: "break-all",
                userSelect: "all",
              }}
            >
              {commitment}
            </div>
          </div>
        )}

        {/* Tx Explorer Output */}
        {txHash && (
          <a
            href={explorerTxUrl(txHash)}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "rgba(255, 140, 0, 0.08)",
              border: "1px solid rgba(255, 140, 0, 0.3)",
              color: "var(--color-accent-ink)",
              textDecoration: "none",
              fontSize: "var(--text-body-sm)",
              fontFamily: "monospace",
              fontWeight: 600,
            }}
          >
            <span>Blockscout Tx: {txHash.slice(0, 14)}...</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "var(--space-2)", paddingTop: "var(--space-2)" }}>
          {onDownloadBackup && isAllCompleted && (
            <button
              onClick={onDownloadBackup}
              style={{
                flex: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "var(--space-2)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-body-sm)",
                fontWeight: 600,
                minHeight: "2.6rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border-strong)",
                backgroundColor: "rgba(26, 26, 26, 0.04)",
                color: "var(--color-text)",
                cursor: "pointer",
                transition: "all var(--duration-fast)",
              }}
            >
              <Download className="w-3.5 h-3.5 text-[#FF8C00]" />
              <span>Backup Note (JSON)</span>
            </button>
          )}

          {isAllCompleted && (
            <button
              onClick={onClose}
              style={{
                flex: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-body-sm)",
                fontWeight: 600,
                minHeight: "2.6rem",
                borderRadius: "var(--radius-md)",
                border: "none",
                backgroundColor: "var(--color-accent)",
                color: "var(--color-accent-contrast)",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(255, 140, 0, 0.25)",
                transition: "all var(--duration-fast)",
              }}
            >
              Done
            </button>
          )}
        </div>
    </ModalWrapper>
  );
};
