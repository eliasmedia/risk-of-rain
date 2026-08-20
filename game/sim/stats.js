/* game/sim/stats.js
   Aus Grundwerten, Stufe, Items und Buffs werden Endwerte.

   Die Datei kennt weder Items noch Buffs. Beide melden sich über
   `addModifier` an — dadurch kann Stufe 4 die Items nachliefern, ohne dass hier
   eine Zeile geändert werden muss.

   Zwei Wachstumsarten, wie im Original:
     'flat'  Survivors — feste Zuwächse je Stufe (110 +33, 12 +2.4 …)
     'ratio' Monster   — Anteile des Grundwerts (+30 % Leben, +20 % Schaden) */
(function (ROR) {
  'use strict';

  const modifiers = [];

  /* Zwischenspeicher, damit `recompute` kein Objekt je Aufruf erzeugt —
     das läuft bei vierzig Gegnern mehrmals pro Sekunde. */
  const OUT_KEYS = ['maxHealth', 'maxShield', 'damage', 'regen', 'armor',
                    'moveSpeed', 'attackSpeed', 'crit', 'critMult',
                    'cooldownScale', 'jumpCount', 'jumpPower', 'damageTaken',
                    'healMult', 'healCap'];

  function blank(out) {
    for (let i = 0; i < OUT_KEYS.length; i++) out[OUT_KEYS[i]] = 0;
    return out;
  }

  const Stats = {
    /* fn(body, out) darf `out` beliebig verändern. Reihenfolge: Buffs vor
       Items ist egal, solange alles additiv oder multiplikativ bleibt. */
    addModifier(fn) { modifiers.push(fn); },

    recompute(body) {
      const d = body.def;
      const L = body.level - 1;
      const out = body.stats || (body.stats = blank({}));

      if (d.growth === 'ratio') {
        out.maxHealth = d.health * (1 + 0.30 * L);
        out.damage = d.damage * (1 + 0.20 * L);
        out.regen = (d.regen || 0) * (1 + 0.20 * L);
        out.armor = d.armor || 0;
      } else {
        out.maxHealth = d.health + (d.healthPerLevel || 0) * L;
        out.damage = d.damage + (d.damagePerLevel || 0) * L;
        out.regen = (d.regen || 0) + (d.regenPerLevel || 0) * L;
        out.armor = (d.armor || 0) + (d.armorPerLevel || 0) * L;
      }

      out.maxShield = 0;
      out.moveSpeed = d.moveSpeed || 7;
      out.attackSpeed = 1;
      out.crit = d.crit || 0;          // in Prozent, Grundwert 1 bei Survivors
      out.critMult = 2;
      out.cooldownScale = 1;
      out.jumpCount = d.jumpCount || 1;
      out.jumpPower = 1;               // Vielfaches der Sprunggeschwindigkeit
      out.damageTaken = 1;             // Faktor für erlittenen Schaden
      out.healMult = 1;                // Rejuvenation Rack, Corpsebloom
      out.healCap = 0;                 // 0 = keine Obergrenze je Sekunde

      for (let i = 0; i < modifiers.length; i++) modifiers[i](body, out);

      if (out.maxHealth < 1) out.maxHealth = 1;
      if (out.moveSpeed < 0) out.moveSpeed = 0;
      if (out.attackSpeed < 0.1) out.attackSpeed = 0.1;

      return out;
    },

    /* Spielerstufe aus Erfahrung. Jede Stufe kostet das 1.55-fache der
       vorigen — deshalb ist Stufe 30 ohne Items unerreichbar. */
    levelFromExp(exp) {
      return Math.max(1, Math.floor(Math.log(1 + 0.0275 * exp) / Math.log(1.55) + 1));
    },

    /* Erfahrung, die für das Erreichen dieser Stufe nötig ist. */
    expForLevel(level) {
      return (Math.pow(1.55, level - 1) - 1) / 0.0275;
    }
  };

  ROR.Stats = Stats;
})(window.ROR);
