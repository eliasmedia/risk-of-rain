/* game/ui/menus.js
   Startbildschirm, Figurenauswahl, Artefakte — und das Auswahlfenster für
   das Artefakt Command.

   Der Aufbau entsteht im Code statt im HTML: die Figuren- und Artefaktlisten
   stehen ohnehin als Daten bereit, und so bleibt für jede neue Figur und
   jedes neue Artefakt genau ein Dateneintrag zu pflegen statt zusätzlich ein
   Stück Markup. */
(function (ROR) {
  'use strict';

  const U = ROR.Util;
  let root = null, gewaehlt = null, schwierigkeit = 'rainstorm';
  let chooser = null, chooserFertig = null;

  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }

  function farbe(hex) { return '#' + hex.toString(16).padStart(6, '0'); }

  /* ------------------------------------------------------- Figurenkarten */

  function survivorCard(def) {
    const c = el('button', 'card');
    c.dataset.id = def.id;
    const skills = ['primary', 'secondary', 'utility', 'special']
      .map(function (slot) {
        const s = def.skills[slot];
        return '<i style="--c:' + farbe(s.color) + '" title="' + s.name + ' — ' + s.desc + '">'
             + s.glyph + '</i>';
      }).join('');
    c.innerHTML =
      '<span class="silhouette" style="--coat:' + farbe(def.colors.coat)
        + ';--skin:' + farbe(def.colors.skin) + ';--visor:' + farbe(def.colors.visor) + '"></span>'
      + '<b>' + def.name + '</b>'
      + '<em>' + (def.subtitle || '') + '</em>'
      + '<span class="werte">' + def.health + ' LP  ·  ' + def.damage + ' SCH  ·  '
        + def.moveSpeed + ' m/s</span>'
      + '<span class="skills">' + skills + '</span>';
    c.addEventListener('click', function () { waehle(def.id); });
    return c;
  }

  function waehle(id) {
    gewaehlt = id;
    root.querySelectorAll('#menu-survivors .card').forEach(function (n) {
      n.classList.toggle('an', n.dataset.id === id);
    });
  }

  /* ---------------------------------------------------------- Artefakte */

  function artifactTile(def) {
    const t = el('button', 'artefakt' + (def.locked ? ' gesperrt' : ''));
    t.dataset.id = def.id;
    t.innerHTML = '<i>' + def.glyph + '</i><b>' + def.name + '</b><span>' + def.desc
      + (def.locked ? '<u>kommt mit ' + def.locked + '</u>' : '') + '</span>';
    if (!def.locked) {
      t.addEventListener('click', function () {
        ROR.Artifacts.toggle(def.id);
        t.classList.toggle('an', ROR.Artifacts.on(def.id));
        zaehlerAktualisieren();
      });
    }
    return t;
  }

  function zaehlerAktualisieren() {
    const n = ROR.Artifacts.count();
    root.querySelector('#artefakt-zahl').textContent =
      n === 0 ? 'keine aktiv' : n === 1 ? '1 aktiv' : n + ' aktiv';
  }

  /* ------------------------------------------------------------- Aufbau */

  function baue() {
    root = document.getElementById('menu');
    root.innerHTML = '';

    const innen = el('div', 'menu-innen');
    innen.appendChild(el('h1', null, 'RISK <span>of</span> RAIN'));
    innen.appendChild(el('p', 'unter', 'HTML Edition'));

    innen.appendChild(el('h2', null, 'Figur'));
    const reihe = el('div', 'reihe');
    reihe.id = 'menu-survivors';
    ROR.Data.Survivors.forEach(function (d) { reihe.appendChild(survivorCard(d)); });
    innen.appendChild(reihe);

    innen.appendChild(el('h2', null, 'Regen'));
    const dif = el('div', 'reihe schmal');
    dif.id = 'menu-diff';
    ROR.Difficulty.MODES.forEach(function (m) {
      const b = el('button', 'stufe' + (m.id === schwierigkeit ? ' an' : ''));
      b.dataset.id = m.id;
      b.innerHTML = '<b>' + m.name + '</b><span>Zeitfaktor ×' + m.value + '</span>';
      b.addEventListener('click', function () {
        schwierigkeit = m.id;
        dif.querySelectorAll('.stufe').forEach(function (n) {
          n.classList.toggle('an', n.dataset.id === m.id);
        });
      });
      dif.appendChild(b);
    });
    innen.appendChild(dif);

    const kopf = el('h2', null, 'Artefakte <small id="artefakt-zahl">keine aktiv</small>');
    innen.appendChild(kopf);
    innen.appendChild(el('p', 'notiz',
      'Artefakte ändern die Regeln, nicht die Stärke. Alle sind von Anfang an verfügbar.'));
    const gitter = el('div', 'artefakte');
    ROR.Artifacts.DEFS.forEach(function (d) { gitter.appendChild(artifactTile(d)); });
    innen.appendChild(gitter);

    const fuss = el('div', 'fuss');
    const seed = el('input', 'seed');
    seed.type = 'text';
    seed.placeholder = 'Seed (leer = zufällig)';
    seed.id = 'menu-seed';
    fuss.appendChild(seed);
    const start = el('button', 'start', 'Durchlauf starten');
    start.addEventListener('click', function () { Menus.start(); });
    fuss.appendChild(start);
    innen.appendChild(fuss);

    innen.appendChild(el('p', 'hinweis',
      '<b>W A S D</b> laufen · <b>Maus</b> zielen · <b>Leertaste</b> springen · '
      + '<b>Strg</b> sprinten · <b>E</b> benutzen · <b>Q</b> Ausrüstung · '
      + '<b>M</b> Pause · <b>F3</b> Technik'));

    root.appendChild(innen);
    waehle(ROR.Data.Survivors[0].id);
    zaehlerAktualisieren();
  }

  /* ------------------------------------------------- Command-Auswahl */

  /* Command ersetzt den Zufall durch eine Entscheidung: drei Vorschläge
     derselben Stufe, einer wird genommen. Das Spiel hält solange an. */
  function zeigeAuswahl(tier, fertig) {
    const pool = ROR.Items.ofTier(tier);
    if (!pool.length) { fertig(null); return; }

    const auswahl = [];
    const kopie = pool.slice();
    for (let i = 0; i < 3 && kopie.length; i++) {
      auswahl.push(kopie.splice(U.chaos.int(kopie.length), 1)[0]);
    }

    chooserFertig = fertig;
    chooser.innerHTML = '<h3>' + tier.toUpperCase() + ' — wähle</h3>';
    const reihe = el('div', 'reihe');
    auswahl.forEach(function (d) {
      const b = el('button', 'wahl');
      b.style.setProperty('--c', farbe(ROR.Loot.TIER_COLOR[d.tier] || 0xffffff));
      b.innerHTML = '<b>' + d.name + '</b><span>' + d.desc + '</span>';
      b.addEventListener('click', function () { waehleItem(d); });
      reihe.appendChild(b);
    });
    chooser.appendChild(reihe);
    chooser.classList.add('show');
    ROR.Engine.setPaused(true);
    ROR.Input.unlock();
  }

  function waehleItem(def) {
    chooser.classList.remove('show');
    ROR.Engine.setPaused(false);
    const f = chooserFertig;
    chooserFertig = null;
    if (f) f(def);
  }

  const Menus = {
    get open() { return root && !root.classList.contains('hidden'); },

    init() {
      chooser = document.getElementById('chooser');
      baue();
    },

    show() {
      if (!root) baue();
      root.classList.remove('hidden');
      ROR.Engine.setPaused(true);
      ROR.Input.unlock();
    },

    hide() {
      root.classList.add('hidden');
      ROR.Engine.setPaused(false);
    },

    start() {
      const feld = document.getElementById('menu-seed').value.trim();
      const seed = /^-?\d+$/.test(feld) ? (parseInt(feld, 10) >>> 0) : undefined;
      Menus.hide();
      ROR.Game.newRun({ survivor: gewaehlt, difficulty: schwierigkeit, seed: seed });
    },

    chooseItem: zeigeAuswahl,
    get choosing() { return chooser && chooser.classList.contains('show'); }
  };

  ROR.Menus = Menus;
})(window.ROR);
