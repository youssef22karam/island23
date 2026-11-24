+ rng() * 0.45), sc);
          dummy.updateMatrix();
          pushInst(spongeList, dummy.matrix, [rp.river, rp.swamp, rng(), rng()]);
        }

        // Anchor signature kelp3 sugar kelp ribbons right around boulder edges!
        const sugarN = 1 + Math.floor(rng() * (rp.river > 0.35 ? 3 : 2.5));
        for (let q = 0; q < sugarN; q++) {
          const qa = rng() * Math.PI * 2;
          const qd = fs * (0.55 + rng() * 0.85);
          const qx = rx + Math.cos(qa) * qd;
          const qz = rz + Math.sin(qa) * qd;
          const qp = sampleWaterProps(world, qx - cx, qz - cz);
          if (!qp || qp.depth < 0.48) continue;
          const rScale = Math.min(qp.depth * 0.78, 0.72 + rng() * 1.45);
          sugarList.push(
            qx, qp.h - 0.04, qz, rScale,
            qp.flowX, qp.flowZ, rng() * 60, rng() * Math.PI * 2,
            qp.river, qp.swamp, rng()
          );
        }

        // Occasional bubbling crack on larger submerged stones (kelp3 bubbles.tsx!)
        if (k === 0 && fs > 0.42 && rp.depth > 1.0 && rng() < 0.72 && bubbleSources.length < 11) {
          bubbleSources.push({
            x: rx + (rng() - 0.5) * fs * 0.35,
            y: Math.min(rp.h + sy * 0.48, -0.6),
            z: rz + (rng() - 0.5) * fs * 0.35,
            fx: rp.flowX,
            fz: rp.flowZ,
            seed: rng() * 100,
          });
        }
      }
    }

    // B) Abundant smooth rounded underwater pebbles & river cobbles
    const pebCount = Math.round(44 * dens);
    for (let i = 0; i < pebCount; i++) {
      const wx = ox + rng() * TILE_SIZE;
      const wz = oz + rng() * TILE_SIZE;
      const p = sampleWaterProps(world, wx - cx, wz - cz);
      if (!p || p.depth < 0.32 || (p.swamp > 0.65 && rng() < 0.6)) continue;
      const sc = 0.14 + Math.pow(rng(), 1.8) * (p.river > 0.3 ? 0.48 : 0.36);
      dummy.position.set(wx, p.h - sc * 0.1, wz);
      dummy.rotation.set((rng() - 0.5) * 0.25, rng() * Math.PI * 2, (rng() - 0.5) * 0.25);
      dummy.scale.set(sc * (0.9 + rng() * 0.4), sc * (0.65 + rng() * 0.45), sc * (0.85 + rng() * 0.35));
      dummy.updateMatrix();
      pushInst(pebbles, dummy.matrix, [p.river, p.swamp, rng(), 1]);
    }

    // C) Lush towering giant kelp cathedral bundles (kelp3 Macrocystis: thick arched golden columns & lush floating canopies!)
    const giantCount = Math.round(9.5 * dens);
    for (let g = 0; g < giantCount; g++) {
      const wx = ox + (0.06 + rng() * 0.88) * TILE_SIZE;
      const wz = oz + (0.06 + rng() * 0.88) * TILE_SIZE;
      const p = sampleWaterProps(world, wx - cx, wz - cz);
      if (!p || p.depth < 1.25) continue;
      // Preserve open cathedral viewing avenues & glowing sun-corridor clearings between thick lush kelp bushes
      const glade = hash2(Math.floor(wx * 0.075), Math.floor(wz * 0.075));
      if (glade < (p.swamp > 0.45 ? 0.28 : 0.20)) continue;
      // Each plant rises in a majestic full kelp3 bush of 4–6 gently swaying intertwined golden stipes!
      const stems = p.swamp > 0.5 ? (3 + Math.floor(rng() * 2)) : (4 + Math.floor(rng() * 3));
      const hueBase = rng();
      const tallFrac = p.isLake ? (0.98 + rng() * 0.48) : p.river > 0.35 ? (0.82 + rng() * 0.42) : (0.76 + rng() * 0.38);
      for (let s = 0; s < stems; s++) {
        const sa = (s / stems) * Math.PI * 2 + rng() * 0.65;
        const sr = 0.10 + rng() * 0.34;
        const grown = rng() < 0.66;
        const len = grown
          ? Math.min(20.0, p.depth * tallFrac)
          : Math.max(1.1, p.depth * (0.42 + rng() * 0.46));
        const cScale = 0.86 + Math.min(p.depth / 7.5, 0.78) * (0.68 + rng() * 0.55);
        kelpList.push(
          wx + Math.cos(sa) * sr, p.h - 0.06, wz + Math.sin(sa) * sr, len,
          p.flowX, p.flowZ, rng() * 80, rng() * Math.PI * 2,
          p.river, p.swamp, (hueBase + rng() * 0.25) % 1, cScale
        );
      }
      // Skirt of lush eelgrass right around every giant kelp holdfast (kelp3 aroundHoldfasts!)
      for (let e = 0; e < 4; e++) {
        const ea = rng() * Math.PI * 2;
        const er = 0.55 + rng() * 1.15;
        const ex = wx + Math.cos(ea) * er;
        const ez = wz + Math.sin(ea) * er;
        const ep = sampleWaterProps(world, ex - cx, ez - cz);
        if (!ep || ep.depth < 0.4) continue;
        const gs = Math.min(ep.depth * 0.72, 0.55 + rng() * 0.85);
        grassList.push(ex, ep.h - 0.03, ez, gs, ep.flowX, ep.flowZ, rng() * 50, rng() * Math.PI * 2, ep.river, ep.swamp, rng());
      }
      // Lush overhead floating golden-amber sargassum / giant kelp canopy spreading right under surface!
      if (p.depth > 2.0 && rng() < (p.isLake ? 0.68 : p.river > 0.35 ? 0.34 : 0.45)) {
        raftList.push(
          wx + (rng() - 0.5) * 2.0,
          -0.22 - rng() * 0.26,
          wz + (rng() - 0.5) * 2.0,
          1.15 + rng() * 1.35,
          rng() * Math.PI * 2, rng() * 50, p.river, p.swamp
        );
      }
    }

    // D) Expansive dense beds of low swaying golden sugar kelp & flowing emerald river-kelp ribbons!
    const ribbonPatches = Math.round(38 * dens);
    for (let i = 0; i < ribbonPatches; i++) {
      const wx = ox + rng() * TILE_SIZE;
      const wz = oz + rng() * TILE_SIZE;
      const p = sampleWaterProps(world, wx - cx, wz - cz);
      if (!p || p.depth < 0.42) continue;
      // Organic open bright sunlit sand clearings weave naturally between dense waving carpets
      if (Math.sin(wx * 0.14 + wz * 0.11) + Math.cos(wx * 0.09 - wz * 0.16) < -0.62) continue;
      const sc = Math.min(p.depth * 0.86, (0.85 + rng() * 1.85) * (p.river > 0.3 ? 1.2 : 1.05));
      sugarList.push(
        wx, p.h - 0.04, wz, sc,
        p.flowX, p.flowZ, rng() * 70, rng() * Math.PI * 2,
        p.river, p.swamp, rng()
      );
    }

    // E) Rich clumped swaying seagrass / eelgrass floor carpets hugging shallow sandbars & reefs!
    const grassPatches = Math.round(44 * dens);
    for (let i = 0; i < grassPatches; i++) {
      const wx = ox + rng() * TILE_SIZE;
      const wz = oz + rng() * TILE_SIZE;
      const p = sampleWaterProps(world, wx - cx, wz - cz);
      if (!p || p.depth < 0.38 || p.depth > 14.0) continue;
      const clumpN = 1 + (rng() < 0.5 ? 1 : 0);
      for (let c = 0; c < clumpN; c++) {
        const gx = wx + (c ? (rng() - 0.5) * 1.8 : 0);
        const gz = wz + (c ? (rng() - 0.5) * 1.8 : 0);
        const gp = c ? sampleWaterProps(world, gx - cx, gz - cz) : p;
        if (!gp || gp.depth < 0.36) continue;
        const sc = Math.min(gp.depth * 0.72, 0.52 + rng() * 0.92);
        grassList.push(gx, gp.h - 0.03, gz, sc, gp.flowX, gp.flowZ, rng() * 60, rng() * Math.PI * 2, gp.river, gp.swamp, rng());
      }
    }

    // F) Iconic lively kelp3 swirling multi-species fish schools (gleaming baitballs, bright orange garibaldi, olive bass/trout, silver-gold yellowtail!)
    const schoolCenters = Math.round(4.4 * dens);
    for (let s = 0; s < schoolCenters; s++) {
      const wx = ox + (0.16 + rng() * 0.68) * TILE_SIZE;
      const wz = oz + (0.16 + rng() * 0.68) * TILE_SIZE;
      const p = sampleWaterProps(world, wx - cx, wz - cz);
      if (!p || p.depth < 1.25) continue;
      const rad = Math.min(6.0, 2.4 + rng() * 3.4);
      const ok =
        sampleWaterProps(world, wx + rad - cx, wz - cz)?.depth > 0.85 &&
        sampleWaterProps(world, wx - rad - cx, wz - cz)?.depth > 0.85 &&
        sampleWaterProps(world, wx - cx, wz + rad - cz)?.depth > 0.85 &&
        sampleWaterProps(world, wx - cx, wz - rad - cz)?.depth > 0.85;
      if (!ok) continue;
      const roll = rng();
      let species, count, sizeBase, spdBase;
      if (roll < 0.42) {
        // Cohesive shimmering flashing sardine / river shiner ribbon school
        species = 0; count = Math.round((12 + rng() * 12) * Math.min(dens, 1.15));
        sizeBase = 0.34; spdBase = 1.55;
      } else if (roll < 0.66 && p.swamp < 0.52) {
        // Radiant kelp3 orange garibaldi / golden reef sunfish gems contrasting jewel teal water!
        species = 1; count = 3 + Math.floor(rng() * 4);
        sizeBase = 0.48; spdBase = 0.85;
      } else if (roll < 0.86) {
        // Sleek olive-bronze kelp bass / streaming river trout
        species = 2; count = 4 + Math.floor(rng() * 5);
        sizeBase = 0.62; spdBase = 1.06;
      } else {
        // Dramatic streamlined golden-stripe yellowtail jacks gliding calmly mid-water!
        species = 3; count = 4 + Math.floor(rng() * 4);
        sizeBase = 0.88; spdBase = 1.38;
      }
      const baseDepth = Math.min(-0.55, Math.max(p.h + 0.65, -p.depth * (0.28 + rng() * 0.42)));
      const grpPhase = rng() * Math.PI * 2;
      for (let f = 0; f < count; f++) {
        const jx = wx + (rng() - 0.5) * 2.2;
        const jz = wz + (rng() - 0.5) * 2.2;
        const jy = Math.min(-0.38, Math.max(p.h + 0.45, baseDepth + (rng() - 0.5) * Math.min(1.6, p.depth * 0.35)));
        const rOrbit = rad * (0.65 + rng() * 0.42);
        const fs = sizeBase * (0.78 + rng() * 0.48);
        const sp = spdBase * (0.84 + rng() * 0.32);
        fishList.push(
          jx, jy, jz, rOrbit,
          sp, grpPhase + (rng() - 0.5) * (species === 0 ? 0.9 : 4.2), fs, species,
          p.flowX, p.flowZ, p.river, p.swamp
        );
      }
    }

    // G) Scuttling rock crabs on sandy clearings (kelp3 crabs.tsx)
    const crabCount = Math.max(1, Math.round(2 * dens));
    for (let i = 0; i < crabCount; i++) {
      if (rng() > 0.65) continue;
      const wx = ox + (0.15 + rng() * 0.7) * TILE_SIZE;
      const wz = oz + (0.15 + rng() * 0.7) * TILE_SIZE;
      const p = sampleWaterProps(world, wx - cx, wz - cz);
      if (!p || p.depth < 0.65 || p.depth > 11.5) continue;
      crabList.push(wx, p.h, wz, 0.75 + rng() * 0.62, rng() * Math.PI * 2, rng() * 20, p.river, p.swamp);
    }

    // Extra marsh-gas / floor bubble streams in deeper lakes & swamps
    if (bubbleSources.length < 3 && outcropCenters.length === 0) {
      for (let i = 0; i < 2; i++) {
        const wx = ox + rng() * TILE_SIZE;
        const wz = oz + rng() * TILE_SIZE;
        const p = sampleWaterProps(world, wx - cx, wz - cz);
        if (p && p.depth > 1.2 && rng() < 0.55) {
          bubbleSources.push({ x: wx, y: p.h + 0.08, z: wz, fx: p.flowX, fz: p.flowZ, seed: rng() * 100 });
        }
      }
    }

    // --- Assemble GPU instanced meshes for this tile ---
    const addMesh = (geo, mat, order = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.frustumCulled = false;
      if (order) m.renderOrder = order;
      tile.group.add(m);
      tile.meshes.push(m);
      tile.geos.push(geo);
      tile.empty = false;
    };

    const addInstancedRock = (baseGeo, items, mat) => {
      if (!items.length) return;
      const geo = new THREE.InstancedBufferGeometry();
      geo.setAttribute("position", baseGeo.getAttribute("position"));
      geo.setAttribute("normal", baseGeo.getAttribute("normal"));
      if (baseGeo.index) geo.setIndex(baseGeo.index);
      const bArr = new Float32Array(items.length * 4);
      const mesh = new THREE.InstancedMesh(geo, mat, items.length);
      const tmp = new THREE.Matrix4();
      for (let i = 0; i < items.length; i++) {
        tmp.fromArray(items[i].m);
        mesh.setMatrixAt(i, tmp);
        bArr.set(items[i].b, i * 4);
      }
      geo.setAttribute("aBiome", new THREE.InstancedBufferAttribute(bArr, 4));
      geo.instanceCount = items.length;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      if (mesh.boundingSphere) mesh.boundingSphere.radius += 4;
      tile.group.add(mesh);
      tile.meshes.push(mesh);
      tile.geos.push(geo);
      tile.empty = false;
    };

    for (let v = 0; v < 4; v++) addInstancedRock(this.boulderGeos[v], boulders[v], this.materials.rockMat);
    addInstancedRock(this.pebbleGeo, pebbles, this.materials.rockMat);

    if (spongeList.length) {
      const base = this.spongeGeo;
      const geo = new THREE.InstancedBufferGeometry();
      geo.setAttribute("position", base.getAttribute("position"));
      geo.setAttribute("normal", base.getAttribute("normal"));
      geo.setAttribute("aTip", base.getAttribute("aTip"));
      geo.setIndex(base.index);
      const bArr = new Float32Array(spongeList.length * 4);
      const mesh = new THREE.InstancedMesh(geo, this.materials.spongeMat, spongeList.length);
      const tmp = new THREE.Matrix4();
      for (let i = 0; i < spongeList.length; i++) {
        tmp.fromArray(spongeList[i].m);
        mesh.setMatrixAt(i, tmp);
        bArr.set(spongeList[i].b, i * 4);
      }
      geo.setAttribute("aBiome", new THREE.InstancedBufferAttribute(bArr, 4));
      geo.instanceCount = spongeList.length;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      if (mesh.boundingSphere) mesh.boundingSphere.radius += 2;
      tile.group.add(mesh);
      tile.meshes.push(mesh);
      tile.geos.push(geo);
      tile.empty = false;
    }

    if (kelpList.length) {
      const n = kelpList.length / 12;
      const geo = new THREE.InstancedBufferGeometry();
      geo.setAttribute("position", this.kelpGeo.getAttribute("position"));
      geo.setAttribute("normal", this.kelpGeo.getAttribute("normal"));
      geo.setAttribute("aInfo", this.kelpGeo.getAttribute("aInfo"));
      geo.setIndex(this.kelpGeo.index);
      const rA = new Float32Array(n * 4), fA = new Float32Array(n * 4), bA = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        const s = i * 12;
        rA.set(kelpList.slice(s, s + 4), i * 4);
        fA.set(kelpList.slice(s + 4, s + 8), i * 4);
        bA.set(kelpList.slice(s + 8, s + 12), i * 4);
      }
      geo.setAttribute("aRoot", new THREE.InstancedBufferAttribute(rA, 4));
      geo.setAttribute("aFlow", new THREE.InstancedBufferAttribute(fA, 4));
      geo.setAttribute("aBiome", new THREE.InstancedBufferAttribute(bA, 4));
      geo.instanceCount = n;
      addMesh(geo, this.materials.kelpMat);
    }

    if (sugarList.length) {
      const n = sugarList.length / 11;
      const geo = new THREE.InstancedBufferGeometry();
      geo.setAttribute("position", this.sugarGeo.getAttribute("position"));
      geo.setAttribute("normal", this.sugarGeo.getAttribute("normal"));
      geo.setAttribute("aRibbon", this.sugarGeo.getAttribute("aRibbon"));
      geo.setIndex(this.sugarGeo.index);
      const rA = new Float32Array(n * 4), fA = new Float32Array(n * 4), bA = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const s = i * 11;
        rA.set(sugarList.slice(s, s + 4), i * 4);
        fA.set(sugarList.slice(s + 4, s + 8), i * 4);
        bA.set(sugarList.slice(s + 8, s + 11), i * 3);
      }
      geo.setAttribute("aRoot", new THREE.InstancedBufferAttribute(rA, 4));
      geo.setAttribute("aFlow", new THREE.InstancedBufferAttribute(fA, 4));
      geo.setAttribute("aBiome", new THREE.InstancedBufferAttribute(bA, 3));
      geo.instanceCount = n;
      addMesh(geo, this.materials.sugarMat);
    }

    if (grassList.length) {
      const n = grassList.length / 11;
      const geo = new THREE.InstancedBufferGeometry();
      geo.setAttribute("position", this.grassGeo.getAttribute("position"));
      geo.setAttribute("normal", this.grassGeo.getAttribute("normal"));
      geo.setAttribute("aBlade", this.grassGeo.getAttribute("aBlade"));
      geo.setIndex(this.grassGeo.index);
      const rA = new Float32Array(n * 4), fA = new Float32Array(n * 4), bA = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const s = i * 11;
        rA.set(grassList.slice(s, s + 4), i * 4);
        fA.set(grassList.slice(s + 4, s + 8), i * 4);
        bA.set(grassList.slice(s + 8, s + 11), i * 3);
      }
      geo.setAttribute("aRoot", new THREE.InstancedBufferAttribute(rA, 4));
      geo.setAttribute("aFlow", new THREE.InstancedBufferAttribute(fA, 4));
      geo.setAttribute("aBiome", new THREE.InstancedBufferAttribute(bA, 3));
      geo.instanceCount = n;
      addMesh(geo, this.materials.grassMat);
    }

    if (raftList.length) {
      const n = raftList.length / 8;
      const geo = new THREE.InstancedBufferGeometry();
      geo.setAttribute("position", this.raftGeo.getAttribute("position"));
      geo.setAttribute("normal", this.raftGeo.getAttribute("normal"));
      geo.setAttribute("aInfo", this.raftGeo.getAttribute("aInfo"));
      geo.setIndex(this.raftGeo.index);
      const rA = new Float32Array(n * 4), mA = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        const s = i * 8;
        rA.set(raftList.slice(s, s + 4), i * 4);
        mA.set(raftList.slice(s + 4, s + 8), i * 4);
      }
      geo.setAttribute("aRoot", new THREE.InstancedBufferAttribute(rA, 4));
      geo.setAttribute("aMeta", new THREE.InstancedBufferAttribute(mA, 4));
      geo.instanceCount = n;
      addMesh(geo, this.materials.raftMat, 0.4);
    }

    if (fishList.length) {
      const n = fishList.length / 12;
      const geo = new THREE.InstancedBufferGeometry();
      geo.setAttribute("position", this.fishGeo.getAttribute("position"));
      geo.setAttribute("normal", this.fishGeo.getAttribute("normal"));
      geo.setIndex(this.fishGeo.index);
      const sA = new Float32Array(n * 4), fA = new Float32Array(n * 4), eA = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        const s = i * 12;
        sA.set(fishList.slice(s, s + 4), i * 4);
        fA.set(fishList.slice(s + 4, s + 8), i * 4);
        eA.set(fishList.slice(s + 8, s + 12), i * 4);
      }
      geo.setAttribute("aSchool", new THREE.InstancedBufferAttribute(sA, 4));
      geo.setAttribute("aFish", new THREE.InstancedBufferAttribute(fA, 4));
      geo.setAttribute("aExtra", new THREE.InstancedBufferAttribute(eA, 4));
      geo.instanceCount = n;
      addMesh(geo, this.materials.fishMat);
    }

    if (crabList.length) {
      const n = crabList.length / 8;
      const geo = new THREE.InstancedBufferGeometry();
      geo.setAttribute("position", this.crabGeo.getAttribute("position"));
      geo.setAttribute("normal", this.crabGeo.getAttribute("normal"));
      geo.setAttribute("aLeg", this.crabGeo.getAttribute("aLeg"));
      geo.setIndex(this.crabGeo.index);
      const cA = new Float32Array(n * 4), aA = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        const s = i * 8;
        cA.set(crabList.slice(s, s + 4), i * 4);
        aA.set(crabList.slice(s + 4, s + 8), i * 4);
      }
      geo.setAttribute("aCrab", new THREE.InstancedBufferAttribute(cA, 4));
      geo.setAttribute("aAnim", new THREE.InstancedBufferAttribute(aA, 4));
      geo.instanceCount = n;
      addMesh(geo, this.materials.crabMat);
    }

    if (bubbleSources.length) {
      const per = Math.max(14, Math.round(24 * Math.min(dens, 1.1)));
      const total = bubbleSources.length * per;
      const geo = new THREE.InstancedBufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
      geo.setIndex([0, 1, 2, 0, 2, 3]);
      const fA = new Float32Array(total * 4);
      const oA = new Float32Array(total * 4);
      const dA = new Float32Array(total * 2);
      let ptr = 0;
      for (const b of bubbleSources) {
        for (let k = 0; k < per; k++) {
          fA[ptr * 4 + 0] = b.x;
          fA[ptr * 4 + 1] = b.y;
          fA[ptr * 4 + 2] = b.z;
          fA[ptr * 4 + 3] = b.seed;
          const r = 0.030 + Math.pow(rng(), 2.2) * 0.085;
          oA[ptr * 4 + 0] = r;
          oA[ptr * 4 + 1] = 0.34 + r * 5.2 + rng() * 0.14;
          oA[ptr * 4 + 2] = rng() * 80;
          oA[ptr * 4 + 3] = rng() * 80;
          dA[ptr * 2 + 0] = b.fx;
          dA[ptr * 2 + 1] = b.fz;
          ptr++;
        }
      }
      geo.setAttribute("aFrom", new THREE.InstancedBufferAttribute(fA, 4));
      geo.setAttribute("aOwn", new THREE.InstancedBufferAttribute(oA, 4));
      geo.setAttribute("aDrift", new THREE.InstancedBufferAttribute(dA, 2));
      geo.instanceCount = total;
      addMesh(geo, this.materials.bubbleMat, 0.6);
    }

    return tile;
  }

  _release(tile) {
    tile.group.removeFromParent();
    for (const g of tile.geos) g.dispose();
  }

  // Per-frame update: handles streaming tiles, submerged atmosphere, stir fade
  update(camera, dt = 0.016, buildBudget = 3) {
    this.frame++;
    const cx = camera.position.x;
    const cy = camera.position.y;
    const cz = camera.position.z;

    // Gentle decay of interactive water stir
    if (this.KU.uStir.value.w > 0.001) {
      this.KU.uStir.value.w *= Math.exp(-Math.max(dt, 0) * 1.15);
      if (this.KU.uStir.value.w < 0.005) this.KU.uStir.value.w = 0;
    }

    const field = this.getField();
    if (!field) return;

    // Detect if camera is genuinely submerged in water (dive mode!)
    const sub = cy < WATER_Y - 0.04;
    this.isSubmerged = sub;
    this.KU.uSubmerged.value = sub ? 1 : 0;
    this.subGroup.visible = sub;
    if (sub) {
      this.dome.position.set(cx, cy, cz);
      const isl = field.islandAt(cx, cz);
      if (isl?.world) {
        const pr = sampleWaterProps(isl.world, cx - isl.spec.cx, cz - isl.spec.cz);
        if (pr) {
          const sum = pr.lake + pr.river + pr.swamp || 1;
          this.KU.uCamBiome.value.set(pr.lake / sum, pr.river / sum, pr.swamp / sum);
          this.KU.uCamFlow.value.set(pr.flowX, pr.flowZ);
        }
      }
      this.KU.uCamDepth.value = Math.max(0, -cy);
    }

    // Above 145 m aerial altitude underwater macro-kelp is sub-pixel; skip work cleanly
    const active = cy < 155;
    this.group.visible = active;
    if (!active) return;

    const r = this.tier.radius;
    const ctX = Math.floor(cx / TILE_SIZE);
    const ctZ = Math.floor(cz / TILE_SIZE);
    const key = `${ctX},${ctZ}`;

    if (key !== this.lastKey) {
      this.lastKey = key;
      this.pending.length = 0;
      const span = Math.ceil(r / TILE_SIZE);
      for (let dz = -span; dz <= span; dz++) {
        for (let dx = -span; dx <= span; dx++) {
          const tx = ctX + dx, tz = ctZ + dz;
          const d2 = (dx * TILE_SIZE) ** 2 + (dz * TILE_SIZE) ** 2;
          if (d2 > (r + TILE_SIZE) ** 2) continue;
          const k = `${tx},${tz}`;
          if (!this.tiles.has(k)) this.pending.push({ tx, tz, k, d2 });
        }
      }
      this.pending.sort((a, b) => a.d2 - b.d2);
    }

    // Build queued tiles inside frame budget
    let built = 0;
    while (this.pending.length && built < buildBudget) {
      const next = this.pending.shift();
      if (this.tiles.has(next.k)) continue;
      const t = this._buildTile(field, next.tx, next.tz);
      if (!t.empty) this.group.add(t.group);
      this.tiles.set(next.k, t);
      built++;
    }

    // Toggle visibility smoothly by radius & prune LRU old cached tiles
    const maxR = r + TILE_SIZE * 0.9;
    for (const [k, t] of this.tiles) {
      const [sx, sz] = k.split(",");
      const mx = (Number(sx) + 0.5) * TILE_SIZE;
      const mz = (Number(sz) + 0.5) * TILE_SIZE;
      const vis = Math.hypot(mx - cx, mz - cz) < maxR;
      if (!t.empty) t.group.visible = vis;
      if (vis) t.last = this.frame;
    }

    if (this.tiles.size > this.tier.keep) {
      const old = [...this.tiles.entries()]
        .filter(([, t]) => t.last < this.frame - 2)
        .sort((a, b) => a[1].last - b[1].last);
      for (const [k, t] of old) {
        this._release(t);
        this.tiles.delete(k);
        if (this.tiles.size <= this.tier.keep) break;
      }
    }
  }

  // Synchronously populate all surrounding underwater kelp tiles (for instant crisp capture/teleport)
  warmAll(camera, budget = 120) {
    this.lastKey = "";
    this.update(camera, 0, budget);
  }

  clear() {
    for (const t of this.tiles.values()) this._release(t);
    this.tiles.clear();
    this.pending.length = 0;
    this.lastKey = "";
  }

  get stats() {
    let visible = 0, meshes = 0;
    for (const t of this.tiles.values()) {
      if (!t.empty && t.group.visible) {
        visible++;
        meshes += t.meshes.length;
      }
    }
    return { tiles: this.tiles.size, visibleTiles: visible, meshes, submerged: this.isSubmerged };
  }

  dispose() {
    this.clear();
    this.group.removeFromParent();
    for (const g of this.boulderGeos) g.dispose();
    this.pebbleGeo.dispose();
    this.kelpGeo.dispose();
    this.sugarGeo.dispose();
    this.grassGeo.dispose();
    this.raftGeo.dispose();
    this.fishGeo.dispose();
    this.crabGeo.dispose();
    this.spongeGeo.dispose();
    this.dome.geometry.dispose();
    this.shafts.geometry.dispose();
    this.snow.geometry.dispose();
    for (const m of Object.values(this.materials)) m.dispose();
    for (const m of this.subMaterials) m.dispose();
  }
}

// Helper to find the richest natural Dive spot inside a lake, river, or swamp
export function findUnderwaterSpot(world, type, name, center = { x: 0, z: 0 }) {
  if (!world) return null;
  const pickBest = (candidates) => {
    let best = null;
    for (const c of candidates) {
      const p = sampleWaterProps(world, c.x, c.z);
      if (!p) continue;
      if (type === "swamp" && p.depth < 1.8) continue;
      if (type !== "swamp" && p.depth < 3.0) continue;
      // Enforce clean wide open water corridor in sightline (keeps swamps genuinely deep amber bayou too!)
      if (type === "swamp" && (p.swamp < 0.38 || p.depth < 2.2)) continue;
      const lx = Math.cos(c.yaw), lz = Math.sin(c.yaw);
      let ok = 0, minD = p.depth, swTotal = p.swamp;
      for (const d of [4, 9, 15, 22, 32]) {
        const q = sampleWaterProps(world, c.x + lx * d, c.z + lz * d);
        if (q && q.depth > (type === "swamp" ? 2.0 : 3.2)) {
          ok++;
          swTotal += q.swamp;
          if (q.depth < minD) minD = q.depth;
        }
      }
      if (ok < (type === "swamp" ? 4 : 4)) continue;
      const targetDepth = type === "lake" ? 8.2 : type === "river" ? 6.6 : 3.2;
      const swBonus = type === "swamp" ? swTotal * 12 : 0;
      const score = ok * 12 + minD * 1.5 - Math.abs(p.depth - targetDepth) * 1.2 + swBonus + (c.bonus || 0);
      if (!best || score > best.score) {
        // Classic kelp3 low hovering perspective: sees sandy/rocky caustics floor, sugar kelp, boulders, towering spires & Snell's window overhead!
        const eyeY = -Math.max(1.4, Math.min(p.depth - 1.45, p.depth * 0.64));
        best = {
          x: c.x + center.x,
          y: eyeY,
          z: c.z + center.z,
          yaw: c.yaw,
          pitch: type === "swamp" ? 0.10 : 0.14,
          bedDepth: p.depth,
          name: c.name,
          score,
        };
      }
    }
    return best;
  };

  const cands = [];
  if (type === "lake" && world.lakes?.length) {
    const lk = world.lakes.find((l) => l.name === name) ||
      [...world.lakes].sort((a, b) => b.area - a.area)[0];
    if (lk) {
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        for (const f of [0.25, 0.48, 0.66]) {
          const x = lk.x + Math.cos(a) * lk.r * f;
          const z = lk.z + Math.sin(a) * lk.r * f;
          cands.push({ x, z, yaw: a + Math.PI, name: lk.name, bonus: f < 0.55 ? 4 : 0 });
        }
      }
    }
  } else if (type === "river" && world.rivers?.length) {
    const rv = world.rivers.find((r) => r.name === name) ||
      world.rivers.find((r) => r.kind === "main") ||
      world.rivers[0];
    if (rv) {
      const n = rv.pts.length / 2;
      for (let i = Math.max(2, Math.floor(n * 0.25)); i < n * 0.85; i += 2) {
        const x = rv.pts[i * 2], z = rv.pts[i * 2 + 1];
        const j = Math.min(n - 1, i + 2);
        const yaw = Math.atan2(rv.pts[j * 2 + 1] - z, rv.pts[j * 2] - x);
        const sw = world.swamp ? sampleField(world, world.swamp, x, z) : 0;
        cands.push({ x, z, yaw, name: rv.name, bonus: (1 - sw) * 10 + (rv.hw[i] || 10) * 0.18 });
      }
    }
  } else if (type === "swamp") {
    const ms = world.marshes?.length
      ? (world.marshes.find((m) => m.name === name) || [...world.marshes].sort((a, b) => b.area - a.area)[0])
      : null;
    if (ms) {
      for (let dz = -ms.r * 0.9; dz <= ms.r * 0.9; dz += 14) {
        for (let dx = -ms.r * 0.9; dx <= ms.r * 0.9; dx += 14) {
          const x = ms.x + dx, z = ms.z + dz;
          const sw = world.swamp ? sampleField(world, world.swamp, x, z) : 0;
          if (sw < 0.35) continue;
          for (let k = 0; k < 4; k++) {
            cands.push({ x, z, yaw: k * Math.PI * 0.5 + 0.3, name: ms.name, bonus: sw * 14 });
          }
        }
      }
    }
  }
  const hit = pickBest(cands);
  if (hit) return hit;

  // Fallback: scan any deep freshwater spot
  if (world.lakes?.length) {
    const lk = world.lakes[0];
    return { x: lk.x + center.x, y: -3.2, z: lk.z + center.z, yaw: 0.4, pitch: 0.1, bedDepth: 8, name: lk.name };
  }
  return null;
}
