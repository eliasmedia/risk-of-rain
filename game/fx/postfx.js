/* game/fx/postfx.js
   Bildnachbearbeitung: Leuchten, Vignette, Farbgraduierung, Korn.

   Das ist der Schritt, der aus „bunte Klötze im Sonnenlicht" das Bildklima
   der Vorlage macht. Three.js bringt dafür einen EffectComposer mit — der
   liegt aber unter `examples/` und ist nur als ES-Modul zu haben, also unter
   `file://` unbrauchbar. Deshalb hier von Hand, mit den Mitteln des Kerns:
   zwei Renderziele, ein Helligkeitsauszug, zwei Unschärfedurchgänge und ein
   Vollbild-Shader.

   Die Reihenfolge ist der eigentliche Punkt:

     1. Szene *ohne* Tonwertkurve in ein Halbfloat-Ziel — so bleiben Werte
        über 1.0 erhalten, und nur die leuchten später wirklich.
     2. Helligkeitsauszug auf halber Auflösung.
     3. Unschärfe waagerecht, dann senkrecht (getrennt: 2·N statt N² Proben).
     4. Zusammensetzen: Szene + Leuchten, dann erst Farbgraduierung,
        Vignette, Korn und Tonwertkurve.

   Tonwertkurve und Farbraum zuletzt — würde man früher umrechnen, wäre das
   Leuchten schon beschnitten und die Graduierung liefe auf bereits
   verbogenen Werten. */
(function (ROR) {
  'use strict';

  const VERT = `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

  /* Alles über der Schwelle bleibt stehen, der Rest fällt weg. Der weiche
     Übergang verhindert, dass leicht überhelle Flächen flackern. */
  const BRIGHT = `
    uniform sampler2D tSrc; uniform float uSchwelle; uniform float uWeich;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tSrc, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      float k = smoothstep(uSchwelle, uSchwelle + uWeich, l);
      gl_FragColor = vec4(c * k, 1.0);
    }`;

  const BLUR = `
    uniform sampler2D tSrc; uniform vec2 uRichtung;
    varying vec2 vUv;
    void main() {
      // Neun Proben mit Gauß-Gewichten, in einer Achse.
      float g[5];
      g[0] = 0.227027; g[1] = 0.194594; g[2] = 0.121621; g[3] = 0.054054; g[4] = 0.016216;
      vec3 summe = texture2D(tSrc, vUv).rgb * g[0];
      for (int i = 1; i < 5; i++) {
        vec2 o = uRichtung * float(i);
        summe += texture2D(tSrc, vUv + o).rgb * g[i];
        summe += texture2D(tSrc, vUv - o).rgb * g[i];
      }
      gl_FragColor = vec4(summe, 1.0);
    }`;

  const COMPOSITE = `
    uniform sampler2D tSzene; uniform sampler2D tLeuchten;
    uniform highp sampler2D tTiefe;
    uniform float uLeuchtstaerke, uVignette, uKorn, uZeit, uSaettigung, uKontrast;
    uniform vec3 uHauch;
    uniform float uSchaden, uBelichtung;
    uniform vec2 uPixel;
    uniform float uKontur, uKonturSchwelle, uNah, uFern;
    varying vec2 vUv;

    // Filmische Tonwertkurve (ACES, genäherte Fassung).
    vec3 aces(vec3 x) {
      return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
    }

    /* Der Tiefenpuffer ist nicht linear — nahe Werte drängen sich zusammen,
       ferne spreizen. Ohne Linearisierung säßen alle erkannten Kanten am
       Horizont und keine einzige vor den Füßen. */
    float tiefeLinear(vec2 uv) {
      float d = texture2D(tTiefe, uv).x;
      return (2.0 * uNah * uFern) / (uFern + uNah - (2.0 * d - 1.0) * (uFern - uNah));
    }

    /* Konturen aus Tiefensprüngen. Das ist der Kern des Vorbilds: eine dunkle
       Linie dort, wo ein Körper vor einem anderen endet. Der Sprung wird an
       der eigenen Entfernung gemessen, sonst verschwinden ferne Kanten
       vollständig und nahe werden zu Balken. */
    float kante() {
      if (uKontur <= 0.0) return 0.0;
      /* Roberts-Cross: zwei Diagonalen statt eines vollen 3x3-Fensters. Vier
         Abtastungen statt neun, und bei einer Linie von einem Pixel Breite
         sieht man den Unterschied nicht — die neun kosteten gemessen 4.5 ms
         je Bild, das war der halbe Bildaufwand fuer eine Kontur. */
      float a = tiefeLinear(vUv - uPixel);
      float b = tiefeLinear(vUv + uPixel);
      float c1 = tiefeLinear(vUv + vec2( uPixel.x, -uPixel.y));
      float d1 = tiefeLinear(vUv + vec2(-uPixel.x,  uPixel.y));
      float summe = abs(a - b) + abs(c1 - d1);
      float rel = summe / max(min(min(a, b), min(c1, d1)), 1.0);
      return smoothstep(uKonturSchwelle, uKonturSchwelle * 2.6, rel);
    }

    void main() {
      vec3 c = texture2D(tSzene, vUv).rgb;
      c += texture2D(tLeuchten, vUv).rgb * uLeuchtstaerke;
      c *= uBelichtung;

      /* Reihenfolge ist hier alles. Das Leuchten wird *vor* der Tonwertkurve
         addiert — nur so leuchtet, was über 1.0 liegt. Sättigung und Kontrast
         kommen erst *danach*: sie rechnen um 0.5 herum, und das ist ein
         Anzeigewert. In linearem Licht liegt Mittelgrau bei 0.18, ein
         Kontrast um 0.5 zöge dort alles Dunkle ins Negative — genau das war
         beim ersten Versuch der Fall, und die Lava kam türkis heraus. */
      c = aces(c);

      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSaettigung);
      c = clamp((c - 0.5) * uKontrast + 0.5, 0.0, 1.0);
      c += uHauch * (1.0 - smoothstep(0.0, 0.55, l));

      // Vignette und Trefferrot liegen auf demselben Radius.
      vec2 d = vUv - 0.5;
      float r = dot(d, d);
      c *= 1.0 - uVignette * r * 1.9;
      c = mix(c, vec3(0.62, 0.05, 0.04), clamp(uSchaden * r * 3.4, 0.0, 0.85));

      // Korn: sonst wirken große einfarbige Flächen wie Plastik.
      float n = fract(sin(dot(vUv * 1024.0 + uZeit, vec2(12.9898, 78.233))) * 43758.5453);
      c += (n - 0.5) * uKorn;

      /* Echte sRGB-Kurve statt pow(1/2.2). Der Unterschied sitzt genau in
         den Tiefen, und auf dunklen Stages ist das der Unterschied zwischen
         „stimmungsvoll" und „schwarz". */
      /* Die Kontur kommt zuletzt, nach Tonwertkurve und Farbstimmung. Läge
         sie davor, würde das Leuchten sie überstrahlen und die Linie
         verschwände genau an den hellen Kanten, an denen man sie am meisten
         braucht. */
      c = mix(c, c * 0.16, kante() * uKontur);

      c = max(c, 0.0);
      vec3 hell = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
      vec3 dunkel = c * 12.92;
      gl_FragColor = vec4(mix(dunkel, hell, step(vec3(0.0031308), c)), 1.0);
    }`;

  function ziel(w, h, mitTiefe) {
    const o = {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false
    };
    /* Nur das Szenenziel braucht eine auslesbare Tiefe — die Unschärfestufen
       arbeiten auf halber Auflösung und hätten davon nichts. */
    if (mitTiefe) {
      const t = new THREE.DepthTexture(w, h);
      t.type = THREE.UnsignedIntType;
      o.depthTexture = t;
    }
    return new THREE.WebGLRenderTarget(w, h, o);
  }

  function schirm(shader, uniforms) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(
      new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: shader, uniforms: uniforms,
      depthTest: false, depthWrite: false
    }));
    m.frustumCulled = false;
    return m;
  }

  let renderer = null, szeneRT = null, hellRT = null, blurA = null, blurB = null;
  let kameraFlach = null, szeneFlach = null;
  let mBright = null, mBlur = null, mComp = null;
  let breite = 1, hoehe = 1;

  const PostFX = {
    enabled: true,
    /* Wird von außen gesetzt: Trefferrot und Erschütterung. */
    schaden: 0,

    init(r) {
      renderer = r;
      kameraFlach = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      szeneFlach = new THREE.Scene();

      mBright = schirm(BRIGHT, {
        tSrc: { value: null }, uSchwelle: { value: 0.85 }, uWeich: { value: 0.45 }
      });
      mBlur = schirm(BLUR, { tSrc: { value: null }, uRichtung: { value: new THREE.Vector2() } });
      mComp = schirm(COMPOSITE, {
        tSzene: { value: null }, tLeuchten: { value: null },
        uLeuchtstaerke: { value: 0.8 }, uVignette: { value: 0.42 },
        uKorn: { value: 0.016 }, uZeit: { value: 0 },
        uSaettigung: { value: 0.95 }, uKontrast: { value: 1.05 },
        uHauch: { value: new THREE.Color(0.02, 0.03, 0.06) },
        uSchaden: { value: 0 }, uBelichtung: { value: 1.0 },
        tTiefe: { value: null }, uPixel: { value: new THREE.Vector2() },
        uKontur: { value: 0.85 }, uKonturSchwelle: { value: 0.035 },
        uNah: { value: 0.1 }, uFern: { value: 1200 }
      });
      PostFX.resize();
      return PostFX;
    },

    /* Die Farbstimmung kommt aus der Stage — jede hat ihre eigene. */
    applyPalette(P) {
      if (!mComp) return;
      const u = mComp.material.uniforms;
      const g = P.grade || {};
      u.uSaettigung.value = g.saettigung === undefined ? 0.95 : g.saettigung;
      u.uKontrast.value = g.kontrast === undefined ? 1.05 : g.kontrast;
      u.uLeuchtstaerke.value = g.leuchten === undefined ? 0.8 : g.leuchten;
      u.uVignette.value = g.vignette === undefined ? 0.42 : g.vignette;
      u.uBelichtung.value = g.belichtung === undefined ? 1.0 : g.belichtung;
      if (g.hauch) u.uHauch.value.setHex(g.hauch).multiplyScalar(0.10);
      else u.uHauch.value.setRGB(0, 0, 0);
      u.uKontur.value = g.kontur === undefined ? 0.85 : g.kontur;
      u.uKonturSchwelle.value = g.konturSchwelle === undefined ? 0.035 : g.konturSchwelle;
    },

    resize() {
      if (!renderer) return;
      const pr = renderer.getPixelRatio();
      breite = Math.max(2, Math.floor(innerWidth * pr));
      hoehe = Math.max(2, Math.floor(innerHeight * pr));
      const hw = Math.max(1, breite >> 1), hh = Math.max(1, hoehe >> 1);
      if (szeneRT) { szeneRT.dispose(); hellRT.dispose(); blurA.dispose(); blurB.dispose(); }
      szeneRT = ziel(breite, hoehe, true);
      hellRT = ziel(hw, hh);
      blurA = ziel(hw, hh);
      blurB = ziel(hw, hh);
      if (mComp) {
        mComp.material.uniforms.uPixel.value.set(1 / breite, 1 / hoehe);
        mComp.material.uniforms.tTiefe.value = szeneRT.depthTexture;
      }
    },

    render(scene, camera, dt) {
      if (!PostFX.enabled || !szeneRT) { renderer.render(scene, camera); return; }

      /* Ohne Tonwertkurve rendern: erst dadurch gibt es Werte über 1.0,
         und nur die dürfen leuchten. */
      const merkTM = renderer.toneMapping;
      const merkCS = renderer.outputColorSpace;
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

      renderer.setRenderTarget(szeneRT);
      renderer.clear();
      renderer.render(scene, camera);

      szeneFlach.clear();
      szeneFlach.add(mBright);
      mBright.material.uniforms.tSrc.value = szeneRT.texture;
      renderer.setRenderTarget(hellRT);
      renderer.render(szeneFlach, kameraFlach);

      szeneFlach.clear();
      szeneFlach.add(mBlur);
      const u = mBlur.material.uniforms;
      for (let durchgang = 0; durchgang < 2; durchgang++) {
        u.tSrc.value = durchgang === 0 ? hellRT.texture : blurB.texture;
        u.uRichtung.value.set(1.4 / (breite >> 1), 0);
        renderer.setRenderTarget(blurA);
        renderer.render(szeneFlach, kameraFlach);

        u.tSrc.value = blurA.texture;
        u.uRichtung.value.set(0, 1.4 / (hoehe >> 1));
        renderer.setRenderTarget(blurB);
        renderer.render(szeneFlach, kameraFlach);
      }

      renderer.toneMapping = merkTM;
      renderer.outputColorSpace = merkCS;

      szeneFlach.clear();
      szeneFlach.add(mComp);
      const c = mComp.material.uniforms;
      c.tSzene.value = szeneRT.texture;
      c.tLeuchten.value = blurB.texture;
      c.tTiefe.value = szeneRT.depthTexture;
      c.uNah.value = camera.near;
      c.uFern.value = camera.far;
      c.uZeit.value += dt * 60;
      c.uSchaden.value += (PostFX.schaden - c.uSchaden.value) * Math.min(1, dt * 9);
      renderer.setRenderTarget(null);
      renderer.render(szeneFlach, kameraFlach);
    }
  };

  ROR.PostFX = PostFX;
})(window.ROR);
