/* game/data/items.js
   Die Items. Werte und Wirkungen stammen aus dem Wiki der Vorlage.

   Ein Item ist ein Objekt mit Hooks; welcher wann gerufen wird, steht in
   sim/items.js. Kein Kampfcode kennt ein einzelnes Item — deshalb ist ein
   neues Item ein Eintrag hier und sonst nichts.

     stats(body, out, n)              verändert Endwerte
     damageMod(body, n, info, ziel)   Faktor je Treffer, wenn er vom Ziel abhängt
     onHit(body, n, info, res, proc)  nach jedem direkten Treffer
     onKill / onKilled / onDamaged / onHealed / onLevelUp / onStageStart
     onInterval(body, n, dt)          jeden Simulationsschritt

   `proc` ist der Proc-Coefficient des auslösenden Treffers. Jede Chance wird
   mit ihm multipliziert — sonst löste eine Schrotladung aus acht Kugeln
   achtmal so oft aus wie ein einzelner Schuss.

   Die Stapelart steht bei jedem Item dabei, weil sie den Unterschied macht:
   Tougher Times nähert sich hyperbolisch der 100 %, Alien Head multipliziert,
   Soldier's Syringe addiert einfach.                                        */
(function (ROR) {
  'use strict';

  const U = ROR.Util;
  const I = () => ROR.Items;
  const V = new THREE.Vector3();
  const V2 = new THREE.Vector3();

  function at(body, out) {
    return (out || V).set(body.position.x, body.position.y + body.height * 0.5, body.position.z);
  }

  /* Direkter Schaden aus einem Item. Proc ist fast immer klein oder null —
     sonst würden Items einander endlos gegenseitig auslösen. */
  function hit(attacker, victim, coefficient, proc, crit) {
    return ROR.Damage.deal({
      attacker: attacker, victim: victim, coefficient: coefficient,
      proc: proc === undefined ? 0 : proc, crit: crit,
      position: at(victim, V2).clone()
    });
  }

  function boom(attacker, position, radius, coefficient, proc, color) {
    ROR.Damage.explode({
      attacker: attacker, team: attacker.team, position: position,
      radius: radius, coefficient: coefficient, proc: proc === undefined ? 0 : proc
    });
    ROR.Projectiles.spark(position, color === undefined ? 0xffb060 : color, radius * 0.55);
  }

  /* Zielsuchendes Geschoss aus einem Item. */
  function seek(attacker, target, opts) {
    if (!target) return;
    at(attacker, V);
    V2.set(target.position.x - V.x, target.position.y + target.height * 0.5 - V.y,
           target.position.z - V.z).normalize();
    ROR.Projectiles.spawn({
      attacker: attacker, team: attacker.team, origin: V, dir: V2,
      speed: opts.speed || 45, life: opts.life || 4, radius: opts.radius || 0.3,
      coefficient: opts.coefficient, proc: opts.proc === undefined ? 0 : opts.proc,
      color: opts.color, homing: target, turn: opts.turn || 8,
      explode: opts.explode || null
    });
  }

  const TIER = { common: 'common', uncommon: 'uncommon', legendary: 'legendary',
                 boss: 'boss', lunar: 'lunar', equipment: 'equipment' };

  ROR.Data.Items = [

  /* ==================================================================== */
  /*  Gewöhnlich (weiß)                                                    */
  /* ==================================================================== */

  { id: 'syringe', name: "Soldier's Syringe", tier: TIER.common, stack: 'linear',
    desc: '+15 % attack speed per stack.',
    stats(b, o, n) { o.attackSpeed *= 1 + 0.15 * n; } },

  { id: 'goat_hoof', name: "Paul's Goat Hoof", tier: TIER.common, stack: 'linear',
    desc: '+14 % movement speed per stack.',
    stats(b, o, n) { o.moveSpeed *= 1 + 0.14 * n; } },

  { id: 'bison_steak', name: 'Bison Steak', tier: TIER.common, stack: 'linear',
    desc: '+25 maximum health per stack.',
    stats(b, o, n) { o.maxHealth += 25 * n; } },

  { id: 'glasses', name: "Lens-Maker's Glasses", tier: TIER.common, stack: 'linear',
    desc: '+10 % critical strike chance per stack.',
    stats(b, o, n) { o.crit += 10 * n; } },

  /* Achtung, eine Falle der Vorlage: der Tooltip nennt „15 %", die tatsächliche
     Blockchance beim ersten Stapel ist aber 1 − 1/(1 + 0.15) = 13.0 %. Die 15
     sind der Eingabewert der hyperbolischen Umrechnung, nicht das Ergebnis.
     Wer hier 0.15 direkt als Chance einsetzte, hätte ein leicht zu starkes
     Item — und bei fünf Stapeln plötzlich 75 % statt 42.9 %. */
  { id: 'tougher_times', name: 'Tougher Times', tier: TIER.common, stack: 'hyperbolisch',
    desc: '15 % chance to block damage (13 % in practice at one stack). Approaches 100 %.',
    onIncoming(b, n, info, st) {
      if (I().roll(b, I().hyperbolic(0.15, n))) st.blocked = true;
    } },

  { id: 'armor_plate', name: 'Repulsion Armor Plate', tier: TIER.common, stack: 'linear',
    desc: 'Reduces every incoming hit by 5, down to a minimum of 1.',
    onIncoming(b, n, info, st) { st.amount = Math.max(1, st.amount - 5 * n); } },

  { id: 'crowbar', name: 'Crowbar', tier: TIER.common, stack: 'linear',
    desc: '+75 % damage against enemies above 90 % health.',
    damageMod(b, n, info, ziel) {
      return ziel.healthFraction >= 0.9 ? 1 + 0.75 + 0.5 * (n - 1) : 1;
    } },

  { id: 'armor_piercing', name: 'Armor-Piercing Rounds', tier: TIER.common, stack: 'linear',
    desc: '+20 % damage against bosses per stack.',
    damageMod(b, n, info, ziel) {
      return ziel.def.category === 'champion' || ziel.isBoss ? 1 + 0.2 * n : 1;
    } },

  { id: 'focus_crystal', name: 'Focus Crystal', tier: TIER.common, stack: 'linear',
    desc: '+20 % damage against enemies within 13 m.',
    damageMod(b, n, info, ziel) {
      const d = U.dist2(b.position.x, b.position.z, ziel.position.x, ziel.position.z);
      return d < 169 ? 1 + 0.2 * n : 1;
    } },

  { id: 'delicate_watch', name: 'Delicate Watch', tier: TIER.common, stack: 'linear',
    desc: '+20 % damage. Shatters below 25 % health.',
    stats(b, o, n) { if (!b._watchBroken) o.damage *= 1 + 0.2 * n; },
    onDamaged(b, n) {
      if (!b._watchBroken && b.healthFraction < 0.25) {
        b._watchBroken = true; b.statsDirty = true;
        ROR.HUD && ROR.HUD.toast('Delicate Watch zerbrochen', 'bad');
      }
    } },

  { id: 'energy_drink', name: 'Energy Drink', tier: TIER.common, stack: 'linear',
    desc: '+25 % sprint speed per stack.',
    stats(b, o, n) { if (ROR.Buffs.has(b, 'sprinting')) o.moveSpeed *= 1 + 0.25 * n; } },

  { id: 'shield_generator', name: 'Personal Shield Generator', tier: TIER.common, stack: 'linear',
    desc: 'Shield worth 8 % of maximum health per stack.',
    stats(b, o, n) { o.maxShield += o.maxHealth * 0.08 * n; } },

  { id: 'medkit', name: 'Medkit', tier: TIER.common, stack: 'linear',
    desc: 'Two seconds after taking a hit: heals 20 plus 5 % of maximum health.',
    onDamaged(b, n) { b._medkit = 2; },
    onInterval(b, n, dt) {
      if (b._medkit === undefined) return;
      b._medkit -= dt;
      if (b._medkit <= 0) {
        b._medkit = undefined;
        I().heal(b, 20 + b.stats.maxHealth * 0.05 * n);
      }
    } },

  { id: 'monster_tooth', name: 'Monster Tooth', tier: TIER.common, stack: 'linear',
    desc: 'Slain enemies drop a healing orb worth 8 plus 2 % of maximum health.',
    onKill(b, n) { I().heal(b, 8 + b.stats.maxHealth * 0.02 * n); } },

  { id: 'cautious_slug', name: 'Cautious Slug', tier: TIER.common, stack: 'linear',
    desc: '+3 regeneration per second while you have not been hit for seven seconds.',
    stats(b, o, n) { if (b.outOfCombat > 7) o.regen += 3 * n; } },

  { id: 'bustling_fungus', name: 'Bustling Fungus', tier: TIER.common, stack: 'linear',
    desc: 'Standing still for two seconds heals 4.5 % of maximum health per second.',
    onInterval(b, n, dt) {
      const p = ROR.Game.player;
      const still = b.team === ROR.Body.PLAYER
        ? Math.hypot(p.velocity.x, p.velocity.z) < 0.6 : true;
      b._fungus = still ? (b._fungus || 0) + dt : 0;
      if (b._fungus > 2) I().heal(b, b.stats.maxHealth * (0.045 + 0.0225 * (n - 1)) * dt);
    } },

  { id: 'topaz_brooch', name: 'Topaz Brooch', tier: TIER.common, stack: 'linear',
    desc: 'Slain enemies grant 15 barrier per stack.',
    onKill(b, n) { b.barrier = Math.min(b.stats.maxHealth, b.barrier + 15 * n); } },

  { id: 'tri_tip_dagger', name: 'Tri-Tip Dagger', tier: TIER.common, stack: 'linear',
    desc: '10 % chance to cause bleeding: 240 % damage over three seconds.',
    onHit(b, n, info, res, proc) {
      if (!I().roll(b, 0.10 * n * proc)) return;
      ROR.Buffs.applyDot(info.victim, 'bleed', b, b.stats.damage * 2.4, 3);
    } },

  { id: 'stun_grenade', name: 'Stun Grenade', tier: TIER.common, stack: 'hyperbolisch',
    desc: '5 % chance to stun an enemy for two seconds.',
    onHit(b, n, info, res, proc) {
      if (!I().roll(b, I().hyperbolic(0.05, n) * proc)) return;
      ROR.Buffs.apply(info.victim, 'stun', 2);
    } },

  { id: 'sticky_bomb', name: 'Sticky Bomb', tier: TIER.common, stack: 'linear',
    desc: '5 % chance to attach a sticky bomb for 180 % damage.',
    onHit(b, n, info, res, proc) {
      if (!I().roll(b, 0.05 * n * proc)) return;
      boom(b, at(info.victim, V2).clone(), 4.5, 1.8, 0, 0xffca70);
    } },

  { id: 'gasoline', name: 'Gasoline', tier: TIER.common, stack: 'linear',
    desc: 'Slain enemies ignite everything within 12 m for 150 % damage.',
    onKill(b, n, info) {
      const r = 12 + 4 * (n - 1);
      const list = ROR.Projectiles.enemiesInRange(info.victim.position, r, b.team);
      const tank = 1 + 3 * (b.items.ignition_tank || 0);
      for (let i = 0; i < list.length; i++) {
        ROR.Buffs.applyDot(list[i], 'burn', b, b.stats.damage * (1.5 + 0.75 * (n - 1)) * tank, 2);
      }
      ROR.Projectiles.spark(at(info.victim, V2), 0xff8030, r * 0.4);
    } },

  { id: 'war_banner', name: 'Warbanner', tier: TIER.common, stack: 'linear',
    desc: 'On level up: a banner granting +30 % attack and movement speed for 25 s.',
    onLevelUp(b, n) { ROR.Buffs.apply(b, 'warbanner', 25); } },

  /* Schrott. Tut nichts — außer dass 3D-Drucker ihn zuerst verbrauchen.
     Damit lässt sich ein unerwünschtes Item über den Scrapper in etwas
     Nützliches umwandeln, ohne ein gutes zu opfern. */
  { id: 'scrap_white', name: 'Item Scrap, White', tier: TIER.common, stack: 'keine',
    noDrop: true, scrap: true, desc: 'Does nothing. Printers consume it first.' },

  { id: 'rusted_key', name: 'Rusted Key', tier: TIER.common, stack: 'linear',
    desc: 'A hidden cache opens at the start of every stage.',
    onStageStart(b, n) {
      for (let i = 0; i < n; i++) ROR.Loot.grantRandom(b, ROR.Loot.KEY_TABLE);
    } },

  /* ==================================================================== */
  /*  Ungewöhnlich (grün)                                                  */
  /* ==================================================================== */

  { id: 'scrap_green', name: 'Item Scrap, Green', tier: TIER.uncommon, stack: 'keine',
    noDrop: true, scrap: true, desc: 'Does nothing. Printers consume it first.' },

  { id: 'atg_missile', name: 'AtG Missile Mk. 1', tier: TIER.uncommon, stack: 'linear',
    desc: '10 % chance to fire a missile for 300 % damage.',
    onHit(b, n, info, res, proc) {
      if (!I().roll(b, 0.10 * proc)) return;
      seek(b, info.victim, { coefficient: 3 * n, speed: 50, color: 0xffd070,
                             explode: { radius: 3, coefficient: 0, proc: 0 } });
    } },

  { id: 'ukulele', name: 'Ukulele', tier: TIER.uncommon, stack: 'linear',
    desc: '25 % chance to chain lightning to 3 enemies for 80 % damage.',
    onHit(b, n, info, res, proc) {
      if (!I().roll(b, 0.25 * proc)) return;
      const targets = ROR.Projectiles.enemiesInRange(info.victim.position, 20, b.team, 3 + 2 * (n - 1));
      for (let i = 0; i < targets.length; i++) {
        if (targets[i] === info.victim) continue;
        hit(b, targets[i], 0.8, 0.2);
        ROR.Projectiles.tracer(at(info.victim, V), V2.set(
          targets[i].position.x - V.x, targets[i].position.y + 1 - V.y,
          targets[i].position.z - V.z).normalize(), at(info.victim, V).distanceTo(targets[i].position), 0x9fe4ff);
      }
    } },

  { id: 'will_o_wisp', name: "Will-o'-the-wisp", tier: TIER.uncommon, stack: 'linear',
    desc: 'Slain enemies explode for 350 % damage within 12 m.',
    onKill(b, n, info) {
      boom(b, at(info.victim, V2).clone(), 12 + 2.4 * (n - 1), 3.5 + 2.8 * (n - 1), 0, 0xff9a40);
    } },

  { id: 'hopoo_feather', name: 'Hopoo Feather', tier: TIER.uncommon, stack: 'linear',
    desc: '+1 extra jump per stack.',
    stats(b, o, n) { o.jumpCount += n; } },

  { id: 'red_whip', name: 'Red Whip', tier: TIER.uncommon, stack: 'linear',
    desc: '+30 % movement speed out of combat, per stack.',
    stats(b, o, n) { if (b.outOfCombat > 3) o.moveSpeed *= 1 + 0.3 * n; } },

  { id: 'leeching_seed', name: 'Leeching Seed', tier: TIER.uncommon, stack: 'linear',
    desc: 'Damage dealt heals 1 health per stack.',
    onHit(b, n) { I().heal(b, 1 * n); } },

  { id: 'harvesters_scythe', name: "Harvester's Scythe", tier: TIER.uncommon, stack: 'linear',
    desc: '+5 % critical chance. Critical strikes heal 8 (+4) health.',
    stats(b, o, n) { o.crit += 5; },
    onHit(b, n, info, res) { if (res.crit) I().heal(b, 8 + 4 * (n - 1)); } },

  { id: 'predatory_instincts', name: 'Predatory Instincts', tier: TIER.uncommon, stack: 'linear',
    desc: '+5 % critical chance. Critical strikes raise attack speed.',
    stats(b, o, n) { o.crit += 5; },
    onHit(b, n, info, res) { if (res.crit) ROR.Buffs.apply(b, 'predatory', 3); } },

  { id: 'infusion', name: 'Infusion', tier: TIER.uncommon, stack: 'linear',
    desc: 'Every kill permanently grants +1 maximum health, up to 100.',
    stats(b, o, n) { o.maxHealth += Math.min(100 * n, b._infusion || 0); },
    onKill(b, n) {
      b._infusion = Math.min(100 * n, (b._infusion || 0) + n);
      b.statsDirty = true;
    } },

  { id: 'chronobauble', name: 'Chronobauble', tier: TIER.uncommon, stack: 'linear',
    desc: 'Hits slow enemies by 60 % for 2 s per stack.',
    onHit(b, n, info, res, proc) {
      if (proc <= 0) return;
      ROR.Buffs.apply(info.victim, 'slow60', 2 * n);
    } },

  { id: 'ignition_tank', name: 'Ignition Tank', tier: TIER.uncommon, stack: 'linear',
    desc: 'Burn damage is 300 % stronger per stack.',
    /* Wirkt beim Anlegen der Brandmarke, siehe Gasoline und Kjaro's Band. */
    stats() {} },

  { id: 'kjaros_band', name: "Kjaro's Band", tier: TIER.uncommon, stack: 'linear',
    desc: 'Large hits spawn a fire tornado for 300 % damage.',
    onHit(b, n, info, res, proc) {
      if (proc < 1 || res.amount < b.stats.damage * 3.5) return;
      if (!I().roll(b, 0.08 * proc)) return;
      const tank = 1 + 3 * (b.items.ignition_tank || 0);
      boom(b, at(info.victim, V2).clone(), 6, (3 * n) * tank, 0, 0xff7a20);
    } },

  { id: 'razorwire', name: 'Razorwire', tier: TIER.uncommon, stack: 'linear',
    desc: 'Hits fling razor wire: 160 % damage to up to 5 enemies.',
    onDamaged(b, n) {
      const list = ROR.Projectiles.enemiesInRange(b.position, 25 + 10 * (n - 1), b.team, 5 + 2 * (n - 1));
      for (let i = 0; i < list.length; i++) hit(b, list[i], 1.6 + 0.8 * (n - 1), 0);
    } },

  { id: 'old_guillotine', name: 'Old Guillotine', tier: TIER.uncommon, stack: 'hyperbolisch',
    desc: 'Instantly kills elite enemies below 13 % health.',
    onHit(b, n, info) {
      const v = info.victim;
      if (v.def.category === 'basic') return;
      if (v.healthFraction < I().hyperbolic(0.13, n)) v.kill();
    } },

  { id: 'death_mark', name: 'Death Mark', tier: TIER.uncommon, stack: 'linear',
    desc: 'Enemies with four debuffs take 50 % more damage.',
    onHit(b, n, info) {
      const v = info.victim;
      const marks = v.buffs.length + (v.dots ? v.dots.length : 0);
      if (marks >= 4) ROR.Buffs.apply(v, 'death_mark', 7 + 3 * (n - 1));
    } },

  { id: 'berzerkers_pauldron', name: "Berzerker's Pauldron", tier: TIER.uncommon, stack: 'linear',
    desc: 'Four kills in one second send you into a frenzy.',
    onKill(b, n) {
      const t = ROR.Engine.time;
      if (t - (b._frenzyWindow || -9) > 1) { b._frenzyWindow = t; b._frenzyKills = 0; }
      if (++b._frenzyKills >= 4) {
        b._frenzyKills = 0;
        ROR.Buffs.apply(b, 'frenzy', 6 + 2 * (n - 1));
      }
    } },

  { id: 'ghors_tome', name: "Ghor's Tome", tier: TIER.uncommon, stack: 'linear',
    desc: '4 % chance per kill for a treasure worth 25 gold.',
    onKill(b, n) {
      if (!I().roll(b, 0.04 * n)) return;
      ROR.Game.player.gold += 25 * ROR.Difficulty.coeff;
      ROR.HUD && ROR.HUD.toast('+ Schatz', 'gold');
    } },

  { id: 'bandolier', name: 'Bandolier', tier: TIER.uncommon, stack: 'hyperbolisch',
    desc: '18 % chance per kill to reset all cooldowns.',
    onKill(b, n) {
      if (!I().roll(b, I().hyperbolic(0.18, n))) return;
      const p = ROR.Game.player;
      for (const slot in p.skills) {
        const st = p.skills[slot];
        st.charges = st.maxCharges; st.cooldown = 0;
      }
      ROR.HUD && ROR.HUD.toast('Nachschub', 'gold');
    } },

  { id: 'fuel_cell', name: 'Fuel Cell', tier: TIER.uncommon, stack: 'linear',
    desc: '+1 equipment charge, cooldown −15 % per stack.',
    onPickup(b) { I().refreshEquipment(b); } },

  { id: 'lepton_daisy', name: 'Lepton Daisy', tier: TIER.uncommon, stack: 'linear',
    desc: 'A healing wave worth 50 % of maximum health, once per stage.',
    onStageStart(b, n) { b._daisy = n; },
    onDamaged(b, n) {
      if (!b._daisy || b.healthFraction > 0.25) return;
      b._daisy--;
      I().heal(b, b.stats.maxHealth * 0.5);
      ROR.HUD && ROR.HUD.toast('Lepton Daisy');
    } },

  /* ==================================================================== */
  /*  Legendär (rot)                                                       */
  /* ==================================================================== */

  { id: 'scrap_red', name: 'Item Scrap, Red', tier: TIER.legendary, stack: 'keine',
    noDrop: true, scrap: true, desc: 'Does nothing. Printers consume it first.' },

  { id: 'behemoth', name: 'Brilliant Behemoth', tier: TIER.legendary, stack: 'linear',
    desc: 'All attacks explode within 4 m for an extra 60 % damage.',
    onHit(b, n, info, res, proc) {
      if (proc <= 0) return;
      boom(b, at(info.victim, V2).clone(), 4 + 2.5 * (n - 1), 0.6, 0, 0xffd0a0);
    } },

  { id: 'ceremonial_dagger', name: 'Ceremonial Dagger', tier: TIER.legendary, stack: 'linear',
    desc: 'Slain enemies release three homing daggers for 150 % damage each.',
    onKill(b, n, info) {
      const targets = ROR.Projectiles.enemiesInRange(info.victim.position, 60, b.team, 3);
      for (let i = 0; i < 3; i++) {
        seek(b, targets[i % Math.max(1, targets.length)] || null,
             { coefficient: 1.5 * n, proc: 1, speed: 34, color: 0xb0e8ff, turn: 10 });
      }
    } },

  { id: 'meat_hook', name: 'Sentient Meat Hook', tier: TIER.legendary, stack: 'hyperbolisch',
    desc: '20 % chance to hook up to 10 enemies for 100 % damage.',
    onHit(b, n, info, res, proc) {
      if (!I().roll(b, I().hyperbolic(0.2, n) * proc)) return;
      const list = ROR.Projectiles.enemiesInRange(info.victim.position, 30, b.team, 10 + 5 * (n - 1));
      for (let i = 0; i < list.length; i++) seek(b, list[i], { coefficient: 1, proc: 0.33, speed: 40, color: 0xff8080 });
    } },

  { id: 'frost_relic', name: 'Frost Relic', tier: TIER.legendary, stack: 'linear',
    desc: 'Slain enemies call an ice storm: 300 % damage every 0.25 s, growing with every kill.',
    onKill(b, n) {
      b._frostTime = 5;
      b._frostRadius = Math.min(18 + 12 * (n - 1), (b._frostRadius || 8) + 2);
    },
    onInterval(b, n, dt) {
      if (!b._frostTime) return;
      b._frostTime -= dt;
      if (b._frostTime <= 0) { b._frostTime = 0; b._frostRadius = 8; return; }
      b._frostTick = (b._frostTick || 0) - dt;
      if (b._frostTick > 0) return;
      b._frostTick = 0.25;
      const list = ROR.Projectiles.enemiesInRange(b.position, b._frostRadius || 8, b.team);
      for (let i = 0; i < list.length; i++) {
        hit(b, list[i], 3, 0.2, false);
        ROR.Buffs.apply(list[i], 'slow60', 1.5);
      }
      ROR.Projectiles.spark(at(b, V2), 0xa8e8ff, (b._frostRadius || 8) * 0.25);
    } },

  { id: 'tesla_coil', name: 'Unstable Tesla Coil', tier: TIER.legendary, stack: 'linear',
    desc: 'Ten seconds on, ten off: lightning strikes 3 enemies for 200 % damage every 0.5 s.',
    onInterval(b, n, dt) {
      b._tesla = (b._tesla || 0) + dt;
      const on = (b._tesla % 20) < 10;
      if (!on) return;
      b._teslaTick = (b._teslaTick || 0) - dt;
      if (b._teslaTick > 0) return;
      b._teslaTick = 0.5;
      const list = ROR.Projectiles.enemiesInRange(b.position, 35, b.team, 3 + 2 * (n - 1));
      at(b, V);
      for (let i = 0; i < list.length; i++) {
        hit(b, list[i], 2, 0.3);
        const t = at(list[i], V2);
        ROR.Projectiles.tracer(V, V2.clone().sub(V).normalize(), V.distanceTo(t), 0x9fe4ff);
      }
    } },

  { id: 'nkuhana', name: "N'kuhana's Opinion", tier: TIER.legendary, stack: 'linear',
    desc: 'Stores 100 % of all healing. At 10 % of maximum health it launches a skull for 250 %.',
    onHealed(b, n, amount) { b._soul = (b._soul || 0) + amount * n; },
    onInterval(b, n, dt) {
      if (!b._soul) return;
      const schwelle = b.stats.maxHealth * 0.1;
      if (b._soul < schwelle) return;
      b._skullTick = (b._skullTick || 0) - dt;
      if (b._skullTick > 0) return;
      b._skullTick = 0.1;
      const ziel = ROR.Projectiles.nearestEnemy(b.position, 90, b.team);
      if (!ziel) return;
      const schaden = b._soul * 2.5;
      b._soul = 0;
      at(b, V);
      V2.set(ziel.position.x - V.x, ziel.position.y + 1 - V.y, ziel.position.z - V.z).normalize();
      // Der Schädel trägt *festen* Schaden aus der gespeicherten Heilung,
      // nicht ein Vielfaches des Angriffsschadens.
      ROR.Projectiles.spawn({ attacker: b, team: b.team, origin: V, dir: V2,
        speed: 38, life: 4, radius: 0.45, flat: schaden,
        proc: 0.2, color: 0xd8e8ff, homing: ziel, turn: 9 });
    } },

  { id: 'alien_head', name: 'Alien Head', tier: TIER.legendary, stack: 'multiplikativ',
    desc: 'Cooldowns −25 % per stack, multiplicative.',
    stats(b, o, n) { o.cooldownScale *= Math.pow(0.75, n); } },

  { id: 'rejuvenation_rack', name: 'Rejuvenation Rack', tier: TIER.legendary, stack: 'linear',
    desc: 'All healing is 100 % stronger per stack.',
    stats(b, o, n) { o.healMult = (o.healMult || 1) * (1 + n); } },

  { id: 'clover', name: '57 Leaf Clover', tier: TIER.legendary, stack: 'linear',
    desc: 'Every random effect gets one extra roll per stack.',
    stats() {} },

  { id: 'shattering_justice', name: 'Shattering Justice', tier: TIER.legendary, stack: 'linear',
    desc: 'After five hits an enemy loses 60 armor for 8 s.',
    onHit(b, n, info, res, proc) {
      if (proc <= 0) return;
      const v = info.victim;
      v._justice = (v._justice || 0) + 1;
      if (v._justice >= 5) { v._justice = 0; ROR.Buffs.apply(v, 'armor_break', 8 * n); }
    } },

  { id: 'dios', name: "Dio's Best Friend", tier: TIER.legendary, stack: 'linear',
    desc: 'Prevents death once per stack and grants three seconds of invulnerability.',
    onKilled(b, n) {
      if (!b.items.dios) return;
      I().take(b, 'dios', 1);
      b.alive = true;
      b.health = b.stats.maxHealth;
      b.invulnerable = 3;
      ROR.HUD && ROR.HUD.toast('Dio hat dich gerettet');
    } },

  { id: 'h3ad5t', name: 'H3AD-5T v2', tier: TIER.legendary, stack: 'linear',
    desc: '+100 % jump height. Landing slams for 1000 % damage.',
    stats(b, o, n) { o.jumpPower = (o.jumpPower || 1) * (1 + n); } },

  /* ==================================================================== */
  /*  Boss (gelb)                                                          */
  /* ==================================================================== */

  { id: 'titanic_knurl', name: 'Titanic Knurl', tier: TIER.boss, stack: 'linear',
    desc: '+40 maximum health and +1.6 regeneration per second, per stack.',
    stats(b, o, n) { o.maxHealth += 40 * n; o.regen += 1.6 * n * (1 + 0.2 * (b.level - 1)); } },

  { id: 'planula', name: 'Planula', tier: TIER.boss, stack: 'linear',
    desc: 'Every hit you take heals 4 health per stack.',
    onDamaged(b, n) { I().heal(b, 4 * n); } },

  { id: 'shatterspleen', name: 'Shatterspleen', tier: TIER.boss, stack: 'linear',
    desc: 'Critical strikes cause bleeding. Bleeding enemies burst on death.',
    onHit(b, n, info, res, proc) {
      if (!res.crit || proc <= 0) return;
      ROR.Buffs.applyDot(info.victim, 'bleed', b, b.stats.damage * 2.4, 3);
    },
    onKill(b, n, info) {
      if (!ROR.Buffs.hasDot(info.victim, 'bleed')) return;
      boom(b, at(info.victim, V2).clone(), 6 + 2 * (n - 1),
           info.victim.stats.maxHealth * 0.15 / Math.max(1, b.stats.damage), 0, 0xff4040);
    } },

  { id: 'molten_perforator', name: 'Molten Perforator', tier: TIER.boss, stack: 'linear',
    desc: '10 % chance to call three magma orbs for 300 % damage each.',
    onHit(b, n, info, res, proc) {
      if (!I().roll(b, 0.10 * proc)) return;
      const ziel = info.victim;
      for (let i = 0; i < 3; i++) {
        boom(b, at(ziel, V2).clone().add(new THREE.Vector3(U.chaos.range(-3, 3), 0, U.chaos.range(-3, 3))),
             4, 3 * n, 0, 0xff5a20);
      }
    } },

  { id: 'queens_gland', name: "Queen's Gland", tier: TIER.boss, stack: 'linear',
    desc: 'Summons a friendly Beetle Guard at the start of every stage.',
    onStageStart(b, n) {
      for (let i = 0; i < n; i++) ROR.Monsters.spawnAlly('beetle_guard', b);
    } },

  /* ==================================================================== */
  /*  Lunar (blau) — immer mit Nachteil                                    */
  /* ==================================================================== */

  { id: 'shaped_glass', name: 'Shaped Glass', tier: TIER.lunar, stack: 'exponentiell',
    desc: 'Double damage, half health. Both scale exponentially.',
    stats(b, o, n) { o.damage *= Math.pow(2, n); o.maxHealth *= Math.pow(0.5, n); } },

  { id: 'transcendence', name: 'Transcendence', tier: TIER.lunar, stack: 'linear',
    desc: 'All but 1 health becomes regenerating shield. +50 % maximum health.',
    stats(b, o, n) {
      o.maxHealth *= 1 + 0.5 + 0.25 * (n - 1);
      o.maxShield += o.maxHealth - 1;
      o.maxHealth = 1;
    } },

  { id: 'brittle_crown', name: 'Brittle Crown', tier: TIER.lunar, stack: 'linear',
    desc: '30 % chance for gold on every hit — but every hit you take costs gold.',
    onHit(b, n, info, res, proc) {
      if (!I().roll(b, 0.30 * proc)) return;
      ROR.Game.player.gold += (3 * n) * ROR.Difficulty.coeff;
    },
    onDamaged(b, n, info, res) {
      const p = ROR.Game.player;
      p.gold = Math.max(0, p.gold - res.amount * 2);
    } },

  { id: 'corpsebloom', name: 'Corpsebloom', tier: TIER.lunar, stack: 'linear',
    desc: '+100 % healing, but at most 10 % of maximum health per second.',
    stats(b, o, n) { o.healMult = (o.healMult || 1) * (1 + n); o.healCap = 0.1 / n; } },

  { id: 'gesture', name: 'Gesture of the Drowned', tier: TIER.lunar, stack: 'linear',
    desc: 'Equipment recharges twice as fast — but fires on its own.',
    onPickup(b) { I().refreshEquipment(b); } },

  /* ==================================================================== */
  /*  Ausrüstung (orange) — aktiv, mit eigener Abklingzeit                 */
  /* ==================================================================== */

  { id: 'foreign_fruit', name: 'Foreign Fruit', tier: TIER.equipment, cooldown: 45,
    desc: 'Instantly heals 50 % of maximum health.',
    use(b) { I().heal(b, b.stats.maxHealth * 0.5); ROR.Projectiles.spark(at(b, V2), 0x8fff9f, 2.5); } },

  { id: 'missile_launcher', name: 'Disposable Missile Launcher', tier: TIER.equipment, cooldown: 45,
    desc: 'Fires twelve missiles for 300 % damage each.',
    use(b) {
      const list = ROR.Projectiles.enemiesInRange(b.position, 90, b.team, 12);
      for (let i = 0; i < 12; i++) {
        const ziel = list[i % Math.max(1, list.length)];
        if (ziel) seek(b, ziel, { coefficient: 3, proc: 1, speed: 45, color: 0xffb060,
                                  explode: { radius: 4, coefficient: 0, proc: 0 } });
      }
    } },

  { id: 'royal_capacitor', name: 'Royal Capacitor', tier: TIER.equipment, cooldown: 20,
    desc: 'Calls down lightning for 3000 % damage and stuns.',
    use(b) {
      const ziel = ROR.Projectiles.nearestEnemy(b.position, 120, b.team);
      if (!ziel) return;
      boom(b, at(ziel, V2).clone(), 8, 30, 1, 0xa0e0ff);
      ROR.Buffs.apply(ziel, 'stun', 3);
    } },

  { id: 'ocular_hud', name: 'Ocular HUD', tier: TIER.equipment, cooldown: 45,
    desc: 'Every shot is a critical strike for eight seconds.',
    use(b) { ROR.Buffs.apply(b, 'ocular', 8); } },

  { id: 'preon', name: 'Preon Accumulator', tier: TIER.equipment, cooldown: 140,
    desc: 'Hurls an orb that detonates for 4000 % damage within 20 m.',
    use(b) {
      ROR.Camera.aim(V2);
      at(b, V);
      ROR.Projectiles.spawn({ attacker: b, team: b.team, origin: V, dir: V2,
        speed: 22, life: 6, radius: 1.1, coefficient: 0, proc: 0, color: 0xc0a0ff,
        explode: { radius: 20, coefficient: 40, proc: 0 } });
    } },

  { id: 'chrysalis', name: 'Milky Chrysalis', tier: TIER.equipment, cooldown: 60,
    desc: 'Fifteen seconds of flight.',
    use(b) { ROR.Game.player.beginFlight(15); } },

  { id: 'primordial_cube', name: 'Primordial Cube', tier: TIER.equipment, cooldown: 45,
    desc: 'Pulls everything within 15 m together and holds it.',
    use(b) {
      const ziel = ROR.Projectiles.nearestEnemy(b.position, 60, b.team);
      if (!ziel) return;
      const mitte = at(ziel, V2).clone();
      const nah = ROR.Projectiles.enemiesInRange(mitte, 15, b.team, 20);
      for (let i = 0; i < nah.length; i++) {
        ROR.Buffs.apply(nah[i], 'stun', 4);
        // Zusammenziehen: sie stehen danach dicht beieinander.
        nah[i].position.lerp(mitte, 0.55);
        hit(b, nah[i], 1.0, 0.2);
      }
      ROR.Projectiles.spark(mitte, 0xb0a0ff, 6);
    } },

  { id: 'crowdfunder', name: 'The Crowdfunder', tier: TIER.equipment, cooldown: 5,
    desc: 'Fires as long as you have gold — every shot costs.',
    use(b) {
      const p = ROR.Game.player;
      const schuesse = Math.min(40, Math.floor(p.gold / (2 * ROR.Difficulty.coeff)));
      if (schuesse < 1) { ROR.HUD.toast('No gold', 'bad'); return; }
      p.gold -= schuesse * 2 * ROR.Difficulty.coeff;
      ROR.Camera.aim(V2);
      at(b, V);
      for (let i = 0; i < schuesse; i++) {
        ROR.Game.player.after(i * 0.05, function () {
          ROR.Camera.aim(V2); at(b, V);
          ROR.Projectiles.bullet({
            attacker: b, team: b.team, origin: V.clone(), dir: V2.clone(),
            coefficient: 1.0, proc: 0.4, falloff: 'standard', range: 90, spread: 0.07,
            tracerColor: 0xf2c14e
          });
        });
      }
    } },

  { id: 'gnarled_woodsprite', name: 'Gnarled Woodsprite', tier: TIER.equipment, cooldown: 20,
    desc: 'Heals 1.5 % of maximum health per second for twenty seconds.',
    use(b) { ROR.Buffs.apply(b, 'woodsprite', 20); } },

  { id: 'jade_elephant', name: 'Jade Elephant', tier: TIER.equipment, cooldown: 45,
    desc: '+500 armor for five seconds.',
    use(b) { ROR.Buffs.apply(b, 'jade', 5); } },

  { id: 'blast_shower', name: 'Blast Shower', tier: TIER.equipment, cooldown: 25,
    desc: 'Removes all debuffs and knocks enemies back.',
    use(b) {
      b.buffs.length = 0;
      if (b.dots) b.dots.length = 0;
      b.statsDirty = true;
      ROR.Damage.explode({ attacker: b, team: b.team, position: at(b, V2).clone(),
                           radius: 12, coefficient: 1.0, proc: 0 });
      ROR.Projectiles.spark(at(b, V2), 0xbfe8ff, 5);
    } }

  ];

  ROR.Data.item = function (id) {
    const l = ROR.Data.Items;
    for (let i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  };
})(window.ROR);
