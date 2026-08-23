/* game/save.js
   Was einen Durchlauf überdauert.

   Alles liegt unter einem eigenen Präfix (`ror2:`) im localStorage, damit
   nichts mit anderen Spielen auf derselben Domain kollidiert. Gespeichert
   wird gedrosselt — nicht bei jedem Kill, sondern höchstens jede Sekunde.
   Sonst schriebe man bei vierzig Gegnern hundertmal je Minute in den
   Speicher, und das ist auf schwachen Geräten spürbar.

   Was *nicht* gespeichert wird: der laufende Durchlauf. Ein Roguelike, das
   man mitten im Kampf speichern kann, ist keins. */
(function (ROR) {
  'use strict';

  const PRAEFIX = 'ror2:';
  const VERSION = 1;

  /* Freischaltbedingungen. Sie stehen hier statt im Menü, damit die
     Bedingung und ihre Prüfung an einer Stelle liegen. */
  const BEDINGUNGEN = [
    { id: 'commando',  frei: true,  text: 'Von Anfang an dabei.' },
    { id: 'huntress',  text: 'Reach the third stage in a single run.',
      pruef: (s, lauf) => lauf.stages >= 3 },
    { id: 'mult',      text: 'Reach the fifth stage in a single run.',
      pruef: (s, lauf) => lauf.stages >= 5 },
    { id: 'engineer',  text: 'Complete 20 stages in total.',
      pruef: (s) => s.stagesGesamt >= 20 },
    { id: 'artificer', text: 'Collect 10 lunar coins in total.',
      pruef: (s) => s.muenzenGesamt >= 10 },
    { id: 'mercenary', text: 'Besiege Mithrix.',
      pruef: (s, lauf) => !!lauf.sieg }
  ];

  function leer() {
    return {
      version: VERSION,
      alleFrei: true,          // Vorgabe: nichts ist gesperrt
      frei: { commando: true },
      stats: {
        laeufe: 0, siege: 0, tode: 0,
        kills: 0, stagesGesamt: 0, muenzenGesamt: 0,
        zeitGesamt: 0, besteStage: 0, besteZeit: 0, hoechsteStufe: 0
      },
      logbuch: { items: {}, gegner: {} },
      rekorde: []
    };
  }

  let daten = leer();
  let schmutzig = false;
  let letzteSicherung = 0;

  const Save = {
    BEDINGUNGEN: BEDINGUNGEN,
    get data() { return daten; },

    load() {
      try {
        const roh = localStorage.getItem(PRAEFIX + 'save');
        if (roh) {
          const g = JSON.parse(roh);
          // Bei einem Versionssprung lieber neu anfangen als raten.
          if (g && g.version === VERSION) daten = Object.assign(leer(), g);
        }
      } catch (e) {
        console.warn('[ROR] Save data unreadable, starting fresh:', e.message);
      }
      return daten;
    },

    save(sofort) {
      schmutzig = true;
      const jetzt = Date.now();
      if (!sofort && jetzt - letzteSicherung < 1000) return;
      letzteSicherung = jetzt;
      schmutzig = false;
      try {
        localStorage.setItem(PRAEFIX + 'save', JSON.stringify(daten));
      } catch (e) {
        console.warn('[ROR] Save data not writable:', e.message);
      }
    },

    tick() { if (schmutzig) Save.save(); },

    reset() {
      daten = leer();
      Save.save(true);
    },

    /* ------------------------------------------------- Freischaltungen */

    istFrei(id) {
      return daten.alleFrei || !!daten.frei[id];
    },

    bedingung(id) {
      for (let i = 0; i < BEDINGUNGEN.length; i++) if (BEDINGUNGEN[i].id === id) return BEDINGUNGEN[i];
      return null;
    },

    setAlleFrei(an) { daten.alleFrei = !!an; Save.save(true); },

    /* Wird am Ende eines Durchlaufs geprüft. `lauf` ist die Bilanz. */
    pruefeFreischaltungen(lauf) {
      const neu = [];
      for (let i = 0; i < BEDINGUNGEN.length; i++) {
        const b = BEDINGUNGEN[i];
        if (daten.frei[b.id]) continue;
        if (b.frei || (b.pruef && b.pruef(daten.stats, lauf))) {
          daten.frei[b.id] = true;
          neu.push(b.id);
        }
      }
      if (neu.length) Save.save(true);
      return neu;
    },

    /* ------------------------------------------------------- Logbuch */

    notiereItem(id) {
      if (!daten.logbuch.items[id]) { daten.logbuch.items[id] = 0; }
      daten.logbuch.items[id]++;
      Save.save();
    },

    notiereGegner(id) {
      if (!daten.logbuch.gegner[id]) daten.logbuch.gegner[id] = 0;
      daten.logbuch.gegner[id]++;
      daten.stats.kills++;
      Save.save();
    },

    kennt(art, id) { return (daten.logbuch[art][id] || 0) > 0; },

    /* --------------------------------------------------------- Bilanz */

    notiereLauf(lauf) {
      const s = daten.stats;
      s.laeufe++;
      if (lauf.sieg) s.siege++; else s.tode++;
      s.stagesGesamt += lauf.stages;
      s.zeitGesamt += lauf.zeit;
      s.muenzenGesamt += lauf.muenzen;
      if (lauf.stages > s.besteStage) s.besteStage = lauf.stages;
      if (lauf.stufe > s.hoechsteStufe) s.hoechsteStufe = lauf.stufe;
      if (lauf.sieg && (!s.besteZeit || lauf.zeit < s.besteZeit)) s.besteZeit = lauf.zeit;

      daten.rekorde.unshift({
        figur: lauf.figur, sieg: !!lauf.sieg, zeit: Math.round(lauf.zeit),
        stages: lauf.stages, stufe: lauf.stufe, kills: lauf.kills,
        items: lauf.items, schwer: lauf.schwer, datum: Date.now()
      });
      // Nur die letzten zwanzig behalten — der Rest interessiert niemanden.
      if (daten.rekorde.length > 20) daten.rekorde.length = 20;

      const neu = Save.pruefeFreischaltungen(lauf);
      Save.save(true);
      return neu;
    }
  };

  ROR.Save = Save;
})(window.ROR);
