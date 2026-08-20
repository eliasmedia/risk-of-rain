/* game/data/survivors.js
   Die spielbaren Figuren: Grundwerte, Aussehen und vier Fähigkeiten.

   Werte und Schadensprozente stammen aus dem Wiki der Vorlage. Eine Fähigkeit
   ist ein kleines Objekt mit einer `fire`-Funktion; wann sie aufgerufen wird,
   entscheidet der Ablaufteil in entities/player.js anhand von `mode`:

     'auto'   feuert, solange gehalten wird, mit `rate` Schuss je Sekunde
     'press'  ein Auslösen je Druck, verbraucht eine Ladung
     'stance' geht für `duration` in eine Haltung und feuert dort mit `rate`

   `rate` wird immer mit dem Angriffstempo multipliziert, Abklingzeiten nie —
   genau wie in der Vorlage. */
(function (ROR) {
  'use strict';

  ROR.Data = ROR.Data || {};

  const _v = new THREE.Vector3();

  ROR.Data.Survivors = [{
    id: 'commando',
    name: 'Commando',
    subtitle: 'Der Anfang',
    growth: 'flat',

    health: 110, healthPerLevel: 33,
    regen: 1,    regenPerLevel: 0.2,
    damage: 12,  damagePerLevel: 2.4,
    armor: 0,    armorPerLevel: 0,
    moveSpeed: 7, crit: 1, jumpCount: 1,
    radius: 0.42, height: 1.85,

    colors: {
      coat: 0x39485c, coatDark: 0x2a3648, skin: 0xc79a72,
      visor: 0x8fd6e8, pants: 0x4a4335, boots: 0x2b2723, metal: 0x6a6f75
    },

    skills: {
      /* Sechs Schuss je Sekunde bei Grundtempo, 100 % Schaden, voller
         Proc-Coefficient. Der Entfernungsabfall ist der Standard: bis 25 m
         volle Wirkung, ab 60 m die Hälfte. */
      primary: {
        id: 'double_tap', name: 'Double Tap', glyph: 'M1', color: 0xd8dee3,
        desc: 'Feuert für 100 % Schaden.',
        mode: 'auto', rate: 6, cooldown: 0, charges: 0,
        fire(ctx) {
          ROR.Projectiles.bullet({
            attacker: ctx.body, team: ctx.body.team,
            origin: ctx.origin, dir: ctx.dir,
            coefficient: 1.0, proc: 1.0, falloff: 'standard',
            range: 200, spread: 0.012
          });
          ctx.player.recoil(0.35);
        }
      },

      /* Durchschlagend, fliegt durch Gelände und wird mit jedem getroffenen
         Gegner um 40 % stärker. */
      secondary: {
        id: 'phase_round', name: 'Phase Round', glyph: 'M2', color: 0x8fd6e8,
        desc: '300 % Schaden, durchschlägt. Je durchschlagenem Gegner +40 %.',
        mode: 'press', cooldown: 3, charges: 1,
        fire(ctx) {
          ROR.Projectiles.spawn({
            attacker: ctx.body, team: ctx.body.team,
            origin: ctx.origin, dir: ctx.dir,
            speed: 120, life: 2.5, radius: 0.34,
            coefficient: 3.0, proc: 1.0,
            pierce: true, pierceGrowth: 0.4, ghost: true,
            color: 0x9fe4ff
          });
          ctx.player.recoil(1.1);
        }
      },

      /* Rolle mit Unverwundbarkeit. „Agile": bricht den Sprint nicht ab. */
      utility: {
        id: 'tactical_dive', name: 'Tactical Dive', glyph: 'Shift', color: 0xa9c47a,
        desc: 'Rolle ein Stück. Währenddessen unverwundbar.',
        mode: 'press', cooldown: 4, charges: 1, agile: true, cancelsSprint: false,
        fire(ctx) { ctx.player.startDive(); }
      },

      /* Eine Sekunde Sperrfeuer: sechs Schuss bei Grundtempo, jeder betäubt.
         Dafür steht man dabei fast still. */
      special: {
        id: 'suppressive_fire', name: 'Suppressive Fire', glyph: 'R', color: 0xffc46b,
        desc: '100 % Schaden je Kugel, betäubt. Eine Sekunde Sperrfeuer.',
        mode: 'stance', cooldown: 9, charges: 1, duration: 1.0, rate: 6,
        begin(ctx) { ROR.Buffs.apply(ctx.body, 'suppressing', 1.15); },
        end(ctx) { ROR.Buffs.clear(ctx.body, 'suppressing'); },
        fire(ctx) {
          ROR.Projectiles.bullet({
            attacker: ctx.body, team: ctx.body.team,
            origin: ctx.origin, dir: ctx.dir,
            coefficient: 1.0, proc: 1.0, falloff: 'standard',
            range: 200, spread: 0.05, stun: 1.0,
            tracerColor: 0xffc46b, sparkColor: 0xffd9a0
          });
          ctx.player.recoil(0.55);
        }
      }
    }
  }];

  ROR.Data.survivor = function (id) {
    const list = ROR.Data.Survivors;
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0];
  };
})(window.ROR);
