/* game/data/interactables.js
   Was auf einer Stage herumsteht.

   `baseCost` ist der Preis im ersten Environment eines Einzelspieler-Laufs.
   Der tatsächliche Preis ist `basis × coeff^1.25` — der Exponent ist der
   Grund, warum Kisten im Loop unbezahlbar werden.

   `directorCost` sind die Credits, die der Interactable-Director für ein
   Exemplar ausgibt. Das Budget je Stage steht im Wiki (Titanic Plains: 220),
   die Einzelkosten nicht — sie sind hier so gewählt, dass gut zwanzig Objekte
   je Stage entstehen, was der Vorlage entspricht.

   `weight` bestimmt, wie oft etwas gezogen wird, unabhängig vom Preis.       */
(function (ROR) {
  'use strict';

  ROR.Data.Interactables = [
    { id: 'chest', name: 'Chest', kind: 'chest', table: 'CHEST',
      baseCost: 25, directorCost: 8, weight: 80, color: 0x8d6a3f, size: 1.0 },

    { id: 'large_chest', name: 'Large Chest', kind: 'chest', table: 'LARGE',
      baseCost: 50, directorCost: 22, weight: 18, color: 0x6f8f4a, size: 1.35 },

    { id: 'legendary_chest', name: 'Legendary Chest', kind: 'chest', table: 'LEGEND',
      baseCost: 400, directorCost: 55, weight: 1, color: 0xa8443a, size: 1.5 },

    { id: 'multishop', name: 'Multishop Terminal', kind: 'multishop', table: 'CHEST',
      baseCost: 25, directorCost: 14, weight: 30, color: 0x5d7f96 },

    { id: 'equipment_barrel', name: 'Equipment Barrel', kind: 'equipment',
      baseCost: 25, directorCost: 10, weight: 12, color: 0xc07a3a },

    { id: 'shrine_chance', name: 'Schrein des Zufalls', kind: 'shrine_chance',
      baseCost: 17, directorCost: 10, weight: 20, color: 0xd8c070 },

    { id: 'shrine_blood', name: 'Blutschrein', kind: 'shrine_blood',
      baseCost: 0, directorCost: 12, weight: 10, color: 0xb03a3a },

    { id: 'shrine_combat', name: 'Kampfschrein', kind: 'shrine_combat',
      baseCost: 30, directorCost: 12, weight: 8, color: 0x9a6ad0 },

    { id: 'shrine_mountain', name: 'Bergschrein', kind: 'shrine_mountain',
      baseCost: 0, directorCost: 20, weight: 5, color: 0x7fd0e0 },

    { id: 'printer_common', name: '3D Printer (white)', kind: 'printer', tier: 'common',
      baseCost: 0, directorCost: 20, weight: 12, color: 0xc8ccd0 },

    { id: 'printer_uncommon', name: '3D Printer (green)', kind: 'printer', tier: 'uncommon',
      baseCost: 0, directorCost: 30, weight: 8, color: 0x6fd36f },

    { id: 'scrapper', name: 'Scrapper', kind: 'scrapper',
      baseCost: 0, directorCost: 15, weight: 8, color: 0x8a8f95 },

    { id: 'drone_gun', name: 'Kaputte Kampfdrohne', kind: 'drone',
      baseCost: 35, directorCost: 14, weight: 14, color: 0x6a8fa8 },

    { id: 'drone_heal', name: 'Kaputte Heildrohne', kind: 'drone', heals: true,
      baseCost: 50, directorCost: 18, weight: 9, color: 0x6fd3a0 },

    /* Der Newt-Altar kostet eine Mondmünze und öffnet nach dem Teleporter
       das blaue Portal in den Bazaar. */
    /* Portale. Sie werden nicht vom Director gestreut, sondern vom Teleporter
       geoeffnet, wenn sein Ereignis durch ist. `directorCost: 0` und
       `weight: 0` halten sie aus der Streuung heraus. */
    { id: 'portal_weiter', name: 'Portal', kind: 'portal', ziel: 'weiter',
      baseCost: 0, directorCost: 0, weight: 0, color: 0x6fe0c0 },

    { id: 'portal_lunar', name: 'Lunar Portal', kind: 'portal', ziel: 'bazaar',
      baseCost: 0, directorCost: 0, weight: 0, color: 0x7ec8ff },

    { id: 'portal_himmel', name: 'Celestial Portal', kind: 'portal', ziel: 'commencement',
      baseCost: 0, directorCost: 0, weight: 0, color: 0xf2c14e },

    /* Der Newt-Altar wird nicht gestreut (`weight: 0`), sondern steht auf
       ausgewaehlten Stages an einem festen, abgelegenen Platz. Ihn zu finden
       ist der Punkt — er ist der einzige Weg in den Bazaar. */
    { id: 'newt_altar', name: 'Newt Altar', kind: 'newt',
      baseCost: 0, directorCost: 0, weight: 0, color: 0x7ec8ff },

    /* Nur im Bazaar: gegen Mondmünzen gibt es Lunar-Items — stark, aber
       jedes mit einem Nachteil. */
    { id: 'lunar_pod', name: 'Mondkapsel', kind: 'lunar', bazaarOnly: true,
      baseCost: 0, directorCost: 10, weight: 40, color: 0x7ec8ff },

    { id: 'cleansing_pool', name: 'Reinigungsbecken', kind: 'cleanse', bazaarOnly: true,
      baseCost: 0, directorCost: 10, weight: 12, color: 0x9fe4ff }
  ];

  /* Credits des Scene Directors je Stage — aus dem Wiki. */
  /* Einzelzugriff nach Kennung — der Teleporter braucht das, um seine Portale
     zu setzen, ohne die Streuung zu bemuehen. */
  ROR.Data.interactable = function (id) {
    const l = ROR.Data.Interactables;
    for (let i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  };

  ROR.Data.InteractableBudget = {
    0: 70,                                   // Bazaar: ein paar Kapseln
    /* Die Karten sind seit der Vergroesserung viermal so gross. Das Budget
       waechst bewusst nur um das 1.8-fache mit: viermal so viele Kisten
       waeren viermal so viele Items, und daran haengt die ganze
       Schwierigkeitskurve. Den Rest macht die Gruppierung wett — man findet
       weniger Orte, dafuer an jedem Ort mehr. */
    1: 400, 2: 400, 3: 580, 4: 720, 5: 940,
    6: 0                                     // Commencement: nur Mithrix
  };
})(window.ROR);
