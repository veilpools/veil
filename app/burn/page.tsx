"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BurnRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/#flywheel");
  }, [router]);

  return (
    <div style={{ padding: "var(--space-12) var(--page-gutter)", textAlign: "center" }}>
      <p style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h3)", color: "var(--color-text)" }}>
        Redirecting to Protocol Flywheel &amp; Burn Ledger...
      </p>
      <a
        href="/#flywheel"
        style={{
          color: "var(--color-accent)",
          textDecoration: "underline",
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-body)",
        }}
      >
        Click here if not redirected automatically.
      </a>
    </div>
  );
}
