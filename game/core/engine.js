/* game/core/engine.js
   Renderer, Szene, Uhr und Hauptschleife.

   Die Simulation läuft mit festem Takt (60 Hz), das Bild so schnell wie der
   Bildschirm mag. Ohne festen Takt hängen Sprunghöhe, Abklingzeiten und die
   Credits des Directors an der Bildrate — auf einem 144-Hz-Monitor wäre das
   Spiel dann ein anderes. */
(function (ROR) {
  'use strict';

  const STEP = 1 / 60;        // Sekunden je Simulationsschritt
  const MAX_STEPS = 5;        // danach wird Zeit verworfen statt aufgeholt

  const updaters = [];        // {fn, order}
  let renderer = null, scene = null, camera = null, canvas = null;
  let accumulator = 0, lastTime = 0, running = false, paused = false;
  let frameCallback = null;

  const stats = { fps: 0, frameMs: 0, steps: 0, draws: 0, tris: 0 };
  let fpsAccum = 0, fpsFrames = 0;

  const Engine = {
    /* Sekunden seit Start der laufenden Runde — die Spielzeit, nicht die Uhrzeit.
       Läuft nur, während simuliert wird, und ist damit die Grundlage des
       Schwierigkeitskoeffizienten. */
    time: 0,
    step: STEP,

    init(targetCanvas) {
      canvas = targetCanvas;

      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        powerPreference: 'high-performance',
        stencil: false
      });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;

      scene = new THREE.Scene();
      // Nahgrenze bewusst nicht kleiner: 0.2 bis 4000 ist das Verhältnis, bei dem
      // der Tiefenpuffer auf entfernten Klippen noch nicht zu flimmern anfängt.
      camera = new THREE.PerspectiveCamera(70, 1, 0.2, 4000);

      Engine.renderer = renderer;
      Engine.scene = scene;
      Engine.camera = camera;

      addEventListener('resize', Engine.resize);
      // Kommt der Bildschirm aus dem Hintergrund zurück, wäre der erste
      // Zeitschritt sonst mehrere Sekunden groß.
      document.addEventListener('visibilitychange', () => { lastTime = 0; });
      Engine.resize();
      return Engine;
    },

    resize() {
      const w = innerWidth, h = innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },

    /* Kleinere `order` läuft früher. Eingabe -1, Spieler 0, Gegner 10,
       Geschosse 20, Kamera 90 — so ist die Reihenfolge sichtbar statt geraten. */
    onUpdate(fn, order) {
      updaters.push({ fn: fn, order: order || 0 });
      updaters.sort((a, b) => a.order - b.order);
      return fn;
    },

    offUpdate(fn) {
      const i = updaters.findIndex((u) => u.fn === fn);
      if (i >= 0) updaters.splice(i, 1);
    },

    /* Läuft einmal je *Bild* (nicht je Simulationsschritt) direkt vors Zeichnen.
       Für Kamera und HUD, die keine feste Schrittweite brauchen. */
    onFrame(fn) { frameCallback = fn; },

    setPaused(v) { paused = v; if (!v) lastTime = 0; },
    get isPaused() { return paused; },

    start() {
      if (running) return;
      running = true;
      requestAnimationFrame(loop);
    },

    stats: stats
  };

  function loop(now) {
    if (!running) return;
    requestAnimationFrame(loop);

    const t0 = now;
    if (!lastTime) lastTime = now;
    let elapsed = (now - lastTime) / 1000;
    lastTime = now;
    if (elapsed > 0.25) elapsed = 0.25;   // nach einem Hänger nicht aufholen

    stats.steps = 0;
    if (!paused) {
      accumulator += elapsed;
      let guard = MAX_STEPS;
      while (accumulator >= STEP && guard-- > 0) {
        accumulator -= STEP;
        Engine.time += STEP;
        for (let i = 0; i < updaters.length; i++) updaters[i].fn(STEP);
        stats.steps++;
      }
      if (guard <= 0) accumulator = 0;
    }

    if (frameCallback) frameCallback(elapsed);
    renderer.render(scene, camera);

    // Bildrate über eine halbe Sekunde mitteln, sonst flackert die Anzeige.
    fpsAccum += elapsed; fpsFrames++;
    if (fpsAccum >= 0.5) {
      stats.fps = Math.round(fpsFrames / fpsAccum);
      fpsAccum = 0; fpsFrames = 0;
    }
    // Zeichenaufrufe kommen ungemittelt aus dem Renderer — sie schwanken kaum
    // und wären als Halbsekundenmittel nur irreführend.
    stats.draws = renderer.info.render.calls;
    stats.tris = renderer.info.render.triangles;
    stats.frameMs = performance.now() - t0;
  }

  ROR.Engine = Engine;
})(window.ROR);
