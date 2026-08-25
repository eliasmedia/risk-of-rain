/* game/fx/toon.js
   Der Lichtramp.

   Bei einem gewöhnlichen Material geht das Licht stufenlos von hell nach
   dunkel. Beim Vorbild geht es in **Bändern**: eine helle Fläche, eine
   Kante, eine dunklere Fläche. Genau daran erkennt man den Stil, und Hopoo
   führt dafür eine eigene „Ramp Information" durch den GBuffer.

   Wir kommen mit `MeshToonMaterial` dorthin. Es liest eine Rampentextur und
   schlägt darin nach, wie hell eine Fläche bei einem bestimmten Lichteinfall
   wird. Zwei Dinge sind dabei wichtig:

   **Eine einzige, geteilte Textur.** Alle Materialien zeigen auf dieselbe.
   Wechselt die Stage, wird nur ihr Inhalt neu geschrieben — sonst müssten
   bei jedem Stagewechsel hunderte Materialien neu gebaut werden.

   **Die Rampe darf Farbe tragen.** Ein Schatten, der nur dunkler ist, sieht
   schmutzig aus; ein Schatten, der ins Kühle kippt, sieht nach Licht aus.
   Deshalb sind die Stufen RGB und nicht bloß Helligkeiten.

   Ohne Angabe ist die Rampe **linear** — und dann verhält sich das Material
   praktisch wie das vorherige Lambert. Das ist Absicht: eine Stage, für die
   noch keine Bänder abgestimmt sind, sieht damit aus wie vorher. */
(function (ROR) {
  'use strict';

  const N = 32;
  const daten = new Uint8Array(N * 4);
  let textur = null;

  function sicher() {
    if (textur) return textur;
    textur = new THREE.DataTexture(daten, N, 1, THREE.RGBAFormat);
    /* Nearest, nicht Linear: die harte Kante zwischen zwei Bändern *ist* der
       Effekt. Mit weicher Filterung wird daraus wieder ein Verlauf. */
    textur.minFilter = THREE.NearestFilter;
    textur.magFilter = THREE.NearestFilter;
    textur.generateMipmaps = false;
    linear();
    return textur;
  }

  function schreibe(f) {
    for (let i = 0; i < N; i++) {
      const c = f(i / (N - 1));
      daten[i * 4] = Math.round(U(c[0]) * 255);
      daten[i * 4 + 1] = Math.round(U(c[1]) * 255);
      daten[i * 4 + 2] = Math.round(U(c[2]) * 255);
      daten[i * 4 + 3] = 255;
    }
    if (textur) textur.needsUpdate = true;
  }

  function U(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  function linear() {
    schreibe(function (t) { return [t, t, t]; });
  }

  /* Bänder: [[abGrenze, r, g, b], …] aufsteigend. Der erste Eintrag gilt für
     alles darunter, also für die abgewandte Seite. */
  function baender(liste) {
    if (!liste || !liste.length) { linear(); return; }
    schreibe(function (t) {
      let s = liste[0];
      for (let i = 0; i < liste.length; i++) if (t >= liste[i][0]) s = liste[i];
      return [s[1], s[2], s[3]];
    });
  }

  ROR.Toon = {
    /* Die geteilte Rampe. Jedes Material bekommt genau diese. */
    get textur() { return sicher(); },

    /* Wird beim Stageaufbau gerufen. Ohne `rampe` in der Palette bleibt es
       linear, und die Stage sieht aus wie vor der Umstellung. */
    ausPalette(P) {
      sicher();
      if (P && P.rampe) baender(P.rampe);
      else linear();
    },

    /* Ein Material im Toon-Stil. Ersetzt die früheren Lambert-Aufrufe und
       nimmt dieselben Angaben entgegen. */
    material(o) {
      o = o || {};
      const m = new THREE.MeshToonMaterial({
        color: o.color === undefined ? 0xffffff : o.color,
        gradientMap: sicher()
      });
      if (o.vertexColors) m.vertexColors = true;
      if (o.emissive !== undefined) m.emissive = new THREE.Color(o.emissive);
      if (o.emissiveIntensity !== undefined) m.emissiveIntensity = o.emissiveIntensity;
      if (o.transparent) { m.transparent = true; m.opacity = o.opacity === undefined ? 1 : o.opacity; }
      if (o.side !== undefined) m.side = o.side;
      if (o.depthWrite !== undefined) m.depthWrite = o.depthWrite;
      return m;
    }
  };
})(window.ROR);
