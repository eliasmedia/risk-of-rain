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

  function waffe(hand, art, M, c) {
    if (art === 'glaive') {
      const g = joint(hand, 0, -0.36, 0);
      prism(g, { mat: M.metal, tw: 0.05, bw: 0.05, h: 0.5, rx: Math.PI / 2, sides: 4 });
      const scheibe = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.035, 4, 10),
        new THREE.MeshBasicMaterial({ color: c.visor, transparent: true, opacity: 0.85,
                                      depthWrite: false, blending: THREE.AdditiveBlending }));
      scheibe.position.z = -0.22;
      g.add(scheibe);
      return g;
    }
    if (art === 'nailgun') {
      const g = joint(hand, 0, -0.34, 0);
      prism(g, { mat: M.metal, tw: 0.13, bw: 0.16, td: 0.42, bd: 0.46, h: 0.2, z: -0.12, sides: 4 });
      for (let i = -1; i <= 1; i += 2) {
        prism(g, { mat: M.coatDark, tw: 0.045, bw: 0.045, h: 0.34, x: i * 0.05,
                   z: -0.34, rx: Math.PI / 2, sides: 5 });
      }
      return g;
    }
    if (art === 'wand') {
      const g = joint(hand, 0, -0.34, 0);
      prism(g, { mat: M.coatDark, tw: 0.035, bw: 0.05, h: 0.46, rx: -0.35, sides: 5 });
      glow(g, 0.11, c.visor, 0, -0.24, -0.08);
      return g;
    }
    if (art === 'sword') {
      const g = joint(hand, 0, -0.34, 0);
      prism(g, { mat: M.metal, tw: 0.05, bw: 0.06, h: 0.16, sides: 4 });
      const klinge = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.05, 0.14),
        new THREE.MeshBasicMaterial({ color: c.visor, transparent: true, opacity: 0.75,
                                      depthWrite: false, blending: THREE.AdditiveBlending }));
      klinge.position.set(0, -0.6, 0);
      g.add(klinge);
      return g;
    }
    if (art === 'gauntlet') {
      const g = joint(hand, 0, -0.32, 0);
      prism(g, { mat: M.metal, tw: 0.2, bw: 0.17, td: 0.24, bd: 0.2, h: 0.26, y: -0.1, sides: 6 });
      glow(g, 0.07, c.visor, 0, -0.2, -0.1);
      return g;
    }
    // Pistole
    const g = joint(hand, 0, -0.34, 0);
    prism(g, { mat: M.metal, tw: 0.09, bw: 0.11, td: 0.3, bd: 0.34, h: 0.14, z: -0.08, sides: 4 });
    prism(g, { mat: M.coatDark, tw: 0.07, bw: 0.08, h: 0.15, y: -0.1, z: 0.03, rx: 0.3, sides: 4 });
    return g;
  }

  /* ------------------------------------------------------------ Aufbau */

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
      const flash = glow(arms[1].elbow, 0.16, 0xffe6a0, 0, -0.36, -0.32);
      flash.material.opacity = 0;

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

      return { root, hips, neck, arms, legs, gun, flash, attach, scale: S };
    }
  };
})(window.ROR);
