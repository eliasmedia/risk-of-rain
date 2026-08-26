/* game/entities/interactable.js
   Kisten, Schreine, Drucker — und der Director, der sie verteilt.

   Zu Beginn einer Stage bekommt der Interactable-Director ein Budget
   (Titanic Plains: 220 Credits) und kauft davon Objekte ein, bis nichts mehr
   reicht. Dieselbe Idee wie beim Combat Director, nur einmalig statt laufend:
   dadurch ist jede Stage anders bestückt, ohne dass irgendwo eine Liste von
   Fundorten steht.

   Bedient wird über Nähe und E. Der Preis steht am Objekt und wird rot, wenn
   das Gold nicht reicht — man soll von weitem sehen, ob sich der Weg lohnt. */
(function (ROR) {
  'use strict';

  const U = ROR.Util;
  const _w = new THREE.Vector3();
  const _blick = new THREE.Vector3();
  const REACH = 4.5;
  const list = [];
  let group = null;
  let focus = null;

  function mat(color, emissive) {
    return ROR.Toon.material({
      color: color,
      emissive: emissive === undefined ? 0x000000 : emissive,
      emissiveIntensity: 0.5
    });
  }

  function box(parent, w, h, d, color, x, y, z, role) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    if (role) m.userData.role = role;
    parent.add(m);
    return m;
  }

  /* ------------------------------------------------------------ Modelle */

  function buildChest(def) {
    const g = new THREE.Group();
    const s = def.size || 1;
    box(g, 1.3 * s, 0.75 * s, 0.9 * s, def.color, 0, 0.38 * s, 0);
    box(g, 1.36 * s, 0.1 * s, 0.96 * s, 0x3c3128, 0, 0.08 * s, 0);
    const deckel = new THREE.Group();
    deckel.position.set(0, 0.75 * s, -0.45 * s);
    deckel.userData.role = 'lid';
    g.add(deckel);
    box(deckel, 1.3 * s, 0.28 * s, 0.9 * s, def.color, 0, 0.14 * s, 0.45 * s);
    box(deckel, 1.36 * s, 0.1 * s, 0.2 * s, 0xc9a23c, 0, 0.3 * s, 0.45 * s);
    box(g, 0.2 * s, 0.24 * s, 0.12 * s, 0xc9a23c, 0, 0.6 * s, 0.47 * s);
    return g;
  }

  function buildMultishop(def) {
    const g = new THREE.Group();
    box(g, 3.6, 0.22, 1.0, 0x39424a, 0, 0.11, 0);
    for (let i = -1; i <= 1; i++) {
      const t = new THREE.Group();
      /* 1.35 m Abstand statt 0.85: bei drei Terminals muss eindeutig sein,
         vor welchem man steht. Bei 0.85 war der Nachbar oft naeher als das
         Terminal, auf das man schaute. */
      t.position.set(i * 1.35, 0.22, 0);
      t.userData.role = 'terminal' + (i + 1);
      g.add(t);
      box(t, 0.62, 1.05, 0.5, def.color, 0, 0.52, 0);
      const glas = box(t, 0.42, 0.42, 0.06, 0xbfe8ff, 0, 0.72, -0.26);
      glas.material.emissive = new THREE.Color(0x2b7fa0);
      glas.userData.role = 'glow' + (i + 1);
    }
    return g;
  }

  function buildBarrel(def) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 1.2, 10), mat(def.color));
    m.position.y = 0.6; m.castShadow = true; g.add(m);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.07, 6, 12), mat(0x4a3a2a));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.85; g.add(ring);
    const kern = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0),
      new THREE.MeshBasicMaterial({ color: 0xff9a3a, transparent: true, opacity: 0.85,
                                    depthWrite: false, blending: THREE.AdditiveBlending }));
    kern.position.y = 1.35; kern.userData.role = 'glow'; g.add(kern);
    return g;
  }

  /* Ein Portal: ein stehender Ring mit einer flimmernden Scheibe darin.
     Bewusst gross und von weitem sichtbar — man soll aus der Ferne erkennen,
     dass die Stage einen Ausgang hat, und bei mehreren auch, welchen. */
  function buildPortal(def) {
    const g = new THREE.Group();
    // Sockel
    box(g, 2.6, 0.3, 1.2, 0x3a3f46, 0, 0.15, 0);
    // Ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.22, 6, 20), mat(0x4e5560));
    ring.position.y = 2.4;
    ring.castShadow = true;
    g.add(ring);
    // Zwei Streben, damit der Ring nicht schwebt
    for (let k = -1; k <= 1; k += 2) {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.1, 5), mat(0x4e5560));
      st.position.set(k * 1.35, 0.6, 0);
      st.rotation.z = -k * 0.28;
      g.add(st);
    }
    // Die Scheibe im Ring
    const scheibe = new THREE.Mesh(new THREE.CircleGeometry(1.85, 20),
      new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.55,
                                    side: THREE.DoubleSide, depthWrite: false,
                                    blending: THREE.AdditiveBlending }));
    scheibe.position.y = 2.4;
    scheibe.userData.role = 'glow';
    g.add(scheibe);
    // Ein zweiter, kleinerer Ring dreht sich gegenlaeufig
    const innen = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.07, 5, 16),
      new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.8,
                                    depthWrite: false, blending: THREE.AdditiveBlending }));
    innen.position.y = 2.4;
    innen.userData.role = 'ring';
    g.add(innen);
    return g;
  }

  /* Der Newt-Altar. Er teilt sich mit den Schreinen nichts mehr: eine flache
     Schale auf einem Steinsockel, davor die kauernde Gestalt des Newt, und
     ueber der Schale ein Mondlicht. Wer ihn einmal gesehen hat, erkennt ihn
     im Vorbeilaufen wieder — und darum geht es, denn er steht abseits. */
  function buildNewt(def) {
    const g = new THREE.Group();
    // Stufenpodest
    box(g, 3.0, 0.24, 3.0, 0x4a4640, 0, 0.12, 0);
    box(g, 2.2, 0.26, 2.2, 0x565149, 0, 0.37, 0);
    // Schale
    const schale = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.62, 0.42, 10), mat(0x6b665c));
    schale.position.y = 0.71; schale.castShadow = true; g.add(schale);
    const wasser = new THREE.Mesh(new THREE.CircleGeometry(0.82, 14),
      new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.7,
                                    depthWrite: false, blending: THREE.AdditiveBlending }));
    wasser.rotation.x = -Math.PI / 2;
    wasser.position.y = 0.9;
    wasser.userData.role = 'glow';
    g.add(wasser);
    /* Der Newt selbst: geduckter Koerper, langer Schwanz, ein Auge. Klein
       genug, dass er nicht wie ein Gegner wirkt. */
    const tier = new THREE.Group();
    tier.position.set(0, 0.5, -1.05);
    g.add(tier);
    const koerper = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.62, 6), mat(0x4a6f7a));
    koerper.rotation.x = Math.PI / 2 - 0.3;
    koerper.position.y = 0.2;
    tier.add(koerper);
    const kopf = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.3, 6), mat(0x4a6f7a));
    kopf.rotation.x = Math.PI / 2;
    kopf.position.set(0, 0.32, -0.3);
    tier.add(kopf);
    const auge = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0),
      new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.95,
                                    depthWrite: false, blending: THREE.AdditiveBlending }));
    auge.position.set(0, 0.38, -0.42);
    auge.userData.role = 'glow2';
    tier.add(auge);
    // Schwanz in drei Gliedern
    let z = 0.28;
    for (let i = 0; i < 3; i++) {
      const t = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09 - i * 0.025, 0.12 - i * 0.025, 0.32, 5), mat(0x40606a));
      t.rotation.x = Math.PI / 2 + 0.2 * (i + 1);
      t.position.set(0, 0.16 - i * 0.03, z);
      tier.add(t);
      z += 0.28;
    }
    // Zwei Steinstelen dahinter, damit er auch aus der Ferne auffaellt
    for (let k = -1; k <= 1; k += 2) {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 2.4, 5), mat(0x5f5a51));
      st.position.set(k * 1.15, 1.2, 0.9);
      st.rotation.z = -k * 0.08;
      st.castShadow = true;
      g.add(st);
      const licht = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0),
        new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.85,
                                      depthWrite: false, blending: THREE.AdditiveBlending }));
      licht.position.set(k * 1.15, 2.5, 0.9);
      licht.userData.role = 'glow' + (k > 0 ? 3 : 4);
      g.add(licht);
    }
    return g;
  }

  function buildShrine(def) {
    const g = new THREE.Group();
    box(g, 1.4, 0.3, 1.4, 0x5b5750, 0, 0.15, 0);
    const saeule = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.5, 2.2, 6), mat(0x6b665c));
    saeule.position.y = 1.35; saeule.castShadow = true; g.add(saeule);
    const rune = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0),
      new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.9,
                                    depthWrite: false, blending: THREE.AdditiveBlending }));
    rune.position.y = 2.75; rune.userData.role = 'glow'; g.add(rune);
    return g;
  }

  function buildMachine(def, trichter) {
    const g = new THREE.Group();
    box(g, 1.5, 0.24, 1.2, 0x39424a, 0, 0.12, 0);
    box(g, 1.15, 1.25, 0.95, 0x5a636b, 0, 0.85, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.08, 6, 14), mat(def.color, def.color));
    ring.position.set(0, 1.55, 0); ring.rotation.x = Math.PI / 2;
    ring.userData.role = 'ring'; g.add(ring);
    if (trichter) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.2, 0.55, 8), mat(0x4a5158));
      t.position.y = 1.85; g.add(t);
    }
    const kern = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 0),
      new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.9,
                                    depthWrite: false, blending: THREE.AdditiveBlending }));
    kern.position.y = 1.55; kern.userData.role = 'glow'; g.add(kern);
    return g;
  }

  /* Kaputte Drohne am Boden: erst nach dem Kauf hebt sie ab. */
  function buildDrone(def) {
    const g = new THREE.Group();
    box(g, 0.7, 0.24, 0.7, def.color, 0, 0.12, 0);
    const r = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), mat(def.color));
    r.position.y = 0.34; r.rotation.z = 0.5; r.castShadow = true; g.add(r);
    box(g, 0.5, 0.06, 0.16, 0x33444f, 0.2, 0.3, 0).rotation.z = 0.6;
    const auge = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0),
      new THREE.MeshBasicMaterial({ color: 0x9fe4ff, transparent: true, opacity: 0.5,
                                    depthWrite: false, blending: THREE.AdditiveBlending }));
    auge.position.set(0, 0.34, -0.2); auge.userData.role = 'glow'; g.add(auge);
    return g;
  }

  const BUILDERS = {
    chest: buildChest, multishop: buildMultishop, equipment: buildBarrel,
    drone: buildDrone, newt: buildNewt, lunar: buildBarrel, cleanse: buildShrine,
    portal: buildPortal,
    shrine_chance: buildShrine, shrine_blood: buildShrine,
    shrine_combat: buildShrine, shrine_mountain: buildShrine,
    printer: (d) => buildMachine(d, true), scrapper: (d) => buildMachine(d, false)
  };

  /* ---------------------------------------------------------- Erzeugen */

  function parts(root) {
    const out = {};
    root.traverse(function (o) {
      if (o.userData && o.userData.role && !out[o.userData.role]) {
        if (o.material && o.userData.role.indexOf('glow') === 0) o.material = o.material.clone();
        out[o.userData.role] = o;
      }
    });
    return out;
  }

  /* Der Teleporter zählt als bedienbares Objekt wie jedes andere — dadurch
     fühlen sich Aufforderung und Bedienung überall gleich an, obwohl er in
     einer eigenen Datei lebt. */
  const TELEPORT_PROXY = { isTeleporter: true, used: false, def: { name: 'Teleporter' } };

  const Interactables = {
    list: list,
    get focus() { return focus; },

    init() {
      Interactables.clear();
      group = new THREE.Group();
      group.name = 'interactables';
      ROR.Engine.scene.add(group);
    },

    clear() {
      if (group) {
        ROR.Engine.scene.remove(group);
        group.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) o.material.dispose();
        });
      }
      group = null; list.length = 0; focus = null;
    },

    spawn(def, position) {
      const model = BUILDERS[def.kind](def);
      model.position.copy(position);
      model.rotation.y = U.chaos.range(0, U.TAU);
      group.add(model);

      const o = {
        def: def, model: model, parts: parts(model),
        used: false, uses: 0, lid: 0, spin: U.chaos.range(0, 6.28),
        cost: ROR.Difficulty.priceOf(def.baseCost),
        payload: null
      };

      /* Drucker legen zu Beginn fest, was sie herstellen — wie in der Vorlage.
         Man sieht also schon von weitem, ob sich der Weg lohnt. */
      if (def.kind === 'printer') o.payload = ROR.Loot.randomItem(def.tier);

      /* Das Multishop-Terminal war bisher eine Kiste mit anderem Modell: ein
         Kauf, ein zufaelliges Item, fertig. Der Unterschied zur Kiste ist aber
         gerade, dass man *sieht*, was drin ist, und sich fuer eines von drei
         entscheidet — die anderen beiden schalten danach ab. Aus "ein
         unbekanntes Item" wird "eines von drei bekannten". */
      if (def.kind === 'multishop') {
        o.angebot = [];
        for (let i = 0; i < 3; i++) {
          // Aus derselben Tabelle wie eine Kiste — sonst waere das Terminal
          // nur eine Kiste mit garantiert weissem Item.
          const tier = ROR.Loot.pickTier(ROR.Loot[def.table] || ROR.Loot.CHEST);
          const item = tier ? ROR.Loot.randomItem(tier) : null;
          const halter = o.parts['terminal' + i];
          o.angebot.push({ item: item, halter: halter, aus: false, vorschau: null });
          if (item && halter) {
            const v = ROR.Attire.pickupModel(item);
            v.scale.setScalar(0.62);
            v.position.set(0, 1.35, 0);
            halter.add(v);
            o.angebot[i].vorschau = v;
          }
        }
      }

      /* Im Bazaar gilt dasselbe, aus einem anderen Grund: Mondkapseln geben
         Lunar-Items, und die greifen so tief in den Durchlauf ein, dass man
         vor dem Bezahlen wissen muss, was man bekommt. */
      if (def.kind === 'lunar') {
        o.payload = ROR.Loot.randomItem('lunar');
        if (o.payload) {
          const v = ROR.Attire.pickupModel(o.payload);
          v.scale.setScalar(0.7);
          v.position.set(0, 1.5, 0);
          model.add(v);
          o.vorschau = v;
        }
      }
      list.push(o);
      return o;
    },

    /* Der Scene Director: einmal je Stage einkaufen, bis das Budget leer ist. */
    populate(stage, stageOrder, seed) {
      Interactables.init();
      const rng = U.Rng((seed >>> 0) ^ 0x5eed1);
      let budget = (ROR.Data.InteractableBudget[stageOrder] || 220);
      const imBazaar = stageOrder === 0;
      /* Der Bazaar hat sein eigenes Sortiment, Commencement gar keines —
         dort steht nur noch Mithrix. */
      if (stageOrder === 6) return 0;
      /* `weight > 0` haelt die Portale heraus: sie stehen zwar in derselben
         Tabelle, werden aber nicht gestreut, sondern vom Teleporter gesetzt. */
      const defs = ROR.Data.Interactables.filter(function (d) {
        if (!(d.weight > 0)) return false;
        return imBazaar ? !!d.bazaarOnly : !d.bazaarOnly;
      });
      let guard = 400;

      /* Kisten stehen in Gruppen, nicht gleichmaessig ueber die Karte
         verteilt.

         Gleichverteilt gestreut hatte jede Kiste dieselbe Chance auf jeden
         Punkt — auf einer 300-Meter-Karte fiel das kaum auf, auf der
         vierfachen Flaeche steht dann alles einzeln irgendwo herum und man
         laeuft von Fundstueck zu Fundstueck. In Gruppen entstehen Orte, an
         denen sich das Hinlaufen lohnt: man findet drei Kisten auf einmal,
         entscheidet welche man sich leisten kann, und geht weiter.

         Die Ankerpunkte werden zuerst gesucht und ueber die Karte verteilt;
         danach setzt sich jede Kiste in die Naehe eines davon. */
      const anker = [];
      const ankerZahl = U.clamp(Math.round(stage.terrain.half / 34), 4, 12);
      for (let i = 0; i < ankerZahl * 4 && anker.length < ankerZahl; i++) {
        const a = stage.findeFreiePosition(rng, {
          rMin: 14, rMax: stage.terrain.half * 0.82, maxSlope: 0.13, tries: 20, platz: 5
        });
        if (!a) continue;
        // Ankerpunkte sollen nicht aufeinander liegen.
        let weitGenug = true;
        for (let k = 0; k < anker.length; k++) {
          if (U.dist2(a.x, a.z, anker[k].x, anker[k].z) < 55 * 55) { weitGenug = false; break; }
        }
        if (weitGenug) anker.push(a);
      }

      while (budget > 0 && guard-- > 0) {
        const bezahlbar = defs.filter(function (d) {
          return d.directorCost <= budget && ROR.Artifacts.allowsInteractable(d);
        });
        if (!bezahlbar.length) break;
        const def = rng.weighted(bezahlbar);

        let spot = null;
        if (anker.length) {
          /* Um einen Anker herum suchen. Klappt das nicht — steiler Hang,
             Felsen im Weg —, weicht die Suche auf die ganze Karte aus, damit
             das Budget nicht ungenutzt verfaellt. */
          const a = anker[(rng.next() * anker.length) | 0];
          for (let v = 0; v < 14 && !spot; v++) {
            const w = rng.next() * U.TAU;
            const d = 4 + Math.sqrt(rng.next()) * 20;
            const x = a.x + Math.cos(w) * d, z = a.z + Math.sin(w) * d;
            if (!stage.terrain.isWalkable(x, z, 0.16)) continue;
            if (!stage.frei(x, z, 2.6)) continue;
            spot = { x: x, y: stage.terrain.heightAt(x, z), z: z };
          }
        }
        if (!spot) {
          spot = stage.findeFreiePosition(rng, {
            rMin: 6, rMax: stage.terrain.half * 0.85, maxSlope: 0.16, tries: 30, platz: 2.6
          });
        }
        if (!spot) continue;
        // Nicht ineinander stellen.
        let frei = true;
        for (let i = 0; i < list.length; i++) {
          if (U.dist2(spot.x, spot.z, list[i].model.position.x, list[i].model.position.z) < 25) {
            frei = false; break;
          }
        }
        if (!frei) continue;
        Interactables.spawn(def, new THREE.Vector3(spot.x, spot.y, spot.z));
        budget -= def.directorCost;
      }
      return list.length;
    },

    /* --------------------------------------------------------- Bedienen */

    /* Welches Lunar-Item das Becken schlucken würde. */
    lunarBesitz(body) {
      const items = ROR.Items.all();
      for (let i = 0; i < items.length; i++) {
        if (items[i].tier === 'lunar' && (body.items[items[i].id] || 0) > 0) return items[i];
      }
      return null;
    },

    /* Was ein Drucker frisst: zuerst Schrott, sonst das häufigste Item
       dieser Stufe. Ohne Auswahlfenster ist das die Regel, die am wenigsten
       überrascht. */
    feedFor(body, tier) {
      const items = ROR.Items.all();
      let best = null, bestCount = 0;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.tier !== tier) continue;
        const c = body.items[it.id] || 0;
        if (c <= 0) continue;
        if (it.scrap) return it;
        if (c > bestCount) { bestCount = c; best = it; }
      }
      return best;
    },

    scrapFor(body) {
      const items = ROR.Items.all();
      const rang = { common: 0, uncommon: 1, legendary: 2 };
      let best = null, bestScore = -1;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.scrap || rang[it.tier] === undefined) continue;
        const c = body.items[it.id] || 0;
        if (c <= 0) continue;
        const score = c * 10 - rang[it.tier];   // lieber viele billige als das eine rote
        if (score > bestScore) { bestScore = score; best = it; }
      }
      return best;
    },

    /* Text für die Aufforderung und ob sie erfüllbar ist. */
    /* Welches der drei Terminals ist gemeint? Das naechstgelegene.

       Das Zielsystem kennt nur ganze Interaktive, keine Unterteile. Statt es
       dafuer umzubauen, entscheidet der Standort: man stellt sich vor das
       Terminal, das man will, und drueckt. Das ist auch genau die Geste, die
       die Vorlage verlangt. */
    nahesTerminal(o) {
      if (!o.angebot) return null;
      const p = ROR.Game.player;
      /* Gemeint ist das Terminal, das man *ansieht*, nicht das naechste. Bei
         drei Kaesten nebeneinander ist der Abstand fast gleich, die
         Blickrichtung dagegen eindeutig — und sie ist auch das, was der
         Spieler als Absicht empfindet. Der Abstand entscheidet nur noch bei
         gleichem Winkel. */
      ROR.Camera.forward(_blick);
      _blick.y = 0;
      if (_blick.lengthSq() < 1e-6) _blick.set(0, 0, -1);
      _blick.normalize();
      let best = null, bestWert = -Infinity;
      for (let i = 0; i < o.angebot.length; i++) {
        const a = o.angebot[i];
        if (a.aus || !a.halter || !a.item) continue;
        a.halter.getWorldPosition(_w);
        const dx = _w.x - p.position.x, dz = _w.z - p.position.z;
        const laenge = Math.hypot(dx, dz) || 1e-4;
        const ausrichtung = (dx / laenge) * _blick.x + (dz / laenge) * _blick.z;
        // Ausrichtung zaehlt stark, Naehe nur als Stichentscheid.
        const wert = ausrichtung * 4 - laenge * 0.1;
        if (wert > bestWert) { bestWert = wert; best = a; }
      }
      return best;
    },

    prompt(o, body) {
      if (o.isTeleporter) return ROR.Teleporter.prompt();
      const d = o.def;
      const p = ROR.Game.player;
      switch (d.kind) {
        case 'shrine_blood':
          return { text: d.name + ' — 50 % of your health for gold',
                   ok: body.health > body.stats.maxHealth * 0.1, uses: 2 - o.uses };
        case 'shrine_mountain':
          return { text: d.name + ' — one more boss, one more reward',
                   ok: o.uses < 1, uses: 1 - o.uses };
        case 'printer': {
          const futter = Interactables.feedFor(body, d.tier);
          return { text: '3D-Drucker: ' + (o.payload ? o.payload.name : '—')
                     + (futter ? '  ←  ' + futter.name : '  (nothing to insert)'),
                   ok: !!futter && !!o.payload };
        }
        case 'scrapper': {
          const ziel = Interactables.scrapFor(body);
          return { text: 'Scrapper: ' + (ziel ? ziel.name + ' → Schrott' : 'nothing to scrap'),
                   ok: !!ziel };
        }
        case 'shrine_chance':
          return { text: d.name + ' — $' + o.cost, ok: p.gold >= o.cost, uses: 2 - o.uses };
        case 'newt':
          return { text: 'Newt Altar — 1 lunar coin (opens the Bazaar)',
                   ok: ROR.Game.lunarCoins >= 1 };
        case 'portal':
          return { text: d.name + ' — ' +
                     (d.ziel === 'bazaar' ? 'to the Bazaar'
                      : d.ziel === 'commencement' ? 'face Mithrix'
                      : 'to the next stage'), ok: true };

        case 'multishop': {
          const t = Interactables.nahesTerminal(o);
          return { text: t ? t.item.name + ' — $' + o.cost : d.name,
                   ok: !!t && p.gold >= o.cost };
        }
        case 'lunar':
          return { text: 'Lunar Pod: ' + (o.payload ? o.payload.name : '—') + ' — 1 lunar coin',
                   ok: ROR.Game.lunarCoins >= 1 && !!o.payload };
        case 'cleanse':
          return { text: 'Cleansing Pool — a lunar item for a coin',
                   ok: Interactables.lunarBesitz(body) !== null };
        default:
          return { text: d.name + ' — $' + o.cost, ok: p.gold >= o.cost };
      }
    },

    use(o, body) {
      if (o.isTeleporter) return ROR.Teleporter.use();
      const d = o.def;
      const p = ROR.Game.player;
      const pos = o.model.position.clone();
      const pr = Interactables.prompt(o, body);
      if (!pr.ok) return false;

      switch (d.kind) {
        case 'chest':
          p.gold -= o.cost;
          o.used = true;
          ROR.Loot.dropFrom(ROR.Loot[d.table], pos, body);
          break;

        case 'portal': {
          /* Ein Portal wird nicht verbraucht — es fuehrt einfach woandershin.
             Deshalb kein `o.used`; wer davorsteht und es sich anders ueberlegt,
             kann zurueckgehen und ein anderes nehmen. */
          if (d.ziel === 'bazaar') ROR.Game.enterBazaar();
          else if (d.ziel === 'commencement') ROR.Game.enterCommencement();
          else ROR.Game.nextStage();
          return;
        }

        case 'multishop': {
          /* Das gewaehlte Terminal gibt sein Item aus, die beiden anderen
             schalten ab — sichtbar, nicht nur im Zustand. Genau das ist der
             Unterschied zur Kiste: man gibt zwei bekannte Items auf, um eines
             zu bekommen. */
          const t = Interactables.nahesTerminal(o);
          if (!t) break;
          p.gold -= o.cost;
          o.used = true;
          ROR.Loot.drop(pos, t.item);
          for (let i = 0; i < o.angebot.length; i++) {
            const a = o.angebot[i];
            a.aus = true;
            if (a.vorschau) a.vorschau.visible = false;
            const glas = o.parts['glow' + i];
            if (glas && glas.material) {
              glas.material = glas.material.clone();
              glas.material.emissive = new THREE.Color(0x101418);
              glas.material.color = new THREE.Color(0x2a3238);
            }
          }
          break;
        }

        case 'equipment': {
          p.gold -= o.cost;
          o.used = true;
          const eq = ROR.Loot.randomItem('equipment');
          if (eq) ROR.Loot.drop(pos, eq);
          break;
        }

        case 'shrine_chance': {
          p.gold -= o.cost;
          // Jeder Versuch verteuert den nächsten um 40 %.
          o.cost = Math.ceil(o.cost * 1.4);
          const tier = ROR.Loot.dropFrom(ROR.Loot.SHRINE, pos, body);
          if (tier) {
            o.uses++;
            if (o.uses >= 2) o.used = true;
          } else {
            ROR.Projectiles.spark(pos.clone().setY(pos.y + 2.7), 0x808890, 1.4);
            ROR.HUD.toast('Nichts.', 'bad');
          }
          break;
        }

        case 'shrine_blood': {
          const bezahlt = body.health * 0.5;
          body.health -= bezahlt;
          p.gold += bezahlt * 1.6;
          o.uses++;
          if (o.uses >= 2) o.used = true;
          ROR.Projectiles.spark(pos.clone().setY(pos.y + 2.7), 0xd03a3a, 1.8);
          ROR.HUD.toast('+$' + Math.floor(bezahlt * 1.6), 'gold');
          break;
        }

        case 'shrine_combat': {
          p.gold -= o.cost;
          o.uses++;
          if (o.uses >= 2) o.used = true;
          ROR.Director.gift(90 + 60 * ROR.Difficulty.coeff);
          ROR.HUD.toast('Der Schrein ruft sie herbei', 'bad');
          break;
        }

        case 'drone': {
          p.gold -= o.cost;
          o.used = true;
          const anzahl = ROR.Deployables.list.filter(function (x) { return x.kind === 'drone'; }).length;
          ROR.Deployables.spawn('drone', body, o.model.position.clone().setY(o.model.position.y + 2),
            { index: anzahl, heals: !!d.heals, interval: d.heals ? 1.2 : 0.5,
              coefficient: 1.0, range: 45, max: 6,
              colors: { main: d.color, dark: 0x33444f, glow: 0x9fe4ff } });
          ROR.HUD.toast(d.heals ? 'Heildrohne folgt dir' : 'Kampfdrohne folgt dir');
          break;
        }

        case 'lunar': {
          /* Ausgegeben wird das Item, das oben schwebt — nicht ein frisch
             gewuerfeltes. Sonst waere die Vorschau eine Luege. */
          if (!o.payload) break;
          ROR.Game.lunarCoins--;
          o.used = true;
          if (o.vorschau) o.vorschau.visible = false;
          ROR.Loot.drop(o.model.position.clone(), o.payload);
          break;
        }

        case 'cleanse': {
          const weg = Interactables.lunarBesitz(body);
          ROR.Items.take(body, weg.id, 1);
          ROR.Game.lunarCoins++;
          ROR.Attire.markDirty();
          ROR.HUD.toast(weg.name + ' scrapped  ·  +1 lunar coin', 'gold');
          break;
        }

        case 'newt':
          ROR.Game.lunarCoins--;
          o.used = true;
          ROR.Game.bazaarOffen = true;
          ROR.HUD.toast('The blue portal will open');
          break;

        case 'shrine_mountain':
          o.uses++;
          o.used = true;
          ROR.Game.mountainShrines = (ROR.Game.mountainShrines || 0) + 1;
          ROR.HUD.toast('Bergschrein aktiviert');
          break;

        case 'printer': {
          const futter = Interactables.feedFor(body, d.tier);
          ROR.Items.take(body, futter.id, 1);
          ROR.Loot.drop(pos, o.payload);
          break;   // Drucker bleiben nutzbar, solange man Futter hat
        }

        case 'scrapper': {
          const ziel = Interactables.scrapFor(body);
          ROR.Items.take(body, ziel.id, 1);
          const schrott = { common: 'scrap_white', uncommon: 'scrap_green',
                            legendary: 'scrap_red' }[ziel.tier];
          ROR.Loot.drop(pos, ROR.Items.def(schrott));
          break;
        }
      }
      if (o.used) o.lid = 1;
      ROR.Audio.spiel('kiste');
      return true;
    },

    update(dt) {
      const p = ROR.Game.player;
      if (!p || !list.length) { focus = null; return; }

      let best = null, bd = REACH * REACH;
      for (let i = 0; i < list.length; i++) {
        const o = list[i];

        // Kistendeckel klappt auf, Ringe drehen sich, Runen pulsieren.
        if (o.parts.lid) o.parts.lid.rotation.x = -o.lid * 1.9;
        if (o.lid > 0 && o.lid < 1) o.lid = Math.min(1, o.lid + dt * 3);
        if (o.parts.ring) o.parts.ring.rotation.z += dt * (o.used ? 0.3 : 1.6);
        o.spin += dt;
        for (const k in o.parts) {
          if (k.indexOf('glow') !== 0) continue;
          const g = o.parts[k];
          const puls = o.used ? 0.12 : 0.55 + Math.sin(o.spin * 2.2) * 0.25;
          g.material.opacity = puls;
          g.scale.setScalar(o.used ? 0.6 : 1 + Math.sin(o.spin * 2.2) * 0.12);
        }

        if (o.used) continue;
        const d2 = U.dist2(o.model.position.x, o.model.position.z, p.position.x, p.position.z);
        if (d2 < bd && Math.abs(o.model.position.y - p.position.y) < 4) { bd = d2; best = o; }
      }
      const tp = ROR.Teleporter;
      if (tp && tp.parts && tp.prompt()) {
        const d2 = U.dist2(tp.position.x, tp.position.z, p.position.x, p.position.z);
        if (d2 < 49 && d2 < bd) best = TELEPORT_PROXY;
      }
      focus = best;

      if (focus && ROR.Input.pressed('interact')) Interactables.use(focus, p.body);
    }
  };

  ROR.Interactables = Interactables;
})(window.ROR);
