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
    /* Toon statt Lambert: dieselbe Angabe, aber das Licht faellt jetzt in
       Baendern statt stufenlos. Ohne abgestimmte Rampe ist sie linear und das
       Ergebnis ist von vorher nicht zu unterscheiden. */
    return ROR.Toon.material({
      color: color,
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

  /* Mündungsblitz.

     Vorher war das ein einzelnes Leuchtvieleck, das größer und kleiner wurde —
     aus zwei Metern eine Kugel, aus zwanzig ein Punkt. Ein Blitz besteht aber
     aus drei Dingen, die verschieden schnell vergehen: dem Kegel aus dem Lauf,
     dem Stern quer dazu und dem heißen Kern. Erst zusammen liest sich das als
     Schuss statt als aufblinkende Murmel.

     Alle drei Materialien merken sich in `userData.max`, wie hell sie
     höchstens werden dürfen — so bleibt der Kern weiß und der Kegel farbig,
     obwohl beide von derselben Zahl gesteuert werden. */
  function muendungsblitz(parent, farbe) {
    const g = new THREE.Group();
    g.visible = false;
    const mats = [];

    function teil(geo, max, color) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: color, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending
      }));
      m.material.userData.max = max;
      mats.push(m.material);
      g.add(m);
      return m;
    }

    // Kegel aus dem Lauf, entlang −Z.
    const kegel = new THREE.ConeGeometry(0.11, 0.38, 6);
    kegel.rotateX(-Math.PI / 2);
    kegel.translate(0, 0, -0.15);
    teil(kegel, 0.85, farbe);

    // Stern quer zum Lauf: zwei flache Balken über Kreuz.
    for (let i = 0; i < 2; i++) {
      const b = new THREE.BoxGeometry(i ? 0.05 : 0.42, i ? 0.42 : 0.05, 0.02);
      teil(b, 0.7, farbe);
    }

    // Heißer Kern — bleibt weiß, sonst wirkt der Blitz wie ein Farbklecks.
    teil(new THREE.IcosahedronGeometry(0.075, 0), 1.0, 0xfff6e0);

    g.userData.mats = mats;
    parent.add(g);
    return g;
  }

  /* ------------------------------------------------------------- Köpfe */

  /* Die Köpfe.

     Vorsicht mit der Tiefe: `prism` skaliert die Grundgeometrie mit Radius
     0.5 auf `bw`/`bd`, das Ergebnis reicht also bis ±bd in die Tiefe — nicht
     bis ±bd/2. Genau daran sind vorher sämtliche Gesichter gescheitert: Visier
     und Augen saßen bei z = −0.15, der Schädel reichte aber bis −0.28, und
     damit steckte jedes Gesicht *im* Kopf. Alle sechs Figuren hatten deshalb
     eine leere Fläche vorn — das auffälligste Einzelproblem am ganzen
     Figurenbau, und keins, das man beim Lesen des Codes sieht.

     Deshalb hier durchgehend: Kopfkörper bis `bd`, Gesichtsteile davor. */
  function kopf(neck, art, M, c) {
    if (art === 'hood') {
      /* Kapuze: hinten hoch, vorn offen — die Huntress hat kein Gesicht,
         nur zwei Lichtpunkte in der Dunkelheit darunter. */
      prism(neck, { mat: M.coatDark, tw: 0.24, bw: 0.26, h: 0.32, y: 0.16, sides: 6 });
      // Der Schlund der Kapuze, weiter als der Kopf und weiter hinten offen.
      prism(neck, { mat: M.coat, tw: 0.12, bw: 0.32, td: 0.26, bd: 0.34,
                    h: 0.42, y: 0.25, z: 0.05, sides: 6 });
      // Rand der Kapuze, damit die Öffnung eine Kante hat.
      prism(neck, { mat: M.coatDark, tw: 0.28, bw: 0.3, td: 0.1, bd: 0.11,
                    h: 0.3, y: 0.17, z: -0.24, rx: 0.12, sides: 5 });
      glow(neck, 0.05, c.visor, 0.08, 0.17, -0.29);
      glow(neck, 0.05, c.visor, -0.08, 0.17, -0.29);
      // Zopf, der hinten aus der Kapuze fällt.
      const z = joint(neck, 0, 0.2, 0.2);
      prism(z, { mat: M.coatDark, tw: 0.08, bw: 0.05, h: 0.44, y: -0.22, rx: 0.4, sides: 5 });

    } else if (art === 'helmet') {
      // Engineer: Bauhelm mit breitem Schirm und Stirnlampe.
      prism(neck, { mat: M.metal, tw: 0.24, bw: 0.27, h: 0.3, y: 0.15, sides: 6 });
      prism(neck, { mat: M.coat, tw: 0.2, bw: 0.29, td: 0.2, bd: 0.29,
                    h: 0.16, y: 0.31, sides: 6 });
      // Schirm nach vorn — das Merkmal, an dem man den Helm erkennt.
      slab(neck, 0.34, 0.05, 0.22, M.coat, 0, 0.27, -0.22, -0.14);
      slab(neck, 0.28, 0.09, 0.05, M.visor, 0, 0.15, -0.28);
      glow(neck, 0.06, c.visor, 0, 0.3, -0.25);
      // Atemmaske unter dem Visier.
      prism(neck, { mat: M.coatDark, tw: 0.14, bw: 0.12, td: 0.1, bd: 0.09,
                    h: 0.12, y: 0.05, z: -0.24, sides: 5 });

    } else if (art === 'sensor') {
      /* MUL-T hat keinen Kopf, sondern einen Sensorbalken — und laut Wiki
         einen *verbeulten* Schädel. Die Beule ist kein Zierat: sie ist das
         Einzige, was diesen Kasten von jedem anderen Kasten unterscheidet,
         und sie erzählt, dass die Maschine schon einiges hinter sich hat. */
      prism(neck, { mat: M.metal, tw: 0.42, bw: 0.36, td: 0.2, bd: 0.24, h: 0.22, y: 0.11, sides: 4 });
      prism(neck, { mat: M.coat, tw: 0.28, bw: 0.34, td: 0.15, bd: 0.19,
                    h: 0.1, y: 0.24, sides: 4 });
      // Die Delle: eingedrückte Platte, schräg, dunkler als das Blech.
      prism(neck, { mat: M.coatDark, tw: 0.15, bw: 0.12, td: 0.13, bd: 0.11,
                    h: 0.08, x: -0.19, y: 0.2, z: 0.02, rz: 0.6, rx: 0.22, sides: 5 });
      prism(neck, { mat: M.metal, tw: 0.1, bw: 0.14, td: 0.1, bd: 0.13,
                    h: 0.12, x: 0.2, y: 0.18, z: 0.04, rz: -0.32, sides: 4 });
      // Der Sensorbalken selbst, quer über die ganze Breite.
      slab(neck, 0.46, 0.09, 0.05, M.visor, 0, 0.13, -0.26);
      slab(neck, 0.5, 0.04, 0.04, M.accent, 0, 0.03, -0.25);
      glow(neck, 0.06, c.visor, 0.17, 0.13, -0.28);
      glow(neck, 0.045, c.visor, -0.13, 0.13, -0.28);
      // Antenne mit Warnlicht, leicht abgeknickt.
      prism(neck, { mat: M.coatDark, tw: 0.025, bw: 0.045, h: 0.3, y: 0.38, x: 0.17, rz: -0.2, sides: 4 });
      glow(neck, 0.05, c.accent, 0.14, 0.53, 0);

    } else if (art === 'mask') {
      // Artificer: Maske ohne Augen, dafür Diadem und leuchtende Stirnzier.
      prism(neck, { mat: M.skin, tw: 0.21, bw: 0.24, h: 0.29, y: 0.15, sides: 6 });
      // Kapuze/Haar hinten, damit der Kopf nicht als Kugel dasteht.
      prism(neck, { mat: M.coatDark, tw: 0.24, bw: 0.26, td: 0.19, bd: 0.2,
                    h: 0.3, y: 0.17, z: 0.08, sides: 5 });
      // Die Maske selbst — glatte Platte vor dem Gesicht.
      prism(neck, { mat: M.coat, tw: 0.16, bw: 0.2, td: 0.05, bd: 0.06,
                    h: 0.26, y: 0.14, z: -0.21, sides: 5 });
      glow(neck, 0.045, c.visor, 0.07, 0.18, -0.26);
      glow(neck, 0.045, c.visor, -0.07, 0.18, -0.26);
      // Diadem mit Kristall.
      prism(neck, { mat: M.accent, tw: 0.26, bw: 0.24, td: 0.24, bd: 0.22,
                    h: 0.05, y: 0.31, sides: 6 });
      glow(neck, 0.06, c.visor, 0, 0.34, -0.2);
      spike(neck, 0.055, 0.2, M.metal, 0, 0.44, 0);

    } else if (art === 'visor') {
      // Mercenary: glatter Cyborgschädel mit einem roten Schlitz.
      prism(neck, { mat: M.coat, tw: 0.2, bw: 0.25, td: 0.22, bd: 0.26, h: 0.32, y: 0.16, sides: 6 });
      // Kieferplatte, die nach vorn läuft — daraus entsteht das Profil.
      prism(neck, { mat: M.coatDark, tw: 0.15, bw: 0.17, td: 0.1, bd: 0.11,
                    h: 0.16, y: 0.08, z: -0.2, rx: 0.2, sides: 5 });
      slab(neck, 0.3, 0.05, 0.05, M.visor, 0, 0.19, -0.25);
      glow(neck, 0.04, c.visor, 0, 0.19, -0.27);
      // Nackenkabel, das schräg nach hinten steht.
      prism(neck, { mat: M.coatDark, tw: 0.05, bw: 0.09, h: 0.3, y: 0.28, z: 0.15, rx: -0.55, sides: 4 });

    } else {
      /* Commando: Mütze, Schutzbrille, Schal.

         Der Schal ist der Akzent — bei einer Figur, die sonst nur aus
         Marineblau besteht, ist er das Einzige, was auf zwanzig Metern noch
         Farbe hat. Er bekommt deshalb ein loses Ende, das hinter ihr
         hersteht, statt nur ein Kragenring zu sein. */
      prism(neck, { mat: M.skin, tw: 0.22, bw: 0.25, h: 0.3, y: 0.15, sides: 5 });
      // Mütze: Kopfteil und Schirm.
      prism(neck, { mat: M.coatDark, tw: 0.26, bw: 0.28, h: 0.12, y: 0.32, sides: 6 });
      slab(neck, 0.3, 0.045, 0.24, M.coatDark, 0, 0.3, -0.2, -0.12);
      // Schutzbrille: zwei Gläser und der Riemen ringsum.
      slab(neck, 0.3, 0.045, 0.5, M.coatDark, 0, 0.19, 0);
      slab(neck, 0.3, 0.09, 0.05, M.coatDark, 0, 0.19, -0.25);
      glow(neck, 0.052, c.visor, 0.075, 0.19, -0.28);
      glow(neck, 0.052, c.visor, -0.075, 0.19, -0.28);
      // Schal: Kragen plus loses Ende nach hinten.
      prism(neck, { mat: M.accent, tw: 0.3, bw: 0.26, h: 0.13, y: -0.02, sides: 6 });
      prism(neck, { mat: M.accent, tw: 0.12, bw: 0.08, td: 0.04, bd: 0.035,
                    h: 0.42, y: -0.14, z: 0.2, rx: -0.55, sides: 4 });
    }
  }

  /* Mündungsblitz.

     Vorher war das ein einzelnes Leuchtvieleck, das größer und kleiner wurde —
     aus zwei Metern eine Kugel, aus zwanzig ein Punkt. Ein Blitz besteht aber
     aus drei Dingen, die verschieden schnell vergehen: dem Kegel aus dem Lauf,
     dem Stern quer dazu und dem heißen Kern. Erst zusammen liest sich das als
     Schuss statt als aufblinkende Murmel.

     Alle drei Materialien merken sich in `userData.max`, wie hell sie
     höchstens werden dürfen — so bleibt der Kern weiß und der Kegel farbig,
     obwohl beide von derselben Zahl gesteuert werden. */
  function muendungsblitz(parent, farbe) {
    const g = new THREE.Group();
    g.visible = false;
    const mats = [];

    function teil(geo, max, color) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: color, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending
      }));
      m.material.userData.max = max;
      mats.push(m.material);
      g.add(m);
      return m;
    }

    // Kegel aus dem Lauf, entlang −Z.
    const kegel = new THREE.ConeGeometry(0.11, 0.38, 6);
    kegel.rotateX(-Math.PI / 2);
    kegel.translate(0, 0, -0.15);
    teil(kegel, 0.85, farbe);

    // Stern quer zum Lauf: zwei flache Balken über Kreuz.
    for (let i = 0; i < 2; i++) {
      const b = new THREE.BoxGeometry(i ? 0.05 : 0.42, i ? 0.42 : 0.05, 0.02);
      teil(b, 0.7, farbe);
    }

    // Heißer Kern — bleibt weiß, sonst wirkt der Blitz wie ein Farbklecks.
    teil(new THREE.IcosahedronGeometry(0.075, 0), 1.0, 0xfff6e0);

    g.userData.mats = mats;
    parent.add(g);
    return g;
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

    if (art === 'bogen') {
      /* Ein Bogen, kein Stab mit Reifen: zwei geschwungene Wurfarme, ein
         Griffstueck in der Mitte und eine Sehne dazwischen. Der Schwung
         entsteht aus drei Gliedern je Arm — ein gerader Arm liest sich als
         Stange, erst die Kruemmung macht daraus einen Bogen. */
      g.userData.wurf = true;
      prism(g, { mat: M.coatDark, tw: 0.05, bw: 0.06, td: 0.035, bd: 0.045,
                 h: 0.3, sides: 6 });
      for (let i = 0; i < 3; i++) {
        prism(g, { mat: M.metal, tw: 0.055, bw: 0.055, h: 0.02,
                   y: 0.09 - i * 0.09, sides: 6 });
      }
      const enden = [];
      for (let k = -1; k <= 1; k += 2) {
        let glied = joint(g, 0, k * 0.15, 0);
        for (let i = 0; i < 3; i++) {
          glied.rotation.x = k * 0.34;
          prism(glied, { mat: M.coatDark, tw: 0.028 - i * 0.006, bw: 0.036 - i * 0.006,
                         td: 0.02, bd: 0.026, h: 0.26, y: k * 0.13, sides: 5 });
          const naechst = joint(glied, 0, k * 0.26, 0);
          glied = naechst;
        }
        enden.push(glied);
      }
      /* Die Sehne wird zwischen die beiden Wurfarmenden gespannt. Ihre Laenge
         steht nicht fest — sie ergibt sich aus der Kruemmung, also messe ich
         sie, statt sie zu raten. */
      g.updateMatrixWorld(true);
      const a = new THREE.Vector3(), b = new THREE.Vector3();
      enden[0].getWorldPosition(a);
      enden[1].getWorldPosition(b);
      g.worldToLocal(a); g.worldToLocal(b);
      const sehne = new THREE.Mesh(
        new THREE.CylinderGeometry(0.007, 0.007, a.distanceTo(b), 4),
        new THREE.MeshBasicMaterial({ color: c.visor, transparent: true, opacity: 0.7,
                                      depthWrite: false, blending: THREE.AdditiveBlending }));
      sehne.position.copy(a).add(b).multiplyScalar(0.5);
      sehne.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0),
        b.clone().sub(a).normalize());
      g.add(sehne);
      muendung(0, 0, -0.34);
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
        metal: mat(c.metal),
        /* Der Akzent ist der eine Farbfleck, der eine Figur auf Entfernung
           kenntlich macht — Huntress' roter Schal, MUL-Ts Warnstreifen. Fehlt
           er im Datensatz, tritt der Dunkelton an seine Stelle und nichts
           ändert sich. */
        accent: mat(c.accent === undefined ? c.coatDark : c.accent)
      };
      const S = b.scale || 1;
      const breit = b.width || 1;
      const root = new THREE.Group();
      const hips = joint(root, 0, 0.92 * S, 0);
      hips.scale.setScalar(S);

      /* Zwischen Hüfte und allem darüber sitzt ein eigenes Gelenk.

         Vorher hingen Rumpf, Arme und Kopf direkt an der Hüfte, und jede
         Neigung des Oberkörpers kippte damit auch die Beine mit. Damit war
         „nach oben zielen" nicht darstellbar, ohne die Figur umzuwerfen.
         Mit dem Torso-Gelenk trägt die Hüfte das Wippen des Laufs, der Torso
         die Neigung zum Ziel — beides überlagert sich, statt sich zu
         widersprechen. */
      const torso = joint(hips, 0, 0, 0);

      /* --------------------------------------------------------- Rumpf */

      const rumpf = b.torso || 'coat';
      if (rumpf === 'chassis') {
        // MUL-T: ein Fahrgestell mit Ladefläche, keine Taille.
        prism(torso, { mat: M.coat, tw: 0.54 * breit, bw: 0.48 * breit, td: 0.42, bd: 0.38,
                      h: 0.6, y: 0.3, sides: 6 });
        prism(torso, { mat: M.coatDark, tw: 0.6 * breit, bw: 0.56 * breit, td: 0.46, bd: 0.42,
                      h: 0.16, y: 0.66, sides: 6 });
        slab(torso, 0.42 * breit, 0.1, 0.3, M.metal, 0, 0.76, 0.06);
        // Warnstreifen quer über die Brust: drei schräge Balken.
        for (let i = -1; i <= 1; i++) {
          prism(torso, { mat: M.accent, tw: 0.09, bw: 0.09, td: 0.04, bd: 0.04,
                        h: 0.34, x: i * 0.16, y: 0.3, z: -0.42, rz: 0.5, sides: 4 });
        }
      } else if (rumpf === 'robe') {
        // Artificer: Mantel, der nach unten weiter wird und die Beine verdeckt.
        prism(torso, { mat: M.coat, tw: 0.4, bw: 0.29, td: 0.28, bd: 0.23, h: 0.66, y: 0.33, sides: 6 });
        prism(torso, { mat: M.coatDark, tw: 0.34, bw: 0.62, td: 0.28, bd: 0.5,
                      h: 0.72, y: -0.3, sides: 7 });
        // Saum und Schärpe in der Akzentfarbe.
        prism(torso, { mat: M.accent, tw: 0.63, bw: 0.6, td: 0.51, bd: 0.49,
                      h: 0.07, y: -0.63, sides: 7 });
        prism(torso, { mat: M.accent, tw: 0.36, bw: 0.44, td: 0.26, bd: 0.31,
                      h: 0.12, y: 0.06, sides: 6 });
        slab(torso, 0.5, 0.08, 0.34, M.metal, 0, 0.62, 0);
      } else if (rumpf === 'armour') {
        // Engineer: breite Brustplatte, schmale Hüfte.
        prism(torso, { mat: M.coat, tw: 0.5 * breit, bw: 0.38, td: 0.36, bd: 0.3,
                      h: 0.64, y: 0.32, sides: 6 });
        prism(torso, { mat: M.coatDark, tw: 0.55 * breit, bw: 0.52 * breit, td: 0.4, bd: 0.38,
                      h: 0.2, y: 0.66, sides: 6 });
        // Akzentstreifen über die Brustplatte — ein Bauhelm-Signal.
        slab(torso, 0.11, 0.5, 0.06, M.accent, 0, 0.36, -0.36);
        // Werkzeuggurt
        slab(torso, 0.52, 0.12, 0.36, M.coatDark, 0, 0.06, 0);
        for (let i = -1; i <= 1; i += 2) {
          slab(torso, 0.1, 0.16, 0.1, M.metal, i * 0.24, 0.02, -0.16);
        }
      } else if (rumpf === 'sleek') {
        // Mercenary: Wespentaille, hohe Schulterpartie.
        prism(torso, { mat: M.coat, tw: 0.44, bw: 0.32, td: 0.28, bd: 0.23, h: 0.6, y: 0.3, sides: 7 });
        prism(torso, { mat: M.coatDark, tw: 0.49, bw: 0.45, td: 0.32, bd: 0.29, h: 0.22, y: 0.66, sides: 7 });
        for (let i = -1; i <= 1; i += 2) {
          slab(torso, 0.05, 0.26, 0.07, M.visor, i * 0.19, 0.4, -0.28);
        }
      } else if (rumpf === 'light') {
        // Huntress: schmal, kurze Weste, freie Taille.
        prism(torso, { mat: M.coat, tw: 0.37, bw: 0.29, td: 0.24, bd: 0.21, h: 0.5, y: 0.32, sides: 6 });
        prism(torso, { mat: M.coatDark, tw: 0.41, bw: 0.38, td: 0.28, bd: 0.26, h: 0.18, y: 0.62, sides: 6 });
        /* Der rote Schal liegt auch vorn um den Hals, nicht nur als Umhang
           hinten. Sonst ist ihr einziges Wiki-Merkmal von vorne unsichtbar —
           und von vorn sieht man sie im Spiel die meiste Zeit. */
        prism(torso, { mat: M.accent, tw: 0.3, bw: 0.34, td: 0.24, bd: 0.27,
                      h: 0.13, y: 0.76, sides: 6 });
        prism(torso, { mat: M.accent, tw: 0.11, bw: 0.07, td: 0.05, bd: 0.04,
                      h: 0.34, x: -0.13, y: 0.6, z: -0.27, rz: 0.3, rx: -0.2, sides: 4 });
        slab(torso, 0.3, 0.22, 0.2, M.skin, 0, 0.14, 0);
        // Köchergurt quer über die Brust, in der Akzentfarbe.
        prism(torso, { mat: M.accent, tw: 0.08, bw: 0.08, td: 0.04, bd: 0.04,
                      h: 0.56, y: 0.38, z: -0.25, rz: 0.6, sides: 4 });
      } else {
        // Commando: Mantel mit Schößen.
        prism(torso, { mat: M.coat, tw: 0.44, bw: 0.37, td: 0.3, bd: 0.27, h: 0.6, y: 0.3, sides: 6 });
        prism(torso, { mat: M.coatDark, tw: 0.49, bw: 0.45, td: 0.34, bd: 0.31, h: 0.22, y: 0.66, sides: 6 });
        for (let i = -1; i <= 1; i += 2) {
          prism(torso, { mat: M.coat, tw: 0.2, bw: 0.16, td: 0.1, bd: 0.08, h: 0.42,
                        x: i * 0.16, y: -0.16, z: 0.06, sides: 4 });
        }
        // Aufschlag am Revers: schmal, aber es bricht die dunkle Fläche.
        for (let i = -1; i <= 1; i += 2) {
          prism(torso, { mat: M.accent, tw: 0.07, bw: 0.1, td: 0.04, bd: 0.04,
                        h: 0.34, x: i * 0.12, y: 0.42, z: -0.29, rz: i * 0.22, sides: 4 });
        }
      }

      /* --------------------------------------------------------- Rücken */

      const attach = {};
      const ruecken = joint(torso, 0, 0.42, 0.2);
      attach.back = ruecken;
      if (b.back === 'backpack') {
        prism(ruecken, { mat: M.coatDark, tw: 0.5, bw: 0.44, td: 0.26, bd: 0.24, h: 0.6, y: 0.05, sides: 5 });
        slab(ruecken, 0.16, 0.4, 0.16, M.metal, 0.2, 0.1, 0.14);
        glow(ruecken, 0.06, c.visor, -0.2, 0.24, 0.14);
      } else if (b.back === 'cape') {
        /* Der Umhang trägt die Akzentfarbe — bei der Huntress ist das ihr
           roter Schal, das einzige Merkmal, das das Wiki überhaupt zu ihrem
           Aussehen nennt. Drei Glieder statt eines Brettes, damit er sich
           später im Lauf bewegen lässt. */
        let glied = ruecken;
        for (let i = 0; i < 3; i++) {
          prism(glied, { mat: M.accent, tw: 0.42 - i * 0.04, bw: 0.46 - i * 0.06,
                         td: 0.07, bd: 0.09, h: 0.36, y: -0.18, z: 0.02,
                         rx: -0.05, sides: 4 });
          glied = joint(glied, 0, -0.36, 0.01);
        }
        // Der Knoten am Hals, an dem der Schal sitzt.
        prism(ruecken, { mat: M.accent, tw: 0.15, bw: 0.11, h: 0.14, y: 0.12, sides: 5 });
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

      const neckY = b.neckHeight === undefined ? 0.86 : b.neckHeight;
      /* Ein Hals. Ohne ihn klaffte zwischen Schulterpartie (endet bei 0.76)
         und Kopf (beginnt bei 0.86) eine Lücke, durch die man hindurchsah —
         am deutlichsten bei Artificer, deren Robe keine Schulterplatte hat.
         Der Kopf wirkte dadurch, als schwebe er über der Figur. */
      if (b.head !== 'sensor') {
        prism(torso, { mat: M.coatDark, tw: 0.13, bw: 0.16, td: 0.12, bd: 0.15,
                       h: (neckY - 0.58), y: (neckY + 0.58) / 2, sides: 5 });
      }
      const neck = joint(torso, 0, neckY, 0);
      /* Der Kopf sitzt in einem eigenen Gelenk im Nacken. Der Nacken trägt
         das, was der ganze Oberkörper tut; der Kopf darf zusätzlich zum Ziel
         schauen und sich im Leerlauf umsehen. */
      const head = joint(neck, 0, 0, 0);
      kopf(head, b.head || 'cap', M, c);

      /* ----------------------------------------------------------- Arme */

      const arms = [];
      /* Die Schultern müssen *außerhalb* des Rumpfes sitzen.

         Das war der stillste und folgenschwerste Fehler im Figurenbau: der
         Standardabstand war 0.36 mal Breite, während Engineer und MUL-T einen
         Rumpf von 0.66 bzw. 0.78 halber Breite trugen. Beide Arme steckten
         damit vollständig im Körper — samt Waffe. Man sah es nicht als Fehler,
         sondern hielt die Figuren für „kompakt gebaut".

         Deshalb steht der Wert jetzt in jedem Datensatz, und wer ihn vergisst,
         bekommt wenigstens einen Abstand, der zur Breite passt. */
      const schulterBreite = (b.shoulder || 0.42) * breit;
      for (let s = -1; s <= 1; s += 2) {
        const shoulder = joint(torso, s * schulterBreite, 0.70, 0);
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
      const blitzFarbe = c.muzzle === undefined ? 0xffd68a : c.muzzle;
      const flash = muendungsblitz(gun.userData.muendung || gun, blitzFarbe);
      // Zweitwaffe (Commando trägt zwei Pistolen).
      const gunOff = b.weaponOff ? waffe(arms[0].elbow, b.weaponOff, M, c) : null;
      const flashOff = gunOff
        ? muendungsblitz(gunOff.userData.muendung || gunOff, blitzFarbe) : null;

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

      attach.chest = joint(torso, 0, 0.6, -0.2);
      attach.hip = joint(hips, 0, 0.04, 0);
      attach.head = head;
      attach.orbit = joint(torso, 0, 0.55, 0);

      return { root, hips, torso, neck, head, arms, legs, gun, flash, gunOff, flashOff,
               nahkampf: !!gun.userData.nahkampf,
               wurf: !!gun.userData.wurf, attach, scale: S };
    }
  };
})(window.ROR);
