/* game/entities/monstermodel.js
   Die Gegnermodelle.

   Vorher teilten sich fünf Arten die Bauart „Vierbeiner" und vier die Bauart
   „Kugel" — deshalb sah ein Beetle aus wie ein Bison und ein Wisp wie ein
   Blind Pest. Eine andere Farbe reicht nicht: erkennbar wird ein Gegner an
   seiner **Silhouette**, und die muss man sehen können, wenn er als
   Scherenschnitt am Horizont steht.

   Deshalb hat hier jede Art ihren eigenen Bauplan. Die Leitfrage bei jedem
   war: *woran erkennt man ihn aus dreißig Metern?*

     Beetle          flach und breit, gewölbter Panzer, sechs kurze Beine
     Lemurian        aufrecht, Schnauze, Rückenkamm, langer Gegengewichtsschwanz
     Bison           Schulterbuckel, dicker Nacken, geschwungene Hörner
     Beetle Guard    Panzerplatten und zwei Schildarme vor dem Kopf
     Beetle Queen    schwerer Hinterleib, hohe Flügeldecken, lange Beine
     Wisp            Flamme mit Zungen, kein fester Körper
     Blind Pest      zwei große Flügel, dünner Rumpf, Schwanz
     Vagrant         Kugel im Reifen, Fangfäden darunter
     Imp             gebeugt, überlange Arme, Klauen, Hörner
     Golem / Titan   Steinplatten, ein großes Auge
     Templar/Strider Tonkrug auf Stelzen, Deckel obenauf
     Mithrix         Krone, Umhang, Hammer

   Die Rollen (`core`, `head`, `legN`, `tail`, `wingN`, `ring`, `glow`,
   `segN`, `armN`) sind dieselben wie zuvor — die Animation in monster.js
   musste dafür nicht angefasst werden. */
(function (ROR) {
  'use strict';

  const U = ROR.Util;
  const Sh = ROR.Shapes;

  function M(farben) {
    return {
      main: Sh.mat(farben.main),
      dark: Sh.mat(farben.dark),
      eye: Sh.mat(farben.eye || farben.glow || 0xffffff),
      glowFarbe: farben.glow || farben.eye || 0xffffff
    };
  }

  /* Eine gewölbte Halbschale. Für Panzer und Schirme: ein Prisma hat immer
     eine ebene Deckfläche und liest sich deshalb als Kiste, egal wie stark man
     es verjüngt. Eine skalierte Kugel wölbt sich. */
  function kuppel(eltern, mat, rx, ry, rz, o) {
    const g = new THREE.SphereGeometry(1, 12, 7, 0, U.TAU, 0, (o && o.bogen) || Math.PI * 0.55);
    const m2 = new THREE.Mesh(g, mat);
    m2.scale.set(rx, ry, rz);
    m2.position.set((o && o.x) || 0, (o && o.y) || 0, (o && o.z) || 0);
    if (o && o.rotX) m2.rotation.x = o.rotX;
    m2.castShadow = true;
    eltern.add(m2);
    return m2;
  }

  /* Ein Bein aus zwei Gliedern mit Fuß. `nach` dreht das Knie — Insekten
     knicken nach außen, Läufer nach hinten. */
  function bein(eltern, x, y, z, laenge, dicke, m, nach) {
    const hueft = Sh.joint(eltern, x, y, z);
    Sh.prism(hueft, { mat: m.dark, tw: dicke * 0.8, bw: dicke, h: laenge * 0.55,
                      y: -laenge * 0.27, sides: 5 });
    const knie = Sh.joint(hueft, 0, -laenge * 0.55, 0);
    knie.rotation.x = nach || 0;
    Sh.prism(knie, { mat: m.dark, tw: dicke, bw: dicke * 0.6, h: laenge * 0.5,
                     y: -laenge * 0.25, sides: 5 });
    Sh.prism(knie, { mat: m.dark, tw: dicke * 1.4, bw: dicke * 1.1, td: dicke * 2.2,
                     bd: dicke * 1.8, h: dicke * 0.8, y: -laenge * 0.5, z: -dicke * 0.6,
                     sides: 4 });
    return { hueft: hueft, knie: knie };
  }

  const BAUPLAENE = {

    /* ---------------------------------------------------------- Käfer */

    /* Flach, breit, gewölbt. Sechs kurze Beine, die seitlich abstehen, und
       ein deutlich kleinerer Kopf mit vorstehenden Mandibeln.

       Der Panzer ist eine gestauchte Kugel, kein Prisma. Ein Prisma hat oben
       immer eine ebene Fläche — aus der Ferne liest sich das als Kiste auf
       Beinen, und genau das war der Vorwurf am alten Modell. */
    beetle(s) {
      const root = new THREE.Group();
      const c = s.colors, m = M(c);
      const [L, H, W] = s.body;
      const core = Sh.joint(root, 0, H * 0.62, 0);
      core.userData.role = 'core';

      kuppel(core, m.main, W * 0.52, H * 0.95, L * 0.54, { y: -H * 0.12, z: L * 0.04 });
      // Dunkler Wulst am Panzerrand, damit die Schale eine Kante bekommt.
      const rand = new THREE.Mesh(new THREE.TorusGeometry(1, 0.1, 5, 14), m.dark);
      rand.rotation.x = Math.PI / 2;
      rand.scale.set(W * 0.5, L * 0.52, 1);
      rand.position.set(0, -H * 0.12, L * 0.04);
      core.add(rand);
      // Drei Quernähte über die Wölbung.
      for (let i = 0; i < 3; i++) {
        Sh.prism(core, { mat: m.dark, tw: W * (0.42 - i * 0.07), bw: W * (0.46 - i * 0.07),
                         td: L * 0.045, bd: L * 0.055, h: H * 0.16,
                         y: H * (0.6 - i * 0.06), z: L * (0.1 + i * 0.16), sides: 4 });
      }
      // Mittelnaht der Länge nach.
      Sh.prism(core, { mat: m.dark, tw: W * 0.05, bw: W * 0.06, td: L * 0.5, bd: L * 0.55,
                       h: H * 0.14, y: H * 0.62, z: L * 0.06, sides: 4 });

      // Halsschild: kleine Platte zwischen Panzer und Kopf.
      Sh.prism(core, { mat: m.main, tw: W * 0.34, bw: W * 0.44, td: L * 0.16, bd: L * 0.2,
                       h: H * 0.5, y: H * 0.06, z: -L * 0.42, sides: 6 });

      /* Der Kopf ist bewusst klein — beim ersten Versuch war er so groß wie
         der Panzer und die ganze Silhouette wurde dadurch zum Klotz. */
      const hd = s.head;
      const neck = Sh.joint(core, 0, -H * 0.12, -L * 0.56);
      neck.userData.role = 'head';
      Sh.prism(neck, { mat: m.dark, tw: hd * 0.9, bw: hd * 1.0, td: hd * 0.7, bd: hd * 0.85,
                       h: hd * 0.7, z: -hd * 0.3, sides: 6 });
      for (let k = -1; k <= 1; k += 2) {
        Sh.glow(neck, hd * 0.18, c.eye, k * hd * 0.42, hd * 0.16, -hd * 0.4);
        /* Mandibeln: nach vorn und leicht nach innen, damit sie sich zur
           Spitze hin schließen. Gerade Zangen sehen aus wie Stoßstangen. */
        const z = Sh.joint(neck, k * hd * 0.36, -hd * 0.12, -hd * 0.62);
        z.rotation.y = -k * 0.42;
        z.rotation.z = -k * 0.2;
        Sh.prism(z, { mat: m.dark, tw: hd * 0.08, bw: hd * 0.3, td: hd * 0.1, bd: hd * 0.24,
                      h: hd * 0.95, z: -hd * 0.45, rx: -Math.PI / 2, sides: 4 });
      }
      // Zwei kurze Fühler.
      for (let k = -1; k <= 1; k += 2) {
        Sh.prism(neck, { mat: m.dark, tw: hd * 0.03, bw: hd * 0.1, h: hd * 0.8,
                         x: k * hd * 0.3, y: hd * 0.35, z: -hd * 0.4,
                         rz: -k * 0.7, rx: -0.5, sides: 4 });
      }

      /* Sechs Beine, über die ganze Körperlänge verteilt und seitlich
         abgespreizt — geballt in der Mitte sehen sie aus wie ein Bündel. */
      const legLen = H * 1.05;
      for (let i = 0; i < 6; i++) {
        const seite = i % 2 ? 1 : -1;
        const reihe = (i >> 1) - 1;
        const b = bein(core, seite * W * 0.42, -H * 0.3, reihe * L * 0.36,
                       legLen, W * 0.085, m, 0.55);
        b.hueft.rotation.z = seite * 0.8;
        b.hueft.rotation.x = reihe * 0.28;
        b.hueft.userData.role = 'leg' + i;
      }
      return root;
    },

    /* Der Guard ist derselbe Käfer, nur gepanzert: eine zweite, dunklere
       Schale über der ersten, ein Stirnhorn und zwei Schildarme, die er vor
       den Kopf zieht. Die Panzerung folgt der Wölbung, statt als Finnen
       darauf zu stehen — aufgesetzte Platten machen aus dem Panzer wieder
       einen Haufen Kisten. */
    beetleGuard(s) {
      const root = BAUPLAENE.beetle(s);
      const c = s.colors, m = M(c);
      const core = root.children[0];
      const [L, H, W] = s.body;
      const hd = s.head;

      // Überschale, etwas größer als der Panzer und dunkel abgesetzt.
      kuppel(core, m.dark, W * 0.56, H * 1.02, L * 0.5,
             { y: -H * 0.14, z: L * 0.06, bogen: Math.PI * 0.42 });
      // Vier Wülste quer über die Überschale, in die Wölbung eingepasst.
      for (let i = 0; i < 4; i++) {
        const t = (i - 1.5) / 1.5;
        const w = Math.sqrt(Math.max(0.08, 1 - t * t));
        Sh.prism(core, { mat: m.main, tw: W * 0.5 * w, bw: W * 0.54 * w,
                         td: L * 0.05, bd: L * 0.06,
                         h: H * 0.2, y: -H * 0.14 + H * 0.98 * Math.sqrt(Math.max(0.05, 1 - t * t)) * 0.86,
                         z: L * 0.06 + t * L * 0.42, sides: 4 });
      }
      // Stirnhorn.
      let neck = null;
      core.children.forEach(k => { if (k.userData.role === 'head') neck = k; });
      if (neck) {
        Sh.prism(neck, { mat: m.main, tw: hd * 0.05, bw: hd * 0.32, h: hd * 1.5,
                         y: hd * 0.5, z: -hd * 0.35, rx: -0.55, sides: 5 });
      }
      /* Schildarme: breite, flache Platten vor dem Kopf. Sie sind das, was
         den Guard auf Distanz vom Arbeiter unterscheidet. */
      for (let k = -1; k <= 1; k += 2) {
        const arm = Sh.joint(core, k * W * 0.44, -H * 0.16, -L * 0.42);
        arm.userData.role = 'arm' + (k > 0 ? 1 : 0);
        arm.rotation.y = -k * 0.5;
        Sh.prism(arm, { mat: m.dark, tw: W * 0.34, bw: W * 0.26, td: L * 0.08, bd: L * 0.1,
                        h: H * 0.95, y: -H * 0.1, z: -L * 0.16, rz: -k * 0.22, sides: 5 });
        Sh.prism(arm, { mat: m.main, tw: W * 0.24, bw: W * 0.18, td: L * 0.05, bd: L * 0.06,
                        h: H * 0.7, y: -H * 0.14, z: -L * 0.22, rz: -k * 0.22, sides: 4 });
      }
      return root;
    },

    /* Die Königin: derselbe Bauplan, aber mit einem schweren Hinterleib und
       Flügeldecken, die flach auf dem Panzer liegen und sich nur an den
       Spitzen abheben. Steil aufgestellte Decken sahen aus wie Segel. */
    beetleQueen(s) {
      const root = BAUPLAENE.beetle(s);
      const c = s.colors, m = M(c);
      const core = root.children[0];
      const [L, H, W] = s.body;
      const hd = s.head;

      // Hinterleib: nach hinten auslaufend, größer als der Vorderkörper.
      kuppel(core, m.dark, W * 0.6, H * 1.05, L * 0.66,
             { y: -H * 0.1, z: L * 0.6, bogen: Math.PI * 0.62 });
      for (let i = 0; i < 4; i++) {
        Sh.prism(core, { mat: m.main, tw: W * (0.5 - i * 0.09), bw: W * (0.54 - i * 0.09),
                         td: L * 0.05, bd: L * 0.06, h: H * 0.18,
                         y: H * (0.6 - i * 0.13), z: L * (0.42 + i * 0.22), sides: 4 });
      }
      // Flügeldecken, flach aufliegend, Spitzen leicht abgehoben.
      for (let k = -1; k <= 1; k += 2) {
        const d = Sh.joint(core, k * W * 0.2, H * 0.5, L * 0.1);
        d.rotation.z = -k * 0.5;
        d.rotation.x = -0.22;
        Sh.prism(d, { mat: m.main, tw: W * 0.16, bw: W * 0.36, td: L * 0.12, bd: L * 0.2,
                      h: L * 1.1, y: H * 0.1, z: L * 0.4, rx: -Math.PI / 2, sides: 5 });
      }
      // Krone aus vier Hörnern über dem Kopf.
      let neck = null;
      core.children.forEach(o => { if (o.userData.role === 'head') neck = o; });
      if (neck) {
        for (let i = 0; i < 4; i++) {
          const t = (i - 1.5) / 1.5;
          Sh.prism(neck, { mat: m.main, tw: hd * 0.04, bw: hd * 0.2,
                           h: hd * (1.5 - Math.abs(t) * 0.5),
                           x: t * hd * 0.4, y: hd * 0.55, z: -hd * 0.3,
                           rz: -t * 0.5, rx: -0.45, sides: 4 });
        }
      }
      return root;
    },

    /* ---------------------------------------------------------- Echsen */

    /* Aufrecht auf zwei Beinen, mit langem Schwanz als Gegengewicht — die
       Haltung eines Raubsauriers.

       Der Rumpf besteht aus drei Abschnitten statt aus einem Klotz. Das ist
       der ganze Unterschied: ein einzelnes Prisma ergibt im Profil ein
       Rechteck, drei Abschnitte mit unterschiedlicher Höhe ergeben eine
       Rückenlinie, die von der Brust zur Hüfte abfällt. Und die Rückenlinie
       ist das, was man aus dreißig Metern von einem Lemurian sieht. */
    lemurian(s) {
      const root = new THREE.Group();
      const c = s.colors, m = M(c);
      const [L, H, W] = s.body;
      const core = Sh.joint(root, 0, H * 1.75, 0);
      core.userData.role = 'core';
      core.rotation.x = 0.12;

      /* rx = −π/2 kippt das Prisma auf die Seite: „Höhe" läuft dann nach vorn,
         und aus „Tiefe" wird die Bauchhöhe. Damit ist jeder Abschnitt vorn und
         hinten getrennt einstellbar. */
      const abschnitte = [
        // z-Mitte, Länge, Breite vorn/hinten, Höhe vorn/hinten, y-Versatz
        [-0.62, 0.62, 0.92, 1.04, 1.02, 1.12, 0.02],
        [0.00, 0.66, 1.04, 0.96, 1.12, 0.96, 0.00],
        [0.62, 0.64, 0.96, 0.62, 0.96, 0.66, -0.06]
      ];
      for (const a of abschnitte) {
        Sh.prism(core, { mat: m.main, tw: W * a[2], bw: W * a[3],
                         td: H * a[4], bd: H * a[5], h: L * a[1],
                         y: H * a[6], z: L * a[0], rx: -Math.PI / 2, sides: 7 });
      }
      // Bauchplatte, heller Streifen von der Brust bis zwischen die Beine.
      Sh.prism(core, { mat: m.dark, tw: W * 0.52, bw: W * 0.44, td: H * 0.26, bd: H * 0.22,
                       h: L * 1.5, y: -H * 0.42, z: -L * 0.2, rx: -Math.PI / 2, sides: 5 });

      /* Rückenkamm: hoch genug, um im Profil zu tragen, und in der Mitte am
         höchsten — sonst sieht es aus wie eine Reihe gleicher Zacken. */
      for (let i = 0; i < 9; i++) {
        const t = i / 8;
        const hoehe = H * (1.5 - Math.abs(t - 0.34) * 1.7);
        Sh.prism(core, { mat: m.dark, tw: W * 0.03, bw: W * 0.3, td: W * 0.1, bd: W * 0.34,
                         h: hoehe, y: H * (0.5 + hoehe / (H * 2.4)),
                         z: L * (t * 1.7 - 1.0), rx: 0.3, sides: 4 });
      }

      /* Hals in zwei Gliedern: eins steil hoch aus der Brust, eins nach vorn.
         Ein einteiliger Hals lässt den Kopf wie einen Buckel wirken. */
      const hd = s.head;
      const neck = Sh.joint(core, 0, H * 0.5, -L * 0.85);
      neck.userData.role = 'head';
      neck.rotation.x = -0.95;
      Sh.prism(neck, { mat: m.main, tw: W * 0.4, bw: W * 0.74, td: W * 0.44, bd: W * 0.8,
                       h: hd * 1.6, y: hd * 0.8, sides: 6 });
      const nacken = Sh.joint(neck, 0, hd * 1.6, 0);
      nacken.rotation.x = 0.55;
      Sh.prism(nacken, { mat: m.main, tw: W * 0.36, bw: W * 0.44, td: W * 0.42, bd: W * 0.48,
                         h: hd * 0.9, y: hd * 0.45, sides: 6 });
      // Kammfortsatz auf dem Hals, verbindet Rücken und Kopf.
      for (let i = 0; i < 3; i++) {
        Sh.prism(neck, { mat: m.dark, tw: hd * 0.04, bw: hd * 0.24, h: hd * 0.55,
                         y: hd * (0.45 + i * 0.5), z: hd * 0.26, rx: 0.45, sides: 4 });
      }

      /* Kopf: Schädel, darüber ein Brauenwulst, davor eine schmale hohe
         Schnauze. Die Schnauze muss schmal sein — breit und flach sieht sie
         aus wie ein angeklebtes Brett. */
      const kopf = Sh.joint(nacken, 0, hd * 0.9, 0);
      kopf.rotation.x = 0.12;
      Sh.prism(kopf, { mat: m.main, tw: hd * 0.78, bw: hd * 0.86, td: hd * 0.85, bd: hd * 0.95,
                       h: hd * 0.62, sides: 6 });
      Sh.prism(kopf, { mat: m.dark, tw: hd * 0.56, bw: hd * 0.74, td: hd * 0.7, bd: hd * 0.8,
                       h: hd * 0.14, y: hd * 0.28, z: -hd * 0.14, rx: -0.18, sides: 5 });
      /* rx = −π/2 richtet die Prismenachse nach vorn; mit +π/2 zeigt die
         Schnauze nach hinten in den Schädel hinein. Der schmale Anschnitt
         (tw/td) landet dadurch vorn und ergibt eine spitz zulaufende Schnauze. */
      Sh.prism(kopf, { mat: m.main, tw: hd * 0.36, bw: hd * 0.62, td: hd * 0.34, bd: hd * 0.6,
                       h: hd * 1.0, y: -hd * 0.02, z: -hd * 0.78,
                       rx: -Math.PI / 2 + 0.1, sides: 5 });
      // Unterkiefer, kürzer und schmaler als die Schnauze — das trennt das Maul.
      Sh.prism(kopf, { mat: m.dark, tw: hd * 0.26, bw: hd * 0.44, td: hd * 0.16, bd: hd * 0.26,
                       h: hd * 0.82, y: -hd * 0.26, z: -hd * 0.68,
                       rx: -Math.PI / 2 + 0.22, sides: 4 });
      // Zahnreihe: vier kurze Spitzen entlang des Oberkiefers.
      for (let k = -1; k <= 1; k += 2) {
        for (let i = 0; i < 4; i++) {
          Sh.prism(kopf, { mat: m.eye, tw: hd * 0.01, bw: hd * 0.07, h: hd * 0.18,
                           x: k * hd * 0.15, y: -hd * 0.18,
                           z: -hd * (0.5 + i * 0.24), rx: Math.PI, sides: 4 });
        }
      }
      for (let k = -1; k <= 1; k += 2) {
        Sh.glow(kopf, hd * 0.17, c.eye, k * hd * 0.33, hd * 0.14, -hd * 0.34);
        if (s.horns) {
          Sh.prism(kopf, { mat: m.dark, tw: hd * 0.04, bw: hd * 0.22, h: hd * 1.4,
                           x: k * hd * 0.3, y: hd * 0.5, z: hd * 0.08,
                           rz: -k * 0.5, rx: -0.4, sides: 4 });
        }
      }
      if (s.frill) {
        // Nackenschild des Ältesten, fächert hinter dem Schädel auf.
        Sh.prism(nacken, { mat: m.dark, tw: hd * 2.8, bw: hd * 1.0, td: hd * 0.1, bd: hd * 0.18,
                           h: hd * 1.7, y: hd * 0.9, z: hd * 0.4, rx: 0.4, sides: 5 });
      }

      /* Beine: kräftiger Oberschenkel, dünner Unterschenkel — daran erkennt
         man einen Läufer. Zwei gleich dicke Stäbe sehen aus wie Stelzen. */
      for (let k = -1; k <= 1; k += 2) {
        const hueft = Sh.joint(core, k * W * 0.52, -H * 0.28, L * 0.28);
        hueft.userData.role = 'leg' + (k > 0 ? 1 : 0);
        Sh.prism(hueft, { mat: m.main, tw: W * 0.44, bw: W * 0.62, td: W * 0.5, bd: W * 0.8,
                          h: H * 1.35, y: -H * 0.6, rx: -0.35, sides: 6 });
        const knie = Sh.joint(hueft, 0, -H * 1.2, -H * 0.42);
        knie.rotation.x = 0.75;
        Sh.prism(knie, { mat: m.main, tw: W * 0.34, bw: W * 0.2, h: H * 1.2,
                         y: -H * 0.6, sides: 5 });
        const knoechel = Sh.joint(knie, 0, -H * 1.15, 0);
        knoechel.rotation.x = -0.45;
        Sh.prism(knoechel, { mat: m.dark, tw: W * 0.2, bw: W * 0.26, td: W * 0.3, bd: W * 0.7,
                             h: H * 0.55, y: -H * 0.25, z: -W * 0.16, sides: 5 });
        // Drei Zehen.
        for (let f = -1; f <= 1; f++) {
          Sh.prism(knoechel, { mat: m.dark, tw: W * 0.05, bw: W * 0.12, h: H * 0.45,
                               x: f * W * 0.16, y: -H * 0.48, z: -W * 0.36,
                               rx: Math.PI / 2 - 0.2, rz: f * 0.22, sides: 4 });
        }
      }
      // Kleine Vorderarme dicht am Körper.
      for (let k = -1; k <= 1; k += 2) {
        const arm = Sh.joint(core, k * W * 0.6, -H * 0.1, -L * 0.6);
        arm.userData.role = 'arm' + (k > 0 ? 1 : 0);
        arm.rotation.x = -0.85;
        Sh.prism(arm, { mat: m.dark, tw: W * 0.14, bw: W * 0.2, h: H * 0.7,
                        y: -H * 0.35, sides: 4 });
        Sh.prism(arm, { mat: m.dark, tw: W * 0.08, bw: W * 0.14, h: H * 0.55,
                        y: -H * 0.95, z: -H * 0.16, rx: 0.6, sides: 4 });
      }

      /* Schwanz: sieben Glieder, jedes dünner und leicht abwärts gedreht. Die
         Drehung je Glied ist wichtig — ein gerader Schwanz sieht angeschraubt
         aus, ein gekrümmter trägt das Gewicht des Körpers. */
      let seg = Sh.joint(core, 0, -H * 0.05, L * 0.92);
      seg.userData.role = 'tail';
      seg.rotation.x = 0.3;
      const glieder = 7;
      for (let i = 0; i < glieder; i++) {
        const t = i / glieder;
        const w = W * 0.62 * Math.pow(1 - t, 1.4) + W * 0.025;
        const len = s.tail / glieder;
        Sh.prism(seg, { mat: m.main, tw: w * 0.82, bw: w, td: w * 1.2, bd: w * 1.45,
                        h: len * 1.05, z: len * 0.5, rx: -Math.PI / 2, sides: 6 });
        Sh.prism(seg, { mat: m.dark, tw: w * 0.06, bw: w * 0.55, h: len * 0.7,
                        y: w * 0.9, z: len * 0.4, rx: 0.35, sides: 4 });
        const naechst = Sh.joint(seg, 0, 0, len);
        naechst.rotation.x = -0.13;
        naechst.userData.role = 'tail' + i;
        seg = naechst;
      }
      return root;
    },

    /* Schwer, tief, mit Schulterbuckel und weit ausladenden Hörnern.

       Der Buckel steht höher als der Kopf, der Kopf hängt tief und weit vorn.
       Beides zusammen ergibt die abfallende Rückenlinie, an der man ein Bison
       auf hundert Meter erkennt. Der Rumpf ist deshalb kürzer als beim ersten
       Versuch: sonst verschwindet der Kopf im eigenen Körper. */
    bison(s) {
      const root = new THREE.Group();
      const c = s.colors, m = M(c);
      const [L, H, W] = s.body;
      const hd = s.head;
      const core = Sh.joint(root, 0, H * 0.98, 0);
      core.userData.role = 'core';

      // Rumpf in drei Abschnitten, von der Schulter zur Kruppe abfallend.
      const abschnitte = [
        [-0.40, 0.46, 1.02, 1.12, 1.0, 0.98, 0.04],
        [0.00, 0.46, 1.12, 1.0, 0.96, 0.86, 0.0],
        [0.40, 0.46, 1.0, 0.74, 0.86, 0.68, -0.05]
      ];
      for (const a of abschnitte) {
        Sh.prism(core, { mat: m.main, tw: W * a[2], bw: W * a[3],
                         td: H * a[4], bd: H * a[5], h: L * a[1],
                         y: H * a[6], z: L * a[0], rx: -Math.PI / 2, sides: 7 });
      }
      // Der Buckel: drei Schalen über der Schulter, nach vorn abfallend.
      for (let i = 0; i < 3; i++) {
        Sh.prism(core, { mat: i === 1 ? m.dark : m.main,
                         tw: W * (0.88 - i * 0.2), bw: W * (1.04 - i * 0.16),
                         td: L * (0.48 - i * 0.09), bd: L * (0.56 - i * 0.07),
                         h: H * 0.3, y: H * (0.46 + i * 0.24), z: -L * (0.24 - i * 0.03),
                         sides: 6 });
      }

      /* Der Kopf hängt vor dem Rumpf, nicht darüber. Der Ansatz liegt vor der
         vordersten Rumpfkante — beim ersten Versuch lag er dahinter und der
         ganze Schädel steckte im Körper. */
      const neck = Sh.joint(core, 0, -H * 0.04, -L * 0.68);
      neck.userData.role = 'head';
      neck.rotation.x = 0.22;
      Sh.prism(neck, { mat: m.dark, tw: W * 0.66, bw: W * 0.86, td: H * 0.72, bd: H * 0.88,
                       h: hd * 0.7, z: -hd * 0.2, rx: -Math.PI / 2, sides: 6 });
      // Schädel: breit, flach, mit deutlicher Stirn.
      Sh.prism(neck, { mat: m.main, tw: hd * 1.0, bw: hd * 1.3, td: hd * 0.85, bd: hd * 1.05,
                       h: hd * 1.0, y: -hd * 0.05, z: -hd * 0.9, rx: -Math.PI / 2, sides: 6 });
      // Breite Schnauze, tiefer angesetzt als der Schädel.
      Sh.prism(neck, { mat: m.dark, tw: hd * 0.8, bw: hd * 0.95, td: hd * 0.62, bd: hd * 0.8,
                       h: hd * 0.65, y: -hd * 0.3, z: -hd * 1.65, rx: -Math.PI / 2 - 0.2, sides: 5 });
      // Stirnschopf zwischen den Hörnern.
      Sh.prism(neck, { mat: m.dark, tw: hd * 0.55, bw: hd * 0.85, td: hd * 0.5, bd: hd * 0.7,
                       h: hd * 0.34, y: hd * 0.5, z: -hd * 0.95, sides: 5 });

      for (let k = -1; k <= 1; k += 2) {
        Sh.glow(neck, hd * 0.14, c.eye, k * hd * 0.56, hd * 0.1, -hd * 1.15);
        /* Das Horn in drei Gliedern: heraus, hoch, nach innen. Zwei Glieder
           reichten nicht — die Krümmung ist das ganze Erkennungszeichen. */
        const h1 = Sh.joint(neck, k * hd * 0.6, hd * 0.32, -hd * 0.9);
        h1.rotation.z = -k * 1.2;
        Sh.prism(h1, { mat: m.main, tw: hd * 0.24, bw: hd * 0.38, h: hd * 0.75,
                       y: hd * 0.37, sides: 6 });
        const h2 = Sh.joint(h1, 0, hd * 0.75, 0);
        h2.rotation.z = k * 0.95;
        Sh.prism(h2, { mat: m.main, tw: hd * 0.15, bw: hd * 0.24, h: hd * 0.8,
                       y: hd * 0.4, sides: 6 });
        const h3 = Sh.joint(h2, 0, hd * 0.8, 0);
        h3.rotation.z = k * 0.75;
        h3.rotation.x = -0.45;
        Sh.prism(h3, { mat: m.dark, tw: hd * 0.02, bw: hd * 0.15, h: hd * 0.8,
                       y: hd * 0.4, sides: 5 });
      }

      /* Zottelbart: hängt unter der Kehle, nicht über den ganzen Bauch. Eine
         durchgehende Reihe las sich aus der Ferne als Schattenband. */
      for (let i = 0; i < 3; i++) {
        Sh.prism(core, { mat: m.dark, tw: W * (0.34 + i * 0.1), bw: W * (0.24 + i * 0.08),
                         td: L * 0.08, bd: L * 0.06,
                         h: H * (0.6 - i * 0.1), y: -H * (0.66 - i * 0.04),
                         z: -L * (0.62 - i * 0.13), rx: 0.14, sides: 4 });
      }

      /* Vier Säulen mit Huf statt einer Gliederkette. Ein Bison hat keine
         sichtbaren Knie — die Kette sah aus wie ein Haufen Klötze. */
      for (let i = 0; i < 4; i++) {
        const front = i < 2 ? -1 : 1;
        const seite = i % 2 ? 1 : -1;
        const dick = W * (front < 0 ? 0.34 : 0.29);
        const hueft = Sh.joint(core, seite * W * 0.44, -H * 0.34, front * L * 0.36);
        hueft.userData.role = 'leg' + i;
        Sh.prism(hueft, { mat: m.main, tw: dick * 1.25, bw: dick * 0.9, td: dick * 1.4,
                          bd: dick * 0.95, h: H * 0.62, y: -H * 0.3, sides: 6 });
        Sh.prism(hueft, { mat: m.dark, tw: dick * 0.85, bw: dick * 0.8, h: H * 0.5,
                          y: -H * 0.82, sides: 5 });
        Sh.prism(hueft, { mat: m.dark, tw: dick * 1.0, bw: dick * 0.9, td: dick * 1.3,
                          bd: dick * 1.2, h: H * 0.18, y: -H * 1.13, sides: 5 });
      }
      // Kurzer Schwanz mit Quaste.
      const t = Sh.joint(core, 0, H * 0.16, L * 0.78);
      t.userData.role = 'tail';
      t.rotation.x = -0.3;
      Sh.prism(t, { mat: m.dark, tw: W * 0.07, bw: W * 0.13, h: H * 0.62, y: -H * 0.31, sides: 4 });
      Sh.prism(t, { mat: m.dark, tw: W * 0.17, bw: W * 0.07, h: H * 0.3, y: -H * 0.75, sides: 5 });
      return root;
    },

    /* --------------------------------------------------------- Fliegende */

    /* Eine Flamme, kein Körper: ein Kern und Zungen, die nach oben züngeln.
       Das unterscheidet sie von jeder festen Form im Spiel. */
    wisp(s) {
      const root = new THREE.Group();
      const c = s.colors, m = M(c);
      const core = Sh.joint(root, 0, s.size * 1.7, 0);
      core.userData.role = 'core';

      const kern = Sh.glow(core, s.size * 0.85, c.glow, 0, 0, 0);
      kern.userData.role = 'glow';
      Sh.prism(core, { mat: m.main, tw: s.size * 0.2, bw: s.size * 0.9,
                       h: s.size * 1.1, y: -s.size * 0.2, sides: 7 });

      const ring = Sh.joint(core, 0, 0, 0);
      ring.userData.role = 'ring';
      const zungen = s.shards;
      for (let i = 0; i < zungen; i++) {
        const a = (i / zungen) * U.TAU;
        const r = s.size * 0.62;
        const z = Sh.prism(ring, { mat: m.dark, tw: s.size * 0.04, bw: s.size * 0.26,
                                   h: s.size * (0.9 + (i % 3) * 0.35),
                                   x: Math.cos(a) * r, y: s.size * 0.5,
                                   z: Math.sin(a) * r, sides: 4 });
        z.rotation.z = -Math.cos(a) * 0.5;
        z.rotation.x = Math.sin(a) * 0.5;
      }
      if (s.ring) {
        /* Zwei geneigte Reifen statt eines waagrechten: ein einzelner Reifen
           steht von der Seite gesehen als Strich im Bild. */
        for (let i = 0; i < 2; i++) {
          const t = new THREE.Mesh(
            new THREE.TorusGeometry(s.size * 1.3, s.size * 0.09, 6, 18),
            new THREE.MeshBasicMaterial({ color: c.glow, transparent: true, opacity: 0.55,
                                          depthWrite: false, blending: THREE.AdditiveBlending }));
          t.rotation.x = Math.PI / 2 + (i ? 0.6 : -0.6);
          t.rotation.z = i ? 0.5 : -0.5;
          core.add(t);
        }
      }
      return root;
    },

    /* Blind Pest: fast alles an ihm ist Flügel. Der Rumpf ist schmal, die
       Flügel sind lang und geknickt — ein Innen- und ein Außenteil, damit die
       Spannweite nicht wie ein flaches Brett aussieht. Dazu ein Gabelschwanz,
       der die Silhouette hinten abschließt. */
    pest(s) {
      const root = new THREE.Group();
      const c = s.colors, m = M(c);
      const S = s.size;
      const core = Sh.joint(root, 0, S * 2.0, 0);
      core.userData.role = 'core';

      // Schmaler, langgezogener Rumpf.
      Sh.prism(core, { mat: m.main, tw: S * 0.44, bw: S * 0.6, td: S * 0.5, bd: S * 0.62,
                       h: S * 1.9, z: S * 0.2, rx: -Math.PI / 2, sides: 6 });
      Sh.prism(core, { mat: m.dark, tw: S * 0.3, bw: S * 0.42, td: S * 0.16, bd: S * 0.2,
                       h: S * 1.5, y: -S * 0.28, z: S * 0.1, rx: -Math.PI / 2, sides: 4 });

      // Kopf: klein, mit einem einzigen leuchtenden Auge.
      const neck = Sh.joint(core, 0, S * 0.06, -S * 0.9);
      neck.userData.role = 'head';
      Sh.prism(neck, { mat: m.dark, tw: S * 0.3, bw: S * 0.46, td: S * 0.3, bd: S * 0.44,
                       h: S * 0.55, z: -S * 0.2, rx: -Math.PI / 2, sides: 5 });
      const g = Sh.glow(neck, S * 0.26, c.glow, 0, S * 0.04, -S * 0.44);
      g.userData.role = 'glow';
      // Zwei Fangzähne unter dem Auge.
      for (let k = -1; k <= 1; k += 2) {
        Sh.prism(neck, { mat: m.main, tw: S * 0.02, bw: S * 0.1, h: S * 0.4,
                         x: k * S * 0.12, y: -S * 0.2, z: -S * 0.42,
                         rx: Math.PI - 0.3, sides: 4 });
      }

      /* Flügel in zwei Teilen: der innere trägt, der äußere knickt nach hinten
         weg. Ein einteiliger Flügel las sich als Fahne. */
      for (let k = -1; k <= 1; k += 2) {
        const w = Sh.joint(core, k * S * 0.34, S * 0.34, -S * 0.15);
        w.userData.role = 'wing' + (k > 0 ? 1 : 0);
        w.rotation.z = -k * 0.3;      // flache V-Stellung
        /* rz = −k·π/2 kippt die Prismenachse zur Seite: „Höhe" wird zur
           Spannweite, „Breite" zur Dicke und „Tiefe" zur Flügeltiefe. Beim
           ersten Versuch waren Dicke und Tiefe vertauscht — heraus kam ein
           dicker Balken ohne Fläche. */
        Sh.prism(w, { mat: m.main, tw: S * 0.05, bw: S * 0.11, td: S * 1.0, bd: S * 1.5,
                      h: S * 1.5, x: k * S * 0.75, z: -S * 0.1,
                      rz: -k * Math.PI / 2, sides: 4 });
        // Vorderkante, dunkler abgesetzt — sie gibt dem Flügel eine Richtung.
        Sh.prism(w, { mat: m.dark, tw: S * 0.09, bw: S * 0.15, td: S * 0.2, bd: S * 0.28,
                      h: S * 1.55, x: k * S * 0.75, z: -S * 0.62,
                      rz: -k * Math.PI / 2, sides: 4 });
        // Äußerer Flügelteil, nach hinten weggeknickt.
        const aussen = Sh.joint(w, k * S * 1.5, 0, 0);
        aussen.rotation.y = -k * 0.55;
        aussen.rotation.z = -k * 0.35;
        Sh.prism(aussen, { mat: m.main, tw: S * 0.02, bw: S * 0.05, td: S * 0.35, bd: S * 0.95,
                           h: S * 1.3, x: k * S * 0.65, z: S * 0.1,
                           rz: -k * Math.PI / 2, sides: 4 });
        Sh.prism(aussen, { mat: m.dark, tw: S * 0.05, bw: S * 0.1, td: S * 0.1, bd: S * 0.2,
                           h: S * 1.35, x: k * S * 0.65, z: -S * 0.24,
                           rz: -k * Math.PI / 2, sides: 4 });
      }

      // Gabelschwanz.
      const t = Sh.joint(core, 0, 0, S * 1.0);
      t.userData.role = 'tail';
      for (let k = -1; k <= 1; k += 2) {
        Sh.prism(t, { mat: m.main, tw: S * 0.05, bw: S * 0.22, h: S * 1.3,
                      x: k * S * 0.12, z: S * 0.65, rx: Math.PI / 2 - 0.15,
                      rz: -k * 0.25, sides: 4 });
      }
      return root;
    },

    /* Vagrant: eine Kugel in einem Reifen, mit Fangfäden darunter. Groß,
       ruhig, unheimlich — die Gegenform zur zappelnden Flamme. */
    vagrant(s) {
      const root = new THREE.Group();
      const c = s.colors, m = M(c);
      const core = Sh.joint(root, 0, s.size * 1.9, 0);
      core.userData.role = 'core';
      const kern = Sh.glow(core, s.size * 1.0, c.glow, 0, 0, 0);
      kern.userData.role = 'glow';
      const schale = new THREE.Mesh(
        new THREE.IcosahedronGeometry(s.size * 1.15, 1),
        ROR.Toon.material({ color: c.main, transparent: true, opacity: 0.55 }));
      core.add(schale);
      const ring = Sh.joint(core, 0, 0, 0);
      ring.userData.role = 'ring';
      for (let i = 0; i < 2; i++) {
        const t = new THREE.Mesh(
          new THREE.TorusGeometry(s.size * (1.02 + i * 0.2), s.size * 0.075, 6, 18),
          Sh.mat(c.dark));
        t.rotation.x = Math.PI / 2 + i * 0.5;
        t.rotation.z = i * 0.6;
        t.castShadow = true;
        ring.add(t);
      }
      /* Fangfäden: zur Spitze hin dünn und leicht nach außen gestellt.
         Gleich dicke senkrechte Stäbe sahen aus wie Tischbeine. */
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * U.TAU;
        const f = Sh.joint(core, Math.cos(a) * s.size * 0.62, -s.size * 0.62,
                           Math.sin(a) * s.size * 0.62);
        f.userData.role = 'tendril' + i;
        f.rotation.z = -Math.cos(a) * 0.3;
        f.rotation.x = Math.sin(a) * 0.3;
        Sh.prism(f, { mat: m.dark, tw: s.size * 0.11, bw: s.size * 0.05,
                      h: s.size * 0.9, y: -s.size * 0.45, sides: 5 });
        const spitze = Sh.joint(f, 0, -s.size * 0.9, 0);
        spitze.rotation.z = -Math.cos(a) * 0.35;
        spitze.rotation.x = Math.sin(a) * 0.35;
        Sh.prism(spitze, { mat: m.dark, tw: s.size * 0.05, bw: s.size * 0.012,
                           h: s.size * 0.9, y: -s.size * 0.45, sides: 4 });
      }
      return root;
    },

    jelly(s) {
      const root = new THREE.Group();
      const c = s.colors, m = M(c);
      const core = Sh.joint(root, 0, s.size * 1.5, 0);
      core.userData.role = 'core';
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(s.size, 12, 7, 0, U.TAU, 0, Math.PI * 0.6),
        ROR.Toon.material({ color: c.main, transparent: true, opacity: 0.85 }));
      dome.castShadow = true;
      core.add(dome);
      // Ein Wulst am Schirmrand, damit die Kuppel nicht wie eine Halbkugel endet.
      const wulst = new THREE.Mesh(
        new THREE.TorusGeometry(s.size * 0.92, s.size * 0.12, 5, 14), Sh.mat(c.dark));
      wulst.rotation.x = Math.PI / 2;
      wulst.position.y = -s.size * 0.28;
      core.add(wulst);
      const g = Sh.glow(core, s.size * 0.55, c.glow, 0, -s.size * 0.15, 0);
      g.userData.role = 'glow';
      for (let i = 0; i < s.tendrils; i++) {
        const a = (i / s.tendrils) * U.TAU;
        const t = Sh.joint(core, Math.cos(a) * s.size * 0.6, -s.size * 0.25,
                           Math.sin(a) * s.size * 0.6);
        t.userData.role = 'tendril' + i;
        Sh.prism(t, { mat: m.dark, tw: s.size * 0.03, bw: s.size * 0.11,
                      h: s.size * 1.7, y: -s.size * 0.85, sides: 4 });
      }
      return root;
    },

    /* ------------------------------------------------------- Zweibeiner */

    /* Imp: gebeugt, überlange Arme, die fast den Boden berühren, Klauen und
       nach hinten gebogene Hörner.

       Entscheidend ist, dass die Arme **neben** dem Körper hängen und nicht an
       ihm. Beim ersten Versuch lagen sie direkt an der Flanke und verschmolzen
       mit dem Rumpf — heraus kam ein Kegel mit Hörnern. */
    imp(s) {
      const root = new THREE.Group();
      const c = s.colors, m = M(c);
      const S = s.size;
      const core = Sh.joint(root, 0, S * 1.45, 0);
      core.userData.role = 'core';
      core.rotation.x = -0.3;   // vorgebeugt: negativ kippt nach vorn

      // Brustkorb: breit oben, schmal zur Taille.
      Sh.prism(core, { mat: m.main, tw: S * 0.5, bw: S * 0.3, td: S * 0.34, bd: S * 0.24,
                       h: S * 0.62, y: S * 0.16, sides: 6 });
      // Unterleib, deutlich schmaler — das macht die Wespentaille.
      Sh.prism(core, { mat: m.dark, tw: S * 0.3, bw: S * 0.38, td: S * 0.24, bd: S * 0.3,
                       h: S * 0.5, y: -S * 0.4, sides: 6 });
      // Schulterkragen, der die Arme absetzt.
      Sh.prism(core, { mat: m.dark, tw: S * 0.42, bw: S * 0.62, td: S * 0.3, bd: S * 0.42,
                       h: S * 0.2, y: S * 0.46, sides: 6 });
      // Rippen als dunkle Bänder.
      for (let i = 0; i < 3; i++) {
        Sh.prism(core, { mat: m.dark, tw: S * (0.44 - i * 0.05), bw: S * (0.42 - i * 0.05),
                         td: S * 0.32, bd: S * 0.3, h: S * 0.05,
                         y: S * (0.3 - i * 0.16), sides: 6 });
      }

      /* Kopf: sitzt vorgeschoben auf einem kurzen Hals, mit breitem Kiefer und
         zwei nach hinten gebogenen Hörnern. */
      const neck = Sh.joint(core, 0, S * 0.56, -S * 0.05);
      neck.userData.role = 'head';
      neck.rotation.x = -0.38;
      Sh.prism(neck, { mat: m.dark, tw: S * 0.16, bw: S * 0.2, h: S * 0.16, y: S * 0.08, sides: 5 });
      Sh.prism(neck, { mat: m.main, tw: S * 0.34, bw: S * 0.4, td: S * 0.3, bd: S * 0.36,
                       h: S * 0.34, y: S * 0.33, sides: 6 });
      // Kiefer, breiter als der Schädel.
      Sh.prism(neck, { mat: m.dark, tw: S * 0.42, bw: S * 0.3, td: S * 0.34, bd: S * 0.22,
                       h: S * 0.2, y: S * 0.16, z: -S * 0.1, sides: 5 });
      for (let k = -1; k <= 1; k += 2) {
        Sh.glow(neck, S * 0.075, c.eye, k * S * 0.13, S * 0.36, -S * 0.17);
        // Horn in zwei Gliedern, nach hinten geschwungen.
        const h1 = Sh.joint(neck, k * S * 0.15, S * 0.46, 0);
        h1.rotation.z = -k * 0.45;
        h1.rotation.x = 0.35;
        Sh.prism(h1, { mat: m.main, tw: S * 0.06, bw: S * 0.12, h: S * 0.42, y: S * 0.21, sides: 5 });
        const h2 = Sh.joint(h1, 0, S * 0.42, 0);
        h2.rotation.x = 0.6;
        Sh.prism(h2, { mat: m.main, tw: S * 0.01, bw: S * 0.06, h: S * 0.42, y: S * 0.21, sides: 4 });
      }

      /* Arme: Schulter nach außen gestellt, Oberarm lang, Unterarm noch
         länger, dazu drei Klauen. Sie reichen bis unter die Knie. */
      for (let k = -1; k <= 1; k += 2) {
        const sh = Sh.joint(core, k * S * 0.44, S * 0.42, 0);
        sh.userData.role = 'arm' + (k > 0 ? 1 : 0);
        sh.rotation.z = k * 0.42;   // positiv stellt den Arm nach außen
        sh.rotation.x = -0.2;
        Sh.prism(sh, { mat: m.main, tw: S * 0.15, bw: S * 0.1, h: S * 0.72,
                       y: -S * 0.36, sides: 5 });
        const el = Sh.joint(sh, 0, -S * 0.72, 0);
        el.rotation.z = -k * 0.55;
        el.rotation.x = 0.35;
        Sh.prism(el, { mat: m.main, tw: S * 0.1, bw: S * 0.075, h: S * 0.8,
                       y: -S * 0.4, sides: 5 });
        const hand = Sh.joint(el, 0, -S * 0.8, 0);
        for (let f = -1; f <= 1; f++) {
          Sh.prism(hand, { mat: m.dark, tw: S * 0.012, bw: S * 0.05, h: S * 0.34,
                           x: f * S * 0.055, y: -S * 0.16, z: -S * 0.03,
                           rx: -0.45, rz: f * 0.28, sides: 4 });
        }
      }

      // Beine: gebeugt, mit deutlichem Sprunggelenk.
      for (let k = -1; k <= 1; k += 2) {
        const hueft = Sh.joint(core, k * S * 0.2, -S * 0.6, 0);
        hueft.userData.role = 'leg' + (k > 0 ? 1 : 0);
        Sh.prism(hueft, { mat: m.main, tw: S * 0.14, bw: S * 0.18, h: S * 0.55,
                          y: -S * 0.28, rx: -0.45, sides: 5 });
        const knie = Sh.joint(hueft, 0, -S * 0.5, -S * 0.22);
        knie.rotation.x = 0.85;
        Sh.prism(knie, { mat: m.main, tw: S * 0.11, bw: S * 0.08, h: S * 0.55,
                         y: -S * 0.28, sides: 5 });
        const fuss = Sh.joint(knie, 0, -S * 0.55, 0);
        fuss.rotation.x = -0.42;
        Sh.prism(fuss, { mat: m.dark, tw: S * 0.08, bw: S * 0.1, td: S * 0.1, bd: S * 0.28,
                         h: S * 0.26, y: -S * 0.12, z: -S * 0.06, sides: 5 });
        for (let f = -1; f <= 1; f++) {
          Sh.prism(fuss, { mat: m.dark, tw: S * 0.02, bw: S * 0.05, h: S * 0.22,
                           x: f * S * 0.06, y: -S * 0.22, z: -S * 0.16,
                           rx: Math.PI / 2 - 0.2, sides: 4 });
        }
      }
      return root;
    },

    /* Tonkrug auf Stelzen: bauchiger Körper, Deckel obenauf, dünne Beine.
       Templar und Dunestrider teilen sich die Form, der Strider ist größer. */
    clay(s) {
      const root = new THREE.Group();
      const c = s.colors, m = M(c);
      const S = s.size;
      const core = Sh.joint(root, 0, S * 1.05, 0);
      core.userData.role = 'core';

      Sh.prism(core, { mat: m.main, tw: S * 0.42, bw: S * 0.62, h: S * 0.55,
                       y: -S * 0.1, sides: 9 });
      Sh.prism(core, { mat: m.main, tw: S * 0.56, bw: S * 0.42, h: S * 0.5,
                       y: S * 0.4, sides: 9 });
      // Wülste, die den Krug gliedern.
      for (let i = 0; i < 2; i++) {
        Sh.prism(core, { mat: m.dark, tw: S * 0.6, bw: S * 0.6, h: S * 0.07,
                         y: S * (0.12 + i * 0.34), sides: 9 });
      }
      const deckel = Sh.joint(core, 0, S * 0.68, 0);
      deckel.userData.role = 'head';
      Sh.prism(deckel, { mat: m.dark, tw: S * 0.5, bw: S * 0.62, h: S * 0.16, sides: 9 });
      Sh.prism(deckel, { mat: m.dark, tw: S * 0.12, bw: S * 0.2, h: S * 0.2, y: S * 0.16, sides: 6 });
      const g = Sh.glow(deckel, S * 0.2, c.eye, 0, -S * 0.05, 0);
      g.userData.role = 'glow';

      for (let k = -1; k <= 1; k += 2) {
        const b = bein(core, k * S * 0.3, -S * 0.35, 0, S * 1.0, S * 0.09, m, -0.5);
        b.hueft.userData.role = 'leg' + (k > 0 ? 1 : 0);
        const arm = Sh.joint(core, k * S * 0.55, S * 0.3, 0);
        arm.userData.role = 'arm' + (k > 0 ? 1 : 0);
        Sh.prism(arm, { mat: m.dark, tw: S * 0.09, bw: S * 0.12, h: S * 0.6,
                        y: -S * 0.3, rz: -k * 0.25, sides: 4 });
      }
      return root;
    },

    /* Golem und Titan: aufeinandergestapelte Steinplatten mit einem großen
       Auge. Die Fugen zwischen den Platten geben ihm seine Lesbarkeit. */
    golem(s) {
      const root = new THREE.Group();
      const c = s.colors, m = M(c);
      const S = s.size;
      const core = Sh.joint(root, 0, S * 1.3, 0);
      core.userData.role = 'core';

      const platten = [[1.0, 0.48, 0.0], [0.88, 0.42, 0.48], [0.7, 0.36, 0.86]];
      for (let i = 0; i < platten.length; i++) {
        const p = platten[i];
        Sh.prism(core, { mat: i % 2 ? m.dark : m.main, tw: S * p[0] * 0.9, bw: S * p[0],
                         td: S * p[0] * 0.7, bd: S * p[0] * 0.78, h: S * p[1],
                         y: S * p[2], ry: i * 0.25, sides: 6 });
      }
      const neck = Sh.joint(core, 0, S * 1.05, 0);
      neck.userData.role = 'head';
      Sh.prism(neck, { mat: m.main, tw: S * 0.5, bw: S * 0.72, td: S * 0.44, bd: S * 0.6,
                       h: S * 0.5, y: S * 0.2, sides: 6 });
      const auge = Sh.glow(neck, S * 0.26, c.eye, 0, S * 0.2, -S * 0.34);
      auge.userData.role = 'glow';
      // Brauenplatte über dem Auge — das macht den Blick.
      Sh.prism(neck, { mat: m.dark, tw: S * 0.6, bw: S * 0.5, td: S * 0.2, bd: S * 0.14,
                       h: S * 0.16, y: S * 0.42, z: -S * 0.26, rx: -0.3, sides: 4 });

      /* Die Arme hängen frei neben den Platten, nicht an ihnen. Zu weit innen
         verschwinden sie in der Silhouette und der Golem wird zum Fass. */
      for (let k = -1; k <= 1; k += 2) {
        const sh = Sh.joint(core, k * S * 1.02, S * 0.72, 0);
        sh.userData.role = 'arm' + (k > 0 ? 1 : 0);
        sh.rotation.z = -k * 0.12;
        Sh.prism(sh, { mat: m.dark, tw: S * 0.36, bw: S * 0.3, td: S * 0.34, bd: S * 0.28,
                       h: S * 0.85, y: -S * 0.42, sides: 5 });
        const el = Sh.joint(sh, 0, -S * 0.85, 0);
        el.rotation.x = 0.2;
        Sh.prism(el, { mat: m.main, tw: S * 0.3, bw: S * 0.34, td: S * 0.28, bd: S * 0.32,
                       h: S * 0.7, y: -S * 0.35, sides: 5 });
        // Faust: der schwerste Teil, damit die Arme Gewicht bekommen.
        Sh.prism(el, { mat: m.dark, tw: S * 0.46, bw: S * 0.38, td: S * 0.42, bd: S * 0.34,
                       h: S * 0.42, y: -S * 0.88, sides: 6 });
        const b = bein(core, k * S * 0.36, -S * 0.05, 0, S * 1.15, S * 0.26, m, -0.2);
        b.hueft.userData.role = 'leg' + (k > 0 ? 1 : 0);
      }
      return root;
    },

    contraption(s) {
      const root = new THREE.Group();
      const c = s.colors, m = M(c);
      const S = s.size;
      const core = Sh.joint(root, 0, S * 1.7, 0);
      core.userData.role = 'core';
      Sh.prism(core, { mat: m.main, tw: S * 0.7, bw: S * 0.9, td: S * 0.6, bd: S * 0.8,
                       h: S * 0.85, sides: 6 });
      Sh.prism(core, { mat: m.dark, tw: S * 0.96, bw: S * 0.9, td: S * 0.86, bd: S * 0.8,
                       h: S * 0.12, y: S * 0.42, sides: 6 });
      // Bein und Fuß.
      Sh.prism(core, { mat: m.dark, tw: S * 0.12, bw: S * 0.2, h: S * 1.6, y: -S * 1.1, sides: 6 });
      Sh.prism(core, { mat: m.dark, tw: S * 0.44, bw: S * 0.5, h: S * 0.14, y: -S * 1.92, sides: 8 });
      // Lauf und Auge.
      const lauf = Sh.joint(core, 0, 0, -S * 0.55);
      lauf.userData.role = 'head';
      Sh.prism(lauf, { mat: m.dark, tw: S * 0.16, bw: S * 0.2, h: S * 0.9,
                       z: -S * 0.3, rx: Math.PI / 2, sides: 6 });
      const g = Sh.glow(lauf, S * 0.18, c.glow, 0, 0, -S * 0.7);
      g.userData.role = 'glow';
      // Gegengewichte an den Seiten.
      for (let k = -1; k <= 1; k += 2) {
        Sh.prism(core, { mat: m.dark, tw: S * 0.18, bw: S * 0.24, h: S * 0.5,
                         x: k * S * 0.62, y: S * 0.1, rz: -k * 0.3, sides: 5 });
      }
      return root;
    },

    fungus(s) {
      const root = new THREE.Group();
      const c = s.colors, m = M(c);
      const S = s.size;
      const core = Sh.joint(root, 0, S * 0.45, 0);
      core.userData.role = 'core';
      Sh.prism(core, { mat: m.dark, tw: S * 0.24, bw: S * 0.42, h: S * 0.9, sides: 7 });
      const cap = Sh.joint(core, 0, S * 0.5, 0);
      cap.userData.role = 'head';
      const hut = new THREE.Mesh(
        new THREE.SphereGeometry(S * 0.82, 11, 6, 0, U.TAU, 0, Math.PI * 0.52), m.main);
      hut.castShadow = true;
      cap.add(hut);
      // Lamellen unter dem Hut.
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * U.TAU;
        Sh.prism(cap, { mat: m.dark, tw: S * 0.05, bw: S * 0.05, td: S * 0.6, bd: S * 0.6,
                        h: S * 0.08, x: Math.cos(a) * S * 0.4, y: -S * 0.05,
                        z: Math.sin(a) * S * 0.4, ry: a, sides: 4 });
      }
      const g = Sh.glow(cap, S * 0.24, c.glow, 0, S * 0.4, 0);
      g.userData.role = 'glow';
      return root;
    },
    /* Magma Worm: ein Ring aus Kiefern vorn, dahinter Segmente, die nach
       hinten dünner werden. Die Kiefer müssen sich nach **vorn** öffnen — im
       ersten Versuch zeigten sie durch einen falschen Achsenwinkel nach hinten
       in den Körper hinein, und der Kopf war nur ein Klotz. */
    worm(s) {
      const root = new THREE.Group();
      const c = s.colors, m = M(c);
      const S = s.size;
      const core = Sh.joint(root, 0, S * 1.15, 0);
      core.userData.role = 'core';

      // Kopfring, nach vorn aufgeweitet.
      Sh.prism(core, { mat: m.main, tw: S * 1.32, bw: S * 1.15, td: S * 1.32, bd: S * 1.15,
                       h: S * 1.1, z: -S * 0.5, rx: -Math.PI / 2, sides: 9 });
      Sh.prism(core, { mat: m.dark, tw: S * 1.15, bw: S * 1.28, td: S * 1.15, bd: S * 1.28,
                       h: S * 0.22, z: -S * 0.95, rx: -Math.PI / 2, sides: 9 });
      // Glühender Schlund.
      const glut = Sh.glow(core, S * 0.62, c.glow, 0, 0, -S * 0.75);
      glut.userData.role = 'glow';

      /* Sechs Kiefer im Kreis um das Maul. Jeder sitzt auf einem eigenen
         Gelenk, damit er sich später öffnen lässt. */
      for (let i = 0; i < 6; i++) {
        const a2 = (i / 6) * U.TAU;
        const arm = Sh.joint(core, 0, 0, -S * 0.95);
        arm.rotation.z = a2;
        arm.userData.role = 'jaw' + i;
        const rand = Sh.joint(arm, 0, S * 0.95, 0);
        rand.rotation.x = 0.42;
        Sh.prism(rand, { mat: m.dark, tw: S * 0.06, bw: S * 0.42, td: S * 0.1, bd: S * 0.34,
                         h: S * 1.15, z: -S * 0.55, rx: -Math.PI / 2, sides: 4 });
      }

      /* Körpersegmente: jedes etwas dünner, dazwischen ein dunkler Ring und
         oben eine Rückenplatte. Die Ringe machen aus dem Rohr ein Tier. */
      let eltern = core;
      for (let i = 0; i < s.segments; i++) {
        const seg = Sh.joint(eltern, 0, 0, S * 1.0);
        seg.userData.role = 'seg' + i;
        const w = S * (1.2 - i * 0.075);
        Sh.prism(seg, { mat: m.main, tw: w * 0.94, bw: w, td: w * 0.94, bd: w,
                        h: S * 0.8, z: S * 0.4, rx: -Math.PI / 2, sides: 9 });
        Sh.prism(seg, { mat: m.dark, tw: w * 1.04, bw: w * 0.9, td: w * 1.04, bd: w * 0.9,
                        h: S * 0.24, z: S * 0.9, rx: -Math.PI / 2, sides: 9 });
        // Rückenplatte, nach hinten kleiner werdend.
        Sh.prism(seg, { mat: m.dark, tw: w * 0.24, bw: w * 0.6, td: w * 0.3, bd: w * 0.5,
                        h: S * (0.75 - i * 0.05), y: w * 0.95, z: S * 0.4,
                        rx: 0.32, sides: 4 });
        // Seitliche Stummelfüße, die den Wurm im Boden verankern.
        for (let k = -1; k <= 1; k += 2) {
          Sh.prism(seg, { mat: m.dark, tw: w * 0.08, bw: w * 0.22, h: w * 0.7,
                          x: k * w * 0.8, y: -w * 0.35, z: S * 0.4,
                          rz: -k * 1.15, sides: 4 });
        }
        eltern = seg;
      }
      return root;
    },

    /* Mithrix: Krone, Umhang, Hammer. Königlich statt monströs — das ist der
       Kontrast, der ihn am Ende von allem anderen abhebt.

       Als Endboss steht er am längsten im Bild, also bekommt er die breitesten
       Schultern, den größten Umhang und eine Waffe, die man als Waffe erkennt.
       Der erste Versuch war ein Quader mit einem weißen Klotz daneben. */
    mithrix(s) {
      const root = new THREE.Group();
      const c = s.colors, m = M(c);
      const S = s.size;
      const core = Sh.joint(root, 0, S * 1.5, 0);
      core.userData.role = 'core';

      // Brust: breite Schultern, schmale Taille.
      Sh.prism(core, { mat: m.main, tw: S * 0.72, bw: S * 0.4, td: S * 0.46, bd: S * 0.3,
                       h: S * 0.85, y: S * 0.1, sides: 7 });
      Sh.prism(core, { mat: m.dark, tw: S * 0.42, bw: S * 0.5, td: S * 0.3, bd: S * 0.36,
                       h: S * 0.42, y: -S * 0.5, sides: 6 });
      // Brustplatte mit Mittelgrat.
      Sh.prism(core, { mat: m.dark, tw: S * 0.34, bw: S * 0.22, td: S * 0.1, bd: S * 0.08,
                       h: S * 0.7, y: S * 0.12, z: -S * 0.26, sides: 5 });
      // Gürtel.
      Sh.prism(core, { mat: m.dark, tw: S * 0.54, bw: S * 0.56, td: S * 0.4, bd: S * 0.42,
                       h: S * 0.12, y: -S * 0.34, sides: 7 });

      /* Umhang in drei Bahnen mit leicht versetzten Winkeln — eine einzige
         Platte hängt wie ein Brett. */
      for (let i = -1; i <= 1; i++) {
        const b = Sh.joint(core, i * S * 0.26, S * 0.36, S * 0.26);
        b.rotation.x = -0.12 + Math.abs(i) * 0.05;
        b.rotation.z = -i * 0.16;
        Sh.prism(b, { mat: m.dark, tw: S * 0.34, bw: S * 0.46, td: S * 0.06, bd: S * 0.1,
                      h: S * 2.1, y: -S * 1.05, sides: 4 });
      }
      // Schulterplatten.
      for (let k = -1; k <= 1; k += 2) {
        const p2 = Sh.joint(core, k * S * 0.5, S * 0.46, 0);
        p2.rotation.z = -k * 0.42;
        Sh.prism(p2, { mat: m.main, tw: S * 0.4, bw: S * 0.32, td: S * 0.46, bd: S * 0.38,
                       h: S * 0.28, sides: 6 });
        Sh.prism(p2, { mat: m.dark, tw: S * 0.34, bw: S * 0.42, td: S * 0.4, bd: S * 0.48,
                       h: S * 0.14, y: -S * 0.2, sides: 6 });
      }

      // Kopf: Helm mit Sehschlitz und Krone.
      const neck = Sh.joint(core, 0, S * 0.56, 0);
      neck.userData.role = 'head';
      Sh.prism(neck, { mat: m.dark, tw: S * 0.16, bw: S * 0.2, h: S * 0.12, y: S * 0.06, sides: 5 });
      Sh.prism(neck, { mat: m.main, tw: S * 0.28, bw: S * 0.34, td: S * 0.3, bd: S * 0.34,
                       h: S * 0.46, y: S * 0.34, sides: 7 });
      // Gesichtsplatte, etwas vorstehend.
      Sh.prism(neck, { mat: m.main, tw: S * 0.2, bw: S * 0.26, td: S * 0.14, bd: S * 0.16,
                       h: S * 0.34, y: S * 0.3, z: -S * 0.18, sides: 5 });
      const g = Sh.glow(neck, S * 0.1, c.eye, 0, S * 0.36, -S * 0.24);
      g.userData.role = 'glow';
      // Krone: acht Zacken, vorn höher als hinten.
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * U.TAU;
        const vorn = (1 - Math.cos(a)) * 0.5;
        Sh.prism(neck, { mat: m.dark, tw: S * 0.02, bw: S * 0.07,
                         h: S * (0.2 + vorn * 0.34),
                         x: Math.cos(a + Math.PI / 2) * S * 0.26, y: S * 0.62,
                         z: Math.sin(a + Math.PI / 2) * S * 0.26, sides: 4 });
      }

      // Arme.
      const haende = [];
      for (let k = -1; k <= 1; k += 2) {
        const sh = Sh.joint(core, k * S * 0.52, S * 0.36, 0);
        sh.userData.role = 'arm' + (k > 0 ? 1 : 0);
        sh.rotation.z = k * 0.18;
        sh.rotation.x = -0.5;
        Sh.prism(sh, { mat: m.main, tw: S * 0.17, bw: S * 0.13, h: S * 0.62,
                       y: -S * 0.31, sides: 5 });
        const el = Sh.joint(sh, 0, -S * 0.62, 0);
        el.rotation.x = 0.85;
        Sh.prism(el, { mat: m.dark, tw: S * 0.13, bw: S * 0.12, h: S * 0.58,
                       y: -S * 0.29, sides: 5 });
        const hand = Sh.joint(el, 0, -S * 0.6, 0);
        Sh.prism(hand, { mat: m.main, tw: S * 0.15, bw: S * 0.13, td: S * 0.17, bd: S * 0.15,
                         h: S * 0.16, sides: 5 });
        haende.push(hand);
      }

      // Beine mit Beinschienen.
      for (let k = -1; k <= 1; k += 2) {
        const hueft = Sh.joint(core, k * S * 0.24, -S * 0.6, 0);
        hueft.userData.role = 'leg' + (k > 0 ? 1 : 0);
        Sh.prism(hueft, { mat: m.main, tw: S * 0.22, bw: S * 0.17, h: S * 0.7,
                          y: -S * 0.35, sides: 6 });
        const knie = Sh.joint(hueft, 0, -S * 0.7, 0);
        Sh.prism(knie, { mat: m.dark, tw: S * 0.17, bw: S * 0.14, h: S * 0.62,
                         y: -S * 0.31, sides: 5 });
        Sh.prism(knie, { mat: m.main, tw: S * 0.2, bw: S * 0.18, td: S * 0.22, bd: S * 0.34,
                         h: S * 0.14, y: -S * 0.67, z: -S * 0.06, sides: 5 });
      }

      /* Der Hammer sitzt in der rechten Hand, schräg nach hinten unten. Kopf
         mit Kragen und zwei Schlagflächen — ein reiner Klotz am Stielende sah
         aus wie ein Eimer. */
      const griff = Sh.joint(haende[1], 0, -S * 0.06, 0);
      griff.rotation.x = -1.15;
      griff.rotation.z = 0.25;
      Sh.prism(griff, { mat: m.dark, tw: S * 0.055, bw: S * 0.07, h: S * 1.9,
                        y: -S * 0.8, sides: 6 });
      // Wicklung am Griff.
      for (let i = 0; i < 3; i++) {
        Sh.prism(griff, { mat: m.main, tw: S * 0.075, bw: S * 0.075, h: S * 0.07,
                          y: -S * (0.1 + i * 0.22), sides: 6 });
      }
      const kopfH = Sh.joint(griff, 0, -S * 1.68, 0);
      Sh.prism(kopfH, { mat: m.main, tw: S * 0.2, bw: S * 0.2, td: S * 0.2, bd: S * 0.2,
                        h: S * 0.62, rz: Math.PI / 2, sides: 6 });
      for (let k = -1; k <= 1; k += 2) {
        Sh.prism(kopfH, { mat: m.dark, tw: S * 0.26, bw: S * 0.22, td: S * 0.26, bd: S * 0.22,
                          h: S * 0.12, x: k * S * 0.34, rz: Math.PI / 2, sides: 6 });
      }
      Sh.prism(kopfH, { mat: m.dark, tw: S * 0.11, bw: S * 0.13, h: S * 0.3,
                        y: S * 0.2, sides: 6 });
      return root;
    }
  };

  ROR.MonsterModel = {
    BAUPLAENE: BAUPLAENE,
    build(def) {
      const bau = BAUPLAENE[def.shape.kind];
      if (!bau) throw new Error('Unknown monster build: ' + def.shape.kind);
      return bau(def.shape);
    }
  };
})(window.ROR);
