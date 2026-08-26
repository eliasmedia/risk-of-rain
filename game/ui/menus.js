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

  let offeneTafel = null;
  let letzterSeed = '';

  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }

  function farbe(hex) { return '#' + hex.toString(16).padStart(6, '0'); }

  /* ------------------------------------------------------- Figurenkarten */

  /* Eine Wahl aendert drei Dinge auf einmal: die Markierung in der Liste,
     die Figur auf der Buehne und den Text rechts. */
  function waehle(id) {
    gewaehlt = id;
    root.querySelectorAll('#menu-survivors .figur').forEach(function (n) {
      n.classList.toggle('an', n.dataset.id === id);
    });
    const def = ROR.Data.Survivors.filter(function (d) { return d.id === id; })[0];
    if (!def) return;
    zeigeDetails(def);
    Vorschau.zeige(def);
  }

  /* Die Buehne bekommt ihre Groesse aus dem Layout, nicht umgekehrt. */
  function passeVorschauAn() {
    const b = document.getElementById('menu-buehne');
    if (!b) return;
    const r = b.getBoundingClientRect();
    Vorschau.groesse(r.width || 300, r.height || 380);
  }

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

  /* Der Zaehler wird beim Aufbau der Tafel gemerkt statt gesucht: die Tafel
     haengt beim ersten Aufruf noch nicht im Dokument, eine Suche ueber `root`
     liefert dort null. */
  let artefaktZahl = null;

  function zaehlerAktualisieren() {
    if (!artefaktZahl) return;
    const n = ROR.Artifacts.count();
    artefaktZahl.textContent =
      n === 0 ? 'none active' : n === 1 ? '1 active' : n + ' active';
  }

  /* -------------------------------------------------- Figurenvorschau */

  /* Die Figur im Menue ist ein echtes Modell, kein Symbol.

     Vorher stand dort eine CSS-Silhouette aus drei Farbflaechen. Damit war
     alles, was an Modellen und Waffen gebaut wurde, im Menue unsichtbar — man
     sah erst im Spiel, wen man gewaehlt hat. Hier laeuft deshalb ein eigener,
     kleiner Renderer: dasselbe `SurvivorModel`, das auch im Spiel steht, in
     Zielhaltung und langsam gedreht.

     Ein zweiter WebGL-Kontext ist vertretbar — er ist winzig, laeuft nur
     solange das Menue offen ist, und die Alternative (in ein Renderziel des
     Hauptrenderers zeichnen und ins DOM blitten) waere deutlich mehr Code fuer
     dasselbe Bild. */
  const Vorschau = (function () {
    let renderer = null, szene = null, kamera = null, figur = null, laeuft = false;
    let breite = 300, hoehe = 380;

    function sicher() {
      if (renderer) return true;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      } catch (e) { return false; }
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(breite, hoehe, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.className = 'figur-canvas';

      szene = new THREE.Scene();
      kamera = new THREE.PerspectiveCamera(30, breite / hoehe, 0.1, 60);

      /* Dreipunktlicht wie im Fotostudio: Leitlicht von vorn links, kuehles
         Gegenlicht von hinten rechts fuer die Kante, schwacher Sockel. Im
         Spiel entscheidet die Stage ueber das Licht — hier soll die Figur
         immer gleich gut aussehen. */
      const leit = new THREE.DirectionalLight(0xfff0dc, 2.6);
      leit.position.set(-3, 4, 5);
      const kante = new THREE.DirectionalLight(0x9fc4ff, 1.5);
      kante.position.set(4, 2, -4);
      szene.add(leit, kante, new THREE.HemisphereLight(0xc8d8e8, 0x40404a, 0.5));
      return true;
    }

    function schleife() {
      if (!laeuft || !renderer) return;
      requestAnimationFrame(schleife);
      if (figur) figur.rotation.y += 0.006;
      renderer.render(szene, kamera);
    }

    return {
      /* Liefert das Canvas, das ins Menue gehaengt wird. */
      canvas() { return sicher() ? renderer.domElement : null; },

      zeige(def) {
        if (!sicher() || !def) return;
        if (figur) { szene.remove(figur); figur = null; }
        const b = ROR.SurvivorModel.build(def);
        /* Haltung fuer das Schaufenster: der Waffenarm halb erhoben, der
           freie Arm locker. Voll ausgestreckt (wie beim Zielen im Spiel) sieht
           die Figur von vorn aus, als spreize sie die Arme ab — die
           Verkuerzung frisst die Geste. */
        b.arms[1].shoulder.rotation.x = 0.85;
        b.arms[1].elbow.rotation.x = 0.45;
        b.arms[0].shoulder.rotation.x = b.gunOff ? 0.85 : -0.12;
        b.arms[0].elbow.rotation.x = b.gunOff ? 0.45 : 0.1;

        figur = new THREE.Group();
        /* Das Modell blickt nach -Z, die Kamera steht bei +Z und schaut nach
           -Z — ohne Drehung sieht man also den Ruecken. Ein halber Kreis
           dreht die Figur zum Betrachter, die 0.55 machen daraus eine
           Dreiviertelansicht: von vorn verschwindet die Waffe hinter dem
           Koerper, von der Seite sieht man das Gesicht nicht. */
        b.root.rotation.y = Math.PI + 0.55;
        figur.add(b.root);
        b.root.updateMatrixWorld(true);
        // Auf eine feste Bildhoehe bringen, egal wie gross die Figur ist.
        const box = new THREE.Box3().setFromObject(b.root);
        const groesse = box.getSize(new THREE.Vector3());
        const mitte = box.getCenter(new THREE.Vector3());
        b.root.position.sub(mitte);
        const k = 1.95 / Math.max(0.6, groesse.y);
        figur.scale.setScalar(k);
        szene.add(figur);
        kamera.position.set(0, 0.05, 5.6);
        kamera.lookAt(0, 0, 0);
      },

      start() { if (!laeuft && sicher()) { laeuft = true; schleife(); } },
      stopp() { laeuft = false; },

      /* Das Canvas passt sich der Spalte an, in der es haengt. */
      groesse(w, h) {
        breite = Math.max(120, Math.round(w));
        hoehe = Math.max(160, Math.round(h));
        if (!renderer) return;
        renderer.setSize(breite, hoehe, false);
        kamera.aspect = breite / hoehe;
        kamera.updateProjectionMatrix();
      }
    };
  })();

  /* ------------------------------------------------------ Startbildschirm */

  /* Aufbau: Kopf, drei Spalten, Fuss.

     Vorher war alles eine einzige lange Rolle — Figur, Regen, siebzehn
     Artefakte, zwei Schalter, Seed, Logbuch. Man musste scrollen, um zum
     Startknopf zu kommen, und die eigentliche Entscheidung (wen spiele ich?)
     ging zwischen Nebensachen unter.

     Jetzt steht auf dem Startbildschirm nur, was man zum Losspielen braucht.
     Alles andere — Artefakte, Anleitung, Logbuch, Einstellungen — liegt hinter
     je einem Knopf und legt sich als Tafel darueber. */
  function baue() {
    root = document.getElementById('menu');
    root.innerHTML = '';

    const innen = el('div', 'menu-innen');

    // ------------------------------------------------------------- Kopf
    const kopf = el('div', 'kopf');
    kopf.appendChild(el('h1', null, 'RISK <span>of</span> RAIN'));
    kopf.appendChild(el('p', 'unter', 'HTML Edition'));
    innen.appendChild(kopf);

    // ---------------------------------------------------------- Spalten
    const spalten = el('div', 'spalten');

    // Links: die Liste
    const liste = el('div', 'figurliste');
    liste.id = 'menu-survivors';
    ROR.Data.Survivors.forEach(function (d) { liste.appendChild(survivorKnopf(d)); });
    spalten.appendChild(liste);

    // Mitte: die Figur
    const buehne = el('div', 'buehne');
    buehne.id = 'menu-buehne';
    const cv = Vorschau.canvas();
    if (cv) buehne.appendChild(cv);
    else buehne.appendChild(el('p', 'hinweis', '3D preview unavailable'));
    spalten.appendChild(buehne);

    // Rechts: Werte und Faehigkeiten
    const tafel = el('div', 'figurtafel');
    tafel.id = 'menu-details';
    spalten.appendChild(tafel);

    innen.appendChild(spalten);

    // ------------------------------------------------------------- Fuss
    const fuss = el('div', 'fuss');

    const dif = el('div', 'regen');
    dif.id = 'menu-diff';
    ROR.Difficulty.MODES.forEach(function (m) {
      const b = el('button', 'stufe' + (m.id === schwierigkeit ? ' an' : ''));
      b.dataset.id = m.id;
      b.innerHTML = '<b>' + m.name + '</b><span>×' + m.value + '</span>';
      b.addEventListener('click', function () {
        schwierigkeit = m.id;
        dif.querySelectorAll('.stufe').forEach(function (n) {
          n.classList.toggle('an', n.dataset.id === m.id);
        });
      });
      dif.appendChild(b);
    });
    fuss.appendChild(dif);

    const start = el('button', 'start', 'Start run');
    start.addEventListener('click', function () { Menus.start(); });
    fuss.appendChild(start);

    const tafeln = el('div', 'tafelknoepfe');
    [['guide', 'How to play'], ['artifacts', 'Artifacts'],
     ['logbook', 'Logbook'], ['options', 'Options']].forEach(function (t) {
      const b = el('button', 'neben', t[1]);
      b.addEventListener('click', function () { zeigeTafel(t[0]); });
      tafeln.appendChild(b);
    });
    fuss.appendChild(tafeln);
    innen.appendChild(fuss);

    // Die Tafel selbst, anfangs leer und versteckt.
    const tafelbox = el('div', 'tafel versteckt');
    tafelbox.id = 'menu-tafel';
    innen.appendChild(tafelbox);

    root.appendChild(innen);

    const ersteFreie = ROR.Data.Survivors.filter(function (d) { return ROR.Save.istFrei(d.id); })[0];
    waehle((ersteFreie || ROR.Data.Survivors[0]).id);
    passeVorschauAn();
  }

  /* Ein Eintrag in der Figurenliste. Bewusst schmal: er zeigt nur, wer zur
     Wahl steht — alles Weitere steht rechts, sobald man ihn anklickt. */
  function survivorKnopf(def) {
    const frei = ROR.Save.istFrei(def.id);
    const b = el('button', 'figur' + (frei ? '' : ' locked'));
    b.dataset.id = def.id;
    b.innerHTML =
      '<i class="marke" style="--a:' + farbe(def.colors.coat)
        + ';--b:' + farbe(def.colors.visor) + '"></i>'
      + '<span class="wer"><b>' + def.name + '</b>'
      + '<em>' + (def.subtitle || '') + '</em></span>'
      + (frei ? '' : '<span class="schloss">locked</span>');
    if (frei) b.addEventListener('click', function () { waehle(def.id); });
    return b;
  }

  const TASTEN = { primary: 'M1', secondary: 'M2', utility: 'Shift', special: 'R' };

  /* Die rechte Spalte: Werte und alle vier Faehigkeiten im Klartext.

     Sie standen vorher in `title`-Attributen — also nur im Hover, und auf
     einem Touchgeraet gar nicht. Wer eine Figur waehlt, will vorher wissen,
     was sie kann. */
  function zeigeDetails(def) {
    const t = document.getElementById('menu-details');
    if (!t) return;
    const skills = ['primary', 'secondary', 'utility', 'special'].map(function (slot) {
      const s = def.skills[slot];
      if (!s) return '';
      return '<div class="faehigkeit" style="--c:' + farbe(s.color) + '">'
           + '<i>' + (TASTEN[slot] || s.glyph) + '</i>'
           + '<div><b>' + s.name + '</b><p>' + (s.desc || '') + '</p></div>'
           + '</div>';
    }).join('');
    const frei = ROR.Save.istFrei(def.id);
    const bed = frei ? null : ROR.Save.bedingung(def.id);
    t.innerHTML =
      '<h2>' + def.name + '</h2>'
      + '<p class="unterzeile">' + (def.subtitle || '') + '</p>'
      + '<div class="werte">'
      +   '<span><b>' + def.health + '</b>health</span>'
      +   '<span><b>' + def.damage + '</b>damage</span>'
      +   '<span><b>' + def.moveSpeed + '</b>m/s</span>'
      +   '<span><b>' + def.armor + '</b>armor</span>'
      + '</div>'
      + (bed ? '<p class="gesperrt">Locked — ' + (bed.text || '') + '</p>' : '')
      + '<div class="faehigkeiten">' + skills + '</div>';
  }

  /* ------------------------------------------------------------- Tafeln */

  /* Alles, was nicht zum Losspielen noetig ist, liegt hinter einem Knopf und
     legt sich als Tafel ueber den Startbildschirm. Das haelt den
     Startbildschirm frei und macht trotzdem nichts unerreichbar. */
  function zeigeTafel(welche) {
    const box = document.getElementById('menu-tafel');
    if (!box) return;
    if (offeneTafel === welche) { schliesseTafel(); return; }
    offeneTafel = welche;
    box.className = 'tafel';
    box.innerHTML = '';

    const kopf = el('div', 'tafelkopf');
    kopf.appendChild(el('h2', null, {
      guide: 'How to play', artifacts: 'Artifacts',
      logbook: 'Logbook', options: 'Options'
    }[welche] || ''));
    const zu = el('button', 'zu', '✕');
    zu.addEventListener('click', schliesseTafel);
    kopf.appendChild(zu);
    box.appendChild(kopf);

    const inhalt = el('div', 'tafelinhalt');
    if (welche === 'guide') baueAnleitung(inhalt);
    else if (welche === 'artifacts') baueArtefakte(inhalt);
    else if (welche === 'logbook') baueLogbuch(inhalt);
    else baueOptionen(inhalt);
    box.appendChild(inhalt);
  }

  function schliesseTafel() {
    offeneTafel = null;
    const box = document.getElementById('menu-tafel');
    if (box) { box.className = 'tafel versteckt'; box.innerHTML = ''; }
    artefaktZahl = null;
  }

  /* Die Anleitung erklaert den *Kreislauf*, nicht die Tasten.

     Die Tastenbelegung steht ohnehin auf dem Ladebildschirm und im
     Pausemenue. Was ein neuer Spieler wirklich nicht weiss, ist, warum die
     Uhr laeuft, wofuer der Teleporter da ist und weshalb es sich lohnt,
     nicht sofort weiterzugehen — und genau diese Entscheidung ist das
     Spiel. */
  function baueAnleitung(z) {
    const schritte = [
      ['1', 'Explore and collect',
       'Kill monsters for gold. Spend it on chests, shrines and printers. '
       + 'Every item stacks — two syringes are twice the attack speed, ten are ten times.'],
      ['2', 'Find the teleporter',
       'It stands somewhere on the map and is not marked until you have seen it. '
       + 'Finding it early gives you the choice; finding it late means you had more time to loot.'],
      ['3', 'Hold the zone',
       'Activating it starts the charge. You have to stay inside the ring while it fills, '
       + 'and a boss shows up. This is the fight the whole stage was preparing you for.'],
      ['4', 'Take a portal',
       'When the teleporter is done it opens a portal. If you spent a lunar coin at a Newt '
       + 'Altar, a second one opens next to it. After Sky Meadow a third leads to Mithrix.'],
      ['5', 'Do it again, harder',
       'Every stage multiplies the difficulty by 1.15, and the clock never stops. '
       + 'Staying longer means more items — and stronger monsters. That trade is the game.']
    ];
    const l = el('div', 'schritte');
    schritte.forEach(function (s) {
      l.appendChild(el('div', 'schritt',
        '<i>' + s[0] + '</i><div><b>' + s[1] + '</b><p>' + s[2] + '</p></div>'));
    });
    z.appendChild(l);

    z.appendChild(el('h3', null, 'The clock is the enemy'));
    z.appendChild(el('p', 'fliess',
      'The difficulty bar at the top left rises with time <em>and</em> with every stage you '
      + 'clear. It never goes down. Monsters get more health and hit harder, and the director '
      + 'that spawns them gets a bigger budget. Ten minutes of careful looting costs you as '
      + 'much as clearing a stage.'));

    z.appendChild(el('h3', null, 'Controls'));
    const t = el('div', 'tasten');
    [['W A S D', 'move'], ['Mouse', 'aim'], ['Space', 'jump'], ['Ctrl', 'sprint'],
     ['Left click', 'primary'], ['Right click', 'secondary'], ['Shift', 'utility'],
     ['R', 'special'], ['E', 'interact'], ['Q', 'equipment'],
     ['M', 'pause'], ['F3', 'debug']].forEach(function (k) {
      t.appendChild(el('div', null, '<b>' + k[0] + '</b><span>' + k[1] + '</span>'));
    });
    z.appendChild(t);
  }

  function baueArtefakte(z) {
    z.appendChild(el('p', 'fliess',
      'Artifacts change the rules, not your power. All of them are available from the start, '
      + 'and they stack with each other.'));
    const g = el('div', 'artefakte');
    ROR.Artifacts.DEFS.forEach(function (d) { g.appendChild(artifactTile(d)); });
    z.appendChild(g);
    artefaktZahl = el('p', 'zaehler');
    artefaktZahl.id = 'artefakt-zahl';
    z.appendChild(artefaktZahl);
    zaehlerAktualisieren();
  }

  function baueOptionen(z) {
    const s = el('button', 'kippe' + (ROR.Save.data.alleFrei ? ' an' : ''));
    s.innerHTML = '<i></i><b>Everything unlocked</b>'
      + '<span>Off: survivors have to be earned</span>';
    s.addEventListener('click', function () {
      ROR.Save.setAlleFrei(!ROR.Save.data.alleFrei);
      baue();
      zeigeTafel('options');
    });
    z.appendChild(s);

    const ton = el('button', 'kippe' + (ROR.Audio.an ? ' an' : ''));
    ton.innerHTML = '<i></i><b>Sound</b><span>Music grows with the difficulty</span>';
    ton.addEventListener('click', function () {
      ROR.Audio.setAn(!ROR.Audio.an);
      ton.classList.toggle('an', ROR.Audio.an);
    });
    z.appendChild(ton);

    z.appendChild(el('h3', null, 'Seed'));
    z.appendChild(el('p', 'fliess',
      'The terrain of each stage is fixed — Titanic Plains is always the same map. '
      + 'The seed decides what stands on it: chests, shrines, the teleporter, the monsters.'));
    const seed = document.createElement('input');
    seed.type = 'text';
    seed.placeholder = 'Seed (empty = random)';
    seed.id = 'menu-seed';
    seed.className = 'seedfeld';
    if (letzterSeed) seed.value = letzterSeed;
    seed.addEventListener('input', function () { letzterSeed = seed.value; });
    z.appendChild(seed);
  }

  function baueLogbuch(z) {
    const stat = ROR.Save.data.stats;
    z.appendChild(el('div', 'bilanz',
      '<span><b>' + stat.laeufe + '</b>runs</span>'
      + '<span><b>' + stat.siege + '</b>wins</span>'
      + '<span><b>' + stat.kills + '</b>kills</span>'
      + '<span><b>' + stat.stagesGesamt + '</b>stages</span>'
      + '<span><b>' + stat.besteStage + '</b>best stage</span>'
      + '<span><b>' + stat.hoechsteStufe + '</b>top level</span>'));

    const alleItems = ROR.Items.all().filter(function (i) { return !i.scrap; });
    const gefunden = alleItems.filter(function (i) { return ROR.Save.kennt('items', i.id); });
    z.appendChild(el('h3', null,
      'Items found <small>' + gefunden.length + ' of ' + alleItems.length + '</small>'));
    const gi = el('div', 'logliste');
    alleItems.forEach(function (it) {
      const kennt = ROR.Save.kennt('items', it.id);
      const e = el('i', kennt ? 'bekannt' : 'unbekannt');
      e.style.setProperty('--c', farbe(ROR.Loot.TIER_COLOR[it.tier] || 0xffffff));
      e.textContent = kennt ? it.name.charAt(0) : '?';
      if (kennt) e.title = it.name + ' — ' + it.desc;
      gi.appendChild(e);
    });
    z.appendChild(gi);

    const getoetet = ROR.Data.Monsters.filter(function (m) { return ROR.Save.kennt('gegner', m.id); });
    z.appendChild(el('h3', null,
      'Monsters defeated <small>' + getoetet.length + ' of ' + ROR.Data.Monsters.length + '</small>'));
    const lg = el('div', 'logliste breit');
    ROR.Data.Monsters.forEach(function (mo) {
      const kennt = ROR.Save.kennt('gegner', mo.id);
      const e = el('i', kennt ? 'bekannt' : 'unbekannt');
      e.style.setProperty('--c', mo.isBoss ? '#e2564a'
        : mo.category === 'miniboss' ? '#f2c14e' : '#9fb0bc');
      e.textContent = kennt ? mo.name + ' ×' + ROR.Save.data.logbuch.gegner[mo.id] : '???';
      lg.appendChild(e);
    });
    z.appendChild(lg);

    if (ROR.Save.data.rekorde.length) {
      z.appendChild(el('h3', null, 'Recent runs'));
      const tab = el('div', 'rekorde');
      ROR.Save.data.rekorde.slice(0, 8).forEach(function (r) {
        tab.appendChild(el('div', r.sieg ? 'sieg' : '',
          (r.sieg ? '★ ' : '') + r.figur + '  ·  stage ' + r.stages + '  ·  level ' + r.stufe
          + '  ·  ' + Math.floor(r.zeit / 60) + ':'
          + String(Math.floor(r.zeit % 60)).padStart(2, '0') + '  ·  ' + r.kills + ' kills'));
      });
      z.appendChild(tab);
    }
  }

  /* ---------------------------------------------------------- Itemgitter */

  /* Was man bisher gesammelt hat, nach Stufe gruppiert und mit Anzahl.

     Das Pausemenue sagte bisher nur Name, Stufe und Zeit — also nichts, was
     man nicht ohnehin im HUD sieht. Beim Anhalten will man aber genau das
     nachsehen, wofuer im Gefecht keine Zeit war: was habe ich eigentlich
     aufgesammelt, und wie oft. */
  const TIER_REIHE = ['common', 'uncommon', 'legendary', 'boss', 'lunar', 'equipment'];
  const TIER_NAME = {
    common: 'Common', uncommon: 'Uncommon', legendary: 'Legendary',
    boss: 'Boss', lunar: 'Lunar', equipment: 'Equipment'
  };

  function itemGitter(body) {
    const wrap = el('div', 'itemtafel');
    let gesamt = 0;
    TIER_REIHE.forEach(function (tier) {
      const drin = ROR.Items.all().filter(function (it) {
        return it.tier === tier && !it.scrap && (body.items[it.id] || 0) > 0;
      });
      if (!drin.length) return;
      const gruppe = el('div', 'itemgruppe');
      gruppe.appendChild(el('h4', null, TIER_NAME[tier] || tier));
      const reihe = el('div', 'itemreihe');
      drin.forEach(function (it) {
        const n = body.items[it.id];
        gesamt += n;
        const e = el('div', 'item');
        e.style.setProperty('--c', farbe(ROR.Loot.TIER_COLOR[it.tier] || 0xffffff));
        e.innerHTML = '<i>' + it.name.charAt(0) + '</i>'
          + '<span class="anzahl">' + n + '</span>'
          + '<div class="karte"><b>' + it.name + '</b><p>' + (it.desc || '') + '</p></div>';
        reihe.appendChild(e);
      });
      gruppe.appendChild(reihe);
      wrap.appendChild(gruppe);
    });
    if (!gesamt) wrap.appendChild(el('p', 'fliess', 'Nothing collected yet.'));
    return wrap;
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

    /* Das Pausemenue ist der Ort, an dem man nachsieht, was im Gefecht keine
       Zeit hatte: die eigenen Werte und die gesammelten Items. Vorher stand
       dort nur, was ohnehin im HUD steht. */
    showPause() {
      const box = document.getElementById('pause');
      const p = ROR.Game.player;
      const b = p.body, S = b.stats;
      box.innerHTML = '';

      const innen = el('div', 'pause-innen');
      innen.appendChild(el('b', null, 'PAUSE'));
      innen.appendChild(el('p', 'wer',
        p.def.name + '  ·  level ' + b.level + '  ·  stage '
        + (ROR.Game.stagesCleared + 1) + '  ·  ' + zeit(ROR.Difficulty.runTime)));

      innen.appendChild(el('div', 'pausewerte',
        '<span><b>' + Math.round(b.health) + ' / ' + Math.round(S.maxHealth) + '</b>health</span>'
        + '<span><b>' + S.damage.toFixed(1) + '</b>damage</span>'
        + '<span><b>' + (S.attackSpeed * 100).toFixed(0) + ' %</b>attack speed</span>'
        + '<span><b>' + S.crit.toFixed(0) + ' %</b>crit</span>'
        + '<span><b>' + S.armor.toFixed(0) + '</b>armor</span>'
        + '<span><b>' + S.moveSpeed.toFixed(1) + '</b>m/s</span>'
        + '<span><b>$' + Math.floor(p.gold) + '</b>gold</span>'
        + '<span><b>' + ROR.Difficulty.mode.name + '</b>rain</span>'));

      innen.appendChild(itemGitter(b));

      const kn = el('div', 'knoepfe');
      const weiter = el('button', null, 'Resume');
      weiter.addEventListener('click', function () {
        Menus.hidePause();
        ROR.Engine.setPaused(false);
      });
      const raus = el('button', null, 'Abandon run');
      raus.addEventListener('click', function () {
        Menus.hidePause();
        Menus.show();
      });
      kn.appendChild(weiter); kn.appendChild(raus);
      innen.appendChild(kn);

      innen.appendChild(el('p', 'klein',
        'W A S D move · Mouse aim · Space jump · Ctrl sprint · '
        + 'E interact · Q equipment · F3 debug'));

      box.appendChild(innen);
      box.className = 'show';
    },

    hidePause() { document.getElementById('pause').className = 'hidden'; },

    init() {
      chooser = document.getElementById('chooser');
      baue();
      Vorschau.start();
      addEventListener('resize', passeVorschauAn);
    },

    show() {
      baue();   // Freischaltungen und Logbuch können sich geändert haben
      Vorschau.start();
      root.classList.remove('hidden');
      ROR.Engine.setPaused(true);
      ROR.Input.unlock();
    },

    hide() {
      root.classList.add('hidden');
      Vorschau.stopp();          // kein Bild rendern, das niemand sieht
      ROR.Engine.setPaused(false);
    },

    start() {
      /* Das Seedfeld liegt in der Optionen-Tafel und ist meist gar nicht im
         DOM — deshalb der gemerkte Wert als Rueckfall. */
      const el2 = document.getElementById('menu-seed');
      const feld = (el2 ? el2.value : letzterSeed || '').trim();
      const seed = /^-?\d+$/.test(feld) ? (parseInt(feld, 10) >>> 0) : undefined;
      Menus.hide();
      ROR.Game.newRun({ survivor: gewaehlt, difficulty: schwierigkeit, seed: seed });
    },

    chooseItem: zeigeAuswahl,
    get choosing() { return chooser && chooser.classList.contains('show'); }
  };

  ROR.Menus = Menus;
})(window.ROR);
