/* game/world/teleporter.js
   Das Teleporter-Ereignis — der Taktgeber eines Durchlaufs.

   Ablauf wie in der Vorlage:
     1. Der Teleporter steht irgendwo auf der Stage und muss gefunden werden.
     2. Aktivieren kostet nichts. Sofort erscheint ein Boss, und der Combat
        Director bekommt zusätzliche Credits.
     3. Der Teleporter lädt 90 Sekunden lang — aber nur, solange man im Umkreis
        von 60 m steht. Genau darin liegt der Konflikt: man muss bleiben, wo
        alles auf einen zuläuft.
     4. Erst wenn er voll ist *und* der Boss tot ist, öffnet sich das Portal.
     5. Belohnung: ein grünes Item, in 15 % der Fälle ein Boss-Item, dazu
        Goldregen.

   Jeder Bergschrein verdoppelt Bosswelle und Belohnung.                     */
(function (ROR) {
  'use strict';

  const U = ROR.Util;
  const CHARGE_TIME = 90;
  const RADIUS = 60;          // Wiki: rund 120 m Durchmesser
  const BOSS_ITEM_CHANCE = 0.15;

  let root = null;
  const _v = new THREE.Vector3();

  const Teleporter = {
    state: 'idle',            // idle · charging · waiting · ready · used
    charge: 0,
    position: new THREE.Vector3(),
    bosses: [],
    parts: null,

    get active() { return Teleporter.state === 'charging' || Teleporter.state === 'waiting'; },
    /* Einmal gesehen bleibt er markiert. Vorher stand die Entfernung von der
       ersten Sekunde an im HUD und man lief nur noch einer Zahl hinterher. */
    entdeckt: false,

    get inRange() {
      const p = ROR.Game.player;
      if (!p) return false;
      return U.dist2(p.position.x, p.position.z, Teleporter.position.x, Teleporter.position.z)
             < RADIUS * RADIUS;
    },
    get distance() {
      const p = ROR.Game.player;
      return p ? p.position.distanceTo(Teleporter.position) : 0;
    },

    clear() {
      if (root) {
        ROR.Engine.scene.remove(root);
        root.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) o.material.dispose();
        });
      }
      root = null;
      Teleporter.state = 'idle';
      Teleporter.charge = 0;
      Teleporter.bosses.length = 0;
      Teleporter.parts = null;
    },

    /* Wird bewusst weit weg vom Startpunkt gesetzt — der Weg dorthin *ist*
       der Teil der Stage, in dem man Kisten öffnet. */
    place(stage, seed) {
      Teleporter.clear();
      const ordnung = ROR.Game.stageOrder;

      /* Zwei Sonderfälle: im Bazaar steht statt eines Teleporters ein
         fertiges Portal hinaus, auf Commencement gar keiner — dort erscheint
         Mithrix, und der Kampf *ist* der Ausgang. */
      Teleporter.mode = ordnung === 0 ? 'bazaar' : ordnung === 6 ? 'final' : 'normal';
      Teleporter.entdeckt = false;
      const rng = U.Rng((seed >>> 0) ^ 0x7e1e);
      let spot = null, bester = null;
      /* Um den Teleporter herum wird gekaempft, er braucht also wirklich
         Platz — 7 m Freiraum, nicht nur einen Punkt ohne Hindernis.

         Mindestabstand relativ zur Karte statt fest 60 m: mit dem festen Wert
         lag der Teleporter auf jeder Kartengroesse gleich nah, eine groessere
         Karte machte den Weg sogar kuerzer, weil der Startpunkt mitwanderte.

         Und statt bei Misserfolg auf den Startpunkt zurueckzufallen — was den
         Weg auf null setzte — wird der weiteste gefundene Platz behalten. */
      const mind = Math.max(60, stage.terrain.half * 0.62);
      let besterAbstand = -1;
      for (let i = 0; i < 90 && !spot; i++) {
        const s = stage.findeFreiePosition(rng, {
          rMin: stage.terrain.half * 0.3, rMax: stage.terrain.half * 0.88,
          maxSlope: 0.14, tries: 20, platz: 7
        });
        if (!s) continue;
        const d2 = U.dist2(s.x, s.z, stage.spawn.x, stage.spawn.z);
        if (d2 > mind * mind) { spot = s; break; }
        if (d2 > besterAbstand) { besterAbstand = d2; bester = s; }
      }
      if (!spot && bester) spot = bester;
      spot = spot || stage.spawn;
      Teleporter.position.set(spot.x, spot.y, spot.z);

      root = new THREE.Group();
      root.position.copy(Teleporter.position);
      ROR.Engine.scene.add(root);

      const stein = new THREE.MeshLambertMaterial({ color: 0x4e5560, flatShading: true });
      const sockel = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.8, 0.5, 9), stein);
      sockel.position.y = 0.25; sockel.receiveShadow = true; root.add(sockel);

      const saeulen = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * U.TAU;
        const h = 2.2 + (i % 2) * 0.8;
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.5, h, 0.5), stein);
        s.position.set(Math.cos(a) * 2.7, 0.5 + h / 2, Math.sin(a) * 2.7);
        s.rotation.y = a;
        s.castShadow = true;
        root.add(s);
        saeulen.push(s);
      }

      const kernMat = new THREE.MeshBasicMaterial({
        color: 0x5fd0ff, transparent: true, opacity: 0.65,
        depthWrite: false, blending: THREE.AdditiveBlending
      });
      const kern = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 1), kernMat);
      kern.position.y = 2.6;
      root.add(kern);

      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x5fd0ff, transparent: true, opacity: 0.5,
        depthWrite: false, blending: THREE.AdditiveBlending
      });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.11, 6, 20), ringMat);
      ring.position.y = 2.6; ring.rotation.x = Math.PI / 2;
      root.add(ring);

      /* Eine Lichtsäule, damit man ihn quer über die Stage sieht. Aus der
         Nähe blendet sie sich aus — sonst steht man im Kampf hinter einem
         neunzig Meter hohen Vorhang. */
      const strahl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.9, 1.5, 90, 10, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x5fd0ff, transparent: true, opacity: 0.075,
                                      depthWrite: false, side: THREE.DoubleSide,
                                      blending: THREE.AdditiveBlending })
      );
      strahl.position.y = 45;
      root.add(strahl);

      Teleporter.parts = { kern, ring, strahl, saeulen };

      if (Teleporter.mode === 'bazaar') {
        // Der Ausgang steht von Anfang an offen.
        Teleporter.state = 'ready';
      } else if (Teleporter.mode === 'final') {
        Teleporter.state = 'used';   // kein Ausgang; es zählt nur der Kampf
        root.visible = false;
        Teleporter.spawnMithrix(stage);
      }
      return Teleporter.position;
    },

    /* Mithrix erscheint sofort, sobald die Stage steht. Es gibt nichts zu
       finden und nichts zu laden — nur ihn. */
    spawnMithrix(stage) {
      const def = ROR.Data.monster('mithrix');
      if (!def) return;
      const spot = stage.findeFreiePosition(U.Rng(stage.seed ^ 0x1111), {
        rMin: 20, rMax: 60, maxSlope: 0.15, tries: 80, platz: 6
      }) || stage.spawn;
      const m = ROR.Monsters.spawn(def, ROR.Difficulty.spawnLevel,
        new THREE.Vector3(spot.x, spot.y, spot.z));
      if (m) Teleporter.bosses.push(m);
      ROR.HUD.toast('Mithrix erwartet dich', 'bad');
    },

    activate() {
      if (Teleporter.state !== 'idle') return false;
      Teleporter.state = 'charging';
      Teleporter.charge = 0;

      const schreine = ROR.Game.mountainShrines || 0;
      const anzahl = 1 + schreine;

      /* Bosswahl: die teuerste Karte, die auf dieser Stage vorkommt. Die
         Credits des Teleporter-Directors bekommt der Combat Director als
         Zugabe — dadurch drückt während der Ladezeit auch der normale
         Nachschub stärker. */
      const kandidaten = ROR.Data.monstersFor(ROR.Game.stageOrder, 'champion');
      const bossDef = kandidaten.length ? U.chaos.pick(kandidaten)
                                        : ROR.Data.monster('stone_titan');
      const stage = ROR.Stage.current;

      for (let i = 0; i < anzahl; i++) {
        const a = (i / anzahl) * U.TAU + U.chaos.next();
        const d = 16 + i * 4;
        const x = Teleporter.position.x + Math.cos(a) * d;
        const z = Teleporter.position.z + Math.sin(a) * d;
        const y = stage.terrain.heightAt(x, z);
        const m = ROR.Monsters.spawn(bossDef, ROR.Difficulty.spawnLevel,
          new THREE.Vector3(x, bossDef.flying ? y + bossDef.hoverHeight : y, z));
        if (m) Teleporter.bosses.push(m);
      }

      ROR.Director.gift((120 + 90 * ROR.Difficulty.coeff) * (1 + schreine));
      ROR.Audio.spiel('boss');
      ROR.Camera.addShake(0.9);
      ROR.HUD.toast(bossDef.name + ' erwacht', 'bad');
      return true;
    },

    update(dt) {
      if (!root) return;
      const t = ROR.Engine.time;
      const p = Teleporter.parts;

      // Sichtbarer Zustand: ruhig im Leerlauf, hektisch beim Laden, offen danach.
      const puls = Teleporter.state === 'charging' ? 0.55 + Math.sin(t * 7) * 0.3
                 : Teleporter.state === 'ready' ? 0.9 : 0.45 + Math.sin(t * 2) * 0.15;
      p.kern.material.opacity = puls;
      p.kern.scale.setScalar(Teleporter.state === 'ready' ? 1.5 : 1 + Teleporter.charge * 0.35);
      p.ring.rotation.z += dt * (0.6 + Teleporter.charge * 4);
      p.ring.scale.setScalar(1 + Teleporter.charge * 0.5);
      /* Erst ab etwa zwölf Metern sichtbar, voll ab vierzig. */
      const kameraNah = ROR.Engine.camera.position.distanceTo(Teleporter.position);
      /* Als entdeckt gilt er, wenn man ihn einmal aus 55 m Naehe gesehen hat
         oder das Ereignis laeuft — dann muss man ohnehin zurueckfinden. */
      if (!Teleporter.entdeckt &&
          (Teleporter.distance < 55 || Teleporter.state !== 'idle')) {
        Teleporter.entdeckt = true;
        ROR.HUD.toast('Teleporter gefunden');
      }
      const sicht = U.clamp((kameraNah - 12) / 28, 0, 1);
      p.strahl.material.opacity = Teleporter.state === 'used' ? 0
        : (Teleporter.state === 'ready' ? 0.16 : 0.075) * sicht;
      p.strahl.visible = sicht > 0.01;

      const farbe = Teleporter.state === 'ready' ? 0x8fffa8
                  : Teleporter.state === 'charging' ? 0xffb44a : 0x5fd0ff;
      p.kern.material.color.setHex(farbe);
      p.ring.material.color.setHex(farbe);
      p.strahl.material.color.setHex(farbe);

      if (Teleporter.state === 'charging') {
        if (Teleporter.inRange) Teleporter.charge = Math.min(1, Teleporter.charge + dt / CHARGE_TIME);
        if (Teleporter.charge >= 1) Teleporter.state = 'waiting';
      }

      if (Teleporter.state === 'waiting') {
        let lebt = false;
        for (let i = 0; i < Teleporter.bosses.length; i++) {
          if (Teleporter.bosses[i].body.alive) { lebt = true; break; }
        }
        if (!lebt) Teleporter.finish();
      }
    },

    finish() {
      Teleporter.state = 'ready';
      const schreine = ROR.Game.mountainShrines || 0;
      const anzahl = 1 + schreine;
      const pos = Teleporter.position.clone();

      for (let i = 0; i < anzahl; i++) {
        // 15 % der Belohnungen sind Boss-Items statt grüner.
        const tier = U.chaos.next() < BOSS_ITEM_CHANCE ? 'boss' : 'uncommon';
        const def = ROR.Loot.randomItem(tier);
        if (def) ROR.Loot.drop(pos, def);
      }

      // Goldregen: das Guthaben für die nächste Stage.
      const gold = 25 * Math.pow(ROR.Difficulty.coeff, 1.25) * (2 + schreine);
      ROR.Game.player.gold += gold;
      ROR.Audio.spiel('teleport');
      ROR.HUD.toast('Teleporter bereit  ·  +$' + Math.floor(gold), 'gold');
      ROR.Projectiles.spark(pos.clone().setY(pos.y + 2.6), 0x8fffa8, 5);
    },

    /* Aufforderung und Bedienung laufen über dieselbe Nähe-Prüfung wie die
       Interactables, damit sich beides gleich anfühlt. */
    prompt() {
      if (Teleporter.mode === 'bazaar') return { text: 'Bazaar verlassen', ok: true };
      if (Teleporter.state === 'idle') return { text: 'Teleporter aktivieren', ok: true };
      if (Teleporter.state === 'ready') {
        return { text: ROR.Game.bazaarOffen ? 'Blaues Portal — in den Bazaar'
                                            : 'Nächste Stage betreten', ok: true };
      }
      return null;
    },

    use() {
      if (Teleporter.mode === 'bazaar') { ROR.Game.leaveBazaar(); return true; }
      if (Teleporter.state === 'idle') return Teleporter.activate();
      if (Teleporter.state === 'ready') {
        Teleporter.state = 'used';
        if (ROR.Game.bazaarOffen) ROR.Game.enterBazaar();
        else ROR.Game.nextStage();
        return true;
      }
      return false;
    },

    mode: 'normal',

    RADIUS: RADIUS,
    CHARGE_TIME: CHARGE_TIME
  };

  ROR.Teleporter = Teleporter;
})(window.ROR);
