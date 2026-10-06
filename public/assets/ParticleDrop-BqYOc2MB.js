import{C as E,M as w,W as V,S as z,N as G,a as H,P as j,G as L,T as q,b as $,L as Y,c as F,V as R,d as J,e as K,A as Q,f as X,B as Z,g as p,D as ee,R as te,h as ie,i as se,j as ae}from"./three.module-CFTXPF_W.js";const f=7,oe=`
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`,re=`
vec3 snoiseVec3(vec3 x) {
  float s  = snoise(x);
  float s1 = snoise(vec3(x.y - 19.1, x.z + 33.4, x.x + 47.2));
  float s2 = snoise(vec3(x.z + 74.2, x.x - 124.5, x.y + 99.4));
  return vec3(s, s1, s2);
}

vec3 curlNoise(vec3 p) {
  const float e = 0.1;
  vec3 dx = vec3(e, 0.0, 0.0);
  vec3 dy = vec3(0.0, e, 0.0);
  vec3 dz = vec3(0.0, 0.0, e);

  vec3 p_x0 = snoiseVec3(p - dx);
  vec3 p_x1 = snoiseVec3(p + dx);
  vec3 p_y0 = snoiseVec3(p - dy);
  vec3 p_y1 = snoiseVec3(p + dy);
  vec3 p_z0 = snoiseVec3(p - dz);
  vec3 p_z1 = snoiseVec3(p + dz);

  float x = (p_y1.z - p_y0.z) - (p_z1.y - p_z0.y);
  float y = (p_z1.x - p_z0.x) - (p_x1.z - p_x0.z);
  float z = (p_x1.y - p_x0.y) - (p_y1.x - p_y0.x);

  const float divisor = 1.0 / (2.0 * e);
  return vec3(x, y, z) * divisor;
}
`,ne=`
precision highp float;

#define NUM_BURSTS ${f}

// three's built-in position attribute holds the particle's HOME inside the unit
// sphere (length 0..1, random direction) — scaled by its burst radius at runtime.
attribute float aBurst;      // which burst sphere this particle belongs to (0..N-1)
attribute float aSize;       // world-space sprite diameter
attribute float aOpacity;    // base alpha (warm/hot solid, grey/cool faint)
attribute float aRotation;   // base sprite rotation (radians)
attribute float aSeed;       // 0..1 per-particle randomness
attribute float aSpawnOrder; // 0..1 — staggers the fast spawn fill across frames
attribute float aColorRand;  // 0..1 RANDOM warm-palette position (colour, not radial)
attribute float aFlags;      // packed: bit0 = blurred, (>>1) = colour category 0..3
attribute vec3  aTarget;     // FORMATION target (scene-group space) — metaphor objects

// Per-burst live state (written each frame on the CPU). Indexed via a masked loop
// (no dynamic indexing) so it stays portable across WebGL1/2.
uniform vec3  uBurstCenter[NUM_BURSTS]; // burst centre in scene-group space
uniform float uBurstRadius[NUM_BURSTS]; // burst sphere radius (world units)
uniform float uBurstSpawn[NUM_BURSTS];  // 0..1 spawn fill (fast ramp)
uniform float uBurstDiss[NUM_BURSTS];   // 0..1 dissipate (fade + outward drift)
uniform float uBurstSeed[NUM_BURSTS];   // per-incarnation random offset

uniform float uTime;
uniform float uNoiseFrequency; // curl spatial frequency (swirl scale)
uniform float uTimeScale;      // churn speed (noise-field evolution)
uniform float uChurnAmp;       // curl amplitude while ALIVE (fraction of radius)
uniform float uColorPhase;     // independent colour-flow phase (own slow timeline)
uniform float uColorScale;     // 3D-noise spatial frequency (flow blotch size)
uniform float uColorNoiseAmt;  // how far the noise flow shifts each particle's hue
uniform float uColorBright;    // overall brightness multiplier
uniform float uWarmSat;        // saturation boost on the warm tones (>1 = vivid)
uniform float uWarmBright;     // brightness boost on the warm tones (>1 = glowing)
uniform vec3  uGreyColor;      // clean LIGHT-COOL grey accent (minority)
uniform vec3  uHotColor;       // near-white HOT-spot colour (luminous pop)
uniform vec3  uCoolColor;      // soft blue / cyan accent (minority)
uniform float uBlurSize;       // point-size multiplier for the blurred subset
uniform float uFocalScale;     // H / (2 tan(fov/2)) — world->pixel size
uniform float uMaxPointSize;
uniform float uFormMix;        // 0 = organic burst field … 1 = fully formed target object
uniform sampler2D uPalette;    // cyclic WARM-only palette (the dominant majority)

varying vec3  vColor;
varying float vOpacity;
varying float vRotation;
varying float vBlur;

${oe}
${re}

void main() {
  // Unpack per-particle flags: blur (bit0), colour category (>> 1).
  float fBlur = mod(aFlags, 2.0);
  float cat   = floor(aFlags * 0.5); // 0 = warm, 1 = grey, 2 = hot, 3 = cool

  // --- Resolve this particle's burst state (masked loop, no dynamic index) ----
  vec3  center = vec3(0.0);
  float radius = 0.0;
  float spawn  = 0.0;
  float diss   = 0.0;
  float bseed  = 0.0;
  for (int i = 0; i < NUM_BURSTS; i++) {
    float m = step(abs(float(i) - aBurst), 0.5);
    center += uBurstCenter[i] * m;
    radius += uBurstRadius[i] * m;
    spawn  += uBurstSpawn[i]  * m;
    diss   += uBurstDiss[i]   * m;
    bseed  += uBurstSeed[i]   * m;
  }

  // Home inside this burst's sphere (unit-sphere sample * radius).
  vec3 unit = position;          // |unit| <= 1
  float rN  = length(unit);      // 0 core .. 1 surface
  vec3 home = unit * radius;

  // --- Curl-noise churn: particles move turbulently INSIDE the sphere ---------
  float t = uTime * uTimeScale;
  vec3 coord = (home + bseed * 31.7) * uNoiseFrequency + vec3(0.0, -t * 0.5, 0.0);
  vec3 flow = curlNoise(coord);
  flow += 0.45 * curlNoise(coord * 2.1 + 11.0);
  // outer particles churn more than the dense core
  float churn = uChurnAmp * radius * (0.35 + rN * 0.95);
  vec3 displaced = home + flow * churn;

  // --- Dissipate: a GENTLE outward drift, fade out fast (mostly in place) -------
  // A large outward spread turned the dissipating particles into a sparse, mixed-
  // hue cloud that averaged to grey mud; keep the drift small so they fade cleanly.
  vec3 outDir = normalize(unit + vec3(1e-4));
  displaced += outDir * (diss * radius * 0.35);
  displaced += flow * (diss * radius * 0.22);

  // --- Containment: soft-clamp inside the sphere; boundary expands as it dies --
  // Max boundary factor (at diss=1) is 1.45 — mirrored by the CPU camera fit
  // (this.fitRadius) so the canvas always encompasses the full spread (no clip).
  float bound = radius * (0.95 + diss * 0.5);
  float d = length(displaced);
  if (d > bound && bound > 1e-4) {
    float k = bound * 0.86;
    if (d > k) {
      float span = bound - k;
      float comp = span * (1.0 - exp(-(d - k) / span));
      displaced *= (k + comp) / d;
    }
  }

  // Offset into the scene group (the group is Y-rotated on the CPU, so centres orbit).
  vec3 worldPos = center + displaced;

  // --- Formation: blend toward the per-particle TARGET (a particle "object") ---
  // Seed-staggered mix assembles the object as a travelling wave (not a snap); a
  // residual fraction of the curl flow keeps the formed object alive/breathing.
  float fm = smoothstep(0.0, 1.0, clamp(uFormMix * 1.35 - aSeed * 0.35, 0.0, 1.0));
  vec3 formPos = aTarget + flow * (radius * 0.07);
  worldPos = mix(worldPos, formPos, fm);

  vec4 mv = modelViewMatrix * vec4(worldPos, 1.0);
  gl_Position = projectionMatrix * mv;

  // Perspective-correct point size; the blurred subset is enlarged into soft bokeh.
  float pix = aSize * uFocalScale / max(-mv.z, 0.001);
  pix *= mix(1.0, uBlurSize, fBlur);
  // Formed objects need FINER grain — smaller points keep glyph strokes/counters crisp.
  pix *= mix(1.0, 0.6, fm);
  gl_PointSize = clamp(pix, 0.0, uMaxPointSize);

  // --- Colour: VIVID warm majority + sparse clean accents --------------------
  // Warm tones (the ~80%+ majority) come from a random position in the warm
  // palette, flowed slowly by 3D noise, then pushed to high SATURATION + bright-
  // ness so they read as VIVID glowing embers. A small random minority are
  // recoloured: clean light-cool GREY, near-white HOT spots, or a hint of COOL.
  // Spatially-COHERENT warm hue: neighbours share a hue (smooth 3D-noise field in
  // home space), with only a small per-particle jitter. Random per-particle hues
  // made sparse / dissipating regions average mixed warm tones into grey mud; a
  // coherent field keeps every region vividly, cleanly warm instead.
  float smoothHue = snoise(home * (uColorScale + 0.8) + vec3(bseed, 0.0, uColorPhase));
  float hueCoord = fract(smoothHue * 0.5 + 0.5 + aColorRand * uColorNoiseAmt + uColorPhase * 0.05);
  vec3 warmCol = texture2D(uPalette, vec2(hueCoord, 0.5)).rgb;
  float wl = dot(warmCol, vec3(0.299, 0.587, 0.114));
  warmCol = clamp(mix(vec3(wl), warmCol, uWarmSat) * uWarmBright, 0.0, 1.0);

  float isGrey = step(0.5, cat) * step(cat, 1.5);
  float isHot  = step(1.5, cat) * step(cat, 2.5);
  float isCool = step(2.5, cat);
  float isWarm = 1.0 - isGrey - isHot - isCool;
  vec3 col = warmCol * isWarm + uGreyColor * isGrey + uHotColor * isHot + uCoolColor * isCool;

  vColor = col * uColorBright * (0.9 + aSeed * 0.2);

  // Slow per-particle spin (signed by seed) layered on the base rotation.
  vRotation = aRotation + t * 0.6 * (aSeed - 0.5);
  vBlur = fBlur;

  // --- Lifecycle opacity: staggered spawn-in, then dissipate fade-out ----------
  // Each particle fades in when the burst's spawn fill passes its own order value,
  // so the ~3000 particles fade in gradually across the spawn ramp (not all at once).
  float appear = smoothstep(aSpawnOrder, aSpawnOrder + 0.22, spawn);
  // Fade out FAST once dissipation starts (pow curve) so particles spend little
  // time in the faint, semi-transparent zone that muddies the cloud to grey.
  float fade   = pow(1.0 - diss, 1.7);
  // Outer rim softens a touch so the sphere doesn't read as a hard ball.
  float rim = 1.0 - smoothstep(0.9, 1.0, rN) * 0.35;
  vOpacity = aOpacity * appear * fade * rim;
  // Formed: hold a steady alpha — burst dissipation must not punch holes in the object.
  vOpacity = mix(vOpacity, aOpacity * 0.95 * rim, fm);
}
`,le=`
precision highp float;

uniform sampler2D uSprite;
uniform float uAspect; // sprite width / height (keeps the glyph un-squashed)
uniform float uGlow;   // extra additive lift toward the sprite centre

varying vec3  vColor;
varying float vOpacity;
varying float vRotation;
varying float vBlur;

void main() {
  vec2 pc = gl_PointCoord - 0.5;

  // Sharp glyph: rotate + aspect-correct the UVs around the centre.
  vec2 p = pc;
  float c = cos(vRotation);
  float s = sin(vRotation);
  p = mat2(c, -s, s, c) * p;
  p.x /= uAspect;
  vec2 uv = p + 0.5;
  float glyph = 0.0;
  if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) {
    glyph = texture2D(uSprite, uv).a; // sprite is pure white + alpha mask
  }

  // Blurred subset: a soft round bokeh blob (no hard glyph edge) — out of focus.
  float r = length(pc) * 2.0;            // 0 centre .. 1 sprite edge
  float blob = 1.0 - smoothstep(0.0, 1.0, r);
  blob *= blob;                          // extra-soft falloff

  float mask = mix(glyph, blob, vBlur);
  if (mask < 0.004) discard;

  vec3 color = vColor + vColor * uGlow * mask;
  // Blurred particles are a touch softer/dimmer (depth of field).
  float alpha = mask * vOpacity * mix(1.0, 0.72, vBlur);

  // PREMULTIPLIED output (rgb * a) — paired with the renderer/material premultiplied
  // setup so faint particles composite cleanly (no double-multiply darkening).
  gl_FragColor = vec4(color * alpha, alpha);
}
`,ce={particleCount:21e3,spritePath:"/sprite.png",brainPath:"/brain.obj",palette:["#EC93D8","#E9808C","#D99D26","#DD8B40","#D9B826","#E77495","#E46874","#D9A426"],warmSaturation:1,warmBrightness:1.18,greyFraction:.1,greyColor:"#FFFFFF",hotFraction:.12,hotColor:"#F8EAD9",coolFraction:0,coolColor:"#FFFFFF",colorBrightness:1,colorNoiseAmount:.3,haloRadius:2.5,sceneRadiusFrac:.6,burstRadiusFrac:.26,sceneScale:1,noiseFrequency:.7,timeScale:.22,churnAmplitude:.5,spawnDuration:.16,aliveDurationMin:4.5,aliveDurationMax:7,dissipateDurationMin:3.5,dissipateDurationMax:5,autoRotateSpeed:.54,colorCycleSpeed:.08,colorFlowScale:.7,baseSize:.06,coreSizeMultiplier:1.7,blurFraction:.2,blurSize:1.8,blending:"normal",glow:.12,background:null,fitMargin:.82,fov:45,cameraTiltDeg:15,maxPixelRatio:2,seed:1337,autoStart:!0,pauseWhenOffscreen:!0};class pe{constructor(e){this.clock=new E(!1),this.camDist=10,this.bursts=[],this.uCenter=[],this.uRadius=new Float32Array(f),this.uSpawn=new Float32Array(f),this.uDiss=new Float32Array(f),this.uSeed=new Float32Array(f),this.orbitAngle=0,this.formMix=0,this.formTarget=0,this.formSpeed=1,this.rafId=0,this.running=!1,this.elapsed=0,this.visible=!0,this.tabVisible=!0,this.disposed=!1,this.onVisibilityChange=()=>{this.tabVisible=document.visibilityState!=="hidden",this.syncRunning()},this.fps=0,this.fpsAccum=0,this.fpsFrames=0,this.loop=()=>{this.rafId=requestAnimationFrame(this.loop);const i=Math.min(this.clock.getDelta(),.05);this.elapsed+=i;const a=this.material.uniforms;if(a.uTime.value=this.elapsed,a.uColorPhase.value=this.elapsed*this.cfg.colorCycleSpeed,this.formMix!==this.formTarget){const o=i*this.formSpeed;this.formMix=this.formTarget>this.formMix?Math.min(this.formTarget,this.formMix+o):Math.max(this.formTarget,this.formMix-o),a.uFormMix.value=this.formMix}if(this.formMix>.001){const o=Math.PI*2,r=Math.round(this.orbitAngle/o)*o;this.orbitAngle+=(r-this.orbitAngle)*Math.min(1,i*2.5)*this.formMix,this.orbitAngle+=this.cfg.autoRotateSpeed*i*(1-this.formMix)}else this.orbitAngle+=this.cfg.autoRotateSpeed*i;this.updateCameraOrbit(),this.updateBursts(i),this.renderer.render(this.scene,this.camera),this.fpsAccum+=i,this.fpsFrames+=1,this.fpsAccum>=.5&&(this.fps=Math.round(this.fpsFrames/this.fpsAccum),this.fpsAccum=0,this.fpsFrames=0)},this.cfg={...ce,...e},this.container=e.container,this.boundRadius=this.cfg.haloRadius,this.sceneRadius=this.cfg.haloRadius*this.cfg.sceneRadiusFrac,this.maxBurstRadius=this.boundRadius*this.cfg.burstRadiusFrac*1.24,this.fitRadius=(this.sceneRadius+this.maxBurstRadius*1.45)*1.06,this.camTilt=w.degToRad(this.cfg.cameraTiltDeg),this.rng=C(this.cfg.seed),this.renderer=new V({alpha:!0,antialias:!0,premultipliedAlpha:!0,powerPreference:"high-performance"}),this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,this.cfg.maxPixelRatio)),this.renderer.outputColorSpace=z,this.renderer.toneMapping=G,this.cfg.background===null?this.renderer.setClearColor(0,0):this.renderer.setClearColor(this.cfg.background,1);const t=this.renderer.domElement;t.style.display="block",t.style.width="100%",t.style.height="100%",this.container.appendChild(t),this.scene=new H,this.camera=new j(this.cfg.fov,1,.1,100),this.camera.position.set(0,0,10),this.camera.lookAt(0,0,0),this.group=new L,this.group.scale.setScalar(this.cfg.sceneScale),this.scene.add(this.group),this.palette=ue(this.cfg.palette),this.texture=new q,new $().load(this.cfg.spritePath,i=>{if(i.colorSpace=z,i.minFilter=Y,i.magFilter=F,i.generateMipmaps=!0,i.anisotropy=this.renderer.capabilities.getMaxAnisotropy(),i.needsUpdate=!0,this.disposed){i.dispose();return}this.texture.dispose(),this.texture=i,this.material.uniforms.uSprite.value=i;const a=i.image;a&&a.height&&(this.material.uniforms.uAspect.value=a.width/a.height)});for(let i=0;i<f;i++)this.uCenter.push(new R);this.initBursts(),this.geometry=this.buildGeometry(),this.material=this.buildMaterial(),this.points=new J(this.geometry,this.material),this.points.frustumCulled=!1,this.group.add(this.points),this.updateBursts(0),this.applySize(),this.resizeObserver=new ResizeObserver(()=>this.resize()),this.resizeObserver.observe(this.container),this.cfg.pauseWhenOffscreen&&(document.addEventListener("visibilitychange",this.onVisibilityChange),this.intersectionObserver=new IntersectionObserver(i=>{var a;this.visible=((a=i[0])==null?void 0:a.isIntersecting)??!0,this.syncRunning()},{threshold:0}),this.intersectionObserver.observe(t)),this.cfg.autoStart&&this.start()}start(){this.disposed||(this.running=!0,this.syncRunning())}stop(){this.running=!1,this.clock.stop(),this.rafId&&(cancelAnimationFrame(this.rafId),this.rafId=0)}resize(){this.disposed||this.applySize()}setScrollProgress(e){}setFormation(e,t=1.1){if(this.disposed)return;if(this.formSpeed=1/Math.max(.001,t),!e||e.length<3){this.formTarget=0;return}const s=this.geometry.getAttribute("aTarget"),i=s.array,a=i.length/3,o=Math.floor(e.length/3),r=C((this.cfg.seed^85635710)>>>0),l=this.boundRadius*.016;for(let c=0;c<a;c++){const d=c%o*3;i[c*3]=e[d]+(r()-.5)*l,i[c*3+1]=e[d+1]+(r()-.5)*l,i[c*3+2]=e[d+2]+(r()-.5)*l}s.needsUpdate=!0,this.formTarget=1}setParams(e){if(this.disposed)return;const t=this.material.uniforms;e.noiseFrequency!==void 0&&(t.uNoiseFrequency.value=e.noiseFrequency),e.timeScale!==void 0&&(t.uTimeScale.value=e.timeScale),e.churnAmplitude!==void 0&&(t.uChurnAmp.value=e.churnAmplitude),e.glow!==void 0&&(t.uGlow.value=e.glow),e.colorBrightness!==void 0&&(t.uColorBright.value=e.colorBrightness),e.colorNoiseAmount!==void 0&&(t.uColorNoiseAmt.value=e.colorNoiseAmount),e.warmSaturation!==void 0&&(t.uWarmSat.value=e.warmSaturation),e.warmBrightness!==void 0&&(t.uWarmBright.value=e.warmBrightness),e.autoRotateSpeed!==void 0&&(this.cfg.autoRotateSpeed=e.autoRotateSpeed),e.colorCycleSpeed!==void 0&&(this.cfg.colorCycleSpeed=e.colorCycleSpeed)}dispose(){var t,s,i;if(this.disposed)return;this.disposed=!0,this.stop(),(t=this.resizeObserver)==null||t.disconnect(),(s=this.intersectionObserver)==null||s.disconnect(),document.removeEventListener("visibilitychange",this.onVisibilityChange),this.group.remove(this.points),this.scene.remove(this.group),this.geometry.dispose(),this.material.dispose(),this.texture.dispose(),this.palette.dispose(),this.renderer.dispose();const e=this.renderer.domElement;(i=e.parentNode)==null||i.removeChild(e)}syncRunning(){const e=this.running&&this.visible&&this.tabVisible&&!this.disposed;e&&!this.rafId?(this.clock.start(),this.loop()):!e&&this.rafId&&(this.clock.stop(),cancelAnimationFrame(this.rafId),this.rafId=0)}initBursts(){for(let e=0;e<f;e++){const t=this.makeBurst();t.age=this.rng()*t.total,this.bursts.push(t)}}makeBurst(){const e=this.cfg.spawnDuration*(.8+this.rng()*.5),t=g(this.cfg.aliveDurationMin,this.cfg.aliveDurationMax,this.rng()),s=g(this.cfg.dissipateDurationMin,this.cfg.dissipateDurationMax,this.rng()),i=this.boundRadius*this.cfg.burstRadiusFrac*(.82+this.rng()*.42);return{center:this.randomSceneCenter(),radius:i,seed:this.rng()*100,age:0,spawnDur:e,aliveDur:t,dissipateDur:s,total:e+t+s}}randomSceneCenter(){const e=D(this.rng),t=this.sceneRadius*(.45+.55*Math.cbrt(this.rng()));return e.multiplyScalar(t)}updateBursts(e){for(let s=0;s<f;s++){const i=this.bursts[s];i.age+=e,i.age>=i.total&&(this.bursts[s]=this.makeBurst());const a=this.bursts[s],o=a.age;let r,l;o<a.spawnDur?(r=o/a.spawnDur,l=0):o<a.spawnDur+a.aliveDur?(r=1,l=0):(r=1,l=(o-a.spawnDur-a.aliveDur)/a.dissipateDur),this.uCenter[s].copy(a.center),this.uRadius[s]=a.radius,this.uSpawn[s]=r,this.uDiss[s]=w.clamp(l,0,1),this.uSeed[s]=a.seed}const t=this.material.uniforms;t.uBurstCenter.value=this.uCenter,t.uBurstRadius.value=this.uRadius,t.uBurstSpawn.value=this.uSpawn,t.uBurstDiss.value=this.uDiss,t.uBurstSeed.value=this.uSeed}applySize(){const e=Math.max(1,this.container.clientWidth),t=Math.max(1,this.container.clientHeight);this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,this.cfg.maxPixelRatio)),this.renderer.setSize(e,t,!1);const s=e/t;this.camera.aspect=s;const i=Math.tan(w.degToRad(this.cfg.fov)/2),a=this.cfg.fitMargin,o=this.fitRadius/(a*i),r=this.fitRadius/(a*i*s);this.camDist=Math.max(o,r),this.camera.updateProjectionMatrix(),this.updateCameraOrbit(),this.updateFocalScale()}updateCameraOrbit(){const e=this.camDist*Math.cos(this.camTilt),t=this.camDist*Math.sin(this.camTilt),s=this.orbitAngle;this.camera.position.set(Math.cos(s)*e,t,Math.sin(s)*e),this.camera.up.set(0,1,0),this.camera.lookAt(0,0,0)}updateFocalScale(){const t=this.renderer.domElement.height/(2*Math.tan(w.degToRad(this.cfg.fov)/2));this.material.uniforms.uFocalScale.value=t}buildMaterial(){return new K({uniforms:{uSprite:{value:this.texture},uPalette:{value:this.palette},uAspect:{value:128/183},uTime:{value:0},uNoiseFrequency:{value:this.cfg.noiseFrequency},uTimeScale:{value:this.cfg.timeScale},uChurnAmp:{value:this.cfg.churnAmplitude},uBurstCenter:{value:this.uCenter},uBurstRadius:{value:this.uRadius},uBurstSpawn:{value:this.uSpawn},uBurstDiss:{value:this.uDiss},uBurstSeed:{value:this.uSeed},uColorPhase:{value:0},uColorScale:{value:this.cfg.colorFlowScale},uColorNoiseAmt:{value:this.cfg.colorNoiseAmount},uColorBright:{value:this.cfg.colorBrightness},uWarmSat:{value:this.cfg.warmSaturation},uWarmBright:{value:this.cfg.warmBrightness},uGreyColor:{value:M(this.cfg.greyColor)},uHotColor:{value:M(this.cfg.hotColor)},uCoolColor:{value:M(this.cfg.coolColor)},uBlurSize:{value:this.cfg.blurSize},uGlow:{value:this.cfg.glow},uFocalScale:{value:1e3},uMaxPointSize:{value:2048},uFormMix:{value:0}},vertexShader:ne,fragmentShader:le,transparent:!0,premultipliedAlpha:!0,depthTest:!1,depthWrite:!1,blending:this.cfg.blending==="additive"?Q:X})}buildGeometry(){const e=this.cfg.particleCount,t=C((this.cfg.seed^2654435769)>>>0),s=Math.max(1,Math.floor(e/f)),i=new Float32Array(e*3),a=new Float32Array(e),o=new Float32Array(e),r=new Float32Array(e),l=new Float32Array(e),c=new Float32Array(e),d=new Float32Array(e),y=new Float32Array(e),m=new Float32Array(e),O=this.cfg.blurFraction,A=this.cfg.greyFraction,N=this.cfg.coolFraction,k=this.cfg.hotFraction;for(let u=0;u<e;u++){const x=u*3,_=Math.min(f-1,Math.floor(u/s));a[u]=_;const S=D(t),b=t()<.07?1-.12*t():Math.cbrt(t());i[x]=S.x*b,i[x+1]=S.y*b,i[x+2]=S.z*b;let v=0;const B=t();B<A?v=1:B<A+N&&(v=3),v===0&&t()<k*(1-b)&&(v=2);const I=g(this.cfg.coreSizeMultiplier,.85,T(0,1,b));o[u]=this.cfg.baseSize*I*(.6+t()*.8);const U=v===0||v===2?g(.98,.84,T(0,1,b))*(.9+t()*.1):.94*(.88+t()*.12);r[u]=w.clamp(U,0,1),l[u]=t()*Math.PI*2,c[u]=t(),d[u]=t(),y[u]=t();const W=t()<O?1:0;m[u]=W+v*2}const h=new Z;return h.setAttribute("position",new p(i,3)),h.setAttribute("aBurst",new p(a,1)),h.setAttribute("aSize",new p(o,1)),h.setAttribute("aOpacity",new p(r,1)),h.setAttribute("aRotation",new p(l,1)),h.setAttribute("aSeed",new p(c,1)),h.setAttribute("aSpawnOrder",new p(d,1)),h.setAttribute("aColorRand",new p(y,1)),h.setAttribute("aFlags",new p(m,1)),h.setAttribute("aTarget",new p(new Float32Array(e*3),3)),h}}function C(n){let e=n>>>0;return()=>{e|=0,e=e+1831565813|0;let t=Math.imul(e^e>>>15,1|e);return t=t+Math.imul(t^t>>>7,61|t)^t,((t^t>>>14)>>>0)/4294967296}}function D(n){const e=n()*2-1,t=n()*Math.PI*2,s=Math.sqrt(Math.max(0,1-e*e));return new R(s*Math.cos(t),e,s*Math.sin(t))}function g(n,e,t){return n+(e-n)*t}function T(n,e,t){const s=w.clamp((t-n)/(e-n),0,1);return s*s*(3-2*s)}function P(n){const e=n.replace("#","");return[parseInt(e.slice(0,2),16),parseInt(e.slice(2,4),16),parseInt(e.slice(4,6),16)]}function M(n){const[e,t,s]=P(n);return new R(e/255,t/255,s/255)}function ue(n){const t=new Uint8Array(1024),s=n.map(P),i=s.length;for(let o=0;o<256;o++){const r=o/256*i,l=Math.floor(r)%i,c=r-Math.floor(r),d=s[l],y=s[(l+1)%i],m=o*4;t[m]=Math.round(g(d[0],y[0],c)),t[m+1]=Math.round(g(d[1],y[1],c)),t[m+2]=Math.round(g(d[2],y[2],c)),t[m+3]=255}const a=new ee(t,256,1,te);return a.wrapS=ie,a.wrapT=se,a.minFilter=F,a.magFilter=F,a.colorSpace=ae,a.needsUpdate=!0,a}export{pe as ParticleDrop,pe as default};
