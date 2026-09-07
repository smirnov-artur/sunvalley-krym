// sound.js — процедурный эмбиент главной «Крыма». Только WebAudio: без файлов и библиотек.
// Слои: wind, sea, cicadas, drip, hum, gulls, rain, fire. Шумы — буферы 8–12 с, сегменты идут
// друг за другом с равномощным кроссфейдом 0,25 с (не loop=true: см. S() ниже), огибающие —
// автоматизация AudioParam/ConstantSource, события (капли, чайки, треск, капли дождя) —
// короткоживущие узлы: stop + disconnect по onended.
//
//   import createSound, { renderPreset, bufferToWav, PRESETS } from './sound.js';
//   const snd = createSound();                    // реальное время; enable() только по жесту
//   snd.enable(); snd.setMix(PRESETS.sea.mix);    // setMix({ wind, sea, ... }, seconds)
//   snd.onGust((k, { attack, release }) => sway(k));
//   const buf = await renderPreset({ rain: 1 }, 8); // OfflineAudioContext → AudioBuffer
//   const blob = bufferToWav(buf);
//
// Планирование: каждый слой держит «next» в аудио-времени и досхемывает события в окно
// [t0, t1) — одинаково для реального контекста (тикер каждые 250 мс, горизонт 2,5 с) и для
// офлайн-рендера (одно окно на всю длину). Так одна и та же логика звучит и пишется в WAV.

export const LAYERS = ['wind', 'sea', 'cicadas', 'drip', 'hum', 'gulls', 'rain', 'fire'];
// баланс слоёв при mix = 1 (подобран по RMS соло-рендеров, см. sound-test.html)
const TRIM = { wind: 0.8, sea: 0.7, cicadas: 1.0, drip: 1.0, hum: 0.35, gulls: 0.6, rain: 0.5, fire: 0.6 };
const LEVEL = 0.5;   // общий уровень: эмбиент под чтение, не «саунд-дизайн»
const LOOK = 2.5;    // горизонт планирования, с (в скрытой вкладке таймеры душат — берём 40 с)

export const PRESETS = {
  sea:    { title: 'Море у Судака',        mix: { sea: 1, wind: 0.45, gulls: 0.7, cicadas: 0.12 }, intensity: 0.45 },
  noon:   { title: 'Виноградник в полдень', mix: { cicadas: 1, wind: 0.35, sea: 0.08, gulls: 0.08 }, intensity: 0.3 },
  cellar: { title: 'Подвал',               mix: { drip: 1, hum: 0.8 }, intensity: 0 },
  rain:   { title: 'Дождь в Отузах',       mix: { rain: 1, wind: 0.55, sea: 0.15 }, intensity: 0.7 },
  night:  { title: 'Ночь с фонарём',       mix: { fire: 0.9, wind: 0.3, sea: 0.2, cicadas: 0.05 }, intensity: 0.25 }
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
// детерминированный ГПСЧ (mulberry32): офлайн-рендер с seed воспроизводим
function mulberry(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Шумовой буфер: white | pink (Келлет, 7 полюсов) | brown (утекающий интегратор, без ухода в DC), RMS 0,18.
function makeNoise(ctx, kind, seconds, R) {
  const sr = ctx.sampleRate, N = Math.round(sr * seconds), a = new Float32Array(N);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, br = 0;
  for (let i = 0; i < N; i++) {
    const w = R() * 2 - 1;
    if (kind === 'white') a[i] = w;
    else if (kind === 'pink') { b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856; b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980; a[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926; }
    else { br = br * 0.998 + w * 0.02; a[i] = br; }
  }
  let s = 0; for (let i = 0; i < N; i++) s += a[i] * a[i];
  const k = 0.18 / Math.sqrt(s / N), buf = ctx.createBuffer(1, N, sr), d = buf.getChannelData(0);
  for (let i = 0; i < N; i++) d[i] = clamp(a[i] * k, -1, 1);
  return buf;
}
// Плавный случайный сигнал −1..1 (косинусная интерполяция узлов с частотой hz), петля без стыка.
function makeWander(ctx, seconds, hz, R) {
  const sr = ctx.sampleRate, N = Math.round(sr * seconds), K = Math.max(2, Math.round(seconds * hz)), pts = new Float32Array(K);
  for (let i = 0; i < K; i++) pts[i] = R() * 2 - 1;
  const buf = ctx.createBuffer(1, N, sr), d = buf.getChannelData(0);
  for (let i = 0; i < N; i++) { const p = i / N * K, j = Math.floor(p), c = (1 - Math.cos((p - j) * Math.PI)) / 2; d[i] = pts[j % K] * (1 - c) + pts[(j + 1) % K] * c; }
  return buf;
}
// Зерно: затухающий шум через двухполюсный резонатор (щелчок капли, треск, тик), пик = 1.
function makeGrain(ctx, ms, freq, q, R) {
  const sr = ctx.sampleRate, n = Math.max(16, Math.round(sr * ms / 1000)), buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
  const w = 2 * Math.PI * freq / sr, r = Math.exp(-Math.PI * freq / (q * sr)), a1 = 2 * r * Math.cos(w), a2 = -r * r;
  let y1 = 0, y2 = 0, pk = 1e-9;
  for (let i = 0; i < n; i++) { const y = (R() * 2 - 1) * Math.exp(-5 * i / n) + a1 * y1 + a2 * y2; y2 = y1; y1 = y; d[i] = y; pk = Math.max(pk, Math.abs(y)); }
  for (let i = 0; i < n; i++) d[i] = d[i] / pk * Math.min(1, (n - 1 - i) / (n * 0.15));
  return buf;
}
// Импульс свода подвала: ранние отражения + шумовой хвост, темнеющий к концу.
function makeIR(ctx, seconds, decay, R, early) {
  const sr = ctx.sampleRate, N = Math.round(sr * seconds), buf = ctx.createBuffer(2, N, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch); let lp = 0;
    for (let i = 0; i < N; i++) { const t = i / sr, c = Math.min(0.97, 0.15 + 0.85 * t / seconds); lp = lp * c + (R() * 2 - 1) * (1 - c); d[i] = lp * Math.exp(-decay * t); }
    for (const [ms, g] of early) { const j = Math.round((ms + R() * 2) * sr / 1000); if (j < N) d[j] += g * (0.8 + R() * 0.4) * (R() < 0.5 ? -1 : 1); }
  }
  return buf;
}
// Кривая WaveShaper: синус → короткий импульс (заполнение ~25 %) для АМ цикад.
const PULSE = (() => { const c = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const s = clamp((i / 1023 * 2 - 1 - 0.45) / 0.45, 0, 1); c[i] = s * s * (3 - 2 * s); } return c; })();
// равномощный кроссфейд сегментов
const FADE_IN = Float32Array.from({ length: 65 }, (_, i) => Math.sin(i / 64 * Math.PI / 2)), FADE_OUT = Float32Array.from({ length: 65 }, (_, i) => Math.cos(i / 64 * Math.PI / 2));

export default function createSound(opts = {}) {
  const off = opts.offline || null;
  const R = mulberry(opts.seed ?? (Math.random() * 4294967296) >>> 0);
  const target = Object.fromEntries(LAYERS.map(k => [k, 0]));
  const gustCbs = new Set(), gustTimers = new Set(), gustLog = [];
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ctx = null, master = null, analyser = null, layers = [], loops = [], intensity = 0.5, enabledFlag = false, ticker = 0, suspendTimer = 0;

  function build() {
    const N = { white: makeNoise(ctx, 'white', 8.3, R), pink: makeNoise(ctx, 'pink', 11.1, R), brown: makeNoise(ctx, 'brown', 9.7, R) };
    const wander = makeWander(ctx, 12, 5, R), wanderSlow = makeWander(ctx, 17, 0.35, R);
    // маленькие фабрики узлов
    const G = v => { const g = ctx.createGain(); g.gain.value = v; return g; };
    const F = (type, f, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
    const O = (type, f, t = 0) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(t); return o; };
    const P = v => { const p = ctx.createStereoPanner(); p.pan.value = clamp(v, -1, 1); return p; };
    // «Петля» без loop=true: в Chrome 152 на буферах некоторых длин (5,4 с, 8,3 с; 6 с — нет) после
    // стыка зацикленной петли источник отдаёт периодический мусор (гребёнка гармоник 375 Гц), а фильтр
    // за ним взрывается до Infinity → NaN и отравляет весь граф.
    // Поэтому сегменты буфера идут друг за другом с равномощным кроссфейдом 0,25 с, планируются
    // тикером как события; первый сегмент — со случайного сдвига (декорреляция одинаковых буферов).
    const S = (buf, loop = true) => {
      const s = ctx.createBufferSource(); s.buffer = buf; if (!loop) return s;
      const out = G(1), D = buf.duration, X = 0.25; let next = -1, off = R() * (D - 1);
      loops.push({ sched(t0, t1) {
        if (next < t0) next = t0;
        while (next < t1) {
          const t = next, len = D - off, src = ctx.createBufferSource(), g = G(off ? 1 : 0); src.buffer = buf;
          if (!off) g.gain.setValueCurveAtTime(FADE_IN, t, X);
          g.gain.setValueCurveAtTime(FADE_OUT, t + len - X, X);
          chain(src, g, out); src.start(t, off); src.stop(t + len); cleanup(src, [src, g]);
          next = t + len - X; off = 0;
        }
      } });
      return out;
    };
    const C = () => { const c = ctx.createConstantSource(); c.offset.value = 0; c.start(); return c; };
    const chain = (...n) => { for (let i = 0; i + 1 < n.length; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };
    const mod = (buf, k, param) => chain(S(buf), G(k)).connect(param);  // медленная случайная модуляция параметра
    const cleanup = (last, nodes) => { last.onended = () => nodes.forEach(n => { try { n.disconnect(); } catch (e) { /* уже отключён */ } }); };
    // огибающие: цепочка линейных отрезков [[dt, v], ...]; спад — «экспонента» из четырёх отрезков
    const env = (p, t, v0, segs) => { p.setValueAtTime(v0, t); for (const [dt, v] of segs) { t += dt; p.linearRampToValueAtTime(v, t); } return t; };
    const decay = (p, t, v, dur) => env(p, t, v, [[dur * 0.2, v * 0.55], [dur * 0.25, v * 0.28], [dur * 0.25, v * 0.11], [dur * 0.3, 0]]);
    const poisson = rate => -Math.log(1 - R()) / rate;

    // мастер: слои → сумма → уровень → мастер (enable/disable) → мягкий компрессор → 12 кГц → анализатор
    const input = G(1); master = G(0);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 2; comp.attack.value = 0.02; comp.release.value = 0.4;
    analyser = ctx.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.6;
    chain(input, G(LEVEL), master, comp, F('lowpass', 12000, 0.5), analyser, ctx.destination);
    const bus = () => { const g = G(0); g.connect(input); return g; };

    // ВЕТЕР: два розовых шума → bandpass с LFO частоты/громкости, панорама ±0.55; порыв (ConstantSource)
    // поднимает громкость и центр полосы, шипит листвой (highpass 2,6 кГц) и свистит в узкой полосе 1,3 кГц.
    layers.push((() => {
      const out = bus(), base = G(1), gust = C();
      const lfoF = chain(O('sine', 0.07), G(170)), lfoA = chain(O('sine', 0.13), G(0.18));
      const gF = chain(gust, G(520)), gA = chain(gust, G(1.7)), gL = chain(gust, G(0.45)), gH = chain(gust, G(0.3));
      for (const [pan, f0] of [[-0.55, 380], [0.55, 470]]) {
        const bp = F('bandpass', f0, 0.7), g = G(1), lg = G(0.05);
        lfoF.connect(bp.frequency); gF.connect(bp.frequency); lfoA.connect(g.gain); gA.connect(g.gain); gL.connect(lg.gain);
        chain(S(N.pink), bp, g, P(pan), base);
        chain(S(N.pink), F('highpass', 2600, 0.5), lg, P(pan * 1.3), base);
      }
      const h1 = G(0), h2 = G(0); gust.connect(h1.gain); gH.connect(h2.gain);   // свист ∝ gust²
      chain(S(N.pink), F('bandpass', 1300, 6), h1, h2, base);
      base.connect(out);
      let next = -1;
      return { name: 'wind', out, sched(t0, t1) {
        if (next < t0) next = t0 + 1 + R() * 3;
        while (next < t1) {
          const I = intensity, k = clamp((0.3 + 0.7 * R()) * (0.3 + 0.7 * I), 0, 1), A = 1 + R(), Rl = 3 + R() * 2;
          env(gust.offset, next, 0, [[A, k]]); decay(gust.offset, next + A, k, Rl);
          emitGust(next, k, A, Rl);
          next += Math.max(A + Rl + 0.4, lerp(6, 3, I) + R() * lerp(14, 6, I));   // 6–20 с при I=0, 3–9 с при I=1
        }
      }, intensity(I) { base.gain.setTargetAtTime(0.55 + 0.45 * I, ctx.currentTime, off ? 0.001 : 0.7); } };
    })());

    // МОРЕ: коричневый шум → lowpass (380 → ~800 Гц на гребне) с огибающей наката периодом 7–11 с;
    // на гребне шипение пены (белый шум, highpass 2 кГц), оба слоя разведены по панораме.
    layers.push((() => {
      const out = bus(), swell = C(), foam = C(), sg = G(0.22), fg = G(0);
      chain(swell, G(0.85)).connect(sg.gain); chain(foam, G(0.4)).connect(fg.gain);
      const lpMod = chain(swell, G(420));
      for (const pan of [-0.6, 0.6]) {
        const lp = F('lowpass', 380, 0.8); lpMod.connect(lp.frequency);
        chain(S(N.brown), lp, P(pan), sg);
        chain(S(N.white), F('highpass', 2000, 0.5), F('lowpass', 8000, 0.5), P(pan * 1.2), fg);
      }
      sg.connect(out); fg.connect(out);
      let next = -1;
      return { name: 'sea', out, sched(t0, t1) {
        if (next < t0) next = t0;
        while (next < t1) {
          const Pd = 7 + R() * 4, pk = 0.6 + R() * 0.4, rise = Pd * 0.38, hold = Pd * 0.08, fall = Pd * 0.54;
          env(swell.offset, next, 0, [[rise * 0.5, pk * 0.3], [rise * 0.5, pk], [hold, pk * 0.9], [fall * 0.4, pk * 0.35], [fall * 0.6, 0]]);
          env(foam.offset, next + rise * 0.65, 0, [[rise * 0.35 + hold * 0.5, pk], [fall * 0.75, 0]]);   // пена чуть позже наката
          next += Pd;
        }
      } };
    })());

    // ЦИКАДЫ: 5 стрекотунов — белый шум в полосе 4,2–7,4 кГц (+ «тело» на 0,55 f) под импульсной АМ
    // 85–140 Гц с дрейфом; фразы 3–8 с с паузами 2–8 с, темп разгоняется на старте; дальний хор фоном.
    layers.push((() => {
      const out = bus(), tone = F('lowpass', 9500, 0.5); tone.connect(out);
      const units = [];
      for (let i = 0; i < 5; i++) {
        const fc = 4200 + R() * 3200, rate = 85 + R() * 55, am = G(0), phrase = G(0), pulse = O('sine', rate), sh = ctx.createWaveShaper();
        sh.curve = PULSE; pulse.connect(sh).connect(am.gain);
        chain(O('sine', 0.08 + R() * 0.2), G(5)).connect(pulse.frequency);
        const s = S(N.white); chain(s, F('bandpass', fc, 5), am); chain(s, F('bandpass', fc * 0.55, 3), G(0.35), am);
        chain(am, phrase, P(-0.8 + R() * 1.6), G(0.8 + R() * 1.0), tone);
        units.push({ phrase, pulse, rate, next: -1, on: false });
      }
      const cam = G(0.5), og = G(0.25); O('sine', 96).connect(og); O('sine', 121).connect(og); og.connect(cam.gain);
      chain(S(N.white), F('bandpass', 5600, 1.2), cam, G(0.4), tone);
      return { name: 'cicadas', out, sched(t0, t1) {
        for (const u of units) {
          if (u.next < t0) u.next = t0 + (u.on ? 0.1 : R() * 3);
          while (u.next < t1) {
            const t = u.next, f = u.pulse.frequency;
            if (u.on) { env(u.phrase.gain, t, 1, [[0.45, 0]]); env(f, t, u.rate, [[0.45, u.rate * 0.7]]); u.next = t + 0.45 + 2 + R() * 6; }
            else { env(u.phrase.gain, t, 0, [[0.7, 1]]); env(f, t, u.rate * 0.6, [[0.7, u.rate]]); u.next = t + 0.7 + 3 + R() * 5; }
            u.on = !u.on;
          }
        }
      } };
    })());

    // КАПЛИ В ПОДВАЛЕ: синус 1,2–3 кГц с быстрым спадом высоты + «тик» зерна → свёртка со сводом (3,2 с).
    layers.push((() => {
      const out = bus(), send = G(1), conv = ctx.createConvolver();
      conv.buffer = makeIR(ctx, 3.2, 1.5, R, [[9, 0.5], [17, 0.4], [26, 0.35], [41, 0.25], [63, 0.2]]);
      chain(send, conv, G(0.9), out); chain(send, G(0.35), out);
      const tick = makeGrain(ctx, 7, 3200, 6, R);
      const drop = (t, f0, lv, pan) => {
        const o = O('sine', f0, t), g = G(0), p = P(pan), s = S(tick, false), sg = G(lv * 0.5);
        o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.5, t + 0.05);
        env(g.gain, t, 0, [[0.002, lv]]); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09 + R() * 0.08); g.gain.setValueAtTime(0, t + 0.2);
        chain(o, g, p, send); chain(s, sg, p); s.start(t); s.stop(t + 0.05); o.stop(t + 0.3);
        cleanup(o, [o, g, p, s, sg]);
      };
      let next = -1;
      return { name: 'drip', out, sched(t0, t1, active) {
        if (next < t0) next = t0 + R() * 2;
        while (next < t1) {
          if (active) {
            const f0 = 1200 + R() * 1800, lv = 0.35 + R() * 0.65, pan = R() - 0.5; drop(next, f0, lv, pan);
            if (R() < 0.35) drop(next + 0.08 + R() * 0.15, f0 * (1.1 + R() * 0.3), lv * 0.5, pan);   // двойная капля
          }
          next += 2 + R() * 7;
        }
      } };
    })());

    // ГУЛ ПОДВАЛА: 50 Гц + биение 50,4 + гармоники 100/150, низкий коричневый шум, дыхание ±20 %.
    layers.push((() => {
      const out = bus(), g = G(1);
      for (const [f, a] of [[50, 1], [50.4, 0.7], [100, 0.4], [150, 0.18]]) chain(O('sine', f), G(a * 0.25), g);
      chain(S(N.brown), F('lowpass', 110, 0.7), G(0.6), g);
      chain(O('sine', 0.11), G(0.2)).connect(g.gain);
      g.connect(out);
      return { name: 'hum', out, sched() {} };
    })());

    // ЧАЙКИ: FM (несущая 1,6–2,5 кГц, модулятор f/2, индекс 2,2) с вибрато 28–40 Гц, взлёт 50 мс и
    // глиссандо вниз; хриплый «выдох» — шум в полосе; 1–3 крика серией раз в 10–30 с; далеко: lowpass 3 кГц.
    layers.push((() => {
      const out = bus(), far = F('lowpass', 3000, 0.7); far.connect(out);
      const cry = (t, f, dur, lv, pan) => {
        const car = O('sine', f, t), md = O('sine', f * 0.5, t), vib = O('sine', 28 + R() * 12, t), g = G(0), bf = F('bandpass', f * 1.1, 2), bg = G(0), p = P(pan);
        const mg = chain(md, G(f * 1.1)), vg = chain(vib, G(f * 0.03)), vg2 = chain(vib, G(f * 0.015));
        mg.connect(car.frequency); vg.connect(car.frequency); vg2.connect(md.frequency);
        for (const [q, k] of [[car.frequency, 1], [md.frequency, 0.5]]) { q.setValueAtTime(f * 0.85 * k, t); q.linearRampToValueAtTime(f * k, t + 0.05); q.setValueAtTime(f * k, t + 0.05 + dur * 0.35); q.exponentialRampToValueAtTime(f * 0.58 * k, t + dur); }
        env(g.gain, t, 0, [[0.03, lv], [dur * 0.65, lv * 0.75], [dur * 0.32, 0]]);
        env(bg.gain, t, 0, [[0.04, lv * 0.3], [dur * 0.6, lv * 0.2], [dur * 0.36, 0]]);
        const br = S(N.white, false); br.start(t, R() * 7); br.stop(t + dur + 0.05);
        chain(car, g, p, far); chain(br, bf, bg, p);
        car.stop(t + dur + 0.05); md.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
        cleanup(car, [car, md, vib, mg, vg, vg2, g, br, bf, bg, p]);
      };
      let next = -1;
      return { name: 'gulls', out, sched(t0, t1, active) {
        if (next < t0) next = t0 + 2 + R() * 6;
        while (next < t1) {
          if (active) {
            const n = 1 + Math.floor(R() * 3), f = 1600 + R() * 900, lv = 0.25 + R() * 0.3, pan = R() * 1.6 - 0.8; let t = next;
            for (let k = 0; k < n; k++) { const d = 0.42 - k * 0.06 + R() * 0.08; cry(t, f * (1 - 0.05 * k), d, lv * (1 - 0.12 * k), pan); t += d + 0.12 + R() * 0.15; }
          }
          next += 10 + R() * 20;
        }
      } };
    })());

    // ДОЖДЬ: плотный белый шум 3–11 кГц с медленным колыханием + гул ливня 700 Гц + капли по листве
    // (зёрна-резонаторы 2–6 кГц, пуассоновский поток ~9/с, случайная панорама и высота).
    layers.push((() => {
      const out = bus(), body = G(1); mod(wanderSlow, 0.25, body.gain); mod(wander, 0.08, body.gain);
      for (const pan of [-0.6, 0.6]) chain(S(N.white), F('highpass', 3000, 0.5), F('lowpass', 11000, 0.5), P(pan), body);
      body.connect(out);
      chain(S(N.pink), F('bandpass', 700, 0.6), G(0.6), out);
      const grains = Array.from({ length: 8 }, () => makeGrain(ctx, 10 + R() * 12, 2000 + R() * 4000, 4 + R() * 6, R));
      const dg = G(0.6); dg.connect(out);
      let next = -1;
      return { name: 'rain', out, sched(t0, t1, active) {
        if (next < t0) next = t0;
        while (next < t1) {
          if (active) {
            const s = S(grains[Math.floor(R() * grains.length)], false), g = G(0.2 + R() * 0.5), p = P(R() * 1.6 - 0.8);
            s.playbackRate.value = 0.7 + R() * 0.8; chain(s, g, p, dg); s.start(next); s.stop(next + 0.06); cleanup(s, [s, g, p]);
          }
          next += poisson(9);
        }
      } };
    })());

    // ОГОНЬ: низкий гул пламени (коричневый шум < 260 Гц) с дрожанием 5 Гц, шелест 1,8 кГц,
    // треск — зёрна 1–3 кГц по 4–20 мс, 5–6 в секунду, изредка низкий хлопок.
    layers.push((() => {
      const out = bus(), roar = G(0.6), hiss = G(0.14);
      mod(wander, 0.35, roar.gain); chain(S(N.brown), F('lowpass', 260, 0.7), roar, out);
      mod(wander, 0.1, hiss.gain); chain(S(N.pink), F('bandpass', 1800, 0.6), hiss, out);
      const cr = Array.from({ length: 8 }, () => makeGrain(ctx, 4 + R() * 16, 1000 + R() * 2000, 3 + R() * 5, R)), pop = makeGrain(ctx, 60, 160, 2, R);
      const cg = G(0.7); cg.connect(out);
      let next = -1;
      return { name: 'fire', out, sched(t0, t1, active) {
        if (next < t0) next = t0;
        while (next < t1) {
          if (active) {
            const big = R() < 0.08, s = S(big ? pop : cr[Math.floor(R() * cr.length)], false), g = G(big ? 0.9 : 0.25 + R() * 0.75), p = P(R() * 0.9 - 0.45);
            s.playbackRate.value = 0.8 + R() * 0.6; chain(s, g, p, cg); s.start(next); s.stop(next + 0.12); cleanup(s, [s, g, p]);
          }
          next += poisson(5.5);
        }
      } };
    })());

    setMix(target, 0.02); setIntensity(intensity);
  }

  function emitGust(t, k, A, Rl) {
    if (off) { gustLog.push({ t, k, attack: A, release: Rl }); return; }
    const id = setTimeout(() => {
      gustTimers.delete(id); const s = reduced ? k * 0.5 : k;
      gustCbs.forEach(cb => { try { cb(s, { attack: A, release: Rl }); } catch (e) { console.error(e); } });
    }, Math.max(0, (t - ctx.currentTime) * 1000));
    gustTimers.add(id);
  }
  function tick() {
    if (!ctx || ctx.state !== 'running') return;
    const t0 = ctx.currentTime, t1 = t0 + (typeof document !== 'undefined' && document.hidden ? 40 : LOOK);
    for (const L of loops) L.sched(t0, t1);
    for (const L of layers) L.sched(t0, t1, target[L.name] > 0.004);
  }
  function setMix(mix = {}, seconds = 2.5) {
    for (const k of LAYERS) target[k] = clamp(+mix[k] || 0, 0, 1);
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const L of layers) { const g = L.out.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(target[L.name] * TRIM[L.name], t + Math.max(0.01, seconds)); }
  }
  function setIntensity(v) { intensity = clamp(+v || 0, 0, 1); for (const L of layers) if (L.intensity) L.intensity(intensity); }
  function enable() {
    if (off) return;
    if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'playback' }); build(); }
    enabledFlag = true; clearTimeout(suspendTimer);
    const p = ctx.resume();   // внутри жеста пользователя
    const t = ctx.currentTime, g = master.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(1, t + 2);
    if (!ticker) { ticker = setInterval(tick, 250); tick(); }
    return p;
  }
  function disable() {
    if (off || !ctx || !enabledFlag) return;
    enabledFlag = false;
    const t = ctx.currentTime, g = master.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + 1);
    gustTimers.forEach(clearTimeout); gustTimers.clear(); clearTimeout(suspendTimer);
    suspendTimer = setTimeout(() => { if (!enabledFlag) { clearInterval(ticker); ticker = 0; ctx.suspend(); } }, 1100);
  }
  function level() {   // RMS мастера по анализатору, 0..1
    if (!analyser) return 0;
    const a = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(a);
    let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i]; return Math.sqrt(s / a.length);
  }
  // Офлайн-рендер: один раз на экземпляр (OfflineAudioContext рендерит однократно).
  async function render(mix, I = 0.5) {
    if (!off) throw new Error('render(): нужен createSound({ offline: { seconds } })');
    const sr = off.sampleRate || 48000;
    if (!ctx) { ctx = new OfflineAudioContext(2, Math.ceil(off.seconds * sr), sr); build(); }
    setIntensity(I); setMix(mix, 0.05);
    master.gain.setValueAtTime(0, 0); master.gain.linearRampToValueAtTime(1, 0.05);
    for (const L of loops) L.sched(0, off.seconds + 1);
    for (const L of layers) L.sched(0, off.seconds + 1, target[L.name] > 0.004);
    return ctx.startRendering();
  }
  function destroy() {
    disable(); clearTimeout(suspendTimer); clearInterval(ticker); ticker = 0;
    if (ctx) { const c = ctx; ctx = null; layers = []; loops = []; c.close?.(); }
  }

  return {
    enable, disable, setMix, setIntensity, level, render, destroy,
    get enabled() { return enabledFlag; },
    get context() { return ctx; },
    get analyser() { return analyser; },
    get gusts() { return gustLog; },   // офлайн: список порывов { t, k, attack, release }
    onGust(cb) { gustCbs.add(cb); return () => gustCbs.delete(cb); }
  };
}

// Пресет → AudioBuffer через OfflineAudioContext (для приёмки, WAV и спектрограмм).
export async function renderPreset(mix, seconds = 8, o = {}) {
  return createSound({ offline: { seconds, sampleRate: o.sampleRate || 48000 }, seed: o.seed }).render(mix, o.intensity ?? 0.5);
}
// AudioBuffer → WAV (PCM 16 бит) Blob.
export function bufferToWav(buf) {
  const ch = buf.numberOfChannels, n = buf.length, bytes = 44 + n * ch * 2, dv = new DataView(new ArrayBuffer(bytes));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); dv.setUint32(4, bytes - 8, true); str(8, 'WAVE'); str(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
  dv.setUint16(22, ch, true); dv.setUint32(24, buf.sampleRate, true); dv.setUint32(28, buf.sampleRate * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true);
  str(36, 'data'); dv.setUint32(40, n * ch * 2, true);
  const chans = Array.from({ length: ch }, (_, c) => buf.getChannelData(c)); let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = clamp(chans[c][i], -1, 1); dv.setInt16(o, v < 0 ? v * 32768 : v * 32767, true); o += 2; }
  return new Blob([dv.buffer], { type: 'audio/wav' });
}
