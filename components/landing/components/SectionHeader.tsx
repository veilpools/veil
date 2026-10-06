"use client";

import React, { useRef, useEffect } from "react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import { DecodeText } from "./DecodeText";

gsap.registerPlugin(ScrollTrigger);

export interface SectionHeaderProps {
  kicker: string;
  title: string | React.ReactNode;
  sub?: string;
  titleMaxW?: string;
  kickerColor?: string;
  style?: React.CSSProperties;
  alignCenter?: boolean;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  kicker,
  title,
  sub,
  titleMaxW = "14ch",
  kickerColor = "#FF8C00",
  style,
  alignCenter = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    gsap.set(el.children, { opacity: 0, y: 48 });

    const tween = gsap.to(el.children, {
      opacity: 1,
      y: 0,
      duration: 0.6,
      ease: "power3.out",
      stagger: 0.08,
      scrollTrigger: {
        trigger: el,
        start: "top 85%",
        toggleActions: "play none none reverse",
      },
    });

    return () => {
      if (tween.scrollTrigger) tween.scrollTrigger.kill();
      tween.kill();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        textAlign: alignCenter ? "center" : "left",
        marginBottom: "var(--space-8)",
        ...style,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-label)",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: kickerColor,
          marginBottom: "var(--space-4)",
        }}
      >
        {kicker}
      </div>
      <h2
        style={{
          fontFamily: "var(--font-headline)",
          fontSize: "var(--text-h1)",
          lineHeight: "var(--leading-h1)",
          fontWeight: "var(--font-weight-regular)" as any,
          letterSpacing: "-0.02em",
          margin: 0,
          maxWidth: titleMaxW,
        }}
      >
        {typeof title === "string" ? <DecodeText text={title} /> : title}
      </h2>
      {sub && (
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-intro)",
            lineHeight: "var(--leading-intro)",
            color: "var(--color-muted)",
            marginTop: "var(--space-4)",
            maxWidth: "36ch",
          }}
        >
          {sub}
        </p>
      )}
    </div>
  );
};
