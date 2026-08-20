/* game/world/props.js
   Felsen, Bäume, Monolithen und schwebende Plattformen.

   Alles wird instanziert gezeichnet — 400 Objekte kosten so vier Zeichenaufrufe
   statt vierhundert. Was fest ist, meldet sich zusätzlich als *Solid* an; das
   ist die einzige Kollisionsform neben dem Gelände. Zwei Formen reichen:
   stehende Zylinder (Felsen, Säulen, Plattformen) und Kästen. */
(function (ROR) {
  'use strict';

  const U = ROR.Util;
  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const E = new THREE.Euler();
  const V = new THREE.Vector3();
  const S = new THREE.Vector3();

  /* Kugel mit unregelmäßiger Oberfläche. Die Auslenkung hängt nur von der
     Richtung ab, damit doppelt vorhandene Eckpunkte gleich weit wandern und
     die Flächen nicht aufreißen. */
  function boulderGeometry(noise, detail, rough) {
    const geo = new THREE.IcosahedronGeometry(1, detail);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const d = 1 + noise.noise2(x * 1.7 + z * 0.6, y * 1.9 - z * 1.1) * rough;
      pos.setXYZ(i, x * d, y * d * 0.82, z * d);
    }
    geo.computeVertexNormals();
    return geo;
  }

  function instanced(geo, count, castShadow) {
    // Gefärbt wird je Exemplar über instanceColor — deshalb *kein* vertexColors,
    // sonst verlangt der Shader ein Attribut, das die Geometrie nicht hat.
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.castShadow = !!castShadow;
    mesh.receiveShadow = true;
    mesh.capacity = count;
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    return mesh;
  }

  function place(mesh, x, y, z, sx, sy, sz, rotY, tilt, color) {
    if (mesh.count >= mesh.capacity) return;
    E.set(tilt ? tilt.x : 0, rotY, tilt ? tilt.z : 0);
    Q.setFromEuler(E);
    M.compose(V.set(x, y, z), Q, S.set(sx, sy, sz));
    mesh.setMatrixAt(mesh.count, M);
    if (color) mesh.setColorAt(mesh.count, color);
    mesh.count++;
  }

  ROR.Props = {
    /* Streut die Objekte über das Gelände und liefert Gruppe + Solids zurück. */
    scatter(terrain, rng, seed) {
      const theme = terrain.theme;
      const P = theme.palette;
      const cfg = theme.props;
      const noise = U.Noise(seed ^ 0x5bd1e995);
      const group = new THREE.Group();
      group.name = 'props';
      const solids = [];
      const tint = new THREE.Color();

      /* ------------------------------------------------------------ Felsen */

      const rockGeos = [
        boulderGeometry(noise, 1, 0.30),
        boulderGeometry(noise, 1, 0.44),
        boulderGeometry(noise, 0, 0.36)
      ];
      const rockMeshes = rockGeos.map((g) => instanced(g, cfg.boulders, true));

      for (let i = 0; i < cfg.boulders; i++) {
        const spot = terrain.findSpot(rng, { rMax: terrain.half * 0.94, maxSlope: 0.55, tries: 12 });
        if (!spot) continue;
        const scale = rng.range(0.7, 3.4);
        const mesh = rockMeshes[rng.int(rockMeshes.length)];
        tint.set(P.rock).lerp(new THREE.Color(P.rockDark), rng.range(0, 0.75));
        place(mesh, spot.x, spot.y + scale * 0.42, spot.z,
              scale * rng.range(0.85, 1.25), scale, scale * rng.range(0.85, 1.25),
              rng.range(0, U.TAU), { x: rng.range(-0.2, 0.2), z: rng.range(-0.2, 0.2) }, tint);
        // Nur was groß genug ist, blockiert auch. Kleine Steine sind Dekoration.
        if (scale > 1.6) {
          solids.push({ kind: 'cyl', x: spot.x, z: spot.z, r: scale * 0.85,
                        y0: spot.y - 1, y1: spot.y + scale * 1.15 });
        }
      }

      /* ------------------------------------------------------------- Bäume */

      const trunkGeo = new THREE.CylinderGeometry(0.24, 0.42, 1, 6, 1);
      trunkGeo.translate(0, 0.5, 0);
      const coneGeo = new THREE.ConeGeometry(1, 1, 7, 1);
      coneGeo.translate(0, 0.5, 0);

      const trunkMesh = instanced(trunkGeo, cfg.trees, true);
      const leafLow = instanced(coneGeo, cfg.trees, true);
      const leafHigh = instanced(coneGeo, cfg.trees, true);

      for (let i = 0; i < cfg.trees; i++) {
        const spot = terrain.findSpot(rng, { rMax: terrain.half * 0.9, maxSlope: 0.3, tries: 10 });
        if (!spot) continue;
        const h = rng.range(8, 19);
        const lean = rng.range(-0.06, 0.06);
        const rot = rng.range(0, U.TAU);
        tint.set(P.trunk).multiplyScalar(rng.range(0.8, 1.2));
        place(trunkMesh, spot.x, spot.y - 0.2, spot.z, 1, h * 0.62, 1, rot, { x: lean, z: lean }, tint);

        tint.set(P.leaf).lerp(new THREE.Color(P.leafAlt), rng.next());
        place(leafLow, spot.x, spot.y + h * 0.30, spot.z, h * 0.30, h * 0.46, h * 0.30, rot, null, tint);
        place(leafHigh, spot.x, spot.y + h * 0.58, spot.z, h * 0.21, h * 0.40, h * 0.21, rot + 0.5, null,
              tint.clone().multiplyScalar(1.12));
        // Bäume blockieren nicht — sonst bleibt man im Wald ständig hängen.
      }

      /* -------------------------------------------------------- Monolithen */

      const pillarGeo = new THREE.CylinderGeometry(0.72, 1, 1, 6, 1);
      pillarGeo.translate(0, 0.5, 0);
      const pillarMesh = instanced(pillarGeo, cfg.pillars, true);

      for (let i = 0; i < cfg.pillars; i++) {
        const spot = terrain.findSpot(rng, { rMin: 18, rMax: terrain.half * 0.85, maxSlope: 0.22, tries: 25 });
        if (!spot) continue;
        const h = rng.range(14, 38);
        const r = rng.range(2.6, 6.2);
        tint.set(P.rockDark).lerp(new THREE.Color(P.rock), rng.range(0.15, 0.9));
        place(pillarMesh, spot.x, spot.y - 1.5, spot.z, r, h, r, rng.range(0, U.TAU),
              { x: rng.range(-0.05, 0.05), z: rng.range(-0.05, 0.05) }, tint);
        solids.push({ kind: 'cyl', x: spot.x, z: spot.z, r: r * 0.92, y0: spot.y - 2, y1: spot.y - 1.5 + h });
      }

      /* ------------------------------------------- Schwebende Plattformen */

      /* Sie sind der Grund, warum die Höhe im Spiel überhaupt zählt: sie geben
         Sprungziele und später den Gegnern aus der Luft eine Landefläche. */
      const platGeo = new THREE.CylinderGeometry(1, 0.78, 1, 6, 1);
      platGeo.translate(0, -0.5, 0);
      const platMesh = instanced(platGeo, cfg.platforms, true);

      for (let i = 0; i < cfg.platforms; i++) {
        const spot = terrain.findSpot(rng, { rMin: 14, rMax: terrain.half * 0.8, maxSlope: 0.6, tries: 20 });
        if (!spot) continue;
        const r = rng.range(3.4, 8);
        const thick = rng.range(2.6, 5.5);
        const y = spot.y + rng.range(7, 24);
        tint.set(P.rockDark).lerp(new THREE.Color(P.rock), rng.range(0.2, 0.8));
        place(platMesh, spot.x, y, spot.z, r, thick, r, rng.range(0, U.TAU), null, tint);
        solids.push({ kind: 'cyl', x: spot.x, z: spot.z, r: r * 0.94, y0: y - thick, y1: y });
      }

      [].concat(rockMeshes, [trunkMesh, leafLow, leafHigh, pillarMesh, platMesh]).forEach((m) => {
        if (m.count === 0) return;
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
        m.computeBoundingSphere();   // sonst rechnet das Aussortieren mit der leeren Hülle
        group.add(m);
      });

      return { group: group, solids: solids };
    }
  };
})(window.ROR);
