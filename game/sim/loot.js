/* game/sim/loot.js
   Was aus einer Kiste fällt — und wie es beim Spieler ankommt.

   Die Wahrscheinlichkeiten stammen aus dem Wiki der Vorlage:
     Kiste            79.2 % weiß · 19.8 % grün · 0.99 % rot
     Große Kiste      80 % grün · 20 % rot
     Legendäre Kiste  100 % rot
     Schrein d. Zufalls  45 % nichts · 36 % weiß · 9 % grün · 1 % rot · 9 % Ausrüstung

   Gezogen wird mit `Items.roll`, damit das 57 Leaf Clover auch hier greift:
   Glück ist in der Vorlage kein Bonus auf die Chance, sondern ein zweiter
   Wurf — deshalb wird die Tabelle bei Misserfolg schlicht noch einmal
   befragt.

   Gefundene Items fallen als Kugel heraus und müssen aufgesammelt werden.
   Das ist kein Beiwerk: der Moment zwischen „Kiste offen" und „Item da" ist
   der, in dem man in der Vorlage nachschaut, was man bekommen hat. */
(function (ROR) {
  'use strict';

  const U = ROR.Util;
  const GRAVITY = 22;
  const PICKUP_RADIUS = 3.6;   // großzügig: man soll nicht auf der Kiste stehen müssen

  const TIER_COLOR = {
    common: 0xdfe4e8, uncommon: 0x6fd36f, legendary: 0xe2564a,
    boss: 0xf2c14e, lunar: 0x7ec8ff, equipment: 0xff8a3a
  };

  const CHEST = [['common', 0.792], ['uncommon', 0.198], ['legendary', 0.0099]];
  const LARGE = [['uncommon', 0.8], ['legendary', 0.2]];
  const LEGEND = [['legendary', 1]];
  const SHRINE = [['fail', 0.45], ['common', 0.36], ['uncommon', 0.09],
                  ['equipment', 0.09], ['legendary', 0.01]];

  const drops = [];
  const _z = new THREE.Vector3();
  let group = null;

  function pickTier(table, luck) {
    // Glück: bei einem Fehlschlag darf noch einmal gezogen werden.
    for (let versuch = 0; versuch <= luck; versuch++) {
      let roll = U.chaos.next();
      let total = 0;
      for (let i = 0; i < table.length; i++) total += table[i][1];
      roll *= total;
      for (let i = 0; i < table.length; i++) {
        roll -= table[i][1];
        if (roll <= 0) {
          if (table[i][0] === 'fail' && versuch < luck) break;   // noch ein Versuch
          return table[i][0] === 'fail' ? null : table[i][0];
        }
      }
    }
    return null;
  }

  const Loot = {
    CHEST: CHEST, LARGE: LARGE, LEGEND: LEGEND, SHRINE: SHRINE,
    KEY_TABLE: CHEST,
    TIER_COLOR: TIER_COLOR,

    init() {
      Loot.clear();
      group = new THREE.Group();
      group.name = 'drops';
      ROR.Engine.scene.add(group);
    },

    clear() {
      if (group) {
        ROR.Engine.scene.remove(group);
        group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      }
      group = null;
      drops.length = 0;
    },

    randomItem(tier) {
      const pool = ROR.Items.ofTier(tier);
      return pool.length ? U.chaos.pick(pool) : null;
    },

    /* Zieht Stufe und Item, legt die Kugel an die Stelle. */
    dropFrom(table, position, body) {
      const tier = pickTier(table, ROR.Items.luck(body || ROR.Game.player.body));
      if (!tier) return null;
      const def = Loot.randomItem(tier);
      if (!def) return null;
      Loot.drop(position, def);
      return def;
    },

    /* Ohne Kugel direkt ins Inventar — für Rusted Key und Belohnungen. */
    grantRandom(body, table) {
      const tier = pickTier(table, ROR.Items.luck(body));
      if (!tier) return null;
      const def = Loot.randomItem(tier);
      if (def) Loot.give(body, def);
      return def;
    },

    /* Mit dem Artefakt Command wird aus dem Fund eine Entscheidung: das Spiel
       hält an und bietet drei Items derselben Stufe an. Ohne das Artefakt
       geht es direkt durch. */
    give(body, def) {
      if (ROR.Artifacts.on('command') && body.team === ROR.Body.PLAYER
          && ROR.Menus && !def.scrap) {
        ROR.Menus.chooseItem(def.tier, function (gewaehlt) {
          Loot.grant(body, gewaehlt || def);
        });
        return;
      }
      Loot.grant(body, def);
    },

    grant(body, def) {
      if (def.tier === 'equipment') ROR.Items.equip(body, def.id);
      else ROR.Items.give(body, def.id, 1);
      ROR.HUD && ROR.HUD.itemToast(def);
    },

    /* Die Enthüllung: das Item steigt aus der Kiste auf, dreht sich einen
       Moment in Augenhöhe — lange genug, dass man es erkennt — und springt
       dann auf die Figur, sobald man nahe genug ist. Genau dieser Moment
       zwischen „Kiste offen" und „Item da" ist in der Vorlage der, in dem man
       hinschaut. */
    drop(position, def) {
      if (!group) Loot.init();
      const mesh = ROR.Attire.pickupModel(def);
      mesh.position.copy(position).setY(position.y + 0.9);
      group.add(mesh);

      drops.push({
        def: def, mesh: mesh,
        phase: 'steigt',
        start: mesh.position.clone(),
        hoehe: position.y + 2.4,
        t: 0, life: 0
      });
      return mesh;
    },

    update(dt) {
      const stage = ROR.Stage.current;
      const p = ROR.Game.player;
      if (!stage || !p) return;

      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.life += dt;
        d.mesh.rotation.y += dt * 1.5;

        if (d.phase === 'steigt') {
          d.t += dt / 0.45;
          // Weich ausschwingen statt gleichmäßig steigen.
          const k = 1 - Math.pow(1 - Math.min(1, d.t), 3);
          d.mesh.position.y = U.lerp(d.start.y, d.hoehe, k);
          d.mesh.scale.setScalar(0.4 + 0.6 * k);
          if (d.t >= 1) { d.phase = 'schwebt'; d.t = 0; }

        } else if (d.phase === 'schwebt') {
          d.mesh.position.y = d.hoehe + Math.sin(d.life * 2.6) * 0.14;
          d.t += dt;
          // Nach einem halben Moment darf man es einsammeln.
          if (d.t > 0.35 && U.dist2(d.mesh.position.x, d.mesh.position.z,
                                    p.position.x, p.position.z) < PICKUP_RADIUS * PICKUP_RADIUS
              && Math.abs(d.mesh.position.y - p.position.y) < 5) {
            d.phase = 'fliegt';
            d.t = 0;
            d.von = d.mesh.position.clone();
          }

        } else {
          d.t += dt / 0.34;
          const k = Math.min(1, d.t);
          const ziel = _z.set(p.position.x, p.position.y + 1.1, p.position.z);
          d.mesh.position.lerpVectors(d.von, ziel, k * k);
          // Ein Bogen nach oben, damit es springt statt zu rutschen.
          d.mesh.position.y += Math.sin(k * Math.PI) * 1.1;
          d.mesh.scale.setScalar(1 - k * 0.55);
          if (k >= 1) {
            Loot.give(p.body, d.def);
            ROR.Projectiles.spark(ziel, TIER_COLOR[d.def.tier] || 0xffffff, 1.4);
            group.remove(d.mesh);
            drops.splice(i, 1);
          }
        }
      }
    },

    get pending() { return drops.length; }
  };

  ROR.Loot = Loot;
})(window.ROR);
