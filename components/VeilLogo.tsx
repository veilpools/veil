"use client";

import React from "react";
import Link from "next/link";

interface VeilLogoProps {
  href?: string;
  size?: "sm" | "md" | "lg";
  color?: string;
  dotColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const VeilLogo: React.FC<VeilLogoProps> = ({
  href = "/",
  size = "md",
  color = "var(--color-text)",
  dotColor = "var(--color-accent)",
  className = "",
  style = {},
}) => {
  const fontSizes = {
    sm: "1.1rem",
    md: "1.25rem",
    lg: "1.45rem",
  };
  const dotSizes = {
    sm: "4px",
    md: "5px",
    lg: "6px",
  };

  const mark = (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        textDecoration: "none",
        lineHeight: 1,
        ...style,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-headline)",
          fontSize: fontSizes[size],
          fontWeight: 700,
          letterSpacing: "0.08em",
          color,
          textTransform: "uppercase",
          lineHeight: 1,
        }}
      >
        VEIL
      </span>
      <span
        style={{
          width: dotSizes[size],
          height: dotSizes[size],
          borderRadius: "50%",
          backgroundColor: dotColor,
          display: "inline-block",
          flexShrink: 0,
        }}
      />
    </span>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
        {mark}
      </Link>
    );
  }

  return mark;
};
