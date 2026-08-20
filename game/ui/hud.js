/* game/ui/hud.js
   Anzeigen über dem Bild. Liest den Spielzustand, schreibt nie hinein.

   Zwei Dinge kosten hier Aufmerksamkeit:
   * Elemente werden einmal nachgeschlagen und danach nur beschrieben, wenn
     sich der Text wirklich geändert hat — sonst zwölf Layoutdurchläufe je Bild.
   * Die Schadenszahlen laufen über einen festen Vorrat von Elementen. Sie im
     3D zu zeichnen bräuchte Texturen, die unter `file://` verboten sind; als
     HTML sind sie scharf, gestaltbar und kosten fast nichts. */
(function (ROR) {
  'use strict';

  const U = ROR.Util;
  const SLOTS = ['primary', 'secondary', 'utility', 'special'];
  const NUMBER_POOL = 56;
  const NUMBER_LIFE = 0.95;

  const el = {};
  const last = {};
  const skillEls = {};
  const numbers = [];
  let numberNext = 0;
  const _v = new THREE.Vector3();

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
      ['hpbar', 'hpfill', 'hplag', 'hptext', 'shieldfill', 'timer', 'stagename',
       'hint', 'debug', 'vignette', 'skills', 'numbers', 'crosshair',
       'levelout', 'survivorname', 'gold'].forEach((id) => { el[id] = document.getElementById(id); });

      const pool = el.numbers;
      for (let i = 0; i < NUMBER_POOL; i++) {
        const d = document.createElement('div');
        d.className = 'dmg';
        pool.appendChild(d);
        numbers.push({ el: d, life: 0, pos: new THREE.Vector3(), drift: 0 });
      }
      return HUD;
    },

    /* Baut die vier Fähigkeitsfelder aus der Figurendefinition auf. */
    buildSkills(def) {
      el.skills.innerHTML = '';
      SLOTS.forEach(function (slot) {
        const s = def.skills[slot];
        const wrap = document.createElement('div');
        wrap.className = 'skill';
        wrap.innerHTML =
          '<i class="sweep"></i>' +
          '<b class="key">' + s.glyph + '</b>' +
          '<span class="stock"></span>';
        wrap.style.setProperty('--tint', '#' + s.color.toString(16).padStart(6, '0'));
        wrap.title = s.name + ' — ' + s.desc;
        el.skills.appendChild(wrap);
        skillEls[slot] = { wrap: wrap, sweep: wrap.querySelector('.sweep'), stock: wrap.querySelector('.stock') };
      });
      set(el.survivorname, def.name);
    },

    hideHint() { el.hint.classList.add('hidden'); },
    showHint() { el.hint.classList.remove('hidden'); },

    toggleDebug() {
      HUD.debugVisible = !HUD.debugVisible;
      el.debug.classList.toggle('hidden', !HUD.debugVisible);
    },

    /* --------------------------------------------------- Schadenszahlen */

    damageNumber(position, text, kind) {
      const n = numbers[numberNext = (numberNext + 1) % numbers.length];
      n.pos.copy(position);
      n.life = NUMBER_LIFE;
      // Seitlicher Versatz, damit gleichzeitige Treffer nicht übereinanderliegen.
      n.drift = (U.chaos.next() - 0.5) * 46;
      n.el.textContent = text;
      n.el.className = 'dmg ' + (kind || 'hit');
    },

    updateNumbers(dt) {
      const cam = ROR.Engine.camera;
      const w = innerWidth, h = innerHeight;
      for (let i = 0; i < numbers.length; i++) {
        const n = numbers[i];
        if (n.life <= 0) continue;
        n.life -= dt;
        if (n.life <= 0) { n.el.style.opacity = '0'; n.el.style.transform = 'translate(-999px,-999px)'; continue; }

        const t = 1 - n.life / NUMBER_LIFE;
        _v.copy(n.pos);
        _v.y += t * 1.7;
        _v.project(cam);
        if (_v.z > 1) { n.el.style.opacity = '0'; continue; }

        const x = (_v.x * 0.5 + 0.5) * w + n.drift * t;
        const y = (-_v.y * 0.5 + 0.5) * h;
        n.el.style.transform = 'translate(' + (x | 0) + 'px,' + (y | 0) + 'px) scale(' + (1.25 - t * 0.3).toFixed(2) + ')';
        n.el.style.opacity = String(U.clamp((1 - t) * 2.2, 0, 1));
      }
    },

    /* ------------------------------------------------------------- Rest */

    update(game, dt) {
      const p = game.player;
      const b = p.body;
      const S = b.stats;
      const frac = U.clamp(b.health / S.maxHealth, 0, 1);

      el.hpfill.style.width = (frac * 100) + '%';
      el.hplag.style.width = (frac * 100) + '%';
      el.hpfill.style.background = frac < 0.28 ? 'var(--hp-low)' : 'var(--hp)';
      el.shieldfill.style.width = (U.clamp(b.shield / S.maxHealth, 0, 1) * 100) + '%';
      set(el.hptext, Math.ceil(b.health) + ' / ' + Math.round(S.maxHealth));
      set(el.levelout, 'Stufe ' + b.level);
      set(el.gold, '$' + Math.floor(p.gold));

      set(el.timer, mmss(ROR.Engine.time));
      set(el.stagename, game.stage ? game.stage.theme.name : '');

      for (let i = 0; i < SLOTS.length; i++) {
        const st = p.skills[SLOTS[i]];
        const ui = skillEls[SLOTS[i]];
        if (!ui) continue;
        const ready = st.maxCharges === 0 ? st.interval <= 0 : st.charges > 0;
        // Der Kegel füllt sich, während die nächste Ladung nachwächst.
        const pct = st.maxCharges === 0 || st.charges >= st.maxCharges
          ? 0
          : U.clamp(st.cooldown / st.def.cooldown, 0, 1) * 100;
        ui.sweep.style.setProperty('--p', pct.toFixed(0) + '%');
        ui.wrap.classList.toggle('ready', ready);
        set(ui.stock, st.maxCharges > 1 ? String(st.charges) : '');
      }

      el.vignette.style.opacity = p.hurtFlash ? String(U.clamp(p.hurtFlash * 2.6, 0, 0.85)) : '0';
      el.crosshair.classList.toggle('firing', p._aimTimer > 0);

      HUD.updateNumbers(dt);

      if (HUD.debugVisible) {
        const s = ROR.Engine.stats;
        const pos = p.position;
        set(el.debug, [
          'fps      ' + s.fps + '   (' + s.frameMs.toFixed(1) + ' ms, ' + s.steps + ' schritte)',
          'zeichnen ' + s.draws + ' aufrufe, ' + (s.tris / 1000).toFixed(0) + 'k dreiecke',
          'position ' + pos.x.toFixed(1) + ' / ' + pos.y.toFixed(1) + ' / ' + pos.z.toFixed(1),
          'tempo    ' + Math.hypot(p.velocity.x, p.velocity.z).toFixed(2) + ' m/s'
            + (p.sprinting ? '  sprint' : '') + (p.grounded ? '' : '  luft'),
          'schaden  ' + S.damage.toFixed(1) + '   tempo ' + S.attackSpeed.toFixed(2)
            + '   crit ' + S.crit.toFixed(0) + '%',
          'rüstung  ' + S.armor.toFixed(0) + '   regen ' + S.regen.toFixed(2) + '/s',
          'bodies   ' + ROR.Body.all.length + '   buffs ' + b.buffs.length,
          'seed     ' + (game.stage ? game.stage.seed : '-')
        ].join('\n'));
      }
    }
  };

  ROR.HUD = HUD;
})(window.ROR);
