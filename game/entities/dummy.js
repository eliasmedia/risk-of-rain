/* game/entities/dummy.js
   Trainingspuppe: ein Body ohne Verstand.

   Drei Stück mit 0, 20 und 100 Rüstung stehen am Start. Sie sind kein
   Beiwerk, sondern die Messstrecke: dieselbe Kugel muss auf ihnen 100 %,
   83 % und 50 % Schaden anzeigen. Damit ist die Rüstungsformel im Spiel
   selbst ablesbar und nicht nur im Quelltext behauptet. */
(function (ROR) {
  'use strict';

  const U = ROR.Util;
  const list = [];

  function makeDef(armor) {
    return {
      id: 'dummy', name: 'Trainingspuppe', growth: 'ratio',
      health: 800, damage: 0, regen: 0, armor: armor, moveSpeed: 0
    };
  }

  function buildModel(color) {
    const g = new THREE.Group();
    const mat = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });

    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 1.1, 6), mat(0x5a4a35));
    post.position.y = 0.55; post.castShadow = true; g.add(post);

    const bag = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.25, 8), mat(color));
    bag.position.y = 1.72; bag.castShadow = true; g.add(bag);

    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.53, 0.53, 0.16, 8), mat(0xd9d3c4));
    band.position.y = 1.72; g.add(band);

    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), mat(color));
    head.position.y = 2.55; head.castShadow = true; g.add(head);

    return g;
  }

  ROR.Dummy = {
    list: list,

    create(position, armor, color) {
      const model = buildModel(color);
      model.position.copy(position);
      ROR.Engine.scene.add(model);

      const body = ROR.Body.create({
        def: makeDef(armor), level: 1, team: ROR.Body.MONSTER,
        position: model.position, radius: 0.55, height: 2.85, object: model
      });
      body.isDummy = true;

      const d = { body: body, model: model, respawn: 0, armor: armor };
      body.onDeath = function () { d.respawn = 2; model.visible = false; };
      list.push(d);
      return d;
    },

    /* Stellt drei Puppen in Sichtweite des Startpunkts auf. */
    placeNear(stage, spawn) {
      const setup = [[0, 0xb98c5a], [20, 0x7f9ab5], [100, 0x9c7fb5]];
      const rng = U.Rng(stage.seed ^ 0xd0d0);
      for (let i = 0; i < setup.length; i++) {
        const a = -0.7 + i * 0.7;
        for (let tries = 0; tries < 40; tries++) {
          const dist = 9 + tries * 0.6;
          const x = spawn.x + Math.cos(a) * dist, z = spawn.z + Math.sin(a) * dist;
          if (!stage.terrain.isWalkable(x, z, 0.22)) continue;
          ROR.Dummy.create(new THREE.Vector3(x, stage.terrain.heightAt(x, z), z),
                           setup[i][0], setup[i][1]);
          break;
        }
      }
    },

    update(dt) {
      for (let i = 0; i < list.length; i++) {
        const d = list[i];
        if (d.body.alive) {
          // Treffer sichtbar quittieren: kurz einsinken.
          const k = d.body.hitFlash / 0.12;
          d.model.scale.set(1 + k * 0.09, 1 - k * 0.12, 1 + k * 0.09);
          // Voll auffüllen, sobald drei Sekunden nicht mehr getroffen wurde.
          // Eine laufende Regeneration würde jede Schadensmessung verfälschen —
          // genau das, wofür die Puppe da ist.
          if (d.body.outOfCombat > 3) d.body.health = d.body.stats.maxHealth;
          continue;
        }
        d.respawn -= dt;
        if (d.respawn <= 0) {
          d.body.alive = true;
          d.body.health = d.body.stats.maxHealth;
          d.model.visible = true;
          if (ROR.Body.all.indexOf(d.body) < 0) ROR.Body.all.push(d.body);
        }
      }
    },

    clear() { list.length = 0; }
  };
})(window.ROR);
