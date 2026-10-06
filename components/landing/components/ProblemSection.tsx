"use client";

import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { codosContent } from "../data/codosContent";
import { DecodeText } from "./DecodeText";

gsap.registerPlugin(ScrollTrigger);

// Pin progress for each statement. Step k is active in [k/3, (k+1)/3), so these land inside each band.
const STEP_STOPS = [0, 0.5, 1];

export const ProblemSection: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [hasStepped, setHasStepped] = useState(false);
  const { problem } = codosContent;

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    // Step the snap last settled on; each gesture may move at most one step from here.
    let settledStep = 0;
    let lastStep = 0;

    const pin = ScrollTrigger.create({
      id: "problemPin",
      trigger: el,
      start: "top top",
      end: "+=260%",
      pin: true,
      scrub: true,
      anticipatePin: 1,
      snap: {
        snapTo: (value) => {
          const from = STEP_STOPS[settledStep];
          const dir = value > from + 0.02 ? 1 : value < from - 0.02 ? -1 : 0;
          const next = Math.max(0, Math.min(STEP_STOPS.length - 1, settledStep + dir));
          return STEP_STOPS[next];
        },
        duration: { min: 0.25, max: 0.6 },
        delay: 0.05,
        ease: "power2.inOut",
        inertia: false,
        onComplete: (self) => {
          settledStep = Math.round(self.progress * (STEP_STOPS.length - 1));
        },
      },
      onUpdate: (self) => {
        const step = Math.min(2, Math.floor(self.progress * 3));
        if (step === lastStep) return;
        lastStep = step;
        setActiveStep(step);
        setHasStepped(true);
      },
      onLeave: () => {
        settledStep = STEP_STOPS.length - 1;
      },
      onLeaveBack: () => {
        settledStep = 0;
      },
    });

    return () => {
      pin.kill();
    };
  }, []);

  const statement = problem.statements[activeStep];

  return (
    <section
      id="problem"
      ref={sectionRef}
      aria-label="The AI impact gap"
      style={{
        position: "relative",
        overflow: "hidden",
        background: "transparent",
        height: "100svh",
        minHeight: "100svh",
        padding: "0 var(--page-gutter)",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      {/* Top Flex Spacer - this is where the morphing particle stays centered! */}
      <div style={{ flex: "1 1 auto", minHeight: 0, position: "relative" }} />

      {/* Bottom Text Area */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          flex: "0 0 auto",
          display: "grid",
          placeItems: "start center",
          minHeight: "clamp(12rem, 30svh, 16rem)",
          paddingBottom: "clamp(1.5rem, 6svh, 4rem)",
        }}
      >
        <div style={{ gridArea: "1 / 1", width: "100%", opacity: 1 }}>
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-headline)",
              fontSize: "clamp(2.3rem, 3.5vw, 4rem)",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              fontWeight: "var(--font-weight-regular)",
              color: "var(--color-text)",
              textAlign: "center",
              textWrap: "balance",
              maxWidth: "min(94vw, 28ch)",
              marginInline: "auto",
            }}
          >
            <DecodeText key={statement.head} text={statement.head} autoPlay={hasStepped} />
          </p>
          <p
            style={{
              margin: "var(--space-3) auto 0",
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-intro)",
              lineHeight: "var(--leading-intro)",
              color: "var(--color-muted)",
              textAlign: "center",
              textWrap: "balance",
              maxWidth: "min(90vw, 34ch)",
            }}
          >
            {statement.sub}
          </p>
        </div>
      </div>
    </section>
  );
};
