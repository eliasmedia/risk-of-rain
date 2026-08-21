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

  /* Nahkampf: alles im Kegel vor der Figur. Der Kegel statt einer Kugel ist
     wichtig — sonst träfe ein Schwertstreich auch, was hinter einem steht. */
  function schwung(ctx, reichweite, winkel, koeffizient, proc) {
    const p = ctx.player;
    /* Gemessen wird bis zur *Hülle* des Gegners, nicht bis zu seinem
       Mittelpunkt. Sonst stünde man bei einem Stone Titan mitten in ihm drin
       und träfe nichts — sein Mittelpunkt liegt weiter weg als jede Klinge
       reicht. Deshalb weiter suchen und dann den Radius abziehen. */
    const liste = ROR.Projectiles.enemiesInRange(p.position, reichweite + 4, p.body.team, 16);
    const vorne = new THREE.Vector3(-Math.sin(p.facing), 0, -Math.cos(p.facing));
    let getroffen = 0;
    for (let i = 0; i < liste.length; i++) {
      const dx = liste[i].position.x - p.position.x;
      const dz = liste[i].position.z - p.position.z;
      const dy = liste[i].position.y + liste[i].height * 0.5 - (p.position.y + 0.9);
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) - liste[i].radius > reichweite) continue;
      const zu = new THREE.Vector3(dx, 0, dz).normalize();
      if (winkel < Math.PI && zu.dot(vorne) < Math.cos(winkel)) continue;
      ROR.Damage.deal({
        attacker: p.body, victim: liste[i], coefficient: koeffizient, proc: proc,
        position: liste[i].center(new THREE.Vector3())
      });
      getroffen++;
    }
    ROR.Projectiles.spark(
      new THREE.Vector3(p.position.x + vorne.x * reichweite * 0.6, p.position.y + 1.1,
                        p.position.z + vorne.z * reichweite * 0.6),
      0xbfe8ff, reichweite * 0.35);
    return getroffen;
  }

  /* Punkt unter dem Fadenkreuz, auf dem Boden — für alles, was man hinstellt. */
  function bodenZiel(ctx, maxWeite) {
    const stage = ROR.Stage.current;
    const ziel = ctx.target.clone();
    ziel.y = stage.terrain.heightAt(ziel.x, ziel.z);
    const p = ctx.player;
    const weit = Math.hypot(ziel.x - p.position.x, ziel.z - p.position.z);
    if (weit > maxWeite) {
      const k = maxWeite / weit;
      ziel.x = p.position.x + (ziel.x - p.position.x) * k;
      ziel.z = p.position.z + (ziel.z - p.position.z) * k;
      ziel.y = stage.terrain.heightAt(ziel.x, ziel.z);
    }
    return ziel;
  }

  ROR.Data.Survivors = [
{
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

    /* Mantel mit Schößen, Mütze und Schal: der Soldat von der Stange. */
    build: { torso: 'coat', head: 'cap', weapon: 'pistol', legs: 'normal', width: 1.0 },

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
  },

  /* ==================================================================== */

  {
    id: 'huntress',
    name: 'Huntress',
    subtitle: 'Immer in Bewegung',
    growth: 'flat',
    health: 90, healthPerLevel: 27,
    regen: 1,   regenPerLevel: 0.2,
    damage: 12, damagePerLevel: 2.4,
    armor: 0,   armorPerLevel: 0,
    moveSpeed: 7, crit: 1, jumpCount: 1,
    radius: 0.38, height: 1.8,
    /* Sie zielt nicht selbst — alles trifft, was in 60 m ist. Dafür muss sie
       nah heran, und genau daraus entsteht ihr Spiel. */
    autoTarget: 60,

    /* Schmal, Kapuze, Umhang, kein Gesicht. Alles an ihr sagt: leicht und
       schnell — und dass sie im Nahbereich nichts zu verlieren hat. */
    build: { torso: 'light', head: 'hood', back: 'cape', weapon: 'glaive',
             legs: 'normal', width: 0.86, scale: 0.97 },

    colors: { coat: 0x2f4f4a, coatDark: 0x1e3733, skin: 0xd6a878,
              visor: 0x7cf0c0, pants: 0x3a3c44, boots: 0x22242a, metal: 0x8a9aa4 },

    skills: {
      primary: {
        id: 'strafe', name: 'Strafe', glyph: 'M1', color: 0x7cf0c0,
        desc: 'Zielsuchender Pfeil für 150 % Schaden, alle 0.5 s. Auch im Laufen.',
        mode: 'auto', rate: 2, cooldown: 0, charges: 0, cancelsSprint: false,
        fire(ctx) {
          if (!ctx.lockedOn) return;
          ROR.Projectiles.spawn({
            attacker: ctx.body, team: ctx.body.team, origin: ctx.origin, dir: ctx.dir,
            speed: 80, life: 2.5, radius: 0.26, coefficient: 1.5, proc: 1,
            color: 0x9cffd8, homing: ctx.lockedOn, turn: 14
          });
          ctx.player.recoil(0.3);
        }
      },

      secondary: {
        id: 'laser_glaive', name: 'Laser Glaive', glyph: 'M2', color: 0x9cffd8,
        desc: '250 % Schaden, springt bis zu sechsmal weiter — je Sprung +10 %.',
        mode: 'press', cooldown: 7, charges: 1,
        fire(ctx) {
          ROR.Projectiles.spawn({
            attacker: ctx.body, team: ctx.body.team, origin: ctx.origin, dir: ctx.dir,
            speed: 55, life: 6, radius: 0.55, coefficient: 2.5, proc: 1,
            color: 0x7cf0c0, homing: ctx.lockedOn || null, turn: 6,
            bounces: 6, bounceRange: 28, bounceGrowth: 0.1
          });
          ctx.player.recoil(0.9);
        }
      },

      utility: {
        id: 'blink', name: 'Blink', glyph: 'Shift', color: 0xa9c47a,
        desc: 'Verschwinden und ein Stück nach vorn setzen.',
        mode: 'press', cooldown: 7, charges: 1, agile: true, cancelsSprint: false,
        fire(ctx) {
          ctx.player.startDash({ time: 0.28, speed: 6.5, iframes: 0.34,
                                 towardAim: true, pose: 'leap' });
          ROR.Projectiles.spark(ctx.player.position.clone().setY(ctx.player.position.y + 1),
                                0x7cf0c0, 1.6);
        }
      },

      special: {
        id: 'arrow_rain', name: 'Arrow Rain', glyph: 'R', color: 0xffc46b,
        desc: 'Pfeilregen über sechs Sekunden, rund 2090 % Schaden gesamt.',
        mode: 'press', cooldown: 12, charges: 1,
        fire(ctx) {
          const ziel = bodenZiel(ctx, 45);
          ROR.Deployables.spawn('zone', ctx.body, ziel, {
            radius: 9, life: 6, interval: 0.32, coefficient: 1.1, proc: 0.2,
            slow: 0.6, color: 0x9cffd8
          });
          ctx.player.startDash({ time: 0.2, speed: 0, iframes: 0.3, pose: 'leap' });
        }
      }
    }
  },

  /* ==================================================================== */

  {
    id: 'engineer',
    name: 'Engineer',
    subtitle: 'Stellt sich auf',
    growth: 'flat',
    health: 130, healthPerLevel: 39,
    regen: 1,    regenPerLevel: 0.2,
    damage: 14,  damagePerLevel: 2.8,
    armor: 0,    armorPerLevel: 0,
    moveSpeed: 7, crit: 1, jumpCount: 1,
    radius: 0.44, height: 1.85,

    /* Breit, Brustplatte, Werkzeuggurt, Rucksack mit Turmteilen. Er sieht
       aus, als könnte er etwas hinstellen — und genau das tut er. */
    build: { torso: 'armour', head: 'helmet', back: 'backpack', weapon: 'gauntlet',
             legs: 'normal', width: 1.2, pads: true, gauntlets: true },

    colors: { coat: 0xb4772e, coatDark: 0x6f471a, skin: 0xc79a72,
              visor: 0xffd98a, pants: 0x40444a, boots: 0x2a2c30, metal: 0x8a8f95 },

    skills: {
      primary: {
        id: 'bouncing_grenades', name: 'Bouncing Grenades', glyph: 'M1', color: 0xffd98a,
        desc: 'Halten lädt bis zu acht Granaten zu je 100 % Schaden.',
        mode: 'charge', chargeTime: 2, cooldown: 0.6, charges: 1,
        fire(ctx, ladung) {
          const anzahl = Math.max(1, Math.round(ladung * 8));
          for (let i = 0; i < anzahl; i++) {
            const d = ctx.dir.clone();
            d.x += (Math.random() - 0.5) * 0.09;
            d.y += (Math.random() - 0.5) * 0.05 + 0.05;
            d.z += (Math.random() - 0.5) * 0.09;
            ROR.Projectiles.spawn({
              attacker: ctx.body, team: ctx.body.team, origin: ctx.origin, dir: d.normalize(),
              speed: 32, life: 3, radius: 0.28, coefficient: 0, proc: 0,
              gravity: 14, color: 0xffd070,
              explode: { radius: 3.5, coefficient: 1.0, proc: 1 }
            });
          }
          ctx.player.recoil(0.3 + ladung * 0.7);
        }
      },

      secondary: {
        id: 'pressure_mines', name: 'Pressure Mines', glyph: 'M2', color: 0xffb060,
        desc: 'Zweistufige Mine: 300 % Schaden, voll scharf 900 %. Bis zu vier.',
        mode: 'press', cooldown: 8, charges: 4,
        fire(ctx) {
          ROR.Deployables.spawn('mine', ctx.body, bodenZiel(ctx, 16), {
            max: 4, coefficient: 3, armed: 9, radius: 8, proc: 1,
            colors: { main: 0xb4772e, dark: 0x5a3c18, glow: 0xffb060 }
          });
        }
      },

      utility: {
        id: 'bubble_shield', name: 'Bubble Shield', glyph: 'Shift', color: 0x8fd6ff,
        desc: 'Undurchdringliche Kuppel, 15 Sekunden lang.',
        mode: 'press', cooldown: 25, charges: 1, cancelsSprint: false,
        fire(ctx) {
          ROR.Deployables.spawn('shield', ctx.body,
            ctx.player.position.clone().setY(ctx.player.position.y + 1),
            { radius: 10, life: 15, max: 1 });
        }
      },

      special: {
        id: 'tr12_turret', name: 'TR12 Gauss Auto-Turret', glyph: 'R', color: 0x9fe4ff,
        desc: 'Turm mit eigenem Leben. Er erbt alle Items seines Erbauers.',
        mode: 'press', cooldown: 30, charges: 2,
        fire(ctx) {
          ROR.Deployables.spawn('turret', ctx.body, bodenZiel(ctx, 12), {
            max: 2, interval: 0.333, coefficient: 0.667, proc: 1, range: 40,
            colors: { main: 0xb4772e, dark: 0x4a3c2a, glow: 0x9fe4ff }
          });
        }
      }
    }
  },

  /* ==================================================================== */

  {
    id: 'mult',
    name: 'MUL-T',
    subtitle: 'Zwei Werkzeuge',
    growth: 'flat',
    health: 200, healthPerLevel: 60,
    regen: 1,    regenPerLevel: 0.2,
    damage: 11,  damagePerLevel: 2.2,
    armor: 12,   armorPerLevel: 0,
    moveSpeed: 7, crit: 1, jumpCount: 1,
    radius: 0.5, height: 1.95,

    /* Kein Kopf, sondern ein Sensorbalken auf einem Fahrgestell. Zwei
       Drucktanks hinten, Stelzen mit breiter Standfläche: eine Maschine,
       die zwei Werkzeuge gleichzeitig trägt. */
    build: { torso: 'chassis', head: 'sensor', back: 'tanks', weapon: 'nailgun',
             legs: 'treads', width: 1.32, pads: true, gauntlets: true,
             shoulder: 0.42, neckHeight: 0.82 },

    colors: { coat: 0xc23a2a, coatDark: 0x7a2018, skin: 0x9aa2a8,
              visor: 0xffe066, pants: 0x5a5f66, boots: 0x2c2f34, metal: 0xa8b0b8 },

    skills: {
      primary: {
        id: 'nailgun', name: 'Auto-Nailgun', glyph: 'M1', color: 0xffe066,
        desc: '12 Nägel je Sekunde für je 70 % Schaden. Proc 0.6.',
        mode: 'auto', rate: 12, cooldown: 0, charges: 0,
        fire(ctx) {
          ROR.Projectiles.bullet({
            attacker: ctx.body, team: ctx.body.team, origin: ctx.origin, dir: ctx.dir,
            coefficient: 0.7, proc: 0.6, falloff: 'standard', range: 120, spread: 0.045,
            tracerColor: 0xffe066
          });
          ctx.player.recoil(0.16);
        }
      },

      /* Zweite Waffe desselben Platzes — Retool schaltet um. */
      primaryAlt: {
        id: 'rebar', name: 'Rebar Puncher', glyph: 'M1', color: 0xff9a4a,
        desc: 'Durchschlagender Betonstahl für 600 % Schaden, alle 1.8 s.',
        mode: 'auto', rate: 0.556, cooldown: 0, charges: 0,
        fire(ctx) {
          ROR.Projectiles.spawn({
            attacker: ctx.body, team: ctx.body.team, origin: ctx.origin, dir: ctx.dir,
            speed: 150, life: 2, radius: 0.3, coefficient: 6.0, proc: 1,
            pierce: true, color: 0xff9a4a
          });
          ctx.player.recoil(1.2);
        }
      },

      secondary: {
        id: 'blast_canister', name: 'Blast Canister', glyph: 'M2', color: 0xff7a4a,
        desc: '220 % Schaden, verstreut fünf Bomben zu je 44 %.',
        mode: 'press', cooldown: 6, charges: 1,
        fire(ctx) {
          ROR.Projectiles.spawn({
            attacker: ctx.body, team: ctx.body.team, origin: ctx.origin, dir: ctx.dir,
            speed: 45, life: 3, radius: 0.42, coefficient: 0, proc: 0,
            gravity: 10, color: 0xff7a4a,
            explode: { radius: 6, coefficient: 2.2, proc: 1 }
          });
          // Die Bomblets folgen als kleine Streuung hinterher.
          for (let i = 0; i < 5; i++) {
            const d = ctx.dir.clone();
            d.x += (Math.random() - 0.5) * 0.22;
            d.y += (Math.random() - 0.5) * 0.1 + 0.06;
            d.z += (Math.random() - 0.5) * 0.22;
            ROR.Projectiles.spawn({
              attacker: ctx.body, team: ctx.body.team, origin: ctx.origin, dir: d.normalize(),
              speed: 30, life: 3.4, radius: 0.24, coefficient: 0, proc: 0,
              gravity: 13, color: 0xffb060,
              explode: { radius: 4, coefficient: 0.44, proc: 0.3 }
            });
          }
          ctx.player.recoil(1.0);
        }
      },

      utility: {
        id: 'transport_mode', name: 'Transport Mode', glyph: 'Shift', color: 0xa9c47a,
        desc: 'Vorwärtsstürmen mit 200 Rüstung, 250 % Schaden bei Berührung.',
        mode: 'press', cooldown: 6, charges: 1, agile: true, cancelsSprint: false,
        fire(ctx) {
          ctx.player.startDash({
            time: 0.9, speed: 3.2, armor: 200, towardAim: true, pose: 'charge',
            radius: 3.0, damage: { coefficient: 2.5, proc: 1 }
          });
        }
      },

      special: {
        id: 'retool', name: 'Retool', glyph: 'R', color: 0xffe066,
        desc: 'Wechselt zwischen Nagelpistole und Betonstahl.',
        mode: 'swap', cooldown: 0.4,
        fire(ctx) { ctx.player.swapPrimary(); }
      }
    }
  },

  /* ==================================================================== */

  {
    id: 'artificer',
    name: 'Artificer',
    subtitle: 'Feuer, Eis und Wucht',
    growth: 'flat',
    health: 110, healthPerLevel: 33,
    regen: 1,    regenPerLevel: 0.2,
    damage: 12,  damagePerLevel: 2.4,
    armor: 0,    armorPerLevel: 0,
    moveSpeed: 7, crit: 1, jumpCount: 1,
    radius: 0.4, height: 1.8,

    /* Mantel bis zum Boden, keine sichtbaren Beine, Schubdüsen im Rücken
       und ein Stab mit Kern: sie steht nicht, sie schwebt. */
    build: { torso: 'robe', head: 'mask', back: 'jets', weapon: 'wand',
             legs: 'hover', width: 0.9 },

    colors: { coat: 0x8e3f7a, coatDark: 0x561f4a, skin: 0xd6a878,
              visor: 0xffb0e8, pants: 0x3c3350, boots: 0x241e30, metal: 0xc0a8d8 },

    skills: {
      primary: {
        id: 'flame_bolt', name: 'Flame Bolt', glyph: 'M1', color: 0xff8a4a,
        desc: '280 % Schaden und Brand. Bis zu vier Ladungen.',
        mode: 'press', cooldown: 1.3, charges: 4,
        fire(ctx) {
          const b = ctx.body;
          ROR.Projectiles.spawn({
            attacker: b, team: b.team, origin: ctx.origin, dir: ctx.dir,
            speed: 60, life: 3, radius: 0.34, coefficient: 2.8, proc: 1,
            color: 0xff8a4a,
            onHit(ziel) {
              // „Ignite" — der Brand ist der halbe Wert der Flame Bolt.
              ROR.Buffs.applyDot(ziel, 'burn', b, b.stats.damage * 1.4, 3);
            }
          });
          ctx.player.recoil(0.5);
        }
      },

      secondary: {
        id: 'nano_bomb', name: 'Charged Nano-Bomb', glyph: 'M2', color: 0xb0a0ff,
        desc: 'Aufladen für 400 bis 2000 % Schaden im Umkreis von 14 m.',
        mode: 'charge', chargeTime: 2, cooldown: 5, charges: 1,
        fire(ctx, ladung) {
          const koeff = 4 + 16 * ladung;
          ROR.Projectiles.spawn({
            attacker: ctx.body, team: ctx.body.team, origin: ctx.origin, dir: ctx.dir,
            speed: 34, life: 5, radius: 0.4 + ladung * 0.6, coefficient: 0, proc: 0,
            color: 0xb0a0ff,
            explode: { radius: 6 + 8 * ladung, coefficient: koeff, proc: 1 }
          });
          ctx.player.recoil(0.6 + ladung);
        }
      },

      utility: {
        id: 'snapfreeze', name: 'Snapfreeze', glyph: 'Shift', color: 0x9fe4ff,
        desc: 'Eiswand, die für 100 % Schaden trifft und verlangsamt.',
        mode: 'press', cooldown: 12, charges: 1,
        fire(ctx) {
          ROR.Deployables.spawn('zone', ctx.body, bodenZiel(ctx, 22), {
            radius: 7, life: 4, interval: 0.4, coefficient: 1.0, proc: 0.4,
            slow: 2, color: 0x9fe4ff
          });
        }
      },

      special: {
        id: 'flamethrower', name: 'Flamethrower', glyph: 'R', color: 0xff6a2a,
        desc: 'Drei Sekunden Flammenstrahl, rund 2095 % Schaden gesamt.',
        mode: 'stance', cooldown: 5, charges: 1, duration: 3, rate: 7.33,
        begin(ctx) { ROR.Buffs.apply(ctx.body, 'suppressing', 3.2); },
        end(ctx) { ROR.Buffs.clear(ctx.body, 'suppressing'); },
        fire(ctx) {
          ROR.Projectiles.bullet({
            attacker: ctx.body, team: ctx.body.team, origin: ctx.origin, dir: ctx.dir,
            coefficient: 0.95, proc: 1, range: 20, spread: 0.13,
            tracerColor: 0xff6a2a, sparkColor: 0xffb060,
            onHit(ziel) {
              ROR.Buffs.applyDot(ziel, 'burn', ctx.body, ctx.body.stats.damage * 0.25, 2);
            }
          });
          ctx.player.recoil(0.22);
        }
      }
    }
  },

  /* ==================================================================== */

  {
    id: 'mercenary',
    name: 'Mercenary',
    subtitle: 'Nie am Boden',
    growth: 'flat',
    health: 110, healthPerLevel: 33,
    regen: 1,    regenPerLevel: 0.2,
    damage: 12,  damagePerLevel: 2.4,
    armor: 20,   armorPerLevel: 0,
    moveSpeed: 7, crit: 1, jumpCount: 2,
    radius: 0.4, height: 1.85,

    /* Wespentaille, glatter Visierschädel, Energieklinge. Kein Gramm zu
       viel — die Silhouette einer Figur, die nie stehen bleibt. */
    build: { torso: 'sleek', head: 'visor', weapon: 'sword',
             legs: 'normal', width: 0.94, pads: true },

    colors: { coat: 0xd8dde2, coatDark: 0x9aa4ae, skin: 0xd6a878,
              visor: 0xff5a6a, pants: 0x2e3238, boots: 0x1c1f23, metal: 0xbfe8ff },

    skills: {
      primary: {
        id: 'laser_sword', name: 'Laser Sword', glyph: 'M1', color: 0xbfe8ff,
        desc: '130 % Schaden. Jeder dritte Streich trifft weit und für 200 %.',
        mode: 'auto', rate: 1.8, cooldown: 0, charges: 0,
        fire(ctx) {
          const p = ctx.player;
          p._combo = (p._combo || 0) + 1;
          const dritter = p._combo % 3 === 0;
          schwung(ctx, dritter ? 6.5 : 4.2, dritter ? Math.PI : 1.0,
                  dritter ? 2.0 : 1.3, 1);
          p.recoil(dritter ? 0.9 : 0.45);
        }
      },

      secondary: {
        id: 'whirlwind', name: 'Whirlwind', glyph: 'M2', color: 0x9fe4ff,
        desc: 'Zwei Streiche ringsum für je 200 % Schaden.',
        mode: 'press', cooldown: 2.5, charges: 1,
        fire(ctx) {
          schwung(ctx, 5.5, Math.PI, 2.0, 1);
          // Der zweite Streich folgt einen Sekundenbruchteil später.
          ctx.player.after(0.18, function () { schwung(ctx, 5.5, Math.PI, 2.0, 1); });
          ctx.player.recoil(0.8);
        }
      },

      utility: {
        id: 'blinding_assault', name: 'Blinding Assault', glyph: 'Shift', color: 0xa9c47a,
        desc: '300 % Schaden im Sprung. Ein Treffer gibt den Sprung zurück.',
        mode: 'press', cooldown: 8, charges: 3, agile: true, cancelsSprint: false,
        fire(ctx) {
          ctx.player.startDash({
            time: 0.34, speed: 5.5, iframes: 0.6, towardAim: true, pose: 'leap',
            radius: 3.2, damage: { coefficient: 3.0, proc: 1 },
            resetOnHit: true, slot: 'utility'
          });
        }
      },

      special: {
        id: 'eviscerate', name: 'Eviscerate', glyph: 'R', color: 0xff5a6a,
        desc: 'Unangreifbar am nächsten Gegner haften und siebenmal für 110 % zuschlagen.',
        mode: 'stance', cooldown: 6, charges: 1, duration: 1.3, rate: 5.4,
        begin(ctx) { ctx.body.invulnerable = Math.max(ctx.body.invulnerable, 1.9); },
        fire(ctx) {
          const p = ctx.player;
          const ziel = ROR.Projectiles.nearestEnemy(p.position, 25, p.body.team);
          p.latchTo(ziel, 1 / 60);
          p.body.invulnerable = Math.max(p.body.invulnerable, 0.7);
          schwung(ctx, 4.5, Math.PI, 1.1, 1);
          p.recoil(0.5);
        }
      }
    }
  }

  ];

  ROR.Data.survivor = function (id) {
    const list = ROR.Data.Survivors;
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0];
  };
})(window.ROR);
