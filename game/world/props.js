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

  /* Palettenfarbe als Zahlentripel — so kann ein Bauteil in `verbinde` seine
     eigene Toenung mitbringen. */
  const _c = new THREE.Color();
  function ton(hex, faktor) {
    _c.set(hex);
    if (faktor) _c.multiplyScalar(faktor);
    return [_c.r, _c.g, _c.b];
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
    /* Von Hand zusammenfügen — BufferGeometryUtils liegt unter examples/.

       Die Puffergröße muss sich nach der Zahl der *ausgegebenen* Eckpunkte
       richten, nicht nach der Zahl der gespeicherten. Bei indizierter
       Geometrie ist der Index laenger als die Punktliste: eine
       CylinderGeometry mit acht Seiten hat 54 Punkte, aber 96 Indizes. Mit der
       alten Rechnung war der Puffer zu klein, und alles, was hinten
       ueberlief, wurde von der typisierten Liste stillschweigend verworfen —
       deshalb fehlte den Aquaedukt-Saeulen der Kapitell-Aufsatz. */
    let n = 0;
    for (let i = 0; i < geos.length; i++) {
      const g = geos[i];
      n += g.index ? g.index.count : g.attributes.position.count;
    }
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
    /* Eckpunktfarben: ein Objekt bekommt vom Instanzsystem genau eine Farbe.
       Ein Baum war deshalb einfarbig — Stamm und Krone im selben Gruen. Mit
       einem Farbwert je Eckpunkt kann ein Teil seine eigene Toenung mitbringen;
       das Material multipliziert beides. */
    const farbe = new Float32Array(n * 3);
    let o = 0;
    for (let i = 0; i < geos.length; i++) {
      const g = geos[i];
      const p = g.attributes.position.array, q = g.attributes.normal.array;
      // Indizierte Geometrie zuerst auflösen, sonst passt die Länge nicht.
      const idx = g.index ? g.index.array : null;
      const t = teile[i];
      const cr = t.ton ? t.ton[0] : 1, cg = t.ton ? t.ton[1] : 1, cb = t.ton ? t.ton[2] : 1;
      if (idx) {
        for (let k = 0; k < idx.length; k++) {
          pos[o * 3] = p[idx[k] * 3]; pos[o * 3 + 1] = p[idx[k] * 3 + 1]; pos[o * 3 + 2] = p[idx[k] * 3 + 2];
          nor[o * 3] = q[idx[k] * 3]; nor[o * 3 + 1] = q[idx[k] * 3 + 1]; nor[o * 3 + 2] = q[idx[k] * 3 + 2];
          farbe[o * 3] = cr; farbe[o * 3 + 1] = cg; farbe[o * 3 + 2] = cb;
          o++;
        }
      } else {
        for (let k = 0; k < g.attributes.position.count; k++) {
          pos[o * 3] = p[k * 3]; pos[o * 3 + 1] = p[k * 3 + 1]; pos[o * 3 + 2] = p[k * 3 + 2];
          nor[o * 3] = q[k * 3]; nor[o * 3 + 1] = q[k * 3 + 1]; nor[o * 3 + 2] = q[k * 3 + 2];
          farbe[o * 3] = cr; farbe[o * 3 + 1] = cg; farbe[o * 3 + 2] = cb;
          o++;
        }
      }
      g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, o * 3), 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor.subarray(0, o * 3), 3));
    out.setAttribute('color', new THREE.BufferAttribute(farbe.subarray(0, o * 3), 3));
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
       solid               Beschnitt des Kollisionszylinders (1 = Modellbreite),
                           null = keine Kollision
       neigung             maximale Hangneigung am Standort
       ausrichtung         'boden' | 'decke'                                */

  const BAUARTEN = {

    fels: {
      geo: (n) => boulderGeometry(n, 1, 0.34),
      farbe: (P, r) => new THREE.Color(P.rock).lerp(new THREE.Color(P.rockDark), r.range(0, 0.8)),
      skala: [0.7, 3.4], neigung: 0.55, solid: 0.82, solidAb: 1.6, versatz: 0.42
    },

    /* Baeume tragen ihre Farben jetzt in den Eckpunkten: Stamm ist Rinde,
       Krone ist Laub, und die Instanzfarbe ist nur noch eine Helligkeit, damit
       nicht alle gleich aussehen. Vorher hatte ein Baum genau eine Farbe —
       Stamm und Nadeln im selben Gruen. Genau daran las er sich als Dreieck
       auf einem Stiel. */
    nadelbaum: {
      geo: (n, P) => {
        const rinde = ton(P.trunk), hell = ton(P.leaf), dunkel = ton(P.leafAlt, 0.72);
        const teile = [
          { geo: prism(0.035, 0.1, 1.15, 6), y: 0.575, ton: rinde },
          // Wurzelanlauf: verbreitert den Fuss, damit der Stamm nicht abknickt.
          { geo: prism(0.1, 0.2, 0.14, 6), y: 0.06, ton: ton(P.trunk, 0.85) }
        ];
        /* Fuenf Kranzlagen statt drei, jede gegen die vorige verdreht. Die
           Verdrehung ist entscheidend: gleich ausgerichtete Kegel stapeln sich
           zu einer glatten Pyramide. */
        for (let i = 0; i < 5; i++) {
          const t = i / 4;
          teile.push({
            geo: new THREE.ConeGeometry(0.42 - t * 0.3, 0.46 - t * 0.16, 7),
            y: 0.82 + i * 0.3, ry: i * 0.45,
            ton: i % 2 ? dunkel : hell
          });
        }
        teile.push({ geo: new THREE.ConeGeometry(0.06, 0.26, 6), y: 2.28, ton: hell });
        return verbinde(teile);
      },
      farbe: (P, r) => new THREE.Color().setScalar(r.range(0.82, 1.12)),
      skala: [3.6, 8.5], neigung: 0.30, solid: null, versatz: -0.2
    },

    laubbaum: {
      geo: (n, P) => {
        const rinde = ton(P.trunk), hell = ton(P.leaf), dunkel = ton(P.leafAlt, 0.75);
        const teile = [
          { geo: prism(0.05, 0.13, 1.15, 6), y: 0.575, ton: rinde },
          { geo: prism(0.11, 0.22, 0.13, 6), y: 0.055, ton: ton(P.trunk, 0.85) },
          // Zwei Aeste, die aus dem Stamm in die Krone laufen.
          { geo: prism(0.025, 0.05, 0.5, 4), y: 1.15, x: 0.14, rz: -0.6, ton: rinde },
          { geo: prism(0.025, 0.05, 0.44, 4), y: 1.25, x: -0.12, z: 0.1, rz: 0.55, ton: rinde }
        ];
        /* Krone aus fuenf Ballen unterschiedlicher Groesse. Ein einzelner
           Ballen liest sich als Kugel, mehrere ergeben eine Silhouette. */
        const ballen = [
          [0.0, 1.62, 0.0, 0.52, hell], [0.3, 1.5, 0.12, 0.36, dunkel],
          [-0.3, 1.56, -0.1, 0.34, hell], [0.1, 1.9, -0.22, 0.32, dunkel],
          [-0.12, 1.86, 0.24, 0.3, hell]
        ];
        for (const b of ballen) {
          teile.push({ geo: new THREE.IcosahedronGeometry(b[3], 0),
                       x: b[0], y: b[1], z: b[2], sy: 0.82, ton: b[4] });
        }
        return verbinde(teile);
      },
      farbe: (P, r) => new THREE.Color().setScalar(r.range(0.84, 1.12)),
      skala: [3.2, 7], neigung: 0.28, solid: null, versatz: -0.2
    },

    /* Toter Baum: kahle Gabelung. Das Wüstenmotiv, das keine Fichte kann. */
    totbaum: {
      geo: (n, P) => verbinde([
        { geo: prism(0.04, 0.13, 1.5, 5), y: 0.75, ton: ton(P.trunk) },
        { geo: prism(0.11, 0.2, 0.12, 5), y: 0.06, ton: ton(P.trunk, 0.8) },
        { geo: prism(0.03, 0.06, 0.7, 4), y: 1.35, x: 0.22, rz: -0.7, ton: ton(P.trunk, 1.12) },
        { geo: prism(0.02, 0.04, 0.36, 4), y: 1.62, x: 0.44, rz: -1.2, ton: ton(P.trunk, 1.2) },
        { geo: prism(0.03, 0.06, 0.6, 4), y: 1.5, x: -0.2, z: 0.1, rz: 0.6, ton: ton(P.trunk, 0.95) },
        { geo: prism(0.02, 0.04, 0.4, 4), y: 1.75, x: 0.34, rz: -1.0, ton: ton(P.trunk, 1.15) },
        { geo: prism(0.02, 0.035, 0.34, 4), y: 1.86, x: -0.3, z: -0.12, rz: 0.9, ton: ton(P.trunk, 1.05) }
      ]),
      farbe: (P, r) => new THREE.Color().setScalar(r.range(0.85, 1.15)),
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
      skala: [9, 18], neigung: 0.18, solid: 0.95, versatz: -0.05
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
      skala: [4, 9], neigung: 0.16, solid: 0.95, versatz: -0.05
    },

    /* Höhle: Zacken vom Boden und von der Decke. */
    stalagmit: {
      geo: () => prism(0.04, 0.42, 1.0, 6),
      farbe: (P, r) => new THREE.Color(P.rockDark).lerp(new THREE.Color(P.rock), r.range(0, 0.8)),
      skala: [2, 9], neigung: 0.5, solid: 0.8, versatz: -0.05
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
      skala: [3.2, 5.5], neigung: 0.14, solid: 0.95, versatz: 0
    },

    betonblock: {
      geo: () => verbinde([
        { geo: prism(0.44, 0.5, 1.0, 4, 0.4, 0.46), y: 0.5 },
        { geo: prism(0.54, 0.5, 0.1, 4, 0.5, 0.46), y: 1.0 }
      ]),
      farbe: (P, r) => new THREE.Color(P.rock).lerp(new THREE.Color(P.rockDark), r.range(0.2, 0.9)),
      skala: [3, 9], neigung: 0.18, solid: 0.95, versatz: -0.04
    },

    antenne: {
      geo: () => verbinde([
        { geo: prism(0.05, 0.12, 1.0, 4), y: 0.5 },
        { geo: prism(0.03, 0.05, 0.5, 4), y: 1.25 },
        { geo: new THREE.CylinderGeometry(0.02, 0.24, 0.2, 8), y: 1.55, rx: -0.5 },
        { geo: prism(0.2, 0.02, 0.05, 4), y: 0.9, rz: 1.57 }
      ]),
      farbe: (P) => new THREE.Color(P.rockDark),
      skala: [7, 16], neigung: 0.15, solid: 0.9, versatz: -0.05
    },

    /* Schwebende Scholle — Sprungziel. */
    scholle: {
      geo: () => prism(1.0, 0.72, 1.0, 7),
      farbe: (P, r) => new THREE.Color(P.rockDark).lerp(new THREE.Color(P.rock), r.range(0.2, 0.8)),
      skala: [3.4, 8], neigung: 0.6, solid: 1.0, schwebt: [6, 22]
    },

    felsscherbe: {
      geo: () => prism(0.06, 0.9, 1.0, 5),
      farbe: (P, r) => new THREE.Color(P.rock).lerp(new THREE.Color(P.rockDark), r.range(0, 0.7)),
      skala: [3, 9], neigung: 0.7, solid: null, schwebt: [8, 30], kopfueber: true
    }
  };

  /* ----------------------------------------------------------- Streuen */

  /* ------------------------------------------------ Kachelweise streuen */

  /* Warum ueberhaupt Kacheln?

     Ein InstancedMesh hat genau *eine* Bounding Sphere fuer alle Instanzen.
     Three.js kann daran nur die ganze Gruppe verwerfen oder gar nichts — und
     eine Gruppe, die den halben Kartenrand beruehrt, ist immer im Bild. Auf
     der 600-Meter-Karte hiess das: der komplette Grasteppich wurde jedes Bild
     eingereicht, 8.9 Millionen Dreiecke, obwohl man ein Zwanzigstel davon
     sieht.

     Der Sammler zerlegt die Streuung deshalb in ein Raster. Jede Kachel wird
     ein eigenes Mesh mit eigener Bounding Sphere, und damit greift das
     normale Frustum-Culling wieder. Dazu kommt eine Sichtweite je Schicht:
     Grashalme jenseits von hundert Metern sind kleiner als ein Pixel.

     Zwei Durchgaenge, weil sonst die Groesse jeder Kachel vorab geraten
     werden muesste — und Ueberallokation bei einer Viertelmillion Objekten
     kostet zweistellige Megabyte. */
  function Streuer(geo, castShadow, leuchtet, kachel, half) {
    const eintraege = new Map();
    const spalten = Math.max(1, Math.ceil((half * 2) / kachel));
    return {
      /* Sammelt nur ein; gebaut wird in `fertig`. */
      setze(x, y, z, sx, sy, sz, rotY, tilt, color) {
        const cx = U.clamp(((x + half) / kachel) | 0, 0, spalten - 1);
        const cz = U.clamp(((z + half) / kachel) | 0, 0, spalten - 1);
        const k = cz * spalten + cx;
        let liste = eintraege.get(k);
        if (!liste) { liste = []; eintraege.set(k, liste); }
        /* Farbe als drei Zahlen statt als geklontes Color-Objekt: bei einer
           Viertelmillion Instanzen war genau dieses Klonen der Grund, warum
           der Aufbau von 650 auf 1300 ms sprang. */
        liste.push(x, y, z, sx, sy, sz, rotY,
                   tilt ? tilt.x : 0, tilt ? tilt.z : 0,
                   color ? color.r : 1, color ? color.g : 1, color ? color.b : 1);
        return true;
      },
      fertig(gruppe, sichtweite) {
        const raus = [];
        const farbe = new THREE.Color();
        const neigung = { x: 0, z: 0 };
        eintraege.forEach(function (liste) {
          // Zwoelf Zahlen je Eintrag, flach im selben Feld.
          const mesh = instanced(geo, liste.length / 12, castShadow, leuchtet);
          for (let i = 0; i < liste.length; i += 12) {
            neigung.x = liste[i + 7]; neigung.z = liste[i + 8];
            farbe.setRGB(liste[i + 9], liste[i + 10], liste[i + 11]);
            place(mesh, liste[i], liste[i + 1], liste[i + 2],
                  liste[i + 3], liste[i + 4], liste[i + 5], liste[i + 6],
                  neigung, farbe);
          }
          mesh.instanceMatrix.needsUpdate = true;
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
          mesh.computeBoundingSphere();
          if (sichtweite) mesh.userData.sichtweite = sichtweite;
          gruppe.add(mesh);
          raus.push(mesh);
        });
        return raus;
      }
    };
  }

  function instanced(geo, count, castShadow, leuchtet) {
    const mat = new THREE.MeshLambertMaterial({
      color: 0xffffff, flatShading: true,
      vertexColors: !!geo.attributes.color,
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
      const streuerListe = [];

      /* --------------------------------------------- Große Streuobjekte */

      (cfg.kinds || []).forEach(function (eintrag) {
        const art = BAUARTEN[eintrag.kind];
        if (!art || eintrag.count <= 0) return;
        const geo = art.geo(noise, P);
        // 110-m-Kacheln: gross genug, dass wenige Meshes entstehen, klein
        // genug, dass hinter dem Ruecken nichts mehr eingereicht wird.
        const streuer = Streuer(geo, true, art.leuchtet, 85, terrain.half);
        streuerListe.push({ s: streuer, sicht: 330 });

        /* Die Kollisionsform kommt aus der Geometrie, nicht aus einer
           geschaetzten Zahl. Vorher stand in `solid` ein handgesetzter Radius,
           und der lag oft weit daneben: der Betonblock hatte die 9.9-fache
           Grundflaeche seines Modells, der Container die 3.7-fache, die
           Aquaedukt-Saeule die 6.1-fache — dafuer war der Fels-Zylinder nur
           halb so gross wie der Fels. Jetzt ist `solid` nur noch ein
           Beschnitt: 1 bedeutet „genau die Modellbreite". */
        geo.computeBoundingBox();
        const bb = geo.boundingBox;
        const halbX = Math.max(Math.abs(bb.min.x), Math.abs(bb.max.x));
        const halbZ = Math.max(Math.abs(bb.min.z), Math.abs(bb.max.z));
        // Mittelwert statt Maximum: ein Zylinder um die Ecken eines Kastens
        // waere wieder zu gross und ergaebe unsichtbare Waende an den Ecken.
        const halb = (halbX + halbZ) * 0.5;

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

          streuer.setze(spot.x, y, spot.z, breit, s, breit,
                        rng.range(0, U.TAU), { x: rx, z: rz }, tint);

          // Kleine Steine sind Dekoration; erst ab `solidAb` stehen sie im Weg.
          if (art.solid && s >= (art.solidAb || 0)) {
            solids.push({ kind: 'cyl', x: spot.x, z: spot.z,
                          r: breit * halb * art.solid,
                          y0: y + bb.min.y * s, y1: y + bb.max.y * s });
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
        /* Kleinere Kacheln als bei den grossen Objekten und eine harte
           Sichtweite: ein Grashalm auf hundert Metern ist kleiner als ein
           Pixel, kostet aber dieselben Dreiecke wie einer vor den Fuessen. */
        const halme = Streuer(halmGeo, false, 0, 38, terrain.half);
        const kies = Streuer(kiesGeo, false, 0, 38, terrain.half);
        streuerListe.push({ s: halme, sicht: 72 }, { s: kies, sicht: 72 });

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
              halme.setze(x, y, z,
                          rng.range(0.6, 1.25), rng.range(0.45, 1.15), rng.range(0.6, 1.25),
                          rng.range(0, U.TAU), null, tint);
            } else {
              tint.copy(cRock).lerp(cRockDark, rng.next());
              const g = rng.range(0.12, 0.40);
              kies.setze(x, y + g * 0.28, z, g, g * rng.range(0.5, 0.9), g,
                         rng.range(0, U.TAU),
                         { x: rng.range(-0.4, 0.4), z: rng.range(-0.4, 0.4) }, tint);
            }
          }
        }
      }

      const kacheln = [];
      streuerListe.forEach(function (e) {
        e.s.fertig(group, e.sicht).forEach(function (m) { kacheln.push(m); });
      });

      return { group: group, solids: solids, kacheln: kacheln };
    }
  };
})(window.ROR);
