/* game/entities/monster.js
   Gegnermodelle und Gegnerverhalten.

   Modelle: sechs Bauarten, aus denen alle Gegner entstehen. Je Gegnerart wird
   *einmal* eine Vorlage gebaut und danach nur noch geklont — ein Klon teilt
   sich Geometrie und Material mit der Vorlage, dreißig Beetles kosten also
   dreißig Klone und nicht dreißig Modellbauten.

   Verhalten: eine kleine Zustandsmaschine je Gegner. Kein Wegfindungsnetz —
   die Gegner laufen auf den Spieler zu und weichen aus, wenn sie hängen
   bleiben. Für ein Spiel, in dem alles auf den Spieler zuströmt, ist das
   genug; ein Netz würde die Stage-Erzeugung erheblich verteuern und in der
   Vorlage sieht man den Unterschied ohnehin kaum.

   Jeder Angriff hat einen sichtbaren Vorlauf (`windup`). Ohne den wäre
   Ausweichen Glückssache. */
(function (ROR) {
  'use strict';

  const U = ROR.Util;
  const GRAVITY = 27;

  const list = [];
  const _v = new THREE.Vector3();
  const _w = new THREE.Vector3();
  const _aim = new THREE.Vector3();

  /* Die Modelle selbst entstehen in entities/monstermodel.js — dort steht,
     woran man welche Art erkennt. Hier bleibt nur, was sich bewegt. */

  /* Vorlage je Gegnerart, danach nur noch klonen. */
  function template(def) {
    if (!def._template) {
      const g = ROR.MonsterModel.build(def);
      /* Jedes Modell wird auf seine Trefferzone eingepasst. Sonst müsste ich
         zwanzig Bauplänen von Hand die richtige Größe anmessen — und beim
         nächsten Formwechsel wieder. So kann ich am Bauplan die Proportionen
         ändern, ohne dass Modell und Trefferzone auseinanderlaufen. */
      const bb = new THREE.Box3().setFromObject(g);
      const hoch = bb.max.y - bb.min.y;
      if (hoch > 0.01) g.scale.setScalar(def.height / hoch);
      /* Die Einpassung sitzt auf einer inneren Gruppe, nicht auf der Wurzel:
         die Wurzel gehört dem Spawn-Effekt, der von 0.01 auf 1 hochskaliert. */
      const wurzel = new THREE.Group();
      wurzel.add(g);
      def._template = wurzel;
    }
    return def._template;
  }

  function collectParts(root) {
    const parts = {};
    root.traverse(function (o) {
      if (!o.userData || !o.userData.role) return;
      const r = o.userData.role;
      if (parts[r]) return;
      // Ein Klon teilt sich die Materialien mit der Vorlage. Für alles, was
      // je Exemplar pulsiert, braucht es deshalb ein eigenes.
      if (r === 'glow' && o.material) o.material = o.material.clone();
      parts[r] = o;
    });
    return parts;
  }

  /* ------------------------------------------------------------ Erzeugen */

  const Monsters = {
    list: list,
    /* Obergrenze. Die Vorlage kennt eine ähnliche; ohne sie würde der Director
       im Loop irgendwann hunderte Gegner gleichzeitig stellen. */
    cap: 34,

    spawn(def, level, position, affix) {
      if (list.length >= Monsters.cap) return null;

      let m0_huelle = null;
      const model = template(def).clone(true);
      model.position.copy(position);
      ROR.Engine.scene.add(model);

      const body = ROR.Body.create({
        def: def, level: level, team: ROR.Body.MONSTER,
        position: model.position, radius: def.radius, height: def.height,
        object: model
      });

      const m = {
        def: def, body: body, model: model, parts: collectParts(model),
        velocity: new THREE.Vector3(),
        grounded: false,
        facing: 0,
        state: 'chase',
        timer: 0,
        cooldown: U.chaos.range(0.3, 1.2),
        burstLeft: 0,
        blocked: 0,
        strafe: 0,
        walkPhase: U.chaos.range(0, 6.28),
        spawnFx: 1,          // wächst beim Erscheinen aus dem Nichts
        deathFx: 0,
        hoverOffset: U.chaos.range(-1.5, 1.5),
        affix: affix || null,
        huelle: null
      };

      body.isBoss = !!def.isBoss;

      /* Elite: derselbe Gegner, nur mit einer zusätzlichen Regel und einer
         Hülle, an der man ihn von weitem erkennt. */
      if (affix) {
        body.elite = affix;
        body.name = affix.name + ' ' + body.name;
        ROR.Stats.recompute(body);
        body.health = body.stats.maxHealth;
        if (affix.shieldInsteadOfHealth) {
          body.shield = body.stats.maxShield;
          body.health = body.stats.maxHealth;
        }
        const huelle = new THREE.Mesh(
          new THREE.IcosahedronGeometry(1, 1),
          new THREE.MeshBasicMaterial({ color: affix.glow, transparent: true, opacity: 0.17,
                                        depthWrite: false, side: THREE.BackSide,
                                        blending: THREE.AdditiveBlending })
        );
        huelle.scale.setScalar(Math.max(def.radius * 2.2, def.height * 0.75));
        huelle.position.y = def.height * 0.5;
        model.add(huelle);
        m0_huelle = huelle;
      }
      if (def.ai.attacks) {
        m.atkCd = {};
        for (let i = 0; i < def.ai.attacks.length; i++) {
          // Gestaffelt starten, sonst feuert ein Boss beim Erscheinen alles auf einmal.
          m.atkCd[def.ai.attacks[i].id] = U.chaos.range(0.5, 3);
        }
      }

      /* Evolution: Gegner sammeln mit jeder Stage ein weißes Item mehr. */
      const evo = ROR.Artifacts.monsterItems();
      if (evo > 0) {
        const pool = ROR.Items.ofTier('common');
        for (let i = 0; i < evo && pool.length; i++) {
          ROR.Items.give(body, U.chaos.pick(pool).id, 1);
        }
      }

      body.onDeath = function () {
        m.deathFx = 0.7;
        m.state = 'dead';
        // Gestohlenes kehrt zurück.
        if (m.gestohlen) {
          const p2 = ROR.Game.player;
          for (const id in m.gestohlen) ROR.Items.give(p2.body, id, m.gestohlen[id]);
          ROR.Attire.refresh(p2);
          ROR.HUD.toast('Your items are yours again', 'gold');
          m.gestohlen = null;
        }
        if (def.isFinal && ROR.Game.onVictory) ROR.Game.onVictory();
        if (m.affix && m.affix.onDeath) m.affix.onDeath(m);
        Monsters.reward(m);
        ROR.Artifacts.onMonsterDeath(m);
      };

      m.huelle = m0_huelle;
      model.scale.setScalar(0.01);
      ROR.Projectiles.spark(position, def.shape.colors.glow || def.shape.colors.eye || 0xffffff, 1.6);
      list.push(m);
      return m;
    },

    /* Erfahrung und Gold nach der Formel der Vorlage:
         xp   = coeff × monsterValue × rewardMultiplier
         gold = 2 × xp
       `rewardMultiplier` ist 0.2 für die laufenden Directors. */
    rewardMultiplier: 0.2,

    reward(m) {
      const p = ROR.Game && ROR.Game.player;
      if (!p) return;
      const aufschlag = m.affix ? m.affix.cost : 1;
      ROR.Game.kills++;
      ROR.Save.notiereGegner(m.def.id);
      const xp = ROR.Difficulty.coeff * (m.def.cost * aufschlag) * Monsters.rewardMultiplier;
      p.addExp(xp);
      p.gold += xp * 2;
      // Mondmünzen fallen selten — sie sind die Währung des Bazaars.
      if (U.chaos.next() < 0.012) {
        ROR.Game.lunarCoins++;
        ROR.Game.muenzenGesammelt++;
        ROR.HUD.toast('Lunar coin found', 'gold');
      }
    },

    /* Verbündeter aus einem Item (Queen's Gland). Er ist derselbe Gegner,
       nur im Team des Spielers — dadurch greift ihn der Rest von selbst an. */
    spawnAlly(defId, owner) {
      const def = ROR.Data.monster(defId);
      const stage = ROR.Stage.current;
      if (!def || !stage) return null;
      const spot = stage.terrain.findSpot(U.chaos, {
        rMin: 0, rMax: 6, tries: 20,
        minHeight: stage.terrain.seaLevel + 1
      }) || { x: owner.position.x + 3, y: owner.position.y, z: owner.position.z };
      const m = Monsters.spawn(def, ROR.Difficulty.spawnLevel,
        new THREE.Vector3(owner.position.x + (spot.x - owner.position.x) * 0.2 + 3,
                          owner.position.y + (def.flying ? def.hoverHeight : 0),
                          owner.position.z + 3));
      if (m) {
        m.body.team = ROR.Body.PLAYER;
        m.isAlly = true;
        m.body.onDeath = function () { m.deathFx = 0.7; m.state = 'dead'; };
        m.model.traverse(function (o) {
          if (o.isMesh && o.material && o.material.color) {
            o.material = o.material.clone();
            o.material.color.lerp(new THREE.Color(0x6fd0ff), 0.35);
          }
        });
      }
      return m;
    },

    clear() {
      for (let i = 0; i < list.length; i++) {
        ROR.Engine.scene.remove(list[i].model);
        list[i].body.remove();
      }
      list.length = 0;
    },

    update(dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        const m = list[i];

        /* Schlafende Gegner stehen still. Mithrix wartet so in seiner Arena,
           bis man sie betritt — er soll den Weg ueber die Bruecke nicht schon
           mit Angriffen begleiten. Die Todes- und Erscheinungsstufen laufen
           weiter, nur die KI ruht. */
        if (m.schlaeft && m.deathFx <= 0 && m.spawnFx <= 0) {
          animate(m, dt, 0);
          continue;
        }
        if (m.deathFx > 0) {
          m.deathFx -= dt;
          const k = Math.max(0, m.deathFx / 0.7);
          m.model.scale.setScalar(k * k);
          m.model.position.y -= dt * 1.4;
          if (m.deathFx <= 0) {
            ROR.Engine.scene.remove(m.model);
            m.body.remove();
            list.splice(i, 1);
          }
          continue;
        }
        if (m.spawnFx > 0) {
          m.spawnFx -= dt * 4;
          m.model.scale.setScalar(U.clamp(1 - m.spawnFx, 0.01, 1));
        }
        if (m.affix) {
          if (m.affix.onInterval) m.affix.onInterval(m, dt);
          if (m.huelle) {
            m.huelle.material.opacity = 0.13 + Math.sin(ROR.Engine.time * 3 + m.walkPhase) * 0.05;
          }
        }
        step(m, dt);
      }
    }
  };

  /* ------------------------------------------------------------ Verhalten */

  function step(m, dt) {
    const stage = ROR.Stage.current;
    /* Verbündete zielen auf den nächsten Gegner, alle anderen auf den Spieler.
       Sonst wäre ein Queen's-Gland-Käfer nur Dekoration. */
    const p = m.isAlly
      ? (ROR.Projectiles.nearestEnemy(m.model.position, 70, m.body.team) || ROR.Game.player)
      : ROR.Game.player;
    if (!stage || !p || !p.body || !p.body.alive) return;

    const def = m.def;
    const S = m.body.stats;
    const pos = m.model.position;
    const stunned = ROR.Buffs.has(m.body, 'stun');
    if (stunned && m.state === 'charge') m.state = 'chase';   // Ansturm bricht ab

    if (!p.velocity) p.velocity = { x: 0, y: 0, z: 0 };   // Bodies haben keine
    _v.set(p.position.x - pos.x, 0, p.position.z - pos.z);
    const flat = _v.length();
    const dist = Math.hypot(flat, p.position.y + 0.9 - (pos.y + def.height * 0.5));
    if (flat > 1e-4) _v.divideScalar(flat);

    m.cooldown -= dt;
    m.timer -= dt;

    /* --------------------------------------------------------- Angreifen */

    const ai = def.ai;
    if (m.state === 'windup') {
      if (m.timer <= 0) { doAttack(m, p); m.state = 'chase'; }
    } else if (!stunned && m.state === 'charge') {
      chargeMove(m, dt, stage);
      if (m.timer <= 0) { m.state = 'chase'; m.cooldown = ai.cooldown; }
      animate(m, dt, 3);
      return;
    } else if (!stunned && m.state === 'beam') {
      // Dauerstrahl: tickt, bis die Schüsse aufgebraucht sind.
      m.beamLeft -= dt;
      if (m.beamLeft <= 0) {
        m.beamLeft += m.attack.interval;
        m.beamTicks--;
        beamTick(m, p);
        if (m.beamTicks <= 0) { m.state = 'chase'; m.cooldown = 0.8; }
      }
      animate(m, dt, 0);
      return;
    } else if (!stunned && m.state === 'drain') {
      m.drainLeft -= dt;
      m.drainTick -= dt;
      if (m.drainTick <= 0) { m.drainTick += m.attack.interval; drainTick(m, p); }
      if (m.drainLeft <= 0) {
        m.state = 'chase'; m.cooldown = 1.2;
        m.body.def = m.def;                    // Rüstungsbonus wieder weg
        m.body.drainArmor = 0; m.body.statsDirty = true;
      }
      animate(m, dt, 0);
      return;
    } else if (!stunned && ai.kind === 'boss' && m.state !== 'windup') {
      for (const id in m.atkCd) m.atkCd[id] -= dt;
      if (m.cooldown <= 0 && canSee(m, p, dist)) {
        for (let i = 0; i < ai.attacks.length; i++) {
          const a = ai.attacks[i];
          if (m.atkCd[a.id] > 0 || dist > a.range) continue;
          if (a.belowHealth && m.body.healthFraction > a.belowHealth) continue;
          m.state = 'windup'; m.timer = a.windup; m.pending = 'boss'; m.attack = a;
          m.atkCd[a.id] = a.cooldown;
          break;
        }
      }
    } else if (!stunned && m.cooldown <= 0 && canSee(m, p, dist)) {
      let pending = null;
      if (ai.kind === 'charger') { if (dist <= ai.range) pending = 'charge'; }
      else if (ai.kind === 'suicide') { if (dist <= ai.range) pending = 'suicide'; }
      else if (ai.kind === 'melee') { if (dist <= ai.range) pending = 'melee'; }
      else if (ai.melee && dist <= ai.melee.range) pending = 'melee';
      else if (ai.shot && dist <= ai.range) pending = 'shot';
      if (pending) { m.state = 'windup'; m.timer = ai.windup; m.pending = pending; }
    }

    /* --------------------------------------------------------- Bewegen */

    if (!stunned && m.state !== 'windup') {
      let want = 0;
      if (ai.kind === 'turret') want = dist > ai.range ? 1 : 0;
      else if (ai.keep === undefined) want = 1;
      else if (dist > ai.keep * 1.15) want = 1;
      else if (dist < ai.keep * 0.75) want = -1;

      if (def.flying) flyMove(m, dt, want, stage, p);
      else groundMove(m, dt, want, stage);
    } else if (!def.flying) {
      m.velocity.x *= 0.85; m.velocity.z *= 0.85;
      groundMove(m, dt, 0, stage);
    }

    /* Berührungsschaden: der Wurm greift nicht an, er rennt einen um. */
    if (def.contact) {
      m._contactCd = (m._contactCd || 0) - dt;
      if (m._contactCd <= 0 && dist < m.body.radius + 2.2) {
        m._contactCd = def.contact.cooldown;
        ROR.Damage.deal({
          attacker: m.body, victim: p.body,
          coefficient: def.contact.coefficient, proc: def.contact.proc,
          position: p.position.clone().setY(p.position.y + 1.2)
        });
        if (def.contact.burn) {
          ROR.Buffs.applyDot(p.body, 'burn', m.body,
            m.body.stats.damage * def.contact.burn, 3);
        }
      }
    }

    // Immer zum Spieler schauen; das Modell blickt entlang -Z.
    if (flat > 0.3) m.facing = U.angleDamp(m.facing, Math.atan2(-_v.x, -_v.z), 0.08, dt);
    m.model.rotation.y = m.facing;

    animate(m, dt, Math.hypot(m.velocity.x, m.velocity.z) / Math.max(1, S.moveSpeed));
  }

  /* Sichtprüfung: durch Fels wird nicht geschossen. */
  function canSee(m, p, dist) {
    const stage = ROR.Stage.current;
    _w.set(m.model.position.x, m.model.position.y + m.def.height * 0.6, m.model.position.z);
    _aim.set(p.position.x - _w.x, p.position.y + 0.9 - _w.y, p.position.z - _w.z).normalize();
    return stage.clearance(_w, _aim, dist, 0.7) >= dist - 1.2;
  }

  function groundMove(m, dt, want, stage) {
    const S = m.body.stats;
    const pos = m.model.position;
    const speed = S.moveSpeed * want;

    if (want !== 0) {
      // Bleibt der Gegner hängen, weicht er kurz seitlich aus. Das ersetzt
      // eine Wegfindung und reicht, weil ohnehin alles zum Spieler strebt.
      const sx = m.strafe > 0 ? -_v.z : (m.strafe < 0 ? _v.z : 0);
      const sz = m.strafe > 0 ? _v.x : (m.strafe < 0 ? -_v.x : 0);
      const w = Math.abs(m.strafe) > 0 ? 0.75 : 0;
      m.velocity.x = U.approach(m.velocity.x, (_v.x * (1 - w) + sx * w) * speed, 40 * dt);
      m.velocity.z = U.approach(m.velocity.z, (_v.z * (1 - w) + sz * w) * speed, 40 * dt);
    } else {
      m.velocity.x *= 0.86; m.velocity.z *= 0.86;
    }

    m.velocity.y -= GRAVITY * dt;
    const before = pos.x + pos.z;
    const altX = pos.x, altZ = pos.z;
    pos.x += m.velocity.x * dt;
    pos.z += m.velocity.z * dt;
    // Gegner klettern ebenso wenig senkrechte Wände hoch wie der Spieler.
    stage.blockSteep(pos, altX, altZ, pos.y, 0.55);
    stage.pushOut(pos, m.body.radius, m.def.height, 0.7);
    pos.y += m.velocity.y * dt;

    const sup = stage.supportAt(pos.x, pos.z, pos.y, 0.7);
    if (m.velocity.y <= 0 && pos.y <= sup.y) {
      pos.y = sup.y; m.velocity.y = 0; m.grounded = true;
    } else m.grounded = false;

    // Ins Wasser gelaufen: der Gegner verschwindet, statt herumzustehen.
    if (pos.y < stage.terrain.seaLevel - 2) m.body.kill();

    const moved = Math.abs(pos.x + pos.z - before);
    if (want !== 0 && moved < Math.abs(speed) * dt * 0.35) {
      m.blocked += dt;
      if (m.blocked > 0.25 && m.strafe === 0) m.strafe = U.chaos.sign();
    } else {
      m.blocked = Math.max(0, m.blocked - dt);
      if (m.blocked <= 0) m.strafe = 0;
    }
  }

  function flyMove(m, dt, want, stage, p) {
    const S = m.body.stats;
    const pos = m.model.position;
    const targetY = Math.max(
      stage.terrain.heightAt(pos.x, pos.z) + 2.2,
      p.position.y + m.def.hoverHeight + m.hoverOffset
    );
    m.velocity.x = U.approach(m.velocity.x, _v.x * S.moveSpeed * want, 18 * dt);
    m.velocity.z = U.approach(m.velocity.z, _v.z * S.moveSpeed * want, 18 * dt);
    m.velocity.y = U.approach(m.velocity.y, U.clamp(targetY - pos.y, -6, 6), 14 * dt);
    pos.x += m.velocity.x * dt;
    pos.y += m.velocity.y * dt;
    pos.z += m.velocity.z * dt;
    stage.pushOut(pos, m.body.radius, m.def.height, 999);
    const floor = stage.terrain.heightAt(pos.x, pos.z) + 1.4;
    if (pos.y < floor) { pos.y = floor; m.velocity.y = Math.max(0, m.velocity.y); }
    m.grounded = false;
  }

  function chargeMove(m, dt, stage) {
    const pos = m.model.position;
    const ai = m.def.ai;
    pos.x += m.chargeDir.x * ai.chargeSpeed * dt;
    pos.z += m.chargeDir.z * ai.chargeSpeed * dt;
    m.velocity.y -= GRAVITY * dt;
    pos.y += m.velocity.y * dt;
    const sup = stage.supportAt(pos.x, pos.z, pos.y, 0.9);
    if (m.velocity.y <= 0 && pos.y <= sup.y) { pos.y = sup.y; m.velocity.y = 0; }
    const before = { x: pos.x, z: pos.z };
    stage.pushOut(pos, m.body.radius, m.def.height, 0.9);
    // Gegen einen Felsen gerannt: Ansturm endet.
    if (Math.hypot(pos.x - before.x, pos.z - before.z) > 0.05) m.timer = 0;

    const p = ROR.Game.player;
    const d = Math.hypot(p.position.x - pos.x, p.position.z - pos.z);
    if (!m.chargeHit && d < m.body.radius + 1.2) {
      m.chargeHit = true;
      ROR.Damage.deal({
        attacker: m.body, victim: p.body,
        coefficient: ai.coefficient, proc: ai.proc,
        position: p.position.clone().setY(p.position.y + 1.2)
      });
      m.timer = 0;
    }
  }

  function doAttack(m, p) {
    const ai = m.def.ai;
    const pos = m.model.position;
    const from = _w.set(pos.x, pos.y + m.def.height * 0.65, pos.z);
    m.cooldown = ai.cooldown || 1.2;

    if (m.pending === 'charge') {
      m.state = 'charge';
      m.timer = ai.chargeTime;
      m.chargeHit = false;
      m.chargeDir = new THREE.Vector3(p.position.x - pos.x, 0, p.position.z - pos.z).normalize();
      return;
    }

    if (m.pending === 'melee') {
      const spec = ai.melee || ai;
      if (Math.hypot(p.position.x - pos.x, p.position.z - pos.z) <= spec.range + 1) {
        ROR.Damage.deal({
          attacker: m.body, victim: p.body,
          coefficient: spec.coefficient, proc: spec.proc === undefined ? 1 : spec.proc,
          position: p.position.clone().setY(p.position.y + 1.2)
        });
      }
      if (ai.slam) {
        ROR.Damage.explode({
          attacker: m.body, team: m.body.team, position: pos,
          radius: ai.slam.radius, coefficient: ai.slam.coefficient, proc: ai.slam.proc
        });
        ROR.Projectiles.spark(pos, 0xffc98a, ai.slam.radius * 0.6);
      }
      m.cooldown = spec.cooldown || ai.cooldown;
      return;
    }

    if (m.pending === 'suicide') {
      ROR.Damage.explode({
        attacker: m.body, team: m.body.team, position: from,
        radius: ai.blast.radius, coefficient: ai.blast.coefficient, proc: ai.blast.proc
      });
      ROR.Projectiles.spark(from, m.def.shape.colors.glow, ai.blast.radius * 0.9);
      m.body.kill();
      return;
    }

    if (m.pending === 'boss') { bossAttack(m, p, from); return; }

    if (!ai.shot) return;

    // Vorhalten: auf die Stelle zielen, an der der Spieler sein wird.
    const lead = ai.shot.speed ? Math.hypot(p.position.x - pos.x, p.position.z - pos.z) / ai.shot.speed : 0;
    _aim.set(
      p.position.x + p.velocity.x * lead * 0.6 - from.x,
      p.position.y + 1.0 + (ai.shot.gravity ? ai.shot.gravity * lead * lead * 0.5 : 0) - from.y,
      p.position.z + p.velocity.z * lead * 0.6 - from.z
    ).normalize();

    const shots = ai.burst || 1;
    for (let i = 0; i < shots; i++) {
      const d = _aim.clone();
      if (shots > 1) {
        d.x += U.chaos.range(-0.05, 0.05);
        d.y += U.chaos.range(-0.03, 0.03);
        d.z += U.chaos.range(-0.05, 0.05);
        d.normalize();
      }
      if (ai.hitscan) {
        ROR.Projectiles.bullet({
          attacker: m.body, team: m.body.team, origin: from, dir: d,
          coefficient: ai.shot.coefficient, proc: ai.shot.proc, range: ai.range + 6,
          tracerColor: ai.shot.color, sparkColor: ai.shot.color
        });
      } else {
        ROR.Projectiles.spawn({
          attacker: m.body, team: m.body.team, origin: from, dir: d,
          speed: ai.shot.speed, life: 4, radius: ai.shot.radius,
          coefficient: ai.shot.coefficient, proc: ai.shot.proc,
          gravity: ai.shot.gravity || 0, color: ai.shot.color,
          explode: ai.shot.blast || null
        });
      }
    }
  }

  /* -------------------------------------------------------- Bossangriffe */

  function aimAt(m, p, from, out, gravity, speed) {
    const lead = speed ? Math.hypot(p.position.x - from.x, p.position.z - from.z) / speed : 0;
    return out.set(
      p.position.x + (p.velocity ? p.velocity.x : 0) * lead * 0.6 - from.x,
      p.position.y + 1.0 + (gravity ? gravity * lead * lead * 0.5 : 0) - from.y,
      p.position.z + (p.velocity ? p.velocity.z : 0) * lead * 0.6 - from.z
    ).normalize();
  }

  function bossAttack(m, p, from) {
    const a = m.attack;
    m.cooldown = 0.6;

    if (a.type === 'shot') {
      aimAt(m, p, from, _aim, a.shot.gravity, a.shot.speed);
      for (let i = 0; i < (a.burst || 1); i++) {
        const d = _aim.clone();
        if (a.spread) {
          d.x += U.chaos.range(-a.spread, a.spread);
          d.y += U.chaos.range(-a.spread * 0.6, a.spread * 0.6);
          d.z += U.chaos.range(-a.spread, a.spread);
          d.normalize();
        }
        ROR.Projectiles.spawn({
          attacker: m.body, team: m.body.team, origin: from, dir: d,
          speed: a.shot.speed, life: 6, radius: a.shot.radius,
          coefficient: a.shot.coefficient, proc: a.shot.proc,
          gravity: a.shot.gravity || 0, color: a.shot.color,
          homing: a.homing ? p.body : null, turn: 3,
          explode: a.shot.blast || null
        });
      }
      return;
    }

    if (a.type === 'slam') {
      // Am eigenen Ort (Supernova) oder dort, wo der Spieler stand.
      const ziel = a.atSelf ? m.model.position.clone()
                            : p.position.clone().setY(p.position.y + 1);
      ROR.Damage.explode({
        attacker: m.body, team: m.body.team, position: ziel,
        radius: a.radius, coefficient: a.coefficient, proc: a.proc
      });
      ROR.Projectiles.spark(ziel, a.color || 0xffc98a, a.radius * 0.6);
      return;
    }

    if (a.type === 'beam') {
      m.state = 'beam';
      m.beamTicks = a.ticks;
      m.beamLeft = a.interval;
      return;
    }

    if (a.type === 'summon_zone') {
      // Säulen um den Spieler herum: man muss sich bewegen.
      const p2 = ROR.Game.player;
      for (let i = 0; i < a.count; i++) {
        const w = (i / a.count) * U.TAU + U.chaos.next();
        const d2 = U.chaos.range(4, 14);
        const x = p2.position.x + Math.cos(w) * d2;
        const z = p2.position.z + Math.sin(w) * d2;
        ROR.Deployables.spawn('zone', m.body,
          new THREE.Vector3(x, ROR.Stage.current.terrain.heightAt(x, z), z),
          { radius: a.radius, life: a.life, interval: 0.4,
            coefficient: a.coefficient, proc: 0.2, color: 0xffd070 });
      }
      return;
    }

    if (a.type === 'steal') {
      /* Er nimmt dem Spieler alles ab und wird selbst stärker. Beim Tod
         gibt er es zurück — deshalb wird nur umgehängt, nicht gelöscht. */
      const p2 = ROR.Game.player;
      m.gestohlen = {};
      for (const id in p2.body.items) {
        const def = ROR.Items.def(id);
        if (!def || def.scrap) continue;
        m.gestohlen[id] = p2.body.items[id];
      }
      for (const id in m.gestohlen) {
        ROR.Items.take(p2.body, id, m.gestohlen[id]);
        ROR.Items.give(m.body, id, m.gestohlen[id]);
      }
      ROR.Attire.refresh(p2);
      ROR.HUD.toast('Mithrix hat deine Items genommen', 'bad');
      ROR.Projectiles.spark(at2(p2.position), 0xffd070, 6);
      return;
    }

    if (a.type === 'summon') {
      for (let i = 0; i < a.count; i++) {
        const def = ROR.Data.monster(a.monster);
        if (!def) continue;
        const ang = U.chaos.next() * U.TAU;
        const pos = m.model.position.clone();
        pos.x += Math.cos(ang) * 5; pos.z += Math.sin(ang) * 5;
        pos.y = ROR.Stage.current.terrain.heightAt(pos.x, pos.z);
        Monsters.spawn(def, m.body.level, pos);
      }
      return;
    }

    if (a.type === 'drain') {
      m.state = 'drain';
      m.drainLeft = a.duration;
      m.drainTick = a.interval;
      m.body.drainArmor = a.armorBonus;
      m.body.statsDirty = true;
      return;
    }
  }

  function at2(v) { return v.clone().setY(v.y + 1.2); }

  function beamTick(m, p) {
    const a = m.attack;
    _w.set(m.model.position.x, m.model.position.y + m.def.height * 0.72, m.model.position.z);
    aimAt(m, p, _w, _aim, 0, 0);
    ROR.Projectiles.bullet({
      attacker: m.body, team: m.body.team, origin: _w, dir: _aim,
      coefficient: a.coefficient, proc: a.proc, range: a.range + 10,
      tracerColor: a.color, sparkColor: a.color
    });
  }

  function drainTick(m, p) {
    const a = m.attack;
    const d = m.model.position.distanceTo(p.position);
    if (d > a.radius) return;
    const koeff = d < a.nearRadius ? a.nearCoefficient : a.coefficient;
    const r = ROR.Damage.deal({
      attacker: m.body, victim: p.body, coefficient: koeff, proc: 0,
      position: p.position.clone().setY(p.position.y + 1.2)
    });
    // Er heilt sich um genau das, was er nimmt.
    if (r && r.amount > 0) m.body.heal(r.amount);
    _w.set(m.model.position.x, m.model.position.y + m.def.height * 0.5, m.model.position.z);
    _aim.set(p.position.x - _w.x, p.position.y + 1 - _w.y, p.position.z - _w.z);
    const len = _aim.length();
    ROR.Projectiles.tracer(_w, _aim.divideScalar(len), len, 0xd9743c);
  }

  /* ----------------------------------------------------------- Animation */

  function animate(m, dt, stride) {
    const parts = m.parts;
    m.walkPhase += dt * (4 + stride * 7);
    const sw = Math.sin(m.walkPhase) * U.clamp(stride, 0, 1.2);

    /* Bis zu sechs Beine: Insekten setzen ihre Beine im Dreieck, deshalb die
       Verschiebung um ein Drittel statt nur vor und zurück. */
    for (let i = 0; i < 6; i++) {
      const leg = parts['leg' + i];
      if (!leg) continue;
      const phase = m.walkPhase + (i % 2) * Math.PI + (i >> 1) * 2.09;
      leg.rotation.x = Math.sin(phase) * U.clamp(stride, 0, 1.2) * 0.6;
    }
    // Fangfäden und Tentakel schwingen träge nach.
    for (let i = 0; i < 8; i++) {
      const t = parts['tendril' + i];
      if (!t) continue;
      t.rotation.x = Math.sin(m.walkPhase * 0.7 + i) * 0.22;
      t.rotation.z = Math.cos(m.walkPhase * 0.6 + i * 1.3) * 0.22;
    }
    if (parts.tail) parts.tail.rotation.y = Math.sin(m.walkPhase * 0.6) * 0.35;
    if (parts.wing0) { parts.wing0.rotation.z = Math.sin(m.walkPhase * 4) * 0.5; }
    if (parts.wing1) { parts.wing1.rotation.z = -Math.sin(m.walkPhase * 4) * 0.5; }
    if (parts.ring) parts.ring.rotation.y += dt * 1.4;

    // Wurmglieder laufen phasenverschoben — daraus wird die Welle.
    if (m.def.shape.kind === 'worm') {
      for (let i = 0; i < m.def.shape.segments; i++) {
        const seg = parts['seg' + i];
        if (!seg) continue;
        seg.rotation.y = Math.sin(m.walkPhase * 1.6 - i * 0.55) * 0.34;
        seg.rotation.x = Math.sin(m.walkPhase * 1.2 - i * 0.4) * 0.16;
      }
    }

    if (m.def.flying && parts.core) {
      parts.core.position.y = (m.def.shape.size || 1) * 1.6 + Math.sin(m.walkPhase * 0.8) * 0.18;
    }

    /* Der Vorlauf muss sichtbar sein — daran erkennt man, wann auszuweichen
       ist. Das Modell reckt sich, das Leuchten schwillt an. */
    const wind = m.state === 'windup' && m.timer > 0
      ? 1 - U.clamp(m.timer / (m.def.ai.windup || 0.5), 0, 1) : 0;
    if (parts.core) parts.core.scale.set(1 + wind * 0.14, 1 - wind * 0.1, 1 + wind * 0.14);
    if (parts.head) parts.head.rotation.x = -wind * 0.35;
    if (parts.glow) {
      const hit = m.body.hitFlash / 0.12;
      parts.glow.scale.setScalar(1 + wind * 1.1 + hit * 0.5);
      parts.glow.material.opacity = 0.6 + wind * 0.4;
    }
    if (m.body.hitFlash > 0 && parts.core) {
      const k = m.body.hitFlash / 0.12;
      parts.core.position.z = Math.sin(k * 30) * 0.05;
    } else if (parts.core) parts.core.position.z = 0;
  }

  /* Der Rüstungsbonus während „Recover" läuft über die Wertekette, damit die
     Schadensformel unverändert bleibt. */
  ROR.Stats.addModifier(function (body, out) {
    if (body.drainArmor) out.armor += body.drainArmor;
    if (body.dashArmor) out.armor += body.dashArmor;
    const e = body.elite;
    if (!e) return;
    out.maxHealth *= e.health;
    out.damage *= e.damage;
    /* Overloading trägt sein Leben als Schild: dieselbe Menge, aber sie lädt
       sich wieder auf, wenn man ihn in Ruhe lässt. */
    if (e.shieldInsteadOfHealth) {
      out.maxShield += out.maxHealth * 0.5;
      out.maxHealth *= 0.5;
    }
  });

  /* Trefferwirkung der Affixe — hängt am Angreifer, gilt daher für jede
     Gegnerart, ohne dass eine davon etwas davon wissen muss. */
  ROR.Damage.addOnHit(function (info, result, proc) {
    const a = info.attacker;
    if (!a || !a.elite || !a.elite.onHit || proc <= 0 || !result.amount) return;
    const m = { body: a, model: { position: a.position }, def: a.def };
    a.elite.onHit(m, info.victim);
  });

  ROR.Monsters = Monsters;
})(window.ROR);
