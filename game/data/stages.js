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
      seaLevel: 0,

      terrain: {
        baseHeight: 5,
        hillAmp: 5,        hillScale: 64,      // sanfte Grasrücken
        detailAmp: 1.5,    detailScale: 15,    // Feinstruktur gegen die Plastikoptik
        ridgeAmp: 44,      ridgeScale: 78,     // Höhe der titanischen Tafelberge
        mesaLow: 0.53,     mesaHigh: 0.655,    // Schwellen der beiden Stufen
        mesaEdge: 0.05,                        // Breite der Flanke: klein = Klippe
        maskScale: 110,    maskBias: -0.02,    maskWidth: 0.30,
        terraceStep: 6,    terraceSharp: 0.20, // ebnet, was auf den Deckeln übrig bleibt
        shoreInner: 0.56,  shoreOuter: 0.96,
        shoreWarp: 0.20,                       // verzieht die Küste, damit sie kein Kreis ist
        drop: 18                               // wie tief es hinter der Küste abfällt
      },

      /* Farbklima: entsättigtes Olivgrün statt Signalgrün, warmes Gestein,
         blasser Dunst am Horizont. Der Dunst ist das eigentliche Merkmal der
         Vorlage — Entferntes verliert dort früh an Sättigung und Kontrast. */
      palette: {
        sky: 0x7ba2c2, horizon: 0xdcdfd2,
        fog: 0xdcdfd2, fogDensity: 0.0033,
        sun: 0xffe6bc, sunIntensity: 2.5,
        // Three rechnet seit r155 mit physikalischen Einheiten: unter 1.5
        // Umgebungslicht wird jede sonnenabgewandte Fläche fast schwarz.
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
    }
  ];

  ROR.Data.stageByOrder = function (order) {
    const list = ROR.Data.Stages.filter((s) => s.order === order);
    return list.length ? list : ROR.Data.Stages.slice(0, 1);
  };
})(window.ROR);
