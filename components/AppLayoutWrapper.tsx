"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { PrivacyGridCanvas } from "./PrivacyGridCanvas";

export function AppLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  if (isLanding) {
    return <div style={{ width: "100%", minHeight: "100vh" }}>{children}</div>;
  }

  return (
    <>
      <a
        href="#main-content"
        style={{
          position: "absolute",
          left: "12px",
          top: "-48px",
          zIndex: 100,
          padding: "8px 14px",
          borderRadius: "var(--radius-sm)",
          backgroundColor: "var(--color-text)",
          color: "#fff",
          fontSize: "13px",
          fontWeight: 600,
          textDecoration: "none",
          transition: "top var(--duration-fast)",
        }}
        onFocus={(e) => {
          e.currentTarget.style.top = "12px";
        }}
        onBlur={(e) => {
          e.currentTarget.style.top = "-48px";
        }}
      >
        Skip to main content
      </a>
      <PrivacyGridCanvas />
      <Navbar />
      <main
        id="main-content"
        tabIndex={-1}
        style={{
          flex: 1,
          width: "100%",
          maxWidth: "var(--page-max)",
          margin: "0 auto",
          padding: "var(--space-6) var(--page-gutter) var(--space-12)",
          position: "relative",
          zIndex: 10,
          boxSizing: "border-box",
        }}
      >
        {children}
      </main>
      <Footer />
    </>
  );
}
