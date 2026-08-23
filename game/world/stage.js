/* game/world/stage.js
   Baut eine Stage zusammen und beantwortet alle Fragen nach „was ist hier fest".

   Spieler, Gegner und Kamera fragen ausschließlich hier nach. Dadurch gibt es
   genau ein Kollisionsmodell — Gelände plus eine Liste von Solids — und keine
   zweite Wahrheit, die auseinanderlaufen könnte. */
(function (ROR) {
  'use strict';

  const U = ROR.Util;
  const BUCKET = 14;          // Kantenlänge der Nachschlagezellen in Metern

  /* Ein Farbverlauf am Himmel kostet nichts und trägt die halbe Stimmung.
     Die beiden `#include` sorgen dafür, dass der Verlauf dieselbe Tonwert-
     kurve durchläuft wie der Rest der Szene — sonst wirkt er ausgewaschen. */
  const SKY_VERT = `
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`;

  const SKY_FRAG = `
    uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSun; uniform vec3 uSunDir;
    varying vec3 vDir;
    void main() {
      // Unterhalb des Horizonts bleibt der Himmel auf Horizontfarbe stehen.
      // Weil der Nebel dieselbe Farbe hat, ist die Kante des Wasserfelds
      // dadurch nie zu sehen — egal, wie weit man hinausschaut.
      float h = clamp(vDir.y, 0.0, 1.0);
      vec3 c = mix(uHorizon, uTop, pow(h, 0.55));
      float s = max(dot(normalize(vDir), uSunDir), 0.0);
      c += uSun * pow(s, 220.0) * 1.6;
      c += uSun * pow(s, 5.0) * 0.10;
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;

  let current = null;

  const Stage = {
    get current() { return current; },

    load(theme, seed) {
      Stage.unload();

      const scene = ROR.Engine.scene;
      const P = theme.palette;
      const rng = U.Rng(seed);

      const terrain = ROR.Terrain.build(theme, seed);
      const props = ROR.Props.scatter(terrain, rng.fork(), seed);

      const root = new THREE.Group();
      root.name = 'stage';
      root.add(terrain.mesh, props.group);
      if (terrain.water) root.add(terrain.water);
      if (terrain.decke) root.add(terrain.decke);

      /* --------------------------------------------------------- Himmel */

      const sunDir = new THREE.Vector3(
        Math.cos(theme.sun.azimuth) * Math.cos(theme.sun.elevation),
        Math.sin(theme.sun.elevation),
        Math.sin(theme.sun.azimuth) * Math.cos(theme.sun.elevation)
      ).normalize();

      const sky = new THREE.Mesh(
        new THREE.SphereGeometry(3400, 32, 20),
        new THREE.ShaderMaterial({
          uniforms: {
            uTop: { value: new THREE.Color(P.sky) },
            uHorizon: { value: new THREE.Color(P.horizon) },
            uSun: { value: new THREE.Color(P.sun) },
            uSunDir: { value: sunDir.clone() }
          },
          vertexShader: SKY_VERT,
          fragmentShader: SKY_FRAG,
          side: THREE.BackSide,
          depthWrite: false,
          fog: false
        })
      );
      sky.frustumCulled = false;
      sky.renderOrder = -1;
      // In einer Höhle gibt es keinen Himmel — die Decke ist der Himmel.
      if (!terrain.hatDecke) root.add(sky);

      /* --------------------------------------------------------- Licht */

      const hemi = new THREE.HemisphereLight(P.ambientSky, P.ambientGround, P.ambientIntensity);
      const sun = new THREE.DirectionalLight(P.sun, P.sunIntensity);
      sun.position.copy(sunDir).multiplyScalar(120);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 320;
      const ext = 78;   // Der Schattenkasten wandert mit der Figur mit.
      sun.shadow.camera.left = -ext; sun.shadow.camera.right = ext;
      sun.shadow.camera.top = ext; sun.shadow.camera.bottom = -ext;
      sun.shadow.bias = -0.0004;
      sun.shadow.normalBias = 0.22;   // gegen Streifen auf flachen Hängen
      /* Gegenlicht ohne Schatten. Ohne es sind alle sonnenabgewandten Flächen
         praktisch schwarz — am deutlichsten an den Unterseiten der schwebenden
         Plattformen, die als Löcher im Himmel standen. Es kommt flach von der
         Gegenseite und hebt nur die Grundhelligkeit an. */
      const fill = new THREE.DirectionalLight(P.ambientSky, P.fillIntensity || 0.55);
      fill.position.set(-sunDir.x * 100, Math.max(12, sunDir.y * 25), -sunDir.z * 100);

      root.add(hemi, sun, sun.target, fill);

      // Nebelfarbe = Horizontfarbe: dadurch geht das Wasser nahtlos in den
      // Himmel über und seine Kante ist nie zu sehen.
      if (ROR.PostFX) ROR.PostFX.applyPalette(P);
      scene.fog = new THREE.FogExp2(P.fog, P.fogDensity);
      scene.add(root);

      /* ------------------------------------------- Solids im Zellenraster */

      const grid = new Map();
      function key(cx, cz) { return cx * 8192 + cz; }
      function addToGrid(s) {
        const x0 = s.kind === 'cyl' ? s.x - s.r : s.x0;
        const x1 = s.kind === 'cyl' ? s.x + s.r : s.x1;
        const z0 = s.kind === 'cyl' ? s.z - s.r : s.z0;
        const z1 = s.kind === 'cyl' ? s.z + s.r : s.z1;
        for (let cx = Math.floor(x0 / BUCKET); cx <= Math.floor(x1 / BUCKET); cx++) {
          for (let cz = Math.floor(z0 / BUCKET); cz <= Math.floor(z1 / BUCKET); cz++) {
            const k = key(cx, cz);
            let list = grid.get(k);
            if (!list) { list = []; grid.set(k, list); }
            list.push(s);
          }
        }
      }
      props.solids.forEach(addToGrid);

      const EMPTY = [];
      function near(x, z) {
        return grid.get(key(Math.floor(x / BUCKET), Math.floor(z / BUCKET))) || EMPTY;
      }

      function inside(s, x, z) {
        if (s.kind === 'cyl') {
          const dx = x - s.x, dz = z - s.z;
          return dx * dx + dz * dz <= s.r * s.r;
        }
        return x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1;
      }

      current = {
        theme, terrain, root, sun, hemi, seed,
        solids: props.solids,
        spawn: null,

        /* Höchste tragende Fläche unter (oder knapp über) den Füßen. */
        supportAt(x, z, feetY, stepUp) {
          stepUp = stepUp === undefined ? 0.55 : stepUp;
          let best = terrain.heightAt(x, z);
          let on = null;
          const list = near(x, z);
          for (let i = 0; i < list.length; i++) {
            const s = list[i];
            if (s.y1 > feetY + stepUp || s.y1 < best) continue;
            if (!inside(s, x, z)) continue;
            best = s.y1; on = s;
          }
          return { y: best, solid: on };
        },

        /* Tiefste Unterkante über dem Kopf — verhindert das Durchspringen
           schwebender Plattformen. */
        ceilingAt(x, z, headY) {
          // Die Höhlendecke zählt wie ein Solid über dem Kopf.
          let best = terrain.ceilingAt(x, z);
          if (best < headY) best = Infinity;
          const list = near(x, z);
          for (let i = 0; i < list.length; i++) {
            const s = list[i];
            if (s.y0 < headY || s.y0 > best) continue;
            if (!inside(s, x, z)) continue;
            best = s.y0;
          }
          return best;
        },

        /* Steigungsgrenze des Geländes.

           Bis hierher trug `supportAt` die Figur auf *jede* Höhe, die unter
           ihr lag — also auch eine senkrechte Wand hinauf, sobald man
           dagegenlief. Damit waren Klippen keine Hindernisse und die
           Bewegungsfähigkeiten ohne Zweck.

           Gemessen wird die Neigung, nicht der Höhenunterschied je Bild:
           der Höhenunterschied hängt am Tempo, die Neigung nicht. Über
           `maxSlope` (0.5 ≈ 60°) geht es nicht mehr hinauf. Wer trotzdem
           hoch will, braucht einen Sprung, einen Satz — oder den Umweg.

           Blockiert wird nicht hart, sondern gleitend: erst nur X, dann nur
           Z. Dadurch rutscht man an der Wand entlang, statt daran zu kleben. */
        blockSteep(pos, altX, altZ, feetY, maxSlope) {
          maxSlope = maxSlope === undefined ? 0.5 : maxSlope;
          const hoch = function (x, z) {
            return terrain.heightAt(x, z) - feetY > 0.12
                && terrain.slopeAt(x, z) > maxSlope;
          };
          if (!hoch(pos.x, pos.z)) return false;
          if (!hoch(pos.x, altZ)) { pos.z = altZ; return true; }
          if (!hoch(altX, pos.z)) { pos.x = altX; return true; }
          pos.x = altX; pos.z = altZ;
          return true;
        },

        /* Schiebt eine Figur seitlich aus allem heraus, was zu hoch zum
           Übersteigen ist. Verändert `pos` direkt. */
        pushOut(pos, radius, height, stepUp) {
          stepUp = stepUp === undefined ? 0.55 : stepUp;
          const list = near(pos.x, pos.z);
          for (let i = 0; i < list.length; i++) {
            const s = list[i];
            if (s.y1 <= pos.y + stepUp) continue;      // übersteigbar
            if (s.y0 >= pos.y + height) continue;      // darüber hinweg
            if (s.kind === 'cyl') {
              const dx = pos.x - s.x, dz = pos.z - s.z;
              const d = Math.hypot(dx, dz);
              const minD = s.r + radius;
              if (d >= minD) continue;
              if (d < 1e-4) { pos.x += minD; continue; }
              pos.x = s.x + (dx / d) * minD;
              pos.z = s.z + (dz / d) * minD;
            } else {
              const cx = U.clamp(pos.x, s.x0, s.x1), cz = U.clamp(pos.z, s.z0, s.z1);
              const dx = pos.x - cx, dz = pos.z - cz;
              const d = Math.hypot(dx, dz);
              if (d >= radius) continue;
              // Innerhalb des Kastens: über die nächstliegende Kante hinaus.
              if (d < 1e-4) {
                const toL = pos.x - s.x0, toR = s.x1 - pos.x;
                const toB = pos.z - s.z0, toT = s.z1 - pos.z;
                const m = Math.min(toL, toR, toB, toT);
                if (m === toL) pos.x = s.x0 - radius;
                else if (m === toR) pos.x = s.x1 + radius;
                else if (m === toB) pos.z = s.z0 - radius;
                else pos.z = s.z1 + radius;
              } else {
                pos.x = cx + (dx / d) * radius;
                pos.z = cz + (dz / d) * radius;
              }
            }
          }
        },

        /* Freie Strecke entlang eines Strahls — die Kamera zieht sich daran
           heran, statt durch Felsen zu schneiden. Geschosse nutzen dieselbe
           Abfrage mit gröberer Schrittweite, weil sie über hundert Meter
           laufen und ein halber Meter Ungenauigkeit dort nicht auffällt. */
        clearance(origin, dir, maxDist, step) {
          const stepLen = step || 0.3;
          for (let d = stepLen; d <= maxDist; d += stepLen) {
            const x = origin.x + dir.x * d;
            const y = origin.y + dir.y * d;
            const z = origin.z + dir.z * d;
            if (y < terrain.heightAt(x, z) + 0.45) return d;
            if (y > terrain.ceilingAt(x, z) - 0.4) return d;
            const list = near(x, z);
            for (let i = 0; i < list.length; i++) {
              const s = list[i];
              if (y < s.y0 || y > s.y1) continue;
              if (inside(s, x, z)) return d;
            }
          }
          return maxDist;
        },

        /* Der Schattenkasten folgt der Figur, sonst wären 300 m Stage in
           2048 Pixeln nur noch Matsch. */
        followShadow(target) {
          sun.target.position.set(target.x, target.y, target.z);
          sun.position.set(target.x + sunDir.x * 120, target.y + sunDir.y * 120, target.z + sunDir.z * 120);
          sun.target.updateMatrixWorld();
        },

        dispose() {
          scene.remove(root);
          root.traverse((o) => {
            if (o.geometry) o.geometry.dispose();
            if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
          });
          scene.fog = null;
        }
      };

      /* Startpunkt: möglichst eben, nicht am Rand, nicht auf einem Plateau. */
      const startRng = U.Rng(seed ^ 0x1234);
      current.spawn = terrain.findSpot(startRng, {
        rMin: 0, rMax: terrain.half * 0.35, maxSlope: 0.12, tries: 400
      }) || { x: 0, y: terrain.heightAt(0, 0), z: 0 };

      ROR.Camera.clearance = current.clearance;
      return current;
    },

    unload() {
      if (!current) return;
      current.dispose();
      current = null;
    }
  };

  ROR.Stage = Stage;
})(window.ROR);
