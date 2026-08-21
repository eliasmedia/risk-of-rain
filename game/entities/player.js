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

  /* Das Modell selbst entsteht in entities/survivormodel.js — dort steht,
     woraus sich die Silhouette einer Figur zusammensetzt. Hier bleibt nur,
     was sich bewegt. */

  ROR.Player = {
    create(def, spawn) {
      const model = ROR.SurvivorModel.build(def);
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
        _gunKick: 0, _dash: null, _combo: 0, _pending: [],
        _jumpsLeft: 1,
        hurtFlash: 0,

        get health() { return body.health; },
        get maxHealth() { return body.stats.maxHealth; },
        get level() { return body.level; },

        recoil(amount) { p._gunKick = Math.min(1.4, p._gunKick + amount); },

        /* Etwas gleich, aber nicht sofort tun — der zweite Streich von
           Whirlwind, der Nachschlag einer Kombination. */
        after(sekunden, fn) { p._pending.push({ t: sekunden, fn: fn }); },

        /* MUL-T trägt zwei Primärwaffen und schaltet zwischen ihnen um.
           Der Platz bleibt derselbe, nur die Definition wechselt. */
        swapPrimary() {
          const alt = p.def.skills.primaryAlt;
          if (!alt) return;
          const st = p.skills.primary;
          st.def = (st.def === p.def.skills.primary) ? alt : p.def.skills.primary;
          st.interval = 0;
          ROR.HUD.refreshSkill('primary', st.def);
          ROR.HUD.toast(st.def.name);
        },

        beginFlight(seconds) { p._flight = seconds; },

        /* Ein Satz nach vorn. Die Rolle des Commando, der Ansturm von MUL-T
           und der Sprung der Mercenary sind derselbe Vorgang mit anderen
           Zahlen — Dauer, Tempo, Unverwundbarkeit und ob er wehtut. */
        startDash(o) {
          o = o || {};
          const len = Math.hypot(p.velocity.x, p.velocity.z);
          const dir = new THREE.Vector3();
          if (o.towardAim) ROR.Camera.forward(dir);
          else if (len > 0.5) dir.set(p.velocity.x / len, 0, p.velocity.z / len);
          else ROR.Camera.forward(dir);

          p._dash = {
            total: o.time || DIVE_TIME,
            left: o.time || DIVE_TIME,
            speed: o.speed || DIVE_SPEED,
            dir: dir,
            damage: o.damage || null,
            radius: o.radius || 2.6,
            hit: [],
            slot: o.slot || null,
            resetOnHit: !!o.resetOnHit,
            pose: o.pose || 'roll'
          };
          if (o.iframes) body.invulnerable = Math.max(body.invulnerable, o.iframes);
          if (o.armor) { body.dashArmor = o.armor; body.statsDirty = true; }
        },

        startDive() { p.startDash({ time: DIVE_TIME, iframes: DIVE_IFRAMES }); },

        /* Eviscerate: an den nächsten Gegner heften und unangreifbar bleiben. */
        latchTo(ziel, dt) {
          if (!ziel) return;
          const d = new THREE.Vector3(ziel.position.x - p.position.x, 0,
                                      ziel.position.z - p.position.z);
          const len = d.length();
          if (len > 2.2) {
            d.divideScalar(len);
            p.position.x += d.x * Math.min(len - 2.0, 40 * dt);
            p.position.z += d.z * Math.min(len - 2.0, 40 * dt);
          }
          p.position.y = Math.max(p.position.y, ziel.position.y + 0.6);
          p.velocity.set(0, 0, 0);
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

    /* Manche Figuren zielen nicht selbst: die Huntress sucht sich das nächste
       Ziel im Umkreis und trifft es, egal wohin das Fadenkreuz zeigt. Das ist
       ihr ganzes Wesen — sie kämpft, während sie ausweicht. */
    if (p.def.autoTarget) {
      const ziel = ROR.Projectiles.nearestEnemy(p.position, p.def.autoTarget, p.body.team);
      if (ziel) {
        const f = p.facing, cf = Math.cos(f), sf = Math.sin(f);
        muzzle.set(p.position.x + 0.34 * cf + (-0.55) * sf,
                   p.position.y + 1.24,
                   p.position.z - 0.34 * sf + (-0.55) * cf);
        target.set(ziel.position.x, ziel.position.y + ziel.height * 0.55, ziel.position.z);
        shotDir.copy(target).sub(muzzle).normalize();
        return { player: p, body: p.body, origin: muzzle, dir: shotDir,
                 target: target, lockedOn: ziel };
      }
    }

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
      } else if (d.mode === 'charge') {
        /* Halten lädt auf, Loslassen feuert. Wie stark, entscheidet die
           Ladung — bei Engineer die Zahl der Granaten, bei Artificer die
           Wucht der Bombe. */
        if (inp.down(slot) && st.charges > 0) {
          st.charging = Math.min(1, (st.charging || 0) + dt / d.chargeTime);
          p._aimTimer = 0.45;
          p.sprinting = false;
        } else if (st.charging > 0) {
          const menge = st.charging;
          st.charging = 0;
          if (st.charges === st.maxCharges) st.cooldown = d.cooldown;
          st.charges--;
          d.fire(aimContext(p), menge);
          p._aimTimer = 0.45;
        }
      } else if (d.mode === 'swap') {
        if (inp.pressed(slot) && st.cooldown <= 0) {
          st.cooldown = d.cooldown;
          d.fire({ player: p, body: p.body });
        }
        // Wechselfähigkeiten haben keine Ladungen, nur eine kurze Sperre.
        if (st.cooldown > 0) st.cooldown -= dt;
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
    // Als Buff geführt, damit Items den Zustand abfragen können.
    if (p.sprinting !== p._wasSprinting) {
      p._wasSprinting = p.sprinting;
      if (p.sprinting) ROR.Buffs.apply(p.body, 'sprinting', 0);
      else ROR.Buffs.clear(p.body, 'sprinting');
    }
    const speed = S.moveSpeed * (p.sprinting ? SPRINT_MULT : 1) * wishLen;
    ROR.Camera.setFovBoost(p.sprinting ? 9 : 0);

    updateSkills(p, dt);
    ROR.Items.updateEquipment(p.body, dt, inp.pressed('equipment'));

    if (p._dash) {
      const g = p._dash;
      g.left -= dt;
      p.velocity.x = g.dir.x * S.moveSpeed * g.speed;
      p.velocity.z = g.dir.z * S.moveSpeed * g.speed;

      /* Ein Sprintangriff, der wehtut, trifft jeden Gegner höchstens einmal —
         sonst würde ein einziger Satz durch eine Gruppe alles auslöschen. */
      if (g.damage) {
        const treffer = ROR.Projectiles.enemiesInRange(p.position, g.radius, p.body.team, 8);
        for (let i = 0; i < treffer.length; i++) {
          if (g.hit.indexOf(treffer[i]) >= 0) continue;
          g.hit.push(treffer[i]);
          ROR.Damage.deal({
            attacker: p.body, victim: treffer[i],
            coefficient: g.damage.coefficient, proc: g.damage.proc,
            position: treffer[i].center(new THREE.Vector3())
          });
          // Blinding Assault erneuert sich an jedem Treffer.
          if (g.resetOnHit && g.slot) {
            const st = p.skills[g.slot];
            if (st.charges < st.maxCharges) st.charges++;
          }
        }
      }

      if (g.left <= 0) {
        p._dash = null;
        if (p.body.dashArmor) { p.body.dashArmor = 0; p.body.statsDirty = true; }
      }
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
      p.velocity.y = JUMP_VELOCITY * Math.sqrt(S.jumpPower || 1);
      p._jumpBuffer = 0;
      p._coyote = 0;
      p.grounded = false;
    }

    if (p._flight > 0) {
      // Milky Chrysalis: freies Schweben, Leertaste hoch, Strg runter.
      p._flight -= dt;
      const steig = (inp.down('jump') ? 1 : 0) - (inp.down('sprint') ? 1 : 0);
      p.velocity.y = U.approach(p.velocity.y, steig * 9, 40 * dt);
    } else {
      p.velocity.y -= GRAVITY * dt;
      if (p.velocity.y < -90) p.velocity.y = -90;
    }

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
      nonLethal(p, p.body.stats.maxHealth * 0.1 * ROR.Artifacts.fallDamageMult());
      p.position.set(p.spawn.x, p.spawn.y + 1, p.spawn.z);
      p.velocity.set(0, 0, 0);
      p._lastFallSpeed = 0;
    }

    for (let i = p._pending.length - 1; i >= 0; i--) {
      p._pending[i].t -= dt;
      if (p._pending[i].t <= 0) { p._pending[i].fn(); p._pending.splice(i, 1); }
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

    /* H3AD-5T v2: die Landung selbst ist der Angriff. Je härter der Aufschlag,
       desto größer der Einschlag — und der Sturzschaden entfällt dafür. */
    const heads = p.body.items.h3ad5t || 0;
    if (heads > 0 && speed > 14) {
      const wucht = U.clamp(speed / 40, 0, 2.5);
      ROR.Damage.explode({
        attacker: p.body, team: p.body.team, position: p.position.clone(),
        radius: 6 + 4 * heads, coefficient: 10 * heads * wucht, proc: 0
      });
      ROR.Projectiles.spark(p.position.clone(), 0xffd070, (6 + 4 * heads) * 0.5);
      return;
    }
    if (speed > FALL_DAMAGE_SPEED) {
      const menge = p.body.stats.maxHealth * 0.1 * ROR.Artifacts.fallDamageMult();
      // Frailty macht den Sturz tödlich — sonst bleibt immer ein Punkt übrig.
      if (ROR.Artifacts.fallIsLethal()) {
        ROR.Damage.deal({ victim: p.body, flat: menge, ignoreArmor: true,
                          type: 'environment', proc: 0, crit: false,
                          position: p.position.clone().setY(p.position.y + 1) });
      } else nonLethal(p, menge);
    }
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

    if (p._dash) {
      // Rolle: zusammengekauert und um die eigene Achse.
      const t = 1 - p._dash.left / Math.max(0.01, p._dash.left + 0.0001) + (1 - p._dash.left);
      // Vorwärtsüberschlag: der Kopf muss nach -Z wandern, das ist eine
      // *negative* Drehung um X. Mit positiver rollte die Figur rückwärts,
      // während sie sich vorwärts bewegte.
      b.hips.rotation.x = -t * Math.PI * 2;
      b.legs[0].hip.rotation.x = 1.1; b.legs[1].hip.rotation.x = 1.1;
      b.legs[0].knee.rotation.x = -1.6; b.legs[1].knee.rotation.x = -1.6;
      b.arms[0].shoulder.rotation.x = -1.3; b.arms[1].shoulder.rotation.x = -1.3;
      b.hips.position.y = 0.62;
    } else if (p.grounded) {
      b.legs[0].hip.rotation.x = swing * 0.85;
      b.legs[1].hip.rotation.x = swing2 * 0.85;
      // Knie beugen nach hinten: negative Drehung um X. Der Betrag ist der
      // Rückschwung des Beins, das Vorzeichen macht daraus ein Knie und
      // kein Storchenbein.
      b.legs[0].knee.rotation.x = -Math.max(0, -swing) * 0.9;
      b.legs[1].knee.rotation.x = -Math.max(0, -swing2) * 0.9;
      b.arms[0].shoulder.rotation.x = swing2 * 0.6;
      b.hips.position.y = 0.92 + Math.abs(Math.sin(p._walkPhase)) * 0.05 * stride
                        - (p._landTimer > 0 ? p._landTimer * 0.55 : 0);
      b.hips.rotation.x = U.damp(b.hips.rotation.x, p.sprinting ? 0.22 : stride * 0.08, 0.08, dt);
    } else {
      const t = U.clamp(p._airTime * 4, 0, 1);
      b.legs[0].hip.rotation.x = U.lerp(b.legs[0].hip.rotation.x, -0.5 * t, 0.25);
      b.legs[1].hip.rotation.x = U.lerp(b.legs[1].hip.rotation.x, 0.25 * t, 0.25);
      b.legs[0].knee.rotation.x = U.lerp(b.legs[0].knee.rotation.x, -0.9 * t, 0.25);
      b.legs[1].knee.rotation.x = U.lerp(b.legs[1].knee.rotation.x, -0.35 * t, 0.25);
      b.arms[0].shoulder.rotation.x = U.lerp(b.arms[0].shoulder.rotation.x, -0.7 * t, 0.2);
      b.hips.position.y = 0.92;
      b.hips.rotation.x = U.damp(b.hips.rotation.x, 0, 0.1, dt);
    }

    /* Der Waffenarm hebt sich beim Zielen und wird vom Rückstoß geworfen. */
    if (!p._dash) {
      const aiming = p._aimTimer > 0;
      // +1.45 rad bringt den hängenden Arm auf Waagerechte nach vorn.
      // Der Rückstoß hebt die Mündung, dreht also *weiter* in dieselbe Richtung.
      const want = aiming ? 1.45 + p._gunKick * 0.30 : (p.grounded ? swing * 0.45 - 0.2 : -0.4);
      b.arms[1].shoulder.rotation.x = U.damp(b.arms[1].shoulder.rotation.x, want, 0.03, dt);
      b.arms[1].elbow.rotation.x = U.damp(b.arms[1].elbow.rotation.x, aiming ? 0.1 : 0, 0.05, dt);
    }
    b.flash.material.opacity = Math.min(1, p._gunKick);
    b.flash.scale.setScalar(0.6 + p._gunKick * 0.9);
    p._gunKick = Math.max(0, p._gunKick - dt * 9);

    p._landTimer = Math.max(0, p._landTimer - dt);
  }
})(window.ROR);
