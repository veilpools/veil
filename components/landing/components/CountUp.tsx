"use client";

import React, { useRef, useState, useEffect } from "react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export interface CountUpProps {
  value: string | number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const CountUp: React.FC<CountUpProps> = ({
  value,
  prefix: propPrefix,
  suffix: propSuffix,
  duration = 1.2,
  className,
  style,
}) => {
  const containerRef = useRef<HTMLSpanElement>(null);

  // Parse input string/number
  const rawStr = String(value).trim();
  const numMatch = /([0-9][0-9,]*\.?[0-9]*)/.exec(rawStr);

  let num = 0;
  let detectedPrefix = propPrefix ?? "";
  let detectedSuffix = propSuffix ?? "";
  let decimals = 0;
  let hasCommas = false;

  if (numMatch) {
    const fullNumStr = numMatch[1];
    hasCommas = fullNumStr.includes(",");
    const numCleanStr = fullNumStr.replace(/,/g, "");
    num = parseFloat(numCleanStr) || 0;

    const dotIdx = numCleanStr.indexOf(".");
    if (dotIdx !== -1) {
      decimals = numCleanStr.length - dotIdx - 1;
    }

    if (propPrefix === undefined) {
      detectedPrefix = rawStr.slice(0, numMatch.index);
    }
    if (propSuffix === undefined) {
      detectedSuffix = rawStr.slice(numMatch.index + fullNumStr.length);
    }
  } else {
    num = parseFloat(rawStr) || 0;
  }

  const formatNumber = (v: number) => {
    let formatted = v.toFixed(decimals);
    if (hasCommas) {
      const parts = formatted.split(".");
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      formatted = parts.join(".");
    }
    return `${detectedPrefix}${formatted}${detectedSuffix}`;
  };

  const [display, setDisplay] = useState(rawStr);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const proxy = { v: 0 };
    const tween = gsap.to(proxy, {
      v: num,
      duration,
      ease: "power3.out",
      paused: true,
      onUpdate: () => setDisplay(formatNumber(proxy.v)),
    });

    // Check if element is already inside viewport on mount
    const rect = el.getBoundingClientRect();
    if (rect.top <= window.innerHeight * 0.9 && rect.bottom >= 0) {
      tween.play();
    }

    const trigger = ScrollTrigger.create({
      trigger: el,
      start: "top 90%",
      onEnter: () => {
        proxy.v = 0;
        setDisplay(formatNumber(0));
        tween.restart();
      },
      onEnterBack: () => {
        proxy.v = 0;
        setDisplay(formatNumber(0));
        tween.restart();
      },
      onLeaveBack: () => {
        tween.pause();
        proxy.v = 0;
        setDisplay(formatNumber(0));
      },
    });

    return () => {
      trigger.kill();
      tween.kill();
    };
  }, [value, num, detectedPrefix, detectedSuffix, decimals, hasCommas, duration]);

  return (
    <span
      ref={containerRef}
      className={`count-up ${className ?? ""}`}
      data-display={display}
      aria-label={String(value)}
      style={style}
    >
      {display}
    </span>
  );
};
