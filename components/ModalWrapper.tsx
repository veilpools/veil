"use client";

import React, { useEffect, useState } from "react";

interface ModalWrapperProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
  className?: string;
  contentStyle?: React.CSSProperties;
  closeOnBackdropClick?: boolean;
  closeOnEsc?: boolean;
}

export const ModalWrapper: React.FC<ModalWrapperProps> = ({
  isOpen,
  onClose,
  children,
  maxWidth = "460px",
  className = "",
  contentStyle = {},
  closeOnBackdropClick = true,
  closeOnEsc = true,
}) => {
  const [mounted, setMounted] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      setIsClosing(false);
      // Prevent body scroll when modal is active
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    } else if (mounted) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setMounted(false);
        setIsClosing(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen, mounted]);

  useEffect(() => {
    if (!closeOnEsc || !mounted) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
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
          ...contentStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
};
