/* game/data/stages.js
   Reine Daten: wie eine Stage aussieht und was auf ihr wächst.
   Eine neue Stage ist ein Eintrag hier — kein Code an anderer Stelle. */
(function (ROR) {
  'use strict';

  ROR.Data = ROR.Data || {};

  /* Aufbau eines Eintrags
     order        Platz in der Reihenfolge (1..5); 0 = Sonderrealm
     size/res     Kantenlänge des Geländes in Metern / Gitterpunkte je Achse
     terrain      Parameter der Höhenfunktion, siehe world/terrain.js
     palette      Farben; alles Sichtbare entsteht daraus, es gibt keine Texturen
     props        Anzahl der Streuobjekte
     sun          Sonnenstand in Radiant (Azimut, Höhe) */

  ROR.Data.Stages = [
    {
      id: 'titanic_plains',
      name: 'Titanic Plains',
      subtitle: 'Ebene der Riesen',
      order: 1,
      size: 300,
      res: 176,
      seaLevel: -30,

      /* Ein Tisch auf einem Berg: innen weit und fast eben, am Rand bricht er
         auf wenigen Metern senkrecht ab. Der Wall kurz vor der Kante ist
         Absicht — man soll den Abgrund sehen, bevor man hineinläuft. */
      terrain: {
        shape: 'plateau',
        baseHeight: 9,
        hillAmp: 7,        hillScale: 62,
        detailAmp: 1.7,    detailScale: 15,
        ridgeAmp: 26,      ridgeScale: 80,
        mesaLow: 0.56,     mesaHigh: 0.69,     mesaEdge: 0.05,
        maskScale: 108,    maskBias: 0.02,     maskWidth: 0.26,
        terraceStep: 5,    terraceSharp: 0.18,
        rimInner: 0.72,    rimOuter: 0.81,     rimLip: 6,
        shoreWarp: 0.20,   drop: 150
      },

      /* Farbklima: entsättigtes Olivgrün statt Signalgrün, warmes Gestein,
         blasser Dunst am Horizont. Der Dunst ist das eigentliche Merkmal der
         Vorlage — Entferntes verliert dort früh an Sättigung und Kontrast. */
      palette: {
        grade: { saettigung: 0.94, kontrast: 1.05, leuchten: 0.75, vignette: 0.40, hauch: 0x203040 },
        sky: 0x7ba2c2, horizon: 0xdcdfd2,
        fog: 0xdcdfd2, fogDensity: 0.0026,
        sun: 0xffe6bc, sunIntensity: 2.5,
        ambientSky: 0xc0d2dc, ambientGround: 0x6d6a48, ambientIntensity: 1.9,
        fillIntensity: 0.6,
        grass: 0x77913f, grassDark: 0x415725,
        rock: 0x9e937b, rockDark: 0x5a5245,
        dirt: 0x7f6d4c,
        sand: 0xc9b98c, peak: 0xbcbca6, seabed: 0x2d4550,
        water: 0x36697d,
        trunk: 0x4b3b2b, leaf: 0x4c6f2c, leafAlt: 0x648c38
      },

      props: { boulders: 120, trees: 115, pillars: 20, platforms: 16 },
      sun: { azimuth: 2.35, elevation: 0.40 }
    },

    {
      id: 'abandoned_aqueduct',
      name: 'Abandoned Aqueduct',
      subtitle: 'Verlassenes Aquädukt',
      order: 2,
      size: 280,
      res: 172,
      seaLevel: -12,

      /* Sandsteinterrassen: kleine Stufen, dafür viele. Der Ort ist eine
         Ruinenlandschaft, keine Berglandschaft — deshalb niedrige Tafelberge
         mit engem Stufenabstand statt weniger großer Klippen. */
      /* Wüstenhochland, in das sich eine Schlucht gegraben hat. Gelaufen wird
         unten zwischen den Wänden; die Terrassen an den Flanken sind das
         Aquädukt-Motiv. Zwei Schluchten kreuzen sich, damit es Abzweigungen
         gibt statt eines Schlauchs. */
      terrain: {
        shape: 'canyon',
        baseHeight: 4,     plateauHeight: 44,
        hillAmp: 5,        hillScale: 58,
        detailAmp: 1.3,    detailScale: 13,
        ridgeAmp: 12,      ridgeScale: 62,
        mesaLow: 0.50,     mesaHigh: 0.60,     mesaEdge: 0.035,
        maskScale: 78,     maskBias: -0.10,    maskWidth: 0.34,
        terraceStep: 4,    terraceSharp: 0.12,
        canyonWind: 120,   canyonWobble: 0.62,
        canyonWidth: 0.17, canyonDepth: 45,
        rimInner: 0.86,    rimOuter: 0.98,
        shoreWarp: 0.13,   drop: 60
      },

      palette: {
        grade: { saettigung: 0.92, kontrast: 1.06, leuchten: 0.72, vignette: 0.38, hauch: 0x2a2418 },
        sky: 0x9fb4c8, horizon: 0xf0e2c4,
        fog: 0xf0e2c4, fogDensity: 0.0026,
        sun: 0xfff0cc, sunIntensity: 2.7,
        ambientSky: 0xe0d8c0, ambientGround: 0x8a7550, ambientIntensity: 2.0,
        fillIntensity: 0.7,
        grass: 0x8d9448, grassDark: 0x5d6430,
        rock: 0xc4a878, rockDark: 0x7e6640,
        dirt: 0xa8905c,
        sand: 0xdcc699, peak: 0xe0d2b0, seabed: 0x1f5560,
        water: 0x2f8a92,
        trunk: 0x6a5236, leaf: 0x7e8f42, leafAlt: 0x94a04e
      },

      props: { boulders: 150, trees: 40, pillars: 46, platforms: 22 },
      sun: { azimuth: 0.9, elevation: 0.55 }
    },

    {
      id: 'rallypoint_delta',
      name: 'Rallypoint Delta',
      subtitle: 'Sammelpunkt Delta',
      order: 3,
      size: 320,
      res: 180,
      seaLevel: 0,

      /* Breite, sehr flache Plateaus mit steilen Flanken — die Militärbasis
         steht auf ebenen Flächen, dazwischen fällt es hart ab. */
      /* Breite, sehr flache Terrassen mit steilen Flanken — die Militärbasis
         steht auf ebenen Flächen, dazwischen fällt es hart ab. */
      terrain: {
        shape: 'mesa',
        baseHeight: 7,
        hillAmp: 3.5,      hillScale: 88,
        detailAmp: 1.0,    detailScale: 19,
        ridgeAmp: 52,      ridgeScale: 96,
        mesaLow: 0.505,    mesaHigh: 0.63,     mesaEdge: 0.028,
        maskScale: 130,    maskBias: -0.06,    maskWidth: 0.26,
        terraceStep: 9,    terraceSharp: 0.10,
        rimInner: 0.54,    rimOuter: 0.95,
        shoreWarp: 0.22,   drop: 22
      },

      palette: {
        grade: { saettigung: 0.88, kontrast: 1.08, leuchten: 0.85, vignette: 0.46, hauch: 0x1c2836 },
        sky: 0x6b86a4, horizon: 0xd6dee6,
        fog: 0xd6dee6, fogDensity: 0.0044,
        sun: 0xdce8f6, sunIntensity: 1.9,
        ambientSky: 0xc8d6e4, ambientGround: 0x6a7280, ambientIntensity: 2.1,
        fillIntensity: 0.7,
        grass: 0xd4dce2, grassDark: 0x8f9aa6,
        rock: 0x7d848c, rockDark: 0x4a5058,
        dirt: 0x6c7076,
        sand: 0xc2cad2, peak: 0xeef4f8, seabed: 0x2a3640,
        water: 0x38566a,
        trunk: 0x3a3630, leaf: 0x2e4636, leafAlt: 0x3d5a44
      },

      props: { boulders: 90, trees: 70, pillars: 34, platforms: 26 },
      sun: { azimuth: 3.6, elevation: 0.28 }
    },

    {
      id: 'abyssal_depths',
      name: 'Abyssal Depths',
      subtitle: 'Abgründige Tiefen',
      order: 4,
      size: 260,
      res: 170,
      seaLevel: -70,

      /* Hohe, enge Felsnadeln und tiefe Spalten. Das „Meer" unten ist Lava —
         dieselbe Ebene, nur anders eingefärbt. Ein echtes Höhlendach würde
         die Kamera unbrauchbar machen; die Dunkelheit macht der Himmel. */
      /* Eine Höhle: Boden und Decke, oben geschlossen. Zum Rand hin steigt der
         Boden an und trifft die sinkende Decke — die Höhle schließt sich,
         statt ins Nichts auszulaufen. Es gibt hier keinen Himmel. */
      terrain: {
        shape: 'cave',
        baseHeight: 4,
        hillAmp: 6,        hillScale: 42,
        detailAmp: 2.4,    detailScale: 11,
        ridgeAmp: 28,      ridgeScale: 56,
        mesaLow: 0.55,     mesaHigh: 0.68,     mesaEdge: 0.045,
        maskScale: 70,     maskBias: 0.02,     maskWidth: 0.24,
        terraceStep: 6,    terraceSharp: 0.18,
        rimInner: 0.60,    rimOuter: 0.92,     wallRise: 78,
        ceilHeight: 44,    ceilRough: 17,
        shoreWarp: 0.20,   drop: 0
      },

      palette: {
        grade: { saettigung: 1.08, kontrast: 1.02, leuchten: 1.35, vignette: 0.46, hauch: 0x40200e, belichtung: 1.9 },
        sky: 0x140c10, horizon: 0x502218,
        fog: 0x40201a, fogDensity: 0.0029,
        /* In einer Höhle gibt es keine Sonne. Das Licht kommt von unten aus
           der Lava — deshalb ist die Richtungslampe fast aus und das
           Umgebungslicht trägt fast alles, warm und von unten eingefärbt. */
        sun: 0xff9a50, sunIntensity: 0.8,
        ambientSky: 0x6a3a30, ambientGround: 0xa04a1c, ambientIntensity: 3.4,
        fillIntensity: 1.5,
        grass: 0x5c4030, grassDark: 0x32201a,
        rock: 0x8e5c46, rockDark: 0x452820,
        dirt: 0x663c26,
        sand: 0x7a4028, peak: 0x8a5038, seabed: 0x2a0c08,
        water: 0xd8531c,
        trunk: 0x2a1a14, leaf: 0x4a2a20, leafAlt: 0x5c3626
      },

      props: { boulders: 180, trees: 20, pillars: 52, platforms: 30 },
      sun: { azimuth: 1.6, elevation: 0.75 }
    },

    {
      id: 'sky_meadow',
      name: 'Sky Meadow',
      subtitle: 'Himmelswiese',
      order: 5,
      size: 290,
      res: 176,
      seaLevel: -28,

      /* Schwebende Wiese über den Wolken. Das „Meer" ist Wolkenweiß und
         verschwindet im Nebel, sodass die Ränder ins Nichts abfallen. */
      /* Getrennte Schollen über den Wolken. Der Sprung von Insel zu Insel ist
         hier der Weg — deshalb die harte Kante am Inselrand. */
      terrain: {
        shape: 'islands',
        baseHeight: 6,
        hillAmp: 6.5,      hillScale: 56,
        detailAmp: 1.5,    detailScale: 16,
        ridgeAmp: 30,      ridgeScale: 68,
        mesaLow: 0.53,     mesaHigh: 0.66,     mesaEdge: 0.04,
        maskScale: 92,     maskBias: -0.04,    maskWidth: 0.30,
        terraceStep: 5,    terraceSharp: 0.15,
        islandScale: 84,   islandBias: -0.13,  islandEdge: 0.13,
        rimInner: 0.56,    rimOuter: 0.88,
        shoreWarp: 0.20,   drop: 95
      },

      palette: {
        grade: { saettigung: 1.02, kontrast: 1.03, leuchten: 1.00, vignette: 0.36, hauch: 0x2a1c38 },
        sky: 0x6a5a9c, horizon: 0xf0c8d8,
        fog: 0xf0c8d8, fogDensity: 0.0030,
        sun: 0xffd8c0, sunIntensity: 2.3,
        ambientSky: 0xd8c0e0, ambientGround: 0x5c6a48, ambientIntensity: 2.0,
        fillIntensity: 0.75,
        grass: 0x79ac56, grassDark: 0x3d6440,
        rock: 0x9a8ea8, rockDark: 0x5a4f6a,
        dirt: 0x7a6c72,
        sand: 0xc8b8c0, peak: 0xe8dcec, seabed: 0xf0c8d8,
        water: 0xf0d4de,
        trunk: 0x54405a, leaf: 0x5e8c50, leafAlt: 0x86a860
      },

      props: { boulders: 100, trees: 90, pillars: 24, platforms: 40 },
      sun: { azimuth: 5.1, elevation: 0.34 }
    }
,

    /* ----------------------------------------------------- Sonderrealms */

    {
      id: 'bazaar', name: 'Bazaar Between Time', subtitle: 'Zwischen den Zeiten',
      order: 0, size: 150, res: 120, seaLevel: -24,
      /* Klein, flach und rundum abfallend: ein Marktplatz im Nichts. Hier
         wird nicht gekämpft, hier wird gehandelt. */
      /* Ein Marktplatz im Nichts: eine kleine Scholle, ringsum Leere. */
      terrain: {
        shape: 'islands',
        baseHeight: 6,
        hillAmp: 1.8,      hillScale: 40,
        detailAmp: 0.6,    detailScale: 11,
        ridgeAmp: 9,       ridgeScale: 44,
        mesaLow: 0.56,     mesaHigh: 0.72,     mesaEdge: 0.05,
        maskScale: 66,     maskBias: 0.06,     maskWidth: 0.30,
        terraceStep: 3,    terraceSharp: 0.14,
        islandScale: 56,   islandBias: -0.24,  islandEdge: 0.18,
        rimInner: 0.44,    rimOuter: 0.72,
        shoreWarp: 0.08,   drop: 70
      },
      palette: {
        grade: { saettigung: 1.08, kontrast: 1.04, leuchten: 1.30, vignette: 0.48, hauch: 0x241844, belichtung: 1.2 },
        sky: 0x2a1f4a, horizon: 0x8f6ac0,
        fog: 0x6a4c9a, fogDensity: 0.0060,
        sun: 0xffd0f0, sunIntensity: 1.9,
        ambientSky: 0xc0a0e0, ambientGround: 0x5a4080, ambientIntensity: 2.1,
        fillIntensity: 0.8,
        grass: 0x7a6aa8, grassDark: 0x4a3c72,
        rock: 0xa89ad0, rockDark: 0x5e5090,
        dirt: 0x6e5f9a,
        sand: 0xc8b8e0, peak: 0xe0d0f8, seabed: 0x2a1f4a,
        water: 0x4a2f7a,
        trunk: 0x4a3a6a, leaf: 0x8f6ac0, leafAlt: 0xa88ad8
      },
      props: { boulders: 40, trees: 26, pillars: 14, platforms: 10 },
      sun: { azimuth: 2.0, elevation: 0.5 }
    },

    {
      id: 'commencement', name: 'Commencement', subtitle: 'Der Mond',
      order: 6, size: 240, res: 160, seaLevel: -36,
      /* Kahler Fels, harte Kanten, kein Bewuchs. Am Ende steht nur noch
         der Boden, auf dem gekämpft wird. */
      /* Der Mond: dieselbe Tischform wie Titanic Plains, aber kahl, härter
         und mit höherem Wall — hier gibt es nichts als den Boden. */
      terrain: {
        shape: 'plateau',
        baseHeight: 7,
        hillAmp: 3,        hillScale: 70,
        detailAmp: 1.1,    detailScale: 14,
        ridgeAmp: 34,      ridgeScale: 84,
        mesaLow: 0.52,     mesaHigh: 0.65,     mesaEdge: 0.03,
        maskScale: 100,    maskBias: -0.04,    maskWidth: 0.28,
        terraceStep: 7,    terraceSharp: 0.11,
        rimInner: 0.68,    rimOuter: 0.78,     rimLip: 9,
        shoreWarp: 0.19,   drop: 165
      },
      palette: {
        grade: { saettigung: 0.80, kontrast: 1.06, leuchten: 1.10, vignette: 0.52, hauch: 0x14182a, belichtung: 1.25 },
        sky: 0x0a0a12, horizon: 0x3a3a56,
        fog: 0x2a2a40, fogDensity: 0.0040,
        sun: 0xf0f0ff, sunIntensity: 2.2,
        ambientSky: 0x9098c0, ambientGround: 0x50506a, ambientIntensity: 1.8,
        fillIntensity: 0.7,
        grass: 0x8a8a98, grassDark: 0x50505e,
        rock: 0xb0b0be, rockDark: 0x5a5a68,
        dirt: 0x70707e,
        sand: 0xc0c0ce, peak: 0xe8e8f4, seabed: 0x1a1a26,
        water: 0x1a1a2e,
        trunk: 0x3a3a46, leaf: 0x5a5a68, leafAlt: 0x6a6a78
      },
      props: { boulders: 130, trees: 0, pillars: 44, platforms: 20 },
      sun: { azimuth: 4.2, elevation: 0.5 }
    }
  ];

  ROR.Data.stageByOrder = function (order) {
    const list = ROR.Data.Stages.filter((s) => s.order === order);
    return list.length ? list : ROR.Data.Stages.slice(0, 1);
  };
})(window.ROR);
