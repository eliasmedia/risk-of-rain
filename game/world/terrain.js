/* game/world/terrain.js
   Prozedurales Gelände aus einer einzigen Höhenfunktion.

   Aus derselben Funktion kommen Boden, Klippen und Küste — und damit auch die
   Antwort auf „wo darf jemand stehen". Es gibt kein zweites, separat gepflegtes
   Kollisionsmodell; `heightAt` ist die Wahrheit für Spieler, Gegner und Kamera.

   Der Kniff für die RoR2-Optik sind die Terrassen: die Höhe wird stufenweise
   gerundet, aber nur dort, wo eine Maske Plateaus vorsieht. Das ergibt weite
   flache Flächen mit senkrechten Kanten statt gleichmäßiger Hügel. */
(function (ROR) {
  'use strict';

  const U = ROR.Util;

  /* Rundet auf Stufen von `step`. `sharp` ist der Anteil der Stufe, auf dem der
     Übergang stattfindet: 0.24 heißt, 76 % der Fläche sind eben. */
  function terrace(h, step, sharp) {
    const t = h / step;
    const i = Math.floor(t);
    return (i + U.smoothstep(1 - sharp, 1, t - i)) * step;
  }

  ROR.Terrain = {
    build(theme, seed) {
      const T = theme.terrain;
      const P = theme.palette;
      const size = theme.size;
      const res = theme.res;
      const half = size / 2;
      const cell = size / res;
      const sea = theme.seaLevel || 0;
      const n = ROR.Util.Noise(seed);

      /* ------------------------------------------------ Die Höhenfunktion */

      function rawHeight(x, z) {
        // Küstenabfall. Der Radius wird verrauscht, sonst ist die Insel rund.
        const warp = n.fbm(x / 90, z / 90, 2) * T.shoreWarp;
        const r = Math.sqrt(x * x + z * z) / half + warp;
        const land = U.smoothstep(T.shoreOuter, T.shoreInner, r);

        const hills = n.fbm(x / T.hillScale, z / T.hillScale, 4) * T.hillAmp;
        const detail = n.fbm(x / T.detailScale, z / T.detailScale, 3) * T.detailAmp;

        // Wo stehen Plateaus? Eine eigene, gröbere Maske entscheidet das. Sie
        // wird mit dem Landanteil multipliziert, damit an der Küste keine
        // Klippen ins Wasser ragen.
        const m = n.fbm(x / T.maskScale, z / T.maskScale, 3);
        const mask = U.smoothstep(T.maskBias, T.maskBias + T.maskWidth, m) * land;

        // Zwei harte Schwellen auf demselben Rauschfeld: das ergibt zwei
        // Stufen mit waagerechtem Deckel und steiler Flanke. Gratrauschen
        // allein gäbe nur Spitzen — genau das, was hier nicht hingehört.
        // Weil die Maske den Betrag skaliert, laufen die Tafelberge an ihren
        // Rändern von selbst als begehbare Rampe aus.
        const f = n.fbm(x / T.ridgeScale, z / T.ridgeScale, 3) * 0.5 + 0.5;
        const mesa = mask * T.ridgeAmp * (
          U.smoothstep(T.mesaLow, T.mesaLow + T.mesaEdge, f) * 0.55 +
          U.smoothstep(T.mesaHigh, T.mesaHigh + T.mesaEdge, f) * 0.45
        );

        let h = T.baseHeight + hills + detail + mesa;
        h = h * land - (1 - land) * T.drop;

        // Terrassieren ganz zum Schluss — davor würde der Küstenabfall die
        // Stufen wieder schräg ziehen und alles sähe aus wie geknetet.
        return U.lerp(h, terrace(h, T.terraceStep, T.terraceSharp), mask);
      }

      /* ----------------------------------------------- Gitter und Geometrie */

      const dim = res + 1;
      const heights = new Float32Array(dim * dim);
      for (let j = 0; j < dim; j++) {
        const z = -half + j * cell;
        for (let i = 0; i < dim; i++) {
          heights[j * dim + i] = rawHeight(-half + i * cell, z);
        }
      }

      const geo = new THREE.PlaneGeometry(size, size, res, res);
      geo.rotateX(-Math.PI / 2);
      const pos = geo.attributes.position;
      for (let k = 0; k < pos.count; k++) pos.setY(k, heights[k]);
      pos.needsUpdate = true;
      geo.computeVertexNormals();

      /* ------------------------------------------------------ Vertexfarben */

      const col = new Float32Array(pos.count * 3);
      const nor = geo.attributes.normal;
      const c = new THREE.Color();
      const cGrass = new THREE.Color(P.grass), cGrassDark = new THREE.Color(P.grassDark);
      const cRock = new THREE.Color(P.rock), cRockDark = new THREE.Color(P.rockDark);
      const cSand = new THREE.Color(P.sand), cPeak = new THREE.Color(P.peak);
      const cDirt = new THREE.Color(P.dirt), cSeabed = new THREE.Color(P.seabed);
      const peakLine = T.baseHeight + T.ridgeAmp * 0.55;

      for (let k = 0; k < pos.count; k++) {
        const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k);
        const slope = 1 - nor.getY(k);                       // 0 = eben, 1 = senkrecht
        const grain = n.fbm(x / 9, z / 9, 3) * 0.5 + 0.5;    // bricht die Flächen auf
        const patch = n.fbm(x / 46, z / 46, 2) * 0.5 + 0.5;  // großflächige Farbzonen

        c.copy(cGrass).lerp(cGrassDark, grain * 0.7 + patch * 0.3);

        // Kanten sollen als Fels lesbar sein — deshalb ein kurzer, harter
        // Übergang statt eines weichen Verlaufs über die halbe Böschung.
        const dirtMix = U.smoothstep(0.07, 0.16, slope);
        if (dirtMix > 0) c.lerp(cDirt, dirtMix * 0.6);
        const rockMix = U.smoothstep(0.11, 0.26, slope);
        if (rockMix > 0) c.lerp(cRockDark.clone().lerp(cRock, grain * 0.75 + patch * 0.25), rockMix);

        const peakMix = U.smoothstep(peakLine, peakLine + 14, y) * (1 - rockMix * 0.6);
        if (peakMix > 0) c.lerp(cPeak, peakMix * 0.8);
        // Sandband nur im Uferstreifen; darunter wird es Meeresboden. Ohne das
        // leuchtet die Geländeplatte, die 150 m über die Insel hinausragt, als
        // helle Fläche unter dem Wasser hervor.
        const sandMix = U.smoothstep(sea + 2.6, sea - 0.4, y);
        if (sandMix > 0) c.lerp(cSand, sandMix);
        const deepMix = U.smoothstep(sea - 0.5, sea - 7, y);
        if (deepMix > 0) c.lerp(cSeabed, deepMix);

        col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

      const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
      mesh.receiveShadow = true;
      mesh.name = 'terrain';

      /* ------------------------------------------------------------ Wasser */

      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(6000, 6000, 1, 1).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: P.water, fog: true })
      );
      water.position.y = sea;
      water.name = 'water';

      /* ------------------------------------------------------- Abfragen */

      function inBounds(x, z) { return x > -half && x < half && z > -half && z < half; }

      /* Bilineare Höhe. Außerhalb des Feldes tief genug, dass man dort fällt. */
      function heightAt(x, z) {
        const gx = (x + half) / cell, gz = (z + half) / cell;
        if (gx < 0 || gz < 0 || gx >= res || gz >= res) return -T.drop - 40;
        const i = gx | 0, j = gz | 0;
        const fx = gx - i, fz = gz - j;
        const h00 = heights[j * dim + i], h10 = heights[j * dim + i + 1];
        const h01 = heights[(j + 1) * dim + i], h11 = heights[(j + 1) * dim + i + 1];
        return U.lerp(U.lerp(h00, h10, fx), U.lerp(h01, h11, fx), fz);
      }

      /* Normale aus zentralen Differenzen — reicht für Rutschen und Streuung. */
      const _n = new THREE.Vector3();
      function normalAt(x, z) {
        const d = cell;
        const hx = heightAt(x + d, z) - heightAt(x - d, z);
        const hz = heightAt(x, z + d) - heightAt(x, z - d);
        return _n.set(-hx, 2 * d, -hz).normalize();
      }

      /* 0 = eben, 1 = senkrecht. */
      function slopeAt(x, z) { return 1 - normalAt(x, z).y; }

      function isWalkable(x, z, maxSlope) {
        if (!inBounds(x, z)) return false;
        const h = heightAt(x, z);
        if (h < sea + 0.6) return false;
        return slopeAt(x, z) < (maxSlope === undefined ? 0.35 : maxSlope);
      }

      /* Sucht eine begehbare Stelle. Wird für Startpunkt, Streuobjekte,
         Kisten und später für Gegner-Spawns benutzt. */
      function findSpot(rng, opts) {
        opts = opts || {};
        const rMin = opts.rMin || 0;
        const rMax = opts.rMax || half * 0.88;
        const maxSlope = opts.maxSlope === undefined ? 0.3 : opts.maxSlope;
        const minH = opts.minHeight === undefined ? sea + 1 : opts.minHeight;
        for (let attempt = 0; attempt < (opts.tries || 60); attempt++) {
          const a = rng.next() * U.TAU;
          const d = rMin + Math.sqrt(rng.next()) * (rMax - rMin);
          const x = Math.cos(a) * d, z = Math.sin(a) * d;
          if (!inBounds(x, z)) continue;
          const h = heightAt(x, z);
          if (h < minH) continue;
          if (opts.maxHeight !== undefined && h > opts.maxHeight) continue;
          if (slopeAt(x, z) > maxSlope) continue;
          return { x: x, y: h, z: z };
        }
        return null;
      }

      return {
        theme, mesh, water, heights, size, res, half, cell, seaLevel: sea,
        heightAt, normalAt, slopeAt, isWalkable, inBounds, findSpot, rawHeight
      };
    }
  };
})(window.ROR);
