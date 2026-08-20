/* game/sim/difficulty.js
   Der Schwierigkeitskoeffizient — die eine Zahl, an der alles hängt.

   Aus ihm folgen Gegnerstufe, die Credits des Directors, die Belohnungen und
   die Preise der Kisten. Er wächst mit der *Zeit* und springt bei jedem
   abgeschlossenen Environment. Genau das ist der Handel, der die Vorlage
   ausmacht: länger bleiben heißt mehr Items, aber die Gegner wachsen
   schneller als man selbst.

     coeff       = (playerFactor + minuten × timeFactor) × 1.15 ^ stages
     playerFactor= 1 + 0.3 × (spieler − 1)
     timeFactor  = 0.0506 × schwierigkeit × spieler^0.2
     gegnerLevel = 1 + (coeff − playerFactor) / 0.33                        */
(function (ROR) {
  'use strict';

  const U = ROR.Util;

  /* Die Namen stehen im Wiki, die Schwellen nicht — das Spiel veröffentlicht
     sie nicht. Sie sind hier an der Gegnerstufe festgemacht statt am
     Koeffizienten, weil das die Zahl ist, die man im Spiel auch sieht.
     Auf Rainstorm erreicht man „I SEE YOU" damit nach gut vierzig Minuten. */
  const LADDER = [
    { level: 0,  name: 'Easy' },
    { level: 5,  name: 'Normal' },
    { level: 10, name: 'Hard' },
    { level: 16, name: 'Very Hard' },
    { level: 23, name: 'Insane' },
    { level: 32, name: 'Impossible' },
    { level: 43, name: 'I SEE YOU' },
    { level: 56, name: "I'M COMING FOR YOU" },
    { level: 76, name: 'HAHAHAHA' }
  ];

  const MODES = [
    { id: 'drizzle',   name: 'Drizzle',   value: 1 },
    { id: 'rainstorm', name: 'Rainstorm', value: 2 },
    { id: 'monsoon',   name: 'Monsoon',   value: 3 }
  ];

  const Difficulty = {
    MODES: MODES,
    LADDER: LADDER,

    mode: MODES[1],
    playerCount: 1,
    stagesCompleted: 0,
    /* Eigene Uhr statt Engine.time: über Stages hinweg läuft sie weiter,
       beim Betreten des Bazaars aber nicht. */
    runTime: 0,

    coeff: 1,
    enemyLevel: 1,
    tierIndex: 0,
    tierName: 'Easy',
    /* Anteil innerhalb der laufenden Stufe, für den Balken. */
    tierProgress: 0,

    reset(modeId) {
      Difficulty.mode = MODES.find((m) => m.id === modeId) || MODES[1];
      Difficulty.stagesCompleted = 0;
      Difficulty.runTime = 0;
      Difficulty.recompute();
    },

    get playerFactor() { return 1 + 0.3 * (Difficulty.playerCount - 1); },
    get timeFactor() {
      return 0.0506 * Difficulty.mode.value * Math.pow(Difficulty.playerCount, 0.2);
    },

    /* Nur aufrufen, während wirklich gespielt wird — pausiert die Uhr, pausiert
       auch die Schwierigkeit. */
    update(dt) {
      Difficulty.runTime += dt;
      Difficulty.recompute();
    },

    advanceStage() {
      Difficulty.stagesCompleted++;
      Difficulty.recompute();
    },

    recompute() {
      const pf = Difficulty.playerFactor;
      const minutes = Difficulty.runTime / 60;
      Difficulty.coeff = (pf + minutes * Difficulty.timeFactor)
                       * Math.pow(1.15, Difficulty.stagesCompleted);
      Difficulty.enemyLevel = Math.min(99, 1 + (Difficulty.coeff - pf) / 0.33);

      let i = 0;
      while (i + 1 < LADDER.length && Difficulty.enemyLevel >= LADDER[i + 1].level) i++;
      Difficulty.tierIndex = i;
      Difficulty.tierName = LADDER[i].name;
      const from = LADDER[i].level;
      const to = i + 1 < LADDER.length ? LADDER[i + 1].level : from + 24;
      Difficulty.tierProgress = U.clamp((Difficulty.enemyLevel - from) / (to - from), 0, 1);
    },

    /* Ganzzahlige Stufe, mit der Gegner erzeugt werden. */
    get spawnLevel() { return Math.max(1, Math.floor(Difficulty.enemyLevel)); },

    /* Preisformel der Interactables — steht schon hier, weil sie denselben
       Koeffizienten braucht. Stufe 4 benutzt sie. */
    priceOf(baseCost) { return Math.ceil(baseCost * Math.pow(Difficulty.coeff, 1.25)); }
  };

  ROR.Difficulty = Difficulty;
})(window.ROR);
