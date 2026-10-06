"use client";

import React, { useEffect, useRef } from "react";

export interface ParticleDropInstance {
  setFormation: (target: Float32Array | null, duration?: number) => void;
  setScrollProgress: (progress: number) => void;
  start: () => void;
  stop: () => void;
  dispose: () => void;
}

export interface ParticleConfig {
  particleCount?: number;
  spritePath?: string;
  brainPath?: string;
  fitMargin?: number;
  sceneScale?: number;
  spawnDuration?: number;
  pauseWhenOffscreen?: boolean;
  maxPixelRatio?: number;
  [key: string]: any;
}

interface ParticleCanvasProps {
  style?: React.CSSProperties;
  className?: string;
  config?: ParticleConfig;
  onReady?: (instance: ParticleDropInstance) => void;
}

export const ParticleCanvas: React.FC<ParticleCanvasProps> = ({
  style,
  className,
  config,
  onReady,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let instance: ParticleDropInstance | null = null;
    let disposed = false;

    // Dynamically load the WebGL module via native browser import to bypass Vite AST
    const loadNative = new Function("url", "return import(url)");
    loadNative("/assets/ParticleDrop-BqYOc2MB.js")
      .then((mod: any) => {
        if (disposed || !containerRef.current) return;
        const ParticleDropClass = mod.ParticleDrop || mod.default;
        instance = new ParticleDropClass({
          container: containerRef.current,
          spritePath: "/particle/sprite.png",
          brainPath: "/particle/brain.obj",
          fitMargin: 0.92,
          sceneScale: 1.21,
          spawnDuration: 1,
          pauseWhenOffscreen: false,
          ...config,
        });

        if (onReady && instance) {
          onReady(instance);
        }
      })
      .catch((err: unknown) => {
        console.error("Failed to load ParticleDrop module:", err);
      });

    return () => {
      disposed = true;
      if (instance) {
        instance.dispose();
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        width: "100%",
        height: "100%",
        ...style,
      }}
    />
  );
};
