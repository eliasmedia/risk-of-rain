/* game/core/util.js
   Zufall, Rauschen und Mathematik. Diese Datei weiß nichts vom Spiel — hier
   landet nur, was mindestens zwei andere Dateien brauchen. */
window.ROR = window.ROR || {};
(function (ROR) {
  'use strict';

  const TAU = Math.PI * 2;

  /* ---------------------------------------------------------------- Zahlen */

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function invLerp(a, b, v) { return a === b ? 0 : (v - a) / (b - a); }
  function smoothstep(e0, e1, x) {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  /* Rahmenratenunabhängiges Nachziehen: nach `halfLife` Sekunden ist der halbe
     Weg zurückgelegt — egal, in wie viele Bilder das zerfällt. Überall dort
     benutzt, wo sonst ein `lerp(a, b, 0.1)` stünde und bei 144 Hz zu schnell wäre. */
  function damp(a, b, halfLife, dt) {
    return b + (a - b) * Math.pow(2, -dt / halfLife);
  }

  /* Bringt einen Winkel in den Bereich (-PI, PI]. */
  function wrapAngle(a) {
    a = (a + Math.PI) % TAU;
    if (a < 0) a += TAU;
    return a - Math.PI;
  }
  function angleDelta(from, to) { return wrapAngle(to - from); }
  function angleDamp(a, b, halfLife, dt) {
    return a + wrapAngle(b - a) * (1 - Math.pow(2, -dt / halfLife));
  }

  /* Bewegt `a` um höchstens `maxStep` in Richtung `b`. */
  function approach(a, b, maxStep) {
    const d = b - a;
    if (d > maxStep) return a + maxStep;
    if (d < -maxStep) return a - maxStep;
    return b;
  }

  function dist2(ax, az, bx, bz) {
    const dx = ax - bx, dz = az - bz;
    return dx * dx + dz * dz;
  }

  /* ---------------------------------------------------------------- Zufall */

  /* Mulberry32 — klein, schnell, gut genug, und vor allem aussäbar. Jede Stage
     bekommt ihren eigenen Strom, damit ein Seed dieselbe Welt erzeugt. */
  function Rng(seed) {
    let s = (seed >>> 0) || 0x9e3779b9;
    const r = {
      next() {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      },
      range(lo, hi) { return lo + (hi - lo) * r.next(); },
      int(n) { return Math.floor(r.next() * n); },
      sign() { return r.next() < 0.5 ? -1 : 1; },
      chance(p) { return r.next() < p; },
      pick(arr) { return arr[Math.floor(r.next() * arr.length)]; },
      /* Zieht aus einer Liste von {weight: n, ...}-Einträgen. Der Director und
         die Kistentabellen laufen beide darüber. */
      weighted(arr, weightOf) {
        let total = 0;
        for (let i = 0; i < arr.length; i++) total += weightOf ? weightOf(arr[i]) : arr[i].weight;
        if (total <= 0) return null;
        let roll = r.next() * total;
        for (let i = 0; i < arr.length; i++) {
          roll -= weightOf ? weightOf(arr[i]) : arr[i].weight;
          if (roll <= 0) return arr[i];
        }
        return arr[arr.length - 1];
      },
      /* Punkt gleichverteilt in einer Kreisscheibe — für Spawnringe. */
      inDisc(radius) {
        const a = r.next() * TAU;
        const d = Math.sqrt(r.next()) * radius;
        return { x: Math.cos(a) * d, z: Math.sin(a) * d };
      },
      shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = r.int(i + 1);
          const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        }
        return arr;
      },
      fork() { return Rng((r.next() * 4294967296) >>> 0); }
    };
    return r;
  }

  /* Ein globaler Strom für alles, was nicht reproduzierbar sein muss —
     Partikel, Trefferstreuung, Klangvariation. */
  const chaos = Rng((Math.random() * 4294967296) >>> 0);

  /* --------------------------------------------------------------- Rauschen */

  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }

  /* Perlin-Rauschen mit aus dem Seed gemischter Permutationstabelle.
     `fbm` schichtet es zu Hügeln, `ridged` zu Graten und Klippen. */
  function Noise(seed) {
    const p = new Uint8Array(512);
    const rng = Rng(seed);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = rng.int(i + 1);
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    for (let i = 0; i < 256; i++) p[i + 256] = p[i];

    function grad(h, x, y) {
      switch (h & 3) {
        case 0: return x + y;
        case 1: return -x + y;
        case 2: return x - y;
        default: return -x - y;
      }
    }

    /* Ergebnis liegt etwa in [-1, 1]. */
    function noise2(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const X = xi & 255, Y = yi & 255;
      const fx = x - xi, fy = y - yi;
      const u = fade(fx), v = fade(fy);
      const aa = p[p[X] + Y], ab = p[p[X] + Y + 1];
      const ba = p[p[X + 1] + Y], bb = p[p[X + 1] + Y + 1];
      return lerp(
        lerp(grad(aa, fx, fy), grad(ba, fx - 1, fy), u),
        lerp(grad(ab, fx, fy - 1), grad(bb, fx - 1, fy - 1), u),
        v
      );
    }

    function fbm(x, y, octaves, lacunarity, gain) {
      octaves = octaves || 4;
      lacunarity = lacunarity || 2;
      gain = gain === undefined ? 0.5 : gain;
      let sum = 0, amp = 1, norm = 0, fx = x, fy = y;
      for (let i = 0; i < octaves; i++) {
        sum += noise2(fx, fy) * amp;
        norm += amp;
        amp *= gain;
        fx *= lacunarity; fy *= lacunarity;
      }
      return sum / norm;
    }

    /* Gratrauschen: der Betrag umgeklappt, damit aus weichen Tälern scharfe
       Kanten werden. Liefert [0, 1]. */
    function ridged(x, y, octaves, lacunarity, gain) {
      octaves = octaves || 3;
      lacunarity = lacunarity || 2.1;
      gain = gain === undefined ? 0.5 : gain;
      let sum = 0, amp = 1, norm = 0, fx = x, fy = y;
      for (let i = 0; i < octaves; i++) {
        sum += (1 - Math.abs(noise2(fx, fy))) * amp;
        norm += amp;
        amp *= gain;
        fx *= lacunarity; fy *= lacunarity;
      }
      return sum / norm;
    }

    return { noise2, fbm, ridged };
  }

  ROR.Util = {
    TAU, clamp, lerp, invLerp, smoothstep, damp,
    wrapAngle, angleDelta, angleDamp, approach, dist2,
    Rng, Noise, chaos
  };
})(window.ROR);
