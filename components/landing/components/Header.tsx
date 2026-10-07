"use client";

import React from "react";
import { VeilLogo } from "../../VeilLogo";

export const Header: React.FC = () => {
  return (
    <header
      role="banner"
      className="hero-enter"
      style={{
        position: "relative",
        zIndex: 3,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "var(--space-5) var(--page-gutter)",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <VeilLogo href="/" size="md" />

      <nav
        aria-label="Primary"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-6)",
          fontSize: "var(--text-body-sm)",
          fontFamily: "var(--font-body)",
        }}
      >
        <a
          href="#how"
          className="lp-link"
          style={{
            color: "var(--color-muted)",
            textDecoration: "none",
            transition: "opacity var(--duration-fast)",
          }}
        >
          How It Works
        </a>
        <a
          href="#why-veil"
          className="lp-link"
          style={{
            color: "var(--color-muted)",
            textDecoration: "none",
            transition: "opacity var(--duration-fast)",
          }}
        >
          Why Veil
        </a>
        <a
          href="#flywheel"
          className="lp-link"
          style={{
            color: "var(--color-muted)",
            textDecoration: "none",
            transition: "opacity var(--duration-fast)",
          }}
        >
          Flywheel
        </a>
        <a
          href="#security"
          className="lp-link"
          style={{
            color: "var(--color-muted)",
            textDecoration: "none",
            transition: "opacity var(--duration-fast)",
          }}
        >
          Contracts &amp; Proofs
        </a>
        <a
          href="#faq"
          className="lp-link"
          style={{
            color: "var(--color-muted)",
            textDecoration: "none",
            transition: "opacity var(--duration-fast)",
          }}
        >
          FAQ
        </a>
        <a
          href="/trade"
          className="lp-btn lp-btn--filled"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-2)",
            background: "var(--color-text)",
            color: "var(--color-bg)",
            minHeight: "2.25rem",
            boxSizing: "border-box",
            lineHeight: 1,
            letterSpacing: "0.005em",
            padding: "0 var(--space-4)",
            borderRadius: "var(--radius-md)",
            textDecoration: "none",
            fontSize: "var(--text-body-sm)",
            whiteSpace: "nowrap",
            transition: "all var(--duration-fast) var(--ease-out)",
          }}
        >
          Launch App
          <svg
            width="11"
            height="11"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <path
              d="M1 6H10.4M6.2 1.8L10.4 6L6.2 10.2"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        </a>
      </nav>
    </header>
  );
};
