"use client";

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
        <circle cx="9" cy="11" r="0.81"/>
        <circle cx="15" cy="11" r="0.81"/>
        <circle cx="21" cy="11" r="0.81"/>
        <circle cx="27" cy="11" r="0.81"/>
        <circle cx="33" cy="11" r="0.81"/>
        <circle cx="69" cy="11" r="0.81"/>
        <circle cx="75" cy="11" r="0.81"/>
        <circle cx="81" cy="11" r="0.81"/>
        <circle cx="87" cy="11" r="0.81"/>
        <circle cx="12" cy="17" r="1.00"/>
        <circle cx="18" cy="17" r="1.00"/>
        <circle cx="24" cy="17" r="1.00"/>
        <circle cx="30" cy="17" r="1.00"/>
        <circle cx="36" cy="17" r="1.00"/>
        <circle cx="66" cy="17" r="1.00"/>
        <circle cx="72" cy="17" r="1.00"/>
        <circle cx="78" cy="17" r="1.00"/>
        <circle cx="84" cy="17" r="1.00"/>
        <circle cx="90" cy="17" r="1.00"/>
        <circle cx="15" cy="23" r="1.18"/>
        <circle cx="21" cy="23" r="1.18"/>
        <circle cx="27" cy="23" r="1.18"/>
        <circle cx="33" cy="23" r="1.18"/>
        <circle cx="63" cy="23" r="1.18"/>
        <circle cx="69" cy="23" r="1.18"/>
        <circle cx="75" cy="23" r="1.18"/>
        <circle cx="81" cy="23" r="1.18"/>
        <circle cx="87" cy="23" r="1.18"/>
        <circle cx="18" cy="29" r="1.35"/>
        <circle cx="24" cy="29" r="1.35"/>
        <circle cx="30" cy="29" r="1.35"/>
        <circle cx="36" cy="29" r="1.35"/>
        <circle cx="60" cy="29" r="1.35"/>
        <circle cx="66" cy="29" r="1.35"/>
        <circle cx="72" cy="29" r="1.35"/>
        <circle cx="78" cy="29" r="1.35"/>
        <circle cx="84" cy="29" r="1.35"/>
        <circle cx="21" cy="35" r="1.51"/>
        <circle cx="27" cy="35" r="1.51"/>
        <circle cx="33" cy="35" r="1.51"/>
        <circle cx="39" cy="35" r="1.51"/>
        <circle cx="63" cy="35" r="1.51"/>
        <circle cx="69" cy="35" r="1.51"/>
        <circle cx="75" cy="35" r="1.51"/>
        <circle cx="81" cy="35" r="1.51"/>
        <circle cx="24" cy="41" r="1.67"/>
        <circle cx="30" cy="41" r="1.67"/>
        <circle cx="36" cy="41" r="1.67"/>
        <circle cx="42" cy="41" r="1.67"/>
        <circle cx="60" cy="41" r="1.67"/>
        <circle cx="66" cy="41" r="1.67"/>
        <circle cx="72" cy="41" r="1.67"/>
        <circle cx="78" cy="41" r="1.67"/>
        <circle cx="21" cy="47" r="1.83"/>
        <circle cx="27" cy="47" r="1.83"/>
        <circle cx="33" cy="47" r="1.83"/>
        <circle cx="39" cy="47" r="1.83"/>
        <circle cx="45" cy="47" r="1.83"/>
        <circle cx="57" cy="47" r="1.83"/>
        <circle cx="63" cy="47" r="1.83"/>
        <circle cx="69" cy="47" r="1.83"/>
        <circle cx="75" cy="47" r="1.83"/>
        <circle cx="24" cy="53" r="1.98"/>
        <circle cx="30" cy="53" r="1.98"/>
        <circle cx="36" cy="53" r="1.98"/>
        <circle cx="42" cy="53" r="1.98"/>
        <circle cx="54" cy="53" r="1.98"/>
        <circle cx="60" cy="53" r="1.98"/>
        <circle cx="66" cy="53" r="1.98"/>
        <circle cx="72" cy="53" r="1.98"/>
        <circle cx="27" cy="59" r="2.14"/>
        <circle cx="33" cy="59" r="2.14"/>
        <circle cx="39" cy="59" r="2.14"/>
        <circle cx="45" cy="59" r="2.14"/>
        <circle cx="57" cy="59" r="2.14"/>
        <circle cx="63" cy="59" r="2.14"/>
        <circle cx="69" cy="59" r="2.14"/>
        <circle cx="75" cy="59" r="2.14"/>
        <circle cx="30" cy="65" r="2.29"/>
        <circle cx="36" cy="65" r="2.29"/>
        <circle cx="42" cy="65" r="2.29"/>
        <circle cx="48" cy="65" r="2.29"/>
        <circle cx="54" cy="65" r="2.29"/>
        <circle cx="60" cy="65" r="2.29"/>
        <circle cx="66" cy="65" r="2.29"/>
        <circle cx="72" cy="65" r="2.29"/>
        <circle cx="33" cy="71" r="2.44"/>
        <circle cx="39" cy="71" r="2.44"/>
        <circle cx="45" cy="71" r="2.44"/>
        <circle cx="51" cy="71" r="2.44"/>
        <circle cx="57" cy="71" r="2.44"/>
        <circle cx="63" cy="71" r="2.44"/>
        <circle cx="69" cy="71" r="2.44"/>
        <circle cx="36" cy="77" r="2.59"/>
        <circle cx="42" cy="77" r="2.59"/>
        <circle cx="48" cy="77" r="2.59"/>
        <circle cx="54" cy="77" r="2.59"/>
        <circle cx="60" cy="77" r="2.59"/>
        <circle cx="66" cy="77" r="2.59"/>
      </g>
      <g fill={accentColor}>
        <circle cx="39" cy="83" r="2.73"/>
        <circle cx="45" cy="83" r="2.73"/>
        <circle cx="51" cy="83" r="2.73"/>
        <circle cx="57" cy="83" r="2.73"/>
        <circle cx="63" cy="83" r="2.73"/>
        <circle cx="42" cy="89" r="2.88"/>
        <circle cx="48" cy="89" r="2.88"/>
        <circle cx="54" cy="89" r="2.88"/>
        <circle cx="60" cy="89" r="2.88"/>
      </g>
    </svg>
  );
};

export interface VeilLogoProps {
  href?: string;
  size?: "sm" | "md" | "lg" | "xl";
  iconSize?: number;
  fontSize?: string;
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
    iconSize: 28,
    fontSize: "1.2rem",
    gap: "9px",
  },
  md: {
    iconSize: 40,
    fontSize: "1.45rem",
    gap: "12px",
  },
  lg: {
    iconSize: 52,
    fontSize: "1.75rem",
    gap: "14px",
  },
  xl: {
    iconSize: 64,
    fontSize: "2.1rem",
    gap: "16px",
  },
};

/**
 * Veil Protocol responsive logo component.
 * Displays the official halftone mark and typography wordmark.
 */
export const VeilLogo: React.FC<VeilLogoProps> = ({
  href = "/",
  size = "md",
  iconSize: propIconSize,
  fontSize: propFontSize,
  color = "var(--color-text)",
  dotColor = "#FF8A00",
  showIcon = true,
  showWordmark = true,
  className = "",
  style = {},
  ariaLabel = "Veil Protocol",
}) => {
  const config = SIZE_CONFIG[size] || SIZE_CONFIG.md;
  const resolvedIconSize = propIconSize ?? config.iconSize;
  const resolvedFontSize = propFontSize ?? config.fontSize;

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
          iconSize={resolvedIconSize}
          color={color}
          accentColor={dotColor}
        />
      )}

      {showWordmark && (
        <span
          style={{
            fontFamily: "var(--font-headline)",
            fontSize: resolvedFontSize,
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
