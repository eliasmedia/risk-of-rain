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
    const frei = ROR.Save.istFrei(def.id);
    const c = el('button', 'card' + (frei ? '' : ' locked'));
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
      + '<span class="werte">' + def.health + ' HP  ·  ' + def.damage + ' DMG  ·  '
        + def.moveSpeed + ' m/s</span>'
      + '<span class="skills">' + skills + '</span>'
      + (frei ? '' : '<span class="sperre">' + (ROR.Save.bedingung(def.id) || {}).text + '</span>');
    if (frei) c.addEventListener('click', function () { waehle(def.id); });
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
    const t = el('button', 'artefakt' + (def.locked ? ' locked' : ''));
    t.dataset.id = def.id;
    t.innerHTML = '<i>' + def.glyph + '</i><b>' + def.name + '</b><span>' + def.desc
      + (def.locked ? '<u>unlocks with ' + def.locked + '</u>' : '') + '</span>';
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
      n === 0 ? 'none active' : n === 1 ? '1 active' : n + ' active';
  }

  /* ------------------------------------------------------------- Aufbau */

  function baue() {
    root = document.getElementById('menu');
    root.innerHTML = '';

    const innen = el('div', 'menu-innen');
    innen.appendChild(el('h1', null, 'RISK <span>of</span> RAIN'));
    innen.appendChild(el('p', 'unter', 'HTML Edition'));

    innen.appendChild(el('h2', null, 'Survivor'));
    const reihe = el('div', 'reihe');
    reihe.id = 'menu-survivors';
    ROR.Data.Survivors.forEach(function (d) { reihe.appendChild(survivorCard(d)); });
    innen.appendChild(reihe);

    innen.appendChild(el('h2', null, 'Rain'));
    const dif = el('div', 'reihe schmal');
    dif.id = 'menu-diff';
    ROR.Difficulty.MODES.forEach(function (m) {
      const b = el('button', 'stufe' + (m.id === schwierigkeit ? ' an' : ''));
      b.dataset.id = m.id;
      b.innerHTML = '<b>' + m.name + '</b><span>Time factor ×' + m.value + '</span>';
      b.addEventListener('click', function () {
        schwierigkeit = m.id;
        dif.querySelectorAll('.stufe').forEach(function (n) {
          n.classList.toggle('an', n.dataset.id === m.id);
        });
      });
      dif.appendChild(b);
    });
    innen.appendChild(dif);

    const kopf = el('h2', null, 'Artifacts <small id="artefakt-zahl">none active</small>');
    innen.appendChild(kopf);
    innen.appendChild(el('p', 'notiz',
      'Artifacts change the rules, not your power. All of them are available from the start.'));
    const gitter = el('div', 'artefakte');
    ROR.Artifacts.DEFS.forEach(function (d) { gitter.appendChild(artifactTile(d)); });
    innen.appendChild(gitter);

    /* Freischaltungen: das System ist da, steht aber offen. Wer es scharf
       stellt, spielt die Figuren frei — der Rest spielt einfach. */
    const schalterZeile = el('div', 'schalter');
    const schalter = el('button', 'kippe' + (ROR.Save.data.alleFrei ? ' an' : ''));
    schalter.innerHTML = '<i></i><b>Everything unlocked</b>'
      + '<span>Off: survivors have to be earned</span>';
    schalter.addEventListener('click', function () {
      ROR.Save.setAlleFrei(!ROR.Save.data.alleFrei);
      baue();
      root.scrollTop = 0;
    });
    schalterZeile.appendChild(schalter);

    const ton = el('button', 'kippe' + (ROR.Audio.an ? ' an' : ''));
    ton.innerHTML = '<i></i><b>Sound</b><span>Music grows with the difficulty</span>';
    ton.addEventListener('click', function () {
      ROR.Audio.setAn(!ROR.Audio.an);
      ton.classList.toggle('an', ROR.Audio.an);
    });
    schalterZeile.appendChild(ton);
    innen.appendChild(schalterZeile);

    const fuss = el('div', 'fuss');
    const seed = el('input', 'seed');
    seed.type = 'text';
    seed.placeholder = 'Seed (empty = random)';
    seed.id = 'menu-seed';
    fuss.appendChild(seed);
    const start = el('button', 'start', 'Start run');
    start.addEventListener('click', function () { Menus.start(); });
    fuss.appendChild(start);
    innen.appendChild(fuss);

    /* Logbuch und Statistik am Fuß — ausklappbar, damit sie das Menü nicht
       zustellen. */
    const stat = ROR.Save.data.stats;
    const details = el('details', 'logbuch');
    details.innerHTML = '<summary>Logbook and statistics</summary>';
    const inhalt = el('div', 'logbuch-inhalt');
    inhalt.innerHTML =
      '<p class="bilanz">' + stat.laeufe + ' runs · ' + stat.siege + ' wins · '
      + stat.kills + ' kills · ' + stat.stagesGesamt + ' stages · best stage '
      + stat.besteStage + ' · highest level ' + stat.hoechsteStufe + '</p>';

    const gefunden = Object.keys(ROR.Save.data.logbuch.items);
    inhalt.appendChild(el('h3', null, 'Items found  <small>' + gefunden.length
      + ' of ' + ROR.Items.all().filter(function (i) { return !i.scrap; }).length + '</small>'));
    const gitterI = el('div', 'logliste');
    ROR.Items.all().forEach(function (it) {
      if (it.scrap) return;
      const kennt = ROR.Save.kennt('items', it.id);
      const e = el('i', kennt ? 'bekannt' : 'unbekannt');
      e.style.setProperty('--c', '#' + (ROR.Loot.TIER_COLOR[it.tier] || 0xffffff)
        .toString(16).padStart(6, '0'));
      e.title = kennt ? it.name + ' — ' + it.desc : 'Not found yet';
      e.textContent = kennt ? it.name.charAt(0) : '?';
      gitterI.appendChild(e);
    });
    inhalt.appendChild(gitterI);

    const getoetet = Object.keys(ROR.Save.data.logbuch.gegner);
    inhalt.appendChild(el('h3', null, 'Monsters defeated  <small>' + getoetet.length
      + ' of ' + ROR.Data.Monsters.length + '</small>'));
    const listeG = el('div', 'logliste breit');
    ROR.Data.Monsters.forEach(function (mo) {
      const kennt = ROR.Save.kennt('gegner', mo.id);
      const e = el('i', kennt ? 'bekannt' : 'unbekannt');
      e.style.setProperty('--c', mo.isBoss ? '#e2564a' : mo.category === 'miniboss'
        ? '#f2c14e' : '#9fb0bc');
      e.textContent = kennt ? mo.name + ' ×' + ROR.Save.data.logbuch.gegner[mo.id] : '???';
      inhalt.appendChild(e);
      listeG.appendChild(e);
    });
    inhalt.appendChild(listeG);

    if (ROR.Save.data.rekorde.length) {
      inhalt.appendChild(el('h3', null, 'Recent runs'));
      const tab = el('div', 'rekorde');
      ROR.Save.data.rekorde.slice(0, 8).forEach(function (r) {
        tab.appendChild(el('div', r.sieg ? 'sieg' : '',
          (r.sieg ? '★ ' : '') + r.figur + '  ·  stage ' + r.stages + '  ·  level ' + r.stufe
          + '  ·  ' + Math.floor(r.zeit / 60) + ':' + String(Math.floor(r.zeit % 60)).padStart(2, '0')
          + '  ·  ' + r.kills + ' kills'));
      });
      inhalt.appendChild(tab);
    }
    details.appendChild(inhalt);
    innen.appendChild(details);

    innen.appendChild(el('p', 'hinweis',
      '<b>W A S D</b> move · <b>Mouse</b> aim · <b>Space</b> jump · '
      + '<b>Ctrl</b> sprint · <b>E</b> interact · <b>Q</b> equipment · '
      + '<b>M</b> pause · <b>F3</b> debug'));

    root.appendChild(innen);
    const ersteFreie = ROR.Data.Survivors.filter(function (d) { return ROR.Save.istFrei(d.id); })[0];
    waehle((ersteFreie || ROR.Data.Survivors[0]).id);
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
    chooser.innerHTML = '<h3>' + tier.toUpperCase() + ' — choose</h3>';
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

  /* ------------------------------------------------ Ergebnis und Pause */

  function zeit(sekunden) {
    const s2 = Math.max(0, Math.floor(sekunden));
    return Math.floor(s2 / 60) + ':' + String(s2 % 60).padStart(2, '0');
  }

  function zeigeErgebnis(lauf, neuFrei) {
    const box = document.getElementById('results');
    const items = lauf.itemListe.map(function (x) {
      const c = '#' + (ROR.Loot.TIER_COLOR[x.tier] || 0xffffff).toString(16).padStart(6, '0');
      return '<i style="--c:' + c + '" title="' + x.name + '">' + x.name.charAt(0)
           + (x.n > 1 ? '<u>' + x.n + '</u>' : '') + '</i>';
    }).join('');

    box.innerHTML =
      '<div class="ergebnis-innen">'
      + '<b class="' + (lauf.sieg ? 'sieg' : 'tod') + '">'
      + (lauf.sieg ? 'MITHRIX DEFEATED' : 'GESTORBEN') + '</b>'
      + '<p class="wer">' + lauf.figur + '  ·  ' + lauf.schwer + '</p>'
      + '<div class="zahlen">'
      +   '<div><b>' + zeit(lauf.zeit) + '</b><span>Zeit</span></div>'
      +   '<div><b>' + lauf.stages + '</b><span>Stages</span></div>'
      +   '<div><b>' + lauf.stufe + '</b><span>Level</span></div>'
      +   '<div><b>' + lauf.kills + '</b><span>Kills</span></div>'
      +   '<div><b>' + lauf.items + '</b><span>Items</span></div>'
      +   '<div><b>' + lauf.coeff.toFixed(1) + '</b><span>Koeffizient</span></div>'
      + '</div>'
      + '<div class="beute">' + items + '</div>'
      + (neuFrei.length ? '<p class="frei">Unlocked: '
          + neuFrei.map(function (id) { return ROR.Data.survivor(id).name; }).join(', ')
          + '</p>' : '')
      + '<div class="knoepfe">'
      +   '<button data-tun="neu">Play again</button>'
      +   '<button data-tun="menu">Main menu</button>'
      + '</div></div>';

    box.querySelector('[data-tun="neu"]').addEventListener('click', function () {
      box.className = 'hidden';
      ROR.Game.newRun(ROR.Game.config);
    });
    box.querySelector('[data-tun="menu"]').addEventListener('click', function () {
      box.className = 'hidden';
      Menus.show();
    });
    box.className = 'show';
    ROR.Input.unlock();
  }

  const Menus = {
    get open() { return root && !root.classList.contains('hidden'); },
    showResults: zeigeErgebnis,
    hideResults() { document.getElementById('results').className = 'hidden'; },

    showPause() {
      const box = document.getElementById('pause');
      const p = ROR.Game.player;
      box.innerHTML =
        '<div class="pause-innen">'
        + '<b>PAUSE</b>'
        + '<p>' + p.def.name + '  ·  level ' + p.body.level + '  ·  stage '
        + (ROR.Game.stagesCleared + 1) + '  ·  ' + zeit(ROR.Difficulty.runTime) + '</p>'
        + '<div class="knoepfe">'
        +   '<button data-tun="weiter">Resume</button>'
        +   '<button data-tun="menu">Abandon run</button>'
        + '</div>'
        + '<p class="klein">W A S D move · Mouse aim · Space jump · '
        + 'Ctrl sprint · E interact · Q equipment · F3 debug</p>'
        + '</div>';
      box.querySelector('[data-tun="weiter"]').addEventListener('click', function () {
        Menus.hidePause();
        ROR.Engine.setPaused(false);
      });
      box.querySelector('[data-tun="menu"]').addEventListener('click', function () {
        Menus.hidePause();
        Menus.show();
      });
      box.className = 'show';
    },

    hidePause() { document.getElementById('pause').className = 'hidden'; },

    init() {
      chooser = document.getElementById('chooser');
      baue();
    },

    show() {
      baue();   // Freischaltungen und Logbuch können sich geändert haben
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
