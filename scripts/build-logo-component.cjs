const fs = require('fs');

const s = fs.readFileSync('public/veil-logo.svg', 'utf8');
const circles = s.match(/<circle[^>]+>/g);

const upperCircles = circles
  .filter(c => !c.includes('#FF8A00'))
  .map(c => c.replace(/ fill="[^"]+"/, '').trim())
  .join('\n        ');

const lowerCircles = circles
  .filter(c => c.includes('#FF8A00'))
  .map(c => c.replace(/ fill="[^"]+"/, '').trim())
  .join('\n        ');

const componentCode = `"use client";

import React from "react";
import Link from "next/link";

export interface VeilMarkProps {
  size?: number | string;
  color?: string;
  accentColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Halftone "V" logo mark for Veil Protocol.
 * - Upper circles inherit currentColor (or specified color)
 * - Bottom accent circles render brand orange (#FF8A00)
 */
export const VeilMark: React.FC<VeilMarkProps> = ({
  size = 28,
  color = "currentColor",
  accentColor = "#FF8A00",
  className = "",
  style = {},
}) => {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        flexShrink: 0,
        color,
        ...style,
      }}
    >
      <g fill="currentColor">
        ${upperCircles}
      </g>
      <g fill={accentColor}>
        ${lowerCircles}
      </g>
    </svg>
  );
};

export interface VeilLogoProps {
  href?: string;
  size?: "sm" | "md" | "lg";
  color?: string;
  dotColor?: string;
  showIcon?: boolean;
  showWordmark?: boolean;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
}

const SIZE_CONFIG = {
  sm: {
    iconSize: 22,
    fontSize: "1.1rem",
    gap: "8px",
  },
  md: {
    iconSize: 28,
    fontSize: "1.25rem",
    gap: "10px",
  },
  lg: {
    iconSize: 34,
    fontSize: "1.45rem",
    gap: "12px",
  },
};

/**
 * Veil Protocol responsive logo component.
 * Displays the official halftone mark and typography wordmark.
 */
export const VeilLogo: React.FC<VeilLogoProps> = ({
  href = "/",
  size = "md",
  color = "var(--color-text)",
  dotColor = "#FF8A00",
  showIcon = true,
  showWordmark = true,
  className = "",
  style = {},
  ariaLabel = "Veil Protocol",
}) => {
  const config = SIZE_CONFIG[size] || SIZE_CONFIG.md;

  const content = (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: config.gap,
        textDecoration: "none",
        lineHeight: 1,
        ...style,
      }}
    >
      {showIcon && (
        <VeMarkWrapper
          iconSize={config.iconSize}
          color={color}
          accentColor={dotColor}
        />
      )}

      {showWordmark && (
        <span
          style={{
            fontFamily: "var(--font-headline)",
            fontSize: config.fontSize,
            fontWeight: 700,
            letterSpacing: "0.08em",
            color,
            textTransform: "uppercase",
            lineHeight: 1,
          }}
        >
          VEIL
        </span>
      )}
    </span>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={ariaLabel}
        style={{
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        {content}
      </Link>
    );
  }

  return content;
};

// Internal wrapper to pass through colors
const VeMarkWrapper: React.FC<{
  iconSize: number;
  color: string;
  accentColor: string;
}> = ({ iconSize, color, accentColor }) => (
  <VeilMark size={iconSize} color={color} accentColor={accentColor} />
);

export default VeilLogo;
`;

fs.writeFileSync('components/VeilLogo.tsx', componentCode);
console.log('VeilLogo.tsx generated successfully! Size:', componentCode.length);
