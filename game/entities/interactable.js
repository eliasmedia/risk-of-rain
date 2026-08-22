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
  const REACH = 4.5;
  const list = [];
  let group = null;
  let focus = null;

  function mat(color, emissive) {
    return new THREE.MeshLambertMaterial({
      color: color, flatShading: true,
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
    box(g, 2.4, 0.22, 1.0, 0x39424a, 0, 0.11, 0);
    for (let i = -1; i <= 1; i++) {
      const t = new THREE.Group();
      t.position.set(i * 0.85, 0.22, 0);
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
    drone: buildDrone, newt: buildShrine, lunar: buildBarrel, cleanse: buildShrine,
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
      const defs = ROR.Data.Interactables.filter(function (d) {
        return imBazaar ? !!d.bazaarOnly : !d.bazaarOnly;
      });
      let guard = 400;

      while (budget > 0 && guard-- > 0) {
        const bezahlbar = defs.filter(function (d) {
          return d.directorCost <= budget && ROR.Artifacts.allowsInteractable(d);
        });
        if (!bezahlbar.length) break;
        const def = rng.weighted(bezahlbar);
        const spot = stage.terrain.findSpot(rng, {
          rMin: 6, rMax: stage.terrain.half * 0.85, maxSlope: 0.16, tries: 30
        });
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
    prompt(o, body) {
      if (o.isTeleporter) return ROR.Teleporter.prompt();
      const d = o.def;
      const p = ROR.Game.player;
      switch (d.kind) {
        case 'shrine_blood':
          return { text: d.name + ' — 50 % des Lebens für Gold',
                   ok: body.health > body.stats.maxHealth * 0.1, uses: 2 - o.uses };
        case 'shrine_mountain':
          return { text: d.name + ' — ein Bosskampf mehr, eine Belohnung mehr',
                   ok: o.uses < 1, uses: 1 - o.uses };
        case 'printer': {
          const futter = Interactables.feedFor(body, d.tier);
          return { text: '3D-Drucker: ' + (o.payload ? o.payload.name : '—')
                     + (futter ? '  ←  ' + futter.name : '  (nichts zum Einwerfen)'),
                   ok: !!futter && !!o.payload };
        }
        case 'scrapper': {
          const ziel = Interactables.scrapFor(body);
          return { text: 'Scrapper: ' + (ziel ? ziel.name + ' → Schrott' : 'nichts zum Zerlegen'),
                   ok: !!ziel };
        }
        case 'shrine_chance':
          return { text: d.name + ' — $' + o.cost, ok: p.gold >= o.cost, uses: 2 - o.uses };
        case 'newt':
          return { text: 'Newt-Altar — 1 Mondmünze (öffnet den Bazaar)',
                   ok: ROR.Game.lunarCoins >= 1 };
        case 'lunar':
          return { text: 'Mondkapsel — 1 Mondmünze', ok: ROR.Game.lunarCoins >= 1 };
        case 'cleanse':
          return { text: 'Reinigungsbecken — ein Lunar-Item gegen eine Münze',
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

        case 'multishop': {
          p.gold -= o.cost;
          o.used = true;
          ROR.Loot.dropFrom(ROR.Loot.CHEST, pos, body);
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
          ROR.Game.lunarCoins--;
          o.used = true;
          const def2 = ROR.Loot.randomItem('lunar');
          if (def2) ROR.Loot.drop(o.model.position.clone(), def2);
          break;
        }

        case 'cleanse': {
          const weg = Interactables.lunarBesitz(body);
          ROR.Items.take(body, weg.id, 1);
          ROR.Game.lunarCoins++;
          ROR.Attire.markDirty();
          ROR.HUD.toast(weg.name + ' abgelegt  ·  +1 Mondmünze', 'gold');
          break;
        }

        case 'newt':
          ROR.Game.lunarCoins--;
          o.used = true;
          ROR.Game.bazaarOffen = true;
          ROR.HUD.toast('Das blaue Portal wird sich öffnen');
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
