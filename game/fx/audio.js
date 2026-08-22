/* game/fx/audio.js
   Klang — vollständig im Code erzeugt, ohne eine einzige Tondatei.

   Zwei Teile:

   * **Effekte.** Kurze Hüllkurven auf Oszillatoren und Rauschen. Ein Schuss
     ist ein Rauschstoß mit steilem Abfall, eine Explosion dasselbe mit
     Tiefpass, ein Aufsammeln zwei aufsteigende Sinustöne.
   * **Musik.** Ein Bassbrummen, eine Fläche und ein Arpeggio, deren Tempo
     und Schichtzahl am Schwierigkeitskoeffizienten hängen. Das ist derselbe
     Wert, den auch der Balken zeigt: man *hört*, wie spät es ist, bevor man
     hinsieht.

   Der Zusammenhang ist der Punkt. Eine Tonspur, die immer gleich läuft,
   könnte man auch weglassen; eine, die mit dem Druck mitwächst, ist Teil der
   Anzeige.

   Browser lassen Klang erst nach einer Eingabe zu. Deshalb wird der Kontext
   beim ersten Klick geöffnet, nicht beim Laden. */
(function (ROR) {
  'use strict';

  const U = ROR.Util;
  let ctx = null, meister = null, musikBus = null, fxBus = null;
  let rauschPuffer = null;
  let laeuft = false;
  let takt = 0, taktZeit = 0;
  let stufe = 0;

  /* Pentatonisch in a-Moll: keine schiefen Töne, egal welche Reihenfolge. */
  const TOENE = [220.00, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33];
  const BASS = [55.00, 61.74, 65.41, 73.42];

  function rauschen() {
    if (rauschPuffer) return rauschPuffer;
    const n = ctx.sampleRate * 2;
    rauschPuffer = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = rauschPuffer.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return rauschPuffer;
  }

  /* Ein Ton mit Hüllkurve. Alles Weitere im Spiel ist eine Abwandlung davon. */
  function ton(o) {
    if (!ctx) return;
    const t = ctx.currentTime + (o.wenn || 0);
    const osc = ctx.createOscillator();
    osc.type = o.form || 'sine';
    osc.frequency.setValueAtTime(o.hz, t);
    if (o.hzEnde) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.hzEnde), t + o.dauer);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, o.laut), t + (o.anstieg || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dauer);

    let letzte = g;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter;
      f.frequency.setValueAtTime(o.filterHz || 900, t);
      if (o.filterEnde) f.frequency.exponentialRampToValueAtTime(Math.max(60, o.filterEnde), t + o.dauer);
      g.connect(f);
      letzte = f;
    }
    letzte.connect(o.bus || fxBus);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + o.dauer + 0.05);
  }

  function knall(o) {
    if (!ctx) return;
    const t = ctx.currentTime + (o.wenn || 0);
    const src = ctx.createBufferSource();
    src.buffer = rauschen();
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || 'lowpass';
    f.frequency.setValueAtTime(o.hz, t);
    if (o.hzEnde) f.frequency.exponentialRampToValueAtTime(Math.max(60, o.hzEnde), t + o.dauer);
    f.Q.value = o.q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, o.laut), t + (o.anstieg || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dauer);
    src.connect(f); f.connect(g); g.connect(o.bus || fxBus);
    src.start(t);
    src.stop(t + o.dauer + 0.05);
  }

  /* ------------------------------------------------------------- Effekte */

  const EFFEKTE = {
    schuss()    { knall({ hz: 2600, hzEnde: 700, dauer: 0.09, laut: 0.16, filter: 'bandpass', q: 1.4 });
                  ton({ hz: 380, hzEnde: 120, dauer: 0.07, laut: 0.09, form: 'square' }); },
    treffer()   { knall({ hz: 1600, hzEnde: 400, dauer: 0.07, laut: 0.10 }); },
    krit()      { knall({ hz: 3200, hzEnde: 800, dauer: 0.1, laut: 0.15, filter: 'bandpass', q: 2 });
                  ton({ hz: 880, hzEnde: 1400, dauer: 0.1, laut: 0.1, form: 'triangle' }); },
    explosion() { knall({ hz: 900, hzEnde: 70, dauer: 0.5, laut: 0.3 });
                  ton({ hz: 90, hzEnde: 40, dauer: 0.4, laut: 0.16, form: 'sine' }); },
    schaden()   { knall({ hz: 500, hzEnde: 120, dauer: 0.24, laut: 0.24 });
                  ton({ hz: 160, hzEnde: 70, dauer: 0.22, laut: 0.14, form: 'sawtooth' }); },
    sprung()    { ton({ hz: 320, hzEnde: 520, dauer: 0.11, laut: 0.07, form: 'triangle' }); },
    aufsammeln(){ ton({ hz: 660, dauer: 0.1, laut: 0.13, form: 'triangle' });
                  ton({ hz: 990, dauer: 0.14, laut: 0.11, form: 'triangle', wenn: 0.07 }); },
    kiste()     { knall({ hz: 700, hzEnde: 200, dauer: 0.2, laut: 0.16 });
                  ton({ hz: 300, hzEnde: 520, dauer: 0.22, laut: 0.1, form: 'square' }); },
    stufe()     { [0, 0.09, 0.18].forEach(function (v, i) {
                    ton({ hz: 523 * Math.pow(1.26, i), dauer: 0.22, laut: 0.12,
                          form: 'triangle', wenn: v }); }); },
    boss()      { ton({ hz: 70, hzEnde: 46, dauer: 1.6, laut: 0.3, form: 'sawtooth',
                        filter: 'lowpass', filterHz: 400, filterEnde: 120 });
                  knall({ hz: 200, hzEnde: 50, dauer: 1.4, laut: 0.2 }); },
    tod()       { ton({ hz: 300, hzEnde: 60, dauer: 1.5, laut: 0.28, form: 'sawtooth',
                        filter: 'lowpass', filterHz: 800, filterEnde: 100 }); },
    sieg()      { [0, 0.14, 0.28, 0.5].forEach(function (v, i) {
                    ton({ hz: [392, 523, 659, 784][i], dauer: 0.5, laut: 0.14,
                          form: 'triangle', wenn: v }); }); },
    teleport()  { ton({ hz: 200, hzEnde: 1200, dauer: 0.8, laut: 0.14, form: 'sine' });
                  knall({ hz: 400, hzEnde: 3000, dauer: 0.8, laut: 0.1, filter: 'bandpass', q: 3 }); }
  };

  /* --------------------------------------------------------------- Musik */

  /* Der Takt wird schneller und die Schichten dichter, je höher der
     Koeffizient steht. Bei „Easy" hört man nur Bass und Fläche, bei
     „I SEE YOU" hämmert das Arpeggio. */
  function musikSchritt() {
    if (!laeuft || !ctx) return;
    const coeff = ROR.Difficulty ? ROR.Difficulty.coeff : 1;
    stufe = U.clamp((coeff - 1) / 12, 0, 1);
    const bpm = 74 + stufe * 62;
    const schlag = 60 / bpm;
    taktZeit = schlag;

    const grund = BASS[(takt >> 3) % BASS.length];
    // Bass auf jeder Zählzeit — das Fundament, das nie aussetzt.
    if (takt % 2 === 0) {
      ton({ hz: grund, dauer: schlag * 1.8, laut: 0.10 + stufe * 0.05, form: 'sine',
            filter: 'lowpass', filterHz: 220, bus: musikBus });
    }
    // Fläche alle acht Schläge.
    if (takt % 8 === 0) {
      ton({ hz: grund * 4, dauer: schlag * 7, laut: 0.028 + stufe * 0.02, form: 'sawtooth',
            anstieg: schlag * 2, filter: 'lowpass', filterHz: 520 + stufe * 900, bus: musikBus });
    }
    // Arpeggio ab mittlerem Druck.
    if (stufe > 0.25 && takt % 2 === 1) {
      const t = TOENE[(takt * 3) % TOENE.length];
      ton({ hz: t, dauer: schlag * 0.9, laut: 0.035 + stufe * 0.045, form: 'triangle',
            bus: musikBus });
    }
    // Puls ab hohem Druck — ab hier wird es hektisch.
    if (stufe > 0.55) {
      knall({ hz: 3000, hzEnde: 900, dauer: 0.05, laut: 0.03 + stufe * 0.03,
              filter: 'highpass', bus: musikBus });
    }
    takt++;
    setTimeout(musikSchritt, taktZeit * 1000);
  }

  const Audio = {
    bereit: false,
    an: true,

    /* Erst bei der ersten Eingabe — vorher lässt der Browser keinen Klang zu. */
    start() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      meister = ctx.createGain();
      meister.gain.value = Audio.an ? 0.65 : 0;
      meister.connect(ctx.destination);

      musikBus = ctx.createGain(); musikBus.gain.value = 0.5; musikBus.connect(meister);
      fxBus = ctx.createGain(); fxBus.gain.value = 1.0; fxBus.connect(meister);

      Audio.bereit = true;
      laeuft = true;
      musikSchritt();
    },

    setAn(an) {
      Audio.an = an;
      if (meister) meister.gain.value = an ? 0.65 : 0;
    },

    /* Ein einziger Einstieg für alles: Audio.spiel('schuss'). Unbekannte
       Namen sind still statt ein Fehler — so bremst ein Tippfehler nicht
       den ganzen Kampf aus. */
    spiel(name) {
      if (!Audio.bereit || !Audio.an) return;
      const f = EFFEKTE[name];
      if (f) f();
    }
  };

  ROR.Audio = Audio;
})(window.ROR);
