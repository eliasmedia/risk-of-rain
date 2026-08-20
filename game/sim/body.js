/* game/sim/body.js
   Alles, was Schaden nehmen kann, ist ein Body: Spieler, Gegner, Drohnen,
   Trainingspuppen. Der Body hält Leben, Schild, Zugehörigkeit und Werte —
   die zeichnende Figur hängt nur daran.

   Die Trefferform ist überall dieselbe: eine stehende Kapsel von `position.y`
   bis `position.y + height` mit Radius `radius`. Ein Modell mit Einzelteilen
   wäre genauer und würde jedes Geschoss teurer machen, ohne dass man den
   Unterschied merkt. */
(function (ROR) {
  'use strict';

  const U = ROR.Util;
  const all = [];

  const Body = {
    all: all,
    PLAYER: 'player',
    MONSTER: 'monster',
    NEUTRAL: 'neutral',

    create(opts) {
      const b = {
        def: opts.def,
        name: opts.name || opts.def.name,
        level: opts.level || 1,
        team: opts.team || Body.MONSTER,
        position: opts.position || new THREE.Vector3(),
        object: opts.object || null,
        radius: opts.radius || 0.5,
        height: opts.height || 1.8,
        stats: null,
        buffs: [],
        items: {},
        statsDirty: false,
        alive: true,
        invulnerable: 0,      // Restzeit der Unverwundbarkeit in Sekunden
        shield: 0,
        barrier: 0,           // verfällt von selbst, geht vor Schild verloren
        outOfCombat: 0,       // Sekunden seit dem letzten Treffer
        onDeath: opts.onDeath || null,
        onDamaged: opts.onDamaged || null,
        hitFlash: 0,

        setLevel(level) {
          const frac = b.stats ? b.health / b.stats.maxHealth : 1;
          b.level = level;
          ROR.Stats.recompute(b);
          b.health = b.stats.maxHealth * frac;
        },

        heal(amount) {
          if (!b.alive) return 0;
          const before = b.health;
          b.health = Math.min(b.stats.maxHealth, b.health + amount);
          return b.health - before;
        },

        /* Nur der Buchhaltungsteil. Wer *wie viel* Schaden macht, entscheidet
           sim/damage.js — hier wird er nur verrechnet. */
        applyDamage(amount) {
          if (!b.alive) return 0;
          let left = amount;
          if (b.barrier > 0) { const t = Math.min(b.barrier, left); b.barrier -= t; left -= t; }
          if (b.shield > 0) { const t = Math.min(b.shield, left); b.shield -= t; left -= t; }
          b.health -= left;
          b.outOfCombat = 0;
          b.hitFlash = 0.12;
          if (b.health <= 0) { b.health = 0; b.kill(); }
          return amount;
        },

        kill() {
          if (!b.alive) return;
          b.alive = false;
          if (b.onDeath) b.onDeath(b);
        },

        get healthFraction() { return b.stats ? b.health / b.stats.maxHealth : 0; },
        get combinedFraction() {
          if (!b.stats) return 0;
          return (b.health + b.shield + b.barrier) / b.stats.maxHealth;
        },

        /* Mittelpunkt der Trefferkapsel — das, worauf gezielt wird. */
        center(out) { return out.set(b.position.x, b.position.y + b.height * 0.5, b.position.z); },

        update(dt) {
          if (!b.alive) return;
          ROR.Buffs.update(b, dt);
          if (b.statsDirty) { ROR.Stats.recompute(b); b.statsDirty = false; }
          b.outOfCombat += dt;
          b.invulnerable = Math.max(0, b.invulnerable - dt);
          b.hitFlash = Math.max(0, b.hitFlash - dt);
          if (b.barrier > 0) b.barrier = Math.max(0, b.barrier - b.stats.maxHealth * 0.033 * dt);
          if (b.stats.regen > 0 && b.health < b.stats.maxHealth) b.heal(b.stats.regen * dt);
        },

        remove() {
          const i = all.indexOf(b);
          if (i >= 0) all.splice(i, 1);
        }
      };

      ROR.Stats.recompute(b);
      b.health = opts.health !== undefined ? opts.health : b.stats.maxHealth;
      b.shield = b.stats.maxShield;
      all.push(b);
      return b;
    },

    /* Feinde eines Teams im Umkreis. `out` wird geleert und wiederbenutzt. */
    enemiesNear(pos, radius, team, out) {
      out.length = 0;
      const r2 = radius * radius;
      for (let i = 0; i < all.length; i++) {
        const b = all[i];
        if (!b.alive || b.team === team || b.team === Body.NEUTRAL) continue;
        const dx = b.position.x - pos.x, dz = b.position.z - pos.z;
        const dy = b.position.y + b.height * 0.5 - pos.y;
        if (dx * dx + dy * dy + dz * dz <= r2) out.push(b);
      }
      return out;
    },

    /* Strahl gegen die stehende Kapsel. Liefert die Entfernung bis zum
       Eintritt oder -1. Gerechnet wird gegen die senkrechte Achse: erst der
       Zylinder, dann die Deckel als einfache Bereichsprüfung. */
    rayHit(b, ox, oy, oz, dx, dy, dz, maxDist) {
      const px = ox - b.position.x, pz = oz - b.position.z;
      const a = dx * dx + dz * dz;
      const r = b.radius;
      if (a < 1e-8) {
        // Senkrechter Schuss: trifft, wenn er innerhalb des Radius liegt.
        if (px * px + pz * pz > r * r) return -1;
        const t = dy > 0 ? (b.position.y - oy) / dy : (b.position.y + b.height - oy) / dy;
        return t >= 0 && t <= maxDist ? t : -1;
      }
      const bq = 2 * (px * dx + pz * dz);
      const cq = px * px + pz * pz - r * r;
      const disc = bq * bq - 4 * a * cq;
      if (disc < 0) return -1;
      const sq = Math.sqrt(disc);
      let t = (-bq - sq) / (2 * a);
      if (t < 0) t = (-bq + sq) / (2 * a);
      if (t < 0 || t > maxDist) return -1;
      const y = oy + dy * t;
      if (y < b.position.y || y > b.position.y + b.height) return -1;
      return t;
    },

    /* Nächster getroffener Body entlang eines Strahls. */
    raycast(origin, dir, maxDist, excludeTeam) {
      let best = null, bestT = maxDist;
      for (let i = 0; i < all.length; i++) {
        const b = all[i];
        if (!b.alive || b.team === excludeTeam) continue;
        const t = Body.rayHit(b, origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, bestT);
        if (t >= 0 && t < bestT) { bestT = t; best = b; }
      }
      return best ? { body: best, distance: bestT } : null;
    },

    updateAll(dt) {
      for (let i = all.length - 1; i >= 0; i--) {
        const b = all[i];
        b.update(dt);
        if (!b.alive && b.removeOnDeath) all.splice(i, 1);
      }
    },

    clear() { all.length = 0; }
  };

  ROR.Body = Body;
})(window.ROR);
