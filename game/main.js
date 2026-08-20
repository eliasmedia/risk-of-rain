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

    newRun(seed) {
      Game.seed = seed === undefined ? Game.readSeed() : seed >>> 0;
      Game.over = false;
      Game.stageOrder = 1;
      Game.loop = 0;
      Game.stagesCleared = 0;

      ROR.Body.clear();
      ROR.Difficulty.reset(Game.difficultyFromUrl());

      const def = ROR.Data.survivor('commando');
      Game.player = null;
      Game.buildWorld(1, Game.seed);

      Game.player = ROR.Player.create(def, {
        x: Game.stage.spawn.x, y: Game.stage.spawn.y + 0.5, z: Game.stage.spawn.z
      });
      Game.player.onLevelUp = function (lvl) { ROR.HUD.toast('Stufe ' + lvl); };
      Game.player.onDeath = function () { endRun(); };
      ROR.HUD.buildSkills(def);
      ROR.HUD.setDead(false);

      Game.afterStage();
      ROR.Engine.time = 0;
    },

    /* Baut Gelände, Objekte und Gegnerdeck neu auf. Der Spieler bleibt, wenn
       es ihn schon gibt — genau das unterscheidet einen Stagewechsel von
       einem neuen Durchlauf. */
    buildWorld(order, seed) {
      ROR.Monsters.clear();
      ROR.Dummy.clear();
      ROR.Interactables.clear();
      ROR.Loot.clear();
      ROR.Teleporter.clear();
      if (Game.player) ROR.Body.clearExcept(Game.player.body);

      const themen = ROR.Data.stageByOrder(order);
      const theme = themen[(seed >>> 3) % themen.length];
      Game.stage = ROR.Stage.load(theme, seed);
      ROR.Projectiles.init();
      ROR.Loot.init();
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
      ROR.Items.stageStart(p.body);
      ROR.Camera.init(p);
      ROR.Camera.yaw = Math.atan2(-(Game.stage.spawn.x), -(Game.stage.spawn.z));
      if (Game.wantsDummies()) ROR.Dummy.placeNear(Game.stage, Game.stage.spawn);
      ROR.HUD.stageBanner(Game.stage.theme, Game.loop);
    },

    /* Der Sprung ins nächste Environment. Hier springt auch der
       Schwierigkeitskoeffizient um den Faktor 1.15. */
    nextStage() {
      Game.stagesCleared++;
      ROR.Difficulty.advanceStage();
      Game.stageOrder++;
      if (Game.stageOrder > 5) { Game.stageOrder = 1; Game.loop++; }
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

      ROR.Input.init(canvas);
      ROR.HUD.init();
      Game.newRun();

      ROR.Engine.onUpdate(function () {
        ROR.Input.beginFrame();
        if (ROR.Input.pressed('debug')) ROR.HUD.toggleDebug();
        if (ROR.Input.pressed('pause')) togglePause();
        if (Game.over && ROR.Input.key('Enter')) Game.newRun();
      }, -10);

      ROR.Engine.onUpdate(function (dt) { if (!Game.over) ROR.Difficulty.update(dt); }, -5);
      ROR.Engine.onUpdate(function (dt) { Game.player.update(dt); }, 0);
      ROR.Engine.onUpdate(function (dt) { ROR.Director.update(dt); }, 5);
      ROR.Engine.onUpdate(function (dt) { ROR.Monsters.update(dt); }, 10);
      ROR.Engine.onUpdate(function (dt) { ROR.Dummy.update(dt); }, 12);
      ROR.Engine.onUpdate(function (dt) { ROR.Interactables.update(dt); }, 15);
      ROR.Engine.onUpdate(function (dt) { ROR.Teleporter.update(dt); }, 16);
      ROR.Engine.onUpdate(function (dt) { ROR.Loot.update(dt); }, 18);
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

  function endRun() {
    if (Game.over) return;
    Game.over = true;
    ROR.Director.stop();
    ROR.Input.unlock();
    ROR.HUD.setDead(true);
  }

  function togglePause() {
    const p = !ROR.Engine.isPaused;
    ROR.Engine.setPaused(p);
    if (p) { ROR.Input.unlock(); ROR.HUD.showHint(); }
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
