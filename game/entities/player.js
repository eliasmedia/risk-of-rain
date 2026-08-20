/* game/entities/player.js
   Figur, Bewegung und Laufanimation.

   Die Bewegungswerte stammen aus dem Original: 7 m/s Grundtempo, Sprint mal
   1.45, Sprunghöhe knapp 3.6 m. Die Figur selbst ist aus Kästen gebaut und wird
   im Code animiert — es gibt keine Modelldateien, die unter `file://` ohnehin
   nicht ladbar wären. */
(function (ROR) {
  'use strict';

  const U = ROR.Util;

  const GRAVITY = 27;
  const JUMP_VELOCITY = 14;      // ergibt 14² / (2·27) ≈ 3.63 m Sprunghöhe
  const SPRINT_MULT = 1.45;
  const ACCEL_GROUND = 75;
  const ACCEL_AIR = 26;
  const FRICTION = 12;
  const RADIUS = 0.42;
  const HEIGHT = 1.85;
  const STEP_UP = 0.55;
  const COYOTE = 0.12;           // Restnachsicht nach dem Verlassen der Kante
  const JUMP_BUFFER = 0.12;      // vorgemerkter Sprung kurz vor der Landung
  const FALL_DAMAGE_SPEED = 32;  // ab hier tut die Landung weh (≈ 19 m Fallhöhe)

  const wish = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const rgt = new THREE.Vector3();

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

  function buildBody(colors) {
    const root = new THREE.Group();

    const hips = limb(root, 0, 0.92, 0);
    const torso = box(0.52, 0.62, 0.32, colors.coat);
    torso.position.y = 0.31;
    hips.add(torso);

    const chest = box(0.58, 0.26, 0.36, colors.coatDark);
    chest.position.y = 0.72;
    hips.add(chest);

    const neck = limb(hips, 0, 0.86, 0);
    const head = box(0.30, 0.30, 0.30, colors.skin);
    head.position.y = 0.15;
    neck.add(head);
    const visor = box(0.32, 0.10, 0.06, colors.visor);
    visor.position.set(0, 0.17, -0.15);
    neck.add(visor);
    const cap = box(0.34, 0.12, 0.34, colors.coatDark);
    cap.position.y = 0.33;
    neck.add(cap);

    const arms = [];
    for (let s = -1; s <= 1; s += 2) {
      const shoulder = limb(hips, s * 0.36, 0.70, 0);
      const upper = box(0.16, 0.34, 0.16, colors.coat);
      upper.position.y = -0.17;
      shoulder.add(upper);
      const elbow = limb(shoulder, 0, -0.34, 0);
      const fore = box(0.14, 0.32, 0.14, colors.skin);
      fore.position.y = -0.16;
      elbow.add(fore);
      arms.push({ shoulder, elbow, side: s });
    }

    // Pistole in der rechten Hand — nur ein Formhinweis, gefeuert wird in Stufe 2.
    const gun = box(0.11, 0.13, 0.34, colors.metal);
    gun.position.set(0, -0.34, -0.10);
    arms[1].elbow.add(gun);

    const legs = [];
    for (let s = -1; s <= 1; s += 2) {
      const hip = limb(hips, s * 0.15, 0.02, 0);
      const thigh = box(0.19, 0.44, 0.19, colors.pants);
      thigh.position.y = -0.22;
      hip.add(thigh);
      const knee = limb(hip, 0, -0.44, 0);
      const shin = box(0.17, 0.42, 0.17, colors.pants);
      shin.position.y = -0.21;
      knee.add(shin);
      const foot = box(0.19, 0.10, 0.30, colors.boots);
      foot.position.set(0, -0.44, -0.05);
      knee.add(foot);
      legs.push({ hip, knee, side: s });
    }

    return { root, hips, neck, arms, legs, gun };
  }

  const COLORS = {
    coat: 0x39485c, coatDark: 0x2a3648, skin: 0xc79a72,
    visor: 0x8fd6e8, pants: 0x4a4335, boots: 0x2b2723, metal: 0x6a6f75
  };

  ROR.Player = {
    create(spawn) {
      const body = buildBody(COLORS);
      body.root.position.set(spawn.x, spawn.y, spawn.z);
      ROR.Engine.scene.add(body.root);

      const p = {
        body: body,
        object: body.root,
        position: body.root.position,
        velocity: new THREE.Vector3(),
        radius: RADIUS,
        height: HEIGHT,
        grounded: false,
        sprinting: false,
        facing: 0,
        baseSpeed: 7,
        /* Vorläufig — in Stufe 2 übernimmt sim/stats.js diese Werte. */
        maxHealth: 110,
        health: 110,
        spawn: { x: spawn.x, y: spawn.y, z: spawn.z },

        _walkPhase: 0,
        _coyote: 0,
        _jumpBuffer: 0,
        _airTime: 0,
        _lastFallSpeed: 0,
        _landTimer: 0,

        hurt(amount, reason) {
          p.health = Math.max(1, p.health - amount);   // Sturz tötet nicht
          p.lastHurt = reason || 'schaden';
          p.hurtFlash = 0.25;
        },

        respawnAtStart() {
          p.position.set(p.spawn.x, p.spawn.y + 1, p.spawn.z);
          p.velocity.set(0, 0, 0);
        },

        update(dt) { step(p, dt); }
      };

      return p;
    }
  };

  function step(p, dt) {
    const stage = ROR.Stage.current;
    if (!stage) return;

    const inp = ROR.Input;

    /* ------------------------------------------------------- Wunschrichtung */

    ROR.Camera.forward(fwd);
    ROR.Camera.right(rgt);
    wish.set(0, 0, 0)
      .addScaledVector(rgt, inp.move.x)
      .addScaledVector(fwd, -inp.move.z);
    const wishLen = wish.length();
    if (wishLen > 1e-4) wish.divideScalar(wishLen);

    // Sprint gilt nur vorwärts — seitwärts wegrennen wäre im Original auch nicht drin.
    p.sprinting = inp.down('sprint') && wishLen > 0.1 && inp.move.z < -0.3;
    const targetSpeed = p.baseSpeed * (p.sprinting ? SPRINT_MULT : 1) * wishLen;
    ROR.Camera.setFovBoost(p.sprinting ? 9 : 0);

    /* -------------------------------------------------- Waagerechte Bewegung */

    const accel = p.grounded ? ACCEL_GROUND : ACCEL_AIR;
    const vx = p.velocity.x, vz = p.velocity.z;
    if (wishLen > 1e-4) {
      const tx = wish.x * targetSpeed, tz = wish.z * targetSpeed;
      p.velocity.x = U.approach(vx, tx, accel * dt);
      p.velocity.z = U.approach(vz, tz, accel * dt);
    } else if (p.grounded) {
      const sp = Math.hypot(vx, vz);
      const drop = Math.min(sp, FRICTION * dt * Math.max(sp, 3));
      if (sp > 1e-4) {
        p.velocity.x -= (vx / sp) * drop;
        p.velocity.z -= (vz / sp) * drop;
      }
    }

    /* ------------------------------------------------------------- Springen */

    if (inp.pressed('jump')) p._jumpBuffer = JUMP_BUFFER;
    p._jumpBuffer = Math.max(0, p._jumpBuffer - dt);
    p._coyote = p.grounded ? COYOTE : Math.max(0, p._coyote - dt);

    if (p._jumpBuffer > 0 && p._coyote > 0) {
      p.velocity.y = JUMP_VELOCITY;
      p._jumpBuffer = 0;
      p._coyote = 0;
      p.grounded = false;
    }

    p.velocity.y -= GRAVITY * dt;
    if (p.velocity.y < -90) p.velocity.y = -90;

    /* --------------------------------------------------- Bewegen und lösen */

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
      // Kopf an einer Plattform: der Sprung endet hier.
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
      p.hurt(p.maxHealth * 0.1, 'abgrund');
      p.respawnAtStart();
      p._lastFallSpeed = 0;
    }

    /* ----------------------------------------------------------- Animation */

    animate(p, dt);
  }

  function land(p, y) {
    const speed = p._lastFallSpeed;
    p._lastFallSpeed = 0;
    p._landTimer = 0.22;
    if (speed > FALL_DAMAGE_SPEED) {
      // Im Original sind es pauschal 10 % der Höchstgesundheit, und es ist nie tödlich.
      p.hurt(p.maxHealth * 0.1, 'sturz');
    }
  }

  function animate(p, dt) {
    const b = p.body;
    const speed = Math.hypot(p.velocity.x, p.velocity.z);

    // Die Figur schaut in Laufrichtung; im Stand behält sie ihre Ausrichtung.
    if (speed > 0.6) {
      const want = Math.atan2(p.velocity.x, p.velocity.z);
      p.facing = U.angleDamp(p.facing, want, 0.05, dt);
    }
    b.root.rotation.y = p.facing;

    const stride = U.clamp(speed / p.baseSpeed, 0, 1.6);
    p._walkPhase += dt * (4.6 + speed * 0.85);
    const swing = Math.sin(p._walkPhase) * stride;
    const swing2 = Math.sin(p._walkPhase + Math.PI) * stride;

    if (p.grounded) {
      b.legs[0].hip.rotation.x = swing * 0.85;
      b.legs[1].hip.rotation.x = swing2 * 0.85;
      b.legs[0].knee.rotation.x = Math.max(0, -swing) * 0.9;
      b.legs[1].knee.rotation.x = Math.max(0, -swing2) * 0.9;
      b.arms[0].shoulder.rotation.x = swing2 * 0.6;
      b.arms[1].shoulder.rotation.x = swing * 0.45 - 0.25;
      b.hips.position.y = 0.92 + Math.abs(Math.sin(p._walkPhase)) * 0.05 * stride
                        - (p._landTimer > 0 ? p._landTimer * 0.55 : 0);
    } else {
      // Sprungpose: Beine angezogen, Arme leicht nach hinten.
      const t = U.clamp(p._airTime * 4, 0, 1);
      b.legs[0].hip.rotation.x = U.lerp(b.legs[0].hip.rotation.x, -0.5 * t, 0.25);
      b.legs[1].hip.rotation.x = U.lerp(b.legs[1].hip.rotation.x, 0.25 * t, 0.25);
      b.legs[0].knee.rotation.x = U.lerp(b.legs[0].knee.rotation.x, 0.9 * t, 0.25);
      b.legs[1].knee.rotation.x = U.lerp(b.legs[1].knee.rotation.x, 0.35 * t, 0.25);
      b.arms[0].shoulder.rotation.x = U.lerp(b.arms[0].shoulder.rotation.x, -0.7 * t, 0.2);
      b.arms[1].shoulder.rotation.x = U.lerp(b.arms[1].shoulder.rotation.x, -0.45 * t, 0.2);
      b.hips.position.y = 0.92;
    }

    p._landTimer = Math.max(0, p._landTimer - dt);
    // Beim Sprinten nach vorn lehnen — das verkauft das Tempo mehr als die Zahl.
    b.hips.rotation.x = U.damp(b.hips.rotation.x, p.sprinting ? 0.22 : stride * 0.08, 0.08, dt);
    if (p.hurtFlash) p.hurtFlash = Math.max(0, p.hurtFlash - dt);
  }
})(window.ROR);
