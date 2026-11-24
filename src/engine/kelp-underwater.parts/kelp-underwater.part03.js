2(0.0), uTime) * max(N.y, 0.1) * (1.0 - swamp * 0.6) * (1.0 - 0.6 * uStorm);
          vec3 col = colB * (vec3(0.24, 0.40, 0.36) * lit + uSunCol * nl * 0.48 * (1.0 - 0.5 * uStorm));
          col += colB * 0.52 * caus * lit;
          col = kUnderFog(col, vW, dist, river, swamp, uLight, uStorm, uSubmerged);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });

    // 6. Floating sub-surface golden canopy kelp rafts (kelp3 rafts.tsx — lies lazily at y=-0.24)
    const raftMat = new THREE.ShaderMaterial({
      uniforms: U,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute vec2 aInfo;
        attribute vec4 aRoot; // x, y, z, scale
        attribute vec4 aMeta; // rot, phase, river, swamp
        uniform float uTime;
        varying vec3 vW;
        varying vec2 vInfo;
        varying float vRiver, vSwamp;
        void main(){
          float ca = cos(aMeta.x), sa = sin(aMeta.x);
          vec3 p = position * aRoot.w;
          float rx = p.x * ca - p.z * sa;
          float rz = p.x * sa + p.z * ca;
          float sway = sin(uTime * 0.92 + aMeta.y + aInfo.x * 2.8) * 0.22;
          float bob = sin(uTime * 1.35 + aMeta.y * 1.4 + (rx + rz) * 0.55) * 0.045;
          vec3 wp = vec3(aRoot.x + rx + sway, min(aRoot.y + p.y + bob, -0.14), aRoot.z + rz + sway * 0.6);
          vW = wp;
          vInfo = aInfo;
          vRiver = aMeta.z;
          vSwamp = aMeta.w;
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime, uLight, uStorm, uSubmerged, uFadeDist;
        uniform vec3 uSunCol;
        varying vec3 vW;
        varying vec2 vInfo;
        varying float vRiver, vSwamp;
        ${KELP_GLSL}
        void main(){
          float dist = length(cameraPosition - vW);
          if(dist > uFadeDist + 10.0) discard;
          float lit = max(uLight, 0.09) * (1.0 - 0.36 * uStorm);
          // Delicate feathery lacy edge using organic noise (no harsh polygon outline)
          float lace = kNoise(vW.xz * 2.6 + vec2(uTime * 0.05, 0.0)) * 0.6 + kNoise(vW.xz * 7.2) * 0.4;
          float edge = 1.0 - smoothstep(0.55, 1.0, abs(vInfo.y));
          float alpha = smoothstep(0.24, 0.58, lace * edge) * (1.0 - smoothstep(0.78, 1.0, vInfo.x)) * 0.86;
          if(alpha < 0.05) discard;
          // Sun-warmed golden-amber sargassum/kelp canopy floating just beneath crystal surface!
          vec3 base = mix(mix(vec3(0.54, 0.44, 0.14), vec3(0.32, 0.44, 0.13), vRiver), vec3(0.24, 0.30, 0.095), vSwamp);
          // Translucent backlit gold glow when looking up at sun from underwater
          float glow = uSubmerged > 0.5 ? 1.35 : 0.92;
          vec3 col = base * (vec3(0.34, 0.46, 0.38) * lit + uSunCol * 0.38 * glow * (1.0 - 0.5 * uStorm));
          col = kUnderFog(col, vW, dist, vRiver, vSwamp, uLight, uStorm, uSubmerged);
          float df = 1.0 - smoothstep(uFadeDist - 18.0, uFadeDist + 6.0, dist);
          gl_FragColor = vec4(col, alpha * df);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });

    // 7. Animated swimming multi-species fish schools (kelp3 fish.tsx)
    const fishMat = new THREE.ShaderMaterial({
      uniforms: U,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        attribute vec4 aSchool; // centerX, centerY, centerZ, orbitR
        attribute vec4 aFish;   // speed, phase, scale, species (0=sardine,1=garibaldi,2=bass,3=yellowtail)
        attribute vec4 aExtra;  // flowX, flowZ, river, swamp
        uniform float uTime;
        varying vec3 vW, vN, vLocal;
        varying vec4 vMeta; // species, flash, river, swamp
        void main(){
          float spd = aFish.x;
          float ph = aFish.y;
          float sc = aFish.z;
          float sp = aFish.w;
          float rad = aSchool.w;
          float ang = uTime * (spd / max(rad, 1.2)) + ph;
          // Organic figure-eight / elliptical school orbit inside water pocket
          float ex = cos(ang) * rad + sin(ang * 2.0 + ph) * rad * 0.16;
          float ez = sin(ang) * rad * 0.78 + cos(ang * 1.5 - ph) * rad * 0.12;
          float ey = sin(uTime * 0.72 + ph * 2.3) * 0.24;
          // Forward swim tangent
          float tx = -sin(ang) * rad + 2.0 * cos(ang * 2.0 + ph) * rad * 0.16;
          float tz = cos(ang) * rad * 0.78 - 1.5 * sin(ang * 1.5 - ph) * rad * 0.12;
          // In rivers, bias fish gracefully along channel flow
          float rBias = aExtra.z * 0.35;
          vec2 fwd = normalize(vec2(tx, tz) + vec2(0.0001));
          vec2 right = vec2(fwd.y, -fwd.x);
          // Smooth lifelike lateral S-curve swimming wave (steady head, energetic sweeping tail!)
          float bodyT = clamp((0.5 - position.z) / 1.1, 0.0, 1.0);
          float tailRate = 6.2 + spd * 3.8 + (sp < 0.5 ? 3.2 : 0.0);
          float wiggle = sin(uTime * tailRate - bodyT * 4.8 + ph * 5.0) * (0.04 + 0.17 * bodyT * bodyT);
          vec3 lp = position;
          lp.x += wiggle;
          lp *= sc;
          vec3 wp = vec3(
            aSchool.x + ex + right.x * lp.x + fwd.x * lp.z,
            min(aSchool.y + ey + lp.y, -0.26),
            aSchool.z + ez + right.y * lp.x + fwd.y * lp.z
          );
          vec3 wn = normalize(vec3(
            right.x * normal.x + fwd.x * normal.z,
            normal.y,
            right.y * normal.x + fwd.y * normal.z
          ));
          // Silvery rhythmic bank-glint as sardines catch overhead sunlight
          float flash = pow(max(sin(ang * 2.0 + uTime * 1.8 + ph * 3.0), 0.0), 4.0) * (1.0 - rBias * 0.2);
          vW = wp;
          vN = wn;
          vLocal = position;
          vMeta = vec4(sp, flash, aExtra.z, aExtra.w);
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime, uLight, uStorm, uSubmerged, uFadeDist;
        uniform vec3 uSun, uSunCol;
        varying vec3 vW, vN, vLocal;
        varying vec4 vMeta;
        ${KELP_GLSL}
        void main(){
          float dist = length(cameraPosition - vW);
          if(dist > uFadeDist * 0.85) discard;
          float sp = vMeta.x, flash = vMeta.y, river = vMeta.z, swamp = vMeta.w;
          float lit = max(uLight, 0.10) * (1.0 - 0.35 * uStorm);
          float top = smoothstep(-0.14, 0.16, vLocal.y);
          vec3 col;
          if(sp < 0.5){
            // Flashing silvery sardine / freshwater shiner (countershaded steel-blue back, gleaming mirror flank)
            col = mix(vec3(0.76, 0.86, 0.90), vec3(0.18, 0.36, 0.44), top);
            col += vec3(0.32, 0.38, 0.40) * flash * (1.0 - swamp * 0.5);
          } else if(sp < 1.5){
            // Iconic kelp3 golden-orange Garibaldi / radiant sunfish accent!
            col = mix(vec3(0.95, 0.46, 0.08), vec3(0.98, 0.62, 0.14), 0.4 + 0.6 * top);
          } else if(sp < 2.5){
            // Mottled olive-emerald kelp bass / speckled river trout
            float stripe = 0.82 + 0.18 * sin(vLocal.z * 26.0);
            col = mix(vec3(0.68, 0.72, 0.60), vec3(0.18, 0.30, 0.16) * stripe, top);
          } else {
            // Sleek oceanic yellowtail / silver cruiser with golden lateral band
            float band = exp(-pow(vLocal.y * 16.0, 2.0));
            col = mix(vec3(0.72, 0.80, 0.84), vec3(0.14, 0.28, 0.36), top);
            col = mix(col, vec3(0.78, 0.72, 0.30), band * 0.62);
          }
          vec3 N = normalize(vN);
          vec3 V = normalize(cameraPosition - vW);
          vec3 L = normalize(vec3(uSun.x * 0.4, max(uSun.y, 0.52), uSun.z * 0.4));
          float diff = 0.42 + 0.58 * max(dot(N, L), 0.0);
          float spec = pow(max(dot(reflect(-L, N), V), 0.0), 22.0) * (sp < 0.5 || sp > 2.5 ? 0.65 : 0.28);
          col = col * (vec3(0.28, 0.46, 0.44) * lit + uSunCol * diff * 0.48 * (1.0 - 0.45 * uStorm)) + uSunCol * spec * lit;
          col = kUnderFog(col, vW, dist, river, swamp, uLight, uStorm, uSubmerged);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });

    // 8. Scuttling rock crabs on sandy clearings (kelp3 crabs.tsx)
    const crabMat = new THREE.ShaderMaterial({
      uniforms: U,
      vertexShader: /* glsl */ `
        attribute float aLeg;
        attribute vec4 aCrab;  // x, y, z, scale
        attribute vec4 aAnim;  // rot, phase, river, swamp
        uniform float uTime;
        varying vec3 vW, vN;
        varying vec2 vBio;
        void main(){
          float sc = aCrab.w;
          float ph = aAnim.y;
          // Pause-and-scuttle organic sidewalk rhythm like real rock crabs
          float cyc = uTime * 0.45 + ph;
          float stepW = sin(cyc) * 0.42;
          float moving = smoothstep(0.15, 0.7, abs(cos(cyc)));
          vec3 p = position;
          if(aLeg > 0.8){
            float alt = aLeg > 1.5 ? 3.14159 : 0.0;
            p.y += max(0.0, sin(uTime * 10.5 + ph * 3.0 + alt)) * 0.032 * moving;
            p.z += cos(uTime * 10.5 + ph * 3.0 + alt) * 0.024 * moving;
          }
          p *= sc;
          float ca = cos(aAnim.x), sa = sin(aAnim.x);
          vec3 wp = vec3(
            aCrab.x + p.x * ca - p.z * sa + ca * stepW,
            min(aCrab.y + p.y, -0.18),
            aCrab.z + p.x * sa + p.z * ca + sa * stepW
          );
          vW = wp;
          vN = normalize(vec3(normal.x * ca - normal.z * sa, normal.y, normal.x * sa + normal.z * ca));
          vBio = aAnim.zw;
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime, uLight, uStorm, uSubmerged, uFadeDist;
        uniform vec3 uSun, uSunCol;
        varying vec3 vW, vN;
        varying vec2 vBio;
        ${KELP_GLSL}
        void main(){
          float dist = length(cameraPosition - vW);
          if(dist > uFadeDist * 0.55) discard;
          float lit = max(uLight, 0.1) * (1.0 - 0.35 * uStorm);
          vec3 N = normalize(vN);
          // Warm marbled terracotta-brown rock crab carapace (kelp3 crabs!)
          float mot = kNoise(vW.xz * 18.0);
          vec3 base = mix(vec3(0.48, 0.22, 0.13), vec3(0.68, 0.38, 0.20), mot);
          base = mix(base, vec3(0.32, 0.26, 0.15), vBio.y * 0.55);
          float nl = max(dot(N, vec3(0.25, 0.9, 0.2)), 0.0);
          vec3 col = base * (vec3(0.25, 0.42, 0.38) * lit + uSunCol * nl * 0.46);
          col = kUnderFog(col, vW, dist, vBio.x, vBio.y, uLight, uStorm, uSubmerged);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });

    // 9. Rising intermittent glass bubble threads (kelp3 bubbles.tsx)
    const bubbleMat = new THREE.ShaderMaterial({
      uniforms: U,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec4 aFrom; // x, y, z, puffSeed
        attribute vec4 aOwn;  // radius, speed, ageOffset, wobblePhase
        attribute vec2 aDrift; // flowX, flowZ
        uniform float uTime;
        varying vec2 vQuad;
        varying float vAlpha;
        void main(){
          float tall = max(-0.08 - aFrom.y, 0.35);
          float riseT = tall / max(aOwn.y, 0.18);
          float age = mod(uTime + aOwn.z, riseT);
          float up = age * aOwn.y;
          float born = uTime - age;
          // Puff-and-rest rhythm (kelp3 bubbles!)
          float on = smoothstep(-0.22, 0.18, sin(born * 0.25 + aFrom.w) * 0.62 + sin(born * 0.87 + aFrom.w * 1.7) * 0.38);
          float fadeEdge = smoothstep(0.0, 0.08, up) * smoothstep(tall, tall - 0.22, up);
          float sz = aOwn.x * (1.0 + 0.52 * (up / tall)) * on * fadeEdge;
          float wob = aOwn.x * 2.1 + 0.018;
          float wAng = age * (5.5 - min(aOwn.x * 45.0, 2.2)) + aOwn.w;
          vec3 center = vec3(
            aFrom.x + sin(wAng) * wob + aDrift.x * age * 0.45,
            min(aFrom.y + up, -0.05),
            aFrom.z + cos(wAng * 0.82) * wob + aDrift.y * age * 0.45
          );
          float dist = length(cameraPosition - center);
          float vis = sz * (1.0 - smoothstep(42.0, 68.0, dist));
          // Camera-facing billboard
          vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 upV   = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          vec3 wp = center + (right * position.x + upV * position.y) * vis;
          vQuad = position.xy;
          vAlpha = on * fadeEdge * (1.0 - smoothstep(38.0, 65.0, dist));
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uLight, uStorm, uSubmerged;
        uniform vec3 uSunCol;
        varying vec2 vQuad;
        varying float vAlpha;
        void main(){
          float r = length(vQuad);
          if(r > 1.0 || vAlpha < 0.02) discard;
          // Crisp spherical glass bubble: delicate bright Fresnel rim + sunlit top glint
          float rim = pow(clamp(r, 0.0, 1.0), 2.8) * (1.0 - smoothstep(0.84, 1.0, r));
          float glint = exp(-dot(vQuad - vec2(-0.28, 0.34), vQuad - vec2(-0.28, 0.34)) * 12.0);
          float lit = max(uLight, 0.12) * (1.0 - 0.35 * uStorm);
          float boost = uSubmerged > 0.5 ? 0.92 : 0.62;
          vec3 col = (vec3(0.58, 0.92, 0.90) * rim * 0.72 + (uSunCol * 0.5 + vec3(0.65, 0.92, 0.95)) * glint * 0.95) * lit * boost;
          float fill = (1.0 - smoothstep(0.0, 0.92, r)) * 0.14;
          vec3 bCol = col + vec3(0.45, 0.88, 0.86) * fill * lit * boost;
          float a = clamp((rim * 0.78 + glint * 0.96 + fill) * vAlpha * boost, 0.0, 0.98);
          gl_FragColor = vec4(bCol * a, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });

    return { rockMat, kelpMat, sugarMat, grassMat, raftMat, fishMat, crabMat, spongeMat, bubbleMat };
  }

  // Submerged-only volumetric atmosphere: surround water depth dome, slanted sunlit god-ray shafts, drifting marine snow!
  _buildSubmergedAtmosphere() {
    const U = this.KU;

    // A) Surrounding volumetric water backdrop dome (kelp3 Backdrop)
    const domeMat = new THREE.ShaderMaterial({
      uniforms: U,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main(){
          vDir = position;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uSun, uSunCol, uCamBiome;
        uniform float uLight, uStorm, uNight, uTime, uCamDepth;
        varying vec3 vDir;
        void main(){
          vec3 d = normalize(vDir);
          float lake = uCamBiome.x, river = uCamBiome.y, swamp = uCamBiome.z;
          float lit = max(uLight, 0.08) * (1.0 - 0.45 * uStorm);
          // Authentic rich cinema kelp3 dome: glowing aquamarine cathedral above -> luminous teal midwater -> profound #0a2730 deep
          vec3 topCol = (vec3(0.18, 0.56, 0.55) * lake + vec3(0.14, 0.46, 0.34) * river + vec3(0.17, 0.23, 0.082) * swamp) * lit;
          vec3 midCol = (vec3(0.045, 0.24, 0.29) * lake + vec3(0.046, 0.21, 0.16) * river + vec3(0.055, 0.086, 0.032) * swamp) * lit;
          vec3 botCol = (vec3(0.012, 0.082, 0.122) * lake + vec3(0.014, 0.076, 0.060) * river + vec3(0.014, 0.022, 0.009) * swamp) * lit;
          // Depth slightly shifts ambient mood darker when deep in the canyon
          float dFade = exp(-max(uCamDepth, 0.0) * 0.045);
          vec3 col = d.y >= 0.0
            ? mix(midCol, topCol, pow(clamp(d.y, 0.0, 1.0), 0.62))
            : mix(midCol, botCol, pow(clamp(-d.y, 0.0, 1.0), 0.72));
          col *= (0.62 + 0.38 * dFade);
          // Refracted solar cone blooming softly overhead through water
          vec3 sDir = normalize(vec3(uSun.x * 0.48, max(uSun.y, 0.38), uSun.z * 0.48));
          float sDot = max(dot(d, sDir), 0.0);
          float shimmer = 0.9 + 0.1 * sin(d.x * 18.0 + uTime * 1.4) * cos(d.z * 16.0 - uTime * 1.1);
          vec3 sunGlow = mix(vec3(0.55, 0.92, 0.85), vec3(0.85, 0.78, 0.42), swamp * 0.75 + (1.0 - max(uSun.y, 0.0)) * 0.35);
          col += sunGlow * (pow(sDot, 5.0) * 0.42 + pow(sDot, 28.0) * 0.68) * shimmer * lit * (1.0 - 0.7 * uStorm) * (1.0 - uNight);
          col += vec3(0.012, 0.025, 0.038) * uNight;
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(240, 24, 16), domeMat);
    this.dome.renderOrder = -8;
    this.dome.frustumCulled = false;
    this.subGroup.add(this.dome);

    // B) Volumetric downward dancing sun light shafts (kelp3 Shafts in sea.tsx)
    const count = this.tier.shafts;
    const shaftGeo = new THREE.InstancedBufferGeometry();
    shaftGeo.setAttribute("position", new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, -1, 0, -0.5, -1, 0], 3));
    shaftGeo.setIndex([0, 1, 2, 0, 2, 3]);
    const offsets = new Float32Array(count * 4);
    const rng = makeRng(9923);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (rng() - 0.5) * 0.42;
      const r = 4.2 + Math.sqrt(rng()) * 19;
      offsets[i * 4 + 0] = Math.cos(a) * r;
      offsets[i * 4 + 1] = Math.sin(a) * r;
      offsets[i * 4 + 2] = 1.25 + rng() * 2.4; // generous cinema sunbeam curtains
      offsets[i * 4 + 3] = rng() * 100;
    }
    shaftGeo.setAttribute("aShaft", new THREE.InstancedBufferAttribute(offsets, 4));
    shaftGeo.instanceCount = count;

    const shaftMat = new THREE.ShaderMaterial({
      uniforms: U,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec4 aShaft; // ox, oz, width, phase
        uniform vec3 uSun;
        uniform float uTime;
        varying vec2 vUv;
        varying float vPhase, vDist;
        void main(){
          float len = 18.0;
          // Tilted diagonally down along refracted underwater sun vector
          vec3 ray = normalize(vec3(-uSun.x * 0.42, -max(uSun.y, 0.55), -uSun.z * 0.42));
          float driftX = sin(uTime * 0.28 + aShaft.w) * 1.1;
          float driftZ = cos(uTime * 0.24 + aShaft.w * 1.3) * 1.1;
          // Wrap shafts cleanly near camera xz
          vec2 cell = vec2(aShaft.x + driftX, aShaft.y + driftZ);
          vec3 top = vec3(cameraPosition.x + cell.x, -0.02, cameraPosition.z + cell.y);
          float down = -position.y; // 0 at surface -> 1 at depth
          vec3 axisP = top + ray * (down * len);
          // Axial billboard facing camera around ray axis
          vec3 toCam = normalize(cameraPosition - axisP);
          vec3 side = normalize(cross(ray, toCam));
          float spread = aShaft.z * (0.72 + down * 1.35);
          vec3 wp = axisP + side * position.x * spread;
          vUv = vec2(position.x + 0.5, down);
          vPhase = aShaft.w;
          vDist = length(cameraPosition - axisP);
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime, uLight, uStorm, uNight;
        uniform vec3 uSun, uSunCol, uCamBiome;
        varying vec2 vUv;
        varying float vPhase, vDist;
        void main(){
          // Soft horizontal ribbon curtain with animated finer caustic striations inside
          float edge = sin(vUv.x * 3.1415926);
          edge = edge * edge;
          float stripe = 0.52 + 0.48 * sin(vUv.x * 13.0 + uTime * 1.35 + vPhase) * cos(vUv.x * 7.5 - uTime * 0.85 + vPhase * 0.7);
          float pulse = 0.52 + 0.48 * sin(uTime * 0.62 + vPhase) * sin(uTime * 0.37 + vPhase * 1.9);
          float vert = smoothstep(0.0, 0.08, vUv.y) * exp(-vUv.y * 2.15) * (1.0 - smoothstep(0.82, 1.0, vUv.y));
          float nearF = smoothstep(1.6, 5.2, vDist) * (1.0 - smoothstep(18.0, 30.0, vDist));
          float lit = max(uLight, 0.0) * smoothstep(0.02, 0.22, uSun.y) * (1.0 - 0.78 * uStorm) * (1.0 - uNight);
          float lake = uCamBiome.x, river = uCamBiome.y, swamp = uCamBiome.z;
          // Iconic unmistakable kelp3 cascading diagonal cathedral light shafts slicing cleanly between the spires!
          vec3 rayCol = (vec3(0.54, 0.98, 0.88) * lake + vec3(0.62, 0.96, 0.70) * river + vec3(0.96, 0.82, 0.32) * swamp);
          rayCol = mix(rayCol, uSunCol * 0.45 + rayCol * 0.65, 0.40);
          float str = edge * (0.34 + 0.66 * stripe) * (0.62 + 0.38 * pulse) * vert * nearF * lit * mix(0.44, 0.38, swamp);
          if(str < 0.002) discard;
          gl_FragColor = vec4(rayCol * str, str);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this.shafts = new THREE.Mesh(shaftGeo, shaftMat);
    this.shafts.renderOrder = 3.5;
    this.shafts.frustumCulled = false;
    this.subGroup.add(this.shafts);

    // C) Drifting luminous marine snow / plankton particles wrapping around camera (kelp3 Snow)
    const sCount = this.tier.snow;
    const snowGeo = new THREE.BufferGeometry();
    const sp = new Float32Array(sCount * 3);
    const sd = new Float32Array(sCount * 3);
    const sr = makeRng(3119);
    for (let i = 0; i < sCount; i++) {
      sp[i * 3 + 0] = sr() * 22;
      sp[i * 3 + 1] = sr() * 12;
      sp[i * 3 + 2] = sr() * 22;
      sd[i * 3 + 0] = sr() * 6.283; // phase
      sd[i * 3 + 1] = 0.5 + sr() * 1.4; // size
      sd[i * 3 + 2] = sr(); // brightness variation
    }
    snowGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    snowGeo.setAttribute("aSeed", new THREE.BufferAttribute(sd, 3));
    const snowMat = new THREE.ShaderMaterial({
      uniforms: U,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec3 aSeed;
        uniform float uTime;
        uniform vec2 uCamFlow;
        varying float vAlpha, vWarm;
        void main(){
          float ph = aSeed.x;
          vec3 box = vec3(22.0, 12.0, 22.0);
          vec3 drift = vec3(
            uCamFlow.x * uTime * 0.55 + sin(uTime * 0.35 + ph) * 0.65,
            -uTime * 0.08 + cos(uTime * 0.28 + ph * 1.7) * 0.4,
            uCamFlow.y * uTime * 0.55 + cos(uTime * 0.31 + ph * 0.8) * 0.65
          );
          vec3 rel = mod(position + drift - cameraPosition, box) - box * 0.5;
          vec3 wp = cameraPosition + rel;
          float under = step(wp.y, -0.15);
          vec4 mv = viewMatrix * vec4(wp, 1.0);
          float d = length(rel);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp((16.0 * aSeed.y) / max(-mv.z, 0.8), 1.2, 6.5) * under;
          float twinkle = 0.6 + 0.4 * sin(uTime * 1.4 + ph * 3.1);
          vAlpha = under * smoothstep(11.0, 5.0, d) * smoothstep(0.6, 1.8, d) * twinkle * (0.28 + 0.48 * aSeed.z);
          vWarm = aSeed.z;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uLight, uStorm;
        uniform vec3 uCamBiome;
        varying float vAlpha, vWarm;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          float r2 = dot(c, c);
          if(r2 > 0.25 || vAlpha < 0.01) discard;
          float soft = exp(-r2 * 14.0);
          float lit = max(uLight, 0.14) * (1.0 - 0.35 * uStorm);
          vec3 tint = mix(vec3(0.58, 0.90, 0.84), vec3(0.92, 0.84, 0.52), vWarm * 0.55 + uCamBiome.z * 0.5);
          float a = soft * vAlpha * lit * 0.58;
          gl_FragColor = vec4(tint * a, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this.snow = new THREE.Points(snowGeo, snowMat);
    this.snow.renderOrder = 3.6;
    this.snow.frustumCulled = false;
    this.subGroup.add(this.snow);

    this.subMaterials = [domeMat, shaftMat, snowMat];
  }

  /* -------------------------------------------------------------------------
     Build one 32m x 32m underwater kelp3 ecosystem tile
     ------------------------------------------------------------------------- */
  _buildTile(field, tx, tz) {
    const ox = tx * TILE_SIZE;
    const oz = tz * TILE_SIZE;
    const tile = { group: new THREE.Group(), meshes: [], geos: [], last: this.frame, empty: true };
    const isl = field.islandAt(ox + TILE_SIZE * 0.5, oz + TILE_SIZE * 0.5);
    if (!isl?.world) return tile;
    const world = isl.world;
    const cx = isl.spec.cx, cz = isl.spec.cz;

    // Fast coarse wetness precheck across 5x5 probes to skip purely dry tiles instantly
    let wetHits = 0;
    for (let j = 0; j < 5; j++) {
      for (let i = 0; i < 5; i++) {
        const px = ox + (i + 0.5) * (TILE_SIZE / 5) - cx;
        const pz = oz + (j + 0.5) * (TILE_SIZE / 5) - cz;
        if (sampleWaterProps(world, px, pz)) wetHits++;
      }
    }
    if (wetHits === 0) return tile;

    const dens = this.tier.density;
    const rng = makeRng(world.seed ^ Math.imul(tx, 73856093) ^ Math.imul(tz, 19349663) ^ 0x4b454c50);
    const dummy = new THREE.Object3D();

    // Collectors
    const boulders = [[], [], [], []]; // mat4 + biome(4)
    const pebbles = [];
    const kelpList = [];  // root(4), flow(4), biome(4)
    const sugarList = []; // root(4), flow(4), biome(3)
    const grassList = []; // root(4), flow(4), biome(3)
    const spongeList = [];
    const raftList = [];
    const fishList = [];
    const crabList = [];
    const bubbleSources = [];

    const pushInst = (list, m, biome) => list.push({ m: m.elements.slice(), b: biome });

    // A) Rich reef boulder outcrops (clustered organically just like kelp3/floor.tsx!)
    const outcropCount = Math.round((6 + rng() * 5) * dens);
    const outcropCenters = [];
    for (let o = 0; o < outcropCount; o++) {
      const wx = ox + (0.08 + rng() * 0.84) * TILE_SIZE;
      const wz = oz + (0.08 + rng() * 0.84) * TILE_SIZE;
      const p = sampleWaterProps(world, wx - cx, wz - cz);
      if (!p || p.depth < 0.45) continue;
      outcropCenters.push({ wx, wz, p });
      const rocks = 2 + Math.floor(rng() * 4);
      for (let k = 0; k < rocks; k++) {
        const a = rng() * Math.PI * 2;
        const dist = k === 0 ? 0 : 0.7 + rng() * 2.4;
        const rx = wx + Math.cos(a) * dist;
        const rz = wz + Math.sin(a) * dist;
        const rp = sampleWaterProps(world, rx - cx, rz - cz);
        if (!rp || rp.depth < 0.42) continue;
        // Larger boulders only in deep pockets so they stay genuinely submerged!
        const maxSz = Math.min(1.65, rp.depth * 0.44);
        const sz = Math.max(0.28, (0.36 + Math.pow(rng(), 1.45) * 1.25) * (k === 0 ? 1.0 : 0.72));
        const fs = Math.min(sz, maxSz);
        if (fs < 0.24) continue;
        const sy = fs * (0.68 + rng() * 0.42);
        const variant = fs > 0.9 ? Math.floor(rng() * 4) : Math.floor(rng() * 3);
        dummy.position.set(rx, rp.h - sy * 0.22, rz);
        dummy.rotation.set((rng() - 0.5) * 0.28, rng() * Math.PI * 2, (rng() - 0.5) * 0.28);
        dummy.scale.set(fs * (0.9 + rng() * 0.35), sy, fs * (0.85 + rng() * 0.35));
        dummy.updateMatrix();
        pushInst(boulders[variant], dummy.matrix, [rp.river, rp.swamp, rng(), 0]);

        // Reef sponges / mossy polyp cushions perched on sunlit rock sides
        if (rng() < (rp.swamp > 0.5 ? 0.32 : 0.52) && rp.depth > 0.75) {
          const sa = rng() * Math.PI * 2;
          const sx = rx + Math.cos(sa) * fs * 0.52;
          const szp = rz + Math.sin(sa) * fs * 0.52;
          const sc = 0.55 + rng() * 0.95;
          dummy.position.set(sx, rp.h + sy * 0.34, szp);
          dummy.rotation.set((rng() - 0.5) * 0.3, rng() * Math.PI * 2, (rng() - 0.5) * 0.3);
          dummy.scale.set(sc, sc * (0.8 