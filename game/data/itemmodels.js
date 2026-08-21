/* game/data/itemmodels.js
   Wie ein Item am Körper aussieht.

   Das ist der Teil, der die Vorlage optisch ausmacht: wer eine Brechstange
   findet, trägt eine Brechstange auf dem Rücken. Wer drei findet, drei. Man
   sieht einer Figur nach zwanzig Minuten an, was sie geworden ist, ohne ins
   Menü zu schauen.

   Ein Eintrag beschreibt *ein* Stück:
     shape  bar · plate · cyl · cone · sphere · ring · shard · vial · box
     size   [breite, höhe, tiefe] in Metern
     at     back · shoulderL · shoulderR · chest · hip · head · orbit
     stack  row (nebeneinander) · fan (aufgefächert) · orbit (kreisend)
     rot    Grunddrehung in Radiant

   Nicht jedes Item braucht einen eigenen Eintrag — was hier fehlt, bekommt
   nach seiner Stufe eine schlichte Marke am Gürtel. Das hält die Tabelle
   lesbar und sorgt trotzdem dafür, dass *jedes* Item sichtbar ist. */
(function (ROR) {
  'use strict';

  const M = {

    /* ------------------------------------------------------- Gewöhnlich */

    syringe:        { shape: 'cyl',   size: [0.05, 0.30, 0.05], color: 0xd8e4ea, at: 'shoulderL', stack: 'fan', rot: [0.3, 0, 0.5] },
    goat_hoof:      { shape: 'cone',  size: [0.10, 0.16, 0.10], color: 0x5a4632, at: 'hip',       stack: 'row', rot: [Math.PI, 0, 0] },
    bison_steak:    { shape: 'plate', size: [0.22, 0.10, 0.16], color: 0xa8443a, at: 'hip',       stack: 'row' },
    glasses:        { shape: 'plate', size: [0.30, 0.09, 0.04], color: 0x9fe4ff, at: 'head',      stack: 'fan' },
    tougher_times:  { shape: 'ring',  size: [0.20, 0.05, 0.20], color: 0xc0c8d0, at: 'shoulderR', stack: 'row' },
    armor_plate:    { shape: 'plate', size: [0.26, 0.26, 0.05], color: 0x8a9098, at: 'back',      stack: 'row' },
    /* Die Brechstange: der Grund, warum es diese Tabelle gibt. */
    crowbar:        { shape: 'bar',   size: [0.05, 0.62, 0.05], color: 0xc4442e, at: 'back',      stack: 'fan', rot: [0, 0, 0.6] },
    armor_piercing: { shape: 'cyl',   size: [0.06, 0.20, 0.06], color: 0xd2b24a, at: 'hip',       stack: 'row' },
    focus_crystal:  { shape: 'shard', size: [0.13, 0.24, 0.13], color: 0x9a7fe0, at: 'back',      stack: 'fan' },
    delicate_watch: { shape: 'ring',  size: [0.13, 0.04, 0.13], color: 0xd8c070, at: 'shoulderL', stack: 'row' },
    energy_drink:   { shape: 'cyl',   size: [0.09, 0.20, 0.09], color: 0x5ad07a, at: 'hip',       stack: 'row' },
    shield_generator:{shape: 'ring',  size: [0.26, 0.06, 0.26], color: 0x7ec8ff, at: 'chest',     stack: 'fan' },
    medkit:         { shape: 'box',   size: [0.18, 0.14, 0.10], color: 0xe0e6ea, at: 'hip',       stack: 'row' },
    monster_tooth:  { shape: 'cone',  size: [0.09, 0.22, 0.09], color: 0xe8e0cc, at: 'chest',     stack: 'fan' },
    cautious_slug:  { shape: 'sphere',size: [0.15, 0.11, 0.20], color: 0x8fd07a, at: 'back',      stack: 'row' },
    bustling_fungus:{ shape: 'sphere',size: [0.17, 0.12, 0.17], color: 0xd8cfae, at: 'back',      stack: 'row' },
    topaz_brooch:   { shape: 'shard', size: [0.11, 0.16, 0.11], color: 0xf2c14e, at: 'chest',     stack: 'fan' },
    tri_tip_dagger: { shape: 'bar',   size: [0.04, 0.30, 0.08], color: 0xc0c8d0, at: 'hip',       stack: 'fan', rot: [0, 0, 0.25] },
    stun_grenade:   { shape: 'sphere',size: [0.13, 0.13, 0.13], color: 0xffe066, at: 'hip',       stack: 'row' },
    sticky_bomb:    { shape: 'sphere',size: [0.14, 0.14, 0.14], color: 0xffca70, at: 'back',      stack: 'row' },
    gasoline:       { shape: 'cyl',   size: [0.15, 0.26, 0.15], color: 0xff8030, at: 'back',      stack: 'row' },
    war_banner:     { shape: 'bar',   size: [0.04, 0.80, 0.04], color: 0xffd06a, at: 'back',      stack: 'fan', rot: [0, 0, -0.35] },
    rusted_key:     { shape: 'bar',   size: [0.05, 0.22, 0.05], color: 0xb08a3a, at: 'hip',       stack: 'fan' },

    /* ------------------------------------------------------ Ungewöhnlich */

    atg_missile:    { shape: 'cone',  size: [0.12, 0.34, 0.12], color: 0x6fd36f, at: 'back',      stack: 'row' },
    ukulele:        { shape: 'plate', size: [0.22, 0.34, 0.07], color: 0x8a6a3a, at: 'back',      stack: 'fan', rot: [0, 0, 0.4] },
    will_o_wisp:    { shape: 'sphere',size: [0.16, 0.16, 0.16], color: 0xff9a40, at: 'orbit',     stack: 'orbit' },
    hopoo_feather:  { shape: 'plate', size: [0.09, 0.34, 0.03], color: 0x9fe4ff, at: 'shoulderR', stack: 'fan', rot: [0, 0, 0.5] },
    red_whip:       { shape: 'cyl',   size: [0.05, 0.42, 0.05], color: 0xd04040, at: 'hip',       stack: 'fan', rot: [0.4, 0, 0] },
    leeching_seed:  { shape: 'sphere',size: [0.15, 0.19, 0.15], color: 0x8fd07a, at: 'back',      stack: 'row' },
    harvesters_scythe:{shape:'bar',   size: [0.05, 0.50, 0.12], color: 0xa8e0c0, at: 'back',      stack: 'fan', rot: [0, 0, -0.7] },
    predatory_instincts:{shape:'cone',size: [0.10, 0.20, 0.10], color: 0xc85a5a, at: 'shoulderR', stack: 'fan' },
    infusion:       { shape: 'vial',  size: [0.10, 0.22, 0.10], color: 0xff5a7a, at: 'chest',     stack: 'row' },
    chronobauble:   { shape: 'sphere',size: [0.17, 0.17, 0.17], color: 0x7ec8ff, at: 'orbit',     stack: 'orbit' },
    ignition_tank:  { shape: 'cyl',   size: [0.17, 0.34, 0.17], color: 0xff6a2a, at: 'back',      stack: 'row' },
    kjaros_band:    { shape: 'ring',  size: [0.17, 0.05, 0.17], color: 0xff7a20, at: 'shoulderL', stack: 'row' },
    razorwire:      { shape: 'ring',  size: [0.30, 0.06, 0.30], color: 0xb0b8c0, at: 'back',      stack: 'fan', rot: [0.4, 0, 0] },
    old_guillotine: { shape: 'plate', size: [0.26, 0.30, 0.04], color: 0xc0c8d0, at: 'back',      stack: 'fan', rot: [0, 0, 0.2] },
    death_mark:     { shape: 'shard', size: [0.12, 0.20, 0.12], color: 0xd070ff, at: 'chest',     stack: 'fan' },
    berzerkers_pauldron:{shape:'plate',size:[0.28, 0.20, 0.22], color: 0xff6a3a, at: 'shoulderL', stack: 'row' },
    ghors_tome:     { shape: 'box',   size: [0.20, 0.26, 0.08], color: 0xd8b04a, at: 'hip',       stack: 'row' },
    bandolier:      { shape: 'plate', size: [0.30, 0.09, 0.20], color: 0xb08a3a, at: 'chest',     stack: 'row', rot: [0, 0, 0.5] },
    fuel_cell:      { shape: 'cyl',   size: [0.11, 0.22, 0.11], color: 0xffd070, at: 'back',      stack: 'row' },
    lepton_daisy:   { shape: 'cone',  size: [0.16, 0.20, 0.16], color: 0xe8f0a0, at: 'shoulderR', stack: 'fan' },

    /* ----------------------------------------------------------- Legendär */

    behemoth:       { shape: 'shard', size: [0.20, 0.32, 0.20], color: 0xff8a4a, at: 'back',      stack: 'fan' },
    ceremonial_dagger:{shape:'bar',   size: [0.05, 0.36, 0.09], color: 0xb0e8ff, at: 'orbit',     stack: 'orbit' },
    meat_hook:      { shape: 'cone',  size: [0.13, 0.28, 0.13], color: 0xff8080, at: 'back',      stack: 'fan', rot: [Math.PI, 0, 0.4] },
    frost_relic:    { shape: 'shard', size: [0.18, 0.30, 0.18], color: 0xa8e8ff, at: 'orbit',     stack: 'orbit' },
    tesla_coil:     { shape: 'cyl',   size: [0.13, 0.42, 0.13], color: 0x9fe4ff, at: 'back',      stack: 'row' },
    nkuhana:        { shape: 'sphere',size: [0.20, 0.22, 0.20], color: 0xd8e8ff, at: 'shoulderL', stack: 'row' },
    alien_head:     { shape: 'sphere',size: [0.24, 0.28, 0.22], color: 0x9a7fe0, at: 'back',      stack: 'row' },
    rejuvenation_rack:{shape:'plate', size: [0.34, 0.26, 0.06], color: 0xffd0d8, at: 'back',      stack: 'row' },
    clover:         { shape: 'plate', size: [0.18, 0.18, 0.03], color: 0x6fd36f, at: 'chest',     stack: 'fan' },
    shattering_justice:{shape:'bar',  size: [0.07, 0.46, 0.07], color: 0xffa030, at: 'hip',       stack: 'fan', rot: [0, 0, 0.4] },
    dios:           { shape: 'sphere',size: [0.20, 0.24, 0.20], color: 0xf0e0c0, at: 'orbit',     stack: 'orbit' },
    h3ad5t:         { shape: 'box',   size: [0.28, 0.16, 0.34], color: 0xc0c8d0, at: 'hip',       stack: 'row' },

    /* --------------------------------------------------------------- Boss */

    titanic_knurl:  { shape: 'shard', size: [0.26, 0.34, 0.26], color: 0x8b8272, at: 'back',      stack: 'row' },
    planula:        { shape: 'sphere',size: [0.20, 0.20, 0.20], color: 0x6fd7c8, at: 'orbit',     stack: 'orbit' },
    shatterspleen:  { shape: 'sphere',size: [0.22, 0.24, 0.22], color: 0xd04040, at: 'chest',     stack: 'row' },
    molten_perforator:{shape:'cone',  size: [0.16, 0.34, 0.16], color: 0xff5a20, at: 'back',      stack: 'fan' },
    queens_gland:   { shape: 'sphere',size: [0.26, 0.22, 0.26], color: 0xa07a44, at: 'back',      stack: 'row' },

    /* -------------------------------------------------------------- Lunar */

    shaped_glass:   { shape: 'shard', size: [0.16, 0.34, 0.16], color: 0x9fd8ff, at: 'orbit',     stack: 'orbit' },
    transcendence:  { shape: 'ring',  size: [0.34, 0.06, 0.34], color: 0x7ec8ff, at: 'chest',     stack: 'fan' },
    brittle_crown:  { shape: 'ring',  size: [0.30, 0.14, 0.30], color: 0xf2c14e, at: 'head',      stack: 'row' },
    corpsebloom:    { shape: 'cone',  size: [0.20, 0.24, 0.20], color: 0xff7ab0, at: 'back',      stack: 'row' },
    gesture:        { shape: 'plate', size: [0.20, 0.24, 0.05], color: 0x7ec8ff, at: 'shoulderR', stack: 'row' }
  };

  /* Was nicht in der Tabelle steht — Schrott, Ausrüstung, Nachzügler —
     bekommt eine schlichte Marke in der Farbe seiner Stufe. */
  const NACH_STUFE = {
    common:    { shape: 'plate', size: [0.11, 0.15, 0.04], color: 0xdfe4e8, at: 'hip', stack: 'row' },
    uncommon:  { shape: 'plate', size: [0.12, 0.16, 0.04], color: 0x6fd36f, at: 'hip', stack: 'row' },
    legendary: { shape: 'plate', size: [0.13, 0.18, 0.04], color: 0xe2564a, at: 'back', stack: 'row' },
    boss:      { shape: 'plate', size: [0.14, 0.19, 0.05], color: 0xf2c14e, at: 'back', stack: 'row' },
    lunar:     { shape: 'shard', size: [0.13, 0.20, 0.13], color: 0x7ec8ff, at: 'orbit', stack: 'orbit' },
    equipment: { shape: 'box',   size: [0.20, 0.20, 0.20], color: 0xff8a3a, at: 'back', stack: 'row' }
  };

  ROR.Data.ItemModels = M;
  ROR.Data.itemModel = function (def) {
    return M[def.id] || NACH_STUFE[def.tier] || NACH_STUFE.common;
  };
})(window.ROR);
