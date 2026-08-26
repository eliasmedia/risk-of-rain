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

      /* ================================================================
         Die Grundform einer Stage.

         Bis hierher war jede Stage dieselbe Insel mit anderen Farben — und
         genau so sah sie auch aus. Jetzt entscheidet `T.shape`, *welche Art
         Ort* entsteht; die Parameter darunter stimmen ihn nur noch ab.

           plateau  Hochebene auf einem Berg, ringsum senkrecht in den Abgrund
           canyon   Wüstenhochland, in das sich eine Schlucht gegraben hat
           cave     Höhle mit Boden und Decke, oben geschlossen
           mesa     Terrassenlandschaft mit Tafelbergen
           islands  getrennte Schwebeinseln mit Leere dazwischen

         Alle liefern dieselbe Funktion `rawHeight(x, z)`. Was sich
         unterscheidet, ist die Landschaftsidee dahinter.                */

      /* Verzerrter Abstand zur Mitte. Zwei Maßstäbe, und das ist der Punkt:
         die grobe Welle gibt der Kartengrenze ihren Umriss, die feine ihre
         Zacken. Mit nur einer war der Rand der Hochebene ein sauberer Kreis
         und das Ganze sah aus wie eine Torte. */
      function radius(x, z) {
        const grob = n.fbm(x / 115, z / 115, 2) * T.shoreWarp;
        const fein = n.fbm(x / 31, z / 31, 3) * T.shoreWarp * 0.42;
        return Math.sqrt(x * x + z * z) / half + grob + fein;
      }

      function grundwellen(x, z) {
        return n.fbm(x / T.hillScale, z / T.hillScale, 4) * T.hillAmp
             + n.fbm(x / T.detailScale, z / T.detailScale, 3) * T.detailAmp;
      }

      /* Tafelberge: zwei harte Schwellen auf demselben Rauschfeld ergeben
         Stufen mit waagerechtem Deckel und steiler Flanke. */
      function tafeln(x, z, staerke) {
        const m = n.fbm(x / T.maskScale, z / T.maskScale, 3);
        const maske = U.smoothstep(T.maskBias, T.maskBias + T.maskWidth, m) * staerke;
        const f = n.fbm(x / T.ridgeScale, z / T.ridgeScale, 3) * 0.5 + 0.5;
        return { maske: maske, hoehe: maske * T.ridgeAmp * (
          U.smoothstep(T.mesaLow, T.mesaLow + T.mesaEdge, f) * 0.55 +
          U.smoothstep(T.mesaHigh, T.mesaHigh + T.mesaEdge, f) * 0.45) };
      }

      function terrassiert(h, maske) {
        return U.lerp(h, terrace(h, T.terraceStep, T.terraceSharp), maske);
      }

      const FORMEN = {

        /* Ein Tisch auf einem Berg. Innen fast eben, damit man Übersicht hat;
           am Rand bricht er auf wenigen Metern senkrecht ab. Der Abgrund
           *ist* die Kartengrenze — kein Wasser, keine sanfte Böschung. */
        plateau(x, z) {
          const r = radius(x, z);
          const kante = U.smoothstep(T.rimInner, T.rimOuter, r);
          const t = tafeln(x, z, 0.7);
          let h = T.baseHeight + grundwellen(x, z) * 0.55 + t.hoehe;
          h = terrassiert(h, t.maske * 0.8);
          // Ein umlaufender Wall kurz vor der Kante: man sieht den Abgrund,
          // bevor man hineinläuft.
          h += U.smoothstep(T.rimInner - 0.10, T.rimInner, r)
             * (1 - kante) * T.rimLip;
          return h - kante * T.drop;
        },

        /* Wüstenhochland mit einer gewundenen Schlucht. Gelaufen wird unten,
           die Wände stehen links und rechts — daher kommt das Gefühl von
           Enge, das ein offenes Feld nie hat. */
        canyon(x, z) {
          const r = radius(x, z);
          const oben = T.baseHeight + T.plateauHeight + grundwellen(x, z) * 0.5;

          // Hauptschlucht: ein verzerrter Streifen quer über die Karte.
          const w1 = n.fbm(x / T.canyonWind, z / T.canyonWind, 2);
          const p1 = Math.abs(z / half - w1 * T.canyonWobble);
          // Schmale Sohle, kurze Flanke: erst dadurch wird aus der Mulde eine
          // Schlucht. Der Übergang darf nur wenige Meter breit sein.
          const tal1 = U.smoothstep(T.canyonWidth, T.canyonWidth * 0.38, p1);

          // Nebenschlucht quer dazu, damit es Kreuzungen gibt.
          const w2 = n.fbm(x / (T.canyonWind * 0.7) + 40, z / (T.canyonWind * 0.7), 2);
          const p2 = Math.abs(x / half - w2 * T.canyonWobble);
          const tal2 = U.smoothstep(T.canyonWidth * 0.85, T.canyonWidth * 0.32, p2);

          const tal = Math.max(tal1, tal2);
          let h = oben - tal * T.canyonDepth;
          // Terrassen an den Wänden — das Aquädukt-Motiv.
          h = terrassiert(h, 0.85);
          return h - U.smoothstep(T.rimInner, T.rimOuter, r) * T.drop;
        },

        /* Höhle: Boden und Decke. Oben ist zu, es gibt keinen Himmel — das
           allein macht den Ort. Die Decke wird als eigenes Netz gebaut. */
        cave(x, z) {
          const r = radius(x, z);
          const t = tafeln(x, z, 0.6);
          let h = T.baseHeight + grundwellen(x, z) + t.hoehe * 0.6;
          h = terrassiert(h, t.maske * 0.7);
          // Zum Rand hin steigt der Boden an und trifft die Decke: die Höhle
          // schließt sich, statt ins Nichts auszulaufen.
          return h + U.smoothstep(T.rimInner, T.rimOuter, r) * T.wallRise;
        },

        /* Terrassenlandschaft: das, was die Stages vorher alle waren —
           hier bleibt es, weil es zu Rallypoint passt. */
        mesa(x, z) {
          const r = radius(x, z);
          const land = U.smoothstep(T.rimOuter, T.rimInner, r);
          const t = tafeln(x, z, 1);
          let h = T.baseHeight + grundwellen(x, z) + t.hoehe;
          h = h * land - (1 - land) * T.drop;
          return terrassiert(h, t.maske);
        },

        /* Getrennte Schollen mit Leere dazwischen. Der Sprung von Insel zu
           Insel ist hier der Weg. */
        /* Der Mond: kein Gelaende, sondern ein Bauwerk.

           Eine Startscheibe, eine lange Bruecke, eine runde Arena — und
           ringsum nichts. Das ist die einzige Form im Spiel, die nicht aus
           Rauschen entsteht, weil dieser Ort nicht zufaellig sein darf: der
           Weg ist die Inszenierung. Man sieht die Arena schon vom Anfang der
           Bruecke aus und weiss die ganze Strecke ueber, worauf man zulaeuft. */
        mond(x, z) {
          const rStart = half * (T.startRadius || 0.15);
          const rArena = half * (T.arenaRadius || 0.44);
          const zStart = half * (T.startZ || 0.80);
          const zArena = half * (T.arenaZ || -0.28);
          const bBreite = half * (T.brueckeBreite || 0.070);
          const kante = half * 0.022;

          const dStart = Math.hypot(x, z - zStart);
          const dArena = Math.hypot(x, z - zArena);
          // Abstand zur Bruecke: sie laeuft entlang x = 0 zwischen den Scheiben.
          const zAufStrecke = U.clamp(z, zArena, zStart);
          const dBruecke = Math.hypot(x, z - zAufStrecke);

          const auf = Math.max(
            U.smoothstep(rStart + kante, rStart - kante, dStart),
            U.smoothstep(rArena + kante, rArena - kante, dArena),
            U.smoothstep(bBreite + kante, bBreite - kante, dBruecke));

          /* Nur ganz flache Wellen: hier wird gekaempft, und ein Boss, der
             hinter einer Bodenwelle verschwindet, ist kein Boss, sondern ein
             Aergernis. */
          let h = T.baseHeight + n.fbm(x / 46, z / 46, 2) * (T.hillAmp || 2);

          /* Ein umlaufender Wall um die Arena. Er schliesst den Kampfplatz und
             macht aus einer Flaeche einen Raum — und er faengt einen ab, der
             im Ausweichen zu weit nach aussen geht. */
          const wall = U.smoothstep(rArena - half * 0.05, rArena - half * 0.005, dArena)
                     * U.smoothstep(rArena + kante, rArena - kante, dArena);
          h += wall * (T.wallHoehe || 9);

          // Bruestung an den Brueckenkanten, damit man nicht blind hinunterlaeuft.
          const gelaender = U.smoothstep(bBreite - half * 0.016, bBreite - half * 0.002, dBruecke)
                          * U.smoothstep(bBreite + kante, bBreite - kante, dBruecke)
                          * U.smoothstep(rArena + kante * 2, rArena + kante * 6, dArena)
                          * U.smoothstep(rStart + kante * 2, rStart + kante * 6, dStart);
          h += gelaender * 2.6;

          return h - (1 - auf) * T.drop;
        },

        islands(x, z) {
          const r = radius(x, z);
          const feld = n.fbm(x / T.islandScale, z / T.islandScale, 3);
          const insel = U.smoothstep(T.islandBias, T.islandBias + T.islandEdge, feld)
                      * U.smoothstep(T.rimOuter, T.rimInner, r);
          const t = tafeln(x, z, 0.8);
          let h = T.baseHeight + grundwellen(x, z) + t.hoehe * 0.7;
          h = terrassiert(h, t.maske * 0.6);
          return h * insel - (1 - insel) * T.drop;
        }
      };

      const form = FORMEN[T.shape] || FORMEN.mesa;
      function rawHeight(x, z) { return form(x, z); }

      /* Die Höhlendecke. Sie folgt dem Boden mit Abstand, senkt sich in der
         Mitte etwas ab und trifft am Rand auf den ansteigenden Boden. */
      function ceilingHeight(x, z) {
        const r = radius(x, z);
        const boden = rawHeight(x, z);
        const zacken = n.ridged(x / 26, z / 26, 3) * T.ceilRough;
        const bogen = T.ceilHeight * (1 - U.smoothstep(0.2, T.rimOuter, r) * 0.75);
        return boden + Math.max(6, bogen - zacken);
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

      const mesh = new THREE.Mesh(geo, new THREE.MeshToonMaterial({
        vertexColors: true, gradientMap: ROR.Toon.textur }));
      mesh.receiveShadow = true;
      mesh.name = 'terrain';

      /* ------------------------------------------------------- Höhlendecke */

      /* Nur bei `shape: 'cave'`. Dasselbe Gitter wie der Boden, nur höher und
         nach innen gedreht — dadurch sieht man sie von unten und sie wirft
         Schatten auf den Boden. */
      let decke = null;
      if (T.shape === 'cave') {
        const dgeo = new THREE.PlaneGeometry(size, size, res >> 1, res >> 1);
        dgeo.rotateX(Math.PI / 2);          // Normalen nach unten
        const dpos = dgeo.attributes.position;
        const dcol = new Float32Array(dpos.count * 3);
        const cDeckeHell = new THREE.Color(P.rock);
        const cDeckeDunkel = new THREE.Color(P.rockDark);
        for (let k = 0; k < dpos.count; k++) {
          const x = dpos.getX(k), z = dpos.getZ(k);
          dpos.setY(k, ceilingHeight(x, z));
        }
        dpos.needsUpdate = true;
        dgeo.computeVertexNormals();
        for (let k = 0; k < dpos.count; k++) {
          const x = dpos.getX(k), z = dpos.getZ(k);
          const g = n.fbm(x / 13, z / 13, 2) * 0.5 + 0.5;
          c.copy(cDeckeDunkel).lerp(cDeckeHell, g * 0.5);
          dcol[k * 3] = c.r; dcol[k * 3 + 1] = c.g; dcol[k * 3 + 2] = c.b;
        }
        dgeo.setAttribute('color', new THREE.BufferAttribute(dcol, 3));
        decke = new THREE.Mesh(dgeo, new THREE.MeshToonMaterial({
          vertexColors: true, gradientMap: ROR.Toon.textur, side: THREE.DoubleSide
        }));
        decke.name = 'decke';
        decke.receiveShadow = true;
      }

      /* ------------------------------------------------------------ Wasser */

      /* Die Ebene unter allem. Je nach Stage ist das Meer, Lava, Wolken —
         oder in einer Höhle gar nichts. */
      const water = T.shape === 'cave' ? null : new THREE.Mesh(
        new THREE.PlaneGeometry(6000, 6000, 1, 1).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: P.water, fog: true })
      );
      if (water) { water.position.y = sea; water.name = 'water'; }

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
      /* Wie weit nach aussen ist die Karte ueberhaupt begehbar?

         Jede Form hat eine Grenze, ab der sie aufhoert: beim Plateau faellt
         der Boden ab `rimInner` ins Nichts, in der Hoehle steigt er dort um
         `wallRise` zur Decke an, bei den Inseln loest sich das Land auf. Die
         Platzsuche kannte diese Grenze nicht und durfte bis 0.88 hinaus —
         also mitten in die Wand. In der Hoehle war das besonders schlimm:
         begehbar sind dort nur 60 %, und der Teleporter landete regelmaessig
         auf der Rampe, wo man sich an der Wand entlangquetschen musste.

         Der Abzug von 0.06 haelt zusaetzlich Abstand zur Kante selbst. */
      const nutzAnteil = Math.max(0.3, (T.rimInner !== undefined ? T.rimInner : 0.88) - 0.06);
      const nutzHalb = half * nutzAnteil;

      function findSpot(rng, opts) {
        opts = opts || {};
        const rMin = opts.rMin || 0;
        // Nie ueber die begehbare Grenze hinaus, egal was der Aufrufer moechte.
        const rMax = Math.min(opts.rMax || nutzHalb, nutzHalb);
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

      /* Wie hoch ist es hier drüber zu? Ohne Decke unendlich. */
      function ceilingAt(x, z) {
        return decke ? ceilingHeight(x, z) : Infinity;
      }

      return {
        theme, mesh, water, decke, heights, size, res, half, cell, seaLevel: sea,
        nutzHalb: nutzHalb, nutzAnteil: nutzAnteil,
        heightAt, normalAt, slopeAt, isWalkable, inBounds, findSpot, rawHeight,
        ceilingAt, hatDecke: !!decke
      };
    }
  };
})(window.ROR);
