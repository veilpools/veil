"use client";

import React, { useEffect, useRef, useState } from "react";

interface ModalWrapperProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
  className?: string;
  contentStyle?: React.CSSProperties;
  closeOnBackdropClick?: boolean;
  closeOnEsc?: boolean;
  /** Accessible name announced for the dialog (WCAG 4.1.2). */
  ariaLabel?: string;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const ModalWrapper: React.FC<ModalWrapperProps> = ({
  isOpen,
  onClose,
  children,
  maxWidth = "460px",
  className = "",
  contentStyle = {},
  closeOnBackdropClick = true,
  closeOnEsc = true,
  ariaLabel,
}) => {
  const [mounted, setMounted] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const lastActiveRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      lastActiveRef.current = document.activeElement as HTMLElement | null;
      setMounted(true);
      setIsClosing(false);
      // Prevent body scroll when modal is active
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      // Move focus into the dialog once mounted (WCAG 2.4.3 / keyboard-nav).
      const raf = requestAnimationFrame(() => {
        const panel = panelRef.current;
        if (!panel) return;
        const target = panel.querySelector<HTMLElement>("[data-autofocus]") || panel;
        target.focus();
      });
      return () => {
        document.body.style.overflow = originalOverflow;
        cancelAnimationFrame(raf);
      };
    } else if (mounted) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setMounted(false);
        setIsClosing(false);
        // Restore focus to the element that opened the dialog.
        const prev = lastActiveRef.current;
        if (prev && typeof prev.focus === "function" && document.contains(prev)) {
          prev.focus();
        }
        lastActiveRef.current = null;
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen, mounted]);

  useEffect(() => {
    if (!mounted) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (closeOnEsc) onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const insidePanel = active instanceof Node && panel.contains(active);
      if (e.shiftKey) {
        if (!insidePanel || active === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (!insidePanel || active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeOnEsc, mounted, onClose]);

  if (!mounted) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={closeOnBackdropClick ? onClose : undefined}
      className={isClosing ? "veil-modal-backdrop-out" : "veil-modal-backdrop-in"}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-4)",
        backgroundColor: "rgba(26, 26, 26, 0.45)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`${isClosing ? "veil-modal-panel-out" : "veil-modal-panel-in"} ${className}`}
        style={{
          width: "100%",
          maxWidth,
          backgroundColor: "#ffffff",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-hairline)",
          boxShadow: "0 24px 60px -12px rgba(26, 26, 26, 0.2), 0 8px 24px -4px rgba(26, 26, 26, 0.08)",
          boxSizing: "border-box",
          position: "relative",
          overflow: "hidden",
          maxHeight: "min(92vh, 800px)",
          ...contentStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
};
