/* game/entities/player.js
   Figur, Bewegung, Zielen und der Ablauf der vier Fähigkeiten.

   Die Bewegungswerte stammen aus dem Original: 7 m/s Grundtempo, Sprint mal
   1.45, Sprunghöhe knapp 3.6 m. Die Figur ist aus Kästen gebaut und wird im
   Code animiert — es gibt keine Modelldateien, die unter `file://` ohnehin
   nicht ladbar wären.

   Gezielt wird zweistufig: der Strahl geht von der Kamera durch das Fadenkreuz
   und sucht den Zielpunkt, geschossen wird von der Mündung *dorthin*. Feuerte
   man direkt aus der Kamera, kämen die Spuren aus der Luft; feuerte man blind
   nach vorn, träfe man nicht, was unter dem Fadenkreuz liegt. */
(function (ROR) {
  'use strict';

  const U = ROR.Util;

  const GRAVITY = 27;
  const JUMP_VELOCITY = 14;      // ergibt 14² / (2·27) ≈ 3.63 m Sprunghöhe
  const SPRINT_MULT = 1.45;
  const ACCEL_GROUND = 75;
  const ACCEL_AIR = 26;
  const FRICTION = 12;
  const STEP_UP = 0.55;
  const COYOTE = 0.12;
  const JUMP_BUFFER = 0.12;
  const FALL_DAMAGE_SPEED = 32;  // ab hier tut die Landung weh (≈ 19 m Fallhöhe)
  const AIM_RANGE = 200;
  const DIVE_TIME = 0.6;
  const DIVE_IFRAMES = 0.5;
  const DIVE_SPEED = 2.4;        // Vielfaches des Grundtempos

  const wish = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const rgt = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const aimDir = new THREE.Vector3();
  const target = new THREE.Vector3();
  const muzzle = new THREE.Vector3();
  const shotDir = new THREE.Vector3();

  const SLOTS = ['primary', 'secondary', 'utility', 'special'];

  function box(w, h, d, color) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color: color, flatShading: true })
    );
    m.castShadow = true;
    return m;
  }

  /* Ein Gelenk als leere Gruppe am Drehpunkt, das Kästchen hängt darunter.
     So dreht der Oberschenkel um die Hüfte und nicht um seine Mitte. */
  function limb(parent, x, y, z) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  }

  function buildBody(c) {
    const root = new THREE.Group();

    const hips = limb(root, 0, 0.92, 0);
    const torso = box(0.52, 0.62, 0.32, c.coat);
    torso.position.y = 0.31;
    hips.add(torso);

    const chest = box(0.58, 0.26, 0.36, c.coatDark);
    chest.position.y = 0.72;
    hips.add(chest);

    const neck = limb(hips, 0, 0.86, 0);
    const head = box(0.30, 0.30, 0.30, c.skin);
    head.position.y = 0.15;
    neck.add(head);
    const visor = box(0.32, 0.10, 0.06, c.visor);
    visor.position.set(0, 0.17, -0.15);
    neck.add(visor);
    const cap = box(0.34, 0.12, 0.34, c.coatDark);
    cap.position.y = 0.33;
    neck.add(cap);

    const arms = [];
    for (let s = -1; s <= 1; s += 2) {
      const shoulder = limb(hips, s * 0.36, 0.70, 0);
      const upper = box(0.16, 0.34, 0.16, c.coat);
      upper.position.y = -0.17;
      shoulder.add(upper);
      const elbow = limb(shoulder, 0, -0.34, 0);
      const fore = box(0.14, 0.32, 0.14, c.skin);
      fore.position.y = -0.16;
      elbow.add(fore);
      arms.push({ shoulder, elbow, side: s });
    }

    const gun = box(0.11, 0.13, 0.34, c.metal);
    gun.position.set(0, -0.34, -0.10);
    arms[1].elbow.add(gun);
    const flash = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.16, 0),
      new THREE.MeshBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0,
                                    depthWrite: false, blending: THREE.AdditiveBlending })
    );
    flash.position.set(0, -0.34, -0.30);
    arms[1].elbow.add(flash);

    const legs = [];
    for (let s = -1; s <= 1; s += 2) {
      const hip = limb(hips, s * 0.15, 0.02, 0);
      const thigh = box(0.19, 0.44, 0.19, c.pants);
      thigh.position.y = -0.22;
      hip.add(thigh);
      const knee = limb(hip, 0, -0.44, 0);
      const shin = box(0.17, 0.42, 0.17, c.pants);
      shin.position.y = -0.21;
      knee.add(shin);
      const foot = box(0.19, 0.10, 0.30, c.boots);
      foot.position.set(0, -0.44, -0.05);
      knee.add(foot);
      legs.push({ hip, knee, side: s });
    }

    return { root, hips, neck, arms, legs, gun, flash };
  }

  ROR.Player = {
    create(def, spawn) {
      const model = buildBody(def.colors);
      model.root.position.set(spawn.x, spawn.y, spawn.z);
      ROR.Engine.scene.add(model.root);

      /* Der Body teilt sich den Positionsvektor mit dem Modell — dadurch kann
         nichts auseinanderlaufen. */
      const body = ROR.Body.create({
        def: def, level: 1, team: ROR.Body.PLAYER,
        position: model.root.position,
        radius: def.radius, height: def.height,
        object: model.root
      });

      const skills = {};
      SLOTS.forEach(function (slot) {
        const s = def.skills[slot];
        skills[slot] = {
          def: s, slot: slot,
          charges: s.charges || 0,
          maxCharges: s.charges || 0,
          cooldown: 0,      // Restzeit bis zur nächsten Ladung
          interval: 0,      // Restzeit bis zum nächsten Schuss
          stance: 0         // Restdauer einer Haltung
        };
      });

      const p = {
        def: def,
        body: body,
        model: model,
        object: model.root,
        position: model.root.position,
        velocity: new THREE.Vector3(),
        skills: skills,
        grounded: false,
        sprinting: false,
        facing: 0,
        exp: 0,
        gold: 0,
        spawn: { x: spawn.x, y: spawn.y, z: spawn.z },

        _walkPhase: 0, _coyote: 0, _jumpBuffer: 0, _airTime: 0,
        _lastFallSpeed: 0, _landTimer: 0, _aimTimer: 0,
        _gunKick: 0, _dive: 0, _diveDir: new THREE.Vector3(),
        _jumpsLeft: 1,
        hurtFlash: 0,

        get health() { return body.health; },
        get maxHealth() { return body.stats.maxHealth; },
        get level() { return body.level; },

        recoil(amount) { p._gunKick = Math.min(1.4, p._gunKick + amount); },

        startDive() {
          p._dive = DIVE_TIME;
          // Rollt in Laufrichtung; wer steht, rollt nach vorn.
          const len = Math.hypot(p.velocity.x, p.velocity.z);
          if (len > 0.5) p._diveDir.set(p.velocity.x / len, 0, p.velocity.z / len);
          else ROR.Camera.forward(p._diveDir);
          body.invulnerable = Math.max(body.invulnerable, DIVE_IFRAMES);
        },

        addExp(amount) {
          p.exp += amount;
          const want = ROR.Stats.levelFromExp(p.exp);
          if (want !== body.level) {
            body.setLevel(want);
            p.onLevelUp && p.onLevelUp(want);
          }
        },

        update(dt) { step(p, dt); }
      };

      body.onDeath = function () { p.onDeath && p.onDeath(p); };
      body.onDamaged = function () { p.hurtFlash = 0.3; };

      return p;
    }
  };

  /* ------------------------------------------------------------- Zielen */

  /* Sucht den Punkt unter dem Fadenkreuz und liefert Mündung und Richtung. */
  function aimContext(p) {
    const stage = ROR.Stage.current;
    camPos.copy(ROR.Engine.camera.position);
    ROR.Camera.aim(aimDir);

    const wall = stage ? stage.clearance(camPos, aimDir, AIM_RANGE, 0.6) : AIM_RANGE;
    const hit = ROR.Body.raycast(camPos, aimDir, Math.min(AIM_RANGE, wall), p.body.team);
    // Mindestens acht Meter, sonst zieht eine Wand dicht hinter der Figur den
    // Zielpunkt hinter die Mündung und man schießt nach hinten.
    const dist = Math.max(8, hit ? hit.distance : Math.min(AIM_RANGE, wall));
    target.copy(camPos).addScaledVector(aimDir, dist);

    // Mündung in Figurenkoordinaten: rechte Hand, Brusthöhe, nach vorn.
    const f = p.facing, cf = Math.cos(f), sf = Math.sin(f);
    const lx = 0.34, ly = 1.24, lz = -0.55;
    muzzle.set(
      p.position.x + lx * cf + lz * sf,
      p.position.y + ly,
      p.position.z - lx * sf + lz * cf
    );

    shotDir.copy(target).sub(muzzle).normalize();
    return { player: p, body: p.body, origin: muzzle, dir: shotDir, target: target };
  }

  /* --------------------------------------------------------- Fähigkeiten */

  function updateSkills(p, dt) {
    const inp = ROR.Input;
    const atk = p.body.stats.attackSpeed;
    const blocked = ROR.Buffs.has(p.body, 'stun') || !p.body.alive;

    for (let i = 0; i < SLOTS.length; i++) {
      const slot = SLOTS[i];
      const st = p.skills[slot];
      const d = st.def;

      // Ladungen füllen sich einzeln nach, die Abklingzeit läuft dabei durch.
      if (st.maxCharges > 0 && st.charges < st.maxCharges) {
        st.cooldown -= dt * p.body.stats.cooldownScale;
        if (st.cooldown <= 0) { st.charges++; st.cooldown = d.cooldown; }
      }
      // Der Resttakt wird *verrechnet*, nicht zurückgesetzt. Bei 12 Schuss je
      // Sekunde passt der Takt nicht in Vielfache von 1/60 s — würde man den
      // Rest wegwerfen, kämen aus doppeltem Angriffstempo nur neun statt zwölf
      // Schuss heraus, und jedes Angriffstempo-Item wäre stillschweigend
      // schwächer als angeschrieben.
      st.interval -= dt;
      if (st.interval < -0.5) st.interval = 0;

      if (blocked) { if (st.stance > 0) endStance(p, st); continue; }

      if (d.mode === 'auto') {
        // Bei sehr hohem Angriffstempo fallen mehrere Schuss in einen Schritt.
        let guard = 4;
        while (inp.down(slot) && st.interval <= 0 && guard-- > 0) {
          st.interval += 1 / (d.rate * atk);
          d.fire(aimContext(p));
          p._aimTimer = 0.45;
          if (d.cancelsSprint !== false) p.sprinting = false;
        }
      } else if (d.mode === 'press') {
        if (inp.pressed(slot) && st.charges > 0) {
          if (st.charges === st.maxCharges) st.cooldown = d.cooldown;
          st.charges--;
          d.fire(aimContext(p));
          if (d.cancelsSprint !== false) { p._aimTimer = 0.45; p.sprinting = false; }
        }
      } else if (d.mode === 'stance') {
        if (st.stance > 0) {
          st.stance -= dt;
          let guard = 4;
          while (st.interval <= 0 && guard-- > 0) {
            st.interval += 1 / (d.rate * atk);
            d.fire(aimContext(p));
          }
          p._aimTimer = 0.45;
          if (st.stance <= 0) endStance(p, st);
        } else if (inp.pressed(slot) && st.charges > 0) {
          if (st.charges === st.maxCharges) st.cooldown = d.cooldown;
          st.charges--;
          st.stance = d.duration;
          st.interval = 0;
          p.sprinting = false;
          if (d.begin) d.begin(aimContext(p));
        }
      }
    }
  }

  function endStance(p, st) {
    st.stance = 0;
    if (st.def.end) st.def.end({ player: p, body: p.body });
  }

  /* ------------------------------------------------------------ Bewegung */

  function step(p, dt) {
    const stage = ROR.Stage.current;
    if (!stage || !p.body.alive) return;

    const inp = ROR.Input;
    const S = p.body.stats;
    const RADIUS = p.body.radius, HEIGHT = p.body.height;

    ROR.Camera.forward(fwd);
    ROR.Camera.right(rgt);
    wish.set(0, 0, 0).addScaledVector(rgt, inp.move.x).addScaledVector(fwd, -inp.move.z);
    const wishLen = wish.length();
    if (wishLen > 1e-4) wish.divideScalar(wishLen);

    // Sprint gilt nur vorwärts — seitwärts wegrennen wäre im Original auch nicht drin.
    const wantSprint = inp.down('sprint') && wishLen > 0.1 && inp.move.z < -0.3;
    p.sprinting = wantSprint && p._aimTimer <= 0;
    const speed = S.moveSpeed * (p.sprinting ? SPRINT_MULT : 1) * wishLen;
    ROR.Camera.setFovBoost(p.sprinting ? 9 : 0);

    updateSkills(p, dt);

    if (p._dive > 0) {
      // Während der Rolle zählt nur die Rollrichtung.
      p._dive -= dt;
      p.velocity.x = p._diveDir.x * S.moveSpeed * DIVE_SPEED;
      p.velocity.z = p._diveDir.z * S.moveSpeed * DIVE_SPEED;
    } else {
      const accel = p.grounded ? ACCEL_GROUND : ACCEL_AIR;
      const vx = p.velocity.x, vz = p.velocity.z;
      if (wishLen > 1e-4) {
        p.velocity.x = U.approach(vx, wish.x * speed, accel * dt);
        p.velocity.z = U.approach(vz, wish.z * speed, accel * dt);
      } else if (p.grounded) {
        const sp = Math.hypot(vx, vz);
        const drop = Math.min(sp, FRICTION * dt * Math.max(sp, 3));
        if (sp > 1e-4) { p.velocity.x -= (vx / sp) * drop; p.velocity.z -= (vz / sp) * drop; }
      }
    }

    if (inp.pressed('jump')) p._jumpBuffer = JUMP_BUFFER;
    p._jumpBuffer = Math.max(0, p._jumpBuffer - dt);
    p._coyote = p.grounded ? COYOTE : Math.max(0, p._coyote - dt);
    if (p.grounded) p._jumpsLeft = S.jumpCount;

    if (p._jumpBuffer > 0 && (p._coyote > 0 || p._jumpsLeft > 0)) {
      if (p._coyote <= 0) p._jumpsLeft--;
      p.velocity.y = JUMP_VELOCITY;
      p._jumpBuffer = 0;
      p._coyote = 0;
      p.grounded = false;
    }

    p.velocity.y -= GRAVITY * dt;
    if (p.velocity.y < -90) p.velocity.y = -90;

    p.position.x += p.velocity.x * dt;
    p.position.z += p.velocity.z * dt;
    stage.pushOut(p.position, RADIUS, HEIGHT, STEP_UP);

    const wasGrounded = p.grounded;
    p.position.y += p.velocity.y * dt;

    const support = stage.supportAt(p.position.x, p.position.z, p.position.y, STEP_UP);
    if (p.velocity.y <= 0 && p.position.y <= support.y) {
      if (!wasGrounded) land(p, support.y);
      p.position.y = support.y;
      p.velocity.y = 0;
      p.grounded = true;
      p._airTime = 0;
    } else {
      p.grounded = false;
      p._airTime += dt;
      p._lastFallSpeed = Math.max(p._lastFallSpeed, -p.velocity.y);
      const ceil = stage.ceilingAt(p.position.x, p.position.z, p.position.y + HEIGHT * 0.5);
      if (p.velocity.y > 0 && p.position.y + HEIGHT > ceil) {
        p.position.y = ceil - HEIGHT;
        p.velocity.y = 0;
      }
    }

    // Im Wasser oder unter der Karte: zurück an den Start, mit Beule.
    // Die Grenze liegt knapp unter dem Wasserspiegel, nicht am Kartenboden —
    // sonst könnte man auf dem Meeresgrund um die ganze Insel spazieren.
    if (p.position.y < stage.terrain.seaLevel - 3) {
      nonLethal(p, p.body.stats.maxHealth * 0.1);
      p.position.set(p.spawn.x, p.spawn.y + 1, p.spawn.z);
      p.velocity.set(0, 0, 0);
      p._lastFallSpeed = 0;
    }

    p._aimTimer = Math.max(0, p._aimTimer - dt);
    p.hurtFlash = Math.max(0, p.hurtFlash - dt);
    animate(p, dt);
  }

  /* Sturz und Ertrinken töten im Original nie — sie lassen mindestens
     einen Punkt Leben übrig. */
  function nonLethal(p, amount) {
    const dmg = Math.min(amount, Math.max(0, p.body.health - 1));
    if (dmg <= 0) return;
    ROR.Damage.deal({
      victim: p.body, flat: dmg, ignoreArmor: true,
      type: 'environment', proc: 0, crit: false,
      position: p.position.clone().setY(p.position.y + 1)
    });
  }

  function land(p, y) {
    const speed = p._lastFallSpeed;
    p._lastFallSpeed = 0;
    p._landTimer = 0.22;
    if (speed > FALL_DAMAGE_SPEED) nonLethal(p, p.body.stats.maxHealth * 0.1);
  }

  /* ----------------------------------------------------------- Animation */

  function animate(p, dt) {
    const b = p.model;
    const speed = Math.hypot(p.velocity.x, p.velocity.z);

    /* Beim Schießen schaut die Figur dorthin, wo die Kamera hinsieht —
       sonst feuert sie sichtbar an ihrer eigenen Blickrichtung vorbei. */
    if (p._aimTimer > 0) {
      p.facing = U.angleDamp(p.facing, ROR.Camera.yaw, 0.04, dt);
    } else if (speed > 0.6) {
      // Das Modell blickt entlang -Z (Visier und Waffe liegen dort), daher die
      // negierten Argumente — mit atan2(x, z) liefe es rückwärts.
      p.facing = U.angleDamp(p.facing, Math.atan2(-p.velocity.x, -p.velocity.z), 0.05, dt);
    }
    b.root.rotation.y = p.facing;

    const stride = U.clamp(speed / p.body.stats.moveSpeed, 0, 1.6);
    p._walkPhase += dt * (4.6 + speed * 0.85);
    const swing = Math.sin(p._walkPhase) * stride;
    const swing2 = Math.sin(p._walkPhase + Math.PI) * stride;

    if (p._dive > 0) {
      // Rolle: zusammengekauert und um die eigene Achse.
      const t = 1 - p._dive / DIVE_TIME;
      b.hips.rotation.x = t * Math.PI * 2;
      b.legs[0].hip.rotation.x = -1.1; b.legs[1].hip.rotation.x = -1.1;
      b.legs[0].knee.rotation.x = 1.6; b.legs[1].knee.rotation.x = 1.6;
      b.arms[0].shoulder.rotation.x = -1.3; b.arms[1].shoulder.rotation.x = -1.3;
      b.hips.position.y = 0.62;
    } else if (p.grounded) {
      b.legs[0].hip.rotation.x = swing * 0.85;
      b.legs[1].hip.rotation.x = swing2 * 0.85;
      b.legs[0].knee.rotation.x = Math.max(0, -swing) * 0.9;
      b.legs[1].knee.rotation.x = Math.max(0, -swing2) * 0.9;
      b.arms[0].shoulder.rotation.x = swing2 * 0.6;
      b.hips.position.y = 0.92 + Math.abs(Math.sin(p._walkPhase)) * 0.05 * stride
                        - (p._landTimer > 0 ? p._landTimer * 0.55 : 0);
      b.hips.rotation.x = U.damp(b.hips.rotation.x, p.sprinting ? 0.22 : stride * 0.08, 0.08, dt);
    } else {
      const t = U.clamp(p._airTime * 4, 0, 1);
      b.legs[0].hip.rotation.x = U.lerp(b.legs[0].hip.rotation.x, -0.5 * t, 0.25);
      b.legs[1].hip.rotation.x = U.lerp(b.legs[1].hip.rotation.x, 0.25 * t, 0.25);
      b.legs[0].knee.rotation.x = U.lerp(b.legs[0].knee.rotation.x, 0.9 * t, 0.25);
      b.legs[1].knee.rotation.x = U.lerp(b.legs[1].knee.rotation.x, 0.35 * t, 0.25);
      b.arms[0].shoulder.rotation.x = U.lerp(b.arms[0].shoulder.rotation.x, -0.7 * t, 0.2);
      b.hips.position.y = 0.92;
      b.hips.rotation.x = U.damp(b.hips.rotation.x, 0, 0.1, dt);
    }

    /* Der Waffenarm hebt sich beim Zielen und wird vom Rückstoß geworfen. */
    if (p._dive <= 0) {
      const aiming = p._aimTimer > 0;
      const want = aiming ? -1.45 - p._gunKick * 0.45 : (p.grounded ? swing * 0.45 - 0.25 : -0.45);
      b.arms[1].shoulder.rotation.x = U.damp(b.arms[1].shoulder.rotation.x, want, 0.03, dt);
      b.arms[1].elbow.rotation.x = U.damp(b.arms[1].elbow.rotation.x, aiming ? 0.1 : 0, 0.05, dt);
    }
    b.flash.material.opacity = Math.min(1, p._gunKick);
    b.flash.scale.setScalar(0.6 + p._gunKick * 0.9);
    p._gunKick = Math.max(0, p._gunKick - dt * 9);

    p._landTimer = Math.max(0, p._landTimer - dt);
  }
})(window.ROR);
