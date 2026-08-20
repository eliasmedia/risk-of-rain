/* game/data/monsters.js
   Gegner als reine Daten: Werte, Kosten, Aussehen, Verhaltensprofil.

   Die Grundwerte und die Zuwächse je Stufe stammen aus dem Wiki. Sie folgen
   dort demselben Muster wie im Spielcode: +30 % Leben und +20 % Schaden des
   *Grundwerts* je Stufe — deshalb steht bei allen `growth: 'ratio'`.

   `cost` sind die Credits, die der Combat Director für ein Exemplar ausgibt,
   und zugleich der Wert, aus dem Erfahrung und Gold berechnet werden. Ein
   Beetle für 8 Credits bringt also wenig, ein Greater Wisp für 200 viel.

   `shape` beschreibt das Modell — gebaut wird es in entities/monster.js aus
   sechs Bauarten. Ein neuer Gegner braucht damit keine neue Geometrie,
   nur andere Zahlen.

   Abweichungen von der Tabelle, bewusst und einzeln:
   * Beetle Guard: das Wiki nennt 17 m/s. Das wäre schneller als ein
     sprintender Spieler und passt zu nichts, was der Gegner im Spiel tut —
     hier 7 m/s.
   * Blind Pest stammt aus einer Erweiterung, ist aber als fliegender
     Störenfried zu nützlich, um ihn wegzulassen.                          */
(function (ROR) {
  'use strict';

  ROR.Data = ROR.Data || {};

  const M = (o) => Object.assign({
    growth: 'ratio', regen: 0, armor: 0, category: 'basic',
    stages: [1, 2, 3, 4, 5], flying: false
  }, o);

  ROR.Data.Monsters = [

    /* ------------------------------------------------------------ Basis */

    M({
      id: 'lesser_wisp', name: 'Lesser Wisp',
      health: 35, damage: 3.5, moveSpeed: 6, cost: 10,
      radius: 0.45, height: 1.0, flying: true, hoverHeight: 3.4,
      shape: { kind: 'orb', size: 0.5, shards: 5,
               colors: { main: 0xffa03a, glow: 0xffd98a, dark: 0x8a3d12 } },
      ai: { kind: 'ranged', range: 26, keep: 16, windup: 0.55, cooldown: 1.6,
            shot: { speed: 32, radius: 0.28, coefficient: 1.0, proc: 1, color: 0xffb45a } }
    }),

    M({
      id: 'beetle', name: 'Beetle',
      health: 80, damage: 12, moveSpeed: 6, cost: 8,
      radius: 0.6, height: 1.3, stages: [1, 2, 3],
      shape: { kind: 'quadruped', body: [1.25, 0.72, 0.9], head: 0.44, tail: 0,
               colors: { main: 0x8a5f3c, dark: 0x5b3d26, eye: 0xffe07a } },
      ai: { kind: 'melee', range: 2.4, windup: 0.45, cooldown: 1.3, coefficient: 1.0, proc: 1 }
    }),

    M({
      id: 'lemurian', name: 'Lemurian',
      health: 80, damage: 12, moveSpeed: 7, cost: 11,
      radius: 0.6, height: 1.6,
      shape: { kind: 'quadruped', body: [1.5, 0.65, 0.62], head: 0.5, tail: 1.5, upright: 0.35,
               colors: { main: 0x9c4636, dark: 0x62281d, eye: 0xffcf6b } },
      ai: { kind: 'ranged', range: 22, keep: 9, windup: 0.6, cooldown: 1.9,
            melee: { range: 2.6, coefficient: 1.0, cooldown: 1.2 },
            shot: { speed: 26, radius: 0.34, coefficient: 1.0, proc: 1, color: 0xff7a3a } }
    }),

    M({
      id: 'jellyfish', name: 'Jellyfish',
      health: 60, damage: 5, moveSpeed: 10, cost: 10,
      radius: 0.6, height: 1.2, flying: true, hoverHeight: 2.2, stages: [1, 2, 3, 4],
      shape: { kind: 'jelly', size: 0.72, tendrils: 6,
               colors: { main: 0x6fd7c8, glow: 0xbdfff4, dark: 0x2b7a72 } },
      /* Platzt beim Kontakt. Der Proc-Coefficient ist 0 — Explosionen tragen
         in der Vorlage bewusst nichts zur Auslösekette bei. */
      ai: { kind: 'suicide', range: 3.4, windup: 0.7,
            blast: { radius: 6, coefficient: 2.0, proc: 0 } }
    }),

    M({
      id: 'bighorn_bison', name: 'Bighorn Bison',
      health: 480, damage: 12, moveSpeed: 3, cost: 12, stages: [1, 2, 3],
      radius: 0.85, height: 1.7,
      shape: { kind: 'quadruped', body: [1.9, 1.05, 1.2], head: 0.62, horns: true, tail: 0.5,
               colors: { main: 0x7d6a4d, dark: 0x4d4031, eye: 0xd9d0b0 } },
      ai: { kind: 'charger', range: 26, windup: 0.9, cooldown: 3.2,
            chargeSpeed: 24, chargeTime: 1.6, coefficient: 2.4, proc: 1 }
    }),

    M({
      id: 'mini_mushrum', name: 'Mini Mushrum',
      health: 290, damage: 16, moveSpeed: 2, cost: 12, stages: [2, 3, 4, 5],
      radius: 0.6, height: 1.4,
      shape: { kind: 'fungus', size: 0.9,
               colors: { main: 0xd8cfae, dark: 0x8d7f5e, glow: 0xb9d97a } },
      ai: { kind: 'turret', range: 18, windup: 0.8, cooldown: 2.4,
            shot: { speed: 18, radius: 0.4, coefficient: 1.0, proc: 1, color: 0xc3e07a, gravity: 6 } }
    }),

    M({
      id: 'blind_pest', name: 'Blind Pest',
      health: 80, damage: 15, moveSpeed: 6, cost: 8, stages: [1, 2, 3],
      radius: 0.45, height: 1.0, flying: true, hoverHeight: 4.2,
      shape: { kind: 'orb', size: 0.42, shards: 3, wings: true,
               colors: { main: 0xb0a8c8, glow: 0xe4dcff, dark: 0x554d70 } },
      ai: { kind: 'ranged', range: 24, keep: 18, windup: 0.4, cooldown: 1.2,
            shot: { speed: 30, radius: 0.24, coefficient: 0.8, proc: 1, color: 0xd4c8ff } }
    }),

    M({
      id: 'brass_contraption', name: 'Brass Contraption',
      health: 300, damage: 10, moveSpeed: 10, cost: 30, stages: [2, 3, 4, 5],
      radius: 0.55, height: 2.0,
      shape: { kind: 'contraption', size: 0.75,
               colors: { main: 0xb99348, dark: 0x6d5526, glow: 0xffdd88 } },
      ai: { kind: 'ranged', range: 25, keep: 15, windup: 0.35, cooldown: 0.9, burst: 3,
            shot: { speed: 40, radius: 0.22, coefficient: 0.9, proc: 0.6, color: 0xffd070 } }
    }),

    M({
      id: 'imp', name: 'Imp',
      health: 140, damage: 10, moveSpeed: 10, cost: 28, stages: [3, 4, 5],
      radius: 0.5, height: 1.9,
      shape: { kind: 'biped', size: 1.0, horns: true, claws: true,
               colors: { main: 0x3b3050, dark: 0x1e182b, eye: 0xff5a5a } },
      ai: { kind: 'melee', range: 2.8, windup: 0.3, cooldown: 0.9, coefficient: 1.0, proc: 1 }
    }),

    M({
      id: 'stone_golem', name: 'Stone Golem',
      health: 480, damage: 20, moveSpeed: 6.6, cost: 40, stages: [1, 2, 3, 4, 5],
      radius: 1.0, height: 3.2,
      shape: { kind: 'golem', size: 1.5,
               colors: { main: 0x8b8272, dark: 0x4f4a40, eye: 0x9fe8ff } },
      /* Der Laser trifft sofort — dagegen hilft nur Deckung, nicht Ausweichen. */
      ai: { kind: 'ranged', range: 40, keep: 22, windup: 1.1, cooldown: 3.0, hitscan: true,
            shot: { coefficient: 1.0, proc: 1, color: 0x9fe8ff } }
    }),

    /* -------------------------------------------------------- Minibosse */

    M({
      id: 'beetle_guard', name: 'Beetle Guard',
      health: 480, damage: 12, moveSpeed: 7, cost: 40, category: 'miniboss',
      radius: 1.0, height: 2.6, stages: [1, 2, 3, 4, 5],
      shape: { kind: 'quadruped', body: [2.1, 1.3, 1.5], head: 0.8, horns: true, tail: 0,
               colors: { main: 0x9a7040, dark: 0x5f4526, eye: 0xffd06a } },
      ai: { kind: 'melee', range: 3.6, windup: 0.7, cooldown: 1.8, coefficient: 2.0, proc: 1,
            slam: { radius: 5.5, coefficient: 1.2, proc: 0 } }
    }),

    M({
      id: 'clay_templar', name: 'Clay Templar',
      health: 700, damage: 16, moveSpeed: 6, cost: 100, category: 'miniboss',
      radius: 0.8, height: 2.4, stages: [2, 3, 4, 5],
      shape: { kind: 'biped', size: 1.25, pot: true,
               colors: { main: 0xa4552f, dark: 0x5c2c17, eye: 0xffb060 } },
      ai: { kind: 'ranged', range: 26, keep: 12, windup: 0.5, cooldown: 2.2, burst: 4,
            shot: { speed: 22, radius: 0.36, coefficient: 0.9, proc: 0.8, color: 0xd9743c, gravity: 4 } }
    }),

    M({
      id: 'elder_lemurian', name: 'Elder Lemurian',
      health: 900, damage: 16, moveSpeed: 13, cost: 115, category: 'miniboss',
      radius: 0.9, height: 2.4, stages: [1, 2, 3, 4, 5],
      shape: { kind: 'quadruped', body: [2.4, 1.0, 0.95], head: 0.8, tail: 2.2, upright: 0.4, horns: true,
               colors: { main: 0x7a3a6b, dark: 0x46203f, eye: 0xffd070 } },
      ai: { kind: 'ranged', range: 24, keep: 8, windup: 0.7, cooldown: 2.6, burst: 5,
            melee: { range: 3.2, coefficient: 1.4, cooldown: 1.4 },
            shot: { speed: 22, radius: 0.5, coefficient: 0.8, proc: 0.6, color: 0xff9a4a } }
    }),

    M({
      id: 'greater_wisp', name: 'Greater Wisp',
      health: 750, damage: 15, moveSpeed: 7, cost: 200, category: 'miniboss',
      radius: 0.9, height: 2.2, flying: true, hoverHeight: 6.5, stages: [2, 3, 4, 5],
      shape: { kind: 'orb', size: 1.1, shards: 8, ring: true,
               colors: { main: 0xff8a3a, glow: 0xffe1a8, dark: 0x7d3410 } },
      ai: { kind: 'ranged', range: 40, keep: 24, windup: 0.9, cooldown: 2.6, burst: 2,
            shot: { speed: 24, radius: 0.7, coefficient: 1.2, proc: 1, color: 0xffb050,
                    blast: { radius: 4.5, coefficient: 0.6, proc: 0 } } }
    })
  ];

  ROR.Data.monster = function (id) {
    const l = ROR.Data.Monsters;
    for (let i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  };

  /* Alle Karten, die auf dieser Stage vorkommen dürfen, nach Kategorie. */
  ROR.Data.monstersFor = function (stageOrder, category) {
    return ROR.Data.Monsters.filter(function (m) {
      return m.category === category && m.stages.indexOf(stageOrder) >= 0;
    });
  };
})(window.ROR);
