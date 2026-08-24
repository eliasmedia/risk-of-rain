/* game/entities/projectile.js
   Kugeln, Geschosse, Einschläge.

   Alles läuft über Vorräte fertiger Objekte: bei sechs Schuss je Sekunde,
   Dutzenden Gegnern und später Raketen aus jedem zweiten Item wäre das
   Erzeugen und Wegwerfen von Meshes die teuerste Stelle im Spiel.

   Zwei Arten von Angriff:
     bullet()  trifft sofort (Strahlenschuss) und zeichnet nur eine Spur
     spawn()   fliegt und kann durchschlagen oder explodieren               */
(function (ROR) {
  'use strict';

  const U = ROR.Util;
  const _o = new THREE.Vector3();
  const _d = new THREE.Vector3();
  const _p = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _up = new THREE.Vector3(0, 1, 0);

  const TRACERS = 72;
  const SPARKS = 48;
  const SHOTS = 160;

  let group = null;
  let tracers = [], sparks = [], shots = [];
  const _vorn = new THREE.Vector3(0, 0, -1);
  let tracerNext = 0, sparkNext = 0;

  function makePool(n, geo, color, fn) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: color, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending
      }));
      m.visible = false;
      m.frustumCulled = false;
      group.add(m);
      out.push(fn ? fn(m) : { mesh: m, life: 0, maxLife: 1 });
    }
    return out;
  }

  const Projectiles = {
    init() {
      Projectiles.clear();
      group = new THREE.Group();
      group.name = 'projectiles';
      ROR.Engine.scene.add(group);

      // Spur: ein dünner Stab entlang -Z, damit `lookAt` ihn ausrichtet.
      const tracerGeo = new THREE.BoxGeometry(0.06, 0.06, 1);
      tracerGeo.translate(0, 0, -0.5);
      tracers = makePool(TRACERS, tracerGeo, 0xffe9a8);

      sparks = makePool(SPARKS, new THREE.IcosahedronGeometry(1, 0), 0xfff0c0);

      const shotGeo = new THREE.IcosahedronGeometry(1, 1);

      /* Ein Pfeil ist keine Kugel. Schaft, Spitze und zwei Federn — mehr
         braucht es nicht, damit man auf zwanzig Metern erkennt, was da
         fliegt, und woher es kommt. Die Form zeigt entlang −Z, damit sie
         sich wie alles andere im Spiel an der Flugrichtung ausrichten
         laesst. */
      const pfeilGeo = (function () {
        const teile = [];
        const schaft = new THREE.CylinderGeometry(0.055, 0.055, 1.5, 5);
        schaft.rotateX(Math.PI / 2);
        teile.push(schaft);
        const spitze = new THREE.ConeGeometry(0.13, 0.34, 5);
        spitze.rotateX(-Math.PI / 2);
        spitze.translate(0, 0, -0.9);
        teile.push(spitze);
        for (let k = -1; k <= 1; k += 2) {
          const feder = new THREE.BoxGeometry(0.02, 0.22, 0.34);
          feder.rotateZ(k * 0.6);
          feder.translate(k * 0.05, 0, 0.62);
          teile.push(feder);
        }
        // Von Hand zusammenlegen — BufferGeometryUtils liegt unter examples/.
        let n = 0;
        for (let i = 0; i < teile.length; i++) {
          const g = teile[i];
          n += g.index ? g.index.count : g.attributes.position.count;
        }
        const pos = new Float32Array(n * 3);
        let o = 0;
        for (let i = 0; i < teile.length; i++) {
          const g = teile[i], a = g.attributes.position.array;
          const idx = g.index ? g.index.array : null;
          const anz = idx ? idx.length : g.attributes.position.count;
          for (let k = 0; k < anz; k++) {
            const q = idx ? idx[k] : k;
            pos[o * 3] = a[q * 3]; pos[o * 3 + 1] = a[q * 3 + 1]; pos[o * 3 + 2] = a[q * 3 + 2];
            o++;
          }
          g.dispose();
        }
        const out = new THREE.BufferGeometry();
        out.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, o * 3), 3));
        out.computeVertexNormals();
        return out;
      })();

      shots = [];
      for (let i = 0; i < SHOTS; i++) {
        const bau = function (geo) {
          const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false,
            blending: THREE.AdditiveBlending
          }));
          m.visible = false;
          m.frustumCulled = false;
          group.add(m);
          return m;
        };
        shots.push({ mesh: bau(shotGeo), pfeil: bau(pfeilGeo), active: false, hit: [] });
      }
    },

    clear() {
      if (group) {
        ROR.Engine.scene.remove(group);
        group.traverse((o) => { if (o.material) o.material.dispose(); });
      }
      group = null; tracers = []; sparks = []; shots = [];
    },

    /* --------------------------------------------------------- Strahlschuss */

    /* Trifft sofort. `spread` streut in Radiant, `range` begrenzt die Reichweite. */
    bullet(opts) {
      const stage = ROR.Stage.current;
      _o.copy(opts.origin);
      _d.copy(opts.dir).normalize();

      if (opts.spread) {
        _d.x += (U.chaos.next() - 0.5) * opts.spread;
        _d.y += (U.chaos.next() - 0.5) * opts.spread;
        _d.z += (U.chaos.next() - 0.5) * opts.spread;
        _d.normalize();
      }

      const range = opts.range || 200;
      const wall = stage ? stage.clearance(_o, _d, range, 0.6) : range;
      const hit = ROR.Body.raycast(_o, _d, Math.min(range, wall), opts.team);

      let dist = hit ? hit.distance : Math.min(range, wall);
      if (hit) {
        _p.copy(_o).addScaledVector(_d, dist);
        ROR.Damage.deal({
          attacker: opts.attacker, victim: hit.body,
          coefficient: opts.coefficient, proc: opts.proc,
          falloff: opts.falloff || 'standard', distance: dist,
          position: _p.clone()
        });
        if (opts.stun) ROR.Buffs.apply(hit.body, 'stun', opts.stun);
        if (opts.onHit) opts.onHit(hit.body, _p);
        Projectiles.spark(_p, opts.sparkColor || 0xffd58a, 0.55);
      } else if (wall < range) {
        _p.copy(_o).addScaledVector(_d, dist);
        Projectiles.spark(_p, 0xbfae92, 0.4);
      }

      Projectiles.tracer(_o, _d, dist, opts.tracerColor || 0xffe9a8);
      ROR.Audio.spiel('schuss');
      return hit;
    },

    /* Nächster Gegner in Reichweite. Braucht fast jedes Item, das von selbst
       etwas abfeuert. */
    nearestEnemy(pos, range, team, exclude) {
      let best = null, bd = range * range;
      const all = ROR.Body.all;
      for (let i = 0; i < all.length; i++) {
        const b = all[i];
        if (!b.alive || b.team === team || b === exclude) continue;
        if (exclude && exclude.indexOf && exclude.indexOf(b) >= 0) continue;
        const dx = b.position.x - pos.x, dy = b.position.y - pos.y, dz = b.position.z - pos.z;
        const d = dx * dx + dy * dy + dz * dz;
        if (d < bd) { bd = d; best = b; }
      }
      return best;
    },

    /* Mehrere verschiedene Gegner in Reichweite, nach Entfernung sortiert. */
    enemiesInRange(pos, range, team, max) {
      const out = [];
      const all = ROR.Body.all;
      for (let i = 0; i < all.length; i++) {
        const b = all[i];
        if (!b.alive || b.team === team) continue;
        const dx = b.position.x - pos.x, dy = b.position.y - pos.y, dz = b.position.z - pos.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 <= range * range) out.push({ body: b, d2: d2 });
      }
      out.sort((a, b) => a.d2 - b.d2);
      return out.slice(0, max || out.length).map((o) => o.body);
    },

    tracer(origin, dir, length, color) {
      const t = tracers[tracerNext = (tracerNext + 1) % tracers.length];
      t.mesh.position.copy(origin);
      t.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
      t.mesh.scale.set(1, 1, Math.max(0.5, length));
      t.mesh.material.color.setHex(color);
      t.mesh.material.opacity = 0.85;
      t.mesh.visible = true;
      t.life = 0.06;
      t.maxLife = 0.06;
    },

    spark(position, color, size) {
      const s = sparks[sparkNext = (sparkNext + 1) % sparks.length];
      s.mesh.position.copy(position);
      s.mesh.scale.setScalar(size * 0.3);
      s.mesh.material.color.setHex(color);
      s.mesh.material.opacity = 0.9;
      s.mesh.visible = true;
      s.life = 0.22;
      s.maxLife = 0.22;
      s.grow = size;
    },

    /* ---------------------------------------------------- Fliegendes Geschoss */

    spawn(opts) {
      let s = null;
      for (let i = 0; i < shots.length; i++) if (!shots[i].active) { s = shots[i]; break; }
      if (!s) return null;

      s.active = true;
      s.attacker = opts.attacker || null;
      s.team = opts.team;
      s.dir = opts.dir.clone().normalize();
      s.speed = opts.speed || 60;
      s.life = opts.life || 3;
      s.radius = opts.radius || 0.4;
      s.coefficient = opts.coefficient || 1;
      s.flat = opts.flat;   // fester Schaden, z. B. N'kuhanas Schädel
      s.proc = opts.proc === undefined ? 1 : opts.proc;
      s.pierce = !!opts.pierce;
      // Phase Round wird mit jedem durchschlagenen Gegner stärker.
      s.pierceGrowth = opts.pierceGrowth || 0;
      s.ghost = !!opts.ghost;          // fliegt durch Gelände
      s.gravity = opts.gravity || 0;
      /* Zielsuchende Geschosse: Raketen, Dolche, Haken, Schädel. Sie drehen
         mit `turn` Radiant je Sekunde auf ihr Ziel zu, statt es sofort zu
         treffen — dadurch sieht man sie fliegen und kann sie zuordnen. */
      s.homing = opts.homing || null;
      s.turn = opts.turn || 7;
      /* Verzoegerte Zielsuche: erst fliegen, dann lenken. Ohne die Verzoegerung
         zieht die Zielsuche das Geschoss sofort auf die Sichtlinie und der
         Bogen, den die Schwerkraft erzeugt, ist wieder weg. */
      s.homingDelay = opts.homingDelay || 0;
      s.alter = 0;
      /* Abpraller: das Laser Glaive springt von Gegner zu Gegner und wird
         dabei staerker. `hit` merkt sich, wen es schon erwischt hat. */
      s.bounces = opts.bounces || 0;
      s.bounceRange = opts.bounceRange || 25;
      s.bounceGrowth = opts.bounceGrowth || 0;
      s.explode = opts.explode || null;
      s.onHit = opts.onHit || null;   // z. B. Brand anlegen
      s.travelled = 0;
      s.hit.length = 0;
      /* Kugel oder Pfeil. Beide haengen am selben Eintrag; sichtbar ist
         immer nur einer, und `s.mesh` zeigt auf den benutzten. */
      const kugel = s.mesh === s.pfeil ? s.kugel : s.mesh;
      s.kugel = s.kugel || kugel;
      s.mesh = opts.form === 'pfeil' ? s.pfeil : s.kugel;
      s.kugel.visible = false;
      s.pfeil.visible = false;
      s.istPfeil = opts.form === 'pfeil';
      s.mesh.position.copy(opts.origin);
      s.mesh.scale.setScalar(s.istPfeil ? Math.max(0.6, s.radius * 1.6) : s.radius);
      s.mesh.material.color.setHex(opts.color === undefined ? 0xffd070 : opts.color);
      s.mesh.material.opacity = 0.95;
      s.mesh.visible = true;
      return s;
    },

    update(dt) {
      const stage = ROR.Stage.current;

      for (let i = 0; i < tracers.length; i++) {
        const t = tracers[i];
        if (t.life <= 0) continue;
        t.life -= dt;
        t.mesh.material.opacity = Math.max(0, t.life / t.maxLife) * 0.85;
        if (t.life <= 0) t.mesh.visible = false;
      }

      for (let i = 0; i < sparks.length; i++) {
        const s = sparks[i];
        if (s.life <= 0) continue;
        s.life -= dt;
        const k = Math.max(0, s.life / s.maxLife);
        s.mesh.scale.setScalar(s.grow * (1.3 - k) * 0.9);
        s.mesh.material.opacity = k * 0.9;
        if (s.life <= 0) s.mesh.visible = false;
      }

      for (let i = 0; i < shots.length; i++) {
        const s = shots[i];
        if (!s.active) continue;

        /* Bubble Shield: was von aussen kommt, zerschellt daran. Der Schild
           haelt buchstaeblich alles ab — das ist sein ganzer Zweck. */
        if (s.team !== ROR.Body.PLAYER && ROR.Deployables
            && ROR.Deployables.blocks(s.mesh.position)) {
          Projectiles.spark(s.mesh.position, 0x8fd6ff, 0.8);
          finish(s, false);
          continue;
        }

        s.life -= dt;
        if (s.life <= 0) { finish(s, false); continue; }

        s.alter += dt;
        if (s.gravity) { s.dir.y -= s.gravity * dt / s.speed; s.dir.normalize(); }
        if (s.homing && s.homing.alive && s.alter >= s.homingDelay) {
          _p.set(s.homing.position.x - s.mesh.position.x,
                 s.homing.position.y + s.homing.height * 0.5 - s.mesh.position.y,
                 s.homing.position.z - s.mesh.position.z).normalize();
          const t = Math.min(1, s.turn * dt);
          s.dir.x += (_p.x - s.dir.x) * t;
          s.dir.y += (_p.y - s.dir.y) * t;
          s.dir.z += (_p.z - s.dir.z) * t;
          s.dir.normalize();
        }
        // Ein Pfeil zeigt dorthin, wohin er fliegt — sonst wirkt er wie ein
        // Stab, den jemand quer durch die Luft schiebt.
        if (s.istPfeil) s.mesh.quaternion.setFromUnitVectors(_vorn, s.dir);

        const step = s.speed * dt;
        _o.copy(s.mesh.position);

        // Gegner auf dem zurückgelegten Stück, nicht nur am Endpunkt — sonst
        // fliegen schnelle Geschosse durch schmale Gegner hindurch.
        let done = false;
        for (let k = 0; k < ROR.Body.all.length; k++) {
          const b = ROR.Body.all[k];
          if (!b.alive || b.team === s.team) continue;
          if (s.hit.indexOf(b) >= 0) continue;
          const t = ROR.Body.rayHit(b, _o.x, _o.y, _o.z, s.dir.x, s.dir.y, s.dir.z, step + s.radius);
          if (t < 0) continue;

          _p.copy(_o).addScaledVector(s.dir, t);
          const bonus = 1 + s.pierceGrowth * s.hit.length;
          ROR.Damage.deal({
            attacker: s.attacker, victim: b,
            coefficient: s.coefficient * bonus,
            flat: s.flat === undefined ? undefined : s.flat * bonus,
            proc: s.proc, position: _p.clone()
          });
          s.hit.push(b);
          if (s.onHit) s.onHit(b, _p);
          Projectiles.spark(_p, 0xffc98a, 0.7);

          if (s.bounces > 0) {
            const naechst = Projectiles.enemiesInRange(b.position, s.bounceRange, s.team, 8)
              .find(function (e) { return s.hit.indexOf(e) < 0; });
            if (naechst) {
              s.bounces--;
              s.coefficient *= 1 + s.bounceGrowth;
              s.mesh.position.copy(_p);
              s.dir.set(naechst.position.x - _p.x,
                        naechst.position.y + naechst.height * 0.5 - _p.y,
                        naechst.position.z - _p.z).normalize();
              s.homing = naechst;
              done = true;
              break;
            }
          }
          if (!s.pierce) { finish(s, true, _p); done = true; break; }
        }
        if (done) continue;

        if (!s.ghost && stage) {
          const wall = stage.clearance(_o, s.dir, step, 0.35);
          if (wall < step) {
            _p.copy(_o).addScaledVector(s.dir, wall);
            finish(s, true, _p);
            continue;
          }
        }

        s.mesh.position.addScaledVector(s.dir, step);
        s.travelled += step;
      }
    }
  };

  function finish(s, impact, at) {
    if (impact && s.explode) {
      ROR.Damage.explode({
        attacker: s.attacker, team: s.team,
        position: at || s.mesh.position,
        radius: s.explode.radius,
        coefficient: s.explode.coefficient,
        proc: s.explode.proc
      });
      Projectiles.spark(at || s.mesh.position, 0xffb060, s.explode.radius * 0.7);
    } else if (impact) {
      Projectiles.spark(at || s.mesh.position, 0xffc98a, 0.6);
    }
    s.active = false;
    s.mesh.visible = false;
  }

  ROR.Projectiles = Projectiles;
})(window.ROR);
