"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ContractsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/#security");
  }, [router]);

  return (
    <div style={{ padding: "var(--space-12) var(--page-gutter)", textAlign: "center" }}>
      <p style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h3)", color: "var(--color-text)" }}>
        Redirecting to Verified Contracts Registry...
      </p>
      <a
        href="/#security"
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
