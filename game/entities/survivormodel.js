/* game/entities/survivormodel.js
   Der Figurenbau.

   Vorher war jede Figur ein Stapel Quader und alle sahen gleich aus. Der
   Unterschied macht die *Silhouette*: die Huntress ist schmal und läuft
   vorgebeugt, der Engineer ist breit und trägt seinen Werkzeugrucksack,
   MUL-T hat gar keinen Kopf, sondern einen Sensorbalken auf einem Fahrgestell,
   Artificer schwebt in einem Mantel ohne sichtbare Beine.

   Das Mittel dazu sind *verjüngte Körper* statt Quader: ein Prisma mit vier
   bis acht Seiten, oben und unten verschieden breit. Das kostet nicht mehr
   als ein Kasten, ergibt aber Schultern, Taillen und Helme statt Kisten.

   Die zurückgegebene Struktur ist dieselbe wie zuvor (hips, neck, arms, legs,
   gun, flash) — die Animation in player.js musste dafür nicht angefasst
   werden. Neu sind die `attach`-Punkte, an denen Items hängen. */
(function (ROR) {
  'use strict';

  const U = ROR.Util;

  function mat(color, glanz) {
    return new THREE.MeshLambertMaterial({
      color: color, flatShading: true,
      emissive: glanz ? color : 0x000000, emissiveIntensity: glanz || 0
    });
  }

  /* Verjüngtes Prisma: oben und unten unterschiedlich breit und tief.
     `seiten` bestimmt die Kantigkeit — 4 wirkt wie ein Kasten, 6 bis 8 rund. */
  function prism(parent, o) {
    const seiten = o.sides || 4;
    const g = new THREE.CylinderGeometry(0.5, 0.5, 1, seiten, 1);
    if (seiten === 4) g.rotateY(Math.PI / 4);
    const m = new THREE.Mesh(g, o.mat);
    // Ober- und Unterbreite über die Eckpunkte, damit ein Mesh reicht.
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const oben = pos.getY(i) > 0;
      const bw = oben ? o.tw : o.bw;
      const bd = oben ? (o.td === undefined ? o.tw : o.td) : (o.bd === undefined ? o.bw : o.bd);
      pos.setX(i, pos.getX(i) * bw * (seiten === 4 ? 2 * Math.SQRT1_2 : 2));
      pos.setZ(i, pos.getZ(i) * bd * (seiten === 4 ? 2 * Math.SQRT1_2 : 2));
      pos.setY(i, pos.getY(i) * o.h);
    }
    g.computeVertexNormals();
    m.position.set(o.x || 0, o.y || 0, o.z || 0);
    if (o.rx) m.rotation.x = o.rx;
    if (o.rz) m.rotation.z = o.rz;
    if (o.ry) m.rotation.y = o.ry;
    m.castShadow = true;
    parent.add(m);
    return m;
  }

  function slab(parent, w, h, d, material, x, y, z, rx) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x || 0, y || 0, z || 0);
    if (rx) m.rotation.x = rx;
    m.castShadow = true;
    parent.add(m);
    return m;
  }

  function spike(parent, r, h, material, x, y, z, rx, rz) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), material);
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    if (rz) m.rotation.z = rz;
    m.castShadow = true;
    parent.add(m);
    return m;
  }

  function joint(parent, x, y, z) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  }

  function glow(parent, r, color, x, y, z) {
    const m = new THREE.Mesh(
      new THREE.IcosahedronGeometry(r, 0),
      new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.9,
                                    depthWrite: false, blending: THREE.AdditiveBlending })
    );
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  /* ------------------------------------------------------------- Köpfe */

  function kopf(neck, art, M, c) {
    const s = 1;
    if (art === 'hood') {
      // Kapuze: hinten hoch, vorn offen — die Huntress hat kein Gesicht.
      prism(neck, { mat: M.coat, tw: 0.30, bw: 0.34, h: 0.34, y: 0.17, sides: 6 });
      prism(neck, { mat: M.coatDark, tw: 0.10, bw: 0.36, td: 0.30, bd: 0.40,
                    h: 0.40, y: 0.24, z: 0.04, sides: 6 });
      glow(neck, 0.055, c.visor, 0.075, 0.16, -0.15);
      glow(neck, 0.055, c.visor, -0.075, 0.16, -0.15);
      // Zopf
      const z = joint(neck, 0, 0.22, 0.16);
      prism(z, { mat: M.coatDark, tw: 0.09, bw: 0.05, h: 0.42, y: -0.21, rx: 0.35, sides: 5 });
    } else if (art === 'helmet') {
      prism(neck, { mat: M.metal, tw: 0.30, bw: 0.34, h: 0.32, y: 0.16, sides: 6 });
      slab(neck, 0.36, 0.09, 0.36, M.coatDark, 0, 0.33, 0);
      slab(neck, 0.30, 0.08, 0.05, M.visor, 0, 0.16, -0.17);
      // Helmlampe
      glow(neck, 0.07, c.visor, 0, 0.30, -0.14);
    } else if (art === 'sensor') {
      // MUL-T hat keinen Kopf, sondern einen Sensorbalken.
      prism(neck, { mat: M.metal, tw: 0.46, bw: 0.40, td: 0.22, bd: 0.26, h: 0.20, y: 0.10, sides: 4 });
      slab(neck, 0.44, 0.07, 0.04, M.visor, 0, 0.12, -0.14);
      glow(neck, 0.05, c.visor, 0.16, 0.12, -0.15);
      prism(neck, { mat: M.coatDark, tw: 0.03, bw: 0.05, h: 0.28, y: 0.32, x: 0.16, sides: 4 });
      glow(neck, 0.045, c.visor, 0.16, 0.46, 0);
    } else if (art === 'mask') {
      // Artificer: Maske ohne Augen, dafür ein Diadem.
      prism(neck, { mat: M.skin, tw: 0.24, bw: 0.28, h: 0.30, y: 0.15, sides: 6 });
      prism(neck, { mat: M.coatDark, tw: 0.26, bw: 0.22, td: 0.20, bd: 0.16,
                    h: 0.22, y: 0.16, z: -0.06, sides: 5 });
      glow(neck, 0.05, c.visor, 0, 0.34, 0);
      spike(neck, 0.06, 0.22, M.metal, 0, 0.42, 0);
    } else if (art === 'visor') {
      // Mercenary: glatter Cyborgschädel mit einem roten Schlitz.
      prism(neck, { mat: M.coat, tw: 0.22, bw: 0.30, td: 0.26, bd: 0.30, h: 0.34, y: 0.17, sides: 6 });
      slab(neck, 0.31, 0.055, 0.05, M.visor, 0, 0.17, -0.15);
      prism(neck, { mat: M.coatDark, tw: 0.05, bw: 0.10, h: 0.30, y: 0.30, z: 0.10, rx: -0.5, sides: 4 });
    } else {
      // Commando: Mütze und Schal.
      prism(neck, { mat: M.skin, tw: 0.27, bw: 0.30, h: 0.30, y: 0.15, sides: 5 });
      slab(neck, 0.32, 0.10, 0.06, M.visor, 0, 0.17, -0.15);
      prism(neck, { mat: M.coatDark, tw: 0.34, bw: 0.30, h: 0.11, y: 0.33, sides: 6 });
      slab(neck, 0.36, 0.05, 0.30, M.coatDark, 0, 0.34, 0.03);
      prism(neck, { mat: M.coat, tw: 0.34, bw: 0.28, h: 0.12, y: -0.03, sides: 6 });
    }
  }

  /* ------------------------------------------------------------- Waffen */

  /* Die Waffen.

     Alle sind gleich orientiert: Der Griff sitzt im Ursprung, das arbeitende
     Ende zeigt nach −Z. Damit hängt jede Waffe richtig in einer Hand, deren
     Unterarm nach unten zeigt, und die Animation muss nicht je Waffe wissen,
     wo vorn ist.

     Am Ende trägt jede Waffe in `userData.muendung` den Punkt, an dem der
     Mündungsblitz sitzt, und in `userData.nahkampf`, ob sie geschwungen statt
     abgefeuert wird. Vorher war die Waffe ein Prisma mit einer leuchtenden
     Box daran — als Schwert war das eine Neonröhre. */
  function waffe(hand, art, M, c) {
    const g = joint(hand, 0, -0.33, 0);
    /* Der Unterarm zeigt nach −Y, gebaut wird aber nach −Z. Diese Drehung
       legt die Waffenachse auf die Armachse: die Mündung zeigt dorthin, wohin
       der Arm zeigt, und die Oberseite der Waffe bleibt oben. */
    g.rotation.x = -Math.PI / 2;

    function muendung(x, y, z) {
      const j = joint(g, x, y, z);
      g.userData.muendung = j;
      return j;
    }

    if (art === 'sword') {
      g.userData.nahkampf = true;
      // Knauf und umwickelter Griff.
      prism(g, { mat: M.metal, tw: 0.055, bw: 0.045, td: 0.055, bd: 0.045,
                 h: 0.07, z: 0.11, rx: -Math.PI / 2, sides: 6 });
      prism(g, { mat: M.coatDark, tw: 0.036, bw: 0.042, h: 0.2, z: 0.02,
                 rx: -Math.PI / 2, sides: 6 });
      for (let i = 0; i < 3; i++) {
        prism(g, { mat: M.metal, tw: 0.046, bw: 0.046, h: 0.016,
                   z: 0.075 - i * 0.05, rx: -Math.PI / 2, sides: 6 });
      }
      // Parierstange quer zur Klinge — daran erkennt man ein Schwert sofort.
      prism(g, { mat: M.metal, tw: 0.028, bw: 0.05, td: 0.05, bd: 0.07,
                 h: 0.34, z: -0.09, rz: Math.PI / 2, sides: 5 });
      prism(g, { mat: M.metal, tw: 0.05, bw: 0.07, td: 0.05, bd: 0.08,
                 h: 0.07, z: -0.14, rx: -Math.PI / 2, sides: 5 });
      /* Klinge: hochkant, breit am Ansatz, spitz am Ende, mit einer dunklen
         Hohlkehle in der Mitte.

         Zwei Dinge waren beim ersten Versuch falsch. Die Klinge lag flach —
         dann sieht man von der Seite nur einen Strich. Und die Leuchtkante war
         dicker als das Metall, also blieb vom Schwert optisch nur der Schein
         übrig: eine Neonröhre. Jetzt trägt das Metall, und die Schneide ist
         ein schmaler Streifen an der Unterkante. */
      prism(g, { mat: M.metal, tw: 0.022, bw: 0.042, td: 0.055, bd: 0.115,
                 h: 0.84, z: -0.6, rx: -Math.PI / 2, sides: 4 });
      prism(g, { mat: M.coatDark, tw: 0.03, bw: 0.05, td: 0.022, bd: 0.05,
                 h: 0.68, z: -0.54, rx: -Math.PI / 2, sides: 4 });
      // Leuchtende Schneide an der Unterkante, kürzer als die Klinge.
      const schneide = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.014, 0.7),
        new THREE.MeshBasicMaterial({ color: c.visor, transparent: true, opacity: 0.95,
                                      depthWrite: false, blending: THREE.AdditiveBlending }));
      schneide.position.set(0, -0.055, -0.56);
      g.add(schneide);
      muendung(0, 0, -1.0);
      return g;
    }

    if (art === 'glaive') {
      /* Kein Nahkampf: die Huntress wirft die Glaive und schießt zielsuchende
         Pfeile. Statt eines Hiebbogens bekommt sie deshalb eine Wurfbewegung —
         die Waffe schnellt nach vorn, statt zurückgestoßen zu werden. */
      g.userData.wurf = true;
      // Schaft mit Wicklung, hinten ein Gegengewicht.
      prism(g, { mat: M.coatDark, tw: 0.036, bw: 0.046, h: 0.9, z: -0.28,
                 rx: -Math.PI / 2, sides: 6 });
      prism(g, { mat: M.metal, tw: 0.06, bw: 0.045, h: 0.11, z: 0.2,
                 rx: -Math.PI / 2, sides: 6 });
      for (let i = 0; i < 3; i++) {
        prism(g, { mat: M.metal, tw: 0.05, bw: 0.05, h: 0.024,
                   z: 0.02 - i * 0.06, rx: -Math.PI / 2, sides: 6 });
      }
      /* Die Klinge ist eine Sichel aus drei Gliedern, jedes breit und flach.
         Als dünne Stäbchen sah die Sichel aus wie ein verbogener Draht — die
         Fläche muss die Krümmung tragen, nicht die Kante. */
      const kopf = joint(g, 0, 0, -0.7);
      prism(kopf, { mat: M.metal, tw: 0.05, bw: 0.075, td: 0.07, bd: 0.11,
                    h: 0.14, z: -0.06, rx: -Math.PI / 2, sides: 5 });
      let vor = joint(kopf, 0, 0, -0.12);
      for (let i = 0; i < 3; i++) {
        vor.rotation.x = -0.5;
        const br = 0.155 - i * 0.042;      // Fläche der Sichel
        const dk = 0.026 - i * 0.006;      // Dicke
        prism(vor, { mat: M.metal, tw: dk * 0.7, bw: dk, td: br * 0.72, bd: br,
                     h: 0.23, y: 0.115, sides: 4 });
        const kante = new THREE.Mesh(new THREE.BoxGeometry(dk * 1.3, 0.23, 0.016),
          new THREE.MeshBasicMaterial({ color: c.visor, transparent: true, opacity: 0.9,
                                        depthWrite: false, blending: THREE.AdditiveBlending }));
        kante.position.set(0, 0.115, -br * 0.5);
        vor.add(kante);
        vor = joint(vor, 0, 0.23, 0);
      }
      muendung(0, 0.12, -0.95);
      return g;
    }

    if (art === 'launcher') {
      // Engineer: Granatwerfer mit Trommelmagazin.
      prism(g, { mat: M.metal, tw: 0.11, bw: 0.13, td: 0.5, bd: 0.44,
                 h: 0.15, z: -0.16, sides: 5 });
      // Trommel quer.
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.12, 8), M.coatDark);
      tr.rotation.z = Math.PI / 2;
      tr.position.set(0, -0.01, -0.06);
      g.add(tr);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * U.TAU;
        prism(g, { mat: M.metal, tw: 0.026, bw: 0.026, td: 0.026, bd: 0.026,
                   h: 0.13, y: -0.01 + Math.sin(a) * 0.07, z: -0.06 + Math.cos(a) * 0.07,
                   rz: Math.PI / 2, sides: 6 });
      }
      // Weiter Lauf.
      prism(g, { mat: M.metal, tw: 0.07, bw: 0.055, h: 0.34, z: -0.36,
                 rx: -Math.PI / 2, sides: 8 });
      prism(g, { mat: M.coatDark, tw: 0.085, bw: 0.075, h: 0.07, z: -0.5,
                 rx: -Math.PI / 2, sides: 8 });
      // Griff und Schulterstütze.
      prism(g, { mat: M.coatDark, tw: 0.05, bw: 0.06, td: 0.09, bd: 0.1,
                 h: 0.19, y: -0.14, z: 0.02, rx: 0.28, sides: 4 });
      prism(g, { mat: M.coatDark, tw: 0.07, bw: 0.09, td: 0.1, bd: 0.14,
                 h: 0.2, z: 0.16, rx: -Math.PI / 2, sides: 4 });
      glow(g, 0.045, c.visor, 0, 0.08, -0.1);
      muendung(0, 0, -0.56);
      return g;
    }

    if (art === 'nailgun') {
      // MUL-T: schwerer Nagler mit Zuführschiene und zwei Läufen.
      prism(g, { mat: M.metal, tw: 0.15, bw: 0.17, td: 0.52, bd: 0.46,
                 h: 0.2, z: -0.18, sides: 5 });
      // Nagelschiene obenauf.
      prism(g, { mat: M.coatDark, tw: 0.07, bw: 0.08, td: 0.34, bd: 0.3,
                 h: 0.07, y: 0.12, z: -0.18, sides: 4 });
      for (let i = 0; i < 6; i++) {
        prism(g, { mat: M.metal, tw: 0.012, bw: 0.012, h: 0.09,
                   x: -0.03 + (i % 3) * 0.03, y: 0.17, z: -0.06 - (i > 2 ? 0.06 : 0),
                   sides: 4 });
      }
      for (let k = -1; k <= 1; k += 2) {
        prism(g, { mat: M.metal, tw: 0.032, bw: 0.038, h: 0.36,
                   x: k * 0.055, z: -0.44, rx: -Math.PI / 2, sides: 6 });
      }
      // Seitliche Druckflasche.
      prism(g, { mat: M.coat, tw: 0.06, bw: 0.06, h: 0.24, x: 0.13, y: 0.02,
                 z: -0.06, rz: 0.3, rx: -Math.PI / 2, sides: 7 });
      prism(g, { mat: M.coatDark, tw: 0.06, bw: 0.07, td: 0.1, bd: 0.12,
                 h: 0.2, y: -0.14, z: 0.02, rx: 0.3, sides: 4 });
      muendung(0, 0, -0.63);
      return g;
    }

    if (art === 'focus') {
      /* Artificer: kein Stab, sondern eine Handschiene mit offenem Ring und
         einem schwebenden Kristall darin. Der Stab sah aus wie ein Stock. */
      prism(g, { mat: M.metal, tw: 0.09, bw: 0.11, td: 0.11, bd: 0.13,
                 h: 0.26, z: 0.1, rx: -Math.PI / 2, sides: 6 });
      for (let i = 0; i < 3; i++) {
        prism(g, { mat: M.coatDark, tw: 0.115, bw: 0.115, h: 0.02,
                   z: 0.16 - i * 0.06, rx: -Math.PI / 2, sides: 6 });
      }
      const ring = joint(g, 0, 0, -0.2);
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.022, 5, 12), M.metal);
      ring.add(r);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * U.TAU;
        prism(ring, { mat: M.metal, tw: 0.02, bw: 0.03, h: 0.1,
                      x: Math.cos(a) * 0.09, y: Math.sin(a) * 0.09, z: 0.06,
                      rx: -Math.PI / 2, sides: 4 });
      }
      const kristall = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0),
        new THREE.MeshBasicMaterial({ color: c.visor, transparent: true, opacity: 0.9,
                                      depthWrite: false, blending: THREE.AdditiveBlending }));
      kristall.userData.role = 'kristall';
      ring.add(kristall);
      ring.userData.role = 'ring';
      g.userData.ring = ring;
      muendung(0, 0, -0.3);
      return g;
    }

    /* Pistole — auch als Zweitwaffe in der linken Hand. Rahmen, Schlitten,
       Lauf, Abzugsbügel und ein Korn: fünf Teile, die zusammen als Pistole
       lesbar sind, statt eines Kastens mit Stiel. */
    prism(g, { mat: M.metal, tw: 0.055, bw: 0.062, td: 0.3, bd: 0.26,
               h: 0.07, z: -0.09, sides: 4 });
    prism(g, { mat: M.coatDark, tw: 0.05, bw: 0.058, td: 0.28, bd: 0.24,
               h: 0.045, y: 0.055, z: -0.1, sides: 4 });
    prism(g, { mat: M.metal, tw: 0.022, bw: 0.026, h: 0.14, z: -0.29,
               rx: -Math.PI / 2, sides: 6 });
    prism(g, { mat: M.metal, tw: 0.012, bw: 0.016, h: 0.03, y: 0.085, z: -0.2, sides: 4 });
    // Griff, nach hinten unten geneigt.
    prism(g, { mat: M.coatDark, tw: 0.05, bw: 0.055, td: 0.07, bd: 0.08,
               h: 0.19, y: -0.11, z: 0.05, rx: 0.34, sides: 4 });
    // Abzugsbügel.
    const buegel = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.011, 4, 8, Math.PI), M.metal);
    buegel.rotation.y = Math.PI / 2;
    buegel.rotation.z = Math.PI;
    buegel.position.set(0, -0.05, -0.05);
    g.add(buegel);
    muendung(0, 0.01, -0.36);
    return g;
  }

  /* ------------------------------------------------------------ Aufbau */

  /* Der Formenbaukasten wird auch von den Gegnermodellen gebraucht — dort
     gilt dasselbe: verjüngte Körper statt Quader. Einmal geschrieben, zweimal
     benutzt, und beide sprechen dieselbe Formensprache. */
  ROR.Shapes = { mat, prism, slab, spike, joint, glow };

  ROR.SurvivorModel = {
    build(def) {
      const c = def.colors;
      const b = def.build || {};
      const M = {
        coat: mat(c.coat), coatDark: mat(c.coatDark), skin: mat(c.skin),
        visor: mat(c.visor, 0.7), pants: mat(c.pants), boots: mat(c.boots),
        metal: mat(c.metal)
      };
      const S = b.scale || 1;
      const breit = b.width || 1;
      const root = new THREE.Group();
      const hips = joint(root, 0, 0.92 * S, 0);
      hips.scale.setScalar(S);

      /* --------------------------------------------------------- Rumpf */

      const rumpf = b.torso || 'coat';
      if (rumpf === 'chassis') {
        // MUL-T: ein Fahrgestell mit Ladefläche, keine Taille.
        prism(hips, { mat: M.coat, tw: 0.78 * breit, bw: 0.7 * breit, td: 0.5, bd: 0.46,
                      h: 0.6, y: 0.3, sides: 6 });
        prism(hips, { mat: M.coatDark, tw: 0.86 * breit, bw: 0.8 * breit, td: 0.56, bd: 0.52,
                      h: 0.16, y: 0.66, sides: 6 });
        slab(hips, 0.5 * breit, 0.1, 0.3, M.metal, 0, 0.76, 0.06);
      } else if (rumpf === 'robe') {
        // Artificer: Mantel, der nach unten weiter wird und die Beine verdeckt.
        prism(hips, { mat: M.coat, tw: 0.44, bw: 0.3, td: 0.3, bd: 0.24, h: 0.66, y: 0.33, sides: 6 });
        prism(hips, { mat: M.coatDark, tw: 0.34, bw: 0.62, td: 0.28, bd: 0.5,
                      h: 0.72, y: -0.3, sides: 7 });
        slab(hips, 0.5, 0.08, 0.34, M.metal, 0, 0.62, 0);
      } else if (rumpf === 'armour') {
        // Engineer: breite Brustplatte, schmale Hüfte.
        prism(hips, { mat: M.coat, tw: 0.66 * breit, bw: 0.44, td: 0.42, bd: 0.32,
                      h: 0.64, y: 0.32, sides: 6 });
        prism(hips, { mat: M.coatDark, tw: 0.74 * breit, bw: 0.68 * breit, td: 0.46, bd: 0.44,
                      h: 0.2, y: 0.66, sides: 6 });
        // Werkzeuggurt
        slab(hips, 0.52, 0.12, 0.36, M.coatDark, 0, 0.06, 0);
        for (let i = -1; i <= 1; i += 2) {
          slab(hips, 0.1, 0.16, 0.1, M.metal, i * 0.24, 0.02, -0.16);
        }
      } else if (rumpf === 'sleek') {
        // Mercenary: Wespentaille, hohe Schulterpartie.
        prism(hips, { mat: M.coat, tw: 0.5, bw: 0.34, td: 0.3, bd: 0.24, h: 0.6, y: 0.3, sides: 7 });
        prism(hips, { mat: M.coatDark, tw: 0.56, bw: 0.5, td: 0.34, bd: 0.3, h: 0.22, y: 0.66, sides: 7 });
        for (let i = -1; i <= 1; i += 2) {
          slab(hips, 0.05, 0.26, 0.07, M.visor, i * 0.2, 0.4, -0.16);
        }
      } else if (rumpf === 'light') {
        // Huntress: schmal, kurze Weste, freie Taille.
        prism(hips, { mat: M.coat, tw: 0.42, bw: 0.32, td: 0.26, bd: 0.22, h: 0.5, y: 0.32, sides: 6 });
        prism(hips, { mat: M.coatDark, tw: 0.46, bw: 0.42, td: 0.3, bd: 0.28, h: 0.18, y: 0.62, sides: 6 });
        slab(hips, 0.3, 0.22, 0.2, M.skin, 0, 0.14, 0);
      } else {
        // Commando: Mantel mit Schößen.
        prism(hips, { mat: M.coat, tw: 0.5, bw: 0.4, td: 0.32, bd: 0.28, h: 0.6, y: 0.3, sides: 6 });
        prism(hips, { mat: M.coatDark, tw: 0.56, bw: 0.5, td: 0.36, bd: 0.32, h: 0.22, y: 0.66, sides: 6 });
        for (let i = -1; i <= 1; i += 2) {
          prism(hips, { mat: M.coat, tw: 0.2, bw: 0.16, td: 0.1, bd: 0.08, h: 0.42,
                        x: i * 0.16, y: -0.16, z: 0.06, sides: 4 });
        }
      }

      /* --------------------------------------------------------- Rücken */

      const attach = {};
      const ruecken = joint(hips, 0, 0.42, 0.2);
      attach.back = ruecken;
      if (b.back === 'backpack') {
        prism(ruecken, { mat: M.coatDark, tw: 0.5, bw: 0.44, td: 0.26, bd: 0.24, h: 0.6, y: 0.05, sides: 5 });
        slab(ruecken, 0.16, 0.4, 0.16, M.metal, 0.2, 0.1, 0.14);
        glow(ruecken, 0.06, c.visor, -0.2, 0.24, 0.14);
      } else if (b.back === 'cape') {
        prism(ruecken, { mat: M.coatDark, tw: 0.44, bw: 0.56, td: 0.06, bd: 0.1,
                         h: 0.95, y: -0.38, z: 0.04, rx: -0.12, sides: 4 });
      } else if (b.back === 'jets') {
        for (let i = -1; i <= 1; i += 2) {
          prism(ruecken, { mat: M.metal, tw: 0.12, bw: 0.16, h: 0.42, x: i * 0.2, y: -0.05, sides: 6 });
          glow(ruecken, 0.07, c.visor, i * 0.2, -0.28, 0);
        }
      } else if (b.back === 'tanks') {
        for (let i = -1; i <= 1; i += 2) {
          prism(ruecken, { mat: M.metal, tw: 0.15, bw: 0.15, h: 0.55, x: i * 0.19, y: 0.06, sides: 7 });
        }
        slab(ruecken, 0.44, 0.08, 0.1, M.coatDark, 0, 0.3, 0);
      }

      /* ----------------------------------------------------------- Kopf */

      const neck = joint(hips, 0, b.neckHeight === undefined ? 0.86 : b.neckHeight, 0);
      kopf(neck, b.head || 'cap', M, c);

      /* ----------------------------------------------------------- Arme */

      const arms = [];
      const schulterBreite = (b.shoulder || 0.36) * breit;
      for (let s = -1; s <= 1; s += 2) {
        const shoulder = joint(hips, s * schulterBreite, 0.70, 0);
        if (b.pads) {
          prism(shoulder, { mat: M.coatDark, tw: 0.26 * breit, bw: 0.22 * breit,
                            td: 0.24, bd: 0.2, h: 0.2, y: 0.02, sides: 6 });
        }
        prism(shoulder, { mat: M.coat, tw: 0.16 * breit, bw: 0.14 * breit, h: 0.34, y: -0.17, sides: 5 });
        const elbow = joint(shoulder, 0, -0.34, 0);
        prism(elbow, { mat: b.gauntlets ? M.metal : M.skin,
                       tw: 0.14 * breit, bw: 0.15 * breit, h: 0.32, y: -0.16, sides: 5 });
        arms.push({ shoulder: shoulder, elbow: elbow, side: s });
        attach[s < 0 ? 'shoulderL' : 'shoulderR'] = shoulder;
      }

      const gun = waffe(arms[1].elbow, b.weapon || 'pistol', M, c);
      /* Der Mündungsblitz sitzt jetzt an der Mündung der Waffe und nicht mehr
         an einem festen Punkt am Unterarm. Damit wandert er mit, wenn die
         Waffe vom Rückstoß geworfen wird. */
      const flash = glow(gun.userData.muendung || gun, 0.16, 0xffe6a0, 0, 0, 0);
      flash.material.opacity = 0;
      // Zweitwaffe (Commando trägt zwei Pistolen).
      const gunOff = b.weaponOff ? waffe(arms[0].elbow, b.weaponOff, M, c) : null;
      let flashOff = null;
      if (gunOff) {
        flashOff = glow(gunOff.userData.muendung || gunOff, 0.16, 0xffe6a0, 0, 0, 0);
        flashOff.material.opacity = 0;
      }

      /* ----------------------------------------------------------- Beine */

      const legs = [];
      const beinArt = b.legs || 'normal';
      for (let s = -1; s <= 1; s += 2) {
        const hip = joint(hips, s * 0.15 * breit, 0.02, 0);
        if (beinArt === 'hover') {
          // Artificer: keine Beine, nur ein Schweberest unter dem Mantel.
          prism(hip, { mat: M.coatDark, tw: 0.12, bw: 0.05, h: 0.3, y: -0.5, sides: 5 });
        } else if (beinArt === 'treads') {
          // MUL-T: Stelzen mit breiter Standfläche.
          prism(hip, { mat: M.metal, tw: 0.16, bw: 0.13, h: 0.46, y: -0.23, sides: 5 });
          const knee0 = joint(hip, 0, -0.46, 0);
          prism(knee0, { mat: M.coatDark, tw: 0.13, bw: 0.16, h: 0.42, y: -0.21, sides: 5 });
          prism(knee0, { mat: M.metal, tw: 0.3, bw: 0.34, td: 0.18, bd: 0.2, h: 0.14, y: -0.46, z: -0.04, sides: 4 });
          legs.push({ hip: hip, knee: knee0, side: s });
          continue;
        } else {
          prism(hip, { mat: M.pants, tw: 0.2 * breit, bw: 0.17 * breit, h: 0.44, y: -0.22, sides: 5 });
        }
        const knee = joint(hip, 0, -0.44, 0);
        prism(knee, { mat: M.pants, tw: 0.17 * breit, bw: 0.15 * breit, h: 0.42, y: -0.21, sides: 5 });
        prism(knee, { mat: M.boots, tw: 0.2 * breit, bw: 0.22 * breit, td: 0.3, bd: 0.34,
                      h: 0.12, y: -0.44, z: -0.05, sides: 4 });
        legs.push({ hip: hip, knee: knee, side: s });
      }

      attach.chest = joint(hips, 0, 0.6, -0.2);
      attach.hip = joint(hips, 0, 0.04, 0);
      attach.head = neck;
      attach.orbit = joint(hips, 0, 0.55, 0);

      return { root, hips, neck, arms, legs, gun, flash, gunOff, flashOff,
               nahkampf: !!gun.userData.nahkampf, attach, scale: S };
    }
  };
})(window.ROR);
