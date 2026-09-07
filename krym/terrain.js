// Настоящий рельеф Крыма для главной: сетка по высотам (z10 везде, z12 вокруг Судака и Южного берега), золотисто-бронзовое
// освещение низким солнцем, тени облаков, тонкие горизонтали, море с бликом солнца и пеной у берега, тёплая дымка по дальности.
// Мировая система та же, что у точек: x = (px10 − W10/2)·0.108 км, z = (py10 − H10/2)·0.108 км, y = h/1000·EXAG.
import * as THREE from 'three';

const EXAG = 4.0, KM10 = 0.108, W10 = 3584, H10 = 2304;
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));

// упакованные высоты (R hi, G lo: v = (h + 500)·8; B — расстояние до берега км×10) → half-float текстура высот и текстура берега
async function loadPacked(url) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height).data; const n = c.width * c.height;
  const h = new Float32Array(n), half = new Uint16Array(n), shore = new Uint8Array(n);
  for (let i = 0; i < n; i++) { const v = (d[i * 4] * 256 + d[i * 4 + 1]) / 8 - 500; h[i] = v; half[i] = THREE.DataUtils.toHalfFloat(v); shore[i] = d[i * 4 + 2]; }
  const tex = new THREE.DataTexture(half, c.width, c.height, THREE.RedFormat, THREE.HalfFloatType); tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
  const sh = new THREE.DataTexture(shore, c.width, c.height, THREE.RedFormat, THREE.UnsignedByteType); sh.minFilter = THREE.LinearFilter; sh.magFilter = THREE.LinearFilter; sh.generateMipmaps = false; sh.needsUpdate = true;
  return { w: c.width, h: c.height, hgt: h, tex, shore: sh };
}

const COMMON = /* glsl */`
float hgtAt(sampler2D t, vec2 uv){ return max(texture(t, uv).r, 0.0); }   // без подводного рельефа, иначе весь берег в тёмной кайме
// нормаль по конечным разностям в текстуре высот (км на пиксель kmpx), с преувеличением рельефа
vec3 nrmAt(sampler2D t, vec2 uv, vec2 texel, float kmpx){
  float hl = hgtAt(t, uv - vec2(texel.x, 0.0)), hr = hgtAt(t, uv + vec2(texel.x, 0.0));
  float hu = hgtAt(t, uv - vec2(0.0, texel.y)), hd = hgtAt(t, uv + vec2(0.0, texel.y));
  float sx = (hr - hl) / 1000.0 * ${EXAG.toFixed(1)} / (2.0 * kmpx), sz = (hd - hu) / 1000.0 * ${EXAG.toFixed(1)} / (2.0 * kmpx);
  return normalize(vec3(-sx, 1.0, -sz));
}
float lapAt(sampler2D t, vec2 uv, vec2 texel){
  float c = hgtAt(t, uv);
  return (hgtAt(t, uv - vec2(texel.x, 0.0)) + hgtAt(t, uv + vec2(texel.x, 0.0)) + hgtAt(t, uv - vec2(0.0, texel.y)) + hgtAt(t, uv + vec2(0.0, texel.y)) - 4.0 * c);
}
`;

const LAND_VERT = /* glsl */`
precision highp float;
in vec3 position; in vec2 uv;
uniform mat4 projectionMatrix; uniform mat4 modelViewMatrix;
uniform sampler2D uHgt; uniform sampler2D uHgtE; uniform sampler2D uHgtS; uniform vec4 uPatchE; uniform vec4 uPatchS; uniform float uHasPatch;
uniform float uIsPatch;   // 0 — базовая сетка, 1 — сетка патча (uv уже в координатах патча)
out vec2 vUv; out vec3 vWorld; out float vH;
${COMMON}
void main(){
  vec2 buv = uv; float h;
  if (uIsPatch > 0.5) { h = hgtAt(uHgt, uv); }
  else {
    h = hgtAt(uHgt, uv);
    // внутри патчей вершины базовой сетки ложатся на высоты патча, чтобы края совпали
    if (uHasPatch > 0.5) {
      vec2 pe = (uv - uPatchE.xy) / (uPatchE.zw - uPatchE.xy); if (all(greaterThan(pe, vec2(0.0))) && all(lessThan(pe, vec2(1.0)))) h = hgtAt(uHgtE, pe);
      vec2 ps = (uv - uPatchS.xy) / (uPatchS.zw - uPatchS.xy); if (all(greaterThan(ps, vec2(0.0))) && all(lessThan(ps, vec2(1.0)))) h = hgtAt(uHgtS, ps);
    }
  }
  vec3 p = position; p.y = max(h, -40.0) / 1000.0 * ${EXAG.toFixed(1)};
  vUv = uv; vWorld = p; vH = h;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const LAND_FRAG = /* glsl */`
precision highp float;
in vec2 vUv; in vec3 vWorld; in float vH;
uniform sampler2D uHgt; uniform sampler2D uHgtE; uniform sampler2D uHgtS; uniform sampler2D uShore; uniform sampler2D uNoise;
uniform vec4 uPatchE; uniform vec4 uPatchS; uniform float uHasPatch; uniform float uIsPatch; uniform vec2 uTexel; uniform float uKmPx; uniform vec2 uTexelP; uniform float uKmPxP; uniform vec4 uMyRect;
uniform vec3 uCam; uniform vec3 uSun; uniform vec3 uSunCol; uniform float uSunI; uniform float uAmb; uniform float uTime; uniform vec3 uFogCol; uniform float uFog; uniform vec3 uFocus; uniform float uFocusR; uniform float uReveal; uniform float uBeacon; uniform float uRingK; uniform float uHaloK; uniform float uCoreK;
out vec4 outColor;
${COMMON}
void main(){
  // нормаль: из патча, если он есть в этой точке (детальнее), иначе из базы
  vec3 n; float lap; float shore = 0.0;
  if (uIsPatch > 0.5) { n = nrmAt(uHgt, vUv, uTexel, uKmPx); lap = lapAt(uHgt, vUv, uTexel); vec2 buv2 = uMyRect.xy + vUv * (uMyRect.zw - uMyRect.xy); shore = texture(uShore, buv2).r * 25.5; }
  else {
    n = nrmAt(uHgt, vUv, uTexel, uKmPx); lap = lapAt(uHgt, vUv, uTexel); shore = texture(uShore, vUv).r * 25.5;
    if (uHasPatch > 0.5) {
      vec2 pe = (vUv - uPatchE.xy) / (uPatchE.zw - uPatchE.xy); vec2 ps = (vUv - uPatchS.xy) / (uPatchS.zw - uPatchS.xy);
      // базовая сетка внутри патчей не рисуется (там своя, детальная)
      if (all(greaterThan(pe, vec2(0.004))) && all(lessThan(pe, vec2(0.996)))) discard;
      if (all(greaterThan(ps, vec2(0.004))) && all(lessThan(ps, vec2(0.996)))) discard;
    }
  }
  if (vH < 0.5) discard;   // море рисует своя плоскость (и в патчах тоже, иначе дно дерётся с поверхностью)
  vec3 V = normalize(uCam - vWorld); vec3 L = normalize(uSun);
  float dist = length(uCam - vWorld);
  // микрофактура вблизи: осыпи и складки, которых нет в высотах
  { vec3 mn = texture(uNoise, vWorld.xz * 0.9).rgb * 2.0 - 1.0; vec3 mn2 = texture(uNoise, vWorld.xz * 3.1 + 0.3).rgb * 2.0 - 1.0; float mk = (1.0 - smoothstep(6.0, 45.0, dist)) * 0.11; n = normalize(n + vec3(mn.x * 0.7 + mn2.x * 0.3, 0.0, mn.y * 0.7 + mn2.y * 0.3) * mk); }
  float ndl = dot(n, L);
  float diff = 0.18 + 0.82 * pow(max(ndl, 0.0), 0.85);
  // цвет по высоте: прибрежная охра → золотистые холмы → бронзовые горы
  float h = max(vH, 0.0);
  vec3 c0 = vec3(0.62, 0.53, 0.38), c1 = vec3(0.56, 0.43, 0.25), c2 = vec3(0.40, 0.29, 0.18), c3 = vec3(0.28, 0.21, 0.17);
  vec3 alb = mix(c0, c1, smoothstep(0.0, 250.0, h)); alb = mix(alb, c2, smoothstep(250.0, 700.0, h)); alb = mix(alb, c3, smoothstep(700.0, 1300.0, h));
  // крутые склоны темнее и холоднее, вогнутости (долины) темнее — дешёвая окклюзия
  float slope = 1.0 - n.y; float sk = mix(0.40, 0.85, smoothstep(0.0, 2.5, shore)); alb *= 1.0 - slope * sk; alb = mix(alb, vec3(0.30, 0.26, 0.24), slope * 0.3);
  float ao = clamp(1.0 + lap * 0.012, 0.6, 1.15); ao = mix(1.0, ao, smoothstep(0.0, 1.5, shore));   // у берега лапласиан ложный (море обрезано нулём) — окклюзию не применяем
  alb *= ao;
  // долины: ровная низкая земля теплее и чуть зеленее (сады и виноградники), плато остаётся сухим
  float lowland = smoothstep(0.10, 0.02, slope) * (1.0 - smoothstep(120.0, 380.0, h)); alb = mix(alb, vec3(0.50, 0.47, 0.27), lowland * 0.45);
  // тональная фактура вблизи: сухая трава, камень, пятна кустарника
  { float tn = texture(uNoise, vWorld.xz * 2.2).r * 0.6 + texture(uNoise, vWorld.xz * 7.0 + 0.5).g * 0.4; float tk = 1.0 - smoothstep(8.0, 60.0, dist); alb *= 1.0 + (tn - 0.5) * 0.28 * tk; alb = mix(alb, alb * vec3(0.85, 0.95, 0.75), smoothstep(0.62, 0.8, texture(uNoise, vWorld.xz * 1.1 + 0.2).b) * 0.35 * tk * lowland); }
  // берег: узкая светлая полоса
  alb = mix(alb, vec3(0.70, 0.62, 0.48), (1.0 - smoothstep(0.0, 0.7, shore)) * 0.5);
  alb = pow(alb, vec3(2.2));
  // тени облаков ползут по земле
  float cl = texture(uNoise, vWorld.xz * 0.009 + vec2(uTime * 0.004, uTime * 0.0025)).g; float puff = texture(uNoise, vWorld.xz * 0.035 + vec2(uTime * 0.005, uTime * 0.002)).r; cl = smoothstep(0.50, 0.80, cl) * smoothstep(0.42, 0.75, puff);
  float sunlit = 1.0 - cl * 0.45;
  // длинные тени: шаги по высотам навстречу солнцу; на восходе тянутся через долины
  float shadow = 1.0;
  { vec2 dir = normalize(L.xz + vec2(1e-4)); float tanEl = max(L.y, 0.02) / max(length(L.xz), 0.05); vec2 stepUv = dir * (1.4 / uKmPx) * uTexel; float acc = 0.0;
    for (int i = 1; i <= 6; i++) { float sKm = float(i) * 1.4; vec2 q = vUv + stepUv * float(i); float ty = hgtAt(uHgt, q) / 1000.0 * ${EXAG.toFixed(1)}; float ry = vWorld.y + sKm * tanEl; acc = max(acc, ty - ry); }
    shadow = 1.0 - smoothstep(0.0, 0.3, acc) * 0.7; }
  vec3 sunCol = uSunCol * uSunI, skyCol = vec3(0.42, 0.46, 0.58) * 0.32 * uAmb;
  vec3 col = alb * (diff * sunCol * sunlit * shadow + skyCol);
  // бронзовый блик
  vec3 H = normalize(L + V); float spec = pow(max(dot(n, H), 0.0), 28.0) * 0.28 * sunlit * shadow * uSunI / 1.35; col += vec3(1.0, 0.85, 0.55) * spec * (0.5 + 0.5 * smoothstep(100.0, 700.0, h));
  // тонкие горизонтали через 100 м: заметнее издали, тише вблизи
  float lv = vH / 100.0; float lw = fwidth(lv) * 1.2; float line = 1.0 - smoothstep(0.0, lw, min(fract(lv), 1.0 - fract(lv)));
  float lineK = smoothstep(40.0, 200.0, dist) * 0.35 + 0.06; col += vec3(1.0, 0.85, 0.55) * line * lineK * 0.5 * step(0.5, vH);
  // очаг внимания: тёплый свет вокруг точки главы
  float fr = uFocusR * 0.45; float fd = length(vWorld.xz - uFocus.xz); float focus = exp(-fd * fd / (fr * fr)); col *= 1.0 + focus * 0.30;
  // маяк главы: земля вокруг точки чуть темнеет (контраст), от точки бегут кольца света, в центре горячее ядро
  if (uBeacon > 0.001) { float halo = smoothstep(1.2, 5.0, fd) * (1.0 - smoothstep(5.0, 16.0, fd)); col *= 1.0 - uHaloK * halo * uBeacon;
    vec3 bc = vec3(1.0, 0.96, 0.84); float rings = 0.0; for (int i = 0; i < 2; i++) { float ph = fract(uTime * 0.28 + float(i) * 0.5); float rr = ph * 7.0; rings += exp(-abs(fd - rr) * 4.0) * (1.0 - ph) * (1.0 - ph); }
    col += bc * rings * uRingK * uBeacon + bc * exp(-fd * fd / 0.2) * uCoreK * uBeacon; }
  // дымка по дальности и туман перехода
  float fog = 1.0 - exp(-dist * 0.0022 * clamp(70.0 / max(uCam.y, 1.0), 0.22, 1.0)); float mist = 0.8 + 0.4 * texture(uNoise, vWorld.xz * 0.012 + vec2(uTime * 0.01, -uTime * 0.006)).b;
  vec3 fogC = mix(uFogCol, vec3(0.30, 0.33, 0.40), smoothstep(40.0, 220.0, uCam.y) * 0.55 * (1.0 - uFog));
  col = mix(col, fogC, clamp(fog * 0.85 + uFog * mist * (0.25 + 0.75 * smoothstep(0.0, 45.0, dist)), 0.0, 1.0));
  vec2 buv = uIsPatch > 0.5 ? vec2(0.5) : vUv; float edge = smoothstep(0.0, 0.10, min(min(buv.x, 1.0 - buv.x), min(buv.y, 1.0 - buv.y)));
  { float ne = texture(uNoise, vWorld.xz * 0.018).r * 0.06; edge *= smoothstep(0.03 + ne, 0.22 + ne, buv.y) * (1.0 - smoothstep(0.90 - ne, 0.99, buv.x)); }   // материк за Перекопом и Тамань растворяются в дымке рваным, не прямым краем
  // край материка уходит ровно в тот тон, каким рядом написано море (глубокая вода + та же дымка + тот же дальний воздух), поэтому кромки плиты не видно
  vec3 seaLike = mix(vec3(0.020, 0.062, 0.095), fogC, clamp(fog * 0.85, 0.0, 1.0)); seaLike = mix(seaLike, mix(vec3(0.026, 0.028, 0.036), fogC, 0.12), smoothstep(200.0, 520.0, dist));
  col = mix(seaLike, col, edge);
  outColor = vec4(col * uReveal, 1.0);
}
`;

const SEA_VERT = /* glsl */`
precision highp float; in vec3 position; in vec2 uv;
uniform mat4 projectionMatrix; uniform mat4 modelViewMatrix; uniform vec2 uSize; out vec2 vUv; out vec3 vWorld;
void main(){ vUv = position.xz / uSize + 0.5; vWorld = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }   // uv от мира: плоскость моря шире карты
`;
const SEA_FRAG = /* glsl */`
precision highp float; in vec2 vUv; in vec3 vWorld;
uniform sampler2D uHgt; uniform sampler2D uShore; uniform sampler2D uNoise; uniform vec3 uCam; uniform vec3 uSun; uniform vec3 uSunCol; uniform float uSunI; uniform float uAmb; uniform float uTime; uniform vec3 uFogCol; uniform float uFog; uniform vec3 uFocus; uniform float uFocusR; uniform float uReveal; uniform float uBeacon; uniform float uRingK; uniform float uHaloK; uniform float uCoreK;
out vec4 outColor;
void main(){
  // море не отбрасывает пиксели по грубой карте: суша лежит выше и закрывает его по глубине (иначе у берега щель между сетками)
  bool outside = any(lessThan(vUv, vec2(0.0))) || any(greaterThan(vUv, vec2(1.0)));   // за картой — открытое море до горизонта
  float shore = outside ? 25.5 : texture(uShore, vUv).r * 25.5;   // км до суши
  vec3 V = normalize(uCam - vWorld); vec3 L = normalize(uSun);
  // волны: две шумовые нормали разных масштабов
  vec2 p = vWorld.xz;
  vec3 n1 = texture(uNoise, p * 0.09 + vec2(uTime * 0.010, uTime * 0.007)).rgb * 2.0 - 1.0;
  vec3 n2 = texture(uNoise, p * 0.32 - vec2(uTime * 0.02, uTime * 0.015)).rgb * 2.0 - 1.0;
  // зыбь: длинные валы идут к берегу с юго-запада
  float swell = sin(dot(p, vec2(0.7, -0.7)) * 0.9 + uTime * 0.35) * 0.06 + sin(dot(p, vec2(0.5, -0.85)) * 1.7 - uTime * 0.5) * 0.03;
  vec3 n = normalize(vec3(n1.x * 0.35 + n2.x * 0.18 + swell, 1.0, n1.y * 0.35 + n2.y * 0.18 - swell * 0.7));
  // цвет: глубокая вода → мелководье у берега
  vec3 deep = vec3(0.020, 0.062, 0.095), shallow = vec3(0.06, 0.20, 0.24);
  vec3 col = mix(deep, shallow, (1.0 - smoothstep(0.0, 4.0, shore)) * 0.8);
  float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
  col = mix(col, vec3(0.30, 0.34, 0.42) * 0.45, fres * 0.6 * (1.0 - smoothstep(90.0, 320.0, length(uCam - vWorld))));
  // солнечная дорожка
  vec3 H = normalize(L + V); float sp = pow(max(dot(n, H), 0.0), 90.0); float sheen = pow(max(dot(n, H), 0.0), 8.0);
  col *= 0.35 + 0.65 * uAmb; col += uSunCol * (sp * 1.6 + sheen * 0.10) * (uSunI / 1.35);
  // пена и светлая кромка у берега
  float foam = (1.0 - smoothstep(0.0, 0.45, shore)) * smoothstep(0.55, 0.9, texture(uNoise, p * 0.6 + vec2(uTime * 0.03, 0.0)).a);
  col += vec3(0.7, 0.72, 0.7) * foam * 0.5; col += vec3(0.35, 0.40, 0.42) * (1.0 - smoothstep(0.0, 0.25, shore)) * 0.35;
  float fr = uFocusR * 0.45; float fd = length(vWorld.xz - uFocus.xz); float focus = exp(-fd * fd / (fr * fr)); col *= 1.0 + focus * 0.18;
  if (uBeacon > 0.001) { float halo = smoothstep(1.2, 5.0, fd) * (1.0 - smoothstep(5.0, 16.0, fd)); col *= 1.0 - uHaloK * 0.7 * halo * uBeacon;
    vec3 bc = vec3(1.0, 0.96, 0.84); float rings = 0.0; for (int i = 0; i < 2; i++) { float ph = fract(uTime * 0.28 + float(i) * 0.5); float rr = ph * 7.0; rings += exp(-abs(fd - rr) * 4.0) * (1.0 - ph) * (1.0 - ph); }
    col += bc * rings * uRingK * 0.8 * uBeacon; }
  float dist = length(uCam - vWorld); float fog = 1.0 - exp(-dist * 0.0022 * clamp(70.0 / max(uCam.y, 1.0), 0.22, 1.0)); float mist = 0.8 + 0.4 * texture(uNoise, vWorld.xz * 0.012 + vec2(uTime * 0.01, -uTime * 0.006)).b;
  vec3 fogC = mix(uFogCol, vec3(0.30, 0.33, 0.40), smoothstep(40.0, 220.0, uCam.y) * 0.55 * (1.0 - uFog));
  col = mix(col, fogC, clamp(fog * 0.85 + uFog * mist * (0.25 + 0.75 * smoothstep(0.0, 45.0, dist)), 0.0, 1.0));
  col = mix(col, mix(vec3(0.026, 0.028, 0.036), fogC, 0.12), smoothstep(200.0, 520.0, dist));   // у горизонта море растворяется в тёмном воздухе, а не обрывается краем
  outColor = vec4(col * uReveal, 1.0);
}
`;

const CLOUD_VERT = /* glsl */`
precision highp float; in vec3 position; in vec2 uv; uniform mat4 projectionMatrix; uniform mat4 modelViewMatrix; out vec3 vWorld; out vec2 vUv;
void main(){ vWorld = position; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const CLOUD_FRAG = /* glsl */`
precision highp float; in vec3 vWorld; in vec2 vUv; uniform sampler2D uNoise; uniform float uTime; uniform vec3 uCam; uniform vec3 uSunCol; uniform float uSunI; uniform float uAmb; uniform float uFog; uniform float uReveal; out vec4 outColor;
void main(){
  // та же выборка, что у теней на земле (LAND_FRAG): облако ровно над своей тенью
  float cl = texture(uNoise, vWorld.xz * 0.009 + vec2(uTime * 0.004, uTime * 0.0025)).g; float puff = texture(uNoise, vWorld.xz * 0.035 + vec2(uTime * 0.005, uTime * 0.002)).r; float fine = texture(uNoise, vWorld.xz * 0.09 - vec2(uTime * 0.006, uTime * 0.003)).b;
  float a = smoothstep(0.50, 0.80, cl) * smoothstep(0.42, 0.75, puff) * (0.6 + 0.4 * fine) * 0.75;
  float edge = 1.0;   // облака не обрываются по краю карты, только тают по дальности
  float dist = length(uCam - vWorld); a *= edge * (1.0 - uFog) * uReveal * (1.0 - smoothstep(180.0, 420.0, dist));
  vec3 col = (uSunCol * uSunI * 0.55 + vec3(0.42, 0.46, 0.58) * 0.5 * uAmb) * (0.85 + 0.15 * fine);
  outColor = vec4(col * a, a);
}
`;
function grid(wKm, hKm, sx, sy, uvRect) {
  const nx = sx + 1, ny = sy + 1; const pos = new Float32Array(nx * ny * 3), uv = new Float32Array(nx * ny * 2);
  const [u0, v0, u1, v1] = uvRect || [0, 0, 1, 1]; const x0 = (u0 - 0.5) * wKm, x1 = (u1 - 0.5) * wKm, z0 = (v0 - 0.5) * hKm, z1 = (v1 - 0.5) * hKm;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i, fu = i / sx, fv = j / sy; pos[k * 3] = x0 + (x1 - x0) * fu; pos[k * 3 + 1] = 0; pos[k * 3 + 2] = z0 + (z1 - z0) * fv; uv[k * 2] = fu; uv[k * 2 + 1] = fv; }
  const idx = new Uint32Array(sx * sy * 6); let t = 0;
  for (let j = 0; j < sy; j++) for (let i = 0; i < sx; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx[t++] = a; idx[t++] = c; idx[t++] = b; idx[t++] = b; idx[t++] = c; idx[t++] = d; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  return g;
}

export async function createTerrain({ meta, noiseTex, mobile }) {
  const wKm = W10 * KM10, hKm = H10 * KM10;
  // первый кадр — с облегчённой базы (896×576, ~220 КБ), полная (1792×1152, ~2.9 МБ) грузится следом и подменяется на лету
  let base; try { base = await loadPacked('data/hgt-lite.png'); } catch (e) { base = await loadPacked('data/hgt-base.png'); }
  const liteBase = base.w < 1500;
  const uvOf = (lon, lat) => [(lon - meta.lonW) / (meta.lonE - meta.lonW), (mercY(lat) - mercY(meta.latN)) / (mercY(meta.latS) - mercY(meta.latN))];
  const patches = [];
  const loadPatch = async (name) => { const m = await (await fetch('data/' + name + '.json')).json(); const t = await loadPacked('data/' + name + '.png'); const a = uvOf(m.lonW, m.latN), b = uvOf(m.lonE, m.latS); return { name, tex: t, rect: [a[0], a[1], b[0], b[1]], kmPx: m.kmPerPx, w: t.w, h: t.h }; };
  const uni = {
    uCam: { value: new THREE.Vector3() }, uSun: { value: new THREE.Vector3(0.64, 0.42, 0.64).normalize() }, uSunCol: { value: new THREE.Vector3(1.0, 0.86, 0.62) }, uSunI: { value: 1.35 }, uAmb: { value: 1 }, uTime: { value: 0 }, uFogCol: { value: new THREE.Vector3(0.36, 0.30, 0.25) }, uFog: { value: 0 },
    uFocus: { value: new THREE.Vector3() }, uFocusR: { value: 60 }, uReveal: { value: 1 }, uNoise: { value: noiseTex }, uBeacon: { value: 0 }, uRingK: { value: 0.9 }, uHaloK: { value: 0.26 }, uCoreK: { value: 0.9 },
  };
  const blank = new THREE.DataTexture(new Uint16Array([0]), 1, 1, THREE.RedFormat, THREE.HalfFloatType); blank.needsUpdate = true;
  const shared = { uHgtE: { value: blank }, uHgtS: { value: blank }, uPatchE: { value: new THREE.Vector4(2, 2, 3, 3) }, uPatchS: { value: new THREE.Vector4(2, 2, 3, 3) }, uHasPatch: { value: 0 } };
  const group = new THREE.Group();
  const landMat = (isPatch, tex, texel, kmPx) => new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: LAND_VERT, fragmentShader: LAND_FRAG, uniforms: { ...uni, ...shared, uHgt: { value: tex.tex }, uShore: { value: base.shore }, uIsPatch: { value: isPatch ? 1 : 0 }, uTexel: { value: new THREE.Vector2(...texel) }, uKmPx: { value: kmPx }, uTexelP: { value: new THREE.Vector2() }, uKmPxP: { value: 0 }, uMyRect: { value: new THREE.Vector4(0, 0, 1, 1) } }, side: THREE.DoubleSide });
  const segB = mobile ? [448, 288] : [896, 576];
  const land = new THREE.Mesh(grid(wKm, hKm, segB[0], segB[1]), landMat(false, base, [1 / base.w, 1 / base.h], liteBase ? 0.432 : 0.216)); land.frustumCulled = false; land.renderOrder = 0; group.add(land);
  const addPatch = (p) => { patches.push(p); const segs = [Math.round(p.w / 2), Math.round(p.h / 2)]; const m = new THREE.Mesh(grid(wKm, hKm, segs[0], segs[1], p.rect), landMat(true, p.tex, [1 / p.w, 1 / p.h], p.kmPx)); m.material.uniforms.uMyRect.value.set(...p.rect); m.frustumCulled = false; m.renderOrder = 0; group.add(m);
    const key = p.name === 'hgt-east' ? 'E' : 'S'; shared['uHgt' + key].value = p.tex.tex; shared['uPatch' + key].value.set(...p.rect); shared.uHasPatch.value = 1; };
  // море втрое шире карты: за её краями открытая вода до горизонта, плита с углами не видна
  const sea = new THREE.Mesh(grid(wKm * 3, hKm * 3, 2, 2), new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: SEA_VERT, fragmentShader: SEA_FRAG, uniforms: { ...uni, uHgt: { value: base.tex }, uShore: { value: base.shore }, uSize: { value: new THREE.Vector2(wKm, hKm) } }, side: THREE.DoubleSide }));
  // подмена облегчённой базы полной: те же сетки, только текстуры высот и берега (и шаг текселя для нормалей); патчи — после неё
  const swapBase = async () => {
    if (!liteBase) return; const full = await loadPacked('data/hgt-base.png');
    for (const m of [land, sea]) { const u = m.material.uniforms; u.uHgt.value = full.tex; u.uShore.value = full.shore; if (u.uTexel) u.uTexel.value.set(1 / full.w, 1 / full.h); if (u.uKmPx) u.uKmPx.value = 0.216; }
    Object.assign(base, { tex: full.tex, shore: full.shore, w: full.w, h: full.h, hgt: full.hgt });
  };
  const ready = (mobile ? ['hgt-east'] : ['hgt-east', 'hgt-south']).reduce((pr, name) => pr.then(() => loadPatch(name).then(addPatch).catch((e) => console.warn('[terrain] нет патча', name))), swapBase().catch((e) => console.warn('[terrain] полная база', e)));
  sea.position.y = -0.012; sea.frustumCulled = false; sea.renderOrder = -1; group.add(sea);
  // облака: редкие, над горами, тень под ними уже лежит на земле
  const clouds = new THREE.Mesh(grid(wKm * 2, hKm * 2, 2, 2), new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG, uniforms: { uNoise: uni.uNoise, uTime: uni.uTime, uCam: uni.uCam, uSunCol: uni.uSunCol, uSunI: uni.uSunI, uAmb: uni.uAmb, uFog: uni.uFog, uReveal: uni.uReveal }, transparent: true, depthWrite: false, depthTest: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor, side: THREE.DoubleSide }));
  clouds.position.y = 3.0 * EXAG;   /* 3 км над уровнем моря в единицах мира */ clouds.frustumCulled = false; clouds.renderOrder = 1; group.add(clouds);
  // высота в километрах мира по базовым высотам (билинейно) — для маршрута и булавок
  const heightAt = (x, z) => { const u = (x / wKm + 0.5) * (base.w - 1), v = (z / hKm + 0.5) * (base.h - 1); const i = Math.max(0, Math.min(base.w - 2, Math.floor(u))), j = Math.max(0, Math.min(base.h - 2, Math.floor(v))); const fu = u - i, fv = v - j; const H = base.hgt, w = base.w; const h = (H[j * w + i] * (1 - fu) + H[j * w + i + 1] * fu) * (1 - fv) + (H[(j + 1) * w + i] * (1 - fu) + H[(j + 1) * w + i + 1] * fu) * fv; return Math.max(h, 0) / 1000 * EXAG; };
  return { group, uni, heightAt, patches, ready };
}

// маршрут и булавки глав: золотая нить по рельефу и световые столбики с ореолом
export function makeRoute(points, heightAt) {
  // золотая лента по рельефу: полилиния по 60 шагов на отрезок, ширина 0.22 км, мягкие края, прочерчивается на восходе (uDraw)
  const pts = [];
  for (let k = 0; k + 1 < points.length; k++) { const a = points[k], b = points[k + 1]; const n = 60; for (let i = 0; i < n; i++) { const t = i / n; const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t; pts.push(new THREE.Vector3(x, heightAt(x, z) + 0.12, z)); } }
  const last = points[points.length - 1]; pts.push(new THREE.Vector3(last.x, heightAt(last.x, last.z) + 0.12, last.z));
  const W = 0.22, n = pts.length; const pos = new Float32Array(n * 2 * 3), at = new Float32Array(n * 2), side = new Float32Array(n * 2); const idx = [];
  for (let i = 0; i < n; i++) { const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(n - 1, i + 1)]; let dx = p1.x - p0.x, dz = p1.z - p0.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; const nx = -dz * W / 2, nz = dx * W / 2;
    for (let s = 0; s < 2; s++) { const o = (i * 2 + s); const sg = s ? 1 : -1; pos[o * 3] = pts[i].x + nx * sg; pos[o * 3 + 1] = pts[i].y; pos[o * 3 + 2] = pts[i].z + nz * sg; at[o] = i / (n - 1); side[o] = s; }
    if (i < n - 1) { const q = i * 2; idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); } }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aT', new THREE.BufferAttribute(at, 1)); geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1)); geo.setIndex(idx); geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  const line = new THREE.Mesh(geo, new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, transparent: true, depthTest: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uDraw: { value: 1 }, uOpacity: { value: 0.55 }, uGhost: { value: 0 } },
    vertexShader: 'precision highp float; in vec3 position; in float aT; in float aSide; uniform mat4 projectionMatrix; uniform mat4 modelViewMatrix; out float vT; out float vS; void main(){ vT = aT; vS = aSide; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'precision highp float; in float vT; in float vS; uniform float uDraw; uniform float uOpacity; uniform float uGhost; out vec4 outColor; void main(){ float edge = 1.0 - pow(abs(vS * 2.0 - 1.0), 2.5); float done = 1.0 - smoothstep(uDraw - 0.02, uDraw, vT); float a = uOpacity * edge * (uGhost + (1.0 - uGhost) * done); float head = exp(-abs(vT - uDraw) * 60.0) * 0.8 * step(0.01, uDraw) * step(uDraw, 0.99) * edge; outColor = vec4(vec3(0.91, 0.76, 0.48) * (a + head), a + head); }' }));
  line.frustumCulled = false; line.renderOrder = 1; line.userData.pts = pts;
  return line;
}
export function makePins(points, heightAt) {
  const g = new THREE.Group(); const pins = [];
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,225,160,1)'); gr.addColorStop(0.25, 'rgba(255,205,120,0.55)'); gr.addColorStop(1, 'rgba(255,190,100,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t; })();
  // столб света: снизу яркий, к верху тает, по ширине мягкий; в мировых единицах, чтобы на подлёте вырастал
  const beamTex = (() => { const w = 32, h = 128; const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); const im = x.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const dx = (i + 0.5 - w / 2) / (w / 2); const v = Math.pow(1 - j / h, 0.45) * Math.exp(-dx * dx * 5.0); const o = (j * w + i) * 4; im.data[o] = 255; im.data[o + 1] = 244; im.data[o + 2] = 214; im.data[o + 3] = Math.round(255 * Math.min(1, v)); }
    x.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t; })();
  // ядро: белое зерно с тёмным ободком — читается и на золотой земле, и на белом облаке; размер в пикселях экрана
  const coreTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,250,236,1)'); gr.addColorStop(0.26, 'rgba(255,238,200,1)'); gr.addColorStop(0.34, 'rgba(30,22,14,0.9)'); gr.addColorStop(0.5, 'rgba(30,22,14,0.45)'); gr.addColorStop(0.7, 'rgba(30,22,14,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t; })();
  for (const p of points) {
    const y0 = heightAt(p.x, p.z), top = y0 + 2.6;
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(p.x, y0, p.z), new THREE.Vector3(p.x, top, p.z)]);
    const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xfff0d0, transparent: true, opacity: 0.5, depthTest: true, depthWrite: false })); line.frustumCulled = false; line.renderOrder = 1;
    const beam = new THREE.Sprite(new THREE.SpriteMaterial({ map: beamTex, color: 0xffeecc, transparent: true, opacity: 0.5, depthTest: false, depthWrite: false, sizeAttenuation: true, blending: THREE.AdditiveBlending })); beam.center.set(0.5, 0); beam.position.set(p.x, y0, p.z); beam.scale.set(0.5, 3.0, 1); beam.renderOrder = 2;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: coreTex, color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false, sizeAttenuation: false })); spr.position.set(p.x, top, p.z); spr.scale.set(0.02, 0.02, 1); spr.renderOrder = 3;
    g.add(line, beam, spr); pins.push({ line, spr, beam, top: new THREE.Vector3(p.x, top, p.z), base: new THREE.Vector3(p.x, y0, p.z) });
  }
  // комета: бежит по маршруту, пока он прочерчивается на восходе
  const comet = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffe8b0, transparent: true, opacity: 0, depthTest: false, depthWrite: false, sizeAttenuation: false, blending: THREE.AdditiveBlending })); comet.scale.set(0.09, 0.09, 1); comet.renderOrder = 3; g.add(comet);
  return { group: g, pins, comet };
}
