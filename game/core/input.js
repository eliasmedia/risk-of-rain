/* game/core/input.js
   Tastatur, Maus und Mausblick. Alles Spielrelevante läuft über *Aktionen*,
   nicht über Tastencodes — dadurch kann die Touch-Steuerung später dieselben
   Aktionen bedienen, ohne dass irgendeine andere Datei davon erfährt. */
(function (ROR) {
  'use strict';


  /* Belegung wie im Original: Sprint auf Strg, Utility auf Shift, Interagieren
     auf E, Ausrüstung auf Q. Mehrere Tasten je Aktion sind erlaubt. */
  const BINDINGS = {
    forward:   ['KeyW', 'ArrowUp'],
    back:      ['KeyS', 'ArrowDown'],
    left:      ['KeyA', 'ArrowLeft'],
    right:     ['KeyD', 'ArrowRight'],
    jump:      ['Space'],
    sprint:    ['ControlLeft', 'ControlRight'],
    interact:  ['KeyE'],
    primary:   ['Mouse0'],
    secondary: ['Mouse2'],
    utility:   ['ShiftLeft', 'ShiftRight'],
    special:   ['KeyR'],
    equipment: ['KeyQ'],
    ping:      ['Mouse1'],
    pause:     ['KeyM', 'Escape'],
    debug:     ['F3'],
    info:      ['Tab']
  };

  /* Tasten, die der Browser sonst wegnimmt (Scrollen, Fokuswechsel, Suche). */
  const SWALLOW = new Set(['Space', 'Tab', 'F3', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

  const held = new Set();       // gerade gedrückte Tastencodes
  const virtual = new Set();    // von der Touch-Steuerung gesetzte Aktionen
  const downThisFrame = new Set();
  const upThisFrame = new Set();

  let lookDX = 0, lookDY = 0;   // seit dem letzten Bild aufgelaufene Blickbewegung
  let dragging = false, lastX = 0, lastY = 0;
  let locked = false;
  let relockGuard = 0;          // verwirft die ersten Bilder nach dem Zeigerfang
  let sensitivity = 0.0022;
  let canvas = null;
  let enabled = true;

  /* Der Zeiger springt beim Wiederfangen gelegentlich um absurde Beträge und
     man schaut plötzlich nach hinten. Solche Einzelbilder werden verworfen. */
  const MAX_JUMP = 260;

  function isDown(code) { return held.has(code); }

  function actionDown(action) {
    if (virtual.has(action)) return true;
    const keys = BINDINGS[action];
    if (!keys) return false;
    for (let i = 0; i < keys.length; i++) if (held.has(keys[i])) return true;
    return false;
  }

  function actionPressed(action) {
    if (virtual.has('~' + action)) return true;   // einmaliger Touch-Impuls
    const keys = BINDINGS[action];
    if (!keys) return false;
    for (let i = 0; i < keys.length; i++) if (downThisFrame.has(keys[i])) return true;
    return false;
  }

  function actionReleased(action) {
    const keys = BINDINGS[action];
    if (!keys) return false;
    for (let i = 0; i < keys.length; i++) if (upThisFrame.has(keys[i])) return true;
    return false;
  }

  function press(code) {
    if (!enabled) return;
    if (!held.has(code)) downThisFrame.add(code);
    held.add(code);
  }

  function release(code) {
    if (held.delete(code)) upThisFrame.add(code);
  }

  function onKeyDown(e) {
    if (e.repeat) { if (SWALLOW.has(e.code)) e.preventDefault(); return; }
    press(e.code);
    if (SWALLOW.has(e.code)) e.preventDefault();
  }

  function onKeyUp(e) { release(e.code); }

  /* Verliert das Fenster den Fokus, bleiben sonst Tasten hängen. */
  function onBlur() {
    held.forEach((c) => upThisFrame.add(c));
    held.clear();
    dragging = false;
  }

  function onMouseDown(e) {
    if (e.target !== canvas && !locked) return;
    press('Mouse' + e.button);
    if (!locked) {
      dragging = true;
      lastX = e.clientX; lastY = e.clientY;
    }
    if (e.button === 1) e.preventDefault();   // Mittelklick scrollt sonst
  }

  function onMouseUp(e) {
    release('Mouse' + e.button);
    if (e.button === 0) dragging = false;
  }

  function onMouseMove(e) {
    if (locked) {
      if (relockGuard > 0) { relockGuard--; return; }
      accumulateLook(e.movementX || 0, e.movementY || 0);
    } else if (dragging) {
      accumulateLook(e.clientX - lastX, e.clientY - lastY);
      lastX = e.clientX; lastY = e.clientY;
    }
  }

  function accumulateLook(dx, dy) {
    if (Math.abs(dx) > MAX_JUMP || Math.abs(dy) > MAX_JUMP) return;
    lookDX += dx * sensitivity;
    lookDY += dy * sensitivity;
  }

  function onLockChange() {
    locked = document.pointerLockElement === canvas;
    if (locked) relockGuard = 3;
    else { held.delete('Mouse0'); held.delete('Mouse1'); held.delete('Mouse2'); }
  }

  const Input = {
    /* Von der Touch-Steuerung beschrieben: gehaltene Aktionen und Impulse. */
    virtual,
    /* Bewegungsrichtung im Kamerabezug, bereits normiert. */
    move: { x: 0, z: 0 },
    /* Zusätzliche Blickbewegung vom Touch-Overlay, in Radiant. */
    touchLook: { x: 0, y: 0 },

    init(targetCanvas) {
      canvas = targetCanvas;
      addEventListener('keydown', onKeyDown);
      addEventListener('keyup', onKeyUp);
      addEventListener('blur', onBlur);
      addEventListener('mousedown', onMouseDown);
      addEventListener('mouseup', onMouseUp);
      addEventListener('mousemove', onMouseMove);
      addEventListener('contextmenu', (e) => { if (e.target === canvas) e.preventDefault(); });
      document.addEventListener('pointerlockchange', onLockChange);
      canvas.addEventListener('click', () => Input.lock());
    },

    lock() {
      if (!canvas || locked) return;
      // Schlägt fehl, wenn der Browser es verbietet — dann greift das Ziehen.
      const p = canvas.requestPointerLock && canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    },

    unlock() { if (locked && document.exitPointerLock) document.exitPointerLock(); },

    get isLocked() { return locked; },

    setEnabled(v) { enabled = v; if (!v) onBlur(); },
    setSensitivity(v) { sensitivity = v; },

    down: actionDown,
    pressed: actionPressed,
    released: actionReleased,
    key: isDown,

    /* Am Anfang jedes Bildes: Bewegungsachsen zusammensetzen. */
    beginFrame() {
      let x = 0, z = 0;
      if (actionDown('right')) x += 1;
      if (actionDown('left')) x -= 1;
      if (actionDown('back')) z += 1;
      if (actionDown('forward')) z -= 1;
      const len = Math.hypot(x, z);
      if (len > 1e-4) { x /= len; z /= len; }
      Input.move.x = x;
      Input.move.z = z;
    },

    /* Holt die aufgelaufene Blickbewegung ab und setzt sie zurück. */
    takeLook() {
      const out = { x: lookDX + Input.touchLook.x, y: lookDY + Input.touchLook.y };
      lookDX = 0; lookDY = 0;
      Input.touchLook.x = 0; Input.touchLook.y = 0;
      return out;
    },

    /* Am Ende jedes Bildes: Flanken verwerfen. */
    endFrame() {
      downThisFrame.clear();
      upThisFrame.clear();
      virtual.forEach((a) => { if (a.charCodeAt(0) === 126) virtual.delete(a); });
    },

    bindings: BINDINGS
  };

  ROR.Input = Input;
})(window.ROR);
