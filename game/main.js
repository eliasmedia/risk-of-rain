/* game/main.js
   Verdrahtung. Hier wird entschieden, in welcher Reihenfolge pro Schritt was
   passiert — und sonst möglichst wenig.

   Reihenfolge der Aktualisierer (kleinere Zahl läuft früher):
     -10 Eingabe einlesen        0 Spieler       10 Gegner
      20 Geschosse              90 Kamera      100 Eingabeflanken verwerfen */
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

    newRun(seed) {
      Game.seed = seed === undefined ? Game.readSeed() : seed >>> 0;

      const theme = ROR.Data.stageByOrder(1)[0];
      Game.stage = ROR.Stage.load(theme, Game.seed);

      const spawn = Game.stage.spawn;
      Game.player = ROR.Player.create({ x: spawn.x, y: spawn.y + 0.5, z: spawn.z });
      ROR.Camera.init(Game.player);
      ROR.Camera.yaw = Math.atan2(-spawn.x, -spawn.z);   // zur Inselmitte schauen

      ROR.Engine.time = 0;
      console.log('[ROR] Stage »' + theme.name + '«, Seed ' + Game.seed);
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

      /* Eingabe: Achsen zusammensetzen, ganz am Anfang des Schritts. */
      ROR.Engine.onUpdate(function () {
        ROR.Input.beginFrame();
        if (ROR.Input.pressed('debug')) ROR.HUD.toggleDebug();
        if (ROR.Input.pressed('pause')) togglePause();
      }, -10);

      ROR.Engine.onUpdate(function (dt) { Game.player.update(dt); }, 0);

      /* Flanken erst ganz am Ende verwerfen, damit sie jeder Schritt sieht —
         aber nur der erste. */
      ROR.Engine.onUpdate(function () { ROR.Input.endFrame(); }, 100);

      /* Je Bild statt je Simulationsschritt: Blick und Anzeigen. */
      ROR.Engine.onFrame(function (dt) {
        ROR.Camera.update(dt);
        Game.stage.followShadow(Game.player.position);
        ROR.HUD.update(Game);
        if (ROR.Input.isLocked) ROR.HUD.hideHint();
      });

      ROR.Engine.start();
      Game.started = true;
    }
  };

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
