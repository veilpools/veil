"use client";

import React, { useRef, useEffect } from "react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export interface RevealBoxProps {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  scale?: number;
  stagger?: number;
  style?: React.CSSProperties;
  className?: string;
}

export const RevealBox: React.FC<RevealBoxProps> = ({
  children,
  delay = 0,
  y = 32,
  scale,
  stagger,
  style,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const targets = stagger ? Array.from(el.children) : el;

    gsap.set(targets, {
      opacity: 0,
      y,
      ...(scale != null ? { scale } : {}),
    });

    const tweenVars: gsap.TweenVars = {
      opacity: 1,
      y: 0,
      duration: 0.6,
      ease: "power3.out",
      delay: delay / 1000,
      stagger: stagger ? stagger / 1000 : 0,
      scrollTrigger: {
        trigger: el,
        start: "top 85%",
        toggleActions: "play none none reverse",
      },
    };

    if (scale != null) {
      tweenVars.scale = 1;
    }

    const tween = gsap.to(targets, tweenVars);

    return () => {
      if (tween.scrollTrigger) tween.scrollTrigger.kill();
      tween.kill();
    };
  }, [delay, y, scale, stagger]);

  return (
    <div ref={containerRef} className={className} style={style}>
      {children}
    </div>
  );
};
