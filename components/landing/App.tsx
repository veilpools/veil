"use client";

import React, { useEffect } from "react";
import "./styles/tokens.css";
import "./styles/animations.css";
import "./styles/global.css";

import { Header } from "./components/Header";
import { HeroSection } from "./components/HeroSection";
import { TechRibbon } from "./components/TechRibbon";
import { ProblemSection } from "./components/ProblemSection";
import { DiagnosticSection } from "./components/DiagnosticSection";
import { WhoItIsForSection } from "./components/WhoItIsForSection";
import { ComparisonSection } from "./components/ComparisonSection";
import { HowItWorksSection } from "./components/HowItWorksSection";
import { FlywheelBurnSection } from "./components/FlywheelBurnSection";
import { ContractsSecuritySection } from "./components/ContractsSecuritySection";
import { FaqSection } from "./components/FaqSection";
import { CtaSection } from "./components/CtaSection";
import { Footer } from "./components/Footer";
import { ParticleFollower } from "./components/ParticleFollower";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export const App: React.FC = () => {
  useEffect(() => {
    // Refresh ScrollTrigger once DOM layout is settled
    const timer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{ position: "relative", minHeight: "100vh", isolation: "isolate" }}>
      {/* Global Viewport Follow-Scroll Particle Canvas (Layer 0, behind content) */}
      <ParticleFollower />

      {/* Landing Page Content Hierarchy (Layer 1, always in front) */}
      <main style={{ position: "relative", zIndex: 1 }}>
        <HeroSection />
        <TechRibbon />
        <ProblemSection />
        <DiagnosticSection />
        <WhoItIsForSection />
        <ComparisonSection />
        <HowItWorksSection />
        <FlywheelBurnSection />
        <ContractsSecuritySection />
        <FaqSection />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
};

export default App;
