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
      <PrivacyGridCanvas />
      <Navbar />
      <main
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
