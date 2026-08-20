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

      palette: {
        sky: 0x93bcd8, horizon: 0xcfe2ec,
        fog: 0xcfe2ec, fogDensity: 0.0022,
        sun: 0xfff0d2, sunIntensity: 2.2,
        // Three rechnet seit r155 mit physikalischen Einheiten: 0.9 Umgebungslicht
        // ließ jede sonnenabgewandte Fläche fast schwarz werden.
        ambientSky: 0xb2d4e6, ambientGround: 0x55693b, ambientIntensity: 1.9,
        grass: 0x69a044, grassDark: 0x35602a,
        rock: 0x9a9280, rockDark: 0x545044,
        dirt: 0x77694f,
        sand: 0xc4b183, peak: 0xb9bda6, seabed: 0x2c4a56,
        water: 0x2e6382,
        trunk: 0x4a3a2a, leaf: 0x4f8438, leafAlt: 0x67a044
      },

      props: { boulders: 120, trees: 115, pillars: 20, platforms: 16 },
      sun: { azimuth: 2.2, elevation: 0.66 }
    }
  ];

  ROR.Data.stageByOrder = function (order) {
    const list = ROR.Data.Stages.filter((s) => s.order === order);
    return list.length ? list : ROR.Data.Stages.slice(0, 1);
  };
})(window.ROR);
