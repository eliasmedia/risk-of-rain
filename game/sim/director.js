/* game/sim/director.js
   Der Combat Director — warum sich das Spiel immer angespannt anfühlt.

   Er tut nichts anderes, als Credits zu sammeln und sie möglichst vollständig
   auszugeben:

     credits/s = creditMultiplier × (1 + 0.4 × coeff) × (spieler + 1) / 2

   Weil der Koeffizient mit Zeit und Stages wächst, wächst der Zufluss mit —
   und weil der Director am liebsten *alles auf einmal* ausgibt, verschiebt
   sich das Bild von einzelnen Käfern zu Rudeln und schließlich zu Minibossen,
   ohne dass irgendwo eine Wellentabelle steht.

   Zwei Directors laufen parallel, wie in der Vorlage: einer gibt oft kleine
   Beträge aus, einer selten große. Der langsame ist der, der einem im Rücken
   plötzlich einen Beetle Guard hinstellt.

   Die „zu billig"-Regel ist das Herz der Eskalation: hat der Director mehr als
   das Sechsfache dessen, was der gewählte Gegner kostet, verwirft er die Wahl
   und würfelt neu — es sei denn, es gibt nichts Teureres. Dadurch spart er auf
   das Große, statt zwanzig Käfer zu stellen. */
(function (ROR) {
  'use strict';

  const U = ROR.Util;

  /* Anteile der drei Kategorien an der Auswahl. */
  const CATEGORY_WEIGHTS = { basic: 0.70, miniboss: 0.25, champion: 0.05 };

  /* Kostenfaktor der Elite-Stufen. Elites selbst kommen in Stufe 7; die
     Struktur steht hier schon, weil der Director sonst später neu geschrieben
     werden müsste. */
  const ELITE_TIERS = [
    { tier: 0, costMult: 1 }
  ];

  const MAX_PER_WAVE = 5;

  function makeDirector(opts) {
    return {
      name: opts.name,
      creditMultiplier: opts.creditMultiplier,
      spendMin: opts.spendMin,
      spendMax: opts.spendMax,
      credits: opts.startCredits || 0,
      nextSpend: opts.spendMin,
      /* Läuft eine Welle, bleiben Karte und Elite-Stufe erhalten. */
      card: null,
      tier: ELITE_TIERS[0],
      waveLeft: 0,
      lastSuccess: false
    };
  }

  const Director = {
    CATEGORY_WEIGHTS: CATEGORY_WEIGHTS,
    active: false,
    decks: { basic: [], miniboss: [], champion: [] },
    directors: [],
    /* Wie weit vom Spieler entfernt gespawnt wird. */
    minRange: 24,
    maxRange: 65,

    /* Zu Stage-Beginn wird aus dem Vorrat ein Deck gezogen. Dadurch fühlen
       sich zwei Durchläufe derselben Stage verschieden an, statt immer
       dieselbe Mischung zu zeigen. */
    beginStage(stageOrder, seed) {
      const rng = U.Rng((seed >>> 0) ^ 0xc0ffee);
      const A = ROR.Artifacts;
      const pick = (cat, keep) => {
        // Dissonance hebt die Stagezugehörigkeit auf: alles kann überall kommen.
        const all = A.ignoresStageList()
          ? ROR.Data.Monsters.filter((m) => m.category === cat)
          : ROR.Data.monstersFor(stageOrder, cat);
        rng.shuffle(all);
        return all.slice(0, Math.min(keep, all.length));
      };
      Director.decks.basic = pick('basic', 4);
      Director.decks.miniboss = pick('miniboss', 2);
      Director.decks.champion = pick('champion', 1);
      A.shapeDeck(Director.decks, rng);

      Director.directors = [
        makeDirector({ name: 'fast', creditMultiplier: 0.75, spendMin: 0.7, spendMax: 2.2, startCredits: 40 }),
        makeDirector({ name: 'slow', creditMultiplier: 0.75, spendMin: 9, spendMax: 24, startCredits: 0 })
      ];
      Director.active = true;
    },

    stop() { Director.active = false; },

    update(dt) {
      if (!Director.active) return;
      const p = ROR.Game.player;
      if (!p || !p.body.alive) return;

      const coeff = ROR.Difficulty.coeff;
      const players = ROR.Difficulty.playerCount;
      const rate = (1 + 0.4 * coeff) * (players + 1) / 2 * ROR.Artifacts.creditMult();

      for (let i = 0; i < Director.directors.length; i++) {
        const d = Director.directors[i];
        d.credits += d.creditMultiplier * rate * dt;
        d.nextSpend -= dt;
        if (d.nextSpend > 0) continue;
        d.nextSpend = U.chaos.range(d.spendMin, d.spendMax);
        spend(d, p);
      }
    },

    /* Zusätzliche Credits von außen — der Kampfschrein kauft damit eine
       Welle ein, ohne dass er eigene Spawnlogik bräuchte. */
    gift(credits) {
      if (!Director.directors.length) return;
      Director.directors[0].credits += credits;
      Director.directors[0].nextSpend = 0.2;
    },

    /* Für die Technikanzeige. */
    debugLine() {
      if (!Director.active) return 'director  aus';
      return Director.directors.map(function (d) {
        return d.name + ' ' + d.credits.toFixed(0) + 'c';
      }).join('  ') + '   gegner ' + ROR.Monsters.list.length + '/' + ROR.Monsters.cap;
    }
  };

  /* Alle Karten, die dieser Director gerade bezahlen könnte. */
  function affordable(credits) {
    const out = [];
    ['basic', 'miniboss', 'champion'].forEach(function (cat) {
      const deck = Director.decks[cat];
      for (let i = 0; i < deck.length; i++) if (deck[i].cost <= credits) out.push(deck[i]);
    });
    return out;
  }

  function chooseCard(credits) {
    const cats = [];
    ['basic', 'miniboss', 'champion'].forEach(function (cat) {
      if (Director.decks[cat].some((m) => m.cost <= credits)) {
        cats.push({ cat: cat, weight: CATEGORY_WEIGHTS[cat] });
      }
    });
    if (!cats.length) return null;
    const chosen = U.chaos.weighted(cats);
    const deck = Director.decks[chosen.cat].filter((m) => m.cost <= credits);
    return deck.length ? U.chaos.pick(deck) : null;
  }

  function spend(d, player) {
    if (ROR.Monsters.list.length >= ROR.Monsters.cap) return;

    // Läuft eine Welle weiter, bleiben Karte und Elite-Stufe stehen.
    if (!(d.lastSuccess && d.waveLeft > 0 && d.card && d.card.cost <= d.credits)) {
      const pool = affordable(d.credits);
      if (!pool.length) { d.lastSuccess = false; return; }
      const priciest = pool.reduce((a, b) => (b.cost > a.cost ? b : a));

      let card = null;
      for (let tries = 0; tries < 6; tries++) {
        card = chooseCard(d.credits);
        if (!card) break;
        // „Zu billig": lieber sparen, solange es überhaupt etwas Teureres gibt.
        const tooCheap = d.credits > 6 * card.cost && card.cost < priciest.cost;
        if (!tooCheap) break;
      }
      if (!card) { d.lastSuccess = false; return; }
      d.card = card;
      d.tier = ELITE_TIERS[0];
      d.waveLeft = MAX_PER_WAVE;
    }

    const cost = d.card.cost * d.tier.costMult;
    if (cost > d.credits) { d.lastSuccess = false; return; }

    const spot = findSpawnPoint(player, d.card);
    if (!spot) { d.lastSuccess = false; return; }

    const m = ROR.Monsters.spawn(d.card, ROR.Difficulty.spawnLevel, spot);
    if (!m) { d.lastSuccess = false; return; }

    d.credits -= cost;
    d.waveLeft--;
    d.lastSuccess = true;
    // Innerhalb einer Welle folgt der nächste Gegner sofort — daher der Rudel-Eindruck.
    if (d.waveLeft > 0 && d.credits >= cost) d.nextSpend = 0.25;
  }

  const _spot = new THREE.Vector3();
  const _to = new THREE.Vector3();

  /* Sucht begehbaren Boden in Reichweite, möglichst außerhalb des Blickfelds.
     Die ersten Versuche verlangen beides, die letzten nehmen, was da ist —
     sonst spawnt auf engen Stages irgendwann gar nichts mehr. */
  function findSpawnPoint(player, def) {
    const stage = ROR.Stage.current;
    const terrain = stage.terrain;
    const cam = ROR.Engine.camera;
    ROR.Camera.aim(_to);

    for (let tries = 0; tries < 42; tries++) {
      const a = U.chaos.next() * U.TAU;
      const dist = U.chaos.range(Director.minRange, Director.maxRange);
      const x = player.position.x + Math.cos(a) * dist;
      const z = player.position.z + Math.sin(a) * dist;
      if (!terrain.isWalkable(x, z, def.flying ? 0.9 : 0.4)) continue;

      const y = terrain.heightAt(x, z);
      if (tries < 26) {
        // Vor der Kamera nur zulassen, wenn Gelände die Sicht ohnehin nimmt.
        _spot.set(x - cam.position.x, y + 1 - cam.position.y, z - cam.position.z);
        const d = _spot.length();
        _spot.divideScalar(d);
        if (_spot.dot(_to) > 0.35 && stage.clearance(cam.position, _spot, d, 1.2) >= d - 2) continue;
      }
      return new THREE.Vector3(x, def.flying ? y + def.hoverHeight : y, z);
    }
    return null;
  }

  ROR.Director = Director;
})(window.ROR);
