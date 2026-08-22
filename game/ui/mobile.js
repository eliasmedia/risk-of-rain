/* game/ui/mobile.js
   Touch-Steuerung.

   Sie schreibt nur in dieselbe Eingabeschicht, die auch Tastatur und Maus
   bedienen (`Input.virtual`, `Input.touchMove`, `Input.touchLook`) — kein
   anderer Teil des Spiels weiß, dass es sie gibt. Genau dafür lag die
   Belegung von Anfang an auf *Aktionen* statt auf Tastencodes.

   Erkannt wird über `pointer: coarse` **und** vorhandene Berührungspunkte,
   nicht über die Kennung des Browsers. Ein Notebook mit Touchscreen soll
   die Tastatur behalten; ein Handy im Desktop-Modus soll trotzdem
   bedienbar sein.

   Blicken funktioniert überall auf der rechten Hälfte, wo kein Knopf liegt.
   Ein eigenes Blickfeld wäre kleiner und wäre ständig danebengegriffen. */
(function (ROR) {
  'use strict';

  const U = ROR.Util;
  const RADIUS = 62;          // Auslenkung des Joysticks in Bildpunkten
  const BLICK = 0.0042;       // Radiant je Bildpunkt Wischweg

  let wurzel = null, stick = null, knopf = null;
  let stickZeiger = -1, blickZeiger = -1;
  let stickMitte = { x: 0, y: 0 };
  let letzterBlick = { x: 0, y: 0 };
  let aktiv = false;

  function istBeruehrgeraet() {
    const grob = matchMedia('(pointer: coarse)').matches;
    const punkte = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;
    return grob && punkte;
  }

  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }

  /* Ein Knopf hält seine Aktion, solange der Finger liegt. `impuls` löst
     stattdessen einmalig aus — für alles mit Abklingzeit. */
  function taste(aktion, beschriftung, cls, impuls) {
    const b = el('button', 'tk ' + (cls || ''), beschriftung);
    b.dataset.aktion = aktion;
    b.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      b.classList.add('an');
      if (impuls) ROR.Input.virtual.add('~' + aktion);
      else ROR.Input.virtual.add(aktion);
      ROR.Audio.start();
    });
    const los = function (e) {
      b.classList.remove('an');
      ROR.Input.virtual.delete(aktion);
      if (e) e.preventDefault();
    };
    b.addEventListener('pointerup', los);
    b.addEventListener('pointercancel', los);
    b.addEventListener('pointerleave', los);
    return b;
  }

  function baue() {
    wurzel = el('div', 'touch');
    wurzel.id = 'touch';

    /* -------------------------------------------------------- Joystick */

    stick = el('div', 'stick', '<i></i>');
    wurzel.appendChild(stick);

    stick.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      stickZeiger = e.pointerId;
      stick.setPointerCapture(e.pointerId);
      const r = stick.getBoundingClientRect();
      stickMitte.x = r.left + r.width / 2;
      stickMitte.y = r.top + r.height / 2;
      stickBewege(e);
      ROR.Audio.start();
    });
    stick.addEventListener('pointermove', function (e) {
      if (e.pointerId === stickZeiger) { e.preventDefault(); stickBewege(e); }
    });
    const stickLos = function (e) {
      if (e.pointerId !== stickZeiger) return;
      stickZeiger = -1;
      ROR.Input.touchMove.aktiv = false;
      ROR.Input.touchMove.x = 0;
      ROR.Input.touchMove.z = 0;
      ROR.Input.virtual.delete('sprint');
      stick.querySelector('i').style.transform = 'translate(-50%,-50%)';
    };
    stick.addEventListener('pointerup', stickLos);
    stick.addEventListener('pointercancel', stickLos);

    /* --------------------------------------------------------- Knöpfe */

    knopf = el('div', 'knoepfe');
    knopf.appendChild(taste('special', 'R', 'klein', true));
    knopf.appendChild(taste('equipment', 'Q', 'klein', true));
    knopf.appendChild(taste('utility', '⇢', 'mittel', true));
    knopf.appendChild(taste('secondary', 'M2', 'mittel', true));
    knopf.appendChild(taste('primary', 'M1', 'gross'));
    wurzel.appendChild(knopf);

    const rechts = el('div', 'rechts');
    rechts.appendChild(taste('jump', '▲', 'gross'));
    rechts.appendChild(taste('interact', 'E', 'mittel', true));
    wurzel.appendChild(rechts);

    /* ------------------------------------------------------- Blickfeld */

    const blick = el('div', 'blick');
    wurzel.appendChild(blick);
    blick.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      blickZeiger = e.pointerId;
      blick.setPointerCapture(e.pointerId);
      letzterBlick.x = e.clientX;
      letzterBlick.y = e.clientY;
      ROR.Audio.start();
    });
    blick.addEventListener('pointermove', function (e) {
      if (e.pointerId !== blickZeiger) return;
      e.preventDefault();
      ROR.Input.touchLook.x += (e.clientX - letzterBlick.x) * BLICK;
      ROR.Input.touchLook.y += (e.clientY - letzterBlick.y) * BLICK;
      letzterBlick.x = e.clientX;
      letzterBlick.y = e.clientY;
    });
    const blickLos = function (e) { if (e.pointerId === blickZeiger) blickZeiger = -1; };
    blick.addEventListener('pointerup', blickLos);
    blick.addEventListener('pointercancel', blickLos);

    document.body.appendChild(wurzel);
  }

  function stickBewege(e) {
    let dx = e.clientX - stickMitte.x;
    let dy = e.clientY - stickMitte.y;
    const laenge = Math.hypot(dx, dy);
    if (laenge > RADIUS) { dx *= RADIUS / laenge; dy *= RADIUS / laenge; }

    const anteil = Math.min(1, laenge / RADIUS);
    const m = ROR.Input.touchMove;
    m.aktiv = anteil > 0.12;
    if (m.aktiv) {
      const n = Math.max(1e-4, Math.hypot(dx, dy));
      m.x = (dx / n) * anteil;
      m.z = (dy / n) * anteil;
    } else { m.x = 0; m.z = 0; }

    /* Ganz nach vorn gedrückt heißt sprinten — ein eigener Knopf dafür wäre
       ein Finger mehr, den niemand frei hat. */
    if (anteil > 0.92 && m.z < -0.6) ROR.Input.virtual.add('sprint');
    else ROR.Input.virtual.delete('sprint');

    stick.querySelector('i').style.transform =
      'translate(calc(-50% + ' + dx.toFixed(0) + 'px), calc(-50% + ' + dy.toFixed(0) + 'px))';
  }

  const Mobile = {
    get aktiv() { return aktiv; },

    init() {
      if (!istBeruehrgeraet()) return false;
      aktiv = true;
      document.body.classList.add('touch-an');
      baue();
      // Auf Berührgeräten ist der Zeigerfang weder nötig noch möglich.
      ROR.Camera.setFovBoost && ROR.Camera.setFovBoost(0);
      return true;
    },

    /* Der E-Knopf zeigt sich nur, wenn es etwas zu bedienen gibt. */
    update() {
      if (!aktiv) return;
      const f = ROR.Interactables && ROR.Interactables.focus;
      const b = wurzel.querySelector('[data-aktion="interact"]');
      if (b) b.style.opacity = f ? '1' : '0.25';
    }
  };

  ROR.Mobile = Mobile;
})(window.ROR);
