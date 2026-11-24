/* =============================================================================
   kelp-underwater.js
   -----------------------------------------------------------------------------
   Full underwater ecosystem ported from kelp3 into WebGL2 Three.js, adapted
   seamlessly as the living depth & bed beneath every lake, river, estuary,
   and swamp in island21.

   Features streamed around the active camera / boat with exact world-terrain
   grounding (never floating, never breaching above water or onto dry land):
     - Giant kelp (Macrocystis): tangled root holdfast cones, gracefully bowing
       bundled stipes climbing from seabed and arching along under the surface,
       pneumatocyst gas-filled golden floats, spiraling translucent ruffled
       blades with warm golden subsurface backlighting and flowing caustics
     - Low waving sugar kelp & finger kelp ribbons streaming downstream with
       real river flowX/flowZ velocity and gentle lake orbital surge
     - Floor understory growth: clumped swaying eelgrass/seagrass beds around
       boulders & clearings, branching mossy fan-weeds, ochre/rose reef sponges
     - Sculpted stratified underwater boulders & outcrops with rose coralline
       (#c88a8a) and olive-moss (#8a9a5a) crusts + loose rounded cobbles/pebbles
     - Overhead subsurface golden-olive canopy frond rafts under deep lakes
     - Animated multi-species swimming fish schools (silvery sardines/shiners,
       golden-orange garibaldi/sunfish, olive kelp bass/river trout, blue jacks)
     - Articulated sideways-scuttling floor rock crabs on open sandy clearings
     - Intermittent streams of sunlit wobbling, expanding rising bubble threads
     - Volumetric downward underwater god-ray sun shafts, drifting marine snow,
       and immersive depth-colored kelp3 Beer-Lambert atmosphere on Dive mode
     - Interactive stir ripple that gently parts nearby kelp and fish
 ============================================================================= */

import * as THREE from "three";

const TILE_SIZE = 32;
const WATER_Y = 0.0;

// Deterministic fast PRNG (Lehmer / mulberry32)
function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix, iz) {
  let h = (Math.imul(ix | 0, 374761393) + Math.imul(iz | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function fbm3(x, y, z) {
  const s = (a, b, c) =>
    Math.sin(a * 1.7 + Math.cos(b * 2.1 - c * 1.3)) *
    Math.cos(b * 1.9 + Math.sin(c * 1.6 + a * 1.1));
  return (
    s(x, y, z) * 0.52 +
    s(x * 2.13 + 3.1, y * 2.07 - 1.7, z * 2.19 + 0.9) * 0.28 +
    s(x * 4.31 - 2.3, y * 4.17 + 4.1, z * 4.09 - 3.2) * 0.14 +
    s(x * 8.1 + 1.2, y * 7.9 - 2.6, z * 8.3 + 5.4) * 0.06
  );
}

// Bilinear sampler for world Float32Array fields
function sampleField(world, arr, lx, lz) {
  const N = world.N;
  const fx = (lx + world.half) / world.cell - 0.5;
  const fz = (lz + world.half) / world.cell - 0.5;
  const x0 = Math.max(0, Math.min(N - 2, Math.floor(fx)));
  const z0 = Math.max(0, Math.min(N - 2, Math.floor(fz)));
  const u = Math.max(0, Math.min(1, fx - x0));
  const v = Math.max(0, Math.min(1, fz - z0));
  const k = z0 * N + x0;
  const a = arr[k] + (arr[k + 1] - arr[k]) * u;
  const b = arr[k + N] + (arr[k + N + 1] - arr[k + N]) * u;
  return a + (b - a) * v;
}

function sampleWaterProps(world, lx, lz) {
  const N = world.N;
  const fx = (lx + world.half) / world.cell - 0.5;
  const fz = (lz + world.half) / world.cell - 0.5;
  if (fx < 1 || fz < 1 || fx >= N - 2 || fz >= N - 2) return null;
  const h = sampleField(world, world.h, lx, lz);
  const depth = -h;
  if (depth < 0.34) return null;
  const inl = sampleField(world, world.inl, lx, lz);
  const ix = Math.max(0, Math.min(N - 1, Math.round(fx)));
  const iz = Math.max(0, Math.min(N - 1, Math.round(fz)));
  const idx = iz * N + ix;
  const wet = world.wet[idx] === 1;
  if (!wet && inl < 0.58) return null;
  if (inl < 0.48) return null;
  const flowX = sampleField(world, world.flowX, lx, lz);
  const flowZ = sampleField(world, world.flowZ, lx, lz);
  const flowSpd = Math.hypot(flowX, flowZ);
  const isLake = world.lakeId && world.lakeId[idx] >= 0 ? 1 : 0;
  const rawSwamp = world.swamp ? sampleField(world, world.swamp, lx, lz) : 0;
  const fastMain = Math.max(0, Math.min(1, (flowSpd - 0.48) / 0.36));
  const swamp = Math.max(0, Math.min(1, ((rawSwamp - 0.26) / 0.34) * (1 - isLake * 0.92) * (1 - fastMain * 0.7)));
  const river = Math.max(0, Math.min(1, (flowSpd - 0.08) / 0.30)) * (1 - isLake * 0.84) * (1 - swamp * 0.78);
  const lake = Math.max(0, 1 - Math.max(river, swamp));
  const nav = world.navMask && world.navMask[idx] === 1 ? 1 : 0;
  return { h, depth, flowX, flowZ, flowSpd, river, swamp, lake, isLake, nav };
}

/* ---------------------------------------------------------------------------
   Shared GLSL underwater utilities (faithful kelp3 optics + caustics + swell)
   --------------------------------------------------------------------------- */
const KELP_GLSL = /* glsl */ `
float kHash(vec2 p){
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float kNoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(kHash(i), kHash(i + vec2(1.0, 0.0)), f.x),
    mix(kHash(i + vec2(0.0, 1.0)), kHash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}
// Dual-layer kelp3 Voronoi bright shimmering caustic filament net
float kCausticCell(vec2 q, float t){
  vec2 i = floor(q), f = q - i;
  float d1 = 8.0, d2 = 8.0;
  for(int y = -1; y <= 1; y++){
    for(int x = -1; x <= 1; x++){
      vec2 g = vec2(float(x), float(y));
      vec2 hh = vec2(kHash(i + g), kHash(i + g + vec2(17.3, 9.1)));
      vec2 o = 0.5 + 0.37 * sin(t * (0.72 + 0.55 * hh) + 6.28318 * hh.yx);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if(d < d1){ d2 = d1; d1 = d; }
      else if(d < d2){ d2 = d; }
    }
  }
  return sqrt(d2) - sqrt(d1);
}
float kCaustics(vec3 wp, vec2 flow, float t){
  // Project along tilted sunlight vector so patterns drift accurately across depth
  vec2 p = wp.xz + wp.y * vec2(0.24, -0.18) + flow * t * 0.38;
  vec2 warp = vec2(kNoise(p * 0.35 + t * 0.12), kNoise(p * 0.35 - t * 0.1 + 5.7)) - 0.5;
  vec2 q = (p + warp * 0.72) * 0.62;
  float a = 1.0 - smoothstep(0.0, 0.17, kCausticCell(q, t * 1.12));
  float b = 1.0 - smoothstep(0.0, 0.18, kCausticCell(q * 1.42 + vec2(7.1, -4.3), -t * 0.92 + 2.1));
  return a * 0.6 + b * 0.45 + a * b * 1.15;
}
// Traveling kelp3 water surge + steady flow push + interactive stir impulse
vec2 kSway(vec3 wp, float hFrac, vec2 flow, float t, vec4 stir){
  float phase = dot(wp.xz, vec2(0.24, 0.16)) - t * 0.88;
  float crossP = dot(wp.xz, vec2(-0.19, 0.27)) + t * 0.58;
  float bend = hFrac * hFrac;
  vec2 orb = vec2(cos(phase) * 0.52 + sin(crossP) * 0.22, sin(phase * 0.91 + 0.8) * 0.44 + cos(crossP) * 0.18);
  float spd = length(flow);
  // Real running river drags ribbons gracefully downstream while keeping ripple flutter
  vec2 push = flow * (1.85 + 0.48 * sin(t * 2.1 - hFrac * 3.8 + wp.x * 0.35));
  vec2 off = orb * (0.42 + 0.25 * (1.0 - min(spd, 1.0))) * bend + push * pow(max(hFrac, 0.0), 1.25);
  // Interactive click/hover stir surge (from kelp3 stir.ts)
  if(stir.w > 0.01){
    vec2 sd = wp.xz - stir.xz;
    float r = length(sd);
    float ring = exp(-r * r * 0.055) * sin(r * 1.1 - t * 5.0 + 1.2);
    off += (sd / max(r, 0.15)) * ring * stir.w * 0.75 * hFrac;
  }
  return off;
}
// Exact kelp3 rich jewel red-first Beer-Lambert water color + vertical sunlit shallow->deep gradient
vec3 kUnderFog(vec3 col, vec3 wp, float dist, float river, float swamp, float uLight, float uStorm, float sub){
  float lit = max(uLight, 0.09) * (1.0 - 0.42 * uStorm);
  // Saturated BBC Blue Planet / kelp3 palette: jewel sea-teal lake (#5fb3a4 -> #0a2730),
  // radiant crystalline jade river, haunting steep golden-olive amber blackwater swamp!
  vec3 sh = mix(mix(vec3(0.13, 0.45, 0.45), vec3(0.11, 0.38, 0.28), river), vec3(0.14, 0.19, 0.068), swamp) * lit;
  vec3 dp = mix(mix(vec3(0.014, 0.098, 0.138), vec3(0.015, 0.088, 0.070), river), vec3(0.016, 0.026, 0.010), swamp) * lit;
  float hBand = clamp(1.0 - max(-wp.y, 0.0) / 11.5, 0.0, 1.0);
  vec3 waterHue = mix(dp, sh, pow(hBand, 1.45));
  // Subtle downwelling red absorption preserves radiant warm amber golden kelp up close, cools gently deep down
  float dCol = max(-wp.y, 0.0);
  vec3 downExt = mix(mix(vec3(0.10, 0.050, 0.045), vec3(0.13, 0.072, 0.085), river), vec3(0.24, 0.20, 0.36), swamp);
  col *= mix(vec3(1.0), exp(-downExt * dCol), 0.62);
  if(sub > 0.5){
    // Smooth dramatic foreground crispness fading silkily into rich mysterious underwater kelp-cathedral depth!
    float murk = mix(mix(0.052, 0.068, river), 0.102, swamp);
    vec3 absorb = mix(vec3(2.35, 1.02, 0.86), vec3(1.42, 1.08, 1.65), swamp);
    vec3 tr = exp(-absorb * murk * dist);
    // Fade towards exactly what the backdrop shows in this direction, so distant
    // kelp and rock melt into the water instead of forming a pale band at the horizon.
    vec3 vd = normalize(wp - cameraPosition);
    float lk = clamp(1.0 - river - swamp, 0.0, 1.0);
    vec3 fTop = (vec3(0.18, 0.56, 0.55) * lk + vec3(0.14, 0.46, 0.34) * river + vec3(0.17, 0.23, 0.082) * swamp) * lit;
    vec3 fMid = (vec3(0.045, 0.24, 0.29) * lk + vec3(0.046, 0.21, 0.16) * river + vec3(0.055, 0.086, 0.032) * swamp) * lit;
    vec3 fBot = (vec3(0.012, 0.082, 0.122) * lk + vec3(0.014, 0.076, 0.060) * river + vec3(0.014, 0.022, 0.009) * swamp) * lit;
    vec3 fogCol = vd.y >= 0.0
      ? mix(fMid, fTop, pow(clamp(vd.y, 0.0, 1.0), 0.62))
      : mix(fMid, fBot, pow(clamp(-vd.y, 0.0, 1.0), 0.72));
    fogCol *= 0.62 + 0.38 * exp(-max(-cameraPosition.y, 0.0) * 0.045);
    col = mix(fogCol, col, clamp(tr, 0.0, 1.0));
  } else {
    // Seen through refracted surface from above: richly dark & saturated golden-olive against bright rippled sand!
    float vFade = 1.0 - exp(-dCol * mix(mix(0.055, 0.085, river), 0.18, swamp));
    col = mix(col, waterHue * 0.85, vFade * 0.40);
  }
  return col;
}
`;

/* ---------------------------------------------------------------------------
   Procedural geometry constructors (all modeled tightly on kelp3 designs)
   --------------------------------------------------------------------------- */

// Smooth high-detail sculpted underwater boulders (indexed merged vertices for crisp smooth shading, zero faceted triangles!)
function buildBoulderGeometries() {
  const out = [];
  for (let v = 0; v < 4; v++) {
    // Indexed SphereGeometry produces silky smooth continuous vertex normals across water-worn curved ridges
    const geo = new THREE.SphereGeometry(1, 20, 14);
    const pos = geo.attributes.position;
    const rng = makeRng(7331 + v * 197);
    const ox = rng() * 10, oy = rng() * 10, oz = rng() * 10;
    const sx = 1.08 + rng() * 0.52;
    const sy = v === 2 ? 0.44 + rng() * 0.18 : 0.62 + rng() * 0.36;
    const sz = 0.94 + rng() * 0.44;
    const strata = v === 1 ? 0.09 : 0.04;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const n1 = fbm3(x * 1.2 + ox, y * 1.2 + oy, z * 1.2 + oz);
      const n2 = fbm3(x * 2.6 - oz, y * 2.6 + ox, z * 2.6 - oy);
      const step = Math.sin(y * 7.2 + n1 * 2.4) * strata;
      const flatTop = y > 0.32 ? (y - 0.32) * 0.18 : 0;
      const flatBase = y < -0.25 ? 0.65 : 1.0;
      const disp = 1 + n1 * 0.27 + n2 * 0.10 + step - flatTop;
      x *= sx * disp;
      y = y * flatBase * sy * disp + sy * 0.22;
      z *= sz * disp;
      pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    out.push(geo);
  }
  return out;
}

// Smooth water-worn river/lake pebble geometry
function buildPebbleGeometry() {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const d = 1 + 0.14 * Math.sin(x * 2.4 + z * 1.8) + 0.08 * Math.cos(y * 3.1 - x * 2.2);
    pos.setXYZ(i, x * 1.18 * d, (y * 0.48 + 0.18) * d, z * 0.94 * d);
  }
  geo.computeVertexNormals();
  return geo;
}

// Signature kelp3 Macrocystis giant kelp: organically sinuous helical stipe,
// lush thick branching haptera holdfast mound, plump sunlit pear-shaped gas floats
// (pneumatocysts), and 20 silky high-segment gracefully undulating golden-amber blades!
function buildGiantKelpGeometry(highDetail = true) {
  const positions = [];
  const normals = [];
  const infos = []; // (hFrac, kind[0=stipe,1=blade,2=float,3=holdfast], alongBlade, side)
  const indices = [];

  const pushTri = (a, b, c) => indices.push(a, b, c);
  const addVert = (x, y, z, nx, ny, nz, hf, kind, along, side) => {
    const idx = positions.length / 3;
    positions.push(x, y, z);
    normals.push(nx, ny, nz);
    infos.push(hf, kind, along, side);
    return idx;
  };

  // Smooth naturally curving botanical stipe helix (zero rigid flagpole verticals!)
  const stemX = (t) => Math.sin(t * 4.2 + 0.4) * (0.04 + 0.19 * t) + Math.sin(t * 8.1) * 0.025;
  const stemZ = (t) => Math.cos(t * 3.6 - 0.3) * (0.04 + 0.17 * t) - 0.04 + Math.cos(t * 7.3) * 0.022;

  const segs = highDetail ? 18 : 11;
  const sides = highDetail ? 6 : 4;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const r = (1 - t * 0.44) * 0.036;
    const ox = stemX(t), oz = stemZ(t);
    for (let s = 0; s <= sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      addVert(ox + ca * r, t, oz + sa * r, ca, 0.12, sa, t, 0, t, 0);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let s = 0; s < sides; s++) {
      const a = i * (sides + 1) + s;
      const b = a + sides + 1;
      pushTri(a, b, a + 1);
      pushTri(a + 1, b, b + 1);
    }
  }

  // Tangled arched haptera holdfast root dome gripping rocky seafloor (kelp3 plants.tsx)
  const roots = highDetail ? 10 : 6;
  for (let r = 0; r < roots; r++) {
    const ang = (r / roots) * Math.PI * 2 + (r % 3) * 0.21;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const reach = 0.32 + (r % 3) * 0.13;
    const topY = 0.075 + (r % 2) * 0.032;
    const rSegs = 5;
    const start = positions.length / 3;
    for (let i = 0; i <= rSegs; i++) {
      const u = i / rSegs;
      const rad = u * reach;
      const wiggle = Math.sin(u * 5.2 + r) * 0.045 * u;
      const py = topY * Math.pow(1 - u, 1.45) - u * 0.032;
      const w = (1 - u * 0.65) * 0.052;
      const px = ca * rad - sa * wiggle, pz = sa * rad + ca * wiggle;
      addVert(px - sa * w, py, pz + ca * w, -sa * 0.35, 0.92, ca * 0.35, Math.max(0, py), 3, u, -1);
      addVert(px + sa * w, py, pz - ca * w, sa * 0.35, 0.92, -ca * 0.35, Math.max(0, py), 3, u, 1);
    }
    for (let i = 0; i < rSegs; i++) {
      const a = start + i * 2;
      pushTri(a, a + 2, a + 1);
      pushTri(a + 1, a + 2, a + 3);
    }
  }

  // Smooth, silky, organically curving kelp3 Macrocystis ribbon blades + glossy pear pneumatocyst floats!
  // Built cleanly with high smooth curvature & slender graceful tapering tips (zero spiky fold artifacts!)
  const nodeCount = highDetail ? 22 : 13;
  const bladeSeg = highDetail ? 10 : 6;
  for (let n = 0; n < nodeCount; n++) {
    const hf = 0.09 + (n / (nodeCount - 1)) * 0.89;
    const ang = n * 2.3999632 + Math.sin(n * 1.4) * 0.18;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const sx = stemX(hf), sz = stemZ(hf);
    const sizeCurve = 0.62 + 0.54 * Math.sin(hf * Math.PI * 0.86) + 0.14 * hf;
    // Authentic Macrocystis long narrow silky waving blades (slender kelp3 proportions, ~0.9-1.5m x 0.16m)
    const len = (0.76 + ((n * 37) % 11) * 0.052) * sizeCurve;
    const maxW = (0.095 + ((n * 19) % 7) * 0.011) * sizeCurve;
    const liftArc = 0.010 + ((n * 13) % 5) * 0.003;
    const tipDrop = 0.052 + ((n * 7) % 5) * 0.014;
    const twist = (n % 2 === 0 ? 1 : -1) * (0.52 + (n % 5) * 0.10);

    // Smooth plump teardrop gas pneumatocyst float connecting stipe to base of each blade
    const fb = positions.length / 3;
    const fx = sx + ca * 0.068, fz = sz + sa * 0.068, fr = 0.036;
    addVert(sx + ca * 0.012, hf, sz + sa * 0.012, 0, 1, 0, hf, 2, 0, 0);
    addVert(fx, hf + fr * 0.45, fz, 0, 1, 0, hf, 2, 0.5, 0);
    addVert(fx - sa * fr * 0.62, hf + fr * 0.08, fz + ca * fr * 0.62, -sa, 0.6, ca, hf, 2, 0.5, -1);
    addVert(fx + sa * fr * 0.62, hf + fr * 0.08, fz - ca * fr * 0.62, sa, 0.6, -ca, hf, 2, 0.5, 1);
    addVert(sx + ca * 0.132, hf + 0.005, sz + sa * 0.132, ca, 0.6, sa, hf, 2, 1, 0);
    pushTri(fb, fb + 1, fb + 2);
    pushTri(fb, fb + 3, fb + 1);
    pushTri(fb + 1, fb + 4, fb + 2);
    pushTri(fb + 1, fb + 3, fb + 4);

    // Silky smooth elongated bullate kelp frond (10 smooth curved strips, no jagged fold edges!)
    const bs = positions.length / 3;
    for (let k = 0; k <= bladeSeg; k++) {
      const u = k / bladeSeg;
      // Exact graceful lance silhouette: swells softly right after the float, flows ribbon-smooth to a delicate point
      const outline = Math.pow(Math.sin(Math.pow(u, 0.56) * Math.PI), 0.82) * (1 - 0.10 * u);
      const w = maxW * outline;
      const dist = 0.11 + u * len;
      const sideS = Math.sin(u * Math.PI * 1.45 + n * 1.3) * 0.095 * len * u;
      // Arch softly up off float then languidly cascade downward like hanging weighted golden satin underwater!
      const dy = Math.sin(u * Math.PI * 0.72) * liftArc - Math.pow(u, 1.85) * tipDrop;
      // Gentle smooth helical wave along the ribbon width (always smooth across neighboring segments)
      const roll = twist * u * 0.85;
      const cr = Math.cos(roll), sr = Math.sin(roll);
      const edgeRipple = Math.sin(u * 9.42 + n * 2.1) * 0.008 * outline;
      const ex = -sa * w * cr;
      const ez = ca * w * cr;
      const ey = w * sr * 0.14;
      const cx = sx + ca * dist - sa * sideS;
      const cz = sz + sa * dist + ca * sideS;
      const cy = hf + dy;
      const nX = -sa * sr * 0.55, nY = cr * 0.88 + 0.22, nZ = ca * sr * 0.55;
      addVert(cx + ex, cy + ey + edgeRipple, cz + ez, nX - sa * 0.18, nY, nZ + ca * 0.18, hf, 1, u, -1);
      addVert(cx, cy + 0.003, cz, nX, Math.max(nY, 0.65), nZ, hf, 1, u, 0);
      addVert(cx - ex, cy - ey - edgeRipple, cz - ez, nX + sa * 0.18, nY, nZ - ca * 0.18, hf, 1, u, 1);
    }
    for (let k = 0; k < bladeSeg; k++) {
      const a = bs + k * 3;
      pushTri(a, a + 3, a + 1);
      pushTri(a + 1, a + 3, a + 4);
      pushTri(a + 1, a + 4, a + 2);
      pushTri(a + 2, a + 4, a + 5);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("aInfo", new THREE.Float32BufferAttribute(infos, 4));
  geo.setIndex(indices);
  return geo;
}

// Low streaming sugar kelp / finger kelp / river pondweed ruffled ribbon clump (3 curved streaming ribbons per instance)
function buildSugarRibbonGeometry() {
  const pos = [], norm = [], uv = [], idx = [];
  const ribbons = 3;
  const segs = 9;
  for (let r = 0; r < ribbons; r++) {
    const ang = (r / ribbons) * Math.PI * 2 + r * 0.42;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const rLen = 0.78 + (r === 0 ? 0.34 : r === 1 ? 0.14 : -0.05);
    const maxW = 0.16 + (r === 0 ? 0.06 : 0.02);
    const start = pos.length / 3;
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      // Classic bullate undulating kelp3 sugar-kelp silhouette
      const w = maxW * Math.sin(Math.pow(u, 0.52) * Math.PI) * (0.85 + 0.22 * Math.sin(u * 14 + r));
      const y = u * rLen;
      const spread = u * u * 0.28;
      const ruffle = Math.sin(u * 15.7 + r * 2.3) * 0.06 * u;
      const bx = ca * spread;
      const bz = sa * spread;
      const base = start + i * 3;
      pos.push(
        bx - sa * w + ca * ruffle, y, bz + ca * w + sa * ruffle,
        bx, y, bz,
        bx + sa * w - ca * ruffle, y, bz - ca * w - sa * ruffle
      );
      norm.push(
        ca * 0.85, 0.5, sa * 0.85,
        ca * 0.6, 0.8, sa * 0.6,
        ca * 0.85, 0.5, sa * 0.85
      );
      uv.push(u, -1, r / ribbons, u, 0, r / ribbons, u, 1, r / ribbons);
      if (i < segs) {
        idx.push(base, base + 3, base + 1, base + 1, base + 3, base + 4);
        idx.push(base + 1, base + 4, base + 2, base + 2, base + 4, base + 5);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(norm, 3));
  geo.setAttribute("aRibbon", new THREE.Float32BufferAttribute(uv, 3));
  geo.setIndex(idx);
  return geo;
}

// Clumped fanning eelgrass / seagrass blades (kelp3 floor Growth)
function buildEelgrassGeometry() {
  const pos = [], norm = [], uv = [], idx = [];
  const blades = 7;
  const segs = 5;
  const rng = makeRng(4117);
  for (let b = 0; b < blades; b++) {
    const a = (b / blades) * Math.PI * 2 + (rng() - 0.5) * 0.55;
    const ca = Math.cos(a), sa = Math.sin(a);
    const ox = ca * (0.04 + rng() * 0.14);
    const oz = sa * (0.04 + rng() * 0.14);
    const h = 0.62 + rng() * 0.56;
    const arch = 0.18 + rng() * 0.28;
    const w0 = 0.042 + rng() * 0.025;
    const start = pos.length / 3;
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const w = w0 * (1 - u * 0.88);
      const px = ox + ca * arch * u * u;
      const pz = oz + sa * arch * u * u;
      const py = h * (u - 0.14 * u * u * u);
      pos.push(px - sa * w, py, pz + ca * w, px + sa * w, py, pz - ca * w);
      norm.push(ca * 0.4, 0.9, sa * 0.4, ca * 0.4, 0.9, sa * 0.4);
      uv.push(u, b / blades, u, b / blades);
    }
    for (let i = 0; i < segs; i++) {
      const k = start + i * 2;
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(norm, 3));
  geo.setAttribute("aBlade", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

// Sculpted horizontal subsurface golden kelp / sargassum canopy raft (kelp3 rafts.tsx)
function buildRaftGeometry() {
  const pos = [], norm = [], info = [], idx = [];
  const fronds = 5;
  for (let f = 0; f < fronds; f++) {
    const ang = (f / fronds) * Math.PI * 2 + f * 0.35;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const len = 1.45 + (f % 3) * 0.42;
    const start = pos.length / 3;
    const segs = 6;
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const dist = u * len;
      const w = 0.36 * Math.sin(Math.pow(u, 0.55) * Math.PI) * (0.8 + 0.25 * Math.sin(u * 12 + f));
      const y = -0.05 * Math.sin(u * Math.PI) - u * 0.08 + Math.sin(u * 9 + f) * 0.025;
      const cx = ca * dist + -sa * Math.sin(u * 3.1 + f) * 0.22;
      const cz = sa * dist + ca * Math.sin(u * 3.1 + f) * 0.22;
      pos.push(cx - sa * w, y, cz + ca * w, cx, y + 0.02, cz, cx + sa * w, y, cz - ca * w);
      norm.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
      info.push(u, -1, u, 0, u, 1);
      if (i < segs) {
        const k = start + i * 3;
        idx.push(k, k + 3, k + 1, k + 1, k + 3, k + 4, k + 1, k + 4, k + 2, k + 2, k + 4, k + 5);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(norm, 3));
  geo.setAttribute("aInfo", new THREE.Float32BufferAttribute(info, 2));
  geo.setIndex(idx);
  return geo;
}

// Sleek anatomical swimming fish geometry (+Z forward = nose at +0.5, tail at -0.55)
function buildFishGeometry() {
  const pos = [], norm = [], idx = [];
  const rings = 9;
  const sides = 6;
  // Cross-section profile from head (u=0 -> z=+0.5) to tail base (u=1 -> z=-0.38)
  for (let i = 0; i <= rings; i++) {
    const u = i / rings;
    const z = 0.5 - u * 0.88;
    const profile = u < 0.001 ? 0.004 : Math.sin(Math.pow(u, 0.55) * Math.PI) * (1 - 0.18 * u);
    const rx = Math.max(0.003, profile * 0.115);
    const ry = Math.max(0.004, profile * 0.21);
    for (let s = 0; s <= sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      const cx = Math.cos(a), sy = Math.sin(a);
      pos.push(cx * rx, sy * ry, z);
      norm.push(cx, sy * 0.7, u < 0.2 ? 0.35 : -0.15);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let s = 0; s < sides; s++) {
      const a = i * (sides + 1) + s;
      const b = a + sides + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  // Forked caudal tail fin
  const t0 = pos.length / 3;
  pos.push(
    0, 0.03, -0.34,
    0, -0.03, -0.34,
    0, 0.21, -0.60,
    0, 0.0, -0.49,
    0, -0.20, -0.60
  );
  for (let k = 0; k < 5; k++) norm.push(1, 0.1, 0);
  idx.push(t0, t0 + 2, t0 + 3, t0, t0 + 3, t0 + 1, t0 + 1, t0 + 3, t0 + 4);
  // Swept dorsal fin
  const d0 = pos.length / 3;
  pos.push(0, 0.17, 0.14, 0, 0.31, -0.02, 0, 0.12, -0.22);
  norm.push(1, 0.2, 0, 1, 0.2, 0, 1, 0.2, 0);
  idx.push(d0, d0 + 1, d0 + 2);
  // Subtle pectoral fins
  for (const sgn of [-1, 1]) {
    const p0 = pos.length / 3;
    pos.push(sgn * 0.09, -0.05, 0.18, sgn * 0.24, -0.12, -0.02, sgn * 0.08, -0.09, 0.02);
    norm.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
    idx.push(p0, p0 + 1, p0 + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(norm, 3));
  geo.setIndex(idx);
  return geo;
}

// Articulated rock crab (kelp3 crabs.tsx: contoured shell + pinchers + 8 stepping legs)
function buildCrabGeometry() {
  const pos = [], norm = [], legTag = [], idx = [];
  const addBox = (cx, cy, cz, sx, sy, sz, ry, tag) => {
    const c = Math.cos(ry), s = Math.sin(ry);
    const start = pos.length / 3;
    const g = new THREE.BoxGeometry(sx, sy, sz);
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
      pos.push(cx + vx * c - vz * s, cy + vy, cz + vx * s + vz * c);
      const nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i);
      norm.push(nx * c - nz * s, ny, nx * s + nz * c);
      legTag.push(tag);
    }
    const gi = g.index;
    for (let i = 0; i < gi.count; i++) idx.push(start + gi.getX(i));
    g.dispose();
  };
  // Wide rounded carapace
  const shell = new THREE.SphereGeometry(1, 8, 5);
  const sp = shell.attributes.position, sn = shell.attributes.normal;
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i) * 0.22;
    const y = Math.max(-0.04, sp.getY(i) * 0.085) + 0.085;
    const z = sp.getZ(i) * 0.165;
    pos.push(x, y, z);
    norm.push(sn.getX(i), sn.getY(i), sn.getZ(i));
    legTag.push(0);
  }
  for (let i = 0; i < shell.index.count; i++) idx.push(shell.index.getX(i));
  shell.dispose();
  // Two curved forward pinchers
  for (const sg of [-1, 1]) {
    addBox(sg * 0.22, 0.08, 0.19, 0.14, 0.055, 0.09, sg * 0.52, 0.5);
  }
  // 8 splayed walking legs (4 each side, alternating stride phase tags)
  for (let k = 0; k < 4; k++) {
    const zOff = 0.085 - k * 0.068;
    const ang = -0.3 + k * 0.22;
    for (const sg of [-1, 1]) {
      const tag = ((k + (sg > 0 ? 0 : 1)) % 2 === 0) ? 1 : 2;
      addBox(sg * 0.28, 0.065, zOff, 0.18, 0.028, 0.032, sg * ang, tag);
      addBox(sg * 0.37, 0.025, zOff + Math.sin(ang) * 0.06, 0.09, 0.052, 0.024, sg * ang, tag);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(norm, 3));
  geo.setAttribute("aLeg", new T