/* game/sim/damage.js
   Die Schadenspipeline. Jeder Treffer im Spiel läuft hier durch — Geschosse,
   Nahkampf, Schadenspunkte über Zeit, Sturz.

   Reihenfolge: Grundschaden → Entfernungsabfall → kritischer Treffer →
   Rüstung → Schild vor Leben → Anzeige → Trefferauslöser.

   Der **Proc-Coefficient** ist der Grund, warum diese Datei so früh entsteht.
   Jeder Treffer trägt einen Faktor mit: Nahkampf 1.0, Dauerfeuer 0.2,
   Flächenschaden 0.0. On-Hit-Items würfeln mit `chance × proc` statt mit
   `chance`. Ohne das würde eine Schrotladung aus acht Kugeln achtmal so oft
   auslösen wie ein einzelner Schuss, und Ukulele, AtG und Gasoline wären in
   Stufe 4 nicht mehr auszubalancieren. */
(function (ROR) {
  'use strict';

  const U = ROR.Util;
  const onHitHooks = [];
  const onKillHooks = [];
  const _pos = new THREE.Vector3();

  /* Entfernungsabfall wie im Original. */
  const FALLOFF = {
    none() { return 1; },
    /* Volle Wirkung bis 25 m, danach linear auf die Hälfte bei 60 m. */
    standard(d) { return U.clamp(1 - (d - 25) / 70, 0.5, 1); },
    /* Schrot: schon ab dem ersten Meter schwächer, halbe Wirkung ab 25 m. */
    buckshot(d) { return U.clamp(1 - d / 50, 0.5, 1); }
  };

  /* Die Rüstungsformel ist nicht linear — deshalb sind die ersten Punkte so
     viel wert und negative Rüstung so gefährlich. */
  function armorFactor(armor) {
    if (armor >= 0) return 1 - armor / (armor + 100);
    return 2 - 100 / (100 - armor);
  }

  const Damage = {
    FALLOFF: FALLOFF,
    armorFactor: armorFactor,

    /* fn(info, result) — wird nach jedem *direkten* Treffer aufgerufen,
       nicht bei Schaden über Zeit. Items hängen sich hier ein. */
    addOnHit(fn) { onHitHooks.push(fn); },
    addOnKill(fn) { onKillHooks.push(fn); },

    /* info:
         attacker      Body oder null
         victim        Body
         coefficient   1.0 = 100 % des Angriffsschadens
         flat          statt attacker.stats.damage, für Sturz und Umgebung
         proc          Proc-Coefficient, Vorgabe 1
         crit          true/false erzwingen, sonst wird gewürfelt
         distance      für den Entfernungsabfall
         falloff       Schlüssel aus FALLOFF, Vorgabe 'none'
         position      wo die Schadenszahl erscheint (Vector3)
         ignoreArmor   für Anteilsschaden
         silent        keine Schadenszahl                                   */
    deal(info) {
      const v = info.victim;
      if (!v || !v.alive) return null;

      const result = { amount: 0, crit: false, killed: false, blocked: false };

      if (v.invulnerable > 0 && !info.ignoreInvulnerable) {
        result.blocked = true;
        if (!info.silent) Damage.number(info.position || v.position, 'immun', 'block');
        return result;
      }

      const a = info.attacker;
      let dmg = info.flat !== undefined
        ? info.flat
        : (a && a.stats ? a.stats.damage : 0) * (info.coefficient === undefined ? 1 : info.coefficient);

      if (info.falloff && info.distance !== undefined) {
        dmg *= (FALLOFF[info.falloff] || FALLOFF.none)(info.distance);
      }

      /* Item-Schadensfaktoren, die vom *Ziel* abhängen und deshalb nicht in
         die Werte passen: Crowbar (volles Leben), Armor-Piercing Rounds
         (Bosse), Focus Crystal (Nähe). Sie greifen vor dem kritischen Treffer,
         damit ein Krit sie mitverdoppelt. */
      if (a && a._hooks && a._hooks.damageMod.length) {
        const dl = a._hooks.damageMod;
        for (let i = 0; i < dl.length; i++) dmg *= dl[i].def.damageMod(a, dl[i].n, info, v);
      }

      let crit = info.crit;
      if (crit === undefined && a && a.stats) crit = U.chaos.next() * 100 < a.stats.crit;
      if (crit) dmg *= (a && a.stats ? a.stats.critMult : 2);

      if (!info.ignoreArmor) dmg *= armorFactor(v.stats.armor);
      dmg *= v.stats.damageTaken;

      /* Items des *Opfers*, die eingehenden Schaden abwehren: Tougher Times
         blockt ganz, Repulsion Armor Plate zieht einen festen Betrag ab.
         Beides läuft nach der Rüstung, damit die Reihenfolge der Vorlage
         erhalten bleibt. */
      if (v._hooks && v._hooks.onIncoming.length) {
        const st = { amount: dmg, blocked: false };
        const il = v._hooks.onIncoming;
        for (let i = 0; i < il.length; i++) il[i].def.onIncoming(v, il[i].n, info, st);
        if (st.blocked) {
          result.blocked = true;
          if (!info.silent) Damage.number(info.position || v.position, 'block', 'block');
          return result;
        }
        dmg = st.amount;
      }
      if (dmg < 0) dmg = 0;

      v.applyDamage(dmg);
      result.amount = dmg;
      result.crit = !!crit;
      result.killed = !v.alive;

      if (!info.silent) {
        const p = info.position || v.center(_pos);
        Damage.number(p, Math.round(dmg), v.team === ROR.Body.PLAYER ? 'taken' : (crit ? 'crit' : 'hit'));
      }
      if (v.onDamaged) v.onDamaged(v, info, result);

      if (info.type !== 'dot') {
        const proc = info.proc === undefined ? 1 : info.proc;
        if (proc > 0) for (let i = 0; i < onHitHooks.length; i++) onHitHooks[i](info, result, proc);
      }
      if (result.killed) for (let i = 0; i < onKillHooks.length; i++) onKillHooks[i](info, result);

      return result;
    },

    /* Flächenschaden. `proc` sollte hier klein sein — im Original tragen
       Explosionen bewusst wenig zur Auslösekette bei. */
    explode(opts) {
      const found = ROR.Body.enemiesNear(opts.position, opts.radius, opts.team, []);
      for (let i = 0; i < found.length; i++) {
        Damage.deal({
          attacker: opts.attacker, victim: found[i],
          coefficient: opts.coefficient, flat: opts.flat,
          proc: opts.proc === undefined ? 0 : opts.proc,
          crit: opts.crit, position: found[i].center(new THREE.Vector3())
        });
      }
      return found;
    },

    /* Wird von der Oberfläche überschrieben, sobald sie bereit ist. */
    number(position, text, kind) {
      if (ROR.HUD && ROR.HUD.damageNumber) ROR.HUD.damageNumber(position, text, kind);
    }
  };

  ROR.Damage = Damage;
})(window.ROR);
