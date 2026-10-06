"use client";

import React, { useEffect, useRef, useState } from "react";
import { ParticleCanvas, ParticleDropInstance } from "./ParticleCanvas";
import { generateFormations } from "../utils/formations";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export const ParticleFollower: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const particleInstanceRef = useRef<ParticleDropInstance | null>(null);
  const formationsRef = useRef<Float32Array[] | null>(null);

  useEffect(() => {
    // Generate formations once fonts are ready
    const initFormations = () => {
      formationsRef.current = generateFormations();
    };

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(initFormations).catch(initFormations);
    } else {
      initFormations();
    }

    const c = containerRef.current;
    if (!c) return;

    let d: ParticleDropInstance | null = null;
    let destroyed = false;
    let isLive = false;
    let scrollProgress = 0;
    let activeFormationIdx = -1;
    let formationTimeout = 0;

    const w = 201; // half canvas size
    const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const smoothstep = (t: number) => {
      t = clamp(t, 0, 1);
      return t * t * (3 - 2 * t);
    };

    const T = 0.2; // exponential smoothing time constant
    let targetX = 0, targetY = 0, targetScale = 1, targetOpacity = 0;
    let currX = NaN, currY = 0, currScale = 1, currOpacity = 0;
    let rafId = 0;
    let lastTime = 0;

    const updateTargets = () => {
      const W = window.innerWidth;
      const H = window.innerHeight;
      d = particleInstanceRef.current;

      const diagPanel = document.querySelector("[data-diag-panel]")?.getBoundingClientRect();
      const heroHome = document.querySelector("[data-hero-particle-home]")?.getBoundingClientRect();
      const releaseEl = document.querySelector("[data-particle-release]")?.getBoundingClientRect();

      if (!diagPanel) {
        targetOpacity = 0;
        triggerRaf();
        return;
      }

      const isDesktop = W >= 1080;
      const baseScale = W < 769 ? (W * 0.62) / 402 : Math.min(2.6, (W * 0.92) / 402) * 0.55 * 1.3;
      const problemScale = 1.0;
      const diagScale = W < 769 ? 0.42 : W < 1080 ? 0.48 : 0.58;

      const heroCenterX = heroHome ? heroHome.left + heroHome.width / 2 : W / 2;
      const heroCenterY = heroHome ? heroHome.top + heroHome.height / 2 : H * 0.42;

      const problemPin = ScrollTrigger.getById("problemPin");
      const scrollY = window.scrollY;

      const ut = problemPin
        ? scrollY < problemPin.start
          ? problemPin.start - scrollY
          : scrollY > problemPin.end
          ? problemPin.end - scrollY
          : 0
        : (document.querySelector("#problem")?.getBoundingClientRect().top ?? H);

      const R = problemPin ? clamp((scrollY - problemPin.start) / Math.max(1, problemPin.end - problemPin.start), 0, 1) : 0;

      const Ot = W / 2;
      const Ss = ut + H * 0.36;

      const Oe = smoothstep((H * 0.95 - ut) / (H * 0.55));
      const Xt = smoothstep((H * 0.92 - diagPanel.top) / (H * 0.62));

      // Query Step Anchors & Sections in Diagnostic Section
      const stepAnchors = [
        document.querySelector('[data-step-particle-anchor="1"]')?.getBoundingClientRect(),
        document.querySelector('[data-step-particle-anchor="2"]')?.getBoundingClientRect(),
        document.querySelector('[data-step-particle-anchor="3"]')?.getBoundingClientRect(),
        document.querySelector('[data-step-particle-anchor="4"]')?.getBoundingClientRect(),
      ];

      const stepKeys = ["diagnostic", "graph", "withdrawal", "dashboard"];
      const stepSections = stepKeys.map((k) =>
        document.querySelector(`[data-section="${k}"]`)?.getBoundingClientRect()
      );

      let activeStep = -1;
      for (let i = stepSections.length - 1; i >= 0; i--) {
        const sec = stepSections[i];
        if (sec && sec.top <= H * 0.6 && sec.bottom >= H * 0.15) {
          activeStep = i;
          break;
        }
      }
      if (
        activeStep === -1 &&
        stepSections[0] &&
        stepSections[0].top <= H * 0.85 &&
        stepSections[0].bottom >= H * 0.2
      ) {
        activeStep = 0;
      }

      // Compute Active Step Anchor Coordinates
      const activeAnchor = activeStep >= 0 ? stepAnchors[activeStep] : null;
      const anchorCenterX = activeAnchor
        ? activeAnchor.left + activeAnchor.width / 2
        : W * 0.04 + (402 * diagScale) / 2;
      const anchorCenterY = activeAnchor
        ? activeAnchor.top + activeAnchor.height / 2
        : H * 0.42;

      // Coordinate Interpolations:
      // 1. Hero -> Problem Center
      const heroToProblemX = lerp(heroCenterX, Ot, Oe);
      const heroToProblemY = lerp(heroCenterY, Ss, Oe);
      const heroToProblemScale = lerp(baseScale, problemScale, Oe);

      // 2. Problem Center -> Diagnostic Step Anchor
      targetX = lerp(heroToProblemX, anchorCenterX, Xt);
      targetY = lerp(heroToProblemY, anchorCenterY, Xt);
      targetScale = lerp(heroToProblemScale, diagScale, Xt);

      // Determine Target Formation:
      // Formations: 0,1,2 = Problem (crosshair, eye, shield)
      // Formations: 3,4,5,6 = Steps 1,2,3,4 (padlock, circuit, satellite, radar)
      let targetFormation = -1;
      if (Xt >= 0.35 && activeStep >= 0) {
        targetFormation = 3 + activeStep;
      } else if (problemPin && Oe > 0.6 && Xt < 0.35 && ut > -H * 0.2) {
        targetFormation = Math.min(2, Math.floor(R * 3));
      }

      const forms = formationsRef.current;
      if (d && targetFormation !== activeFormationIdx && (targetFormation < 0 || forms)) {
        activeFormationIdx = targetFormation;
        if (formationTimeout) {
          window.clearTimeout(formationTimeout);
          formationTimeout = 0;
        }

        if (targetFormation < 0) {
          d.setFormation(null, 0.6);
        } else {
          d.setFormation(null, 0.25);
          formationTimeout = window.setTimeout(() => {
            if (!destroyed && forms && d && forms[targetFormation]) {
              d.setFormation(forms[targetFormation], 0.95);
            }
          }, 240);
        }
      }

      let releaseFactor = 1;
      if (releaseEl) {
        releaseFactor = smoothstep((releaseEl.top - H * 0.45) / (H * 0.35));
      }
      targetOpacity = clamp(releaseFactor, 0, 1);

      triggerRaf();
    };

    const animateLoop = (timestamp: number) => {
      if (!lastTime) lastTime = timestamp;
      const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
      lastTime = timestamp;

      if (Number.isNaN(currX)) {
        currX = targetX;
        currY = targetY;
        currScale = targetScale;
        currOpacity = targetOpacity;
      }

      const factor = 1 - Math.exp(-dt / T);
      currX += (targetX - currX) * factor;
      currY += (targetY - currY) * factor;
      currScale += (targetScale - currScale) * factor;
      currOpacity += (targetOpacity - currOpacity) * factor;

      const settled =
        Math.abs(targetX - currX) < 0.1 &&
        Math.abs(targetY - currY) < 0.1 &&
        Math.abs(targetScale - currScale) < 0.001 &&
        Math.abs(targetOpacity - currOpacity) < 0.004;

      if (settled) {
        currX = targetX;
        currY = targetY;
        currScale = targetScale;
        currOpacity = targetOpacity;
      }

      c.style.transform = `translate(${(currX - w).toFixed(1)}px, ${(currY - w).toFixed(1)}px) scale(${currScale.toFixed(3)})`;
      c.style.opacity = clamp(currOpacity, 0, 1).toFixed(3);

      d = particleInstanceRef.current;
      if (d) {
        d.setScrollProgress(scrollProgress);
        const shouldBeRunning = currOpacity > 0.02;
        if (shouldBeRunning !== isLive) {
          isLive = shouldBeRunning;
          if (shouldBeRunning) d.start();
          else d.stop();
        }
      }

      if (settled) {
        rafId = 0;
        lastTime = 0;
        return;
      }

      rafId = requestAnimationFrame(animateLoop);
    };

    const triggerRaf = () => {
      if (!rafId) {
        lastTime = 0;
        rafId = requestAnimationFrame(animateLoop);
      }
    };

    // Scroll listener with ScrollTrigger
    const st = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => {
        scrollProgress = self.progress;
        updateTargets();
      },
      onRefresh: () => {
        updateTargets();
      },
    });

    window.addEventListener("resize", updateTargets);
    updateTargets();

    return () => {
      destroyed = true;
      st.kill();
      window.removeEventListener("resize", updateTargets);
      if (rafId) cancelAnimationFrame(rafId);
      if (formationTimeout) clearTimeout(formationTimeout);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: 402,
        height: 402,
        pointerEvents: "none",
        userSelect: "none",
        zIndex: 0,
        transformOrigin: "center center",
        willChange: "transform, opacity",
      }}
    >
      <ParticleCanvas
        onReady={(instance) => {
          particleInstanceRef.current = instance;
        }}
      />
    </div>
  );
};
