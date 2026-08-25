/* game/fx/charfx.js
   Effekte, die an der Figur hängen: Nachbilder, Ringe, Staub, Aura.

   Warum eine eigene Datei und nicht `projectile.js`: die Effekte dort gehören
   zu einem Geschoss und leben, solange es fliegt. Was hier steht, gehört zum
   *Körper* — es entsteht aus Bewegung und Zustand, nicht aus einem Treffer.

   Das Herzstück sind die **Nachbilder**. Ein Dash ohne Spur liest sich als
   Ruckler: die Figur ist plötzlich woanders, und das Auge hat nichts, woran es
   die Strecke festmachen kann. Ein Nachbild löst das, aber nur, wenn es die
   *Haltung* von damals zeigt — eine Kapsel an der alten Stelle wirkt wie ein
   Fehler im Bild.

   Deshalb wird je Figur einmal ein zweiter, durchscheinender Bausatz erzeugt
   (dieselbe `SurvivorModel.build`, andere Materialien) und beim Auslösen die
   Haltung der lebenden Figur hineinkopiert. Kopiert wird nur, was sich
   überhaupt bewegt — Hüfte, Nacken, vier Armglieder, vier Beinglieder, zwei
   Waffen. Alles andere sitzt fest und ist im Bausatz schon richtig.

   Ein voller `traverse`-Abgleich wäre einfacher, ginge aber kaputt, sobald
   `attire.js` Items an die lebende Figur hängt: dann hat sie mehr Knoten als
   der Bausatz, die Reihenfolge verschiebt sich und die Nachbilder verrenken
   sich. */
(function (ROR) {
  'use strict';

  const U = ROR.Util;

  const GHOSTS = 7;        // reicht für den längsten Dash im Spiel
  const RINGE = 20;
  const STAUB = 40;

  let gruppe = null;
  let ghosts = [];         // { model, mat, life, maxLife }
  let ghostDef = null;     // für welche Figur der Bausatz gilt
  let ringe = [], ringNext = 0;
  let staub = [], staubNext = 0;

  const _v = new THREE.Vector3();

  /* --------------------------------------------------------- Nachbilder */

  /* Die bewegten Glieder einer Figur, in fester Reihenfolge. Quelle und
     Nachbild liefern dieselbe Liste, also lässt sich Haltung stumpf
     durchkopieren. */
  function glieder(m) {
    const out = [m.hips, m.torso, m.neck, m.head];
    for (let i = 0; i < m.arms.length; i++) out.push(m.arms[i].shoulder, m.arms[i].elbow);
    for (let i = 0; i < m.legs.length; i++) out.push(m.legs[i].hip, m.legs[i].knee);
    if (m.gun) out.push(m.gun);
    if (m.gunOff) out.push(m.gunOff);
    return out;
  }

  function baueGhosts(def) {
    loescheGhosts();
    ghostDef = def.id;
    for (let i = 0; i < GHOSTS; i++) {
      const m = ROR.SurvivorModel.build(def);
      const mat = new THREE.MeshBasicMaterial({
        color: def.colors.visor,
        transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      m.root.traverse(function (o) {
        if (!o.isMesh) return;
        o.material = mat;
        o.castShadow = false;
        o.receiveShadow = false;
      });
      m.root.visible = false;
      gruppe.add(m.root);
      ghosts.push({ model: m, mat: mat, glieder: glieder(m), life: 0, maxLife: 1 });
    }
  }

  function loescheGhosts() {
    for (let i = 0; i < ghosts.length; i++) {
      const wurzel = ghosts[i].model.root;
      if (gruppe) gruppe.remove(wurzel);
      /* Auch die Geometrien freigeben. Ein Nachbildsatz sind sieben volle
         Figuren mit je rund sechzig eigenen Meshes — würde bei jedem
         Stagewechsel nur das Material weggeworfen, sammelten sich über einen
         Durchlauf durch fünf Stages und den Loop ein paar tausend
         Puffer im Grafikspeicher an. */
      wurzel.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
      ghosts[i].mat.dispose();
    }
    ghosts = [];
    ghostDef = null;
  }

  /* ------------------------------------------------------------- Pools */

  function ringPool() {
    /* Ein flacher Ring, der aufgeht und dünner wird. Die Geometrie liegt in
       der XY-Ebene; gedreht wird beim Auslösen. */
    const geo = new THREE.RingGeometry(0.72, 1, 24, 1);
    for (let i = 0; i < RINGE; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0, depthWrite: false,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending
      }));
      m.visible = false;
      m.frustumCulled = false;
      gruppe.add(m);
      ringe.push({ mesh: m, life: 0, maxLife: 1, von: 1, bis: 2 });
    }
  }

  function staubPool() {
    const geo = new THREE.IcosahedronGeometry(1, 0);
    for (let i = 0; i < STAUB; i++) {
      const m = new THREE.Mesh(geo, ROR.Toon.material({
        color: 0xbfae92, transparent: true, opacity: 0
      }));
      m.visible = false;
      m.frustumCulled = false;
      gruppe.add(m);
      staub.push({ mesh: m, life: 0, maxLife: 1, vel: new THREE.Vector3(), groesse: 0.2 });
    }
  }

  /* --------------------------------------------------------------- API */

  const CharFX = {
    init() {
      CharFX.clear();
      gruppe = new THREE.Group();
      gruppe.name = 'charfx';
      ROR.Engine.scene.add(gruppe);
      ringPool();
      staubPool();
    },

    clear() {
      loescheGhosts();
      if (gruppe) {
        ROR.Engine.scene.remove(gruppe);
        gruppe.traverse(function (o) {
          if (o.geometry) o.geometry.dispose();
          if (o.material) o.material.dispose();
        });
      }
      gruppe = null;
      ringe = []; staub = [];
    },

    /* Wird beim Figurwechsel gerufen.

       Gebaut wird hier *nicht* — nur der alte Satz weggeräumt. Sieben
       Figurmodelle kosten spürbar Zeit, und wer mit Engineer spielt, löst nie
       ein Nachbild aus. Der Satz entsteht deshalb erst beim ersten Dash. */
    setSurvivor(def) {
      if (!gruppe) CharFX.init();
      if (ghostDef && ghostDef !== def.id) loescheGhosts();
    },

    /* Ein Nachbild in der Haltung des Augenblicks. `staerke` steuert, wie
       kräftig es anfängt, `dauer`, wie lange es steht. */
    nachbild(player, staerke, dauer) {
      if (!gruppe) return;
      if (ghostDef !== player.def.id || !ghosts.length) baueGhosts(player.def);
      // Das älteste Nachbild wird überschrieben — bei einem Dash entsteht so
      // eine Kette, deren Anfang schon verblasst, während das Ende noch kommt.
      let g = null, aeltest = Infinity;
      for (let i = 0; i < ghosts.length; i++) {
        if (ghosts[i].life <= 0) { g = ghosts[i]; break; }
        if (ghosts[i].life < aeltest) { aeltest = ghosts[i].life; g = ghosts[i]; }
      }
      if (!g) return;

      const q = glieder(player.model);
      for (let i = 0; i < g.glieder.length && i < q.length; i++) {
        g.glieder[i].position.copy(q[i].position);
        g.glieder[i].quaternion.copy(q[i].quaternion);
        g.glieder[i].scale.copy(q[i].scale);
      }
      g.model.root.position.copy(player.model.root.position);
      g.model.root.quaternion.copy(player.model.root.quaternion);
      g.model.root.scale.copy(player.model.root.scale);
      g.model.root.visible = true;
      g.maxLife = dauer || 0.34;
      g.life = g.maxLife;
      g.staerke = staerke === undefined ? 0.5 : staerke;
      g.mat.opacity = g.staerke;
    },

    /* Ring auf dem Boden (Landung, Einschlag) oder frei im Raum. `achse`
       gibt die Flächennormale; ohne sie liegt der Ring waagerecht. */
    ring(pos, farbe, vonR, bisR, dauer, achse) {
      if (!gruppe) return;
      const r = ringe[ringNext = (ringNext + 1) % ringe.length];
      r.mesh.position.copy(pos);
      if (achse) r.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), achse);
      else r.mesh.rotation.set(-Math.PI / 2, 0, 0);
      r.mesh.material.color.setHex(farbe);
      r.mesh.visible = true;
      r.von = vonR; r.bis = bisR;
      r.maxLife = dauer || 0.35;
      r.life = r.maxLife;
      r.mesh.scale.setScalar(vonR);
      r.mesh.material.opacity = 0.85;
    },

    /* Staubfahne: ein paar Brocken, die vom Boden wegfliegen. Für Landungen,
       Sprints und alles, was den Boden berührt. */
    staub(pos, anzahl, wucht, farbe) {
      if (!gruppe) return;
      for (let i = 0; i < anzahl; i++) {
        const s = staub[staubNext = (staubNext + 1) % staub.length];
        s.mesh.position.copy(pos);
        const a = U.chaos.next() * U.TAU;
        const auf = 1.2 + U.chaos.next() * 2.4;
        s.vel.set(Math.cos(a) * wucht, auf, Math.sin(a) * wucht);
        s.groesse = 0.08 + U.chaos.next() * 0.13;
        s.mesh.material.color.setHex(farbe === undefined ? 0xbfae92 : farbe);
        s.mesh.material.opacity = 0.8;
        s.mesh.scale.setScalar(s.groesse);
        s.mesh.visible = true;
        s.maxLife = 0.45 + U.chaos.next() * 0.3;
        s.life = s.maxLife;
      }
    },

    update(dt) {
      if (!gruppe) return;

      for (let i = 0; i < ghosts.length; i++) {
        const g = ghosts[i];
        if (g.life <= 0) continue;
        g.life -= dt;
        const k = Math.max(0, g.life / g.maxLife);
        // Quadratisch ausblenden: das Nachbild verschwindet früh und schnell,
        // sonst steht ein Geisterheer hinter der Figur.
        g.mat.opacity = k * k * g.staerke;
        if (g.life <= 0) g.model.root.visible = false;
      }

      for (let i = 0; i < ringe.length; i++) {
        const r = ringe[i];
        if (r.life <= 0) continue;
        r.life -= dt;
        const t = 1 - Math.max(0, r.life / r.maxLife);
        r.mesh.scale.setScalar(U.lerp(r.von, r.bis, U.smoothstep(0, 1, t)));
        r.mesh.material.opacity = (1 - t) * 0.85;
        if (r.life <= 0) r.mesh.visible = false;
      }

      for (let i = 0; i < staub.length; i++) {
        const s = staub[i];
        if (s.life <= 0) continue;
        s.life -= dt;
        s.vel.y -= 14 * dt;
        s.mesh.position.addScaledVector(s.vel, dt);
        const k = Math.max(0, s.life / s.maxLife);
        s.mesh.material.opacity = k * 0.8;
        s.mesh.scale.setScalar(s.groesse * (0.5 + k * 0.5));
        s.mesh.rotation.x += dt * 4;
        s.mesh.rotation.z += dt * 3;
        if (s.life <= 0) s.mesh.visible = false;
      }
    }
  };

  ROR.CharFX = CharFX;
})(window.ROR);
