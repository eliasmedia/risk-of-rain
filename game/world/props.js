/* game/world/props.js
   Was auf einer Stage steht — und was auf ihr *liegt*.

   Vorher gab es überall dieselben Kegelbäume, Zylindersäulen und
   Sechseckplatten; dass die Wüste dieselben Fichten hatte wie die Wiese, war
   der halbe Grund, warum alle Stages gleich aussahen. Jetzt bringt jede
   Stage ihre eigene Liste mit (`props.kinds`), und jede Bauart weiß, wie sie
   aussieht und ob sie im Weg steht.

   Dazu kommt die **Detailschicht**: Grasbüschel, Geröll, Kantensteine. Ein
   paar tausend winzige Objekte, die man einzeln nicht wahrnimmt — aber ohne
   die jede Fläche wie lackiertes Plastik wirkt. Sie kosten nichts, weil sie
   instanziert gezeichnet werden und keine Kollision haben.

   Alles wird instanziert: vierhundert Objekte kosten so vier Zeichenaufrufe
   statt vierhundert. */
(function (ROR) {
  'use strict';

  const U = ROR.Util;
  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const E = new THREE.Euler();
  const V = new THREE.Vector3();
  const S = new THREE.Vector3();

  /* ------------------------------------------------------- Bausteine */

  /* Verjüngtes Prisma — dieselbe Idee wie bei den Figuren: oben und unten
     verschieden breit. Ein Fels aus Prismen sieht aus wie Fels, ein Fels aus
     Quadern sieht aus wie eine Kiste. */
  function prism(tw, bw, h, seiten, td, bd) {
    const g = new THREE.CylinderGeometry(0.5, 0.5, 1, seiten || 6, 1);
    if (seiten === 4) g.rotateY(Math.PI / 4);
    const pos = g.attributes.position;
    const f = seiten === 4 ? 2 * Math.SQRT1_2 : 2;
    for (let i = 0; i < pos.count; i++) {
      const oben = pos.getY(i) > 0;
      pos.setX(i, pos.getX(i) * (oben ? tw : bw) * f);
      pos.setZ(i, pos.getZ(i) * (oben ? (td === undefined ? tw : td)
                                      : (bd === undefined ? bw : bd)) * f);
      pos.setY(i, pos.getY(i) * h);
    }
    g.computeVertexNormals();
    return g;
  }

  function verbinde(teile) {
    // Ein Mesh aus mehreren Formen: das spart je Objekt einen Zeichenaufruf.
    const geos = [];
    for (let i = 0; i < teile.length; i++) {
      const t = teile[i];
      const g = t.geo.clone();
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(t.rx || 0, t.ry || 0, t.rz || 0));
      m.compose(new THREE.Vector3(t.x || 0, t.y || 0, t.z || 0), q,
                new THREE.Vector3(t.sx || 1, t.sy || 1, t.sz || 1));
      g.applyMatrix4(m);
      geos.push(g);
    }
    // Von Hand zusammenfügen — BufferGeometryUtils liegt unter examples/.
    let n = 0;
    for (let i = 0; i < geos.length; i++) n += geos[i].attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
    let o = 0;
    for (let i = 0; i < geos.length; i++) {
      const g = geos[i];
      const p = g.attributes.position.array, q = g.attributes.normal.array;
      // Indizierte Geometrie zuerst auflösen, sonst passt die Länge nicht.
      const idx = g.index ? g.index.array : null;
      if (idx) {
        for (let k = 0; k < idx.length; k++) {
          pos[o * 3] = p[idx[k] * 3]; pos[o * 3 + 1] = p[idx[k] * 3 + 1]; pos[o * 3 + 2] = p[idx[k] * 3 + 2];
          nor[o * 3] = q[idx[k] * 3]; nor[o * 3 + 1] = q[idx[k] * 3 + 1]; nor[o * 3 + 2] = q[idx[k] * 3 + 2];
          o++;
        }
      } else {
        for (let k = 0; k < g.attributes.position.count; k++) {
          pos[o * 3] = p[k * 3]; pos[o * 3 + 1] = p[k * 3 + 1]; pos[o * 3 + 2] = p[k * 3 + 2];
          nor[o * 3] = q[k * 3]; nor[o * 3 + 1] = q[k * 3 + 1]; nor[o * 3 + 2] = q[k * 3 + 2];
          o++;
        }
      }
      g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, o * 3), 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor.subarray(0, o * 3), 3));
    return out;
  }

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

  /* ------------------------------------------------- Die Bauarten selbst */

  /* Jede liefert Geometrie plus die Angaben, wie sie gestreut wird:
       geo(noise, P)       das Modell (Einheitsgröße, Fuß bei y = 0)
       farbe(P, rng)       Farbe je Exemplar
       skala               [min, max]
       solid               'cyl' | null — steht es im Weg?
       neigung             maximale Hangneigung am Standort
       ausrichtung         'boden' | 'decke'                                */

  const BAUARTEN = {

    fels: {
      geo: (n) => boulderGeometry(n, 1, 0.34),
      farbe: (P, r) => new THREE.Color(P.rock).lerp(new THREE.Color(P.rockDark), r.range(0, 0.8)),
      skala: [0.7, 3.4], neigung: 0.55, solid: 0.85, solidAb: 1.6, versatz: 0.42
    },

    /* Nadelbaum: drei Kronen und ein verjüngter Stamm statt eines Kegels auf
       einem Zylinder. Der Unterschied ist die Silhouette. */
    nadelbaum: {
      geo: () => verbinde([
        { geo: prism(0.055, 0.11, 1.0, 5), y: 0.5 },
        { geo: new THREE.ConeGeometry(0.34, 0.55, 7), y: 1.05 },
        { geo: new THREE.ConeGeometry(0.27, 0.5, 7), y: 1.4 },
        { geo: new THREE.ConeGeometry(0.17, 0.42, 7), y: 1.75 }
      ]),
      farbe: (P, r) => new THREE.Color(P.leaf).lerp(new THREE.Color(P.leafAlt), r.next()),
      skala: [3.6, 8.5], neigung: 0.30, solid: null, versatz: -0.2
    },

    laubbaum: {
      geo: () => verbinde([
        { geo: prism(0.07, 0.14, 1.2, 6), y: 0.6 },
        { geo: new THREE.IcosahedronGeometry(0.55, 0), y: 1.5, sy: 0.8 },
        { geo: new THREE.IcosahedronGeometry(0.38, 0), y: 1.85, x: 0.24, sy: 0.8 },
        { geo: new THREE.IcosahedronGeometry(0.34, 0), y: 1.75, x: -0.28, z: 0.2, sy: 0.8 }
      ]),
      farbe: (P, r) => new THREE.Color(P.leaf).lerp(new THREE.Color(P.leafAlt), r.next()),
      skala: [3.2, 7], neigung: 0.28, solid: null, versatz: -0.2
    },

    /* Toter Baum: kahle Gabelung. Das Wüstenmotiv, das keine Fichte kann. */
    totbaum: {
      geo: () => verbinde([
        { geo: prism(0.05, 0.13, 1.4, 5), y: 0.7 },
        { geo: prism(0.03, 0.06, 0.7, 4), y: 1.35, x: 0.22, rz: -0.7 },
        { geo: prism(0.03, 0.06, 0.6, 4), y: 1.5, x: -0.2, z: 0.1, rz: 0.6 },
        { geo: prism(0.02, 0.04, 0.4, 4), y: 1.75, x: 0.34, rz: -1.0 }
      ]),
      farbe: (P, r) => new THREE.Color(P.trunk).multiplyScalar(r.range(0.8, 1.2)),
      skala: [2.6, 5.5], neigung: 0.35, solid: null, versatz: -0.1
    },

    strauch: {
      geo: () => verbinde([
        { geo: new THREE.IcosahedronGeometry(0.4, 0), y: 0.34, sy: 0.6 },
        { geo: new THREE.IcosahedronGeometry(0.26, 0), y: 0.4, x: 0.3, sy: 0.6 },
        { geo: new THREE.IcosahedronGeometry(0.22, 0), y: 0.3, x: -0.26, z: 0.2, sy: 0.6 }
      ]),
      farbe: (P, r) => new THREE.Color(P.leafAlt).multiplyScalar(r.range(0.6, 1.0)),
      skala: [0.8, 1.9], neigung: 0.4, solid: null, versatz: 0
    },

    monolith: {
      geo: () => prism(0.72, 1.0, 1.0, 6),
      farbe: (P, r) => new THREE.Color(P.rockDark).lerp(new THREE.Color(P.rock), r.range(0.15, 0.9)),
      skala: [11, 34], neigung: 0.22, solid: 0.9, versatz: -0.06, breit: [0.14, 0.3]
    },

    /* Aquädukt: zwei Pfeiler, ein Bogen darüber, kleinere Bögen obenauf. */
    aquaedukt: {
      geo: () => {
        const teile = [];
        for (let k = -1; k <= 1; k += 2) {
          teile.push({ geo: prism(0.15, 0.19, 1.0, 4), x: k * 0.42, y: 0.5 });
        }
        teile.push({ geo: prism(0.55, 0.6, 0.13, 4, 0.2, 0.24), y: 1.06 });
        for (let k = -1; k <= 1; k += 2) {
          teile.push({ geo: prism(0.07, 0.09, 0.34, 4), x: k * 0.28, y: 1.3 });
        }
        teile.push({ geo: prism(0.5, 0.52, 0.1, 4, 0.18, 0.2), y: 1.52 });
        return verbinde(teile);
      },
      farbe: (P, r) => new THREE.Color(P.rock).lerp(new THREE.Color(P.sand), r.range(0, 0.6)),
      skala: [9, 18], neigung: 0.18, solid: 0.5, versatz: -0.05
    },

    saeule: {
      geo: () => {
        const teile = [];
        for (let i = 0; i < 4; i++) {
          teile.push({ geo: prism(0.22, 0.24, 0.24, 8), y: 0.13 + i * 0.25,
                       rz: (i % 2 ? 0.03 : -0.03) });
        }
        teile.push({ geo: prism(0.3, 0.26, 0.1, 4), y: 1.08 });
        return verbinde(teile);
      },
      farbe: (P, r) => new THREE.Color(P.sand).lerp(new THREE.Color(P.rock), r.range(0, 0.7)),
      skala: [4, 9], neigung: 0.16, solid: 0.6, versatz: -0.05
    },

    /* Höhle: Zacken vom Boden und von der Decke. */
    stalagmit: {
      geo: () => prism(0.04, 0.42, 1.0, 6),
      farbe: (P, r) => new THREE.Color(P.rockDark).lerp(new THREE.Color(P.rock), r.range(0, 0.8)),
      skala: [2, 9], neigung: 0.5, solid: 0.5, versatz: -0.05
    },

    stalaktit: {
      geo: () => prism(0.42, 0.04, 1.0, 6),
      farbe: (P, r) => new THREE.Color(P.rockDark).lerp(new THREE.Color(P.rock), r.range(0, 0.6)),
      skala: [2, 8], neigung: 1, solid: null, ausrichtung: 'decke', versatz: 0
    },

    kristall: {
      geo: () => verbinde([
        { geo: prism(0.02, 0.16, 1.0, 5), y: 0.5 },
        { geo: prism(0.02, 0.1, 0.6, 5), y: 0.3, x: 0.16, rz: -0.4 },
        { geo: prism(0.02, 0.09, 0.5, 5), y: 0.26, x: -0.14, z: 0.1, rz: 0.5 }
      ]),
      farbe: (P, r) => new THREE.Color(P.water).lerp(new THREE.Color(0xffcf80), r.range(0, 0.5)),
      skala: [1.4, 4.5], neigung: 0.5, solid: null, versatz: -0.05, leuchtet: 0.7
    },

    /* Rallypoint: gebaute Dinge statt gewachsener. */
    container: {
      geo: () => verbinde([
        { geo: prism(0.5, 0.5, 0.5, 4, 1.1, 1.1), y: 0.25 },
        { geo: prism(0.52, 0.52, 0.06, 4, 1.14, 1.14), y: 0.5 }
      ]),
      farbe: (P, r) => new THREE.Color([0xa8503c, 0x3c6a8a, 0x8a8f6a, 0x5a5f66][r.int(4)]),
      skala: [3.2, 5.5], neigung: 0.14, solid: 1.1, versatz: 0
    },

    betonblock: {
      geo: () => verbinde([
        { geo: prism(0.44, 0.5, 1.0, 4, 0.4, 0.46), y: 0.5 },
        { geo: prism(0.54, 0.5, 0.1, 4, 0.5, 0.46), y: 1.0 }
      ]),
      farbe: (P, r) => new THREE.Color(P.rock).lerp(new THREE.Color(P.rockDark), r.range(0.2, 0.9)),
      skala: [3, 9], neigung: 0.18, solid: 0.85, versatz: -0.04
    },

    antenne: {
      geo: () => verbinde([
        { geo: prism(0.05, 0.12, 1.0, 4), y: 0.5 },
        { geo: prism(0.03, 0.05, 0.5, 4), y: 1.25 },
        { geo: new THREE.CylinderGeometry(0.02, 0.24, 0.2, 8), y: 1.55, rx: -0.5 },
        { geo: prism(0.2, 0.02, 0.05, 4), y: 0.9, rz: 1.57 }
      ]),
      farbe: (P) => new THREE.Color(P.rockDark),
      skala: [7, 16], neigung: 0.15, solid: 0.3, versatz: -0.05
    },

    /* Schwebende Scholle — Sprungziel. */
    scholle: {
      geo: () => prism(1.0, 0.72, 1.0, 7),
      farbe: (P, r) => new THREE.Color(P.rockDark).lerp(new THREE.Color(P.rock), r.range(0.2, 0.8)),
      skala: [3.4, 8], neigung: 0.6, solid: 0.94, schwebt: [6, 22]
    },

    felsscherbe: {
      geo: () => prism(0.06, 0.9, 1.0, 5),
      farbe: (P, r) => new THREE.Color(P.rock).lerp(new THREE.Color(P.rockDark), r.range(0, 0.7)),
      skala: [3, 9], neigung: 0.7, solid: null, schwebt: [8, 30], kopfueber: true
    }
  };

  /* ----------------------------------------------------------- Streuen */

  function instanced(geo, count, castShadow, leuchtet) {
    const mat = new THREE.MeshLambertMaterial({
      color: 0xffffff, flatShading: true,
      emissive: leuchtet ? 0xffffff : 0x000000,
      emissiveIntensity: leuchtet || 0
    });
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, count));
    mesh.castShadow = !!castShadow;
    mesh.receiveShadow = true;
    mesh.capacity = Math.max(1, count);
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    return mesh;
  }

  function place(mesh, x, y, z, sx, sy, sz, rotY, tilt, color) {
    if (mesh.count >= mesh.capacity) return false;
    E.set(tilt ? tilt.x : 0, rotY, tilt ? tilt.z : 0);
    Q.setFromEuler(E);
    M.compose(V.set(x, y, z), Q, S.set(sx, sy, sz));
    mesh.setMatrixAt(mesh.count, M);
    if (color) mesh.setColorAt(mesh.count, color);
    mesh.count++;
    return true;
  }

  ROR.Props = {
    BAUARTEN: BAUARTEN,

    scatter(terrain, rng, seed) {
      const theme = terrain.theme;
      const P = theme.palette;
      const cfg = theme.props;
      const noise = U.Noise(seed ^ 0x5bd1e995);
      const group = new THREE.Group();
      group.name = 'props';
      const solids = [];
      const tint = new THREE.Color();
      const meshes = [];

      /* --------------------------------------------- Große Streuobjekte */

      (cfg.kinds || []).forEach(function (eintrag) {
        const art = BAUARTEN[eintrag.kind];
        if (!art || eintrag.count <= 0) return;
        const geo = art.geo(noise, P);
        const mesh = instanced(geo, eintrag.count, true, art.leuchtet);
        meshes.push(mesh);

        for (let i = 0; i < eintrag.count; i++) {
          const spot = terrain.findSpot(rng, {
            rMin: eintrag.rMin || 0,
            rMax: terrain.half * (eintrag.rMax || 0.9),
            maxSlope: art.neigung, tries: 12,
            minHeight: terrain.seaLevel + 0.5
          });
          if (!spot) continue;

          const skala = eintrag.skala || art.skala;
          const s = rng.range(skala[0], skala[1]);
          const breit = art.breit ? rng.range(art.breit[0], art.breit[1]) * s
                                  : s * rng.range(0.85, 1.2);
          tint.copy(art.farbe(P, rng));

          let y = spot.y + (art.versatz || 0) * s;
          let rx = rng.range(-0.06, 0.06), rz = rng.range(-0.06, 0.06);

          if (art.ausrichtung === 'decke') {
            const decke = terrain.ceilingAt(spot.x, spot.z);
            if (!isFinite(decke)) continue;
            y = decke - s * 0.5;
            rx = Math.PI + rx;
          } else if (art.schwebt) {
            y = spot.y + rng.range(art.schwebt[0], art.schwebt[1]);
            if (art.kopfueber) rx = Math.PI + rng.range(-0.3, 0.3);
          }

          if (!place(mesh, spot.x, y, spot.z, breit, s, breit,
                     rng.range(0, U.TAU), { x: rx, z: rz }, tint)) break;

          // Kleine Steine sind Dekoration; erst ab `solidAb` stehen sie im Weg.
          if (art.solid && s >= (art.solidAb || 0)) {
            solids.push({ kind: 'cyl', x: spot.x, z: spot.z, r: breit * art.solid,
                          y0: y - s * 0.6, y1: y + s * (art.schwebt ? 0.0 : 0.9) });
          }
        }
      });

      /* ------------------------------------------------- Detailschicht */

      /* Das, was den Boden aufhört wie lackiert aussehen zu lassen. Winzig,
         zahlreich, ohne Kollision und ohne Schatten — dafür überall. */
      const detail = cfg.detail || 0;
      if (detail > 0) {
        const halmGeo = verbinde([
          { geo: prism(0.0, 0.05, 0.5, 3), y: 0.25 },
          { geo: prism(0.0, 0.04, 0.4, 3), y: 0.2, x: 0.05, rz: -0.35 },
          { geo: prism(0.0, 0.04, 0.34, 3), y: 0.17, x: -0.05, z: 0.04, rz: 0.4 }
        ]);
        const kiesGeo = new THREE.IcosahedronGeometry(0.5, 0);
        const halme = instanced(halmGeo, Math.round(detail * 0.85), false);
        const kies = instanced(kiesGeo, Math.round(detail * 0.4), false);
        halme.receiveShadow = false; kies.receiveShadow = false;
        meshes.push(halme, kies);

        const cGrass = new THREE.Color(P.grass);
        const cGrassDark = new THREE.Color(P.grassDark);
        const cRock = new THREE.Color(P.rock);
        const cRockDark = new THREE.Color(P.rockDark);

        /* In Büscheln statt gleichmäßig: Gras wächst in Gruppen, und eine
           gleichverteilte Streuung sieht sofort nach Computer aus. Nebenbei
           spart es Suchaufrufe — ein gefundener Platz trägt fünf Halme. */
        const gruppen = Math.ceil(detail / 5);
        for (let i = 0; i < gruppen; i++) {
          const spot = terrain.findSpot(rng, {
            rMax: terrain.half * 0.94, maxSlope: 0.45, tries: 5,
            minHeight: terrain.seaLevel + 0.3
          });
          if (!spot) continue;
          const steil = terrain.slopeAt(spot.x, spot.z) > 0.22;
          const anzahl = 3 + rng.int(5);
          for (let k = 0; k < anzahl; k++) {
            const a = rng.next() * U.TAU;
            const d = Math.sqrt(rng.next()) * 2.6;
            const x = spot.x + Math.cos(a) * d, z = spot.z + Math.sin(a) * d;
            const y = terrain.heightAt(x, z);
            if (y < terrain.seaLevel + 0.2) continue;
            if (!steil && rng.next() < 0.78) {
              tint.copy(cGrass).lerp(cGrassDark, rng.next());
              /* Knapp knöcheltief. Höhere Halme lesen sich aus der
                 Verfolgerkamera als Speere im Boden, nicht als Gras. */
              place(halme, x, y, z,
                    rng.range(0.6, 1.25), rng.range(0.45, 1.15), rng.range(0.6, 1.25),
                    rng.range(0, U.TAU), null, tint);
            } else {
              tint.copy(cRock).lerp(cRockDark, rng.next());
              const g = rng.range(0.12, 0.40);
              place(kies, x, y + g * 0.28, z, g, g * rng.range(0.5, 0.9), g,
                    rng.range(0, U.TAU),
                    { x: rng.range(-0.4, 0.4), z: rng.range(-0.4, 0.4) }, tint);
            }
          }
        }
      }

      meshes.forEach(function (m) {
        if (m.count === 0) return;
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
        m.computeBoundingSphere();
        group.add(m);
      });

      return { group: group, solids: solids };
    }
  };
})(window.ROR);
