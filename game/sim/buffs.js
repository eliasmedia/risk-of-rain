/* game/sim/buffs.js
   Zeitlich begrenzte Zustände: Verlangsamung, Betäubung, Schadenspunkte
   über Zeit.

   Ein Buff ist ein Eintrag in `DEFS`. Er kann Werte verändern (`modify`),
   regelmäßig Schaden austeilen (`dot`) oder einfach nur da sein und von
   anderem Code abgefragt werden. Mehrfach anwendbare Buffs stapeln, jeder
   Stapel hat eine eigene Restzeit.

   Die Schadensmarken der Items (Bluten, Brennen) kommen in Stufe 4 dazu —
   die Maschinerie dafür steht hier schon. */
(function (ROR) {
  'use strict';

  const DEFS = {
    /* Betäubung: keine Bewegung, keine Fähigkeiten. */
    stun: {
      name: 'Betäubt', color: 0xffe066, stacks: false,
      modify(body, out) { out.moveSpeed = 0; }
    },
    /* Chronobauble und Verwandte. -60 % Bewegung. */
    slow60: {
      name: 'Verlangsamt', color: 0x7ec8ff, stacks: false,
      modify(body, out) { out.moveSpeed *= 0.4; }
    },
    /* Während Suppressive Fire steht man fast still — das ist der Preis
       für sechs Schuss, die alles betäuben. */
    suppressing: {
      name: 'Sperrfeuer', color: 0xffc46b, stacks: false, hidden: true,
      modify(body, out) { out.moveSpeed *= 0.4; }
    },
    /* Sprintzustand des Spielers — als Buff geführt, damit Items ihn später
       abfragen können (Red Whip, Energy Drink …). */
    sprinting: {
      name: 'Sprint', color: 0xffffff, stacks: false, hidden: true
    }
  };

  function entryOf(body, id) {
    const list = body.buffs;
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  const Buffs = {
    DEFS: DEFS,

    /* duration <= 0 bedeutet: dauerhaft, bis `clear` es entfernt. */
    apply(body, id, duration, amount) {
      const def = DEFS[id];
      if (!def || !body.alive) return;
      let e = entryOf(body, id);
      if (!e) {
        e = { id: id, def: def, time: 0, count: 0, tick: 0, source: null };
        body.buffs.push(e);
      }
      if (def.stacks) e.count++;
      else e.count = 1;
      // Die längere Restzeit gewinnt; ein schwacher Nachschlag darf einen
      // langen Zustand nicht verkürzen.
      e.time = duration <= 0 ? Infinity : Math.max(e.time, duration);
      if (amount !== undefined) e.amount = amount;
      body.statsDirty = true;
    },

    clear(body, id) {
      const list = body.buffs;
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].id === id) { list.splice(i, 1); body.statsDirty = true; }
      }
    },

    has(body, id) { return entryOf(body, id) !== null; },
    count(body, id) { const e = entryOf(body, id); return e ? e.count : 0; },

    update(body, dt) {
      const list = body.buffs;
      for (let i = list.length - 1; i >= 0; i--) {
        const e = list[i];
        if (e.def.dot) {
          e.tick -= dt;
          if (e.tick <= 0) {
            e.tick += e.def.dot.interval;
            e.def.dot.apply(body, e);
          }
        }
        if (e.time === Infinity) continue;
        e.time -= dt;
        if (e.time <= 0) { list.splice(i, 1); body.statsDirty = true; }
      }
    }
  };

  /* Wertwirkung aller Buffs — als Modifikator bei den Werten angemeldet,
     damit `stats.js` nichts von Buffs wissen muss. */
  ROR.Stats.addModifier(function (body, out) {
    const list = body.buffs;
    for (let i = 0; i < list.length; i++) {
      if (list[i].def.modify) list[i].def.modify(body, out, list[i]);
    }
  });

  ROR.Buffs = Buffs;
})(window.ROR);
