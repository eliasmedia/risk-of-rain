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
      name: 'Stunned', color: 0xffe066, stacks: false,
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
    woodsprite: {
      name: 'Waldgeist', color: 0x8fd07a, stacks: false,
      onTickHeal: true
    },
    jade: {
      name: 'Jade-Elefant', color: 0x6fd36f, stacks: false,
      modify(body, out) { out.armor += 500; }
    },
    /* Malachite: solange das anliegt, wirkt keine Heilung. */
    no_heal: {
      name: 'Heilung blockiert', color: 0x6fd36f, stacks: false,
      modify(body, out) { out.healMult = 0; }
    },
    /* Berzerker's Pauldron. */
    frenzy: {
      name: 'Raserei', color: 0xff6a3a, stacks: false,
      modify(body, out) { out.attackSpeed *= 1.5; out.moveSpeed *= 1.5; }
    },
    /* Warbanner — wirkt im Umkreis, hier vereinfacht auf den Träger. */
    warbanner: {
      name: 'Banner', color: 0xffd06a, stacks: false,
      modify(body, out) { out.attackSpeed *= 1.3; out.moveSpeed *= 1.3; }
    },
    /* Death Mark: das Ziel nimmt mehr Schaden. */
    death_mark: {
      name: 'Todesmal', color: 0xd070ff, stacks: false,
      modify(body, out) { out.damageTaken *= 1.5; }
    },
    /* Shattering Justice bricht die Rüstung. */
    armor_break: {
      name: 'Armor Broken', color: 0xffa030, stacks: false,
      modify(body, out) { out.armor -= 60; }
    },
    /* Predatory Instincts, bis zu drei Stapel. */
    predatory: {
      name: 'Beutetrieb', color: 0x8fd6e8, stacks: true,
      modify(body, out, e) { out.attackSpeed *= 1 + 0.12 * Math.min(3, e.count); }
    },
    /* Unstable Tesla Coil ist die Hälfte der Zeit aus. */
    tesla: { name: 'Teslafeld', color: 0x9fe4ff, stacks: false, hidden: true },
    /* Red Whip wirkt nur außerhalb des Kampfes. */
    outOfCombat: { name: 'Ungesehen', color: 0xffffff, stacks: false, hidden: true },
    /* Ocular HUD. */
    ocular: {
      name: 'Ocular HUD', color: 0xff4a6a, stacks: false,
      modify(body, out) { out.crit = 100; }
    },
    /* Sprintzustand des Spielers — als Buff geführt, damit Items ihn später
       abfragen können (Red Whip, Energy Drink …). */
    sprinting: {
      name: 'Sprint', color: 0xffffff, stacks: false, hidden: true
    }
  };

  /* Schadensmarken (Bluten, Brennen) laufen neben den Buffs in `body.dots`.
     Sie brauchen je Anwendung einen eigenen Eintrag, weil jede ihren eigenen
     Verursacher und ihren eigenen Schaden je Takt mitbringt — ein gestapelter
     Buff könnte das nicht abbilden. */
  const DOTS = {
    bleed: { name: 'Blutung', color: 0xd04040, interval: 0.25 },
    burn:  { name: 'Brennen', color: 0xff7a30, interval: 0.25 }
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

    DOTS: DOTS,

    /* `total` ist der Gesamtschaden über die volle Dauer, nicht je Takt —
       so stehen die Werte im Wiki und so lassen sie sich vergleichen. */
    applyDot(victim, id, attacker, total, duration) {
      const def = DOTS[id];
      if (!def || !victim || !victim.alive) return;
      if (!victim.dots) victim.dots = [];
      const ticks = Math.max(1, Math.round(duration / def.interval));
      victim.dots.push({
        id: id, def: def, attacker: attacker,
        perTick: total / ticks, interval: def.interval,
        timer: def.interval, left: duration
      });
    },

    hasDot(body, id) {
      const d = body.dots;
      if (!d) return false;
      for (let i = 0; i < d.length; i++) if (d[i].id === id) return true;
      return false;
    },

    updateDots(body, dt) {
      const d = body.dots;
      if (!d || !d.length) return;
      for (let i = d.length - 1; i >= 0; i--) {
        const t = d[i];
        t.left -= dt;
        t.timer -= dt;
        if (t.timer <= 0) {
          t.timer += t.interval;
          ROR.Damage.deal({
            attacker: t.attacker, victim: body, flat: t.perTick,
            type: 'dot', proc: 0, crit: false, ignoreArmor: true, silent: false
          });
          if (!body.alive) { d.length = 0; return; }
        }
        if (t.left <= 0) d.splice(i, 1);
      }
    },

    update(body, dt) {
      Buffs.updateDots(body, dt);
      const list = body.buffs;
      for (let i = list.length - 1; i >= 0; i--) {
        const e = list[i];
        if (e.def.onTickHeal) ROR.Items.heal(body, body.stats.maxHealth * 0.015 * dt);
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
