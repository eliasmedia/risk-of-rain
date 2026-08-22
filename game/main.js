/* game/main.js
   Verdrahtung. Hier wird entschieden, in welcher Reihenfolge pro Schritt was
   passiert — und sonst möglichst wenig.

   Reihenfolge der Aktualisierer (kleinere Zahl läuft früher):
     -10 Eingabe    -5 Schwierigkeit    0 Spieler    5 Director
      10 Gegner     15 Interactables   16 Teleporter   18 Beute
      20 Geschosse  30 Bodies         100 Eingabeflanken verwerfen

   Die Schwierigkeit läuft ganz vorn, damit der Director im selben Schritt mit
   dem aktuellen Koeffizienten rechnet. Die Geschosse laufen *nach* Spieler und
   Gegnern, damit ein in diesem Schritt abgefeuerter Schuss auch in diesem
   Schritt fliegt; die Bodies laufen zuletzt, damit Regeneration und
   Bufflaufzeit den bereits verrechneten Schaden sehen. */
(function (ROR) {
  'use strict';

  const Game = {
    player: null,
    stage: null,
    seed: 0,
    stageOrder: 1,
    loop: 0,
    stagesCleared: 0,
    mountainShrines: 0,
    lunarCoins: 0,
    bazaarOffen: false,
    imBazaar: false,
    gewonnen: false,
    started: false,

    /* Ein Seed aus der Adresszeile macht eine Welt reproduzierbar —
       unschätzbar, wenn man einen Geländefehler noch einmal sehen will. */
    readSeed() {
      const m = /[?&]seed=(-?\d+)/.exec(location.search);
      if (m) return parseInt(m[1], 10) >>> 0;
      return (Math.random() * 4294967296) >>> 0;
    },

    /* Trainingspuppen sind ein Prüfwerkzeug, kein Spielinhalt — sie stehen
       nur da, wenn man sie über `?dummies=1` anfordert. */
    wantsDummies() { return /[?&]dummies=1/.test(location.search); },

    difficultyFromUrl() {
      const m = /[?&]schwer=(drizzle|rainstorm|monsoon)/.exec(location.search);
      return m ? m[1] : 'rainstorm';
    },

    /* cfg: {survivor, difficulty, seed} — alles optional. Ohne cfg gelten
       die Vorgaben aus der Adresszeile, damit ?seed= und ?schwer= weiter
       funktionieren. */
    newRun(cfg) {
      cfg = cfg || {};
      Game.config = cfg;
      Game.seed = cfg.seed === undefined ? Game.readSeed() : cfg.seed >>> 0;
      Game.over = false;
      Game.stageOrder = 1;
      Game.loop = 0;
      Game.stagesCleared = 0;
      Game.kills = 0;
      Game.muenzenGesammelt = 0;
      Game.lunarCoins = 2;          // zwei zum Anfangen, damit der Bazaar erreichbar ist
      Game.bazaarOffen = false;
      Game.imBazaar = false;
      Game.gewonnen = false;

      ROR.Body.clear();
      ROR.Difficulty.reset(cfg.difficulty || Game.difficultyFromUrl());

      const def = ROR.Data.survivor(cfg.survivor || 'commando');
      Game.player = null;
      Game.buildWorld(1, Game.seed);

      Game.player = ROR.Player.create(def, {
        x: Game.stage.spawn.x, y: Game.stage.spawn.y + 0.5, z: Game.stage.spawn.z
      });
      Game.player.onLevelUp = function (lvl) { ROR.HUD.toast('Stufe ' + lvl); };
      Game.player.onDeath = function () { endRun(); };
      ROR.HUD.buildSkills(def);
      ROR.Menus.hideResults();

      ROR.Artifacts.runStart(Game.player);
      Game.afterStage();
      ROR.Engine.time = 0;
    },

    /* Artefakt Metamorphosis: die Figur wird getauscht, alles Gesammelte
       bleibt. Deshalb wird nicht neu angefangen, sondern nur das Modell
       ersetzt und der Besitz umgehängt. */
    switchSurvivor(def) {
      const alt = Game.player;
      if (!alt || alt.def.id === def.id) return;
      const merk = {
        items: alt.body.items, equipment: alt.body.equipment,
        level: alt.body.level, exp: alt.exp, gold: alt.gold,
        anteil: alt.body.healthFraction,
        pos: alt.position.clone()
      };
      ROR.Engine.scene.remove(alt.object);
      alt.body.remove();

      Game.player = ROR.Player.create(def, { x: merk.pos.x, y: merk.pos.y, z: merk.pos.z });
      const b = Game.player.body;
      b.items = merk.items;
      b.equipment = merk.equipment;
      Game.player.exp = merk.exp;
      Game.player.gold = merk.gold;
      Game.player.onLevelUp = function (lvl) { ROR.HUD.toast('Stufe ' + lvl); };
      Game.player.onDeath = function () { endRun(); };
      ROR.Items.rebuild(b);
      b.setLevel(merk.level);
      b.health = b.stats.maxHealth * merk.anteil;
      ROR.HUD.buildSkills(def);
      ROR.Attire.refresh(Game.player);
      ROR.Camera.init(Game.player);
      ROR.HUD.toast('Du bist jetzt ' + def.name);
    },

    /* Baut Gelände, Objekte und Gegnerdeck neu auf. Der Spieler bleibt, wenn
       es ihn schon gibt — genau das unterscheidet einen Stagewechsel von
       einem neuen Durchlauf. */
    buildWorld(order, seed) {
      ROR.Monsters.clear();
      ROR.Dummy.clear();
      ROR.Interactables.clear();
      ROR.Loot.clear();
      ROR.Deployables.clear();
      ROR.Teleporter.clear();
      if (Game.player) ROR.Body.clearExcept(Game.player.body);

      const themen = ROR.Data.stageByOrder(order);
      const theme = themen[(seed >>> 3) % themen.length];
      Game.stage = ROR.Stage.load(theme, seed);
      ROR.Projectiles.init();
      ROR.Loot.init();
      ROR.Deployables.init();
      ROR.Director.beginStage(order, seed);
      Game.mountainShrines = 0;
      const anzahl = ROR.Interactables.populate(Game.stage, order, seed);
      ROR.Teleporter.place(Game.stage, seed);

      console.log('[ROR] Stage ' + order + ' »' + theme.name + '«, Seed ' + seed
                + ', Loop ' + Game.loop + ', ' + anzahl + ' Objekte');
    },

    /* Alles, was nach dem Aufbau am Spieler passieren muss. */
    afterStage() {
      const p = Game.player;
      p.position.set(Game.stage.spawn.x, Game.stage.spawn.y + 0.5, Game.stage.spawn.z);
      p.velocity.set(0, 0, 0);
      p.body.position = p.object.position;
      if (ROR.Body.all.indexOf(p.body) < 0) ROR.Body.all.push(p.body);
      ROR.Items.rebuild(p.body);
      ROR.Attire.refresh(p);
      ROR.Items.stageStart(p.body);
      ROR.Artifacts.stageStart(p);
      ROR.Camera.init(Game.player);
      ROR.Camera.yaw = Math.atan2(-(Game.stage.spawn.x), -(Game.stage.spawn.z));
      if (Game.wantsDummies()) ROR.Dummy.placeNear(Game.stage, Game.stage.spawn);
      ROR.HUD.stageBanner(Game.stage.theme, Game.loop);
    },

    /* Der Sprung ins nächste Environment. Hier springt auch der
       Schwierigkeitskoeffizient um den Faktor 1.15. */
    /* Der Bazaar liegt zwischen den Stages: man geht hinein, kauft mit
       Mondmünzen und kommt an derselben Stelle wieder heraus. Deshalb zählt
       er weder als Stage noch für den Koeffizienten. */
    enterBazaar() {
      if (Game.imBazaar) return;
      Game.imBazaar = true;
      Game.bazaarOffen = false;
      // Die Herkunft merken: der Bazaar ist kein Platz in der Reihenfolge.
      Game.vorBazaar = Game.stageOrder;
      Game.stageOrder = 0;
      Game.buildWorld(0, (Game.seed + Game.stagesCleared * 7919) >>> 0);
      Game.afterStage();
    },

    leaveBazaar() {
      Game.imBazaar = false;
      Game.stageOrder = Game.vorBazaar || 1;
      Game.nextStage();
    },

    nextStage() {
      /* Beim Verlassen einer Stage wird das Guthaben in Erfahrung umgewandelt.
         Genau das hält die Wirtschaft in Bewegung: drüben fängt man wieder bei
         null an und muss erst sammeln, statt mit einem Berg Gold anzukommen und
         die halbe Stage auf einen Schlag leerzukaufen. Der Goldregen des
         Teleporters ist deshalb dazu da, *noch auf dieser Stage* ausgegeben zu
         werden. */
      const rest = Math.floor(Game.player.gold);
      if (rest > 0) {
        Game.player.gold = 0;
        Game.player.addExp(rest);
        ROR.HUD.toast(rest + ' Gold  →  Erfahrung', 'gold');
      }

      Game.stagesCleared++;
      ROR.Difficulty.advanceStage();

      /* Nach Sky Meadow steht im ersten Durchgang Commencement an — das ist
         das Ende des Laufs. Wer weiterspielt, landet danach wieder bei
         Stage 1 und der Loop beginnt. */
      if (Game.stageOrder === 5 && Game.loop === 0) Game.stageOrder = 6;
      else if (Game.stageOrder >= 6) { Game.stageOrder = 1; Game.loop++; }
      else Game.stageOrder++;
      if (Game.stageOrder > 5 && Game.stageOrder !== 6) { Game.stageOrder = 1; Game.loop++; }
      const seed = (Game.seed + Game.stagesCleared * 0x9e3779b9) >>> 0;
      Game.buildWorld(Game.stageOrder, seed);
      Game.afterStage();
    },

    boot() {
      const canvas = document.getElementById('gl');

      if (!window.THREE) {
        return fail('Three.js wurde nicht geladen. Liegt game/lib/three.min.js an seinem Platz?');
      }
      try {
        ROR.Engine.init(canvas);
      } catch (e) {
        return fail('WebGL lässt sich nicht starten: ' + e.message);
      }

      ROR.Save.load();
      ROR.Input.init(canvas);
      // Klang startet erst bei der ersten Eingabe — vorher lässt der Browser
      // ihn ohnehin nicht zu.
      ['pointerdown', 'keydown'].forEach(function (e) {
        addEventListener(e, function () { ROR.Audio.start(); }, { once: false });
      });
      ROR.HUD.init();
      ROR.Menus.init();
      // Ein Durchlauf wird erst gebaut, wenn im Menü gestartet wird.
      Game.newRun();
      ROR.Menus.show();

      ROR.Engine.onUpdate(function () {
        ROR.Input.beginFrame();
        if (ROR.Input.pressed('debug')) ROR.HUD.toggleDebug();
        if (ROR.Input.pressed('pause')) togglePause();
        const fertig = Game.over || Game.gewonnen;
        if (fertig && ROR.Input.key('Enter')) Game.newRun(Game.config);
      }, -10);

      ROR.Engine.onUpdate(function (dt) { if (!Game.over) ROR.Difficulty.update(dt); }, -5);
      ROR.Engine.onUpdate(function (dt) { Game.player.update(dt); }, 0);
      ROR.Engine.onUpdate(function (dt) { ROR.Director.update(dt); }, 5);
      ROR.Engine.onUpdate(function (dt) { ROR.Monsters.update(dt); }, 10);
      ROR.Engine.onUpdate(function (dt) { ROR.Dummy.update(dt); }, 12);
      ROR.Engine.onUpdate(function (dt) { ROR.Interactables.update(dt); }, 15);
      ROR.Engine.onUpdate(function (dt) { ROR.Teleporter.update(dt); }, 16);
      ROR.Engine.onUpdate(function (dt) { ROR.Loot.update(dt); }, 18);
      ROR.Engine.onUpdate(function (dt) { ROR.Attire.update(dt); }, 25);
      ROR.Engine.onUpdate(function () { ROR.Save.tick(); }, 99);
      ROR.Engine.onUpdate(function (dt) { ROR.Deployables.update(dt); }, 19);
      ROR.Engine.onUpdate(function (dt) { ROR.Projectiles.update(dt); }, 20);
      ROR.Engine.onUpdate(function (dt) { ROR.Body.updateAll(dt); }, 30);

      /* Flanken erst ganz am Ende verwerfen, damit sie jeder Schritt sieht —
         aber nur der erste. */
      ROR.Engine.onUpdate(function () { ROR.Input.endFrame(); }, 100);

      /* Je Bild statt je Simulationsschritt: Blick und Anzeigen. */
      ROR.Engine.onFrame(function (dt) {
        ROR.Camera.update(dt);
        Game.stage.followShadow(Game.player.position);
        ROR.HUD.update(Game, dt);
        if (ROR.Input.isLocked) ROR.HUD.hideHint();
      });

      ROR.Engine.start();
      Game.started = true;
    }
  };

  /* Die Bilanz eines Durchlaufs — dieselbe Form für Sieg und Tod, damit der
     Ergebnisbildschirm nur einen Fall kennen muss. */
  function bilanz(sieg) {
    const p = Game.player;
    const liste = [];
    for (const id in p.body.items) {
      const d = ROR.Items.def(id);
      if (d && !d.scrap) liste.push({ name: d.name, tier: d.tier, n: p.body.items[id] });
    }
    liste.sort(function (a, b) { return b.n - a.n; });
    return {
      sieg: !!sieg, figur: p.def.name, schwer: ROR.Difficulty.mode.name,
      zeit: ROR.Difficulty.runTime, stages: Game.stagesCleared + 1,
      stufe: p.body.level, kills: Game.kills, items: ROR.Items.total(p.body),
      muenzen: Game.muenzenGesammelt, coeff: ROR.Difficulty.coeff, itemListe: liste
    };
  }

  function beende(sieg) {
    ROR.Audio.spiel(sieg ? 'sieg' : 'tod');
    ROR.Director.stop();
    ROR.Input.unlock();
    const b = bilanz(sieg);
    const neu = ROR.Save.notiereLauf(b);
    ROR.Menus.showResults(b, neu);
  }

  Game.onVictory = function () {
    if (Game.gewonnen || Game.over) return;
    Game.gewonnen = true;
    beende(true);
  };

  function endRun() {
    if (Game.over || Game.gewonnen) return;
    Game.over = true;
    beende(false);
  }

  function togglePause() {
    if (ROR.Menus.open || ROR.Menus.choosing) return;
    if (Game.over || Game.gewonnen) { ROR.Menus.hideResults(); ROR.Menus.show(); return; }
    const p = !ROR.Engine.isPaused;
    ROR.Engine.setPaused(p);
    if (p) { ROR.Input.unlock(); ROR.Menus.showPause(); }
    else ROR.Menus.hidePause();
  }

  function fail(message) {
    const box = document.getElementById('hint');
    box.classList.remove('hidden');
    box.innerHTML = '<b>Start nicht möglich</b><br>' + message;
    console.error('[ROR] ' + message);
  }

  ROR.Game = Game;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', Game.boot);
  } else {
    Game.boot();
  }
})(window.ROR);
