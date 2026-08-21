/* game/entities/attire.js
   Items am Körper — und der Weg dorthin.

   Zwei Dinge, die in der Vorlage zusammengehören:

   1. Was man besitzt, hängt sichtbar an der Figur und *stapelt*. Drei
      Brechstangen sind drei Brechstangen auf dem Rücken. Nach zwanzig
      Minuten sieht man einer Figur an, was sie geworden ist.
   2. Beim Öffnen einer Kiste schwebt das Item kurz darüber, damit man es
      erkennt — und springt dann auf die Figur.

   Gebaut wird der Anbau nur, wenn sich das Inventar wirklich geändert hat.
   Bei sechzig Bildern je Sekunde wäre ein Neuaufbau je Bild sonst die
   teuerste Stelle im ganzen Spiel. */
(function (ROR) {
  'use strict';

  const U = ROR.Util;

  /* Wie viele Stück eines Items höchstens zu sehen sind, und wie viele
     Anbauten insgesamt. Ohne Deckel verschwindet die Figur im Loop unter
     hundert Brechstangen. */
  const JE_ITEM = 5;
  const GESAMT = 46;

  const matCache = {};
  function mat(color) {
    if (!matCache[color]) {
      matCache[color] = new THREE.MeshLambertMaterial({ color: color, flatShading: true });
    }
    return matCache[color];
  }

  const geoCache = {};
  function geo(shape, w, h, d) {
    const key = shape + w + '_' + h + '_' + d;
    if (geoCache[key]) return geoCache[key];
    let g;
    switch (shape) {
      case 'bar':   g = new THREE.BoxGeometry(w, h, d); break;
      case 'plate': g = new THREE.BoxGeometry(w, h, d); break;
      case 'box':   g = new THREE.BoxGeometry(w, h, d); break;
      case 'cyl':   g = new THREE.CylinderGeometry(w / 2, w / 2, h, 6); break;
      case 'cone':  g = new THREE.ConeGeometry(w / 2, h, 6); break;
      case 'sphere':g = new THREE.IcosahedronGeometry(0.5, 0); g.scale(w, h, d); break;
      case 'ring':  g = new THREE.TorusGeometry(w / 2, h / 2, 4, 10); break;
      case 'shard': g = new THREE.OctahedronGeometry(0.5, 0); g.scale(w, h, d); break;
      case 'vial':  g = new THREE.CylinderGeometry(w / 2, w / 3, h, 6); break;
      default:      g = new THREE.BoxGeometry(w, h, d);
    }
    geoCache[key] = g;
    return g;
  }

  function stueck(beschreibung) {
    const s = beschreibung.size;
    const m = new THREE.Mesh(geo(beschreibung.shape, s[0], s[1], s[2]), mat(beschreibung.color));
    m.castShadow = true;
    if (beschreibung.rot) m.rotation.set(beschreibung.rot[0], beschreibung.rot[1], beschreibung.rot[2]);
    return m;
  }

  /* Wo das i-te Exemplar sitzt. `row` reiht auf, `fan` fächert auf,
     `orbit` verteilt auf einem Kreis um die Figur. */
  function platziere(m, beschreibung, i, gesamt) {
    const s = beschreibung.size;
    if (beschreibung.stack === 'orbit') {
      const a = (i / Math.max(1, gesamt)) * U.TAU;
      m.position.set(Math.cos(a) * 0.85, 0.1 + Math.sin(a * 2) * 0.12, Math.sin(a) * 0.85);
      m.userData.orbit = a;
    } else if (beschreibung.stack === 'fan') {
      const spreiz = (i - (gesamt - 1) / 2) * 0.26;
      m.position.set(spreiz * s[0] * 2.2, i * 0.035, i * 0.045);
      m.rotation.z += spreiz * 0.55;
    } else {
      const versatz = (i - (gesamt - 1) / 2);
      m.position.set(versatz * (s[0] + 0.045), i * 0.02, i * 0.03);
    }
  }

  const Attire = {
    dirty: false,
    markDirty() { Attire.dirty = true; },

    /* Baut alle Anbauten neu. Läuft höchstens einmal je Bild und nur nach
       einer Änderung. */
    refresh(player) {
      if (!player || !player.model || !player.model.attach) return;
      const attach = player.model.attach;

      for (const k in attach) {
        const punkt = attach[k];
        for (let i = punkt.children.length - 1; i >= 0; i--) {
          if (punkt.children[i].userData.istAnbau) punkt.remove(punkt.children[i]);
        }
      }

      const items = player.body.items;
      let gesamt = 0;
      const kreisende = [];

      // Seltenes zuerst, damit bei vollem Deckel das Rote sichtbar bleibt.
      const reihenfolge = { boss: 0, lunar: 1, legendary: 2, uncommon: 3, common: 4 };
      const ids = Object.keys(items).sort(function (a, b) {
        const da = ROR.Items.def(a), db = ROR.Items.def(b);
        return (reihenfolge[da && da.tier] || 9) - (reihenfolge[db && db.tier] || 9);
      });

      for (let k = 0; k < ids.length && gesamt < GESAMT; k++) {
        const def = ROR.Items.def(ids[k]);
        if (!def || def.scrap) continue;
        const beschreibung = ROR.Data.itemModel(def);
        const punkt = attach[beschreibung.at] || attach.hip;
        const anzahl = Math.min(JE_ITEM, items[ids[k]], GESAMT - gesamt);
        for (let i = 0; i < anzahl; i++) {
          const m = stueck(beschreibung);
          m.userData.istAnbau = true;
          platziere(m, beschreibung, i, anzahl);
          punkt.add(m);
          if (beschreibung.stack === 'orbit') kreisende.push(m);
          gesamt++;
        }
      }
      player._kreisende = kreisende;
      Attire.dirty = false;
    },

    update(dt) {
      const p = ROR.Game.player;
      if (!p) return;
      if (Attire.dirty) Attire.refresh(p);
      const k = p._kreisende;
      if (!k || !k.length) return;
      // Kreisende Items drehen sich um die Figur — das sind die auffälligen.
      const t = ROR.Engine.time;
      for (let i = 0; i < k.length; i++) {
        const a = k[i].userData.orbit + t * 0.9;
        k[i].position.set(Math.cos(a) * 0.85, 0.1 + Math.sin(a * 2 + i) * 0.12, Math.sin(a) * 0.85);
        k[i].rotation.y = -a;
      }
    },

    /* Das Modell für die Beutekugel: dasselbe Stück, das später am Körper
       hängt — damit man beim Öffnen der Kiste schon sieht, was es wird. */
    pickupModel(def) {
      const beschreibung = ROR.Data.itemModel(def);
      const g = new THREE.Group();
      const m = stueck(beschreibung);
      const s = beschreibung.size;
      // Auf eine erkennbare Größe bringen, egal wie klein das Original ist.
      const k = 0.42 / Math.max(s[0], s[1], s[2]);
      m.scale.setScalar(k);
      m.position.set(0, 0, 0);
      g.add(m);
      const schein = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.44, 0),
        new THREE.MeshBasicMaterial({
          color: ROR.Loot.TIER_COLOR[def.tier] || 0xffffff,
          transparent: true, opacity: 0.22, depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );
      g.add(schein);
      return g;
    }
  };

  ROR.Attire = Attire;
})(window.ROR);
