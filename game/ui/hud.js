/* game/ui/hud.js
   Anzeigen über dem Bild. Liest den Spielzustand, schreibt nie hinein.

   Die Elemente werden einmal nachgeschlagen und danach nur noch beschrieben —
   und nur, wenn sich der Text wirklich geändert hat. Das spart pro Bild
   ein Dutzend überflüssige Layoutdurchläufe. */
(function (ROR) {
  'use strict';

  const U = ROR.Util;
  const el = {};
  const last = {};

  function set(node, text) {
    if (last[node.id] === text) return;
    last[node.id] = text;
    node.textContent = text;
  }

  function mmss(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  const HUD = {
    debugVisible: false,

    init() {
      ['hpbar', 'hpfill', 'hplag', 'hptext', 'timer', 'stagename',
       'hint', 'debug', 'vignette'].forEach((id) => { el[id] = document.getElementById(id); });
      return HUD;
    },

    hideHint() { el.hint.classList.add('hidden'); },
    showHint() { el.hint.classList.remove('hidden'); },

    toggleDebug() {
      HUD.debugVisible = !HUD.debugVisible;
      el.debug.classList.toggle('hidden', !HUD.debugVisible);
    },

    update(game) {
      const p = game.player;
      const frac = U.clamp(p.health / p.maxHealth, 0, 1);

      el.hpfill.style.width = (frac * 100) + '%';
      el.hplag.style.width = (frac * 100) + '%';
      el.hpfill.style.background = frac < 0.28 ? 'var(--hp-low)' : 'var(--hp)';
      set(el.hptext, Math.ceil(p.health) + ' / ' + Math.round(p.maxHealth));

      set(el.timer, mmss(ROR.Engine.time));
      set(el.stagename, game.stage ? game.stage.theme.name : '');

      el.vignette.style.opacity = p.hurtFlash ? String(U.clamp(p.hurtFlash * 3, 0, 0.9)) : '0';

      if (HUD.debugVisible) {
        const s = ROR.Engine.stats;
        const pos = p.position;
        set(el.debug, [
          'fps      ' + s.fps + '   (' + s.frameMs.toFixed(1) + ' ms, ' + s.steps + ' schritte)',
          'zeichnen ' + s.draws + ' aufrufe, ' + (s.tris / 1000).toFixed(0) + 'k dreiecke',
          'position ' + pos.x.toFixed(1) + ' / ' + pos.y.toFixed(1) + ' / ' + pos.z.toFixed(1),
          'tempo    ' + Math.hypot(p.velocity.x, p.velocity.z).toFixed(2) + ' m/s'
            + (p.sprinting ? '  sprint' : ''),
          'y-tempo  ' + p.velocity.y.toFixed(2) + '   ' + (p.grounded ? 'boden' : 'luft'),
          'seed     ' + (game.stage ? game.stage.seed : '-')
        ].join('\n'));
      }
    }
  };

  ROR.HUD = HUD;
})(window.ROR);
