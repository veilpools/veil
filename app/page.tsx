"use client";

import dynamic from "next/dynamic";

const LandingApp = dynamic(() => import("../components/landing/App"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-[#EBE1F0] text-slate-800 font-mono text-sm">
      Loading...
    </div>
  ),
});

export default function HomePage() {
  return <LandingApp />;
}
