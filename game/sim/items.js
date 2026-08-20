/* game/sim/items.js
   Inventar und Auslöser.

   Ein Item ist ein Satz von Hooks in data/items.js — diese Datei ruft sie auf.
   Kein Kampfcode kennt ein einzelnes Item, und ein neues Item ist deshalb ein
   Dateneintrag und kein Sonderfall.

   Damit das bei sechs Schuss je Sekunde und vierzig Gegnern nicht teuer wird,
   werden die Hooks je Body *vorsortiert*: wer kein `onHit` besitzt, taucht in
   der onHit-Liste gar nicht erst auf. Die Liste wird nur neu gebaut, wenn sich
   das Inventar ändert.

   Die drei Stapelkurven der Vorlage:
     linear        n × wert            Soldier's Syringe
     hyperbolisch  1 − 1/(1 + n×x)     Tougher Times, nähert sich 100 % an
     exponentiell  1 − (1−x)^n         Old Guillotine
   Dazu kommt „multiplikativ" für Dinge wie Alien Head (0.75^n).             */
(function (ROR) {
  'use strict';

  const U = ROR.Util;
  const HOOKS = ['onHit', 'onKill', 'onDamaged', 'onInterval', 'onStageStart',
                 'onHealed', 'onLevelUp', 'onKilled', 'damageMod', 'onIncoming'];

  let byId = null;

  function defs() {
    if (!byId) {
      byId = {};
      const list = ROR.Data.Items || [];
      for (let i = 0; i < list.length; i++) byId[list[i].id] = list[i];
    }
    return byId;
  }

  function rebuild(body) {
    const d = defs();
    const h = {};
    for (let k = 0; k < HOOKS.length; k++) h[HOOKS[k]] = [];
    for (const id in body.items) {
      const def = d[id];
      const n = body.items[id];
      if (!def || n <= 0) continue;
      for (let k = 0; k < HOOKS.length; k++) {
        if (def[HOOKS[k]]) h[HOOKS[k]].push({ def: def, n: n });
      }
    }
    body._hooks = h;
  }

  function fire(body, hook, a, b, c) {
    const h = body._hooks;
    if (!h) return;
    const list = h[hook];
    for (let i = 0; i < list.length; i++) list[i].def[hook](body, list[i].n, a, b, c);
  }

  const Items = {
    /* ------------------------------------------------------ Stapelkurven */
    linear(value, n) { return value * n; },
    hyperbolic(x, n) { return 1 - 1 / (1 + x * n); },
    exponential(x, n) { return 1 - Math.pow(1 - x, n); },
    multiplicative(f, n) { return Math.pow(f, n); },

    def(id) { return defs()[id] || null; },
    all() { return ROR.Data.Items || []; },
    ofTier(tier) { return Items.all().filter((i) => i.tier === tier && !i.noDrop); },

    count(body, id) { return body.items[id] || 0; },
    has(body, id) { return (body.items[id] || 0) > 0; },

    give(body, id, n) {
      const def = defs()[id];
      if (!def) return null;
      body.items[id] = (body.items[id] || 0) + (n || 1);
      rebuild(body);
      body.statsDirty = true;
      ROR.Stats.recompute(body);
      body.statsDirty = false;
      if (def.onPickup) def.onPickup(body, body.items[id]);
      return def;
    },

    take(body, id, n) {
      if (!body.items[id]) return 0;
      const taken = Math.min(body.items[id], n || 1);
      body.items[id] -= taken;
      if (body.items[id] <= 0) delete body.items[id];
      rebuild(body);
      body.statsDirty = true;
      return taken;
    },

    /* Gesamtzahl der Items — für Anzeige und Bedingungen. */
    total(body) {
      let n = 0;
      for (const id in body.items) n += body.items[id];
      return n;
    },

    /* ------------------------------------------------------------ Glück */

    /* 57 Leaf Clover gibt zusätzliche Würfe: gelingt der erste nicht, wird
       noch einmal geworfen. Genau so funktioniert „Luck" in der Vorlage —
       es ist keine Erhöhung der Chance, sondern ein zweiter Versuch. */
    luck(body) { return body.items.clover ? body.items.clover : 0; },

    roll(body, chance) {
      if (chance <= 0) return false;
      const tries = 1 + Items.luck(body);
      for (let i = 0; i < tries; i++) if (U.chaos.next() < chance) return true;
      return false;
    },

    /* ------------------------------------------------------ Weiterleiten */

    fire: fire,
    rebuild: rebuild,

    /* Läuft je Simulationsschritt für den Spieler. */
    update(body, dt) {
      fire(body, 'onInterval', dt);
    },

    stageStart(body) { fire(body, 'onStageStart'); },

    /* Heilung, die *nicht* aus der Regeneration kommt. Nur sie füttert
       N'kuhana's Opinion — genau wie in der Vorlage. */
    heal(body, amount) {
      const got = body.heal(amount);
      if (got > 0) fire(body, 'onHealed', got);
      return got;
    },

    levelUp(body, level) { fire(body, 'onLevelUp', level); },
    healed(body, amount) { if (amount > 0) fire(body, 'onHealed', amount); },

    /* --------------------------------------------------------- Ausrüstung */

    equip(body, id) {
      const def = defs()[id];
      if (!def || def.tier !== 'equipment') return null;
      const old = body.equipment ? body.equipment.def.id : null;
      body.equipment = { def: def, cooldown: 0, charges: 1, maxCharges: 1 };
      ROR.Items.refreshEquipment(body);
      return old;
    },

    refreshEquipment(body) {
      if (!body.equipment) return;
      const cells = body.items.fuel_cell || 0;
      body.equipment.maxCharges = 1 + cells;
      // Fuel Cell verkürzt die Abklingzeit exponentiell, wie in der Vorlage.
      body.equipment.cdScale = Math.pow(0.85, cells)
        * (body.items.gesture ? 0.5 : 1);
      if (body.equipment.charges > body.equipment.maxCharges) {
        body.equipment.charges = body.equipment.maxCharges;
      }
    },

    updateEquipment(body, dt, wantUse) {
      const e = body.equipment;
      if (!e) return;
      if (e.charges < e.maxCharges) {
        e.cooldown -= dt;
        if (e.cooldown <= 0) { e.charges++; e.cooldown = e.def.cooldown * (e.cdScale || 1); }
      }
      // Gesture of the Drowned löst selbst aus — das ist der Nachteil.
      const forced = body.items.gesture > 0;
      if ((wantUse || forced) && e.charges > 0) {
        if (e.charges === e.maxCharges) e.cooldown = e.def.cooldown * (e.cdScale || 1);
        e.charges--;
        e.def.use(body);
      }
    }
  };

  /* Wertwirkung aller Items — als Modifikator angemeldet, damit stats.js
     nichts von Items weiß. Läuft nach den Buffs. */
  ROR.Stats.addModifier(function (body, out) {
    const d = defs();
    for (const id in body.items) {
      const def = d[id];
      if (def && def.stats) def.stats(body, out, body.items[id]);
    }
  });

  /* Trefferauslöser: die Proc-Kette. `proc` ist der Faktor des auslösenden
     Treffers — genau hier verhindert er, dass acht Schrotkugeln achtmal so
     oft auslösen wie ein einzelner Schuss. */
  ROR.Damage.addOnHit(function (info, result, proc) {
    const a = info.attacker;
    if (!a || !a._hooks || !result.amount) return;
    const list = a._hooks.onHit;
    for (let i = 0; i < list.length; i++) {
      list[i].def.onHit(a, list[i].n, info, result, proc);
    }
    const v = info.victim;
    if (v && v._hooks) {
      const dl = v._hooks.onDamaged;
      for (let i = 0; i < dl.length; i++) dl[i].def.onDamaged(v, dl[i].n, info, result);
    }
  });

  ROR.Damage.addOnKill(function (info, result) {
    const a = info.attacker;
    if (a && a._hooks) {
      const list = a._hooks.onKill;
      for (let i = 0; i < list.length; i++) list[i].def.onKill(a, list[i].n, info, result);
    }
    const v = info.victim;
    if (v && v._hooks) {
      const list = v._hooks.onKilled;
      for (let i = 0; i < list.length; i++) list[i].def.onKilled(v, list[i].n, info, result);
    }
  });

  ROR.Items = Items;
})(window.ROR);
