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
  const _aim = new THREE.Vector3();

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
       'levelout', 'survivorname', 'gold', 'diffbar', 'difffill', 'diffname',
       'target', 'targetname', 'targetfill', 'toast', 'dead',
       'itembar', 'prompt', 'pickup', 'equipslot', 'equipsweep', 'equipname'
      ].forEach((id) => { el[id] = document.getElementById(id); });

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

    /* Kurze Einblendung in der Bildmitte — Stufenaufstieg, Stageschild. */
    toast(text, kind) {
      el.toast.textContent = text;
      el.toast.className = 'show ' + (kind || '');
      clearTimeout(HUD._toastTimer);
      HUD._toastTimer = setTimeout(function () { el.toast.className = ''; }, 1600);
    },

    setDead(on) { el.dead.classList.toggle('hidden', !on); },

    /* Aufsammelmeldung: Name und Wirkung, damit man ein unbekanntes Item
       nicht erst im Logbuch nachschlagen muss. */
    itemToast(def) {
      const c = ROR.Loot.TIER_COLOR[def.tier] || 0xffffff;
      el.pickup.innerHTML = '<b style="color:#' + c.toString(16).padStart(6, '0') + '">'
        + def.name + '</b><span>' + (def.desc || '') + '</span>';
      el.pickup.className = 'show';
      clearTimeout(HUD._pickTimer);
      HUD._pickTimer = setTimeout(function () { el.pickup.className = ''; }, 3200);
    },

    /* Die Leiste der gesammelten Items. Wird nur neu gebaut, wenn sich das
       Inventar wirklich geändert hat — sonst hinge das HUD an der Item-Zahl. */
    updateItems(body) {
      let sig = '';
      for (const id in body.items) sig += id + body.items[id] + ',';
      if (body.equipment) sig += '#' + body.equipment.def.id;
      if (sig === HUD._itemSig) return;
      HUD._itemSig = sig;

      const ORDER = ['boss', 'legendary', 'uncommon', 'common', 'lunar'];
      const gruppen = {};
      for (const id in body.items) {
        const def = ROR.Items.def(id);
        if (!def) continue;
        (gruppen[def.tier] = gruppen[def.tier] || []).push({ def: def, n: body.items[id] });
      }
      let html = '';
      for (let i = 0; i < ORDER.length; i++) {
        const g = gruppen[ORDER[i]];
        if (!g) continue;
        const c = '#' + (ROR.Loot.TIER_COLOR[ORDER[i]] || 0xffffff).toString(16).padStart(6, '0');
        for (let k = 0; k < g.length; k++) {
          html += '<i style="--c:' + c + '" title="' + g[k].def.name + ' — ' + g[k].def.desc + '">'
                + g[k].def.name.charAt(0) + (g[k].n > 1 ? '<u>' + g[k].n + '</u>' : '') + '</i>';
        }
      }
      el.itembar.innerHTML = html;

      const e = body.equipment;
      el.equipslot.classList.toggle('empty', !e);
      set(el.equipname, e ? e.def.name : '');
    },
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

    /* ------------------------------------------------- Anzeige des Ziels */

    /* Der Balken über dem Gegner unter dem Fadenkreuz. Er bleibt kurz stehen,
       nachdem man weggezielt hat — sonst flackert er bei jeder Bewegung. */
    updateTarget(p) {
      const cam = ROR.Engine.camera;
      ROR.Camera.aim(_aim);
      const hit = ROR.Body.raycast(cam.position, _aim, 220, ROR.Body.PLAYER);
      if (hit && hit.body.alive) { HUD._target = hit.body; HUD._targetHold = 1.4; }
      else if (HUD._targetHold > 0) HUD._targetHold -= 1 / 60;

      const t = HUD._target;
      if (!t || !t.alive || HUD._targetHold <= 0) { el.target.style.opacity = '0'; return; }

      t.center(_v);
      _v.y += t.height * 0.62;
      _v.project(cam);
      if (_v.z > 1) { el.target.style.opacity = '0'; return; }

      const x = (_v.x * 0.5 + 0.5) * innerWidth;
      const y = (-_v.y * 0.5 + 0.5) * innerHeight;
      el.target.style.transform = 'translate(' + (x | 0) + 'px,' + (y | 0) + 'px) translate(-50%,-100%)';
      el.target.style.opacity = '1';
      el.targetfill.style.width = (U.clamp(t.combinedFraction, 0, 1) * 100).toFixed(1) + '%';
      set(el.targetname, t.name + '  ·  Stufe ' + t.level);
    },

    _target: null,
    _targetHold: 0,

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

      /* Schwierigkeitsbalken: derselbe Wert, den auch der Director und die
         Preise sehen — nur eben sichtbar. */
      const D = ROR.Difficulty;
      el.difffill.style.width = (D.tierProgress * 100).toFixed(1) + '%';
      set(el.diffname, D.tierName);
      el.diffbar.dataset.tier = String(D.tierIndex);

      HUD.updateTarget(p);
      HUD.updateItems(b);

      /* Aufforderung am nächsten bedienbaren Objekt. */
      const f = ROR.Interactables && ROR.Interactables.focus;
      if (f) {
        const pr = ROR.Interactables.prompt(f, b);
        set(el.prompt, 'E  ·  ' + pr.text);
        el.prompt.className = pr.ok ? 'show' : 'show poor';
      } else {
        el.prompt.className = '';
      }

      const e = b.equipment;
      if (e) {
        const pct = e.charges > 0 ? 0 : U.clamp(e.cooldown / (e.def.cooldown * (e.cdScale || 1)), 0, 1) * 100;
        el.equipsweep.style.setProperty('--p', pct.toFixed(0) + '%');
        el.equipslot.classList.toggle('ready', e.charges > 0);
      }

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
          'coeff    ' + ROR.Difficulty.coeff.toFixed(2) + '   gegnerstufe '
            + ROR.Difficulty.enemyLevel.toFixed(1) + '   ' + ROR.Difficulty.tierName,
          ROR.Director.debugLine(),
          'gold/xp  ' + Math.floor(p.gold) + ' / ' + Math.floor(p.exp)
            + '   nächste stufe bei ' + Math.floor(ROR.Stats.expForLevel(b.level + 1)),
          'items    ' + ROR.Items.total(b) + '   glück ' + ROR.Items.luck(b)
            + '   drops ' + ROR.Loot.pending,
          'bodies   ' + ROR.Body.all.length + '   buffs ' + b.buffs.length,
          'seed     ' + (game.stage ? game.stage.seed : '-')
        ].join('\n'));
      }
    }
  };

  ROR.HUD = HUD;
})(window.ROR);
