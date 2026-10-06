"use client";

import React from "react";
import { X, Sliders, AlertTriangle, Shield } from "lucide-react";
import { ModalWrapper } from "./ModalWrapper";

interface SlippageSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  slippage: string;
  setSlippage: (val: string) => void;
  deadlineMinutes: string;
  setDeadlineMinutes: (val: string) => void;
}

export const SlippageSettingsModal: React.FC<SlippageSettingsModalProps> = ({
  isOpen,
  onClose,
  slippage,
  setSlippage,
  deadlineMinutes,
  setDeadlineMinutes,
}) => {
  const isHighSlippage = parseFloat(slippage) > 1.5;

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="420px"
      contentStyle={{
        padding: "var(--space-6)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-5)",
      }}
    >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--color-border)",
            paddingBottom: "var(--space-3)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <Sliders className="w-4 h-4 text-[#FF8C00]" />
            <span style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h4)", color: "var(--color-text)", fontWeight: 600 }}>
              Execution Settings
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings"
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
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Slippage tolerance */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "var(--text-body-sm)" }}>
            <span style={{ color: "var(--color-muted)", fontWeight: 500 }}>Slippage Tolerance</span>
            <span style={{ color: "var(--color-accent)", fontFamily: "monospace", fontWeight: 600 }}>{slippage}%</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-2)" }}>
            {["0.1", "0.5", "1.0"].map((s) => (
              <button
                key={s}
                onClick={() => setSlippage(s)}
                style={{
                  padding: "8px 0",
                  borderRadius: "var(--radius-sm)",
                  fontFamily: "monospace",
                  fontSize: "var(--text-body-sm)",
                  cursor: "pointer",
                  fontWeight: 600,
                  transition: "all var(--duration-fast)",
                  border:
                    slippage === s
                      ? "1px solid var(--color-accent)"
                      : "1px solid var(--color-border)",
                  backgroundColor:
                    slippage === s
                      ? "rgba(255, 140, 0, 0.15)"
                      : "rgba(26, 26, 26, 0.04)",
                  color: slippage === s ? "var(--color-accent)" : "var(--color-text)",
                }}
              >
                {s}%
              </button>
            ))}
            <div style={{ position: "relative" }}>
              <input
                type="number"
                step="0.1"
                placeholder="Custom"
                value={["0.1", "0.5", "1.0"].includes(slippage) ? "" : slippage}
                onChange={(e) => setSlippage(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 0",
                  textAlign: "center",
                  backgroundColor: "rgba(26, 26, 26, 0.04)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--color-border-strong)",
                  fontSize: "var(--text-body-sm)",
                  fontFamily: "monospace",
                  color: "var(--color-text)",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {isHighSlippage && (
            <div
              style={{
                padding: "var(--space-3)",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "rgba(255, 140, 0, 0.1)",
                border: "1px solid rgba(255, 140, 0, 0.3)",
                fontSize: "var(--text-caption)",
                color: "var(--color-accent)",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
              }}
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>High slippage may expose your swap to greater price variance.</span>
            </div>
          )}
        </div>

        {/* Transaction Deadline */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "var(--text-body-sm)" }}>
            <span style={{ color: "var(--color-muted)", fontWeight: 500 }}>Transaction Deadline</span>
            <span style={{ color: "var(--color-text)", fontFamily: "monospace", fontWeight: 600 }}>{deadlineMinutes} mins</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <input
              type="number"
              value={deadlineMinutes}
              onChange={(e) => setDeadlineMinutes(e.target.value)}
              style={{
                width: "80px",
                padding: "8px",
                backgroundColor: "rgba(26, 26, 26, 0.04)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-border-strong)",
                fontSize: "var(--text-body-sm)",
                fontFamily: "monospace",
                color: "var(--color-text)",
                textAlign: "center",
                outline: "none",
              }}
            />
            <span style={{ fontSize: "var(--text-caption)", color: "var(--color-muted)" }}>
              minutes before automatic revert
            </span>
          </div>
        </div>

        {/* Router Invariant guarantee */}
        <div
          style={{
            padding: "var(--space-3)",
            borderRadius: "var(--radius-md)",
            backgroundColor: "rgba(26, 26, 26, 0.03)",
            border: "1px solid var(--color-border)",
            fontSize: "var(--text-caption)",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--color-accent)", fontWeight: 600 }}>
            <Shield className="w-3.5 h-3.5 text-[#FF8C00]" />
            <span>Router Invariant Protection</span>
          </div>
          <p style={{ margin: 0, color: "var(--color-muted)", lineHeight: "var(--leading-body-sm)" }}>
            VeilShieldRouter enforces atomic 0-balance settlement. If slippage bounds are exceeded, 100% of user funds revert safely.
          </p>
        </div>

        <button
          onClick={onClose}
          className="lp-btn lp-btn--accent"
          style={{
            width: "100%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "2.75rem",
            borderRadius: "var(--radius-md)",
            border: "none",
            backgroundColor: "var(--color-accent)",
            color: "var(--color-accent-contrast)",
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-body-sm)",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Save &amp; Close
        </button>
    </ModalWrapper>
  );
};
