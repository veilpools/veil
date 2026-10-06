const gl = 5200;
const yl = 2.05;
const Qy = 0.22;

export function rasterizeShape(drawFn: (ctx: CanvasRenderingContext2D, size: number) => void): Float32Array {
  const canvas = document.createElement("canvas");
  canvas.width = 300;
  canvas.height = 300;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return new Float32Array(0);

  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  drawFn(ctx, 300);

  const imgData = ctx.getImageData(0, 0, 300, 300).data;
  const points: number[] = [];

  for (let y = 0; y < 300; y++) {
    for (let x = 0; x < 300; x++) {
      if (imgData[(y * 300 + x) * 4 + 3] > 100) {
        points.push(x, y);
      }
    }
  }

  const pointCount = points.length / 2;
  if (!pointCount) return new Float32Array(0);

  const coords = new Float32Array(gl * 3);
  for (let i = 0; i < gl; i++) {
    const idx = Math.floor(Math.random() * pointCount) * 2;
    const nx = (points[idx] / 300) * 2 - 1;
    const ny = 1 - (points[idx + 1] / 300) * 2;

    coords[i * 3] = (Math.random() - 0.5) * Qy * 2;
    coords[i * 3 + 1] = ny * yl;
    coords[i * 3 + 2] = -nx * yl;
  }

  return coords;
}

export function generateFormations(): Float32Array[] {
  // 1. Crosshair target: every public trade is a target
  const crosshair = rasterizeShape((ctx, size) => {
    const c = size / 2;
    ctx.lineCap = "round";

    ctx.lineWidth = size * 0.045;
    ctx.beginPath();
    ctx.arc(c, c, size * 0.4, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = size * 0.03;
    ctx.beginPath();
    ctx.arc(c, c, size * 0.22, 0, Math.PI * 2);
    ctx.stroke();

    // Cross lines with a gap around the bullseye
    ctx.lineWidth = size * 0.035;
    const inner = size * 0.1;
    const outer = size * 0.48;
    ctx.beginPath();
    ctx.moveTo(c, c - outer); ctx.lineTo(c, c - inner);
    ctx.moveTo(c, c + inner); ctx.lineTo(c, c + outer);
    ctx.moveTo(c - outer, c); ctx.lineTo(c - inner, c);
    ctx.moveTo(c + inner, c); ctx.lineTo(c + outer, c);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(c, c, size * 0.045, 0, Math.PI * 2);
    ctx.fill();
  });

  // 2. Surveillance eye: MEV bots and watchers see every trade
  const eye = rasterizeShape((ctx, size) => {
    const c = size / 2;
    const halfW = size * 0.46;
    const lid = size * 0.3;

    ctx.lineJoin = "round";
    ctx.lineWidth = size * 0.045;
    ctx.beginPath();
    ctx.moveTo(c - halfW, c);
    ctx.quadraticCurveTo(c, c - lid * 1.45, c + halfW, c);
    ctx.quadraticCurveTo(c, c + lid * 1.45, c - halfW, c);
    ctx.closePath();
    ctx.stroke();

    ctx.lineWidth = size * 0.03;
    ctx.beginPath();
    ctx.arc(c, c, size * 0.17, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(c, c, size * 0.09, 0, Math.PI * 2);
    ctx.fill();

    // Highlight cut-out so the pupil reads as an eye, not a dot
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(c + size * 0.035, c - size * 0.035, size * 0.025, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  });

  // 3. Cryptographic shield with a V monogram
  const shield = rasterizeShape((ctx, size) => {
    const c = size / 2;
    const top = size * 0.08;
    const bottom = size * 0.93;
    const half = size * 0.36;

    const traceShield = (inset: number) => {
      ctx.beginPath();
      ctx.moveTo(c, top + inset);
      ctx.quadraticCurveTo(c + half * 0.55, top + size * 0.07 + inset, c + half - inset, top + size * 0.05 + inset);
      ctx.lineTo(c + half - inset, size * 0.46);
      ctx.bezierCurveTo(c + half - inset, size * 0.7, c + half * 0.45, size * 0.83, c, bottom - inset);
      ctx.bezierCurveTo(c - half * 0.45, size * 0.83, c - half + inset, size * 0.7, c - half + inset, size * 0.46);
      ctx.lineTo(c - half + inset, top + size * 0.05 + inset);
      ctx.quadraticCurveTo(c - half * 0.55, top + size * 0.07 + inset, c, top + inset);
      ctx.closePath();
    };

    ctx.lineJoin = "round";
    ctx.lineWidth = size * 0.045;
    traceShield(0);
    ctx.stroke();

    ctx.lineWidth = size * 0.018;
    traceShield(size * 0.06);
    ctx.stroke();

    ctx.lineWidth = size * 0.06;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(c - size * 0.15, size * 0.3);
    ctx.lineTo(c, size * 0.66);
    ctx.lineTo(c + size * 0.15, size * 0.3);
    ctx.stroke();
  });

  // 4. Step 1: Cryptographic Padlock & Vault (Shield your assets)
  const step1Padlock = rasterizeShape((ctx, size) => {
    const c = size / 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Shackle (upper arch)
    ctx.lineWidth = size * 0.045;
    ctx.beginPath();
    ctx.arc(c, c - size * 0.1, size * 0.2, Math.PI, 0);
    ctx.lineTo(c + size * 0.2, c + size * 0.02);
    ctx.moveTo(c - size * 0.2, c - size * 0.1);
    ctx.lineTo(c - size * 0.2, c + size * 0.02);
    ctx.stroke();

    // Body (vault / lock box)
    const bw = size * 0.3;
    const bh = size * 0.34;
    const by = c - size * 0.01;
    ctx.lineWidth = size * 0.04;
    ctx.strokeRect(c - bw, by, bw * 2, bh);

    // Inner contour frame
    ctx.lineWidth = size * 0.018;
    ctx.strokeRect(c - bw * 0.82, by + size * 0.035, bw * 1.64, bh - size * 0.07);

    // Keyhole / cryptographic vault core
    ctx.beginPath();
    ctx.arc(c, by + bh * 0.38, size * 0.055, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(c - size * 0.03, by + bh * 0.42);
    ctx.lineTo(c + size * 0.03, by + bh * 0.42);
    ctx.lineTo(c + size * 0.045, by + bh * 0.72);
    ctx.lineTo(c - size * 0.045, by + bh * 0.72);
    ctx.closePath();
    ctx.fill();
  });

  // 5. Step 2: Dark Routing Topology & ZK Constellation (Swap in the dark)
  const step2Circuit = rasterizeShape((ctx, size) => {
    const c = size / 2;
    const r = size * 0.38;
    const nodes: [number, number][] = [];

    // 6 hexagonal constellation nodes
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3 - Math.PI / 6;
      nodes.push([c + Math.cos(angle) * r, c + Math.sin(angle) * r]);
    }

    // Outer perimeter
    ctx.lineWidth = size * 0.035;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const [x, y] = nodes[i];
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    // Cross-connecting dark routing paths (internal mesh)
    ctx.lineWidth = size * 0.02;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const [x1, y1] = nodes[i];
      const [x2, y2] = nodes[(i + 2) % 6];
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.moveTo(x1, y1);
      ctx.lineTo(c, c);
    }
    ctx.stroke();

    // Node glyphs at vertices
    for (let i = 0; i < 6; i++) {
      const [x, y] = nodes[i];
      ctx.beginPath();
      ctx.arc(x, y, size * 0.04, 0, Math.PI * 2);
      ctx.fill();
    }

    // Center ZK Hook core
    ctx.lineWidth = size * 0.035;
    ctx.beginPath();
    ctx.arc(c, c, size * 0.09, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c, c, size * 0.04, 0, Math.PI * 2);
    ctx.fill();
  });

  // 6. Step 3: Stealth Relayer Satellite & Beam (Withdraw anywhere)
  const step3Satellite = rasterizeShape((ctx, size) => {
    const c = size / 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Central satellite fuselage
    const sw = size * 0.16;
    const sh = size * 0.2;
    const sy = c - size * 0.06;
    ctx.lineWidth = size * 0.035;
    ctx.strokeRect(c - sw / 2, sy - sh / 2, sw, sh);

    // Left solar panel wing
    const pw = size * 0.22;
    const ph = size * 0.13;
    const py = sy - ph / 2;
    ctx.lineWidth = size * 0.03;
    ctx.strokeRect(c - sw / 2 - pw - size * 0.04, py, pw, ph);
    // Left connector bar
    ctx.beginPath();
    ctx.moveTo(c - sw / 2, sy);
    ctx.lineTo(c - sw / 2 - size * 0.04, sy);
    ctx.stroke();
    // Left solar panel grid line
    ctx.lineWidth = size * 0.018;
    ctx.beginPath();
    ctx.moveTo(c - sw / 2 - pw * 0.5 - size * 0.04, py);
    ctx.lineTo(c - sw / 2 - pw * 0.5 - size * 0.04, py + ph);
    ctx.stroke();

    // Right solar panel wing
    ctx.lineWidth = size * 0.03;
    ctx.strokeRect(c + sw / 2 + size * 0.04, py, pw, ph);
    // Right connector bar
    ctx.beginPath();
    ctx.moveTo(c + sw / 2, sy);
    ctx.lineTo(c + sw / 2 + size * 0.04, sy);
    ctx.stroke();
    // Right solar panel grid line
    ctx.lineWidth = size * 0.018;
    ctx.beginPath();
    ctx.moveTo(c + sw / 2 + pw * 0.5 + size * 0.04, py);
    ctx.lineTo(c + sw / 2 + pw * 0.5 + size * 0.04, py + ph);
    ctx.stroke();

    // Downward dish antenna arc
    ctx.lineWidth = size * 0.035;
    ctx.beginPath();
    ctx.arc(c, sy + sh * 0.5 + size * 0.02, size * 0.1, Math.PI * 0.1, Math.PI * 0.9);
    ctx.stroke();

    // Stealth transmission pulse waves
    ctx.lineWidth = size * 0.025;
    ctx.beginPath();
    ctx.arc(c, sy + sh * 0.5 + size * 0.02, size * 0.22, Math.PI * 0.25, Math.PI * 0.75);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(c, sy + sh * 0.5 + size * 0.02, size * 0.34, Math.PI * 0.3, Math.PI * 0.7);
    ctx.stroke();

    // Central beacon node
    ctx.beginPath();
    ctx.arc(c, sy, size * 0.035, 0, Math.PI * 2);
    ctx.fill();
  });

  // 7. Step 4: Radar Dome & MEV Defense Shield (Private portfolio & MEV shield)
  const step4Radar = rasterizeShape((ctx, size) => {
    const c = size / 2;
    ctx.lineCap = "round";

    // 3 concentric radar rings
    ctx.lineWidth = size * 0.035;
    ctx.beginPath();
    ctx.arc(c, c, size * 0.42, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = size * 0.025;
    ctx.beginPath();
    ctx.arc(c, c, size * 0.28, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = size * 0.02;
    ctx.beginPath();
    ctx.arc(c, c, size * 0.14, 0, Math.PI * 2);
    ctx.stroke();

    // Radar crosshairs
    ctx.lineWidth = size * 0.025;
    ctx.beginPath();
    ctx.moveTo(c, c - size * 0.45); ctx.lineTo(c, c - size * 0.05);
    ctx.moveTo(c, c + size * 0.05); ctx.lineTo(c, c + size * 0.45);
    ctx.moveTo(c - size * 0.45, c); ctx.lineTo(c - size * 0.05, c);
    ctx.moveTo(c + size * 0.05, c); ctx.lineTo(c + size * 0.45, c);
    ctx.stroke();

    // Radar scanner wedge / sweep beam (60 degree sector)
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, size * 0.42, -Math.PI * 0.3, -Math.PI * 0.05);
    ctx.closePath();
    ctx.fill();

    // Center focal point
    ctx.beginPath();
    ctx.arc(c, c, size * 0.045, 0, Math.PI * 2);
    ctx.fill();
  });

  return [
    crosshair,     // 0: Problem 1
    eye,           // 1: Problem 2
    shield,        // 2: Problem 3
    step1Padlock,  // 3: Step 1 (Shield assets)
    step2Circuit,  // 4: Step 2 (Swap in the dark)
    step3Satellite,// 5: Step 3 (Withdraw anywhere)
    step4Radar,    // 6: Step 4 (Portfolio & MEV shield)
  ];
}
