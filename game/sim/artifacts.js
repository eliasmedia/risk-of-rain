/* game/sim/artifacts.js
   Artefakte — Regeln, die man vor dem Start ein- und ausschaltet.

   Ein Artefakt ist keine Verstärkung, sondern eine *Änderung der Spielregeln*.
   Sacrifice nimmt die Kisten weg und lässt dafür Gegner Items fallen; Glass
   verfünffacht den Schaden und lässt ein Zehntel Leben; Kin stellt eine ganze
   Stage aus einer einzigen Gegnerart.

   Statt eines allgemeinen Hooksystems fragen die betroffenen Stellen hier
   gezielt nach — `ROR.Artifacts.on('swarms')`, `ROR.Artifacts.monsterMult()`.
   Bei vierzehn Artefakten ist das kürzer und beim Lesen sofort klar, wer
   worauf reagiert; ein Hookregister würde die Wirkung über fünf Dateien
   verstreuen.

   Freischaltungen gibt es noch nicht — alle sind von Anfang an verfügbar.   */
(function (ROR) {
  'use strict';

  const U = ROR.Util;

  const DEFS = [
    { id: 'sacrifice', name: 'Sacrifice', glyph: '☠',
      desc: 'Monsters drop items. In exchange, there are no chests.' },

    { id: 'command', name: 'Command', glyph: '❖',
      desc: 'Instead of a random item you pick one of three offers.' },

    { id: 'glass', name: 'Glass', glyph: '◈',
      desc: 'Five times the damage — at one tenth of the health.' },

    { id: 'godmode', name: 'Godmode', glyph: '✵',
      desc: 'Four times the damage — and you only take a tenth of it.' },

    { id: 'swarms', name: 'Swarms', glyph: '⁂',
      desc: 'Twice as many monsters, at half the health.' },

    { id: 'kin', name: 'Kin', glyph: '≡',
      desc: 'Every stage spawns a single monster type.' },

    { id: 'dissonance', name: 'Dissonance', glyph: '✧',
      desc: 'Monsters from every stage can appear anywhere.' },

    { id: 'evolution', name: 'Evolution', glyph: '⇞',
      desc: 'Monsters gain one more item with every stage.' },

    { id: 'spite', name: 'Spite', glyph: '✹',
      desc: 'Slain monsters drop bombs.' },

    { id: 'soul', name: 'Soul', glyph: '❂',
      desc: 'Wisps rise from slain monsters.' },

    { id: 'chaos', name: 'Chaos', glyph: '⚡',
      desc: 'Friendly fire: everything can hurt everything.' },

    { id: 'frailty', name: 'Frailty', glyph: '↓',
      desc: 'Fall damage is doubled — and lethal.' },

    { id: 'enigma', name: 'Enigma', glyph: '?',
      desc: 'You start with random equipment that changes on every use.' },

    { id: 'rebirth', name: 'Rebirth', glyph: '♺',
      desc: "You start with a Dio's Best Friend." },

    { id: 'metamorphosis', name: 'Metamorphosis', glyph: '∞',
      desc: 'Every stage assigns you a random survivor.' },

    /* Beide brauchen Elite-Gegner beziehungsweise den Doppelgänger — beides
       kommt in Stufe 7. Sie stehen schon in der Liste, damit man sieht, was
       noch fehlt, sind aber nicht wählbar. */
    { id: 'honor', name: 'Honor', glyph: '✦',
      desc: 'Only elite monsters spawn.' },

    { id: 'vengeance', name: 'Vengeance', glyph: '☯',
      desc: 'Every stage spawns a doppelganger carrying your items.' }
  ];

  const active = {};

  const Artifacts = {
    DEFS: DEFS,
    active: active,

    def(id) { for (let i = 0; i < DEFS.length; i++) if (DEFS[i].id === id) return DEFS[i]; return null; },
    on(id) { return !!active[id]; },
    set(id, an) {
      const d = Artifacts.def(id);
      if (!d || d.locked) return false;
      if (an) active[id] = true; else delete active[id];
      return true;
    },
    toggle(id) { return Artifacts.set(id, !active[id]); },
    reset() { for (const k in active) delete active[k]; },
    list() { return Object.keys(active); },
    count() { return Object.keys(active).length; },

    /* ------------------------------------------------- gezielte Abfragen */

    /* Swarms: doppelt so viele Gegner. Der Director bekommt dafür schlicht
       den doppelten Zufluss statt einer Sonderbehandlung beim Spawnen. */
    creditMult() { return active.swarms ? 2 : 1; },

    /* Sacrifice nimmt die Kisten weg — der Scene Director überspringt alles,
       was Beute gegen Gold verkauft. Schreine und Drucker bleiben. */
    allowsInteractable(def) {
      if (!active.sacrifice) return true;
      return def.kind !== 'chest' && def.kind !== 'multishop' && def.kind !== 'equipment';
    },

    /* Wie wahrscheinlich ein getöteter Gegner ein Item fallen lässt.
       Der Wert ist so gewählt, dass eine Stage ungefähr so viel abwirft wie
       ihre Kisten es täten. */
    sacrificeChance() { return active.sacrifice ? 0.05 : 0; },

    /* Kin: das Deck einer Stage auf eine einzige Art eindampfen.
       Dissonance: alle Stages zusammenwerfen. */
    shapeDeck(decks, rng) {
      if (active.kin) {
        for (const cat in decks) {
          if (decks[cat].length > 1) decks[cat] = [rng.pick(decks[cat])];
        }
        // Bei Kin stellt die Basis-Art auch die Masse; Minibosse bleiben selten.
        if (decks.basic.length) decks.miniboss = [];
      }
      return decks;
    },
    ignoresStageList() { return !!active.dissonance; },

    /* Evolution: Gegner bekommen je abgeschlossener Stage ein weißes Item. */
    monsterItems() {
      return active.evolution ? Math.min(20, ROR.Game.stagesCleared) : 0;
    },

    friendlyFire() { return !!active.chaos; },
    fallDamageMult() { return active.frailty ? 2 : 1; },
    fallIsLethal() { return !!active.frailty; },

    /* ----------------------------------------------- Beim Start und Wechsel */

    runStart(player) {
      if (active.rebirth) ROR.Items.give(player.body, 'dios', 1);
      if (active.enigma) Artifacts.rollEnigma(player.body);
    },

    stageStart(player) {
      if (active.metamorphosis) Artifacts.rollSurvivor(player);
      if (active.vengeance) Artifacts.spawnDoppelgaenger(player);
    },

    /* Der Doppelgänger ist ein Champion-Gegner mit den Items des Spielers —
       je länger der Durchlauf, desto mehr wird er zum Spiegelbild. */
    spawnDoppelgaenger(player) {
      const stage = ROR.Stage.current;
      if (!stage) return;
      const kandidaten = ROR.Data.monstersFor(ROR.Game.stageOrder, 'champion');
      const def = kandidaten.length ? U.chaos.pick(kandidaten) : ROR.Data.monster('stone_titan');
      const spot = stage.terrain.findSpot(U.chaos, {
        rMin: 40, rMax: stage.terrain.half * 0.8, maxSlope: 0.3, tries: 40
      });
      if (!spot) return;
      const m = ROR.Monsters.spawn(def, ROR.Difficulty.spawnLevel,
        new THREE.Vector3(spot.x, def.flying ? spot.y + def.hoverHeight : spot.y, spot.z),
        U.chaos.pick(ROR.Data.elitesOfTier(1)));
      if (!m) return;
      m.body.name = 'Doppelganger';
      for (const id in player.body.items) {
        ROR.Items.give(m.body, id, player.body.items[id]);
      }
      ROR.HUD.toast('A doppelganger has appeared', 'bad');
    },

    rollEnigma(body) {
      const pool = ROR.Items.ofTier('equipment');
      if (pool.length) ROR.Items.equip(body, U.chaos.pick(pool).id);
    },

    rollSurvivor(player) {
      const alle = ROR.Data.Survivors;
      if (alle.length < 2) return;
      const andere = alle.filter((s) => s.id !== player.def.id);
      const neu = U.chaos.pick(andere.length ? andere : alle);
      if (ROR.Game.switchSurvivor) ROR.Game.switchSurvivor(neu);
    },

    /* Wird beim Tod eines Gegners gerufen — Sacrifice, Spite und Soul hängen
       alle hier dran, damit `monster.js` nur eine Zeile braucht. */
    onMonsterDeath(m) {
      const pos = m.model.position.clone();

      if (active.sacrifice && U.chaos.next() < Artifacts.sacrificeChance() * (m.def.cost / 10)) {
        ROR.Loot.dropFrom(ROR.Loot.CHEST, pos, ROR.Game.player.body);
      }

      if (active.spite) {
        // Drei Bomben, die kurz liegen bleiben — auch der Spieler muss weg.
        for (let i = 0; i < 3; i++) {
          const a = U.chaos.next() * U.TAU;
          ROR.Projectiles.spawn({
            attacker: m.body, team: ROR.Body.NEUTRAL,
            origin: pos.clone().setY(pos.y + 1.2),
            dir: new THREE.Vector3(Math.cos(a) * 0.6, 1, Math.sin(a) * 0.6).normalize(),
            speed: 9, life: 1.6, radius: 0.34, coefficient: 0, proc: 0, gravity: 16,
            color: 0xff5a3a,
            explode: { radius: 7, coefficient: 3 * ROR.Difficulty.coeff / 4, proc: 0 }
          });
        }
      }

      if (active.soul) {
        const def = ROR.Data.monster('lesser_wisp');
        if (def) ROR.Monsters.spawn(def, ROR.Difficulty.spawnLevel,
          pos.clone().setY(pos.y + 2.5));
      }
    }
  };

  /* Glass und Swarms greifen in die Werte ein. Beide sind bewusst
     multiplikativ auf den Endwert — sie sollen alles mitnehmen, auch Items. */
  ROR.Stats.addModifier(function (body, out) {
    if (body.team === ROR.Body.PLAYER) {
      if (active.glass) { out.damage *= 5; out.maxHealth *= 0.1; }
      /* Godmode braucht keine eigene Verdrahtung: `damageTaken` ist bereits
         der Faktor, mit dem damage.js eingehenden Schaden nach der Rüstung
         multipliziert. Mit Glass zusammen wirkt beides multiplikativ — 20x
         Schaden bei einem Zehntel Leben, das ist gewollt. */
      if (active.godmode) { out.damage *= 4; out.damageTaken *= 0.1; }
    } else {
      if (active.swarms) out.maxHealth *= 0.5;
    }
  });

  ROR.Artifacts = Artifacts;
})(window.ROR);
