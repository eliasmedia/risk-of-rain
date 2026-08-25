/* game/entities/deployable.js
   Aufstellbares: Türme, Minen, Schildkuppel.

   Alles hier ist ein eigener Body im Team des Spielers — dadurch kann es
   beschossen und zerstört werden, ohne dass irgendeine andere Datei davon
   wissen muss. Der Turm des Engineers erbt Leben und Schaden seines
   Besitzers *und damit auch dessen Items*, genau wie in der Vorlage: wer
   fünf Syringen trägt, hat auch einen schnelleren Turm. */
(function (ROR) {
  'use strict';

  const U = ROR.Util;
  const list = [];
  let group = null;
  const _v = new THREE.Vector3();

  function mat(c, leuchtet) {
    return ROR.Toon.material({
      color: c,
      emissive: leuchtet ? c : 0x000000, emissiveIntensity: 0.4
    });
  }

  /* ------------------------------------------------------------ Modelle */

  function bauTurm(farben) {
    const g = new THREE.Group();
    const fuss = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 0.3, 7), mat(farben.dark));
    fuss.position.y = 0.15; fuss.castShadow = true; g.add(fuss);
    const kopf = new THREE.Group();
    kopf.position.y = 0.55; kopf.name = 'kopf'; g.add(kopf);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.7), mat(farben.main));
    box.castShadow = true; kopf.add(box);
    const lauf = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.8, 6), mat(farben.dark));
    lauf.rotation.x = Math.PI / 2; lauf.position.z = -0.5; kopf.add(lauf);
    const auge = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0),
      new THREE.MeshBasicMaterial({ color: farben.glow, transparent: true, opacity: 0.9,
                                    depthWrite: false, blending: THREE.AdditiveBlending }));
    auge.position.set(0, 0.2, -0.3); auge.name = 'auge'; kopf.add(auge);
    return g;
  }

  /* Drohne: fliegt neben dem Spieler her und schießt mit. Anders als der Turm
     bleibt sie nicht stehen — man kauft sie einmal und nimmt sie mit. */
  function bauDrohne(farben) {
    const g = new THREE.Group();
    const rumpf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), mat(farben.main));
    rumpf.castShadow = true; g.add(rumpf);
    for (let k = -1; k <= 1; k += 2) {
      const fl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.14), mat(farben.dark));
      fl.position.set(k * 0.34, 0.05, 0); g.add(fl);
    }
    const lauf = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 5), mat(farben.dark));
    lauf.rotation.x = Math.PI / 2; lauf.position.z = -0.28; lauf.name = 'lauf'; g.add(lauf);
    const auge = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0),
      new THREE.MeshBasicMaterial({ color: farben.glow, transparent: true, opacity: 0.9,
                                    depthWrite: false, blending: THREE.AdditiveBlending }));
    auge.position.z = -0.2; auge.name = 'auge'; g.add(auge);
    return g;
  }

  function bauMine(farben) {
    const g = new THREE.Group();
    const scheibe = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.18, 8), mat(farben.dark));
    scheibe.position.y = 0.09; scheibe.castShadow = true; g.add(scheibe);
    const kern = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0),
      new THREE.MeshBasicMaterial({ color: farben.glow, transparent: true, opacity: 0.6,
                                    depthWrite: false, blending: THREE.AdditiveBlending }));
    kern.position.y = 0.22; kern.name = 'kern'; g.add(kern);
    return g;
  }

  /* Ein Wirkbereich: Pfeilregen, Eiswand. Er tut in einem Umkreis regelmäßig
     weh und verschwindet nach seiner Zeit. */
  function bauZone(radius, farbe) {
    const g = new THREE.Group();
    const boden = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 0.12, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: farbe, transparent: true, opacity: 0.3,
                                    depthWrite: false, side: THREE.DoubleSide,
                                    blending: THREE.AdditiveBlending })
    );
    boden.position.y = 0.4; boden.name = 'ring'; g.add(boden);
    const kern = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.94, radius * 0.94, 0.06, 20),
      new THREE.MeshBasicMaterial({ color: farbe, transparent: true, opacity: 0.12,
                                    depthWrite: false, blending: THREE.AdditiveBlending })
    );
    kern.position.y = 0.06; kern.name = 'flaeche'; g.add(kern);
    return g;
  }

  function bauSchild(radius) {
    const g = new THREE.Group();
    const kuppel = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 20, 12),
      new THREE.MeshBasicMaterial({ color: 0x8fd6ff, transparent: true, opacity: 0.13,
                                    depthWrite: false, side: THREE.DoubleSide,
                                    blending: THREE.AdditiveBlending })
    );
    kuppel.name = 'kuppel';
    g.add(kuppel);
    return g;
  }

  /* ----------------------------------------------------------- Erzeugen */

  const Deployables = {
    list: list,

    init() {
      Deployables.clear();
      group = new THREE.Group();
      group.name = 'deployables';
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
      group = null;
      list.forEach((d) => { if (d.body) d.body.remove(); });
      list.length = 0;
    },

    /* Wie viele Stück einer Art der Besitzer schon stehen hat. */
    countOf(owner, kind) {
      let n = 0;
      for (let i = 0; i < list.length; i++) {
        if (list[i].kind === kind && list[i].owner === owner && list[i].alive) n++;
      }
      return n;
    },

    /* Ältestes Stück entfernen, wenn das Limit erreicht ist — sonst müsste
       man raten, welcher Turm gemeint ist. */
    trim(owner, kind, max) {
      while (Deployables.countOf(owner, kind) >= max) {
        for (let i = 0; i < list.length; i++) {
          if (list[i].kind === kind && list[i].owner === owner && list[i].alive) {
            list[i].alive = false;
            if (list[i].body) list[i].body.kill();
            break;
          }
        }
      }
    },

    spawn(kind, owner, position, opts) {
      if (!group) Deployables.init();
      opts = opts || {};
      if (opts.max) Deployables.trim(owner, kind, opts.max);

      const farben = opts.colors || { main: 0x6a8fa8, dark: 0x33444f, glow: 0x9fe4ff };
      const model = kind === 'turret' ? bauTurm(farben)
                  : kind === 'drone' ? bauDrohne(farben)
                  : kind === 'mine' ? bauMine(farben)
                  : kind === 'zone' ? bauZone(opts.radius || 8, opts.color || 0xffd070)
                  : bauSchild(opts.radius || 10);
      model.position.copy(position);
      group.add(model);

      const d = {
        kind: kind, owner: owner, model: model, opts: opts,
        alive: true, age: 0, timer: 0, body: null,
        parts: {}
      };
      model.traverse(function (o) { if (o.name) d.parts[o.name] = o; });

      if (kind === 'turret' || kind === 'drone') {
        /* Der Turm erbt Leben und Schaden — und weil `stats` beim Besitzer
           bereits alle Items enthält, erbt er sie damit gleich mit. */
        d.body = ROR.Body.create({
          def: { name: 'Turm', growth: 'flat', health: owner.stats.maxHealth,
                 damage: owner.stats.damage, regen: 0, armor: 0, moveSpeed: 0 },
          level: 1, team: ROR.Body.PLAYER, position: model.position,
          radius: kind === 'drone' ? 0.4 : 0.6, height: kind === 'drone' ? 0.7 : 1.1,
          object: model
        });
        d.body.isDeployable = true;
        d.body.onDeath = function () { d.alive = false; };
      }

      list.push(d);
      return d;
    },

    /* Liegt der Punkt in einer Schildkuppel? */
    blocks(punkt) {
      for (let i = 0; i < list.length; i++) {
        const d = list[i];
        if (d.kind !== 'shield' || !d.alive) continue;
        const r = d.opts.radius || 10;
        if (d.model.position.distanceToSquared(punkt) <= r * r) return true;
      }
      return false;
    },

    update(dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        const d = list[i];
        d.age += dt;

        if (!d.alive || (d.opts.life && d.age > d.opts.life)) {
          group.remove(d.model);
          if (d.body) d.body.remove();
          list.splice(i, 1);
          continue;
        }

        if (d.kind === 'drone') drohne(d, dt);
        else if (d.kind === 'turret') turm(d, dt);
        else if (d.kind === 'mine') mine(d, dt);
        else if (d.kind === 'zone') zone(d, dt);
        else if (d.kind === 'shield') {
          const k = 1 + Math.sin(d.age * 3) * 0.015;
          d.model.scale.setScalar(k);
          // Letzte zwei Sekunden: der Schild flackert, bevor er fällt.
          const rest = (d.opts.life || 15) - d.age;
          if (d.parts.kuppel) {
            d.parts.kuppel.material.opacity = rest < 2 ? 0.13 * (0.4 + Math.sin(d.age * 25) * 0.3) : 0.13;
          }
        }
      }
    }
  };

  function turm(d, dt) {
    const ziel = ROR.Projectiles.nearestEnemy(d.model.position, d.opts.range || 40,
                                              ROR.Body.PLAYER);
    const kopf = d.parts.kopf;
    if (!ziel) {
      if (kopf) kopf.rotation.y += dt * 0.6;
      if (d.parts.auge) d.parts.auge.material.opacity = 0.4;
      return;
    }
    if (kopf) {
      const soll = Math.atan2(-(ziel.position.x - d.model.position.x),
                              -(ziel.position.z - d.model.position.z));
      kopf.rotation.y = U.angleDamp(kopf.rotation.y, soll, 0.06, dt);
    }
    if (d.parts.auge) d.parts.auge.material.opacity = 0.9;

    d.timer -= dt * (d.body ? d.body.stats.attackSpeed : 1);
    if (d.timer > 0) return;
    d.timer += d.opts.interval || 0.333;
    _v.set(d.model.position.x, d.model.position.y + 0.55, d.model.position.z);
    const dir = new THREE.Vector3(
      ziel.position.x - _v.x, ziel.position.y + ziel.height * 0.5 - _v.y, ziel.position.z - _v.z
    ).normalize();
    ROR.Projectiles.bullet({
      attacker: d.body, team: ROR.Body.PLAYER, origin: _v, dir: dir,
      coefficient: d.opts.coefficient || 0.667, proc: d.opts.proc === undefined ? 1 : d.opts.proc,
      range: d.opts.range || 40, spread: 0.02,
      tracerColor: 0x9fe4ff, sparkColor: 0xbfe8ff
    });
  }

  /* Sie hält Abstand zum Spieler, weicht nach oben aus und schießt auf das,
     was am nächsten ist. Heildrohnen schießen nicht, sondern heilen. */
  function drohne(d, dt) {
    const p = ROR.Game.player;
    if (!p) return;
    const pos = d.model.position;
    const idx = d.opts.index || 0;
    const winkel = ROR.Engine.time * 0.6 + idx * 2.1;
    const soll = _v.set(
      p.position.x + Math.cos(winkel) * 2.6,
      p.position.y + 2.6 + Math.sin(winkel * 1.7) * 0.3,
      p.position.z + Math.sin(winkel) * 2.6
    );
    pos.lerp(soll, Math.min(1, dt * 2.6));

    if (d.opts.heals) {
      d.timer -= dt;
      if (d.timer > 0) return;
      d.timer += 1.2;
      if (p.body.health < p.body.stats.maxHealth) {
        ROR.Items.heal(p.body, p.body.stats.maxHealth * 0.045);
        ROR.Projectiles.spark(p.position.clone().setY(p.position.y + 1.2), 0x8fff9f, 1.0);
      }
      return;
    }

    const ziel = ROR.Projectiles.nearestEnemy(pos, d.opts.range || 45, ROR.Body.PLAYER);
    if (!ziel) return;
    d.model.lookAt(ziel.position.x, ziel.position.y + ziel.height * 0.5, ziel.position.z);
    d.timer -= dt * (d.body ? d.body.stats.attackSpeed : 1);
    if (d.timer > 0) return;
    d.timer += d.opts.interval || 0.5;
    const dir = new THREE.Vector3(ziel.position.x - pos.x,
      ziel.position.y + ziel.height * 0.5 - pos.y, ziel.position.z - pos.z).normalize();
    ROR.Projectiles.bullet({
      attacker: d.body, team: ROR.Body.PLAYER, origin: pos, dir: dir,
      coefficient: d.opts.coefficient || 1.0, proc: 1, range: d.opts.range || 45,
      spread: 0.03, tracerColor: 0x9fe4ff
    });
  }

  function zone(d, dt) {
    if (d.parts.ring) d.parts.ring.rotation.y += dt * 0.9;
    d.timer -= dt;
    if (d.timer > 0) return;
    d.timer += d.opts.interval || 0.35;
    const getroffen = ROR.Projectiles.enemiesInRange(
      d.model.position, d.opts.radius || 8, ROR.Body.PLAYER, 24);
    for (let i = 0; i < getroffen.length; i++) {
      ROR.Damage.deal({
        attacker: d.owner, victim: getroffen[i],
        coefficient: d.opts.coefficient, proc: d.opts.proc === undefined ? 0.2 : d.opts.proc,
        position: getroffen[i].center(new THREE.Vector3())
      });
      if (d.opts.slow) ROR.Buffs.apply(getroffen[i], 'slow60', d.opts.slow);
    }
  }

  function mine(d, dt) {
    // Zwei Stufen: nach einer Sekunde scharf, nach dreien voll scharf.
    const stufe = d.age > 3 ? 2 : d.age > 1 ? 1 : 0;
    if (d.parts.kern) {
      d.parts.kern.material.opacity = stufe === 0 ? 0.25 : stufe === 1 ? 0.6 : 0.95;
      d.parts.kern.scale.setScalar(0.8 + stufe * 0.25 + Math.sin(d.age * 8) * 0.08 * stufe);
    }
    if (stufe === 0) return;

    const naeh = ROR.Projectiles.nearestEnemy(d.model.position, 4.5, ROR.Body.PLAYER);
    if (!naeh) return;
    d.alive = false;
    ROR.Damage.explode({
      attacker: d.owner, team: ROR.Body.PLAYER, position: d.model.position.clone(),
      radius: d.opts.radius || 8,
      coefficient: stufe === 2 ? (d.opts.armed || 9) : (d.opts.coefficient || 3),
      proc: d.opts.proc === undefined ? 1 : d.opts.proc
    });
    ROR.Projectiles.spark(d.model.position, 0xffc070, 4);
  }

  ROR.Deployables = Deployables;
})(window.ROR);
