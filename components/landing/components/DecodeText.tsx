"use client";

import React, { useRef, useState, useEffect } from "react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const GLYPHS = "0123456789#%&@$8O0";

export interface Segment {
  text: string;
  style?: React.CSSProperties;
}

export interface DecodeTextProps {
  text?: string;
  segments?: Segment[];
  style?: React.CSSProperties;
  className?: string;
  /** Decode immediately on mount instead of on scroll. Use inside pinned sections. */
  autoPlay?: boolean;
}

export const DecodeText: React.FC<DecodeTextProps> = ({
  text,
  segments,
  style,
  className,
  autoPlay = false,
}) => {
  const containerRef = useRef<HTMLSpanElement>(null);
  const segs = segments ?? (text ? [{ text }] : []);

  // Collect all characters
  const chars: { ch: string; style?: React.CSSProperties }[] = [];
  segs.forEach((u) => {
    for (const f of u.text) {
      chars.push({ ch: f, style: u.style });
    }
  });

  const totalChars = Math.max(1, chars.length);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const proxy = { p: 0 };
    const tween = gsap.to(proxy, {
      p: 1,
      duration: 0.8,
      ease: "none",
      onUpdate: () => setProgress(Math.round(proxy.p * 100) / 100),
      scrollTrigger: autoPlay
        ? undefined
        : {
            trigger: el,
            start: "top 85%",
            toggleActions: "play none none reverse",
          },
    });

    return () => {
      if (tween.scrollTrigger) tween.scrollTrigger.kill();
      tween.kill();
    };
  }, [totalChars, autoPlay]);

  const renderChar = (u: { ch: string; style?: React.CSSProperties }, idx: number) => {
    const pOffset = (idx / totalChars) * 0.7;
    const g = (progress - pOffset) / 0.3;
    let glyph: string | undefined;
    let decoded = false;

    if (g <= 0) {
      glyph = "0";
    } else if (g >= 1) {
      glyph = undefined;
      decoded = true;
    } else {
      glyph = GLYPHS[(idx * 7 + Math.floor(g * 12)) % GLYPHS.length];
    }

    return (
      <span
        key={idx}
        className="decode-char"
        data-glyph={decoded ? undefined : glyph}
        style={u.style}
      >
        {u.ch}
      </span>
    );
  };

  const words: React.ReactNode[] = [];
  let currentWord: React.ReactNode[] = [];
  let wordIdx = 0;

  const flushWord = () => {
    if (currentWord.length > 0) {
      words.push(
        <span key={`w${wordIdx++}`} style={{ whiteSpace: "nowrap" }}>
          {currentWord}
        </span>
      );
      currentWord = [];
    }
  };

  chars.forEach((u, idx) => {
    if (u.ch === " " || u.ch === "\u00A0") {
      flushWord();
      words.push(
        <span key={`s${idx}`} aria-hidden="true">
          {" "}
        </span>
      );
    } else if (u.ch === "\n") {
      flushWord();
      words.push(<br key={`b${idx}`} />);
    } else {
      currentWord.push(renderChar(u, idx));
    }
  });
  flushWord();

  return (
    <span
      ref={containerRef}
      className={className}
      aria-label={segs.map((u) => u.text).join("")}
      style={style}
    >
      {words}
    </span>
  );
};
