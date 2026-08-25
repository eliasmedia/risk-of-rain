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
        _gunKick: 0, _kickOff: 0, _dash: null, _combo: 0, _pending: [],
        _swing: 0, _swingStark: 0, _swingSeite: 1, _handWechsel: 1,
        _jumpsLeft: 1,
        /* Neu für die Animationsschicht: geglätteter Zielnickwinkel, die
           Landestauchung, der Atemtakt, der Schritttakt für Staub und der
           Zähler für Nachbilder. */
        _nick: 0, _squash: 0, _breath: Math.random() * 6.28, _schritt: 0,
        _ghostTakt: 0, _blink: null, _hovering: false, _hoverTakt: 0, _charge: 0,
        hurtFlash: 0,

        get health() { return body.health; },
        get maxHealth() { return body.stats.maxHealth; },
        get level() { return body.level; },

        /* Der Rückstoßimpuls jeder Fähigkeit. Bei einer Fernwaffe wirft er die
           Waffe zurück, bei einer Nahkampfwaffe löst er stattdessen einen
           Hieb aus — so muss keine Fähigkeit wissen, was die Figur trägt. */
        recoil(amount) {
          /* Wucht gehört ins Bild, nicht nur in die Zahlen. Der Rückstoß ist
             die einzige Größe, die jede Fähigkeit ohnehin schon angibt — sie
             als Quelle der Kamera-Erschütterung zu nehmen, spart es, in
             sechs Datensätzen je vier Mal dieselbe Zeile zu schreiben.
             Gedeckelt, damit Dauerfeuer das Bild nicht kochen lässt. */
          ROR.Camera.addShake(Math.min(0.22, amount * 0.075));
          if (p.model && p.model.nahkampf) {
            p._swing = 1;
            p._swingStark = U.clamp(amount * 1.6, 0.5, 1.5);
            p._swingSeite = -p._swingSeite;   // Hiebe wechseln die Seite
            return;
          }
          if (p.model && p.model.gunOff) {
            // Zwei Pistolen: abwechselnd feuern, wie im Original.
            p._handWechsel = -p._handWechsel;
            if (p._handWechsel < 0) { p._kickOff = Math.min(1.4, p._kickOff + amount); return; }
          }
          p._gunKick = Math.min(1.4, p._gunKick + amount);
        },

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

        /* Ein Satz senkrecht nach oben. Arrow Rain im Original ist ein
           „teleport into the sky" — ohne den Höhengewinn fehlt der Fähigkeit
           ihr halber Zweck, nämlich aus dem Nahkampf herauszukommen. */
        launch(tempo, iframes) {
          p.velocity.y = Math.max(p.velocity.y, tempo);
          p.grounded = false;
          p._coyote = 0;
          if (iframes) body.invulnerable = Math.max(body.invulnerable, iframes);
          ROR.CharFX.staub(p.position.clone(), 6, 2.6);
          ROR.CharFX.nachbild(p, 0.6, 0.35);
        },

        /* Ein Satz nach vorn. Die Rolle des Commando, der Ansturm von MUL-T
           und der Sprung der Mercenary sind derselbe Vorgang mit anderen
           Zahlen — Dauer, Tempo, Unverwundbarkeit und ob er wehtut. */
        startDash(o) {
          o = o || {};
          const len = Math.hypot(p.velocity.x, p.velocity.z);
          const dir = new THREE.Vector3();
          if (o.raum) {
            /* Raeumlicher Satz: dorthin, wohin man schaut, Hoehe eingeschlossen.
               `Camera.forward` liefert bewusst eine flache Richtung fuer WASD —
               fuer einen Sprung ueber eine Kante braucht es `Camera.aim`, das
               die Neigung mitnimmt. */
            ROR.Camera.aim(dir);
            // Steil nach unten wuerde nur in den Boden rammen.
            if (dir.y < -0.55) { dir.y = -0.55; dir.normalize(); }
          } else if (o.towardAim) ROR.Camera.forward(dir);
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
            raum: !!o.raum,
            pose: o.pose || 'roll'
          };
          if (o.iframes) body.invulnerable = Math.max(body.invulnerable, o.iframes);
          if (o.armor) { body.dashArmor = o.armor; body.statsDirty = true; }
        },

        startDive() {
          p.startDash({ time: DIVE_TIME, iframes: DIVE_IFRAMES });
          ROR.CharFX.staub(p.position.clone(), 5, 2.2);
        },

        /* Blink ist kein Dash.

           Das Wiki sagt zur Huntress ausdrücklich „Disappear and teleport
           forward" und „resets vertical momentum" — sie verschwindet, sie
           rutscht nicht. Als Dash über 0,28 s fühlte sich das an wie
           Commandos Rolle in Grün und nahm ihr das Einzige, was sie von
           allen anderen unterscheidet.

           Hier ist die Figur für die Dauer unsichtbar, unverwundbar und legt
           eine feste Strecke zurück statt einer Geschwindigkeit mal Zeit.
           Sichtbar bleibt sie als Kette von Nachbildern — ohne die wäre der
           Sprung nicht lesbar, sondern nur ein Ruckler. */
        startBlink(o) {
          o = o || {};
          const dir = new THREE.Vector3();
          if (o.backward) { ROR.Camera.forward(dir); dir.negate(); }
          else ROR.Camera.forward(dir);
          const zeit = o.time || 0.2;
          p._blink = {
            left: zeit, total: zeit, dir: dir,
            tempo: (o.distance || 20) / zeit,
            farbe: o.color === undefined ? p.def.colors.visor : o.color,
            takt: 0
          };
          p.velocity.y = 0;               // „resets vertical momentum"
          body.invulnerable = Math.max(body.invulnerable, zeit + 0.12);
          ROR.CharFX.nachbild(p, 0.9, 0.42);
          ROR.CharFX.ring(p.position.clone().setY(p.position.y + 1),
                          p._blink.farbe, 0.3, 2.6, 0.32);
          model.root.visible = false;
          ROR.Camera.addShake(0.12);
        },

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
            ROR.Audio.spiel('stufe');
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
    /* Die stärkste laufende Aufladung — die Animation braucht *eine* Zahl,
       egal aus welchem Platz sie kommt. */
    let ladung = 0;

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
          if (st.charging > ladung) ladung = st.charging;
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
    p._charge = ladung;
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

    if (p._blink) {
      /* Während des Blinks gilt weder Beschleunigung noch Schwerkraft: die
         Figur legt eine feste Strecke in fester Zeit zurück. Die Kollision
         weiter unten bleibt aktiv — man blinkt nicht durch Berge. */
      const bl = p._blink;
      bl.left -= dt;
      p.velocity.set(bl.dir.x * bl.tempo, 0, bl.dir.z * bl.tempo);
      bl.takt -= dt;
      if (bl.takt <= 0) { ROR.CharFX.nachbild(p, 0.55, 0.3); bl.takt = 0.032; }
      if (bl.left <= 0) {
        p.model.root.visible = true;
        ROR.CharFX.nachbild(p, 0.8, 0.4);
        ROR.CharFX.ring(p.position.clone().setY(p.position.y + 1), bl.farbe, 2.2, 0.4, 0.28);
        ROR.Projectiles.spark(p.position.clone().setY(p.position.y + 1), bl.farbe, 1.4);
        // Ein Rest Schwung bleibt, sonst steht man nach dem Blink wie angenagelt.
        p.velocity.multiplyScalar(0.28);
        p._blink = null;
      }
    } else if (p._dash) {
      const g = p._dash;
      g.left -= dt;
      /* Nachbilder machen aus einem Ortswechsel eine Strecke. Ohne sie liest
         das Auge einen Dash als Ruckler — mit ihnen als Bewegung. */
      p._ghostTakt -= dt;
      if (p._ghostTakt <= 0) {
        ROR.CharFX.nachbild(p, g.damage ? 0.65 : 0.45, 0.3);
        p._ghostTakt = 0.045;
      }
      p.velocity.x = g.dir.x * S.moveSpeed * g.speed;
      p.velocity.z = g.dir.z * S.moveSpeed * g.speed;
      // Nur ein raeumlicher Satz traegt auch nach oben; die Rolle bleibt flach.
      if (g.raum) p.velocity.y = g.dir.y * S.moveSpeed * g.speed;

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
        /* Ein Teil des Schwungs bleibt, sonst faellt man am Ende eines
           Aufwaertssatzes wie ein Stein senkrecht nach unten. */
        if (g.raum) p.velocity.y = Math.max(0, p.velocity.y) * 0.35;
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
      const ausDerLuft = p._coyote <= 0;
      if (ausDerLuft) p._jumpsLeft--;
      /* Der zweite Sprung ist im Original flacher als der erste. Wie viel
         flacher, steht im Passiv der Figur — bei Mercenary 86 %. */
      const kraft = ausDerLuft && p.def.passive && p.def.passive.secondJump
                  ? p.def.passive.secondJump : 1;
      p.velocity.y = JUMP_VELOCITY * Math.sqrt(S.jumpPower || 1) * kraft;
      ROR.Audio.spiel('sprung');
      if (ausDerLuft) {
        // Doppelsprung: ein Ring in der Luft zeigt, dass die zweite Ladung weg ist.
        ROR.CharFX.ring(p.position.clone().setY(p.position.y + 0.35),
                        p.def.colors.visor, 0.4, 2.0, 0.3);
      } else {
        ROR.CharFX.staub(p.position.clone(), 4, 1.6);
      }
      p._jumpBuffer = 0;
      p._coyote = 0;
      p.grounded = false;
    }

    if (p._flight > 0) {
      // Milky Chrysalis: freies Schweben, Leertaste hoch, Strg runter.
      p._flight -= dt;
      const steig = (inp.down('jump') ? 1 : 0) - (inp.down('sprint') ? 1 : 0);
      p.velocity.y = U.approach(p.velocity.y, steig * 9, 40 * dt);
    } else if (p._blink) {
      p.velocity.y = 0;
    } else if (p._dash && p._dash.raum) {
      /* Waehrend des Satzes keine Schwerkraft: sonst zieht sie die Bahn schon
         auf halber Strecke wieder herunter und aus dem Sprung ueber die Kante
         wird ein Sprung gegen die Kante. */
    } else {
      p.velocity.y -= GRAVITY * dt;
      if (p.velocity.y < -90) p.velocity.y = -90;

      /* ENV Suit (Artificer).

         Ihr Passiv und zugleich ihre einzige Fortbewegung: Sprungtaste in der
         Luft halten, und sie fällt nicht mehr, sondern sinkt. Sie hat weder
         Dash noch Doppelsprung — ohne das Schweben ist sie die einzige Figur
         im Spiel ganz ohne Mobilität, und genau so hat sie sich bisher auch
         angefühlt.

         Die Bedingung `velocity.y < 0.5` sorgt dafür, dass das Halten den
         Aufstieg nicht abschneidet: erst wenn der Sprung seinen Scheitel
         erreicht hat, greift der Anzug. */
      const anzug = p.def.passive && p.def.passive.hover;
      p._hovering = false;
      if (anzug && !p.grounded && !p._dash && p.velocity.y < 0.5 && inp.down('jump')) {
        p._hovering = true;
        p.velocity.y = U.approach(p.velocity.y, -anzug.fallSpeed, anzug.control * dt);
        // In der Luft steuert sie besser als jede andere Figur — das ist der Sinn.
        if (wishLen > 1e-4) {
          p.velocity.x = U.approach(p.velocity.x, wish.x * speed * anzug.drift, ACCEL_GROUND * dt);
          p.velocity.z = U.approach(p.velocity.z, wish.z * speed * anzug.drift, ACCEL_GROUND * dt);
        }
        // Die Düsen im Rücken zeigen, dass der Anzug arbeitet.
        p._hoverTakt -= dt;
        if (p._hoverTakt <= 0) {
          p._hoverTakt = 0.07;
          ROR.Projectiles.spark(
            p.position.clone().setY(p.position.y + 0.35 + Math.random() * 0.3),
            p.def.colors.visor, 0.5);
        }
      }
    }

    const altX = p.position.x, altZ = p.position.z;
    p.position.x += p.velocity.x * dt;
    p.position.z += p.velocity.z * dt;
    // Steile Wände sind Wände. Wer hinauf will, springt oder nimmt den Umweg.
    if (stage.blockSteep(p.position, altX, altZ, p.position.y)) {
      p.velocity.x *= 0.6; p.velocity.z *= 0.6;
    }
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
      /* Zweite Absicherung: liegt der gemerkte Punkt aus irgendeinem Grund
         nicht auf festem Boden, nimm den Startpunkt der aktuellen Stage.
         Sonst faellt man aus dem Rettungspunkt gleich wieder heraus. */
      let ziel = p.spawn;
      if (!stage.terrain.isWalkable(ziel.x, ziel.z, 0.6)) ziel = stage.spawn;
      p.position.set(ziel.x, ziel.y + 1, ziel.z);
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

    /* Eine Landung ohne Reaktion liest sich als Teleport auf den Boden.
       Drei Dinge machen daraus einen Aufschlag: die Figur staucht sich, der
       Boden staubt, und die Kamera bekommt einen Stoß — jedes davon
       proportional zur Fallgeschwindigkeit, damit ein Absatz anders klingt
       als ein Sturz vom Plateau. */
    const wucht = U.clamp(speed / 26, 0, 1);
    p._squash = Math.max(p._squash, 0.35 + wucht * 0.65);
    if (speed > 6) {
      ROR.CharFX.staub(p.position.clone(), 3 + Math.round(wucht * 7), 1.4 + wucht * 3.2);
      ROR.CharFX.ring(p.position.clone().setY(p.position.y + 0.06), 0xd8cbb0,
                      0.5, 1.4 + wucht * 3.4, 0.3);
    }
    if (wucht > 0.25) ROR.Camera.addShake(wucht * 0.35);

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

  /* Sechs Figuren mit demselben Laufzyklus sind eine Figur in sechs Farben.
     Deshalb steht in jedem Datensatz ein `gait`: Schrittweite, Takt, Wippen,
     Vorlage, Armschwung. Der Standard hier ist der von Commando — wer nichts
     angibt, läuft wie er.

       stride      Ausschlag der Beine (0 = keine, für Schwebende)
       tempo       Schrittfrequenz
       bob         Auf und Ab der Hüfte je Schritt
       lean        Vorlage im Gehen
       sprintLean  Vorlage im Sprint
       arm         Armschwung
       stomp       schwere Maschine: Staub und ein Stoß bei jedem Auftritt
       hover       kein Schrittzyklus, dafür Neigung in die Bewegungsrichtung */
  const GANG = { stride: 1, tempo: 1, bob: 1, lean: 0.08, arm: 0.6, sprintLean: 0.26 };

  function animate(p, dt) {
    const b = p.model;
    const g = p.def.gait || GANG;
    const S = b.scale || 1;
    const speed = Math.hypot(p.velocity.x, p.velocity.z);
    const tempoBasis = p.body.stats.moveSpeed;

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

    /* Der Zielnickwinkel.

       Eine Drehung um X mit *negativem* Vorzeichen kippt die Vorderseite des
       Modells nach unten — das Modell blickt nach −Z, und dort bewegt eine
       negative Drehung den Punkt nach −Y. Die Kamera zählt `pitch` positiv
       nach unten, also übernimmt der Körper genau `-pitch`.

       Verteilt wird der Winkel über drei Glieder statt über eines: ein
       Drittel Torso, der Rest Kopf. Legte man ihn ganz in den Torso, klappte
       die Figur beim Blick nach oben nach hinten um. */
    const zielNick = p._aimTimer > 0 ? -ROR.Camera.pitch : 0;
    p._nick = U.damp(p._nick, zielNick, 0.05, dt);

    const stride = U.clamp(speed / tempoBasis, 0, 1.6);
    const beinAmp = stride * g.stride;
    p._breath += dt * 1.6;
    p._walkPhase += dt * (4.6 + speed * 0.85) * (g.tempo || 1);
    const swing = Math.sin(p._walkPhase) * beinAmp;
    const swing2 = Math.sin(p._walkPhase + Math.PI) * beinAmp;

    /* Schritttakt: jeder halbe Zyklus ist ein Fußaufsatz. Daran hängen Staub
       und — bei schweren Figuren — ein kleiner Stoß auf die Kamera. Ohne den
       Vergleich mit dem vorigen Bild löste das je nach Bildrate mal einmal,
       mal fünfmal je Schritt aus. */
    const schritt = Math.floor(p._walkPhase / Math.PI);
    if (schritt !== p._schritt) {
      const vorher = p._schritt;
      p._schritt = schritt;
      if (vorher !== 0 && p.grounded && beinAmp > 0.35 && !p._dash) {
        if (g.stomp) {
          ROR.CharFX.staub(p.position.clone(), 2, 1.1, 0xc8b898);
          ROR.Camera.addShake(0.05);
        } else if (stride > 0.9) {
          ROR.CharFX.staub(p.position.clone(), 1, 0.8);
        }
      }
    }

    /* ------------------------------------------------------ Grundhaltung */

    if (p._blink) {
      // Unsichtbar — trotzdem gepflegt, weil die Nachbilder diese Haltung erben.
      strecke(b, 0.4);
      b.hips.rotation.x = -0.45;
      b.hips.rotation.z = 0;
    } else if (p._dash) {
      const d = p._dash;
      const t = 1 - d.left / d.total;
      if (d.pose === 'leap') {
        // Sprungangriff: Knie angezogen, Waffenarm ausgestreckt nach vorn.
        b.hips.rotation.x = U.damp(b.hips.rotation.x, -0.5, 0.05, dt);
        setzeBein(b, 0, 1.25, -1.5); setzeBein(b, 1, 0.75, -1.1);
        b.arms[1].shoulder.rotation.x = U.damp(b.arms[1].shoulder.rotation.x, 2.1, 0.04, dt);
        b.arms[0].shoulder.rotation.x = U.damp(b.arms[0].shoulder.rotation.x, -1.4, 0.05, dt);
        b.torso.rotation.x = U.damp(b.torso.rotation.x, -0.35, 0.05, dt);
      } else if (d.pose === 'charge') {
        // Ansturm: die Maschine legt sich in die Fahrt und senkt den Kopf.
        b.hips.rotation.x = U.damp(b.hips.rotation.x, -0.42, 0.08, dt);
        setzeBein(b, 0, 0.5 + swing * 0.3, -0.5);
        setzeBein(b, 1, 0.5 + swing2 * 0.3, -0.5);
        b.arms[0].shoulder.rotation.x = U.damp(b.arms[0].shoulder.rotation.x, 0.4, 0.06, dt);
        b.arms[1].shoulder.rotation.x = U.damp(b.arms[1].shoulder.rotation.x, 0.4, 0.06, dt);
        b.torso.rotation.x = U.damp(b.torso.rotation.x, -0.2, 0.08, dt);
      } else {
        /* Rolle: ein voller Überschlag um die eigene Achse. Der Kopf muss
           nach −Z wandern, das ist eine *negative* Drehung um X — mit
           positiver rollte die Figur rückwärts, während sie vorwärts flog. */
        b.hips.rotation.x = -t * Math.PI * 2;
        setzeBein(b, 0, 1.1, -1.6); setzeBein(b, 1, 1.1, -1.6);
        b.arms[0].shoulder.rotation.x = -1.3;
        b.arms[1].shoulder.rotation.x = -1.3;
        b.torso.rotation.x = 0.55;      // eingerollt
      }
      b.hips.position.y = 0.62;
    } else if (p.grounded) {
      setzeBein(b, 0, swing * 0.85, -Math.max(0, -swing) * 0.9);
      setzeBein(b, 1, swing2 * 0.85, -Math.max(0, -swing2) * 0.9);

      /* Der Waffenarm gehört der Zielhaltung, der freie Arm dem Gang.
         Gegenschwung: rechtes Bein vor, linker Arm vor. */
      b.arms[0].shoulder.rotation.x = swing2 * g.arm;

      /* Wippen. Der Betrag steckt im Gangbild — MUL-T stampft mit 1.8, der
         Engineer schleppt sich mit 0.85 dahin. */
      const wippen = Math.abs(Math.sin(p._walkPhase)) * 0.05 * stride * g.bob;
      const atmen = (1 - stride) * Math.sin(p._breath) * 0.012;
      b.hips.position.y = 0.92 + wippen + atmen - (p._landTimer > 0 ? p._landTimer * 0.55 : 0);

      // Vorlage: negative Drehung um X kippt nach vorn.
      const vor = p.sprinting ? g.sprintLean : stride * g.lean;
      b.hips.rotation.x = U.damp(b.hips.rotation.x, -vor, 0.08, dt);

      /* Kurvenneigung: wer schnell die Richtung wechselt, legt sich in die
         Kurve. Gemessen wird die Querkomponente der Geschwindigkeit
         gegenüber der Blickrichtung. */
      const quer = p.velocity.x * Math.cos(p.facing) - p.velocity.z * Math.sin(p.facing);
      b.hips.rotation.z = U.damp(b.hips.rotation.z,
        U.clamp(quer / Math.max(1, tempoBasis), -1, 1) * 0.16 * stride, 0.1, dt);
    } else {
      /* In der Luft. Beim Steigen sind die Beine angezogen, beim Fallen
         gestreckt und leicht gespreizt — daran erkennt man aus dem Augenwinkel,
         wohin es gerade geht. */
      const t = U.clamp(p._airTime * 4, 0, 1);
      const faellt = U.clamp(-p.velocity.y / 12, 0, 1);
      if (p._hovering) {
        // Schweben: aufrechte Haltung, Beine hängen, kein Zappeln.
        setzeBeinWeich(b, 0, 0.28, -0.55, dt);
        setzeBeinWeich(b, 1, 0.16, -0.35, dt);
        b.hips.rotation.x = U.damp(b.hips.rotation.x, 0.12, 0.1, dt);
        b.hips.position.y = 0.92 + Math.sin(p._breath * 2.2) * 0.045;
      } else {
        setzeBeinWeich(b, 0, U.lerp(-0.55, 0.35, faellt), U.lerp(-1.15, -0.4, faellt) * t, dt);
        setzeBeinWeich(b, 1, U.lerp(0.3, -0.3, faellt), U.lerp(-0.5, -0.2, faellt) * t, dt);
        b.hips.rotation.x = U.damp(b.hips.rotation.x, U.lerp(-0.18, 0.1, faellt), 0.1, dt);
        b.hips.position.y = 0.92;
      }
      b.arms[0].shoulder.rotation.x =
        U.damp(b.arms[0].shoulder.rotation.x, p._hovering ? -0.2 : -0.7 * t, 0.06, dt);
      b.hips.rotation.z = U.damp(b.hips.rotation.z, 0, 0.12, dt);
    }

    /* --------------------------------------- Oberkörper, Kopf, Stauchung */

    if (!p._dash && !p._blink) {
      /* Der Oberkörper trägt ein Drittel des Zielwinkels und dazu die
         Gegenbewegung zum Gang: die Schultern drehen gegen die Hüfte, sonst
         läuft die Figur wie ein Brett. */
      b.torso.rotation.x = U.damp(b.torso.rotation.x, p._nick * 0.34, 0.06, dt);
      b.torso.rotation.y = U.damp(b.torso.rotation.y,
        -Math.sin(p._walkPhase) * 0.12 * beinAmp, 0.07, dt);
      b.torso.position.y = Math.sin(p._breath) * 0.01 * (1 - stride);
    }
    // Der Kopf nimmt den Rest und sieht sich im Leerlauf ein wenig um.
    const kopfNick = p._nick * 0.66;
    const umsehen = p._aimTimer > 0 ? 0 : Math.sin(p._breath * 0.37) * 0.16 * (1 - stride);
    b.head.rotation.x = U.damp(b.head.rotation.x, kopfNick, 0.05, dt);
    b.head.rotation.y = U.damp(b.head.rotation.y, umsehen, 0.12, dt);

    /* Landestauchung: kurz breiter und flacher werden. Die Hüfte trägt schon
       den Figurmaßstab, also wird multipliziert, nicht gesetzt. */
    p._squash = Math.max(0, p._squash - dt * 5.5);
    const q = p._squash * p._squash;
    b.hips.scale.set(S * (1 + q * 0.14), S * (1 - q * 0.22), S * (1 + q * 0.14));

    /* -------------------------------------------------- Arme und Waffen */

    if (!p._dash && !p._blink) {
      if (b.nahkampf) hiebPose(p, b, dt, swing);
      else schussPose(p, b, dt, swing, swing2);
    }

    /* Der Mündungsschein trägt zwei Sachen zugleich: den Blitz des Schusses
       und das Anwachsen einer Ladung. Beide über dasselbe Bauteil, damit man
       nur *eine* Stelle im Blick behalten muss. */
    blitz(b.flash, Math.max(p._gunKick, p._charge * 0.4));
    blitz(b.flashOff, p._kickOff);
    p._gunKick = Math.max(0, p._gunKick - dt * 9);
    p._kickOff = Math.max(0, p._kickOff - dt * 9);
    p._swing = Math.max(0, p._swing - dt * 3.4);
    p._landTimer = Math.max(0, p._landTimer - dt);
  }

  /* Ein Bein in einem Rutsch setzen — Hüfte und Knie gehören zusammen. */
  function setzeBein(b, i, huefte, knie) {
    b.legs[i].hip.rotation.x = huefte;
    b.legs[i].knee.rotation.x = knie;
  }

  function setzeBeinWeich(b, i, huefte, knie, dt) {
    b.legs[i].hip.rotation.x = U.damp(b.legs[i].hip.rotation.x, huefte, 0.06, dt);
    b.legs[i].knee.rotation.x = U.damp(b.legs[i].knee.rotation.x, knie, 0.06, dt);
  }

  /* Alle Glieder gestreckt — die Haltung, in der geblinkt wird. */
  function strecke(b, k) {
    setzeBein(b, 0, -k, -k * 0.4);
    setzeBein(b, 1, k * 0.6, -k * 0.2);
    b.arms[0].shoulder.rotation.x = -k * 1.6;
    b.arms[1].shoulder.rotation.x = -k * 0.6;
    b.torso.rotation.x = -k * 0.5;
  }

  /* Der Mündungsblitz besteht aus mehreren Teilen mit verschiedener
     Höchsthelligkeit. Gesteuert werden sie alle von derselben Zahl, damit
     der Blitz als *ein* Ereignis wirkt — aber der Kern bleibt weiß, während
     der Kegel farbig ist. */
  function blitz(f, staerke) {
    if (!f) return;
    const k = Math.min(1, staerke);
    const mats = f.userData && f.userData.mats;
    if (mats) {
      f.visible = k > 0.02;
      for (let i = 0; i < mats.length; i++) mats[i].opacity = k * mats[i].userData.max;
      // Jeder Schuss dreht den Stern anders — sonst sieht man das Standbild.
      f.rotation.z += 1.9;
      f.scale.set(0.55 + k * 0.85, 0.55 + k * 0.85, 0.7 + k * 0.7);
    } else {
      f.material.opacity = k;
      f.scale.setScalar(0.6 + k * 0.9);
    }
  }

  /* Fernwaffen: Der Arm hebt sich beim Zielen, und die Waffe selbst wird vom
     Rückstoß zurückgeworfen und hebt die Mündung. Vorher bewegte sich nur der
     Arm — die Waffe hing starr daran und wirkte angeklebt. */
  function schussPose(p, b, dt, swing, swing2) {
    const aiming = p._aimTimer > 0;
    const g = p.def.gait || GANG;
    /* +1.45 rad bringt den hängenden Arm auf Waagerechte nach vorn. Der
       Zielnickwinkel kommt dazu, sonst zeigt die Waffe geradeaus, während
       das Geschoss nach oben geht — der auffälligste Fehler der alten
       Fassung, sobald man auf einen Flugmonster zielte. */
    const nick = -p._nick;
    /* Aufladen sichtbar machen.

       Wer Engineers Granaten oder Artificers Nano-Bombe hält, sah bisher am
       Körper nichts: dieselbe Zielhaltung wie beim normalen Schuss, und wie
       weit die Ladung ist, stand nirgends. Jetzt geht der Arm zurück und der
       Oberkörper dreht sich mit — dazu wächst unten der Schein an der
       Mündung. Beides erst bei etwa einem Drittel Ladung spürbar, damit ein
       kurzes Antippen nicht sofort ausschlägt. */
    const laden = p._charge;
    const want = aiming ? 1.45 + nick + p._gunKick * 0.3 - laden * 0.55
                        : (p.grounded ? swing * 0.45 * g.arm - 0.2 : -0.4);
    b.arms[1].shoulder.rotation.x = U.damp(b.arms[1].shoulder.rotation.x, want, 0.03, dt);
    b.arms[1].elbow.rotation.x = U.damp(b.arms[1].elbow.rotation.x, aiming ? 0.1 : 0, 0.05, dt);
    // Beim Zielen zieht der Arm zur Körpermitte, das liest sich als Anlegen.
    b.arms[1].shoulder.rotation.z = U.damp(b.arms[1].shoulder.rotation.z,
      aiming ? 0.16 : 0, 0.05, dt);

    // Zweitwaffe: der linke Arm zielt mit, sonst schwingt er beim Laufen.
    if (b.gunOff) {
      const wantL = aiming ? 1.45 + nick + p._kickOff * 0.3
                           : (p.grounded ? swing2 * 0.45 * g.arm - 0.2 : -0.4);
      b.arms[0].shoulder.rotation.x = U.damp(b.arms[0].shoulder.rotation.x, wantL, 0.03, dt);
      b.arms[0].elbow.rotation.x = U.damp(b.arms[0].elbow.rotation.x, aiming ? 0.1 : 0, 0.05, dt);
      b.arms[0].shoulder.rotation.z = U.damp(b.arms[0].shoulder.rotation.z,
        aiming ? -0.16 : 0, 0.05, dt);
    } else if (aiming) {
      /* Einhändige Fernwaffen: die freie Hand stützt oder hält Abstand. Ohne
         das hängt ein Arm sinnlos herunter, während der andere zielt. */
      b.arms[0].shoulder.rotation.x = U.damp(b.arms[0].shoulder.rotation.x, 1.0 + nick * 0.6, 0.05, dt);
      b.arms[0].shoulder.rotation.y = U.damp(b.arms[0].shoulder.rotation.y, -0.45, 0.06, dt);
      b.arms[0].elbow.rotation.x = U.damp(b.arms[0].elbow.rotation.x, 0.7, 0.06, dt);
    } else {
      b.arms[0].shoulder.rotation.y = U.damp(b.arms[0].shoulder.rotation.y, 0, 0.08, dt);
      b.arms[0].elbow.rotation.x = U.damp(b.arms[0].elbow.rotation.x, 0, 0.08, dt);
    }

    /* Ruhiges Wiegen der Waffe. Ohne das steht sie bewegungslos im Bild,
       auch wenn die Figur atmet — daran erkennt man sofort ein starres Modell. */
    const wiegen = Math.sin(p._walkPhase * 0.45) * 0.035
                 + Math.sin(p._walkPhase * 1.7) * 0.012;
    waffeStoss(b.gun, p._gunKick, wiegen);
    waffeStoss(b.gunOff, p._kickOff, -wiegen);
    if (laden > 0) {
      // Die Waffe selbst richtet sich beim Laden auf und wird größer.
      b.gun.rotation.x -= laden * 0.25;
      b.gun.scale.setScalar(1 + laden * 0.12);
    } else if (b.gun.scale.x !== 1) {
      b.gun.scale.setScalar(U.damp(b.gun.scale.x, 1, 0.06, dt));
    }
  }

  /* Rückstoß an der Waffe: nach hinten geschoben (in Waffenkoordinaten ist das
     +Z) und die Mündung nach oben gekippt. */
  function waffeStoss(g, kick, wiegen) {
    if (!g) return;
    if (g.userData.wurf) {
      /* Wurfwaffe: sie schnellt nach vorn und dreht sich um den Schaft,
         statt zurückgeworfen zu werden. */
      g.position.z = -kick * 0.16;
      g.rotation.x = -Math.PI / 2 + kick * 0.5 + wiegen * 0.5;
      g.rotation.z = wiegen - kick * 0.7;
      return;
    }
    g.position.z = kick * 0.09;
    g.rotation.x = -Math.PI / 2 - kick * 0.34 + wiegen * 0.5;
    g.rotation.z = wiegen;
    if (g.userData.ring) {
      // Artificer: der Kristall im Ring dreht sich und pulst mit dem Schuss.
      g.userData.ring.rotation.z += 0.9 * (1 / 60) + kick * 0.12;
      g.userData.ring.scale.setScalar(1 + kick * 0.25);
    }
  }

  /* Nahkampf: Ausholen, Hieb, Nachschwingen — als eine Kurve über den ganzen
     Körper, nicht nur über den Arm. Die Hüfte dreht mit, sonst sieht der Hieb
     aus, als käme die Kraft aus dem Handgelenk. */
  function hiebPose(p, b, dt, swing) {
    const seite = p._swingSeite;
    let w;
    if (p._swing > 0) {
      const t = 1 - p._swing;
      if (t < 0.26) {
        w = -U.smoothstep(0, 1, t / 0.26);              // ausholen
      } else if (t < 0.56) {
        w = -1 + 2.6 * U.smoothstep(0, 1, (t - 0.26) / 0.3);  // Hieb
      } else {
        w = 1.6 * (1 - U.smoothstep(0, 1, (t - 0.56) / 0.44));
      }
      w *= p._swingStark;
    } else {
      w = 0;
    }

    const ruhe = p.grounded ? swing * 0.35 - 0.15 : -0.35;
    const zielX = p._swing > 0 ? 0.95 - p._nick + w * 0.5 : ruhe;
    b.arms[1].shoulder.rotation.x = U.damp(b.arms[1].shoulder.rotation.x, zielX, 0.025, dt);
    b.arms[1].shoulder.rotation.y = U.damp(b.arms[1].shoulder.rotation.y, -seite * w * 0.85, 0.025, dt);
    b.arms[1].shoulder.rotation.z = U.damp(b.arms[1].shoulder.rotation.z, seite * w * 0.3, 0.03, dt);
    b.arms[1].elbow.rotation.x = U.damp(b.arms[1].elbow.rotation.x,
      p._swing > 0 ? 0.6 - Math.max(0, w) * 0.55 : 0.15, 0.03, dt);

    // Der freie Arm geht gegen, das hält die Figur im Gleichgewicht.
    b.arms[0].shoulder.rotation.y = U.damp(b.arms[0].shoulder.rotation.y, seite * w * 0.5, 0.04, dt);
    // Schulterdrehung: die halbe Wucht kommt von hier. Sie sitzt im Torso und
    // nicht mehr in der Hüfte — sonst drehen die Beine beim Hieb mit.
    b.torso.rotation.y = U.damp(b.torso.rotation.y, -seite * w * 0.42, 0.03, dt);

    // Klinge kippt in die Hiebebene, dazu ein ruhiges Wiegen im Stand.
    const wiegen = Math.sin(p._walkPhase * 0.45) * 0.05;
    if (b.gun) {
      b.gun.rotation.x = -Math.PI / 2 + (p._swing > 0 ? 0.25 : wiegen * 0.6);
      b.gun.rotation.z = seite * w * 0.55 + wiegen;
    }
  }
})(window.ROR);
