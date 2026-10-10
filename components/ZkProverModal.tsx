"use client";

import React, { useState } from "react";
import {
  Loader2,
  Shield,
  ExternalLink,
  Download,
  X,
  CheckCircle2,
  Copy,
  Check,
} from "lucide-react";
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
  // Root-audit F9: the commitment is derived client-side BEFORE the receipt.
  // "Leaf Inserted" renders only when the caller confirms onchain insertion.
  committed?: boolean;
  onDownloadBackup?: () => void;
}

export const ZkProverModal: React.FC<ZkProverModalProps> = ({
  isOpen,
  onClose,
  title,
  steps,
  txHash,
  commitment,
  committed = false,
  onDownloadBackup,
}) => {
  const [copiedCommitment, setCopiedCommitment] = useState(false);
  const [copiedTx, setCopiedTx] = useState(false);
  const [showFullCommitment, setShowFullCommitment] = useState(false);

  const isAllCompleted = steps.length > 0 && steps.every((s) => s.status === "completed");

  const handleCopyCommitment = () => {
    if (!commitment) return;
    navigator.clipboard.writeText(commitment);
    setCopiedCommitment(true);
    setTimeout(() => setCopiedCommitment(false), 2000);
  };

  const handleCopyTx = () => {
    if (!txHash) return;
    navigator.clipboard.writeText(txHash);
    setCopiedTx(true);
    setTimeout(() => setCopiedTx(false), 2000);
  };

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
            className={isAllCompleted ? "zk-check-pop" : "zk-shield-breathe"}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "var(--radius-md)",
              backgroundColor: isAllCompleted
                ? "rgba(16, 185, 129, 0.12)"
                : "rgba(255, 140, 0, 0.12)",
              border: isAllCompleted
                ? "1px solid rgba(16, 185, 129, 0.3)"
                : "1px solid rgba(255, 140, 0, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isAllCompleted ? "#00c22d" : "var(--color-accent-ink)",
              transition: "all var(--duration-fast)",
              flexShrink: 0,
            }}
          >
            {isAllCompleted ? (
              <CheckCircle2 className="w-4 h-4 text-[#00c22d]" />
            ) : (
              <Shield className="w-4 h-4 text-[#FF8C00]" />
            )}
          </div>
          <div>
            <h2
              style={{
                margin: 0,
                fontFamily: "var(--font-headline)",
                fontSize: "var(--text-h4)",
                color: "var(--color-text)",
                fontWeight: 600,
                lineHeight: 1.25,
              }}
            >
              {isAllCompleted ? "Shielded Deposit Completed" : title}
            </h2>
            <p
              style={{
                margin: "1px 0 0 0",
                fontSize: "var(--text-caption)",
                fontFamily: "monospace",
                color: isAllCompleted ? "#00c22d" : "var(--color-muted)",
              }}
            >
              {isAllCompleted
                ? "0xbow Shield Verified · Note Sealed"
                : "Client-Side Prover · Cancun EVM"}
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
          className="hover:bg-neutral-100 hover:text-black"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Prover Steps Timeline */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          backgroundColor: "rgba(26, 26, 26, 0.025)",
          padding: "10px 12px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--color-border)",
        }}
      >
        {steps.map((step, index) => {
          const isCompleted = step.status === "completed";
          const isRunning = step.status === "running";
          const isLast = index === steps.length - 1;

          return (
            <div
              key={index}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "var(--space-2)",
                position: "relative",
                padding: "4px 6px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: isRunning ? "rgba(255, 140, 0, 0.04)" : "transparent",
                transition: "background-color 0.25s ease",
              }}
            >
              {/* Subtle vertical connector line */}
              {!isLast && (
                <div
                  style={{
                    position: "absolute",
                    left: "13px",
                    top: "22px",
                    bottom: "-6px",
                    width: "2px",
                    backgroundColor: isCompleted
                      ? "rgba(0, 194, 45, 0.35)"
                      : isRunning
                      ? "rgba(255, 140, 0, 0.35)"
                      : "rgba(26, 26, 26, 0.08)",
                    transition: "background-color 0.3s ease",
                    zIndex: 0,
                  }}
                />
              )}

              <div style={{ marginTop: "2px", flexShrink: 0, zIndex: 1 }}>
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-[#00c22d] zk-check-pop" />
                ) : isRunning ? (
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

              <div style={{ display: "flex", flexDirection: "column", gap: "1px", flex: 1, minWidth: 0, zIndex: 1 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "var(--text-body-sm)",
                    fontWeight: isRunning ? 700 : 600,
                    color: isCompleted
                      ? "var(--color-text)"
                      : isRunning
                      ? "var(--color-accent-ink)"
                      : "var(--color-faint)",
                    lineHeight: 1.3,
                  }}
                >
                  {step.title}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: "var(--text-caption)",
                    fontFamily: "monospace",
                    color: isRunning
                      ? "var(--color-text)"
                      : step.status === "pending"
                      ? "var(--color-faint)"
                      : "var(--color-muted)",
                    lineHeight: 1.4,
                  }}
                >
                  {step.detail}
                </p>
              </div>
            </div>
          );
        })}
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
            gap: "5px",
            fontSize: "var(--text-caption)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--color-muted)", fontWeight: 500 }}>
            <span>Commitment:</span>
            <span style={{ color: committed ? "#00c22d" : "var(--color-accent-ink)", fontFamily: "monospace", fontWeight: 600 }}>
              {committed ? "Leaf Inserted" : "Commitment Prepared"}
            </span>
          </div>

          <div
            style={{
              padding: "6px 8px",
              backgroundColor: "#ffffff",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
            }}
          >
            <div
              style={{
                fontFamily: "monospace",
                fontSize: "11px",
                color: "var(--color-text)",
                wordBreak: "break-all",
                userSelect: "all",
                flex: 1,
              }}
            >
              {showFullCommitment || commitment.length <= 28
                ? commitment
                : `${commitment.slice(0, 14)}••••${commitment.slice(-14)}`}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
              {commitment.length > 28 && (
                <button
                  type="button"
                  onClick={() => setShowFullCommitment(!showFullCommitment)}
                  title={showFullCommitment ? "Show shortened view" : "Show full value"}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "2px 6px",
                    fontSize: "10px",
                    fontFamily: "monospace",
                    color: "var(--color-muted)",
                    cursor: "pointer",
                  }}
                  className="hover:text-black hover:bg-neutral-50"
                >
                  {showFullCommitment ? "Hide" : "Full"}
                </button>
              )}

              <button
                type="button"
                onClick={handleCopyCommitment}
                title="Copy commitment"
                style={{
                  background: copiedCommitment ? "rgba(0, 194, 45, 0.1)" : "rgba(26, 26, 26, 0.04)",
                  border: copiedCommitment ? "1px solid rgba(0, 194, 45, 0.4)" : "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "2px 7px",
                  fontSize: "10.5px",
                  fontFamily: "monospace",
                  fontWeight: 600,
                  color: copiedCommitment ? "#00c22d" : "var(--color-text)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "3px",
                  transition: "all var(--duration-fast)",
                }}
                className="hover:bg-neutral-100"
              >
                {copiedCommitment ? (
                  <>
                    <Check className="w-3 h-3 text-[#00c22d]" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-neutral-500" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tx Explorer Output */}
      {txHash && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            borderRadius: "var(--radius-md)",
            backgroundColor: "rgba(255, 140, 0, 0.08)",
            border: "1px solid rgba(255, 140, 0, 0.3)",
            gap: "8px",
          }}
        >
          <a
            href={explorerTxUrl(txHash)}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: "var(--color-accent-ink)",
              textDecoration: "none",
              fontSize: "var(--text-body-sm)",
              fontFamily: "monospace",
              fontWeight: 600,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            className="hover:underline"
          >
            <span>Blockscout Tx: {txHash.slice(0, 14)}...</span>
            <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
          </a>

          <button
            type="button"
            onClick={handleCopyTx}
            title="Copy transaction hash"
            style={{
              background: "rgba(255, 140, 0, 0.12)",
              border: "1px solid rgba(255, 140, 0, 0.25)",
              borderRadius: "var(--radius-sm)",
              padding: "3px 6px",
              fontSize: "10.5px",
              fontFamily: "monospace",
              color: "var(--color-accent-ink)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "3px",
              flexShrink: 0,
            }}
            className="hover:bg-orange-100"
          >
            {copiedTx ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      )}

      {/* Action Buttons / Proving Notice */}
      <div style={{ display: "flex", gap: "var(--space-2)", paddingTop: "var(--space-1)" }}>
        {onDownloadBackup && isAllCompleted && (
          <button
            onClick={onDownloadBackup}
            type="button"
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
            className="hover:bg-neutral-100"
          >
            <Download className="w-3.5 h-3.5 text-[#FF8C00]" />
            <span>Backup Note (JSON)</span>
          </button>
        )}

        {isAllCompleted ? (
          <button
            onClick={onClose}
            type="button"
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
            className="hover:brightness-105 active:scale-[0.99]"
          >
            Done
          </button>
        ) : (
          <div
            style={{
              width: "100%",
              padding: "10px 12px",
              textAlign: "center",
              fontSize: "12px",
              fontFamily: "monospace",
              color: "var(--color-muted)",
              backgroundColor: "rgba(26, 26, 26, 0.02)",
              borderRadius: "var(--radius-sm)",
              border: "1px dashed var(--color-border)",
            }}
          >
            Generating proof client-side · Please keep this window open
          </div>
        )}
      </div>
    </ModalWrapper>
  );
};
