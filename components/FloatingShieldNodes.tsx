"use client";

import React, { useEffect, useRef } from "react";

interface NodeData {
  x: number;
  y: number;
  label: string;
  sub: string;
  color: string;
  duration: number;
  delay: number;
}

const SHIELD_NODES: NodeData[] = [
  { x: 3.5, y: 22, label: "0x20c4", sub: "HOOK_PERM", color: "#10b981", duration: 3.2, delay: 0 },
  { x: 6.8, y: 48, label: "LEAF #0", sub: "MERKLE_ROOT", color: "#06b6d4", duration: 4.1, delay: -1.2 },
  { x: 12.2, y: 75, label: "ZK_PROOF", sub: "GROTH16", color: "#34d399", duration: 3.6, delay: -0.7 },
  { x: 88.5, y: 25, label: "0x8366...951", sub: "V4_POOL_MGR", color: "#38bdf8", duration: 3.8, delay: -1.5 },
  { x: 93.0, y: 52, label: "NULLIFIER", sub: "SPENT_GUARD", color: "#10b981", duration: 4.3, delay: -0.3 },
  { x: 85.2, y: 80, label: "ASP_CLEAN", sub: "GENESIS_ROOT", color: "#059669", duration: 3.4, delay: -2.1 },
];

export const FloatingShieldNodes: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let mouseX = -9999;
    let mouseY = -9999;
    let targetX = -9999;
    let targetY = -9999;
    let rafId = 0;

    const onPointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      targetX = e.clientX - rect.left;
      targetY = e.clientY - rect.top;
    };

    const onPointerLeave = () => {
      targetX = -9999;
      targetY = -9999;
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("mouseleave", onPointerLeave);

    const tick = () => {
      mouseX += (targetX - mouseX) * 0.1;
      mouseY += (targetY - mouseY) * 0.1;

      const rect = container.getBoundingClientRect();
      const w = rect.width || 1;
      const h = rect.height || 1;

      SHIELD_NODES.forEach((node, i) => {
        const el = nodeRefs.current[i];
        if (!el) return;

        const nodeX = (node.x / 100) * w;
        const nodeY = (node.y / 100) * h;
        const dx = nodeX - mouseX;
        const dy = nodeY - mouseY;
        const dist = Math.hypot(dx, dy);
        const radius = 180;

        if (dist < radius && mouseX > -5000) {
          const force = 1 - dist / radius;
          const px = (dx / (dist || 1)) * force * 24;
          const py = (dy / (dist || 1)) * force * 24;
          const scale = 1 + force * 0.15;
          el.style.transform = `translate(calc(-50% + ${px.toFixed(1)}px), calc(-50% + ${py.toFixed(1)}px)) scale(${scale.toFixed(2)})`;
        } else {
          el.style.transform = "translate(-50%, -50%) scale(1)";
        }
      });

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("mouseleave", onPointerLeave);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none select-none overflow-hidden z-0 hidden lg:block"
      aria-hidden="true"
    >
      <style>{`
        @keyframes floatShieldNode {
          0%, 100% { transform: translateY(0px); opacity: 0.45; }
          50% { transform: translateY(-12px); opacity: 0.9; }
        }
        @keyframes radarScanPulse {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
      `}</style>

      {SHIELD_NODES.map((node, i) => (
        <div
          key={i}
          ref={(el) => {
            nodeRefs.current[i] = el;
          }}
          className="absolute flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-500/20 bg-slate-950/70 backdrop-blur-md shadow-lg transition-transform duration-100 ease-out"
          style={{
            left: `${node.x}%`,
            top: `${node.y}%`,
            animation: `floatShieldNode ${node.duration}s ease-in-out infinite`,
            animationDelay: `${node.delay}s`,
            willChange: "transform",
          }}
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: node.color,
              animation: "radarScanPulse 2.2s infinite",
            }}
          />
          <div className="flex flex-col font-mono text-[9px] leading-tight">
            <span className="font-bold text-slate-200 tracking-wider">{node.label}</span>
            <span className="text-slate-500 text-[8px]">{node.sub}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
