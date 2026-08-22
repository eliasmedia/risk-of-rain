/* game/data/elites.js
   Elite-Affixe — dieselben Gegner, nur mit einer zusätzlichen Regel.

   Das ist der Grund, warum sich die Vorlage im Loop noch einmal ändert: ein
   Beetle bleibt ein Beetle, aber ein *Blazing* Beetle zündet einen an, und ein
   *Malachite* Beetle verhindert, dass man sich heilt. Der Director entscheidet
   das über den Preis: eine Elite-Stufe kostet das Sechsfache (Stufe 1) oder
   das Sechsunddreißigfache (Stufe 2) des Gegners. Deshalb kommen sie erst,
   wenn genug Credits da sind — und dann alle auf einmal.

   Kostenfaktoren stammen aus der Directors-Seite des Wikis. Leben und Schaden
   nennt die Wiki-Seite nicht; die hier verwendeten Werte (×4/×2 für Stufe 1,
   ×18/×6 für Stufe 2) sind die in der Gemeinschaft dokumentierten. */
(function (ROR) {
  'use strict';

  const U = ROR.Util;
  const V = new THREE.Vector3();

  function mitte(b, out) {
    return (out || V).set(b.position.x, b.position.y + b.height * 0.5, b.position.z);
  }

  ROR.Data.Elites = [
    {
      id: 'blazing', name: 'Blazing', tier: 1, cost: 6,
      health: 4, damage: 2, color: 0xff6a20, glow: 0xffb060,
      desc: 'Setzt in Brand und hinterlässt eine Feuerspur.',
      /* Der Brand ist an den Angriff gekoppelt, nicht an eine eigene
         Fähigkeit — dadurch wirkt er bei jeder Gegnerart. */
      onHit(m, opfer) {
        ROR.Buffs.applyDot(opfer, 'burn', m.body, m.body.stats.damage * 1.2, 3);
      },
      onInterval(m, dt) {
        m._spur = (m._spur || 0) - dt;
        if (m._spur > 0) return;
        m._spur = 0.6;
        ROR.Projectiles.spark(m.model.position, 0xff6a20, 1.1);
      }
    },

    {
      id: 'overloading', name: 'Overloading', tier: 1, cost: 6,
      health: 4, damage: 2, color: 0x5a8aff, glow: 0xb0d0ff,
      shieldInsteadOfHealth: true,
      desc: 'Trägt Schild statt Leben und schlägt mit Blitzen um sich.',
      onHit(m, opfer) {
        // Ein Nachschlag im Umkreis: wer nahe steht, bekommt ihn mit.
        ROR.Damage.explode({
          attacker: m.body, team: m.body.team, position: mitte(opfer, V).clone(),
          radius: 5, coefficient: 0.6, proc: 0
        });
        ROR.Projectiles.spark(mitte(opfer, V), 0x9fc8ff, 1.6);
      }
    },

    {
      id: 'glacial', name: 'Glacial', tier: 1, cost: 6,
      health: 4, damage: 2, color: 0x9fe4ff, glow: 0xdff2ff,
      desc: 'Verlangsamt und zerspringt beim Tod in einer Eisexplosion.',
      onHit(m, opfer) { ROR.Buffs.apply(opfer, 'slow60', 2.5); },
      onDeath(m) {
        ROR.Damage.explode({
          attacker: m.body, team: m.body.team, position: m.model.position.clone(),
          radius: 9, coefficient: 2.0, proc: 0
        });
        const nah = ROR.Projectiles.enemiesInRange(m.model.position, 9, m.body.team, 8);
        for (let i = 0; i < nah.length; i++) ROR.Buffs.apply(nah[i], 'slow60', 3);
        ROR.Projectiles.spark(m.model.position, 0xdff2ff, 5);
      }
    },

    {
      id: 'malachite', name: 'Malachite', tier: 2, cost: 36,
      health: 18, damage: 6, color: 0x6fd36f, glow: 0xc0ffa0,
      desc: 'Verhindert Heilung und speit Stachelkugeln.',
      onHit(m, opfer) { ROR.Buffs.apply(opfer, 'no_heal', 8); },
      onInterval(m, dt) {
        m._stachel = (m._stachel || U.chaos.range(2, 5)) - dt;
        if (m._stachel > 0) return;
        m._stachel = 6;
        const p = ROR.Game.player;
        if (!p || m.model.position.distanceTo(p.position) > 40) return;
        for (let i = 0; i < 3; i++) {
          const a = U.chaos.next() * U.TAU;
          ROR.Projectiles.spawn({
            attacker: m.body, team: m.body.team,
            origin: mitte(m.body, V).clone(),
            dir: new THREE.Vector3(Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5).normalize(),
            speed: 14, life: 5, radius: 0.4, coefficient: 0.5, proc: 0.3,
            gravity: 12, color: 0x8fe07a
          });
        }
      }
    },

    {
      id: 'celestine', name: 'Celestine', tier: 2, cost: 36,
      health: 18, damage: 6, color: 0xe8e0c0, glow: 0xfff4d0,
      desc: 'Heilt seine Umgebung und blinzelt aus dem Beschuss.',
      onInterval(m, dt) {
        m._heil = (m._heil || 0) - dt;
        if (m._heil <= 0) {
          m._heil = 1.5;
          // Heilt alles im eigenen Team — ein Celestine macht eine Gruppe zäh.
          const alle = ROR.Body.all;
          for (let i = 0; i < alle.length; i++) {
            const b = alle[i];
            if (!b.alive || b.team !== m.body.team) continue;
            if (b.position.distanceTo(m.model.position) > 25) continue;
            b.heal(b.stats.maxHealth * 0.03);
          }
          ROR.Projectiles.spark(m.model.position, 0xfff4d0, 2.2);
        }
        // Nach einem Treffer versetzt er sich ein Stück.
        m._blink = (m._blink || 0) - dt;
        if (m.body.hitFlash > 0.1 && m._blink <= 0) {
          m._blink = 4;
          const a = U.chaos.next() * U.TAU;
          const x = m.model.position.x + Math.cos(a) * 9;
          const z = m.model.position.z + Math.sin(a) * 9;
          const stage = ROR.Stage.current;
          if (stage && stage.terrain.isWalkable(x, z, 0.5)) {
            ROR.Projectiles.spark(m.model.position, 0xfff4d0, 1.8);
            m.model.position.set(x, stage.terrain.heightAt(x, z)
              + (m.def.flying ? m.def.hoverHeight : 0), z);
            ROR.Projectiles.spark(m.model.position, 0xfff4d0, 1.8);
          }
        }
      }
    }
  ];

  ROR.Data.elite = function (id) {
    const l = ROR.Data.Elites;
    for (let i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  };

  ROR.Data.elitesOfTier = function (tier) {
    return ROR.Data.Elites.filter(function (e) { return e.tier === tier; });
  };
})(window.ROR);
