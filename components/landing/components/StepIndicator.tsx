"use client";

import React, { useRef, useState, useEffect } from "react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface StepIndicatorProps {
  text: string;
  style?: React.CSSProperties;
  className?: string;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  text,
  style,
  className,
}) => {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    setCount(0);
    const progressObj = { n: 0 };
    const tween = gsap.to(progressObj, {
      n: text.length,
      duration: 0.5,
      ease: "none",
      onUpdate: () => setCount(Math.round(progressObj.n)),
      scrollTrigger: {
        trigger: el,
        start: "top 90%",
        toggleActions: "play none none reverse",
      },
    });

    return () => {
      if (tween.scrollTrigger) tween.scrollTrigger.kill();
      tween.kill();
    };
  }, [text]);

  return (
    <span
      ref={containerRef}
      style={{ display: "inline-block", ...style }}
      className={className}
      aria-label={text}
    >
      <span aria-hidden="true">{text.slice(0, count)}</span>
      <span aria-hidden="true" style={{ opacity: 0 }}>
        {text.slice(count)}
      </span>
    </span>
  );
};
