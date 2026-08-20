/* game/main.js
   Verdrahtung. Hier wird entschieden, in welcher Reihenfolge pro Schritt was
   passiert — und sonst möglichst wenig.

   Reihenfolge der Aktualisierer (kleinere Zahl läuft früher):
     -10 Eingabe    -5 Schwierigkeit    0 Spieler    5 Director
      10 Gegner     20 Geschosse       30 Bodies   100 Eingabeflanken verwerfen

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

      ROR.Monsters.clear();
      ROR.Dummy.clear();
      ROR.Body.clear();
      ROR.Difficulty.reset(Game.difficultyFromUrl());

      const theme = ROR.Data.stageByOrder(1)[0];
      Game.stage = ROR.Stage.load(theme, Game.seed);
      ROR.Projectiles.init();

      const def = ROR.Data.survivor('commando');
      const spawn = Game.stage.spawn;
      Game.player = ROR.Player.create(def, { x: spawn.x, y: spawn.y + 0.5, z: spawn.z });
      Game.player.onLevelUp = function (lvl) { ROR.HUD.toast('Stufe ' + lvl); };
      Game.player.onDeath = function () { endRun(); };
      ROR.HUD.buildSkills(def);
      ROR.HUD.setDead(false);

      if (Game.wantsDummies()) ROR.Dummy.placeNear(Game.stage, spawn);
      ROR.Director.beginStage(theme.order, Game.seed);

      ROR.Camera.init(Game.player);
      ROR.Camera.yaw = Math.atan2(-spawn.x, -spawn.z);   // zur Inselmitte schauen

      ROR.Engine.time = 0;
      console.log('[ROR] Stage »' + theme.name + '«, Seed ' + Game.seed
                + ', ' + ROR.Difficulty.mode.name);
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
