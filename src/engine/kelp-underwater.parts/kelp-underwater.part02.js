HREE.Float32BufferAttribute(legTag, 1));
  geo.setIndex(idx);
  return geo;
}

// Sculpted multi-lobe encrusting reef sponge / rosette anemone mound (kelp3 Growth)
function buildSpongeGeometry() {
  const pos = [], norm = [], part = [], idx = [];
  const lobes = [
    [0, 0.14, 0, 0.18, 0.22, 0.17],
    [0.14, 0.10, 0.07, 0.13, 0.16, 0.13],
    [-0.12, 0.11, 0.08, 0.12, 0.18, 0.12],
    [0.02, 0.10, -0.14, 0.14, 0.15, 0.13],
  ];
  for (let l = 0; l < lobes.length; l++) {
    const [cx, cy, cz, rx, ry, rz] = lobes[l];
    const g = new THREE.SphereGeometry(1, 7, 5);
    const p = g.attributes.position, n = g.attributes.normal;
    const start = pos.length / 3;
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
      // Tiny dimpled chimney top (classic encrusting sea/river sponge!)
      const cup = vy > 0.72 ? -0.16 * (vy - 0.72) : 0;
      pos.push(cx + vx * rx, Math.max(0, cy + (vy + cup) * ry), cz + vz * rz);
      norm.push(n.getX(i), n.getY(i), n.getZ(i));
      part.push(Math.max(0, (vy + 0.6) * 0.6));
    }
    for (let i = 0; i < g.index.count; i++) idx.push(start + g.index.getX(i));
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(norm, 3));
  geo.setAttribute("aTip", new THREE.Float32BufferAttribute(part, 1));
  geo.setIndex(idx);
  return geo;
}

/* ---------------------------------------------------------------------------
   Main Ecosystem Class: KelpUnderwaterSystem
   --------------------------------------------------------------------------- */
export class KelpUnderwaterSystem {
  constructor(sharedU, getField, quality = "medium") {
    this.U = sharedU;
    this.getField = getField;
    this.quality = quality;
    this.group = new THREE.Group();
    this.group.name = "kelp3-underwater";

    // Separate submerged-only volumetric atmosphere group (light shafts, snow, dome)
    this.subGroup = new THREE.Group();
    this.subGroup.name = "kelp3-submerged-atmo";
    this.subGroup.visible = false;
    this.group.add(this.subGroup);

    // Extra shared underwater uniforms synced every frame
    this.KU = {
      uTime: sharedU.uTime,
      uSun: sharedU.uSun,
      uSunCol: sharedU.uSunCol,
      uLight: sharedU.uLight,
      uStorm: sharedU.uStorm,
      uNight: sharedU.uNight,
      uSubmerged: { value: 0 },
      uFadeDist: { value: 118 },
      uStir: { value: new THREE.Vector4(0, -100, 0, 0) },
      uCamBiome: { value: new THREE.Vector3(1, 0, 0) }, // (lake, river, swamp)
      uCamDepth: { value: 0 },
      uCamFlow: { value: new THREE.Vector2(0, 0) },
    };

    // Tier knobs
    this._applyQuality(quality);

    // Shared geometries
    this.boulderGeos = buildBoulderGeometries();
    this.pebbleGeo = buildPebbleGeometry();
    this.kelpGeo = buildGiantKelpGeometry(quality !== "lowest" && quality !== "lower");
    this.sugarGeo = buildSugarRibbonGeometry();
    this.grassGeo = buildEelgrassGeometry();
    this.raftGeo = buildRaftGeometry();
    this.fishGeo = buildFishGeometry();
    this.crabGeo = buildCrabGeometry();
    this.spongeGeo = buildSpongeGeometry();

    // Shared WebGL2 shader materials
    this.materials = this._createMaterials();

    // Submerged volumetric atmosphere (dome, light shafts, marine snow)
    this._buildSubmergedAtmosphere();

    // Active tiles map
    this.tiles = new Map();
    this.pending = [];
    this.lastKey = "";
    this.frame = 0;
    this.isSubmerged = false;
  }

  _applyQuality(q) {
    const map = {
      lowest: { radius: 52, density: 0.35, keep: 24, shafts: 10, snow: 280 },
      lower:  { radius: 68, density: 0.55, keep: 36, shafts: 14, snow: 420 },
      low:    { radius: 88, density: 0.72, keep: 48, shafts: 18, snow: 620 },
      medium: { radius: 112, density: 0.92, keep: 72, shafts: 26, snow: 900 },
      high:   { radius: 136, density: 1.15, keep: 104, shafts: 34, snow: 1200 },
    };
    this.tier = map[q] || map.medium;
    this.KU.uFadeDist.value = this.tier.radius + 14;
  }

  setQuality(q) {
    if (this.quality === q) return;
    this.quality = q;
    this._applyQuality(q);
    this.clear();
  }

  // Trigger a gentle kelp3 circular water stir at world (x, y, z)
  stirAt(x, y, z, strength = 1.4) {
    this.KU.uStir.value.set(x, y, z, Math.min(2.0, strength));
  }

  _createMaterials() {
    const U = this.KU;

    // 1. Sculpted encrusted reef boulders & pebbles (coralline rose + olive moss + kelp3 caustics!)
    const rockMat = new THREE.ShaderMaterial({
      uniforms: U,
      vertexShader: /* glsl */ `
        attribute vec4 aBiome; // river, swamp, tint, isPebble
        varying vec3 vW, vN;
        varying vec4 vB;
        varying float vLocalY;
        void main(){
          vec4 wm = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vW = wm.xyz;
          vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
          vB = aBiome;
          vLocalY = position.y;
          gl_Position = projectionMatrix * viewMatrix * wm;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime, uLight, uStorm, uNight, uSubmerged, uFadeDist;
        uniform vec3 uSun, uSunCol;
        varying vec3 vW, vN;
        varying vec4 vB;
        varying float vLocalY;
        ${KELP_GLSL}
        void main(){
          vec3 N = normalize(vN);
          float dist = length(cameraPosition - vW);
          if(dist > uFadeDist + 16.0) discard;
          float river = vB.x, swamp = vB.y, tint = vB.z, isPeb = vB.w;
          float gran = kNoise(vW.xz * 3.2 + vW.y * 2.1) * 0.6 + kNoise(vW.xz * 11.5) * 0.4;
          // Stratified natural limestone/granite stone base + variegated mineral pebbles
          vec3 lakeStone = mix(vec3(0.28, 0.30, 0.27), vec3(0.50, 0.48, 0.42), tint * 0.65 + gran * 0.35);
          vec3 rivStone = mix(vec3(0.24, 0.26, 0.25), vec3(0.54, 0.49, 0.40), tint);
          rivStone = mix(rivStone, vec3(0.32, 0.38, 0.37), smoothstep(0.62, 0.85, tint) * 0.65);
          vec3 swStone = mix(vec3(0.11, 0.12, 0.08), vec3(0.22, 0.21, 0.14), gran);
          vec3 base = mix(mix(lakeStone, rivStone, river), swStone, swamp);
          // Tactile micro-bump lighting simulating water-worn stone surface grain & pores
          float bx = kNoise(vW.xz * 7.5 + vec2(0.12, 0.0)) - kNoise(vW.xz * 7.5 - vec2(0.12, 0.0));
          float bz = kNoise(vW.xz * 7.5 + vec2(0.0, 0.12)) - kNoise(vW.xz * 7.5 - vec2(0.0, 0.12));
          N = normalize(N + vec3(-bx, 0.0, -bz) * 0.52);
          // Signature kelp3 reef crusts: velvet olive-gold moss (#8a9a5a) + dusty rose coralline algae (#c88a8a)!
          float up = smoothstep(0.10, 0.72, N.y);
          float crustN = kNoise(vW.xz * 1.4 + vec2(vW.y * 0.9, 2.3));
          float mossM = up * smoothstep(0.26, 0.68, crustN) * (1.0 - isPeb * 0.52);
          float coralM = up * smoothstep(0.50, 0.78, kNoise(vW.xz * 2.0 - 4.7)) * (1.0 - river * 0.72) * (1.0 - swamp) * (1.0 - isPeb * 0.68);
          vec3 mossCol = mix(mix(vec3(0.32, 0.40, 0.16), vec3(0.18, 0.32, 0.11), river), vec3(0.16, 0.25, 0.075), swamp);
          vec3 coralCol = vec3(0.68, 0.42, 0.44);
          base = mix(base, mossCol, mossM * (0.68 + 0.24 * swamp));
          base = mix(base, coralCol, coralM * 0.62);
          // Rich bottom rock crevice AO + natural micro cavity darkening
          float ao = mix(0.46, 1.0, smoothstep(-0.22, 0.58, vLocalY)) * (0.84 + 0.30 * gran);
          vec3 bentSun = normalize(vec3(uSun.x * 0.52, max(uSun.y, 0.40), uSun.z * 0.52));
          float nl = max(dot(N, bentSun), 0.0);
          float lit = max(uLight, 0.08) * (1.0 - 0.38 * uStorm);
          vec3 amb = mix(vec3(0.14, 0.33, 0.34), vec3(0.14, 0.20, 0.085), swamp) * (0.48 + 0.52 * max(N.y, 0.0)) * lit;
          vec3 sunL = uSunCol * nl * 0.50 * (1.0 - 0.52 * uStorm) * (1.0 - swamp * 0.42);
          // Vivid sparkling liquid kelp3 Voronoi caustic ribbons washing directly across boulder domes & river pebbles!
          float depth = max(-vW.y, 0.0);
          float cFade = smoothstep(0.05, 0.45, depth) * (1.0 - smoothstep(10.0, 20.0, depth)) * (1.0 - swamp * 0.50);
          float caus = pow(max(kCaustics(vW, vec2(river * 0.38, 0.0), uTime), 0.0), 1.15) * max(N.y, 0.10) * cFade * smoothstep(0.01, 0.18, uSun.y) * (1.0 - 0.6 * uStorm);
          vec3 col = base * ao * (amb + sunL + vec3(0.014, 0.026, 0.036) * uNight);
          vec3 cGlow = mix(vec3(0.48, 0.72, 0.58), vec3(0.66, 0.58, 0.24), swamp);
          col += base * (uSunCol * 0.38 + cGlow * lit) * caus * (uSubmerged > 0.5 ? 1.45 : 1.08);
          col = kUnderFog(col, vW, dist, river, swamp, uLight, uStorm, uSubmerged);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });

    // 2. Giant kelp forests (Macrocystis: stipes, holdfasts, pneumatocyst floats, spiraling translucent blades!)
    const kelpMat = new THREE.ShaderMaterial({
      uniforms: U,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        attribute vec4 aInfo;   // hFrac, kind(0=stipe,1=blade,2=float,3=holdfast), along, side
        attribute vec4 aRoot;   // rootX, rootY, rootZ, height
        attribute vec4 aFlow;   // flowX, flowZ, phase, leanAngle
        attribute vec4 aBiome;  // river, swamp, hueShift, canopyScale
        uniform float uTime;
        uniform vec4 uStir;
        varying vec3 vW, vN;
        varying vec4 vInfo, vBiome;
        varying float vDepth;
        ${KELP_GLSL}
        void main(){
          float hf = aInfo.x;
          float kind = aInfo.y;
          float along = aInfo.z;
          float bSide = aInfo.w;
          float len = aRoot.w;
          float ang = aFlow.w;
          float ph = aFlow.z;
          float ca = cos(ang), sa = sin(ang);
          float hScale = max(len, 0.8);
          float bladeS = aBiome.w;

          // Local vertex offset rotated cleanly around stem
          vec3 lp = position;
          float isHold = step(2.5, kind);
          float rx = (lp.x * ca - lp.z * sa) * mix(bladeS, max(0.95, bladeS * 1.25), isHold);
          float rz = (lp.x * sa + lp.z * ca) * mix(bladeS, max(0.95, bladeS * 1.25), isHold);
          float wy = aRoot.y + (isHold > 0.5 ? lp.y * min(hScale, 4.2) : lp.y * hScale);

          // Organic living column sway: river flow drags tall stalks cleanly downstream, lakes heave gently
          vec3 stemW = vec3(aRoot.x, wy, aRoot.z);
          float swayAmt = isHold > 0.5 ? 0.0 : hf;
          vec2 flow = aFlow.xy;
          vec2 sw = kSway(stemW + vec3(ph * 0.13, 0.0, ph * 0.07), swayAmt, flow, uTime, uStir);
          // Smooth exponential soft-cap curves tall mature giant kelp cleanly along y = -0.22 surface canopy
          // (keeping blades silky flat & flowing horizontally beneath water without any hard crimp!)
          float avail = max(-aRoot.y - 0.24, 0.55);
          float rawRise = wy - aRoot.y;
          float over = max(rawRise - avail * 0.78, 0.0);
          float softOver = over / (1.0 + over * 0.12);
          float fLen = length(flow);
          vec2 driftDir = fLen > 0.06 ? flow / fLen : vec2(cos(ph * 0.55 + 0.4), sin(ph * 0.55 + 0.4));
          float ceilDepth = -0.22 - 0.18 * fract(ph * 0.37) - (rawRise - over) * 0.0;
          float cappedY = min(aRoot.y + rawRise - over * 0.90, ceilDepth);
          // Smooth blade flattening as stems trail along surface so they never fold sharply
          vec2 canopySpread = driftDir * softOver * 1.42;

          // Smooth languid silk-ribbon blade flutter synced naturally to water current
          float flutter = 0.0;
          float edgeY = 0.0;
          if(kind > 0.5 && kind < 1.5){
            float fSpd = 1.9 + fLen * 2.2;
            flutter = sin(uTime * fSpd - along * 4.4 + ph + hf * 6.5) * 0.11 * along;
            edgeY = cos(uTime * (fSpd * 0.8) - along * 3.6 + ph * 1.3) * 0.042 * along * bSide;
            // Gently stream flexible kelp leaves downstream with active current
            rx += flow.x * along * 0.72 * bladeS;
            rz += flow.y * along * 0.72 * bladeS;
          }

          // Graceful undulating vertical spine S-bend + arched golden cathedral canopy
          float leanArc = sin(hf * 1.57) * 0.56 * (1.0 - isHold);
          vec2 postLean = vec2(cos(ph * 0.43), sin(ph * 0.43)) * leanArc;
          float finY = cappedY + edgeY;
          if(finY > -0.18) finY = -0.18 - (finY + 0.18) * 0.08;
          vec3 wp = vec3(
            aRoot.x + rx + postLean.x + sw.x * 1.15 + canopySpread.x + flutter * (-sa),
            finY,
            aRoot.z + rz + postLean.y + sw.y * 1.15 + canopySpread.y + flutter * ca
          );
          // Gently part close kelp curtains sideways as you glide through underwater (true tactile dive feel!)
          if(cameraPosition.y < -0.1 && isHold < 0.5){
            vec2 cd = wp.xz - cameraPosition.xz;
            float cr = length(cd);
            float part = (1.0 - smoothstep(0.6, 2.8, cr)) * smoothstep(0.08, 0.35, hf);
            wp.xz += (cd / max(cr, 0.08)) * part * 1.55;
          }
          // Re-clamp holdfast snugly flush on seabed rock
          if(isHold > 0.5){
            wp.y = aRoot.y + lp.y * min(hScale * 0.55, 2.2);
          }

          vec3 rn = vec3(normal.x * ca - normal.z * sa, normal.y, normal.x * sa + normal.z * ca);
          vW = wp;
          vN = normalize(rn);
          vInfo = aInfo;
          vBiome = aBiome;
          vDepth = max(-wp.y, 0.0);
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime, uLight, uStorm, uNight, uSubmerged, uFadeDist;
        uniform vec3 uSun, uSunCol;
        varying vec3 vW, vN;
        varying vec4 vInfo, vBiome;
        varying float vDepth;
        ${KELP_GLSL}
        void main(){
          float dist = length(cameraPosition - vW);
          if(dist > uFadeDist + 14.0) discard;
          float hf = vInfo.x, kind = vInfo.y, along = vInfo.z, side = abs(vInfo.w);
          float river = vBiome.x, swamp = vBiome.y, hue = vBiome.z;
          float lit = max(uLight, 0.09) * (1.0 - 0.36 * uStorm);

          // Rich iconic kelp3 Macrocystis palette: lustrous deep honey-amber bronze (#8a6a22 -> #d8a636)
          // shining warmly like stained cathedral glass against deep turquoise teal!
          // River: vibrant streaming emerald-amber gold | Swamp: deep rich antique olive-amber
          // True warm golden-amber-bronze kelp3 giant kelp (#9a6e1c backlit -> #4f350a deep bronze!)
          // Pops heroically like liquid stained-glass amber against luminous jewel teal lakes,
          // vibrant rich olive-gold against emerald rivers, warm deep bronze-moss inside moody swamps!
          vec3 lakeBlade = mix(vec3(0.36, 0.20, 0.032), vec3(0.72, 0.45, 0.068), clamp(hue * 0.50 + hf * 0.54, 0.0, 1.0));
          vec3 rivBlade  = mix(vec3(0.16, 0.28, 0.046), vec3(0.54, 0.49, 0.088), clamp(hue * 0.50 + hf * 0.52, 0.0, 1.0));
          vec3 swBlade   = mix(vec3(0.18, 0.19, 0.038), vec3(0.46, 0.34, 0.065), clamp(hue * 0.48 + hf * 0.52, 0.0, 1.0));
          vec3 bladeCol = mix(mix(lakeBlade, rivBlade, river), swBlade, swamp);

          // Rich dark honey midrib grading softly to luminous translucent golden bullate corrugated margins!
          float wr = sin(along * 40.0 + side * 7.2 + hue * 14.0) * 0.5 + 0.5;
          float cell = kNoise(vec2(along * 20.0, side * 10.0) + hue * 11.0);
          float vein = mix(0.68, 1.24, smoothstep(0.05, 0.85, side)) * (0.78 + 0.26 * wr + 0.18 * cell);
          bladeCol *= vein * mix(0.68, 1.20, along * 0.32 + hf * 0.68);

          vec3 stipeCol = mix(vec3(0.24, 0.145, 0.036), vec3(0.18, 0.20, 0.048), river * 0.5 + swamp * 0.45);
          vec3 floatCol = mix(vec3(0.84, 0.56, 0.10), vec3(0.68, 0.58, 0.12), river * 0.42);
          vec3 holdCol  = mix(vec3(0.22, 0.16, 0.065), vec3(0.14, 0.14, 0.055), swamp);
          vec3 base = kind < 0.5 ? stipeCol : (kind < 1.5 ? bladeCol : (kind < 2.5 ? floatCol : holdCol));
          // Vertical canopy shadow graduation: grounded moody base rising into glowing backlit crown!
          base *= mix(0.56, 1.16, smoothstep(0.0, 0.72, hf));

          // Subtle geometric + bullate ripple normal for living silky leaf lighting
          vec3 N = normalize(vN + vec3(wr - 0.5, 0.0, cell - 0.5) * 0.26 * step(0.5, kind));
          if(!gl_FrontFacing) N = -N;
          vec3 V = normalize(cameraPosition - vW);
          vec3 L = normalize(vec3(uSun.x * 0.52, max(uSun.y, 0.44), uSun.z * 0.52));
          float frontL = max(dot(N, L), 0.0);
          float wrapL = clamp((dot(N, L) + 0.45) / 1.45, 0.0, 1.0);
          float isBlade = step(0.5, kind) * step(kind, 2.5);
          float topSun = smoothstep(12.5, 0.2, vDepth);

          // True cathedral stained-glass warm amber backlit translucency on Macrocystis leaves!
          float backLit = pow(clamp(dot(-V, L) * 0.5 + 0.55, 0.0, 1.0), 2.1);
          float thinEdge = 0.42 + 0.58 * side;
          vec3 amberGlow = mix(mix(vec3(0.95, 0.66, 0.14), vec3(0.62, 0.74, 0.17), river), vec3(0.66, 0.52, 0.12), swamp);
          vec3 sss = amberGlow * isBlade * (0.22 + 0.62 * backLit) * thinEdge * (0.35 + 0.65 * topSun) * lit * (1.0 - 0.55 * uStorm);

          // Bright dappled undulating golden caustics glittering over every blade
          float caus = kCaustics(vW, vec2(river * 0.35, 0.0), uTime) * smoothstep(13.0, 0.4, vDepth) * (1.0 - swamp * 0.48) * (1.0 - 0.58 * uStorm);
          vec3 amb = mix(vec3(0.14, 0.32, 0.32), vec3(0.14, 0.18, 0.08), swamp) * (0.65 + 0.35 * max(N.y, 0.0)) * lit;
          vec3 col = base * (amb + uSunCol * (frontL * 0.44 + wrapL * 0.24) * (1.0 - 0.48 * uStorm) + vec3(0.012, 0.022, 0.028) * uNight);
          col += sss * 0.58;
          col += base * mix(vec3(0.68, 0.74, 0.42), vec3(0.56, 0.72, 0.44), river) * caus * 0.92 * lit;

          // Subtle glossy sunlit highlight along slim smooth wet kelp margins & bulbous gas floats
          if(isBlade > 0.5){
            float rim = pow(1.0 - abs(dot(N, V)), 2.4) * topSun;
            col += amberGlow * rim * (uSubmerged > 0.5 ? 0.36 : 0.14) * lit;
          }

          col = kUnderFog(col, vW, dist, river, swamp, uLight, uStorm, uSubmerged);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });

    // 3. Sugar kelp / finger kelp / river ribbonweed low corrugated ribbons (kelp3 sugar.tsx)
    const sugarMat = new THREE.ShaderMaterial({
      uniforms: U,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        attribute vec3 aRibbon; // u(along), side(-1..1), strandIdx
        attribute vec4 aRoot;   // x, y, z, scale
        attribute vec4 aFlow;   // fx, fz, phase, rot
        attribute vec3 aBiome;  // river, swamp, hue
        uniform float uTime;
        uniform vec4 uStir;
        varying vec3 vW, vN;
        varying vec3 vRibbon, vBiome;
        ${KELP_GLSL}
        void main(){
          float u = aRibbon.x;
          float side = aRibbon.y;
          float sId = aRibbon.z;
          float sc = aRoot.w;
          float ph = aFlow.z + sId * 4.2;
          float ca = cos(aFlow.w), sa = sin(aFlow.w);
          vec2 flow = aFlow.xy;
          float fSpd = length(flow);

          // Scale base shape
          float rx = (position.x * ca - position.z * sa) * sc;
          float rz = (position.x * sa + position.z * ca) * sc;
          float ry = position.y * sc;

          // Undulating traveling silk wave from anchor to ruffled streaming tip!
          float waveSpd = 1.65 + fSpd * 3.0;
          float flutter = sin(uTime * waveSpd - u * 6.2 + ph) * 0.22 * sc * pow(u, 1.15);
          float arch = fSpd > 0.08 ? min(fSpd * 1.45, 0.85) : 0.22;
          vec2 streamDir = fSpd > 0.06 ? flow / fSpd : vec2(cos(ph * 0.5), sin(ph * 0.5));
          vec2 sw = kSway(vec3(aRoot.x, aRoot.y + ry, aRoot.z), u, flow * 0.9, uTime, uStir);

          // River current bends ribbons flat and graceful like silk pennants right along the riverbed
          float flatY = mix(ry, ry * (1.0 - 0.58 * arch * u), smoothstep(0.05, 0.8, u));
          vec2 streamExt = streamDir * (ry * arch * 1.38);
          vec2 perp = vec2(-streamDir.y, streamDir.x);

          vec3 wp = vec3(
            aRoot.x + rx + sw.x * 0.65 + streamExt.x + perp.x * flutter,
            min(aRoot.y + flatY + 0.03 * side * sin(u * 12.0 - uTime * 2.5 + ph), -0.10),
            aRoot.z + rz + sw.y * 0.65 + streamExt.y + perp.y * flutter
          );
          vW = wp;
          vN = normalize(vec3(normal.x * ca - normal.z * sa, max(normal.y, 0.45), normal.x * sa + normal.z * ca));
          vRibbon = aRibbon;
          vBiome = aBiome;
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime, uLight, uStorm, uNight, uSubmerged, uFadeDist;
        uniform vec3 uSun, uSunCol;
        varying vec3 vW, vN, vRibbon, vBiome;
        ${KELP_GLSL}
        void main(){
          float dist = length(cameraPosition - vW);
          if(dist > uFadeDist + 10.0) discard;
          float u = vRibbon.x, edge = abs(vRibbon.y);
          float river = vBiome.x, swamp = vBiome.y, hue = vBiome.z;
          float lit = max(uLight, 0.09) * (1.0 - 0.36 * uStorm);

          // Rich golden-bronze kelp3 sugar kelp (#7a5c1c -> #b88a28), luminous emerald-amber streaming river kelp, deep bronze-moss swamp
          vec3 lkC = mix(vec3(0.32, 0.22, 0.052), vec3(0.62, 0.46, 0.115), hue * 0.52 + u * 0.48);
          vec3 rvC = mix(vec3(0.10, 0.28, 0.072), vec3(0.36, 0.48, 0.118), hue * 0.48 + u * 0.52);
          vec3 swC = mix(vec3(0.12, 0.18, 0.048), vec3(0.30, 0.33, 0.088), hue * 0.50 + u * 0.50);
          vec3 base = mix(mix(lkC, rvC, river), swC, swamp);
          // Bullate crinkled sugar-kelp margin shading + darker root base
          float crinkle = 0.90 + 0.14 * sin(u * 28.0 + edge * 4.5 + hue * 9.0);
          base *= crinkle * mix(0.62, 1.15, u);

          vec3 N = normalize(vN); if(!gl_FrontFacing) N = -N;
          vec3 L = normalize(vec3(uSun.x * 0.5, max(uSun.y, 0.42), uSun.z * 0.5));
          float depth = max(-vW.y, 0.0);
          float caus = kCaustics(vW, vec2(river * 0.4, 0.0), uTime) * smoothstep(10.5, 0.3, depth) * (1.0 - swamp * 0.55) * (1.0 - 0.58 * uStorm);
          vec3 amb = mix(vec3(0.18, 0.38, 0.33), vec3(0.16, 0.22, 0.11), swamp) * lit;
          vec3 col = base * (amb + uSunCol * (0.28 + 0.35 * max(dot(N, L), 0.0)) * (1.0 - 0.5 * uStorm));
          // Glowing backlit translucent edges (makes streaming underwater rivers glow like emerald silk!)
          col += base * vec3(0.58, 0.68, 0.34) * (0.24 + 0.38 * edge) * lit * smoothstep(8.0, 0.4, depth);
          col += base * vec3(0.44, 0.62, 0.48) * caus * 0.72 * lit;
          col = kUnderFog(col, vW, dist, river, swamp, uLight, uStorm, uSubmerged);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });

    // 4. Floor eelgrass / seagrass meadows (kelp3 floor.tsx Growth)
    const grassMat = new THREE.ShaderMaterial({
      uniforms: U,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        attribute vec2 aBlade; // u, id
        attribute vec4 aRoot;  // x, y, z, scale
        attribute vec4 aFlow;  // fx, fz, phase, rot
        attribute vec3 aBiome; // river, swamp, hue
        uniform float uTime;
        uniform vec4 uStir;
        varying vec3 vW;
        varying vec2 vBlade;
        varying vec3 vBiome;
        ${KELP_GLSL}
        void main(){
          float u = aBlade.x;
          float sc = aRoot.w;
          float ca = cos(aFlow.w), sa = sin(aFlow.w);
          float rx = (position.x * ca - position.z * sa) * sc;
          float rz = (position.x * sa + position.z * ca) * sc;
          float ry = position.y * sc;
          float ph = aFlow.z + aBlade.y * 5.2;
          vec2 flow = aFlow.xy;
          vec2 sw = kSway(vec3(aRoot.x, aRoot.y + ry, aRoot.z), u, flow * 0.85, uTime, uStir);
          float tipW = sin(uTime * (2.0 + length(flow) * 2.2) + ph - u * 3.1) * 0.14 * sc * u * u;
          vec3 wp = vec3(
            aRoot.x + rx + sw.x * 0.55 + tipW,
            min(aRoot.y + ry * (1.0 - min(length(flow) * 0.36, 0.42) * u), -0.07),
            aRoot.z + rz + sw.y * 0.55 + tipW * 0.6
          );
          vW = wp;
          vBlade = aBlade;
          vBiome = aBiome;
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime, uLight, uStorm, uSubmerged, uFadeDist;
        uniform vec3 uSun, uSunCol;
        varying vec3 vW;
        varying vec2 vBlade;
        varying vec3 vBiome;
        ${KELP_GLSL}
        void main(){
          float dist = length(cameraPosition - vW);
          if(dist > uFadeDist) discard;
          float u = vBlade.x;
          float river = vBiome.x, swamp = vBiome.y, hue = vBiome.z;
          float lit = max(uLight, 0.09) * (1.0 - 0.38 * uStorm);
          vec3 rootC = mix(vec3(0.08, 0.18, 0.07), vec3(0.09, 0.14, 0.05), swamp);
          vec3 tipC = mix(mix(vec3(0.28, 0.48, 0.16), vec3(0.26, 0.52, 0.18), river), vec3(0.24, 0.34, 0.11), swamp);
          tipC *= 0.85 + 0.32 * hue;
          vec3 base = mix(rootC, tipC, pow(u, 0.8));
          float depth = max(-vW.y, 0.0);
          float caus = kCaustics(vW, vec2(river * 0.35, 0.0), uTime) * smoothstep(9.5, 0.25, depth) * (1.0 - swamp * 0.55) * (1.0 - 0.55 * uStorm);
          vec3 col = base * (mix(vec3(0.22, 0.44, 0.36), vec3(0.22, 0.28, 0.14), swamp) * lit + uSunCol * (0.28 + 0.22 * u) * (1.0 - 0.5 * uStorm));
          col += base * vec3(0.42, 0.60, 0.42) * caus * 0.68 * lit;
          col = kUnderFog(col, vW, dist, river, swamp, uLight, uStorm, uSubmerged);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });

    // 5. Reef encrusting sponges / mossy polyps (kelp3 floor accents: ochre, olive, soft rose-coral)
    const spongeMat = new THREE.ShaderMaterial({
      uniforms: U,
      vertexShader: /* glsl */ `
        attribute float aTip;
        attribute vec4 aBiome; // river, swamp, kind(0..1), shade
        varying vec3 vW, vN;
        varying float vTip;
        varying vec4 vB;
        void main(){
          vec4 wm = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vW = wm.xyz;
          vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
          vTip = aTip;
          vB = aBiome;
          gl_Position = projectionMatrix * viewMatrix * wm;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime, uLight, uStorm, uSubmerged, uFadeDist;
        uniform vec3 uSun, uSunCol;
        varying vec3 vW, vN;
        varying float vTip;
        varying vec4 vB;
        ${KELP_GLSL}
        void main(){
          float dist = length(cameraPosition - vW);
          if(dist > uFadeDist * 0.85) discard;
          float river = vB.x, swamp = vB.y, kind = vB.z;
          float lit = max(uLight, 0.09) * (1.0 - 0.38 * uStorm);
          // Warm ochre-gold sponge, dusty pink coralline rosette, bright fresh moss-green river sponge
          vec3 c0 = vec3(0.66, 0.46, 0.19);
          vec3 c1 = vec3(0.68, 0.39, 0.36);
          vec3 c2 = vec3(0.28, 0.48, 0.20);
          vec3 colB = kind < 0.38 ? c0 : (kind < 0.72 ? mix(c1, c2, river * 0.75 + swamp * 0.9) : c2);
          colB = mix(colB, vec3(0.22, 0.32, 0.13), swamp * 0.65);
          colB *= (0.72 + 0.38 * vTip) * (0.85 + 0.25 * vB.w);
          vec3 N = normalize(vN);
          float nl = max(dot(N, normalize(vec3(uSun.x * 0.5, max(uSun.y, 0.4), uSun.z * 0.5))), 0.0);
          float caus = kCaustics(vW, vec