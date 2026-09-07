// «Из ничего» — материя долины.
// Строит состояния 262 144 точек света: пыль, настоящий рельеф Козской долины и Меганома
// (высоты AWS Terrain Tiles, 13,5 м/px), год «1888», своды голицынских подвалов, ряды лозы.
// Каждое состояние — позиция (xyz + запас), цвет или нормаль (rgb) + размер (a), касательная (rgb) + материал (a).

export const SIDE = 512;
export const N = SIDE * SIDE;
export const U = { size: 1024, mpp: 13.53, unit: 100, exag: 1.6 };
export const S = { DUST: 0, RELIEF: 1, YEAR: 2, CELLAR: 3, VINES: 4, COUNT: 5 };

const PX = U.mpp / U.unit;               // единиц мира на пиксель карты высот (1 единица = 100 м)
export const wx = (i) => (i - 512) * PX;
export const wz = (j) => (j - 512) * PX;
export const wy = (h) => (h / U.unit) * U.exag;

// Материалы (aux.a)
export const M = { SEA: 0, LAND: 1, FIELD: 2, PLAIN: 255, GLOW: 254 };

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Шум значений для лоскутов полей
function vnoise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const h = (a, b) => { let n = (a * 374761393 + b * 668265263) | 0; n = (n ^ (n >> 13)) * 1274126177; n = n ^ (n >> 16); return ((n >>> 0) % 10007) / 10007; };
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
}

export function loadHeights(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth, h = img.naturalHeight;
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, w, h).data;
      const H = new Float32Array(w * h);
      for (let k = 0, p = 0; k < w * h; k++, p += 4) {
        const v = d[p] * 256 + d[p + 1] + d[p + 2] / 256 - 32768;
        H[k] = v < 0.5 ? 0 : v;
      }
      resolve({ h: H, w, hgt: h });
    };
    img.onerror = () => reject(new Error('dem load failed'));
    img.src = url;
  });
}

export function makeSampler(dem) {
  const H = dem.h, W = dem.w;
  return function sampleH(x, z) {
    let fi = x / PX + 512, fj = z / PX + 512;
    fi = Math.max(0, Math.min(W - 1.001, fi)); fj = Math.max(0, Math.min(W - 1.001, fj));
    const i = fi | 0, j = fj | 0, u = fi - i, v = fj - j;
    const a = H[j * W + i], b = H[j * W + i + 1], c = H[(j + 1) * W + i], d = H[(j + 1) * W + i + 1];
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  };
}

// уступить кадр без setTimeout: в фоновой вкладке таймеры душатся до 1 с
const tick = () => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });

export async function buildStates(dem, opts = {}) {
  const onProgress = opts.onProgress || (() => {});
  const rand = mulberry32(1888);
  const H = dem.h, W = dem.w;
  const sampleH = makeSampler(dem);

  const pos = new Float32Array(N * 4 * S.COUNT);
  const col = new Uint8Array(N * 4 * S.COUNT);
  const aux = new Uint8Array(N * 4 * S.COUNT);
  const K = new Array(S.COUNT).fill(0);

  // put: цвет в диапазоне 0..2 (байт = c/2), размер в единицах масштаба состояния (0..1), касательная -1..1
  function put(s, i, x, y, z, r, g, b, size01, tx, ty, tz, mat) {
    const o = (s * N + i) * 4;
    pos[o] = x; pos[o + 1] = y; pos[o + 2] = z; pos[o + 3] = 0;
    col[o] = Math.max(0, Math.min(255, r * 127.5)) | 0;
    col[o + 1] = Math.max(0, Math.min(255, g * 127.5)) | 0;
    col[o + 2] = Math.max(0, Math.min(255, b * 127.5)) | 0;
    col[o + 3] = Math.max(0, Math.min(255, size01 * 255)) | 0;
    aux[o] = (tx * 127.5 + 127.5) | 0; aux[o + 1] = (ty * 127.5 + 127.5) | 0; aux[o + 2] = (tz * 127.5 + 127.5) | 0;
    aux[o + 3] = mat;
  }
  // put для рельефа: в col.rgb — нормаль
  function putN(s, i, x, y, z, nx, ny, nz, size01, tx, ty, tz, mat) {
    const o = (s * N + i) * 4;
    pos[o] = x; pos[o + 1] = y; pos[o + 2] = z; pos[o + 3] = 0;
    col[o] = (nx * 127.5 + 127.5) | 0; col[o + 1] = (ny * 127.5 + 127.5) | 0; col[o + 2] = (nz * 127.5 + 127.5) | 0;
    col[o + 3] = Math.max(0, Math.min(255, size01 * 255)) | 0;
    aux[o] = (tx * 127.5 + 127.5) | 0; aux[o + 1] = (ty * 127.5 + 127.5) | 0; aux[o + 2] = (tz * 127.5 + 127.5) | 0;
    aux[o + 3] = mat;
  }
  function copyRelief(s, i) {
    const a = (S.RELIEF * N + i) * 4, o = (s * N + i) * 4;
    pos[o] = pos[a]; pos[o + 1] = pos[a + 1]; pos[o + 2] = pos[a + 2]; pos[o + 3] = pos[a + 3];
    col[o] = col[a]; col[o + 1] = col[a + 1]; col[o + 2] = col[a + 2]; col[o + 3] = col[a + 3];
    aux[o] = aux[a]; aux[o + 1] = aux[a + 1]; aux[o + 2] = aux[a + 2]; aux[o + 3] = aux[a + 3];
  }

  // ---------- 1. РЕЛЬЕФ ----------
  const land = [], sea = [];
  for (let j = 2; j < W - 2; j++) for (let i = 2; i < W - 2; i++) (H[j * W + i] > 0.5 ? land : sea).push(j * W + i);
  const NSEA = Math.round(N * 0.08);
  // перестановка: где будут морские точки среди индексов (равномерно, случайно)
  const isSea = new Uint8Array(N);
  { let c = 0; while (c < NSEA) { const k = (rand() * N) | 0; if (!isSea[k]) { isSea[k] = 1; c++; } } }
  // Земля начерчена горизонталями: точки ложатся на изолинии через STEP метров (как на гравированной карте),
  // между линиями — редкая россыпь. Пересечения горизонталей с рёбрами сетки высот — как в marching squares.
  const STEP = 8, FILL = 0.24;
  const NLAND = N - NSEA;
  const NLINE = Math.round(NLAND * (1 - FILL));
  // проход 1: сколько всего пересечений
  const levels = (a, b) => {
    if (a < 0.5 && b < 0.5) return 0;
    if (a < 0.5 || b < 0.5) return 1;                  // береговая линия
    const lo = a < b ? a : b, hi = a < b ? b : a;
    return Math.floor(hi / STEP) - Math.floor(lo / STEP);
  };
  let total = 0;
  for (let j = 1; j < W - 2; j++) for (let i = 1; i < W - 2; i++) {
    const h0 = H[j * W + i];
    total += levels(h0, H[j * W + i + 1]) + levels(h0, H[(j + 1) * W + i]);
  }
  const keepP = Math.min(1, NLINE / total);
  // порядок индексов земли — случайный, чтобы любой префикс индексов был равномерной выборкой рельефа
  const landSlots = new Int32Array(NLAND);
  { let c = 0; for (let n = 0; n < N; n++) if (!isSea[n]) landSlots[c++] = n; }
  for (let i = NLAND - 1; i > 0; i--) { const j = (rand() * (i + 1)) | 0; const t = landSlots[i]; landSlots[i] = landSlots[j]; landSlots[j] = t; }
  let slot = 0;
  const emitLand = (x, z, h, gx, gz, onLine) => {
    const n = landSlots[slot++];
    const y = wy(h);
    let nx = -gx * U.exag, ny = 1, nz = -gz * U.exag;
    const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    let tx = -gz, tz = gx; const tl = Math.hypot(tx, tz);
    if (tl < 1e-6) { const ta = rand() * Math.PI * 2; tx = Math.cos(ta); tz = Math.sin(ta); } else { tx /= tl; tz /= tl; }
    const slope = Math.hypot(gx, gz);
    let mat = M.LAND;
    if (slope < 0.14 && h > 15 && h < 230 && x > -46 && x < 22 && z > -46 && z < 22) {
      const nz1 = vnoise2(x * 0.28 + 3.1, z * 0.28 + 7.7);
      const nz2 = vnoise2(x * 0.9, z * 0.9);
      if (nz1 * 0.7 + nz2 * 0.3 > 0.5) mat = M.FIELD;
    }
    putN(S.RELIEF, n, x, y, z, nx, ny, nz, onLine ? 0.24 + rand() * 0.08 : 0.10 + rand() * 0.06, tx, 0, tz, mat);
  };
  const gradAt = (i, j) => [(H[j * W + i + 1] - H[j * W + i - 1]) / (2 * U.mpp), (H[(j + 1) * W + i] - H[(j - 1) * W + i]) / (2 * U.mpp)];
  // проход 2: точки на пересечениях
  const edge = (i, j, di, dj, h0, h1) => {
    const cnt = levels(h0, h1);
    for (let c = 0; c < cnt; c++) {
      if (rand() > keepP || slot >= NLINE) continue;
      let lvl;
      if (h0 < 0.5 || h1 < 0.5) lvl = 0.5;
      else { const lo = Math.min(h0, h1); lvl = (Math.floor(lo / STEP) + 1 + c) * STEP; }
      const t = (lvl - h0) / (h1 - h0);
      const fi = i + di * t + (rand() - 0.5) * 0.25, fj = j + dj * t + (rand() - 0.5) * 0.25;
      const g = gradAt(i, j);
      emitLand(wx(fi), wz(fj), Math.max(lvl, 0.5), g[0], g[1], true);
    }
  };
  for (let j = 1; j < W - 2; j++) for (let i = 1; i < W - 2; i++) {
    const h0 = H[j * W + i];
    edge(i, j, 1, 0, h0, H[j * W + i + 1]);
    edge(i, j, 0, 1, h0, H[(j + 1) * W + i]);
  }
  // россыпь между линиями
  while (slot < NLAND) {
    const k = land[(rand() * land.length) | 0];
    const pi = k % W, pj = (k / W) | 0;
    const x = wx(pi + rand() - 0.5), z = wz(pj + rand() - 0.5);
    const h = sampleH(x, z); if (h < 0.5) continue;
    const g = gradAt(pi, pj);
    emitLand(x, z, h, g[0], g[1], false);
  }
  for (let n = 0; n < N; n++) {
    if (!isSea[n]) continue;
    const k = sea[(rand() * sea.length) | 0];
    const i = (k % W) + rand() - 0.5, j = ((k / W) | 0) + rand() - 0.5;
    const ta = rand() * Math.PI * 2;
    putN(S.RELIEF, n, wx(i), 0.0, wz(j), 0, 1, 0, 0.12 + rand() * 0.08, Math.cos(ta), 0, Math.sin(ta), M.SEA);
  }
  K[S.RELIEF] = 0;
  onProgress(0.35); await tick();

  // ---------- 0. ПЫЛЬ (до восхода) ----------
  {
    const c = opts.heroCam || { pos: [40, 24, 78], tgt: [-6, 4, -12] };
    for (let n = 0; n < N; n++) {
      const t = rand();
      // объём между камерой и долиной, чуть шире кадра
      const x = c.pos[0] + (c.tgt[0] - c.pos[0]) * t + (rand() - 0.5) * (30 + 90 * t);
      const z = c.pos[2] + (c.tgt[2] - c.pos[2]) * t + (rand() - 0.5) * (30 + 90 * t);
      const y = (rand() * rand()) * (12 + 30 * t) + 0.2;
      const ta = rand() * Math.PI * 2;
      const b = 0.5 + rand() * 0.5;
      put(S.DUST, n, x, y, z, 1.3 * b, 0.95 * b, 0.55 * b, 0.12 + rand() * 0.12, Math.cos(ta), 0, Math.sin(ta), M.PLAIN);
    }
    K[S.DUST] = N;
  }
  onProgress(0.45); await tick();

  // ---------- 2. ГОД «1888» ----------
  {
    const KY = 100000;
    const cw = 1600, ch = 640;
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = '#fff';
    ctx.font = '300 560px "Cormorant", "Cormorant Garamond", Georgia, serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('1888', cw / 2, ch / 2 + 16);
    const d = ctx.getImageData(0, 0, cw, ch).data;
    const inside = (x, y) => x >= 0 && y >= 0 && x < cw && y < ch && d[(y * cw + x) * 4] > 120;
    const pts = [];
    for (let y = 1; y < ch - 1; y++) for (let x = 1; x < cw - 1; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      if (edge) { pts.push(x, y, 1); pts.push(x, y, 1); }
      else if ((y % 3) === 0 || rand() < 0.08) pts.push(x, y, 0);
    }
    const np = pts.length / 3;
    const width = 30, sc = width / cw;
    const cx = 24, cy = 13.5, cz = -2;
    for (let n = 0; n < KY; n++) {
      const k = (rand() * np) | 0;
      const px = pts[k * 3] + rand() - 0.5, py = pts[k * 3 + 1] + rand() - 0.5, edge = pts[k * 3 + 2];
      const x = cx + (px - cw / 2) * sc, y = cy - (py - ch / 2) * sc, z = cz + (rand() - 0.5) * 0.9;
      const b = edge ? 1.15 : 0.75 + rand() * 0.25;
      put(S.YEAR, n, x, y, z, 1.0 * b, 0.84 * b, 0.55 * b, edge ? 0.22 : 0.16, 1, 0, 0, M.PLAIN);
    }
    for (let n = KY; n < N; n++) copyRelief(S.YEAR, n);
    K[S.YEAR] = KY;
  }
  onProgress(0.6); await tick();

  // ---------- 3. ПОДВАЛ (свод в овраге у Богатовки — Архадерессе) ----------
  const cellar = {};
  {
    const KC = 150000;
    const mouthX = wx(343), mouthZ = wz(271);
    const groundY = wy(sampleH(mouthX, mouthZ));
    // ось — в гору (градиент высот у Богатовки: на СЗ)
    let ax = -0.37, az = -0.93; const al = Math.hypot(ax, az); ax /= al; az /= al;
    const rx = az, rz = -ax;               // вправо от оси
    const O = [mouthX, groundY, mouthZ];
    const LEN = 1.2, HW = 0.036, WALL = 0.02, R = 0.036;
    const lanterns = [];
    for (let k = 0; k < 10; k++) lanterns.push({ u: 0.07 + k * 0.118, v: (k % 2 ? 1 : -1) * 0.030, w: 0.027 });
    const P = (u, v, w) => [O[0] + ax * u + rx * v, O[1] + w, O[2] + az * u + rz * v];
    const light = (u, v, w) => {
      let L = 0.05;
      for (const l of lanterns) { const du = (u - l.u), dv = (v - l.v), dw = (w - l.w); const dd = (du * du + dv * dv + dw * dw) / (0.055 * 0.055); L += 0.85 / (1 + dd); }
      return L;
    };
    const dayL = (u) => 0.9 * Math.exp(-u / 0.14);
    const stone = [0.66, 0.58, 0.47], lamp = [1.0, 0.76, 0.48], day = [0.95, 0.9, 0.85];
    let n = 0;
    const putStone = (u, v, w, tx, ty, tz, size, boost) => {
      const p = P(u, v, w);
      const L = light(u, v, w) * boost, D = dayL(u) * boost;
      put(S.CELLAR, n++, p[0], p[1], p[2],
        stone[0] * (L * lamp[0] + D * day[0]), stone[1] * (L * lamp[1] + D * day[1]), stone[2] * (L * lamp[2] + D * day[2]),
        size, tx, ty, tz, M.PLAIN);
    };
    // профиль свода: s∈[0,1]
    const profile = (s) => {
      if (s < 0.22) return { v: -HW, w: (s / 0.22) * WALL, t: [0, 1, 0] };
      if (s > 0.78) return { v: HW, w: (1 - (s - 0.78) / 0.22) * WALL, t: [0, -1, 0] };
      const th = Math.PI * (1 - (s - 0.22) / 0.56);
      return { v: Math.cos(th) * R, w: WALL + Math.sin(th) * R, t: [-Math.sin(th), Math.cos(th), 0] };
    };
    const tanW = (t) => [rx * t[0], t[1], rz * t[0]]; // касательная профиля в мире
    // кольца-арки (ряды кладки)
    for (let ring = 0; ring < 170 && n < KC - 60000; ring++) {
      const u = 0.01 + ring * 0.007;
      for (let q = 0; q < 420; q++) {
        const s = (q + rand()) / 420; const pr = profile(s); const t = tanW(pr.t);
        putStone(u, pr.v + (rand() - 0.5) * 0.0004, pr.w + (rand() - 0.5) * 0.0004, t[0], t[1], t[2], 0.05 + rand() * 0.03, 1.4);
      }
    }
    // заполнение поверхности свода
    const fillCount = 30000;
    for (let k = 0; k < fillCount; k++) {
      const u = rand() * LEN, s = rand(); const pr = profile(s); const t = tanW(pr.t);
      putStone(u, pr.v, pr.w, t[0], t[1], t[2], 0.045 + rand() * 0.03, 0.7);
    }
    // пол
    for (let k = 0; k < 9000; k++) {
      const u = rand() * LEN, v = (rand() - 0.5) * 2 * (HW - 0.003);
      const p = P(u, v, 0.0005);
      const L = light(u, v, 0) * 0.7, D = dayL(u) * 0.7;
      put(S.CELLAR, n++, p[0], p[1], p[2], 0.35 * (L * lamp[0] + D), 0.32 * (L * lamp[1] + D), 0.3 * (L * lamp[2] + D), 0.07 + rand() * 0.04, ax, 0, az, M.PLAIN);
    }
    // бочки вдоль стен: обручи
    const wood = [0.42, 0.28, 0.16];
    for (let side = -1; side <= 1; side += 2) {
      for (let b = 0; b < 46; b++) {
        const u0 = 0.05 + b * 0.0245, vC = side * 0.0245, wC = 0.0075, rb = 0.0046;
        for (let hoop = 0; hoop < 3; hoop++) {
          const u = u0 + hoop * 0.0045 - 0.0045;
          for (let q = 0; q < 36; q++) {
            const th = (q + rand()) / 36 * Math.PI * 2;
            const v = vC + Math.cos(th) * rb, w = wC + Math.sin(th) * rb;
            const p = P(u, v, w);
            const L = light(u, v, w), D = dayL(u);
            const ring = hoop === 1 ? 0.55 : 0.75;
            const t = tanW([-Math.sin(th), Math.cos(th), 0]);
            put(S.CELLAR, n++, p[0], p[1], p[2], ring * (L * lamp[0] + D), ring * 0.9 * (L * lamp[1] + D), ring * 0.8 * (L * lamp[2] + D), 0.09, t[0], t[1], t[2], M.PLAIN);
          }
        }
        // тело бочки — редкие точки дерева
        for (let q = 0; q < 40; q++) {
          const th = rand() * Math.PI * 2, u = u0 + (rand() - 0.5) * 0.009;
          const v = vC + Math.cos(th) * rb * 0.98, w = wC + Math.sin(th) * rb * 0.98;
          const p = P(u, v, w);
          const L = light(u, v, w), D = dayL(u);
          put(S.CELLAR, n++, p[0], p[1], p[2], wood[0] * (L * lamp[0] + D), wood[1] * (L * lamp[1] + D), wood[2] * (L * lamp[2] + D), 0.06, ax, 0, az, M.PLAIN);
        }
      }
    }
    // фонари
    for (const l of lanterns) {
      for (let q = 0; q < 60; q++) {
        const r = rand() * 0.0022, th = rand() * Math.PI * 2, ph = (rand() - 0.5) * Math.PI;
        const p = P(l.u + r * Math.cos(th) * Math.cos(ph), l.v + r * Math.sin(th) * Math.cos(ph), l.w + r * Math.sin(ph));
        const b = 1.2 + rand() * 0.8;
        put(S.CELLAR, n++, p[0], p[1], p[2], 1.0 * b, 0.78 * b, 0.45 * b, 0.2 + rand() * 0.15, 1, 0, 0, M.GLOW);
      }
    }
    // добор до KC — ещё точки свода
    while (n < KC) {
      const u = rand() * LEN, s = rand(); const pr = profile(s); const t = tanW(pr.t);
      putStone(u, pr.v, pr.w, t[0], t[1], t[2], 0.045 + rand() * 0.03, 0.7);
    }
    for (let i = KC; i < N; i++) copyRelief(S.CELLAR, i);
    K[S.CELLAR] = KC;
    cellar.origin = O; cellar.axis = [ax, 0, az]; cellar.right = [rx, 0, rz];
    cellar.camPos = P(0.52, 0.027, 0.019);
    cellar.camTgt = P(-0.55, -0.028, 0.006);
    cellar.fov = 60;
  }
  onProgress(0.75); await tick();

  // ---------- 4. ЛОЗА (склон у моря, Козская долина) ----------
  const vines = {};
  {
    // Виноградники Архадерессе: ряды на склоне у Богатовки, вид с высоты — ряды как линии света вдоль склона
    const KV = 150000;
    const x0 = -25.0, x1 = -13.0, z0 = -33.0, z1 = -21.0;
    const rows = 190, perRow = 780;
    const dx = (x1 - x0) / rows;
    let n = 0;
    const leaf1 = [0.42, 0.50, 0.16], leaf2 = [0.86, 0.70, 0.30];
    // край поля — не прямоугольник, а мягкая форма по шуму; несколько клиньев-разрывов между участками
    const inField = (x, z) => {
      const u = (x - x0) / (x1 - x0), v = (z - z0) / (z1 - z0);
      const e = Math.min(u, 1 - u, v, 1 - v);
      if (e < 0.05 + 0.18 * vnoise2(x * 0.6 + 11, z * 0.6 + 5)) return false;
      const gap = vnoise2(x * 0.35 + 3, z * 0.35 + 9);
      return gap > 0.36;
    };
    for (let r = 0; r < rows && n < KV; r++) {
      const x = x0 + (r + 0.5) * dx + Math.sin(r * 0.37) * 0.003;
      for (let q = 0; q < perRow && n < KV; q++) {
        const z = z0 + (q + rand()) / perRow * (z1 - z0);
        if (!inField(x, z)) continue;
        const g = wy(sampleH(x, z));
        const t = rand(), b = 0.55 + rand() * 0.7;
        const y = g + 0.010 + rand() * 0.006;
        put(S.VINES, n++, x + (rand() - 0.5) * 0.003, y, z,
          (leaf1[0] * (1 - t) + leaf2[0] * t) * b, (leaf1[1] * (1 - t) + leaf2[1] * t) * b, (leaf1[2] * (1 - t) + leaf2[2] * t) * b,
          0.14 + rand() * 0.08, 0, 0, 1, M.PLAIN);
      }
    }
    // редкие миндальные деревья по краям участков — тёплые точки повыше
    while (n < KV) {
      const x = x0 + rand() * (x1 - x0), z = z0 + rand() * (z1 - z0);
      if (inField(x, z)) continue;
      const u = (x - x0) / (x1 - x0), v = (z - z0) / (z1 - z0);
      if (Math.min(u, 1 - u, v, 1 - v) < 0.03) continue;
      const g = wy(sampleH(x, z));
      put(S.VINES, n++, x, g + 0.03 + rand() * 0.03, z, 0.55, 0.42, 0.24, 0.16 + rand() * 0.1, 0, 1, 0, M.PLAIN);
    }
    for (let i = KV; i < N; i++) copyRelief(S.VINES, i);
    K[S.VINES] = KV;
    const fcx = (x0 + x1) / 2, fcz = (z0 + z1) / 2;
    const fy = wy(sampleH(fcx, fcz));
    vines.camPos = [fcx + 3.8, fy + 1.5, fcz + 5.2];
    vines.camTgt = [fcx - 1.2, fy + 0.05, fcz - 1.6];
    vines.fov = 50;
  }
  onProgress(0.9); await tick();

  return { pos, col, aux, K, meta: { cellar, vines }, sampleH };
}
