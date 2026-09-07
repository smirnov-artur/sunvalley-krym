// «Живопись» — разложение картины на мазки (по Хертцманну: от крупных к мелким, мелкие — только там, где есть деталь).
// Каждый мазок: положение, глубина (из карты глубины), направление вдоль формы (структурный тензор), длина по когерентности,
// цвет из размытой копии слоя. Работает на CPU при загрузке, ~100–300 мс на картину.

export async function loadImage(url, maxW = 1600) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('img ' + url)); i.src = url; });
  const s = Math.min(1, maxW / img.naturalWidth);
  const w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  return { w, h, data: ctx.getImageData(0, 0, w, h).data, el: img, canvas: c };
}

// суммарная таблица для быстрого box-blur
function sat(src, w, h) {
  const S = new Float64Array((w + 1) * (h + 1));
  for (let y = 1; y <= h; y++) {
    let row = 0;
    for (let x = 1; x <= w; x++) { row += src[(y - 1) * w + (x - 1)]; S[y * (w + 1) + x] = S[(y - 1) * (w + 1) + x] + row; }
  }
  return S;
}
function boxBlur(src, w, h, r) {
  r = Math.max(1, Math.round(r));
  const S = sat(src, w, h), out = new Float32Array(w * h), W1 = w + 1;
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const sum = S[y1 * W1 + x1] - S[y0 * W1 + x1] - S[y1 * W1 + x0] + S[y0 * W1 + x0];
      out[y * w + x] = sum / ((y1 - y0) * (x1 - x0));
    }
  }
  return out;
}

function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function makeStrokes(img, depth, opts = {}) {
  const { w, h, data } = img;
  const rand = mulberry32(opts.seed || 7);
  const R = new Float32Array(w * h), G = new Float32Array(w * h), B = new Float32Array(w * h);
  for (let i = 0, p = 0; i < w * h; i++, p += 4) { R[i] = data[p] / 255; G[i] = data[p + 1] / 255; B[i] = data[p + 2] / 255; }
  // глубина: 0..1, ближе = больше
  const dW = depth.w, dH = depth.h, dD = depth.data;
  const depthAt = (u, v) => {
    const fx = Math.min(dW - 1.001, Math.max(0, u * (dW - 1))), fy = Math.min(dH - 1.001, Math.max(0, v * (dH - 1)));
    const x = fx | 0, y = fy | 0, tx = fx - x, ty = fy - y;
    const i00 = (y * dW + x) * 4, i10 = i00 + 4, i01 = i00 + dW * 4, i11 = i01 + 4;
    return ((dD[i00] * (1 - tx) + dD[i10] * tx) * (1 - ty) + (dD[i01] * (1 - tx) + dD[i11] * tx) * ty) / 255;
  };
  const layers = opts.layers || [
    { r: 0.011, sp: 0.0115, thr: -1 },
    { r: 0.0055, sp: 0.0052, thr: 0.03 },
    { r: 0.0028, sp: 0.0026, thr: 0.045 },
  ];
  const out = [];
  let prevL = null;
  for (let li = 0; li < layers.length; li++) {
    const L = layers[li];
    const rp = Math.max(1.5, L.r * w);
    const br = Math.max(1, Math.round(rp * 0.55));
    const Rb = boxBlur(R, w, h, br), Gb = boxBlur(G, w, h, br), Bb = boxBlur(B, w, h, br);
    const Lum = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) Lum[i] = 0.299 * Rb[i] + 0.587 * Gb[i] + 0.114 * Bb[i];
    // градиент и структурный тензор
    const Jxx = new Float32Array(w * h), Jyy = new Float32Array(w * h), Jxy = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = (Lum[i + 1] - Lum[i - 1]) * 0.5, gy = (Lum[i + w] - Lum[i - w]) * 0.5;
      Jxx[i] = gx * gx; Jyy[i] = gy * gy; Jxy[i] = gx * gy;
    }
    const tr = Math.max(2, Math.round(rp * 1.2));
    const Sxx = boxBlur(Jxx, w, h, tr), Syy = boxBlur(Jyy, w, h, tr), Sxy = boxBlur(Jxy, w, h, tr);
    const sp = Math.max(2, L.sp * w);
    const cols = Math.ceil(w / sp), rows = Math.ceil(h / sp);
    for (let ry = 0; ry < rows; ry++) for (let cx = 0; cx < cols; cx++) {
      const x = Math.min(w - 2, Math.max(1, (cx + 0.5) * sp + (rand() - 0.5) * sp * 0.9));
      const y = Math.min(h - 2, Math.max(1, (ry + 0.5) * sp + (rand() - 0.5) * sp * 0.9));
      const i = (y | 0) * w + (x | 0);
      if (L.thr > 0 && prevL) {
        // деталь: насколько тонкий слой отличается от предыдущего (мазки только там, где нужно)
        const d = Math.abs(Rb[i] - prevL.R[i]) + Math.abs(Gb[i] - prevL.G[i]) + Math.abs(Bb[i] - prevL.B[i]);
        if (d < L.thr * (0.6 + rand() * 0.8)) continue;
      }
      const u0 = x / w, v0 = y / h;
      const a = Sxx[i], b = Syy[i], c = Sxy[i];
      const ang = 0.5 * Math.atan2(2 * c, a - b) + Math.PI / 2; // вдоль формы
      const l1 = 0.5 * (a + b + Math.sqrt((a - b) * (a - b) + 4 * c * c)), l2 = 0.5 * (a + b - Math.sqrt((a - b) * (a - b) + 4 * c * c));
      const coh = (l1 + l2) > 1e-7 ? (l1 - l2) / (l1 + l2) : 0;
      // на границе глубины мазок короче, чтобы не размазывать край предмета
      const dg = Math.abs(depthAt(u0 + 0.004, v0) - depthAt(u0 - 0.004, v0)) + Math.abs(depthAt(u0, v0 + 0.006) - depthAt(u0, v0 - 0.006));
      const cut = Math.max(0.55, 1 - dg * 3.0);
      const len = rp * (1.5 + 2.0 * coh) * (0.85 + rand() * 0.3) * cut;
      const wid = rp * (0.85 + rand() * 0.3);
      const jit = 1 + (rand() - 0.5) * 0.08;
      const cr = Math.min(1, Rb[i] * jit), cg = Math.min(1, Gb[i] * jit), cb = Math.min(1, Bb[i] * jit);
      const u = x / w, v = y / h;
      out.push(li, u, v, depthAt(u, v), ang, len / w, wid / w, cr, cg, cb, rand());
    }
    prevL = { R: Rb, G: Gb, B: Bb };
  }
  const n = out.length / 11;
  return { n, a: new Float32Array(out), w, h };
}

// Пары мазков между двумя картинами: по сетке, чтобы мазок «перекрашивался на месте», а не летел через холст.
export function pairStrokes(A, B, N) {
  const cells = 40, cellsY = 22;
  const buckets = new Map();
  for (let j = 0; j < B.n; j++) {
    const u = B.a[j * 11 + 1], v = B.a[j * 11 + 2], L = B.a[j * 11];
    const k = L * 100000 + ((v * cellsY) | 0) * cells + ((u * cells) | 0);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(j);
  }
  const used = new Uint8Array(B.n);
  // пара ищется в том же слое (крупные к крупным), чтобы порядок наложения новой картины остался верным
  const pick = (u, v, L) => {
    const cx = (u * cells) | 0, cy = (v * cellsY) | 0;
    for (let ring = 0; ring < 8; ring++) {
      for (let dy = -ring; dy <= ring; dy++) for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const bk = buckets.get(L * 100000 + (cy + dy) * cells + (cx + dx));
        if (!bk) continue;
        while (bk.length) { const j = bk.pop(); if (!used[j]) { used[j] = 1; return j; } }
      }
    }
    return -1;
  };
  const map = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    const ia = i % A.n;
    map[i] = pick(A.a[ia * 11 + 1], A.a[ia * 11 + 2], A.a[ia * 11]);
  }
  // непарные — любые оставшиеся, затем повтор
  let free = []; for (let j = 0; j < B.n; j++) if (!used[j]) free.push(j);
  let fi = 0;
  for (let i = 0; i < N; i++) if (map[i] < 0) { map[i] = fi < free.length ? free[fi++] : (i % B.n); }
  return map;
}
