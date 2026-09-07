// «КРЫМ, НАПИСАННЫЙ ВЕЛИКИМИ» — карта полуострова из линий света, точки хронологии, погружение в полотна мастеров,
// которые оживают глубиной, светом и воздухом. Последняя точка маршрута всегда Солнечная Долина.
import * as THREE from 'three';
import { loadHeights } from '../iz-nichego/world.js';
import { loadImage, makeStrokes } from '../zhivopis/paint.js';
import { createTerrain, makeRoute, makePins } from './terrain.js';

const $ = (s) => document.querySelector(s);
const qs = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width: 900px)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// ---------- главы: хронология Крыма, полотна на своих местах ----------
// два набора: «сцены дома» (полотна мастеров + сцены, написанные для страницы) и «только оригиналы» (только полотна и фото)
const SETS = {
 gemini: [
  { id: 'sugdeya', lon: 34.960, lat: 44.842, year: 'VI век до н. э.', place: 'Сугдея · Судак', img: 'scenes/bossoli-sudak.jpg', depth: 'depth/bossoli-sudak-depth.png', painter: 'Карло Боссоли', title: '«Судак. Остатки генуэзской крепости»', pyear: 1856, text: 'Греки, а за ними генуэзцы, начали здесь виноделие. Сорта, которые растут в долине сегодня, — их наследие.', light: [-0.5, 0.6, 0.6], haze: [0.72, 0.62, 0.48], hazeK: 0.16 },
  { id: 'feodosia', lon: 35.382, lat: 45.032, year: '1787', place: 'Феодосия', img: 'scenes/aivazovsky-ekaterina.jpg', depth: 'depth/aivazovsky-ekaterina-depth.png', painter: 'Иван Айвазовский', title: '«Приезд Екатерины II в Феодосию»', pyear: 1883, text: 'После присоединения Крыма земли у Судака раздают помещикам: за тридцать лет здесь вырастают десятки имений.', light: [0.4, 0.5, 0.75], haze: [0.56, 0.53, 0.47], hazeK: 0.12 },
  { id: 'sudak', lon: 34.975, lat: 44.850, year: '1804', place: 'Судак', img: 'scenes/bogaevsky-sudak.jpg', depth: 'depth/bogaevsky-sudak-depth.png', painter: 'Константин Богаевский', title: '«Судак»', pyear: 1900, text: 'В Судаке открывается первое в России училище виноградарства и виноделия. Ему отведены земли у Судака.', light: [-0.6, 0.55, 0.6], haze: [0.78, 0.60, 0.42], hazeK: 0.18 },
  { id: 'novysvet', lon: 34.910, lat: 44.830, year: '1878', place: 'Новый Свет', img: 'scenes/aivazovsky-utro.jpg', depth: 'depth/aivazovsky-utro-depth.png', painter: 'Иван Айвазовский', title: '«Утро на берегу Крыма»', pyear: 1870, text: 'Князь Лев Голицын строит в Новом Свете завод шампанских вин и ищет для него виноград. Так он находит Капсель.', light: [0.6, 0.35, 0.7], haze: [0.95, 0.62, 0.36], hazeK: 0.35 },
  { id: 'kapsel', lon: 35.020, lat: 44.845, year: '1888', place: 'Капсель', img: 'scenes/kapsel-1888.jpg', depth: 'depth/kapsel-1888-depth.png', painter: 'Сцена дома', title: 'Безводная земля', pyear: 2026, text: 'Голицын над безлюдной долиной у Меганома: «Там, где рос шиповник, виноградник будет давать хорошие урожаи». Князь Горчаков покупает имение заочно, в Петербурге.', light: [-0.5, 0.5, 0.7], haze: [0.80, 0.66, 0.50], hazeK: 0.10 },
  { id: 'ravine', lon: 35.062, lat: 44.867, year: '1895', place: 'Архадерессе', img: 'scenes/ravine-1895.jpg', depth: 'depth/ravine-1895-depth.png', painter: 'Сцена дома', title: 'Овраг, ставший подвалом', pyear: 2026, text: 'Голицын не строит стен: расчищает дно оврагов и достраивает верх. Подвал №1 в 1888-м, №2 в 1895-м, №3 в 1898-м, №4 в 1899-м. Они стоят до сих пор.', light: [-0.6, 0.45, 0.65], haze: [0.85, 0.66, 0.45], hazeK: 0.10 },
  { id: 'kikineiz', lon: 34.050, lat: 44.420, year: '1898', place: 'Южный берег', img: 'scenes/kuindzhi-sea.jpg', depth: 'depth/kuindzhi-sea-depth.png', painter: 'Архип Куинджи', title: '«Море. Крым»', pyear: 1898, text: 'Свет Куинджи — свет этого берега. Тот же свет лежит на всей дороге.', light: [0.2, 0.7, 0.7], haze: [0.62, 0.70, 0.80], hazeK: 0.14 },
  { id: 'owner', lon: 35.058, lat: 44.869, year: '1899', place: 'Архадерессе', img: 'scenes/owner-1899.jpg', depth: 'depth/owner-1899-depth.png', painter: 'Сцена дома', title: 'Первый приезд', pyear: 2026, text: 'Одиннадцать лет князь Горчаков посылал сюда золото, ни разу не увидев этой земли. В октябре 1899-го он приехал, увидел пустыню и отстранил Голицына от управления.', light: [-0.5, 0.5, 0.7], haze: [0.80, 0.72, 0.58], hazeK: 0.10 },
  { id: 'harvest', lon: 35.085, lat: 44.860, year: '1900', place: 'Козская долина', img: 'scenes/harvest-1900.jpg', depth: 'depth/harvest-1900-depth.png', painter: 'Сцена дома', title: 'Первый урожай', pyear: 2026, text: 'Сто гектаров на камне и солонце, миндаль от ветра. Рислинг, семильон, каберне и сорта, которых нет больше нигде: Эким Кара, Кефесия, Сары Пандас.', light: [0.5, 0.65, 0.6], haze: [0.78, 0.72, 0.56], hazeK: 0.10 },
  { id: 'cellar', lon: 35.062, lat: 44.866, year: '1900', place: 'Подвал №1', img: 'scenes/cellar-1900.jpg', depth: 'depth/cellar-1900-depth.png', painter: 'Сцена дома', title: 'Четырнадцать градусов', pyear: 2026, text: 'Двести тысяч декалитров выдержки в четырёх подвалах. Хранитель с фонарём и книга учёта: так рождаются «Солнечная Долина» и «Чёрный Доктор».', light: [-0.3, 0.3, 0.9], haze: [0.18, 0.14, 0.12], hazeK: 0.12 },
  { id: 'gurzuf', lon: 34.280, lat: 44.550, year: '1913', place: 'Гурзуф', img: 'scenes/korovin-gurzuf.jpg', depth: 'depth/korovin-gurzuf-depth.png', painter: 'Константин Коровин', title: '«Гурзуф»', pyear: 1913, text: 'Крым перед переменами. Через семь лет Горчаков продаст имение и уедет в Италию.', light: [0.5, 0.6, 0.65], haze: [0.80, 0.78, 0.66], hazeK: 0.22 },
  { id: 'kozy', lon: 35.101, lat: 44.876, year: '1929', place: 'Судак · Козы', img: 'scenes/bogaevsky-sudak-bay.jpg', depth: 'depth/bogaevsky-sudak-bay-depth.png', painter: 'Константин Богаевский', title: '«Судакская бухта»', pyear: 1929, text: 'Богаевский пишет эту землю всю жизнь. Село Козы у подножия гор с 1963 года называется Солнечная Долина.', light: [-0.4, 0.6, 0.7], haze: [0.58, 0.55, 0.48], hazeK: 0.2 },
  { id: 'gate', lon: 35.052, lat: 44.852, year: '2026', place: 'Архадерессе', img: 'scenes/gate-today.jpg', depth: 'depth/gate-today-depth.png', painter: 'Сцена дома', title: 'Ворота с солнцем', pyear: 2026, text: 'За воротами прямая дорога, кедры, ёмкости с молодым вином и дом, с которого всё началось. Ворота открыты.', light: [0.6, 0.5, 0.6], haze: [0.88, 0.74, 0.52], hazeK: 0.08 },
  { id: 'house', lon: 35.058, lat: 44.857, year: '2026', place: 'Дом 1888', img: 'scenes/house-1888.jpg', depth: 'depth/house-1888-depth.png', painter: 'Сцена дома', title: 'Дом с датой на фасаде', pyear: 2026, text: 'Четыреста гектаров, больше пятидесяти сортов, четыре подвала Голицына, и в них по-прежнему четырнадцать градусов. Приезжайте: всё, что вы видели, стоит на своих местах.', light: [0.55, 0.55, 0.62], haze: [0.90, 0.78, 0.58], hazeK: 0.06 },
 ],
 originals: [
  { id: 'sugdeya', lon: 34.960, lat: 44.842, year: 'VI век до н. э.', place: 'Сугдея · Судак', img: 'scenes/bossoli-sudak.jpg', depth: 'depth/bossoli-sudak-depth.png', painter: 'Карло Боссоли', title: '«Судак. Остатки генуэзской крепости»', pyear: 1856, text: 'Греки, а за ними генуэзцы, начали здесь виноделие. Сорта, которые растут в долине сегодня, — их наследие.', light: [-0.5, 0.6, 0.6], haze: [0.72, 0.62, 0.48], hazeK: 0.16 },
  { id: 'feodosia', lon: 35.382, lat: 45.032, year: '1787', place: 'Феодосия', img: 'scenes/aivazovsky-ekaterina.jpg', depth: 'depth/aivazovsky-ekaterina-depth.png', painter: 'Иван Айвазовский', title: '«Приезд Екатерины II в Феодосию»', pyear: 1883, text: 'После присоединения Крыма земли у Судака раздают помещикам: за тридцать лет здесь вырастают десятки имений.', light: [0.4, 0.5, 0.75], haze: [0.70, 0.66, 0.58], hazeK: 0.12 },
  { id: 'sudak', lon: 34.975, lat: 44.850, year: '1804', place: 'Судак', img: 'scenes/bogaevsky-sudak.jpg', depth: 'depth/bogaevsky-sudak-depth.png', painter: 'Константин Богаевский', title: '«Судак»', pyear: 1900, text: 'В Судаке открывается первое в России училище виноградарства и виноделия. Ему отведены земли у Судака.', light: [-0.6, 0.55, 0.6], haze: [0.78, 0.60, 0.42], hazeK: 0.18 },
  { id: 'balaklava', lon: 33.600, lat: 44.498, year: '1856', place: 'Балаклава', img: 'scenes/bossoli-balaklava.jpg', depth: 'depth/bossoli-balaklava-depth.png', painter: 'Карло Боссоли', title: '«Балаклава»', pyear: 1857, text: 'Крымская война. Полуостров разорён, имения у Судака переходят из рук в руки, но лозу здесь не бросают.', light: [0.5, 0.5, 0.7], haze: [0.74, 0.68, 0.56], hazeK: 0.16 },
  { id: 'yayla', lon: 34.300, lat: 44.630, year: '1885', place: 'Яйла', img: 'scenes/kuindzhi-yayla.jpg', depth: 'depth/kuindzhi-yayla-depth.png', painter: 'Архип Куинджи', title: '«Крым. Яйла»', pyear: 1885, text: 'Крым входит в моду: на Южный берег едут художники и дворы, а земля за Судаком всё ещё пустует. Её время придёт через три года.', light: [0.3, 0.7, 0.65], haze: [0.80, 0.78, 0.70], hazeK: 0.18 },
  { id: 'novysvet', lon: 34.910, lat: 44.830, year: '1878', place: 'Новый Свет', img: 'scenes/aivazovsky-utro.jpg', depth: 'depth/aivazovsky-utro-depth.png', painter: 'Иван Айвазовский', title: '«Утро на берегу Крыма»', pyear: 1870, text: 'Князь Лев Голицын строит в Новом Свете завод шампанских вин и ищет для него виноград. Так он находит Капсель.', light: [0.6, 0.35, 0.7], haze: [0.95, 0.62, 0.36], hazeK: 0.35 },
  { id: 'otuz', lon: 35.160, lat: 44.930, year: '1888', place: 'Отузская долина', img: 'scenes/aivazovsky-otuz.jpg', depth: 'depth/aivazovsky-otuz-depth.png', painter: 'Иван Айвазовский', title: '«Дождь и разлив реки Отуз в Крыму»', text: 'Соседняя с Козами долина. В 1888-м Голицын находит за Меганомом землю, «где рос шиповник», и князь Горчаков покупает имение заочно, в Петербурге.', light: [-0.4, 0.5, 0.75], haze: [0.72, 0.70, 0.66], hazeK: 0.22 },
  { id: 'port', lon: 35.400, lat: 45.020, year: '1895', place: 'Феодосия', img: 'scenes/aivazovsky-feodosia.jpg', depth: 'depth/aivazovsky-feodosia-depth.png', painter: 'Иван Айвазовский', title: '«Вид Феодосии»', pyear: 1845, text: 'Ближайший к имению порт: отсюда судакское вино уходит морем. В оврагах Архадерессе тем временем достраивают второй подвал.', light: [0.5, 0.45, 0.72], haze: [0.78, 0.72, 0.60], hazeK: 0.14 },
  { id: 'kikineiz', lon: 34.050, lat: 44.420, year: '1898', place: 'Южный берег', img: 'scenes/kuindzhi-sea.jpg', depth: 'depth/kuindzhi-sea-depth.png', painter: 'Архип Куинджи', title: '«Море. Крым»', pyear: 1898, text: 'Свет Куинджи — свет этого берега. Тот же свет лежит на всей дороге.', light: [0.2, 0.7, 0.7], haze: [0.62, 0.70, 0.80], hazeK: 0.14 },
  { id: 'outskirts', lon: 35.095, lat: 44.880, year: '1900', place: 'Козы', img: 'scenes/bogaevsky-outskirts.jpg', depth: 'depth/bogaevsky-outskirts-depth.png', painter: 'Константин Богаевский', title: '«Окрестности Судака»', text: 'Козы, село у подножия гор. Первый урожай Архадерессе: сто гектаров на камне и солонце, рислинг, семильон, каберне и сорта, которых нет больше нигде.', light: [-0.4, 0.6, 0.65], haze: [0.80, 0.72, 0.56], hazeK: 0.14 },
  { id: 'gurzuf', lon: 34.280, lat: 44.550, year: '1913', place: 'Гурзуф', img: 'scenes/korovin-gurzuf.jpg', depth: 'depth/korovin-gurzuf-depth.png', painter: 'Константин Коровин', title: '«Гурзуф»', pyear: 1913, text: 'Крым перед переменами. Через семь лет Горчаков продаст имение и уедет в Италию.', light: [0.5, 0.6, 0.65], haze: [0.80, 0.78, 0.66], hazeK: 0.22 },
  { id: 'koktebel', lon: 35.245, lat: 44.960, year: '1920', place: 'Коктебель', img: 'scenes/bogaevsky-koktebel.jpg', depth: 'depth/bogaevsky-koktebel-depth.png', painter: 'Константин Богаевский', title: '«Коктебель»', pyear: 1920, text: 'Горчаков продаёт имение и уезжает в Италию. За соседней горой, в Коктебеле, Волошин собирает поэтов; Богаевский пишет эту землю всю жизнь.', light: [-0.5, 0.55, 0.65], haze: [0.76, 0.70, 0.60], hazeK: 0.18 },
  { id: 'kozy', lon: 35.108, lat: 44.872, year: '1929', place: 'Судак · Козы', img: 'scenes/bogaevsky-sudak-bay.jpg', depth: 'depth/bogaevsky-sudak-bay-depth.png', painter: 'Константин Богаевский', title: '«Судакская бухта»', pyear: 1929, text: 'Богаевский пишет эту землю всю жизнь. Село Козы у подножия гор с 1963 года называется Солнечная Долина.', light: [-0.4, 0.6, 0.7], haze: [0.58, 0.55, 0.48], hazeK: 0.2 },
  { id: 'today', lon: 35.055, lat: 44.855, year: '2026', place: 'Архадерессе', img: 'scenes/valley-today.jpg', depth: 'depth/valley-today-depth.png', painter: 'Съёмка 21 августа 2026', title: 'Виноградники Архадерессе', pyear: 2026, text: 'Четыреста гектаров, больше пятидесяти сортов, четыре подвала Голицына. Приезжайте: всё, что вы видели, стоит на своих местах.', light: [0.6, 0.5, 0.6], haze: [0.85, 0.70, 0.50], hazeK: 0.10 },
 ],
};
const SND = {"sugdeya":{"sea":0.5,"wind":0.3,"gulls":0.35},"feodosia":{"sea":0.45,"gulls":0.3,"wind":0.2},"sudak":{"wind":0.3,"cicadas":0.35,"sea":0.15,"gulls":0.15},"novysvet":{"sea":0.6,"gulls":0.25,"wind":0.15},"kapsel":{"wind":0.55,"cicadas":0.35,"sea":0.15},"ravine":{"wind":0.3,"cicadas":0.2,"fire":0.15},"kikineiz":{"sea":0.7,"wind":0.25,"gulls":0.2},"owner":{"wind":0.5,"cicadas":0.2},"harvest":{"cicadas":0.6,"wind":0.3},"cellar":{"drip":0.6,"hum":0.4},"gurzuf":{"sea":0.4,"cicadas":0.3,"gulls":0.2},"kozy":{"wind":0.3,"cicadas":0.45},"gate":{"cicadas":0.5,"wind":0.2},"house":{"cicadas":0.5,"wind":0.15},"today":{"cicadas":0.5,"wind":0.3},"balaklava":{"sea":0.5,"wind":0.3,"gulls":0.3},"yayla":{"wind":0.75},"otuz":{"rain":0.7,"wind":0.45},"port":{"sea":0.4,"gulls":0.3,"wind":0.15},"outskirts":{"wind":0.35,"cicadas":0.45},"koktebel":{"sea":0.4,"wind":0.3,"cicadas":0.2}};
for (const set of Object.values(SETS)) for (const c of set) c.snd = SND[c.id] || { wind: 0.3, cicadas: 0.2 };
const SET = SETS[qs.get('set')] ? qs.get('set') : (SETS[document.documentElement.dataset.set] ? document.documentElement.dataset.set : 'gemini');
const CH = SETS[SET];
document.documentElement.dataset.set = SET;
const L = 1.9;                         // экранов на главу: перелёт 0–0.4, нырок 0.4–0.75, картина 0.75–1.65, выход 1.65–1.9
const N = mobile ? 40000 : 90000;     // мазков на картину
const W = 16;                          // ширина холста, единиц
const DEPTH = 1.8;                     // глубина рельефа холста
const FAITHFUL = true;                 // полотно как есть: без перерисовки мазками, только глубина, свет и воздух
const USE_STROKES = false;
const HI_SCENES = new Set(['kuindzhi-sea', 'korovin-gurzuf', 'bossoli-balaklava', 'kuindzhi-yayla']);   // есть копии 3072 px в scenes/hi/             // мазки в переходах выключены: не грузим strokes.bin и не строим их геометрию

// ---------- шейдеры ----------
const NOISE = /* glsl */`
vec3 mod289(vec3 x){return x - floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x - floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314*r;}
float snoise(vec3 v){ const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
 vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx); vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g; vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
 vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + C.yyy; vec3 x3 = x0 - D.yyy; i = mod289(i);
 vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
 float n_ = 0.142857142857; vec3 ns = n_ * D.wyz - D.xzx; vec4 j = p - 49.0 * floor(p * ns.z * ns.z); vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
 vec4 x = x_ * ns.x + ns.yyyy; vec4 y = y_ * ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y); vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
 vec4 s0 = floor(b0)*2.0 + 1.0; vec4 s1 = floor(b1)*2.0 + 1.0; vec4 sh = -step(h, vec4(0.0)); vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
 vec3 p0 = vec3(a0.xy, h.x); vec3 p1 = vec3(a0.zw, h.y); vec3 p2 = vec3(a1.xy, h.z); vec3 p3 = vec3(a1.zw, h.w);
 vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3))); p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
 vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m = m * m; return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3))); }
`;
// карта: точки света на горизонталях Крыма
const MAP_VERT = /* glsl */`
precision highp float;
in vec3 position; in vec3 aNrm; in float aSize; in float aMat; in float aSeed;
uniform mat4 projectionMatrix; uniform mat4 modelViewMatrix; uniform vec3 uCam; uniform float uPx; uniform float uTime; uniform vec3 uFocus; uniform float uFocusR; uniform float uReveal; uniform float uLift;
out vec3 vCol; out float vA;
${NOISE}
void main(){
  vec3 p = position;
  vec3 sun = normalize(vec3(-0.5, 0.55, 0.65));
  float lit = max(dot(aNrm, sun), 0.0);
  // aMat ≥ 10: точка детализации z12 — видна только с малой высоты
  float fine = step(9.5, aMat); float matv = aMat - fine * 10.0;
  vec3 col;
  if (matv < 0.5) { // море: редкие искры
    float sp = pow(max(snoise(vec3(p.xz * 0.15, uTime * 0.12)), 0.0), 3.0);
    col = vec3(0.10, 0.16, 0.26) * 0.6 + vec3(1.0, 0.85, 0.6) * sp * 0.8;
  } else if (matv < 1.5) { // горизонтали
    col = mix(vec3(0.55, 0.40, 0.22), vec3(1.0, 0.82, 0.50), lit) * 1.1;
  } else { // береговая линия
    col = vec3(1.0, 0.9, 0.7) * 1.3;
  }
  // очаг внимания: вокруг точки главы теплее и ярче
  float d = length(p.xz - uFocus.xz);
  float focus = exp(-d * d / (uFocusR * uFocusR));
  col *= 0.55 + 0.75 * focus + uLift * focus * 1.5;
  p.y += uLift * focus * (0.5 + aSeed * 3.0) * 5.0;
  float dist = length(p - uCam);
  col = mix(col, vec3(0.16, 0.14, 0.18), 1.0 - exp(-dist * 0.0018));
  float lod = mix(1.0, 1.0 - smoothstep(14.0, 34.0, dist), fine);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float depth = max(-mv.z, 0.1);
  float px = aSize * uPx / depth;
  float a = 0.9;
  if (px < 1.3) { a *= (px * px) / 1.69; px = 1.3; }
  if (px > 4.0) { a *= 16.0 / (px * px); px = min(px, 8.0); }
  gl_PointSize = px;
  gl_Position = projectionMatrix * mv;
  vCol = col; vA = a * (matv < 0.5 ? 0.35 : 1.0) * uReveal * lod;
}
`;
const MAP_FRAG = /* glsl */`
precision highp float; in vec3 vCol; in float vA; out vec4 outColor;
void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float r2 = dot(q, q); if (r2 > 1.0) discard; float a = (1.0 - r2); a *= a * vA; outColor = vec4(vCol * a, a * 0.55); }
`;
const SKY_VERT = /* glsl */`precision highp float; in vec3 position; in vec2 uv; out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }`;
const SKY_FRAG = /* glsl */`precision highp float; in vec2 vUv; out vec4 outColor; uniform float uTime; uniform float uDawn; uniform vec2 uSunUv;
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){ vec3 top = vec3(0.020, 0.022, 0.034), mid = mix(vec3(0.055, 0.045, 0.040), vec3(0.10, 0.07, 0.05), uDawn), hor = mix(vec3(0.16, 0.11, 0.07), vec3(0.30, 0.17, 0.08), uDawn); float y = vUv.y; vec3 col = mix(hor, mid, smoothstep(0.0, 0.35, y)); col = mix(col, top, smoothstep(0.35, 1.0, y)); float ds = length((vUv - uSunUv) * vec2(1.6, 1.0)); col += vec3(0.95, 0.42, 0.14) * uDawn * exp(-ds * 2.6) * 0.9; outColor = vec4(col, 1.0); }`;

// картина: мазки на глубине
const STROKE_VERT = /* glsl */`
precision highp float;
in vec3 position; in vec2 uv;
in vec3 aPos; in float aAng; in vec2 aSize; in vec3 aCol; in float aSeed;
uniform mat4 projectionMatrix; uniform mat4 modelViewMatrix; uniform float uTime; uniform float uBreath; uniform float uAssemble;
out vec2 vUv; out vec3 vCol; out float vAng; out float vSeed; out float vDepth; out vec3 vWorld; out float vE;
${NOISE}
void main(){
  vec3 p = aPos;
  p.xy += vec2(snoise(vec3(p.xy * 0.35, uTime * 0.05 + aSeed)), snoise(vec3(p.yx * 0.35, uTime * 0.05 + 7.0))) * uBreath;
  // сборка: мазок прилетает из рассеянного облака света на своё место (uAssemble 0 → 1), поздние мазки — позже
  float e = clamp((uAssemble - aSeed * 0.35) / 0.65, 0.0, 1.0); e = 1.0 - pow(1.0 - e, 3.0);
  vec3 sc = aPos + vec3((fract(aSeed * 13.17) - 0.5) * 14.0, (fract(aSeed * 71.3) - 0.5) * 8.0 - 2.0, 1.5 + fract(aSeed * 5.7) * 5.0);
  p = mix(sc, p, e);
  float c = cos(aAng + (1.0 - e) * 2.5), s = sin(aAng + (1.0 - e) * 2.5);
  vec2 q = position.xy * aSize * (0.35 + 0.65 * e);
  vec3 world = p + vec3(q.x * c - q.y * s, q.x * s + q.y * c, 0.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
  vUv = uv; vCol = aCol; vAng = aAng; vSeed = aSeed; vDepth = p.z; vWorld = world; vE = e;
}
`;
const STROKE_FRAG = /* glsl */`
precision highp float;
in vec2 vUv; in vec3 vCol; in float vAng; in float vSeed; in float vDepth; in vec3 vWorld; in float vE;
uniform sampler2D uBrush; uniform vec3 uLight; uniform vec3 uLightCol; uniform vec3 uHaze; uniform float uHazeK; uniform vec3 uCam; uniform float uGloss; uniform float uDepthScale; uniform float uStrokeA;
out vec4 outColor;
void main(){
  float k = floor(vSeed * 3.999);
  vec2 tuv = (vUv + vec2(mod(k, 2.0), floor(k / 2.0))) * 0.5;
  vec4 b = texture(uBrush, tuv);
  float alpha = b.a * uStrokeA;
  if (alpha < 0.02) discard;
  vec2 n2 = (b.gb * 2.0 - 1.0);
  float c = cos(vAng), s = sin(vAng);
  vec3 n = normalize(vec3(n2.x * c - n2.y * s, n2.x * s + n2.y * c, 1.0));
  vec3 L = normalize(uLight);
  vec3 V = normalize(uCam - vWorld);
  vec3 H = normalize(L + V);
  vec3 base = pow(vCol, vec3(2.2));
  float lum = dot(base, vec3(0.3, 0.59, 0.11));
  float diff = 0.8 + 0.2 * max(dot(n, L), 0.0);
  float spec = pow(max(dot(n, H), 0.0), 30.0) * uGloss * (0.3 + 0.7 * b.r) * (0.15 + 0.85 * smoothstep(0.02, 0.5, lum));
  vec3 col = base * diff + uLightCol * spec * 0.4;
  float far = clamp(0.5 - vDepth / uDepthScale, 0.0, 1.0);
  col = mix(col, pow(uHaze, vec3(2.2)), far * uHazeK);
  // в полёте мазок — искра света карты, на месте — краска
  float fly = 1.0 - vE; col = mix(col, vec3(1.0, 0.8, 0.5) * (1.2 + 0.8 * b.r), fly * 0.85);
  outColor = vec4(col * alpha, alpha);
}
`;
const UNDER_VERT = /* glsl */`
precision highp float;
in vec3 position; in vec2 uv;
uniform mat4 projectionMatrix; uniform mat4 modelViewMatrix; uniform sampler2D uDepth; uniform float uDepthScale; uniform sampler2D uNoise; uniform float uTime;
out vec2 vUv; out float vZ; out float vCloud;
void main(){ vUv = uv; float d = textureLod(uDepth, uv, 2.5).r; vec3 p = position; float ek = smoothstep(0.0, 0.05, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y))); p.z = ((d - 0.5) * uDepthScale - 0.05) * ek; vZ = p.z;   // у кромки рельеф глубины гаснет: край полотна остаётся ровным прямоугольником
  // свет облаков: медленное дыхание освещённости по полотну
  vCloud = textureLod(uNoise, uv * 0.7 + vec2(uTime * 0.004, uTime * 0.0025), 0.0).r * 2.0 - 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }
`;
const UNDER_FRAG = /* glsl */`
precision highp float; in vec2 vUv; in float vZ; in float vCloud;
uniform sampler2D uImg; uniform sampler2D uMask; uniform sampler2D uNoise; uniform vec3 uHaze; uniform float uHazeK; uniform float uDepthScale; uniform vec3 uLight; uniform vec3 uLightCol; uniform float uTime; uniform float uShow;
uniform vec4 uFx; uniform float uLife; uniform float uGust; uniform float uFlicker; uniform float uGloss; uniform float uExposure;
uniform sampler2D uNow; uniform vec4 uNowFit; uniform float uWipe; uniform float uHazeBoost; uniform vec2 uFlowW; uniform vec2 uFlowS; uniform float uWarm; uniform vec4 uFall; uniform float uFallV;
out vec4 outColor;
vec4 nz(vec2 p){ return texture(uNoise, p) * 2.0 - 1.0; }
void main(){
  // маска: r вода, g небо, b листва, a огонь и фонари
  vec4 m = vec4(texture(uMask, vec2(vUv.x * 0.5, vUv.y)).rgb, texture(uMask, vec2(vUv.x * 0.5 + 0.5, vUv.y)).r) * uLife;
  float t = uTime; vec2 uv = vUv;
  // листва: дрожь от ветра, порывы усиливают; две частоты
  float wf = 0.55 + 0.9 * uGust;
  vec2 fol = (nz(uv * 6.0 + vec2(t * 0.035, t * 0.02)).rg + 0.5 * nz(uv * 15.0 - vec2(t * 0.06, t * 0.03)).ba) * 0.0019 * m.b * uFx.z * wf;
  // вода и облака: два потока в противофазе (искажение не накапливается) + рябь
  float ph = fract(t * 0.09), ph2 = fract(ph + 0.5); float wgt = abs(ph * 2.0 - 1.0);
  float lum0 = dot(texture(uImg, uv).rgb, vec3(0.3, 0.59, 0.11)); float edgeK = 1.0 - smoothstep(0.015, 0.07, fwidth(lum0));
  vec2 ripple = nz(uv * vec2(9.0, 22.0) + vec2(t * 0.05, t * 0.02)).ba * 0.0025 * m.r * uFx.x * edgeK;
  vec2 flow = (uFlowW * 0.0075 * m.r * uFx.x + uFlowS * 0.0055 * m.g * uFx.y) * edgeK;
  vec2 uvA = uv + fol + flow * ph + ripple, uvB = uv + fol + flow * ph2 - ripple;
  vec3 src = mix(texture(uImg, uvA).rgb, texture(uImg, uvB).rgb, wgt);
  // водопад: внутри своей области те же мазки едут вниз быстрой петлёй (две фазы в противофазе), по краям области плавно
  float inFall = 0.0;
  if (uFallV > 0.001) { vec2 f0 = smoothstep(vec2(0.0), vec2(0.025), uv - uFall.xy), f1 = smoothstep(vec2(0.0), vec2(0.025, 0.08), uFall.zw - uv);   // у кромки обрыва смещение гаснет шире, чтобы верх струи не дёргался inFall = f0.x * f0.y * f1.x * f1.y * uLife;
    if (inFall > 0.001) { float pf = fract(t * 0.55), pf2 = fract(pf + 0.5); float wf2 = abs(pf * 2.0 - 1.0); vec2 fv = vec2(0.0, 0.05 * uFallV) * inFall; vec2 jit = (nz(uv * vec2(40.0, 8.0) + vec2(0.0, t * 0.9)).rg) * 0.002 * inFall;
      vec3 sF = mix(texture(uImg, uv + fv * pf + jit).rgb, texture(uImg, uv + fv * pf2 + jit).rgb, wf2); src = mix(src, sF, inFall); } }
  vec3 col = pow(src, vec3(2.2)) * uExposure;
  float lum = dot(src, vec3(0.3, 0.59, 0.11));
  // лак и паста: рельеф из самой живописи (градиент светлоты), по нему ходит блик
  // рельеф берётся с шага в 2.5 текселя, а не с экранного пикселя: шум JPEG не даёт белых точек, мазки — дают
  vec2 ts = 2.5 / vec2(textureSize(uImg, 0)); const vec3 LW = vec3(0.3, 0.59, 0.11);
  float gx = dot(texture(uImg, uvA + vec2(ts.x, 0.0)).rgb - texture(uImg, uvA - vec2(ts.x, 0.0)).rgb, LW);
  float gy = dot(texture(uImg, uvA + vec2(0.0, ts.y)).rgb - texture(uImg, uvA - vec2(0.0, ts.y)).rgb, LW);
  vec3 n = normalize(vec3(-gx * 14.0, gy * 14.0, 1.0));
  vec3 L = normalize(uLight); vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, H), 0.0), 36.0) * (0.25 + 0.75 * smoothstep(0.05, 0.6, lum));
  col += vec3(1.0, 0.95, 0.85) * spec * uGloss;
  // блики на воде: бегущие искры там, где вода и так светлая
  float sp = pow(max(nz(uv * vec2(24.0, 48.0) + vec2(t * 0.09, -t * 0.04)).r, 0.0), 5.0) * m.r * uFx.x * smoothstep(0.25, 0.7, lum);
  col += pow(uLightCol, vec3(2.2)) * sp * 0.6;
  // водопад: бегущие вниз прожилки пены и мягкая водяная пыль у подножия
  if (inFall > 0.001) { float st = pow(max(nz(uv * vec2(60.0, 6.0) + vec2(0.0, t * 1.4)).b, 0.0), 3.0); float foot = 1.0 - smoothstep(uFall.y, uFall.y + 0.12, uv.y); col += vec3(0.9, 0.92, 0.95) * (st * 0.10 + foot * 0.06 * (0.6 + 0.4 * nz(uv * 12.0 + t * 0.2).a)) * inFall * smoothstep(0.3, 0.8, lum); }
  // свет облаков по земле
  col *= 1.0 + 0.05 * uFx.y * uLife * vCloud * (1.0 - m.g);
  // свет теплеет за время главы (рассвет внутри картины)
  col *= mix(vec3(1.0), vec3(1.12, 1.03, 0.90), uWarm); col += uWarm * 0.025 * pow(uLightCol, vec3(2.2)) * (0.5 + 0.5 * m.g);
  // огонь и фонари: мерцание и тёплый ореол
  col *= 1.0 + m.a * uFx.w * uFlicker * 0.35;
  col += m.a * uFx.w * vec3(1.0, 0.55, 0.22) * 0.12 * (1.0 + uFlicker);
  float far = clamp(0.5 - vZ / uDepthScale, 0.0, 1.0);
  col = mix(col, pow(uHaze, vec3(2.2)), clamp(far * uHazeK * 0.22 + uHazeBoost * (0.44 + 0.42 * far), 0.0, 1.0));
  // шторка: справа налево проступает фотография этого места сегодня
  if (uWipe > 0.001) { float e = 1.0 - uWipe * 1.06; float w = smoothstep(e - 0.025, e + 0.025, vUv.x); vec3 now = pow(texture(uNow, vUv * uNowFit.xy + uNowFit.zw).rgb, vec3(2.2)); float line = exp(-abs(vUv.x - e) * 220.0) * 0.5; col = mix(col, now, w) + vec3(1.0, 0.85, 0.55) * line * step(0.01, uWipe) * step(uWipe, 0.99); }
  outColor = vec4(col * uShow, uShow);
}
`;
// фигуры людей: отдельные слои с опорой в ногах; покачивание, дыхание, шаг, трепет одежды
const PEOPLE_VERT = /* glsl */`
precision highp float;
in vec3 position; in vec2 uv;
uniform mat4 projectionMatrix; uniform mat4 modelViewMatrix; uniform float uTime; uniform float uLife; uniform float uGust;
uniform vec3 uPos; uniform vec2 uSize; uniform float uSeed; uniform vec4 uWalk; uniform float uT0; uniform float uLifeF;
out vec2 vUv; out float vZ; out float vV;
void main(){
  float t = uTime, life = uLife * uLifeF;
  vec2 q = position.xy * uSize;            // локальные координаты, опора (0, -uSize.y/2) — ноги
  float v = uv.y;                          // 0 — ноги, 1 — голова
  // шаг: фигура проходит путь uWalk.xy (в долях роста) за uWalk.w секунд после появления, замедляясь; uWalk.z — уменьшение (уход вглубь)
  float tw = max(t - uT0, 0.0); float w = 1.0 - exp(-tw / max(uWalk.w, 0.1) * 3.0); w *= step(0.001, abs(uWalk.x) + abs(uWalk.y));
  float cad = 5.0;                         // темп шага
  float step_ = sin(t * cad + uSeed * 6.28);
  // покачивание вокруг ног и дыхание
  float sway = sin(t * 0.9 + uSeed * 6.28) * 0.02 * life + step_ * 0.012 * w * life;
  float breath = 1.0 + sin(t * 1.3 + uSeed * 3.1) * 0.005 * life;
  vec2 r = vec2(q.x * cos(sway) - (q.y + uSize.y * 0.5) * sin(sway), (q.x * sin(sway) + (q.y + uSize.y * 0.5) * cos(sway)) * breath - uSize.y * 0.5);
  // ноги: сдвиг нижней половины в такт шага, подпрыгивание
  r.x += step_ * 0.05 * uSize.y * max(0.0, 0.5 - v) * 2.0 * w * life;
  r.y += abs(step_) * 0.012 * uSize.y * w * life;
  vec3 p = uPos + vec3(r, 0.0);
  p.xy += uWalk.xy * uSize.y * w * life;
  float sh = 1.0 - uWalk.z * w * life;      // уменьшение при уходе вглубь
  p.xy = uPos.xy + (p.xy - uPos.xy) * sh; p.y -= uSize.y * 0.5 * (1.0 - sh) * 0.0;
  vUv = uv; vZ = p.z; vV = v;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;
const PEOPLE_FRAG = /* glsl */`
precision highp float; in vec2 vUv; in float vZ; in float vV;
uniform sampler2D uTex; uniform vec4 uRect; uniform sampler2D uTex2; uniform vec4 uRect2; uniform float uHas2; uniform float uTime; uniform float uLife; uniform float uLifeF; uniform float uGust; uniform float uSeed; uniform float uShow; uniform float uHazeBoost;
uniform vec3 uHaze; uniform float uHazeK; uniform float uDepthScale;
out vec4 outColor;
void main(){
  vec2 uv = vUv;
  // трепет одежды: низ фигуры чуть колышется, порывы усиливают
  uv.x += sin(uTime * 2.4 + uSeed * 9.0 + vV * 14.0) * 0.006 * pow(1.0 - vV, 2.0) * (0.5 + uGust) * uLife * uLifeF;
  vec2 tuv = uRect.xy + uv * uRect.zw;
  vec4 c = texture(uTex, tuv);
  // вторая фаза шага: мягкое перелистывание двух кадров в такт (та же кадровая сетка, что у шага в вершинах)
  if (uHas2 > 0.5) { float ph = smoothstep(0.45, 0.55, 0.5 + 0.5 * sin(uTime * 5.0 + uSeed * 6.28)); vec4 c2 = texture(uTex2, uRect2.xy + uv * uRect2.zw); c2 = vec4(mix(c.rgb, c2.rgb, smoothstep(0.05, 0.5, c2.a)), max(c2.a, c.a)); c = mix(c, c2, ph * uLife * uLifeF); }   /* силуэт — от первого кадра, чтобы светлые фигуры не таяли */
  if (c.a < 0.01) discard;
  vec3 col = pow(c.rgb, vec3(2.2));
  float far = clamp(0.5 - vZ / uDepthScale, 0.0, 1.0);
  col = mix(col, pow(uHaze, vec3(2.2)), clamp(far * uHazeK * 0.22 + uHazeBoost * (0.44 + 0.42 * far), 0.0, 1.0));
  float a = c.a * uShow;
  outColor = vec4(col * a, a);
}
`;
const DUST_VERT = /* glsl */`
precision highp float; in vec3 position; in float aSeed;
uniform mat4 projectionMatrix; uniform mat4 modelViewMatrix; uniform float uTime; uniform float uPx; out float vA;
${NOISE}
void main(){ vec3 p = position; p += vec3(snoise(p * 0.3 + uTime * 0.03), snoise(p.yzx * 0.3 + uTime * 0.025 + 4.0), snoise(p.zxy * 0.3 + 2.0)) * 0.5; p.y += sin(uTime * 0.2 + aSeed * 20.0) * 0.12;
  vec4 mv = modelViewMatrix * vec4(p, 1.0); float depth = max(-mv.z, 0.1); gl_PointSize = clamp((0.02 + aSeed * 0.02) * uPx / depth, 1.0, 4.0); gl_Position = projectionMatrix * mv;
  vA = (0.5 + 0.5 * sin(uTime * (0.6 + aSeed) + aSeed * 40.0)) * smoothstep(1.0, 4.0, depth); }
`;
const DUST_FRAG = /* glsl */`precision highp float; in float vA; out vec4 outColor; void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float r2 = dot(q, q); if (r2 > 1.0) discard; float a = (1.0 - r2); a *= a * vA * 0.04; outColor = vec4(vec3(1.0, 0.86, 0.6) * a, 0.0); }`;

// дождь: отрезки, падающие перед полотном; aEnd — конец штриха
const RAIN_VERT = /* glsl */`
precision highp float; in vec3 position; in float aSeed; in float aEnd;
uniform mat4 projectionMatrix; uniform mat4 modelViewMatrix; uniform float uTime; uniform vec2 uArea; uniform float uGust; out float vA;
void main(){ vec3 p = position; float sp = 2.6 + aSeed * 1.4; float y = mod(p.y - uTime * sp + aSeed * 50.0, uArea.y) - uArea.y * 0.5;
  float wind = 0.25 + uGust * 0.5; float x = mod(p.x - uTime * sp * wind * 0.35 + aSeed * 30.0, uArea.x) - uArea.x * 0.5;
  float len = (0.10 + aSeed * 0.12) * (1.0 - aEnd); vec3 w = vec3(x + len * wind * 0.35, y + len, p.z);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(w, 1.0); vA = 0.10 + 0.14 * aSeed; }
`;
const RAIN_FRAG = /* glsl */`precision highp float; in float vA; uniform float uHazeBoost; out vec4 outColor; void main(){ float a = vA * (1.0 - uHazeBoost); outColor = vec4(vec3(0.85, 0.9, 1.0) * a, a); }`;
// угли и искры: поднимаются от источника (фонарь, костёр), гаснут
const EMBER_VERT = /* glsl */`
precision highp float; in vec3 position; in float aSeed;
uniform mat4 projectionMatrix; uniform mat4 modelViewMatrix; uniform float uTime; uniform vec3 uSrc; uniform float uPx; out float vA; out float vHeat;
void main(){ float life = 2.5 + aSeed * 3.0; float t = mod(uTime * (0.7 + aSeed * 0.5) + aSeed * 40.0, life) / life;
  float ang = aSeed * 6.2831 + uTime * 0.3; vec3 p = uSrc + vec3(cos(ang) * 0.05 * (1.0 + t * 6.0) + sin(uTime * 1.7 + aSeed * 20.0) * 0.06 * t, t * (0.9 + aSeed * 0.6), 0.2 + aSeed * 0.5);
  vec4 mv = modelViewMatrix * vec4(p, 1.0); float depth = max(-mv.z, 0.1); gl_PointSize = clamp((0.012 + aSeed * 0.014) * uPx / depth * (1.0 - t * 0.5), 1.0, 5.0); gl_Position = projectionMatrix * mv;
  vA = (1.0 - t) * (0.6 + 0.4 * sin(uTime * (9.0 + aSeed * 8.0) + aSeed * 30.0)); vHeat = 1.0 - t; }
`;
const EMBER_FRAG = /* glsl */`precision highp float; in float vA; in float vHeat; uniform float uHazeBoost; out vec4 outColor; void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float r2 = dot(q, q); if (r2 > 1.0) discard; float a = (1.0 - r2) * vA * 0.9 * (1.0 - uHazeBoost); vec3 c = mix(vec3(1.0, 0.25, 0.05), vec3(1.0, 0.85, 0.45), vHeat); outColor = vec4(c * a, a); }`;
// дым: мягкие серые клубы поднимаются от источника (труба парохода, костёр) и сносятся ветром
const SMOKE_VERT = /* glsl */`
precision highp float; in vec3 position; in float aSeed;
uniform mat4 projectionMatrix; uniform mat4 modelViewMatrix; uniform float uTime; uniform vec3 uSrc; uniform float uPx; uniform float uGust; out float vA;
void main(){ float life = 6.0 + aSeed * 5.0; float t = mod(uTime * 0.5 + aSeed * 60.0, life) / life;
  vec3 p = uSrc + vec3(t * (1.2 + uGust * 1.5) + sin(uTime * 0.4 + aSeed * 9.0) * 0.15 * t, t * 2.2 + aSeed * 0.1, 0.25 + aSeed * 0.4);
  vec4 mv = modelViewMatrix * vec4(p, 1.0); float depth = max(-mv.z, 0.1); gl_PointSize = clamp((0.08 + 0.35 * t) * uPx / depth, 2.0, 90.0); gl_Position = projectionMatrix * mv;
  vA = (1.0 - t) * smoothstep(0.0, 0.15, t) * 0.10; }
`;
const SMOKE_FRAG = /* glsl */`precision highp float; in float vA; uniform float uHazeBoost; out vec4 outColor; void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float r2 = dot(q, q); if (r2 > 1.0) discard; float a = pow(1.0 - r2, 1.6) * vA * (1.0 - uHazeBoost); outColor = vec4(vec3(0.62, 0.60, 0.58) * a, a); }`;
// птицы: галочки из двух отрезков, парят над горизонтом; aBird — номер, aPart — вершина (0..3)
const BIRD_VERT = /* glsl */`
precision highp float; in vec3 position; in float aBird; in float aPart;
uniform mat4 projectionMatrix; uniform mat4 modelViewMatrix; uniform float uTime; uniform vec4 uSky; uniform float uN; out float vA;
void main(){ float sd = fract(aBird * 0.618 + 0.13); float t = uTime * (0.045 + sd * 0.03) + sd * 10.0;
  float x = (fract(t) * 1.3 - 0.15) * uSky.z + uSky.x; float y = uSky.y + uSky.w * (0.2 + 0.6 * fract(sd * 7.3)) + sin(t * 9.0 + sd * 5.0) * 0.08;
  float sz = 0.05 + fract(sd * 3.7) * 0.05; float flap = sin(uTime * (5.0 + sd * 3.0) + sd * 20.0) * 0.5 + 0.3;
  vec2 o = vec2(0.0); if (aPart < 0.5) o = vec2(-sz, sz * flap); if (aPart > 2.5) o = vec2(sz, sz * flap);
  vec3 p = vec3(x + o.x, y + o.y, position.z);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); vA = 0.55 * smoothstep(0.0, 0.08, fract(t)) * (1.0 - smoothstep(0.9, 1.0, fract(t))); }
`;
const BIRD_FRAG = /* glsl */`precision highp float; in float vA; uniform float uHazeBoost; out vec4 outColor; void main(){ float a = vA * (1.0 - uHazeBoost); outColor = vec4(vec3(0.08, 0.07, 0.06) * a, a); }`;

const FS_VERT = /* glsl */`precision highp float; in vec3 position; in vec2 uv; out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }`;
const MIX_FRAG = /* glsl */`precision highp float; in vec2 vUv; out vec4 outColor; uniform sampler2D uA; uniform sampler2D uB; uniform float uMix; uniform float uZoom; uniform float uFog; uniform vec3 uFogCol; uniform sampler2D uNoise; uniform float uTime; uniform vec4 uIris; uniform float uAspect;
void main(){ vec2 uvB = (vUv - 0.5) * (1.0 + (1.0 - uMix) * 0.10 * uZoom) + 0.5; vec2 uvA = mix(vUv, uIris.xy + (vUv - uIris.xy) * (1.0 - 0.12 * clamp(uIris.z / 1.7, 0.0, 1.0)), uIris.w); vec3 a = texture(uA, uvA).rgb;   // карта чуть наплывает вокруг точки, пока диафрагма растёт — падение в точку
  // дымка клочьями: плотность и граница смешения гуляют по шуму, экран не становится ровным листом
  float n = texture(uNoise, vUv * vec2(1.6, 1.0) + vec2(uTime * 0.012, uTime * 0.004)).r + 0.5 * texture(uNoise, vUv * vec2(3.2, 2.0) - vec2(uTime * 0.02, 0.0)).g;
  float mist = clamp(uFog * (0.72 + 0.4 * (n - 0.75)), 0.0, 1.0); a = mix(a, uFogCol * (0.9 + 0.2 * vUv.y), mist);
  vec3 b = texture(uB, uvB).rgb; float m = smoothstep(0.0, 1.0, clamp(uMix + (n - 0.75) * 0.3 * (1.0 - abs(uMix * 2.0 - 1.0)), 0.0, 1.0));
  // диафрагма из точки места: полотно открывается изнутри точки на карте рваным светящимся кругом (uIris: центр, радиус, сила)
  vec3 rim = vec3(0.0);
  if (uIris.w > 0.001) { vec2 q = (vUv - uIris.xy) * vec2(uAspect, 1.0); float dd = length(q) + (n - 0.75) * 0.16; float inside = 1.0 - smoothstep(uIris.z - 0.06, uIris.z + 0.06, dd); m = max(m, inside * uIris.w);
    rim = vec3(1.0, 0.86, 0.6) * exp(-abs(dd - uIris.z) * 30.0) * 0.42 * uIris.w * smoothstep(0.02, 0.18, uIris.z) * (1.0 - smoothstep(1.0, 1.5, uIris.z)); }
  outColor = vec4(mix(a, b, m) + rim, 1.0); }`;
const BLUR_FRAG = /* glsl */`precision highp float; in vec2 vUv; out vec4 outColor; uniform sampler2D uTex; uniform vec2 uTexel;
void main(){ vec3 c = vec3(0.0); for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) c += texture(uTex, vUv + vec2(float(x), float(y)) * uTexel * 2.0).rgb; outColor = vec4(c / 25.0, 1.0); }`;
const POST_FRAG = /* glsl */`
precision highp float; in vec2 vUv; out vec4 outColor;
uniform sampler2D uScene; uniform sampler2D uBlur; uniform vec2 uRes; uniform float uTime; uniform float uFade; uniform float uGrain; uniform float uVig; uniform float uBloom; uniform float uRays; uniform vec2 uSunUv;
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 aces(vec3 x){ const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0); }
void main(){ vec2 cc = vUv - 0.5; float r2 = dot(cc, cc); vec3 col = texture(uScene, vUv).rgb; col += max(texture(uBlur, vUv).rgb - 0.5, 0.0) * uBloom;
  // лучи на рассвете: 14 выборок размытого кадра к точке солнца, только яркое
  if (uRays > 0.001) { vec2 d = (uSunUv - vUv) * 0.06; vec2 p = vUv; vec3 acc = vec3(0.0); float w = 1.0, ws = 0.0; for (int i = 0; i < 14; i++) { p += d; acc += max(texture(uBlur, p).rgb - 0.35, 0.0) * w; ws += w; w *= 0.9; } col += acc / ws * uRays * vec3(1.0, 0.72, 0.45) * 1.6 * exp(-length((vUv - uSunUv) * vec2(1.4, 1.0)) * 1.6); }
  col = aces(col * 1.0);
  col *= 1.0 - uVig * smoothstep(0.12, 0.85, r2 * 2.2); col += (hash(vUv * uRes + fract(uTime * 11.3) * 100.0) - 0.5) * uGrain; col = pow(max(col, 0.0), vec3(1.0 / 2.2)); outColor = vec4(col * uFade, 1.0); }
`;

// ---------- кисть ----------
function makeBrushAtlas() {
  const T = 256, c = document.createElement('canvas'); c.width = T * 2; c.height = T * 2;
  const ctx = c.getContext('2d');
  let a0 = 12345; const rand = () => { a0 |= 0; a0 = (a0 + 0x6D2B79F5) | 0; let t = Math.imul(a0 ^ (a0 >>> 15), 1 | a0); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = ctx.createImageData(T * 2, T * 2); const H = new Float32Array(T * T);
  for (let k = 0; k < 4; k++) {
    const ox = (k % 2) * T, oy = (k >> 1) * T;
    const bristles = []; for (let b = 0; b < 24; b++) bristles.push({ y: 0.08 + rand() * 0.84, a: 0.5 + rand() * 0.5, w: 0.02 + rand() * 0.05, ph: rand() * 6.28 });
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const u = x / T, v = y / T;
      const endL = 0.06 + 0.05 * Math.sin(v * 17 + k), endR = 0.94 - 0.05 * Math.sin(v * 13 + k * 2);
      const shape = smooth((u - endL) / 0.08) * smooth((endR - u) / 0.08) * smooth((v - 0.06) / 0.1) * smooth((0.94 - v) / 0.1);
      let streak = 0; for (const br of bristles) { const d = Math.abs(v - br.y - 0.012 * Math.sin(u * 9 + br.ph)); streak += br.a * Math.max(0, 1 - d / br.w); }
      streak = Math.min(1.4, streak);
      const alpha = Math.min(1, shape * (0.88 + 0.12 * streak));
      const height = shape * (0.55 + 0.45 * Math.min(1, streak)) * (1 - 0.25 * Math.abs(u - 0.5));
      H[y * T + x] = height; const p = ((oy + y) * T * 2 + ox + x) * 4; out.data[p + 3] = alpha * 255; out.data[p] = height * 255;
    }
    for (let y = 1; y < T - 1; y++) for (let x = 1; x < T - 1; x++) {
      const dx = (H[y * T + x + 1] - H[y * T + x - 1]) * 2.2, dy = (H[(y + 1) * T + x] - H[(y - 1) * T + x]) * 2.2;
      const p = ((oy + y) * T * 2 + ox + x) * 4; out.data[p + 1] = clamp((-dx * 0.5 + 0.5) * 255, 0, 255); out.data[p + 2] = clamp((-dy * 0.5 + 0.5) * 255, 0, 255);
    }
  }
  ctx.putImageData(out, 0, 0);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.NoColorSpace; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.anisotropy = 4;
  return tex;
}

// ---------- шум для жизни полотна: плиточный value-noise 256², четыре независимых канала ----------
let NOISE_TEX = null; const getNoise = () => NOISE_TEX || (NOISE_TEX = makeNoiseTex());
function makeNoiseTex() {
  const T = 256, data = new Uint8Array(T * T * 4);
  let a0 = 777; const rand = () => { a0 |= 0; a0 = (a0 + 0x6D2B79F5) | 0; let t = Math.imul(a0 ^ (a0 >>> 15), 1 | a0); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let ch = 0; ch < 4; ch++) {
    const acc = new Float32Array(T * T); let amp = 1, sum = 0;
    for (let oct = 0; oct < 4; oct++) {
      const n = 4 << oct; const g = new Float32Array(n * n); for (let i = 0; i < n * n; i++) g[i] = rand();
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
        const fx = x / T * n, fy = y / T * n, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = smooth(fx - x0), ty = smooth(fy - y0);
        const v = (i, j) => g[((j % n) + n) % n * n + ((i % n) + n) % n];
        acc[y * T + x] += amp * lerp(lerp(v(x0, y0), v(x0 + 1, y0), tx), lerp(v(x0, y0 + 1), v(x0 + 1, y0 + 1), tx), ty);
      }
      sum += amp; amp *= 0.5;
    }
    for (let i = 0; i < T * T; i++) data[i * 4 + ch] = clamp(acc[i] / sum * 255, 0, 255);
  }
  const tex = new THREE.DataTexture(data, T, T, THREE.RGBAFormat); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = true; tex.needsUpdate = true;
  return tex;
}
// режиссура по главам: куда идёт вода и облака, теплеет ли свет, как ведёт камера (смещение в долях ширины и зум: от → к)
const DIR = {
  _:        { flowW: [1, 0.05], flowS: [1, 0.1], warm: 0, cam: [0, 0, 1.0, 0, 0, 0.84] },
  sugdeya:  { flowW: [0.7, -0.4], flowS: [1, 0.05], warm: 0.2, cam: [-0.07, 0.01, 1.02, 0.05, -0.01, 0.84], fall: [0.60, 0.23, 0.73, 0.46], fallV: 1.0 },
  feodosia: { flowW: [0.6, -0.6], flowS: [1, 0], warm: 0.35, cam: [-0.08, 0.02, 1.0, 0.10, -0.02, 0.86], sun: [0.5, 0.8], rays: 0.2 },
  sudak:    { flowW: [1, 0], flowS: [0.8, 0.1], warm: 0.1, cam: [0.08, 0.02, 1.0, -0.06, -0.01, 0.85] },
  balaklava:{ flowW: [0.5, -0.3], flowS: [1, 0.15], warm: 0, cam: [-0.08, 0.03, 1.0, 0.08, -0.02, 0.86] },
  yayla:    { flowW: [1, 0], flowS: [1, 0.2], warm: 0.3, cam: [0, 0.03, 1.0, 0.02, -0.02, 0.80] },
  novysvet: { flowW: [0.35, -1.0], flowS: [0.8, 0.05], warm: 0.7, cam: [-0.06, -0.02, 1.0, 0.06, 0.0, 0.84], sun: [0.78, 0.62], rays: 0.3 },
  otuz:     { flowW: [1.0, -0.25], flowS: [1.3, 0.1], warm: 0, cam: [0.04, 0.02, 1.0, -0.03, -0.01, 0.82] },
  port:     { flowW: [0.5, -0.4], flowS: [1, 0.05], warm: 0.5, cam: [0.07, 0.02, 1.0, -0.06, -0.01, 0.85], sun: [0.62, 0.66], rays: 0.4 },
  kikineiz: { flowW: [0.1, -1.0], flowS: [1, 0.1], warm: 0.4, cam: [0.02, 0.04, 1.02, -0.01, -0.02, 0.80] },
  outskirts:{ flowW: [1, 0], flowS: [1, 0.1], warm: 0.2, cam: [-0.08, 0.02, 1.0, 0.07, -0.01, 0.84] },
  kapsel:   { flowW: [0.6, -0.3], flowS: [1, 0.05], warm: 0.15, cam: [-0.04, 0.03, 1.0, 0.08, -0.04, 0.82] },
  ravine:   { flowW: [1, 0], flowS: [1, 0.1], warm: 0.25, cam: [-0.09, 0.0, 1.0, 0.08, -0.02, 0.84], sun: [0.55, 0.95], rays: 0.22 },
  owner:    { flowW: [1, 0], flowS: [1, 0.1], warm: 0.2, cam: [-0.05, 0.02, 1.0, 0.09, -0.03, 0.83] },
  harvest:  { flowW: [0.6, -0.2], flowS: [1, 0.05], warm: 0.1, cam: [-0.09, 0.01, 1.0, 0.07, -0.02, 0.85] },
  cellar:   { flowW: [1, 0], flowS: [1, 0], warm: 0, cam: [0.0, 0.0, 1.02, 0.02, 0.01, 0.78], sun: [0.16, 0.82], rays: 0.25 },
  gurzuf:   { flowW: [0.4, -0.7], flowS: [1, 0.1], warm: 0.2, cam: [0.07, 0.02, 1.0, -0.06, -0.01, 0.85] },
  kozy:     { flowW: [0.6, -0.3], flowS: [1, 0.1], warm: 0.4, cam: [-0.08, 0.02, 1.0, 0.07, -0.01, 0.85] },
  koktebel: { flowW: [0.7, -0.2], flowS: [1, 0.15], warm: 0.2, cam: [0.06, 0.02, 1.0, -0.06, -0.01, 0.85] },
  gate:     { flowW: [1, 0], flowS: [1, 0.1], warm: 0.2, cam: [0.0, -0.01, 1.03, 0.0, 0.0, 0.76] },
  house:    { flowW: [1, 0], flowS: [1, 0.1], warm: 0.2, cam: [-0.03, 0.02, 1.02, 0.01, -0.01, 0.80] },
  today:    { flowW: [1, 0], flowS: [1, 0.1], warm: 0.1, cam: [-0.08, 0.02, 1.0, 0.07, -0.02, 0.85] },
};
// цвет солнца карты у точки полотна: тёплые закаты греют рельеф, холодный Куинджи остужает [r, g, b]
const MAPSUN = { novysvet: [1.0, 0.72, 0.45], port: [1.0, 0.8, 0.55], kikineiz: [0.88, 0.9, 0.92], otuz: [0.8, 0.82, 0.86], cellar: [0.95, 0.8, 0.6], yayla: [0.95, 0.9, 0.8] };
// лак (блик пасты) и глубина рельефа по полотнам: пастозная живопись блестит, акварель и литография почти нет; морю глубины меньше, пейзажу больше
const EXPOSURE = { _: 1.0, port: 0.84, novysvet: 0.94, kikineiz: 0.95, feodosia: 0.95, kozy: 0.92, yayla: 0.96 };
const GLOSS = { _: 0.10, gurzuf: 0.18, kikineiz: 0.14, novysvet: 0.13, yayla: 0.14, feodosia: 0.08, port: 0.08, otuz: 0.09, sugdeya: 0.03, balaklava: 0.03, sudak: 0.05, outskirts: 0.05, kozy: 0.04, koktebel: 0.05, today: 0.02 };
const DEPTHK = { _: 1.0, kikineiz: 0.7, novysvet: 0.75, feodosia: 0.85, port: 0.8, otuz: 0.8, sugdeya: 1.1, balaklava: 1.15, yayla: 1.1, sudak: 1.1, outskirts: 1.15, kapsel: 1.1, owner: 1.1, harvest: 1.05, ravine: 1.0, cellar: 1.2, gate: 1.1, house: 1.0, today: 0.8, kozy: 0.9, koktebel: 0.9, gurzuf: 0.9 };
// сила жизни по главам: [вода, небо, листва, огонь]; _ — по умолчанию
const FX = { _: [1, 1, 1, 1], sudak: [1, 1.6, 1, 0.5], gurzuf: [0.8, 1, 0.55, 0], port: [1.4, 0.35, 0.8, 0.5], today: [0, 1, 0.5, 0], koktebel: [1, 1.4, 1, 0], cellar: [0, 0, 0.3, 1], ravine: [0, 0.8, 1, 0.9], otuz: [1.5, 1.4, 1.3, 0], kikineiz: [1.3, 1, 0.6, 0], novysvet: [1.2, 1, 0.8, 0], feodosia: [1.6, 1, 0.8, 0.5],  gate: [0, 1, 1, 0], house: [0, 1, 1, 0] };

// ---------- карта Крыма: точки на горизонталях ----------
function buildMap(dem, meta) {
  const Wd = dem.w, Hd = dem.hgt, H = dem.h;
  const KM = 0.108;                 // км на пиксель (z10 на широте 45°)
  const EXAG = 4.0;
  const NP = mobile ? 160000 : 262144;
  let a = 1888; const rand = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const wx = (i) => (i - Wd / 2) * KM, wz = (j) => (j - Hd / 2) * KM, wy = (h) => h / 1000 * EXAG;
  const STEP = 50;
  const levels = (p, q) => { if (p < 0.5 && q < 0.5) return 0; if (p < 0.5 || q < 0.5) return 1; const lo = Math.min(p, q), hi = Math.max(p, q); return Math.floor(hi / STEP) - Math.floor(lo / STEP); };
  let total = 0;
  for (let j = 1; j < Hd - 2; j++) for (let i = 1; i < Wd - 2; i++) { const h0 = H[j * Wd + i]; total += levels(h0, H[j * Wd + i + 1]) + levels(h0, H[(j + 1) * Wd + i]); }
  const NSEA = Math.round(NP * 0.06), NFILL = Math.round(NP * 0.12), NLINE = NP - NSEA - NFILL;
  const keepP = Math.min(1, NLINE / total);
  const pos = new Float32Array(NP * 3), nrm = new Float32Array(NP * 3), size = new Float32Array(NP), mat = new Float32Array(NP), seed = new Float32Array(NP);
  let n = 0;
  const put = (x, y, z, nx, ny, nz, s, m) => { if (n >= NP) return; pos[n * 3] = x; pos[n * 3 + 1] = y; pos[n * 3 + 2] = z; nrm[n * 3] = nx; nrm[n * 3 + 1] = ny; nrm[n * 3 + 2] = nz; size[n] = s; mat[n] = m; seed[n] = rand(); n++; };
  const gradAt = (i, j) => [(H[j * Wd + Math.min(Wd - 1, i + 1)] - H[j * Wd + Math.max(0, i - 1)]) / (2 * 108), (H[Math.min(Hd - 1, j + 1) * Wd + i] - H[Math.max(0, j - 1) * Wd + i]) / (2 * 108)];
  const emit = (fi, fj, h, i, j, coast) => {
    const g = gradAt(i, j); let nx = -g[0] * EXAG, ny = 1, nz = -g[1] * EXAG; const nl = Math.hypot(nx, ny, nz);
    put(wx(fi), wy(Math.max(h, 0.5)), wz(fj), nx / nl, ny / nl, nz / nl, coast ? 0.42 : 0.30 + rand() * 0.12, coast ? 2 : 1);
  };
  for (let j = 1; j < Hd - 2 && n < NLINE; j++) for (let i = 1; i < Wd - 2; i++) {
    const h0 = H[j * Wd + i];
    for (const [di, dj, h1] of [[1, 0, H[j * Wd + i + 1]], [0, 1, H[(j + 1) * Wd + i]]]) {
      const cnt = levels(h0, h1); if (!cnt) continue;
      for (let c = 0; c < cnt; c++) {
        const coast = h0 < 0.5 || h1 < 0.5;
        if (!coast && rand() > keepP) continue;
        if (coast && rand() > Math.min(1, keepP * 3)) continue;
        let lvl; if (coast) lvl = 0.5; else { const lo = Math.min(h0, h1); lvl = (Math.floor(lo / STEP) + 1 + c) * STEP; }
        const t = (lvl - h0) / (h1 - h0);
        emit(i + di * t + (rand() - 0.5) * 0.3, j + dj * t + (rand() - 0.5) * 0.3, lvl, i, j, coast);
      }
    }
  }
  // россыпь по земле и редкие искры моря
  let guard = 0;
  while (n < NP - NSEA && guard++ < NP * 4) { const i = 1 + (rand() * (Wd - 3)) | 0, j = 1 + (rand() * (Hd - 3)) | 0; const h = H[j * Wd + i]; if (h < 0.5) continue; const g = gradAt(i, j); let nx = -g[0] * EXAG, ny = 1, nz = -g[1] * EXAG; const nl = Math.hypot(nx, ny, nz); put(wx(i + rand()), wy(h), wz(j + rand()), nx / nl, ny / nl, nz / nl, 0.14 + rand() * 0.08, 1); }
  guard = 0;
  while (n < NP && guard++ < NP * 4) { const i = (rand() * Wd) | 0, j = (rand() * Hd) | 0; if (H[j * Wd + i] > 0.5) continue; put(wx(i + rand()), 0, wz(j + rand()), 0, 1, 0, 0.2, 0); }
  // координаты глав
  const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
  const toWorld = (lon, lat) => { const px = (lon - meta.lonW) / (meta.lonE - meta.lonW) * Wd; const py = (mercY(lat) - mercY(meta.latN)) / (mercY(meta.latS) - mercY(meta.latN)) * Hd; const h = H[clamp(py | 0, 0, Hd - 1) * Wd + clamp(px | 0, 0, Wd - 1)]; return [wx(px), wy(Math.max(h, 0)), wz(py)]; };
  return { pos, nrm, size, mat, seed, n, toWorld, KM };
}

// запечённые точки карты (tools/krym/bake.js map)
async function loadMapBaked(dem, meta) {
  try {
    const r = await fetch('data/map-points.bin'); if (!r.ok) return null;
    const dv = new DataView(await r.arrayBuffer()); const n = Math.min(dv.getUint32(0, true), mobile ? 262144 : 1e7);
    const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), size = new Float32Array(n), mat = new Float32Array(n), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) { const o = 4 + i * 17; pos[i * 3] = dv.getFloat32(o, true); pos[i * 3 + 1] = dv.getFloat32(o + 4, true); pos[i * 3 + 2] = dv.getFloat32(o + 8, true); nrm[i * 3] = dv.getInt8(o + 12) / 127; nrm[i * 3 + 1] = dv.getInt8(o + 13) / 127; nrm[i * 3 + 2] = dv.getInt8(o + 14) / 127; size[i] = dv.getUint8(o + 15) / 400; mat[i] = dv.getUint8(o + 16); seed[i] = ((i * 2654435761) >>> 0) / 4294967296; }
    const Wd = dem.w, Hd = dem.hgt, KM = 0.108 * 3584 / Wd, EXAG = 4.0, H = dem.h;   // KM по фактическому размеру DEM (lite в 4 раза мельче)
    const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
    const toWorld = (lon, lat) => { const px = (lon - meta.lonW) / (meta.lonE - meta.lonW) * Wd; const py = (mercY(lat) - mercY(meta.latN)) / (mercY(meta.latS) - mercY(meta.latN)) * Hd; const h = H[clamp(py | 0, 0, Hd - 1) * Wd + clamp(px | 0, 0, Wd - 1)]; return [(px - Wd / 2) * KM, Math.max(h, 0) / 1000 * EXAG, (py - Hd / 2) * KM]; };
    return { pos, nrm, size, mat, seed, n, toWorld, KM };
  } catch (e) { return null; }
}

// ---------- рендер ----------
let R;
function createRenderer(canvas, map, T) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance' });
  renderer.autoClear = false; renderer.outputColorSpace = THREE.LinearSRGBColorSpace; renderer.setClearColor(0x0c0a08, 1);
  let dpr = Math.min(window.devicePixelRatio || 1, mobile ? 2 : 1.5);   // десктоп до 1.5 (60 fps при 1.25, обзор при 1.5 ~37 fps → адаптация ниже)
  // карта
  const mapCam = new THREE.PerspectiveCamera(40, 1, 0.5, 3000);
  const mapScene = new THREE.Scene();
  const uM = { uCam: { value: mapCam.position }, uPx: { value: 900 }, uTime: { value: 0 }, uFocus: { value: new THREE.Vector3(0, 0, 0) }, uFocusR: { value: 60 }, uReveal: { value: 1 }, uLift: { value: 0 } };
  if (map.pos) {
  const mg = new THREE.BufferGeometry();
  mg.setAttribute('position', new THREE.BufferAttribute(map.pos, 3)); mg.setAttribute('aNrm', new THREE.BufferAttribute(map.nrm, 3)); mg.setAttribute('aSize', new THREE.BufferAttribute(map.size, 1)); mg.setAttribute('aMat', new THREE.BufferAttribute(map.mat, 1)); mg.setAttribute('aSeed', new THREE.BufferAttribute(map.seed, 1));
  mg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  const mapPts = new THREE.Points(mg, new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: uM, vertexShader: MAP_VERT, fragmentShader: MAP_FRAG, transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor }));
  mapPts.frustumCulled = false; mapScene.add(mapPts);
  }
  // маршрут: линия через точки глав
  const routePts = CH.map(c => { const w = map.toWorld(c.lon, c.lat); return new THREE.Vector3(w[0], T ? T.heightAt(w[0], w[2]) + 0.05 : w[1] + 0.6, w[2]); });
  const route = T ? makeRoute(routePts, T.heightAt) : new THREE.Line(new THREE.BufferGeometry().setFromPoints(routePts), new THREE.LineBasicMaterial({ color: 0xcfae74, transparent: true, opacity: 0.35 }));
  mapScene.add(route);
  const routeMat = route.material;
  let pins = null, comet = null; if (T) { pins = makePins(routePts, T.heightAt); mapScene.add(T.group); mapScene.add(pins.group); comet = pins.comet; }
  // картина
  const paintCam = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  const paintScene = new THREE.Scene();
  const brush = makeBrushAtlas();
  const noiseTex = getNoise(); const blankMask = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, THREE.RGBAFormat); blankMask.needsUpdate = true;
  const uS = { uTime: { value: 0 }, uAssemble: { value: 1 }, uStrokeA: { value: 0 }, uShow: { value: 1 }, uFx: { value: new THREE.Vector4(1, 1, 1, 1) }, uHazeBoost: { value: 0 }, uGloss: { value: 0.1 }, uExposure: { value: 1 }, uFlowW: { value: new THREE.Vector2(1, 0.05) }, uFlowS: { value: new THREE.Vector2(1, 0.1) }, uWarm: { value: 0 }, uFall: { value: new THREE.Vector4(0, 0, 0, 0) }, uFallV: { value: 0 }, uLife: { value: reduced ? 0 : 1 }, uGust: { value: 0 }, uFlicker: { value: 0 }, uBreath: { value: reduced ? 0 : 0.006 }, uBrush: { value: brush }, uLight: { value: new THREE.Vector3(-0.5, 0.5, 0.7) }, uLightCol: { value: new THREE.Vector3(1.0, 0.9, 0.7) }, uHaze: { value: new THREE.Vector3(0.6, 0.5, 0.4) }, uHazeK: { value: 0.3 }, uCam: { value: paintCam.position }, uGloss: { value: 0.55 }, uDepthScale: { value: DEPTH } };
  const strokeMat = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: uS, vertexShader: STROKE_VERT, fragmentShader: STROKE_FRAG, transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor });
  const quadPos = new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3), quadUv = new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2);
  const underMatBase = { glslVersion: THREE.GLSL3, vertexShader: UNDER_VERT, fragmentShader: UNDER_FRAG, depthTest: false, depthWrite: false, transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor };
  const scenes = CH.map(() => ({ ready: false, mesh: null, under: null, aspect: 16 / 9 }));
  function addScene(k, img, depthImg, strokes) {
    const S = scenes[k]; const aspect = img.w / img.h; S.aspect = aspect; const Hh = W / aspect;
    const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', quadPos); g.setAttribute('uv', quadUv); g.setIndex([0, 1, 2, 0, 2, 3]);
    const n = Math.min(N, strokes.n); g.instanceCount = n;
    const pos = new Float32Array(n * 3), ang = new Float32Array(n), sz = new Float32Array(n * 2), col = new Float32Array(n * 3), seed = new Float32Array(n);
    const idx = Array.from({ length: strokes.n }, (_, i) => i); idx.sort((p, q) => (strokes.a[p * 11] - strokes.a[q * 11]) || (strokes.a[p * 11 + 3] - strokes.a[q * 11 + 3]));
    const step = strokes.n / n;
    for (let i = 0; i < n; i++) { const j = idx[Math.floor(i * step)]; const o = j * 11; pos[i * 3] = (strokes.a[o + 1] - 0.5) * W; pos[i * 3 + 1] = (0.5 - strokes.a[o + 2]) * Hh; pos[i * 3 + 2] = (strokes.a[o + 3] - 0.5) * DEPTH; ang[i] = -strokes.a[o + 4]; sz[i * 2] = strokes.a[o + 5] * W; sz[i * 2 + 1] = strokes.a[o + 6] * W; col[i * 3] = strokes.a[o + 7]; col[i * 3 + 1] = strokes.a[o + 8]; col[i * 3 + 2] = strokes.a[o + 9]; seed[i] = strokes.a[o + 10]; }
    g.setAttribute('aPos', new THREE.InstancedBufferAttribute(pos, 3)); g.setAttribute('aAng', new THREE.InstancedBufferAttribute(ang, 1)); g.setAttribute('aSize', new THREE.InstancedBufferAttribute(sz, 2)); g.setAttribute('aCol', new THREE.InstancedBufferAttribute(col, 3)); g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const mesh = new THREE.Mesh(g, strokeMat); mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.visible = false;
    // средняя светлота полотна — для контраста крупного года и карточки
    { const cv = document.createElement('canvas'); cv.width = 32; cv.height = 18; const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img.el, 0, 0, 32, 18); const d = cx.getImageData(0, 0, 32, 18).data; let l = 0; for (let i = 0; i < d.length; i += 4) l += 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; S.lum = l / (d.length / 4) / 255; }
    const texImg = new THREE.Texture(img.el); texImg.colorSpace = THREE.NoColorSpace; texImg.minFilter = THREE.LinearMipmapLinearFilter; texImg.generateMipmaps = true; texImg.anisotropy = 8; texImg.needsUpdate = true;
    const texDepth = new THREE.Texture(depthImg.el); texDepth.colorSpace = THREE.NoColorSpace; texDepth.minFilter = THREE.LinearMipmapLinearFilter; texDepth.magFilter = THREE.LinearFilter; texDepth.generateMipmaps = true; texDepth.needsUpdate = true;
    const um = new THREE.RawShaderMaterial({ ...underMatBase, uniforms: { uDepth: { value: texDepth }, uImg: { value: texImg }, uHaze: uS.uHaze, uHazeK: uS.uHazeK, uDepthScale: uS.uDepthScale, uLight: uS.uLight, uTime: uS.uTime, uShow: uS.uShow, uMask: { value: blankMask }, uNoise: { value: noiseTex }, uNow: { value: blankMask }, uNowFit: { value: new THREE.Vector4(1, 1, 0, 0) }, uWipe: { value: 0 }, uHazeBoost: uS.uHazeBoost, uGloss: uS.uGloss, uExposure: uS.uExposure, uFlowW: uS.uFlowW, uFlowS: uS.uFlowS, uWarm: uS.uWarm, uFall: uS.uFall, uFallV: uS.uFallV, uFx: uS.uFx, uLife: uS.uLife, uGust: uS.uGust, uFlicker: uS.uFlicker, uLightCol: uS.uLightCol } });
    const under = new THREE.Mesh(new THREE.PlaneGeometry(W, Hh, 180, 100), um); under.renderOrder = 1; under.frustumCulled = false; under.visible = false;
    paintScene.add(under, mesh); S.mesh = mesh; S.under = under; S.ready = true; addFx(k);
    if (active === k) { active = -1; setActive(k); }   // глава уже открыта, а полотно догрузилось только сейчас: показать его
  }
  // походка по сценам: [dx, dy] в долях роста, уменьшение, секунды
  const WALK = { house: [0.0, 0.14, 0.03, 18], harvest: [0.09, 0.0, 0.0, 22] };
  function addPeople(k, img, meta, depthEl, img2, meta2) {
    const tex2 = img2 ? (() => { const t2 = new THREE.Texture(img2.el); t2.colorSpace = THREE.NoColorSpace; t2.minFilter = THREE.LinearMipmapLinearFilter; t2.generateMipmaps = true; t2.anisotropy = 4; t2.needsUpdate = true; return t2; })() : null;
    const S = scenes[k]; if (!S.ready) return; const Hh = W / S.aspect;
    const tex = new THREE.Texture(img.el); tex.colorSpace = THREE.NoColorSpace; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.anisotropy = 4; tex.needsUpdate = true;
    // глубина в ногах — из карты глубины
    const dc = document.createElement('canvas'); dc.width = 256; dc.height = 256; const dctx = dc.getContext('2d', { willReadFrequently: true }); dctx.drawImage(depthEl, 0, 0, 256, 256); const dd = dctx.getImageData(0, 0, 256, 256).data;
    const depthAt = (u, v) => dd[((clamp(v * 255, 0, 255) | 0) * 256 + (clamp(u * 255, 0, 255) | 0)) * 4] / 255;
    const walk = WALK[CH[k].id] || [0, 0, 0, 10];
    S.people = [];
    const figs = [...meta.figures].sort((a, b) => a.feetY - b.feetY);
    figs.forEach((fg, i) => {
      const big = fg.h < fg.w * 1.1;   // повозки и лошади не ходят
      const huge = fg.w > meta.w * 0.32 || fg.h > meta.h * 0.5 || fg.area > meta.w * meta.h * 0.06;   // блок с куском фона — без движения
      // сопоставление со второй фазой: ближайшая по центру фигура похожего размера; совмещаем по ногам 1:1, рамка — объединение
      let f2 = null; if (meta2 && meta2.figures) { const cx0 = fg.x + fg.w / 2, cy0 = fg.y + fg.h / 2; let best = 1e9; for (const g2 of meta2.figures) { const d = Math.hypot(g2.x + g2.w / 2 - cx0, g2.y + g2.h / 2 - cy0); if (d < best && d < Math.max(fg.w, fg.h) * 0.5 && Math.abs(g2.h - fg.h) < fg.h * 0.3 && Math.abs(g2.w - fg.w) < fg.w * 0.3) { best = d; f2 = g2; } /* склеенные или расклеенные группы остаются без второй фазы */ } }
      const sx = f2 ? (fg.x + fg.w / 2) - (f2.x + f2.w / 2) : 0, sy = f2 ? fg.feetY - f2.feetY : 0;   // сдвиг A2 → A по точке ног
      const bx0 = f2 ? Math.min(fg.x, f2.x + sx) : fg.x, by0 = f2 ? Math.min(fg.y, f2.y + sy) : fg.y, bx1 = f2 ? Math.max(fg.x + fg.w, f2.x + f2.w + sx) : fg.x + fg.w, by1 = f2 ? Math.max(fg.y + fg.h, f2.y + f2.h + sy) : fg.y + fg.h;
      const box = { x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 };
      const fw = box.w / meta.w * W, fh = box.h / meta.h * Hh;
      const cx = (box.x + box.w / 2) / meta.w * W - W / 2, cy = Hh / 2 - (box.y + box.h / 2) / meta.h * Hh;
      const d = depthAt((fg.x + fg.w / 2) / meta.w, fg.feetY / meta.h);
      const z = (d - 0.5) * DEPTH - 0.05 + 0.10;
      const geo = new THREE.PlaneGeometry(1, 1, 1, 4);
      const u = { uTex: { value: tex }, uRect: { value: new THREE.Vector4(box.x / meta.w, 1 - (box.y + box.h) / meta.h, box.w / meta.w, box.h / meta.h) }, uTex2: { value: f2 ? tex2 : tex }, uRect2: { value: f2 ? new THREE.Vector4((box.x - sx) / meta2.w, 1 - (box.y - sy + box.h) / meta2.h, box.w / meta2.w, box.h / meta2.h) : new THREE.Vector4(0, 0, 1, 1) }, uHas2: { value: f2 ? 1 : 0 }, uTime: uS.uTime, uLife: uS.uLife, uGust: uS.uGust, uShow: uS.uShow,
        uHazeBoost: uS.uHazeBoost, uPos: { value: new THREE.Vector3(cx, cy, z) }, uSize: { value: new THREE.Vector2(fw, fh) }, uSeed: { value: (i * 0.37 + 0.11) % 1 }, uLifeF: { value: huge ? 0 : (big ? 0.35 : (fg.h < meta.h * 0.09 ? 0.55 : 1)) }, uWalk: { value: new THREE.Vector4(big ? 0 : walk[0], big ? 0 : walk[1], big ? 0 : walk[2], walk[3]) }, uT0: { value: 0 },
        uHaze: uS.uHaze, uHazeK: uS.uHazeK, uDepthScale: uS.uDepthScale };
      const mat = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: u, vertexShader: PEOPLE_VERT, fragmentShader: PEOPLE_FRAG, depthTest: false, depthWrite: false, transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor });
      const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 1.2 + i * 0.001; mesh.visible = S.under.visible;
      paintScene.add(mesh); S.people.push(mesh);
    });
  }
  // эффекты по главам: дождь, угли, птицы
  const FXP = { otuz: ['rain'], cellar: ['embers'], ravine: ['embers'], sugdeya: ['birds'], feodosia: ['birds', 'smoke'], balaklava: ['birds', 'smoke'], novysvet: ['birds'], kikineiz: ['birds'], port: ['birds'], gurzuf: ['birds'], koktebel: ['birds'], sudak: ['birds'], kapsel: ['birds'], today: ['birds'] };
  const premul = { transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor };
  function addFx(k) {
    const S = scenes[k]; const list = FXP[CH[k].id] || []; if (!list.length || reduced) return; const Hh = W / S.aspect; S.fx = [];
    for (const kind of list) {
      let obj;
      if (kind === 'rain') {
        const NR = mobile ? 500 : 1400; const pos = new Float32Array(NR * 2 * 3), seed = new Float32Array(NR * 2), end = new Float32Array(NR * 2);
        for (let i = 0; i < NR; i++) { const x = (Math.random() - 0.5) * W * 1.1, y = (Math.random() - 0.5) * Hh * 1.1, z = 0.2 + Math.random() * 3.0, sd = Math.random(); for (let e = 0; e < 2; e++) { const o = (i * 2 + e); pos[o * 3] = x; pos[o * 3 + 1] = y; pos[o * 3 + 2] = z; seed[o] = sd; end[o] = e; } }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1)); g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
        obj = new THREE.LineSegments(g, new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: { uTime: uS.uTime, uArea: { value: new THREE.Vector2(W * 1.1, Hh * 1.1) }, uGust: uS.uGust, uHazeBoost: uS.uHazeBoost }, vertexShader: RAIN_VERT, fragmentShader: RAIN_FRAG, ...premul }));
      } else if (kind === 'embers') {
        const NE = mobile ? 60 : 140; const pos = new Float32Array(NE * 3), seed = new Float32Array(NE); for (let i = 0; i < NE; i++) seed[i] = Math.random();
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
        obj = new THREE.Points(g, new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: { uTime: uS.uTime, uSrc: { value: new THREE.Vector3(0, -Hh * 0.1, 0) }, uPx: uD.uPx, uHazeBoost: uS.uHazeBoost }, vertexShader: EMBER_VERT, fragmentShader: EMBER_FRAG, ...premul }));
        obj.userData.src = true;
      } else if (kind === 'smoke') {
        const NS = mobile ? 40 : 90; const pos = new Float32Array(NS * 3), seed = new Float32Array(NS); for (let i = 0; i < NS; i++) seed[i] = Math.random();
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
        obj = new THREE.Points(g, new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: { uTime: uS.uTime, uSrc: { value: new THREE.Vector3(0, 0, 0) }, uPx: uD.uPx, uHazeBoost: uS.uHazeBoost, uGust: uS.uGust }, vertexShader: SMOKE_VERT, fragmentShader: SMOKE_FRAG, ...premul }));
        obj.userData.src = true;
      } else if (kind === 'birds') {
        const NB = 7; const pos = new Float32Array(NB * 4 * 3), bird = new Float32Array(NB * 4), part = new Float32Array(NB * 4); const idx = [];
        for (let i = 0; i < NB; i++) { for (let p = 0; p < 4; p++) { bird[i * 4 + p] = i; part[i * 4 + p] = p; pos[(i * 4 + p) * 3 + 2] = 0.3; } idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 3); }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aBird', new THREE.BufferAttribute(bird, 1)); g.setAttribute('aPart', new THREE.BufferAttribute(part, 1)); g.setIndex(idx);
        // небо по умолчанию — верхняя треть; уточняется по маске
        obj = new THREE.LineSegments(g, new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: { uTime: uS.uTime, uSky: { value: new THREE.Vector4(-W / 2, Hh * 0.15, W, Hh * 0.3) }, uN: { value: NB }, uHazeBoost: uS.uHazeBoost }, vertexShader: BIRD_VERT, fragmentShader: BIRD_FRAG, ...premul }));
        obj.userData.sky = true;
      }
      if (!obj) continue; g0(obj); obj.frustumCulled = false; obj.renderOrder = 2.5; obj.visible = S.under.visible; paintScene.add(obj); S.fx.push(obj);
    }
    function g0(o) { o.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6); }
  }
  // по маске: источник огня для углей, полоса неба для птиц
  function fxFromMask(k, img) {
    const S = scenes[k]; if (!S.fx) return; const Hh = W / S.aspect;
    const c = document.createElement('canvas'); c.width = 256; c.height = 72; const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img.el, 0, 0, 256, 72); const d = ctx.getImageData(0, 0, 256, 72).data;
    let fx = 0, fy = 0, fn = 0, skyTop = 72, skyBot = 0;
    for (let y = 0; y < 72; y++) { let row = 0; for (let x = 0; x < 128; x++) { const o = (y * 256 + x) * 4, of = (y * 256 + 128 + x) * 4; if (d[of] > 110) { fx += x; fy += y; fn++; } if (d[o + 1] > 120) row++; } if (row > 40) { skyTop = Math.min(skyTop, y); skyBot = Math.max(skyBot, y); } }
    for (const o of S.fx) {
      if (o.userData.src && fn > 3) o.material.uniforms.uSrc.value.set((fx / fn / 128 - 0.5) * W, (0.5 - fy / fn / 72) * Hh, 0);
      if (o.userData.sky && skyBot > skyTop) { const top = (0.5 - skyTop / 72) * Hh, bot = (0.5 - skyBot / 72) * Hh; o.material.uniforms.uSky.value.set(-W / 2, bot + (top - bot) * 0.1, W, (top - bot) * 0.7); }
    }
  }
  // фото «сегодня»: заполняет полотно с обрезкой (cover)
  function setNow(k, img) {
    const S = scenes[k]; if (!S.ready) return;
    const tex = new THREE.Texture(img.el); tex.colorSpace = THREE.NoColorSpace; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.anisotropy = 8; tex.needsUpdate = true;
    const ap = S.aspect, an = img.w / img.h; const u = S.under.material.uniforms; u.uNow.value = tex;
    if (an > ap) { const sx = ap / an; u.uNowFit.value.set(sx, 1, (1 - sx) / 2, 0); } else { const sy = an / ap; u.uNowFit.value.set(1, sy, 0, (1 - sy) / 2); }
    S.now = tex;
  }
  function setWipe(k, v) { const S = scenes[k]; if (S && S.ready) S.under.material.uniforms.uWipe.value = v; }
  function setMask(k, img) {
    const S = scenes[k]; if (!S.ready) return;
    const tex = new THREE.Texture(img.el); tex.colorSpace = THREE.NoColorSpace; tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
    S.under.material.uniforms.uMask.value = tex; S.mask = tex; fxFromMask(k, img);
  }
  // пыль
  const ND = mobile ? 200 : 400; const dg = new THREE.BufferGeometry(); const dp = new Float32Array(ND * 3), ds = new Float32Array(ND);
  for (let i = 0; i < ND; i++) { dp[i * 3] = (Math.random() - 0.5) * W * 0.9; dp[i * 3 + 1] = (Math.random() - 0.5) * W * 0.5; dp[i * 3 + 2] = Math.random() * 4 - 0.5; ds[i] = Math.random(); }
  dg.setAttribute('position', new THREE.BufferAttribute(dp, 3)); dg.setAttribute('aSeed', new THREE.BufferAttribute(ds, 1));
  const uD = { uTime: uS.uTime, uPx: { value: 900 } };
  const dust = new THREE.Points(dg, new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: uD, vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor }));
  dust.frustumCulled = false; dust.renderOrder = 3; paintScene.add(dust);
  // пост
  const fsScene = new THREE.Scene(); const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const fsGeo = new THREE.BufferGeometry(); fsGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)); fsGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const fsMesh = new THREE.Mesh(fsGeo, null); fsMesh.frustumCulled = false; fsScene.add(fsMesh);
  const fsMat = (frag, uniforms) => new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, uniforms, vertexShader: FS_VERT, fragmentShader: frag, depthTest: false, depthWrite: false });
  const SUN_UV = new THREE.Vector2(0.8, 0.9); const skyMat = fsMat(SKY_FRAG, { uTime: uM.uTime, uDawn: { value: 0 }, uSunUv: { value: SUN_UV } });
  const uX = { uA: { value: null }, uB: { value: null }, uMix: { value: 0 }, uZoom: { value: 1 }, uFog: { value: 0 }, uFogCol: { value: new THREE.Vector3(0.3, 0.25, 0.2) }, uNoise: { value: noiseTex }, uTime: uS.uTime, uIris: { value: new THREE.Vector4(0.5, 0.5, 0, 0) }, uAspect: { value: 1.6 } };
  const uB = { uTex: { value: null }, uTexel: { value: new THREE.Vector2() } };
  const uP = { uScene: { value: null }, uBlur: { value: null }, uRes: { value: new THREE.Vector2() }, uTime: uS.uTime, uFade: { value: 0 }, uGrain: { value: 0.012 }, uVig: { value: 0.42 }, uBloom: { value: 0.3 }, uRays: { value: 0 }, uSunUv: { value: SUN_UV } };
  const mixMat = fsMat(MIX_FRAG, uX), blurMat = fsMat(BLUR_FRAG, uB), postMat = fsMat(POST_FRAG, uP);
  const rtOpts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false };
  let rtMap, rtPaint, rtMix, rtA, rtB, Wpx = 1, Hpx = 1;
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); Wpx = Math.floor(w * dpr); Hpx = Math.floor(h * dpr);
    for (const c of [mapCam, paintCam]) { c.aspect = w / h; c.updateProjectionMatrix(); }
    uM.uPx.value = Hpx / (2 * Math.tan(THREE.MathUtils.degToRad(mapCam.fov) / 2)); uD.uPx.value = Hpx / (2 * Math.tan(THREE.MathUtils.degToRad(paintCam.fov) / 2));
    for (const r of [rtMap, rtPaint, rtMix, rtA, rtB]) if (r) r.dispose();
    rtMap = new THREE.WebGLRenderTarget(Wpx, Hpx, { ...rtOpts, depthBuffer: true }); rtPaint = new THREE.WebGLRenderTarget(Wpx, Hpx, rtOpts); rtMix = new THREE.WebGLRenderTarget(Wpx, Hpx, rtOpts);
    rtA = new THREE.WebGLRenderTarget(Wpx >> 2, Hpx >> 2, rtOpts); rtB = new THREE.WebGLRenderTarget(Wpx >> 2, Hpx >> 2, rtOpts);
    uP.uRes.value.set(Wpx, Hpx);
  }
  resize();
  function pass(m, t) { fsMesh.material = m; renderer.setRenderTarget(t); renderer.render(fsScene, fsCam); }
  let active = -1;
  function setActive(k) { if (active === k) return; for (let i = 0; i < scenes.length; i++) { const S = scenes[i]; if (S.ready) { S.mesh.visible = false; S.under.visible = i === k; if (S.people) for (const m of S.people) { m.visible = i === k; if (i === k) m.material.uniforms.uT0.value = uS.uTime.value + 1.5; } if (S.fx) for (const o of S.fx) o.visible = i === k; } } active = k; }
  function render(time, mixv, fogv = 0) {
    uM.uTime.value = time; uS.uTime.value = time; uX.uFog.value = fogv;
    if (mixv < 0.999) {
      if (T) { T.uni.uTime.value = time; T.uni.uCam.value.copy(mapCam.position); T.uni.uFocus.value.copy(uM.uFocus.value); T.uni.uFocusR.value = uM.uFocusR.value; T.uni.uFog.value = fogv * 0.85; T.uni.uFogCol.value.copy(uX.uFogCol.value); }
      renderer.setRenderTarget(rtMap); pass(skyMat, rtMap); renderer.clearDepth(); renderer.render(mapScene, mapCam);
    }
    const irisOpen = uX.uIris.value.w > 0.001 && uX.uIris.value.z > 0.001;   // внутри диафрагмы полотно видно и при нулевом смешении
    if (mixv > 0.001 || irisOpen) { renderer.setRenderTarget(rtPaint); renderer.clear(); renderer.render(paintScene, paintCam); }
    uX.uA.value = rtMap.texture; uX.uB.value = rtPaint.texture; uX.uMix.value = mixv; pass(mixMat, rtMix);
    uB.uTex.value = rtMix.texture; uB.uTexel.value.set(1 / rtA.width, 1 / rtA.height); pass(blurMat, rtA);
    uB.uTex.value = rtA.texture; pass(blurMat, rtB);
    uP.uScene.value = rtMix.texture; uP.uBlur.value = rtB.texture; pass(postMat, null);
  }
  const v3 = new THREE.Vector3();
  function project(x, y, z) { v3.set(x, y, z).project(mapCam); return { x: v3.x * 0.5 + 0.5, y: 1 - (v3.y * 0.5 + 0.5), front: v3.z < 1 }; }
  return { renderer, mapCam, paintCam, uM, uS, uP, uX, scenes, pins, T, route, comet, skyDawn: skyMat.uniforms.uDawn, addScene, setMask, setNow, setWipe, addPeople, setActive, render, resize, project, routePts, routeMat, setDpr(v) { dpr = v; resize(); }, get dpr() { return dpr; } };
}

// ---------- камера и таймлайн ----------
// P в экранах: 0..1 — обзор всего Крыма; глава k занимает [1+2k, 3+2k): перелёт 0–0.5, нырок 0.5–0.9, картина 0.9–1.7, выход 1.7–2.0
let map, lenis = null, P = 0, Psm = 0, debugP = null;
window.__p = (v) => { debugP = (v === null || v === undefined) ? null : +v; };
window.__krym = { get R() { return R; }, CH, L, SET };
const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
window.addEventListener('pointermove', (e) => { pointer.x = (e.clientX / innerWidth) * 2 - 1; pointer.y = -((e.clientY / innerHeight) * 2 - 1); }, { passive: true });
const intro = { active: false, start: 0, t: 0 };
// настройка маяка: кольца, ореол, ядро; из адреса (?rings=1.8&halo=0.3&core=0.7), панель ползунков по ?tune=1
const TUNE = { rings: 1.8, halo: 0.3, core: 0.7 };
{ const q = new URLSearchParams(location.search); for (const key of Object.keys(TUNE)) if (q.has(key) && isFinite(+q.get(key))) TUNE[key] = +q.get(key); }
function setupTune() {
  if (!new URLSearchParams(location.search).has('tune')) return;
  const box = document.createElement('div'); box.id = 'tune'; box.style.cssText = 'position:fixed;left:16px;top:70px;z-index:50;background:rgba(10,8,6,.82);color:#efe6d6;font:12px/1.5 Arial;padding:12px 14px;border:1px solid rgba(232,194,122,.35);width:240px;pointer-events:auto';
  const rows = [['rings', 'кольца', 0, 3, 0.05], ['halo', 'ореол (затемнение)', 0, 0.6, 0.02], ['core', 'ядро на земле', 0, 3, 0.05]];
  const out = document.createElement('div'); out.style.cssText = 'margin-top:8px;font-family:monospace;font-size:11px;word-break:break-all;color:#e8c27a';
  const upd = () => { out.textContent = '?' + Object.keys(TUNE).map(x => x + '=' + TUNE[x]).join('&'); };
  for (const [key, label, min, max, step] of rows) { const l = document.createElement('label'); l.style.display = 'block'; const v = document.createElement('b'); v.textContent = TUNE[key]; v.style.float = 'right';
    const r = document.createElement('input'); r.type = 'range'; r.min = min; r.max = max; r.step = step; r.value = TUNE[key]; r.style.width = '100%'; r.oninput = () => { TUNE[key] = +r.value; v.textContent = r.value; upd(); };
    l.append(label, v, r); box.appendChild(l); }
  box.appendChild(out); upd(); document.body.appendChild(box);
}
const OVER = mobile ? { pos: [15, 520, 250], tgt: [15, 0, 25], fov: 50 } : { pos: [-50, 205, 205], tgt: [-68, 0, 12], fov: 40 };   // на телефоне обзор выше и шире, чтобы полуостров влез в портрет

function camAt(k, alt) { const p = R.routePts[k]; return [p.x, p.y + alt, p.z + alt * 0.55]; }
function applyTimeline(Pv, time) {
  const cam = R.mapCam; const br = reduced ? 0 : 1;
  pointer.sx += (pointer.x - pointer.sx) * 0.03; pointer.sy += (pointer.y - pointer.sy) * 0.03;
  let pos, tgt, fov = 40, mixv = 0, zoom = 1, chapter = -1, hold = 0, asm = 1, strokeA = 0, show = 1, lift = 0, fogv = 0, hazeBoost = 0, uCh = 0, bank = 0;
  if (Pv < 1) {
    // обзор → подлёт к первой точке
    const t = smooth(Pv);
    const a = { pos: [OVER.pos[0] - 70 * introCam, OVER.pos[1] * (1 + 0.34 * introCam), OVER.pos[2] * (1 + 0.30 * introCam)], tgt: OVER.tgt }, b = { pos: camAt(0, 28), tgt: [R.routePts[0].x, R.routePts[0].y, R.routePts[0].z] };
    pos = mix3(a.pos, b.pos, t); tgt = mix3(a.tgt, b.tgt, t);
    R.uM.uFocus.value.copy(R.routePts[0]); R.uM.uFocusR.value = lerp(400, 40, t);
  } else {
    const k = clamp(Math.floor((Pv - 1) / L), 0, CH.length - 1), u = clamp(Pv - 1 - L * k, 0, L);
    chapter = k; uCh = u;
    const here = R.routePts[k], prev = R.routePts[Math.max(0, k - 1)];
    const fly = smooth(u / 0.4);
    const hop = Math.sin(fly * Math.PI) * 14 * (k > 0 ? 1 : 0);
    const fromPos = k > 0 ? camAt(k - 1, 28) : camAt(0, 28);
    const toPos = camAt(k, 28); const next = R.routePts[Math.min(CH.length - 1, k + 1)];
    if (u < 0.4) {
      pos = mix3(fromPos, toPos, fly); pos[1] += hop;
      bank = Math.sin(fly * Math.PI) * 0.055 * Math.sign(toPos[0] - fromPos[0] || 1) * (k > 0 ? 1 : 0.4);
      const tg = mix3([prev.x, prev.y, prev.z], [here.x, here.y, here.z], fly); tgt = tg;
    } else if (u < 0.75) {
      const d = smooth((u - 0.4) / 0.25); fov = 40 + 14 * Math.sin(d * Math.PI);   // угол шире на середине падения — ощущение скорости
      const dd = Math.pow(d, 1.4);   // падение к самой точке с ускорением, пока диафрагма ещё только открывается: камера входит в место
      pos = mix3(toPos, camAt(k, 1.3), dd); const arc = Math.sin(d * Math.PI) * 6.0; pos[0] += arc * Math.sign(here.x - prev.x || 1); tgt = [here.x, here.y, here.z];
      mixv = smooth((u - 0.52) / 0.16); zoom = 1 - d;
      // рельеф уходит в тёплую дымку цвета полотна, и из той же дымки, внахлёст, проступает полотно (без пустого экрана между ними)
      fogv = smooth((u - 0.48) / 0.17); hazeBoost = 1 - smooth((u - 0.52) / 0.16);   // внутри открывающейся диафрагмы полотно проясняется вместе с её ростом
    } else if (u < 1.65) {
      pos = camAt(k, 1.3); tgt = [here.x, here.y, here.z]; mixv = 1; hold = (u - 0.75) / 0.9;
    } else {
      const d = smooth((u - 1.65) / 0.25); fov = 40 + 8 * Math.sin(d * Math.PI);
      pos = mix3(camAt(k, 1.3), camAt(k, 28), 1 - Math.pow(1 - d, 1.7)); /* всплытие из точки с замедлением наверху */ const lean = smooth((u - 1.72) / 0.18) * 0.12; pos[0] += (next.x - here.x) * lean; pos[2] += (next.z - here.z) * lean; tgt = [here.x + (next.x - here.x) * lean * 0.5, here.y, here.z + (next.z - here.z) * lean * 0.5]; mixv = 1 - smooth((u - 1.70) / 0.13); zoom = d;
      hazeBoost = smooth((u - 1.72) / 0.18); fogv = 1 - smooth((u - 1.70) / 0.17);   // полотно остаётся видным внутри сжимающейся диафрагмы
    }
    R.uM.uFocus.value.copy(here); R.uM.uFocusR.value = 40;
  }
  const d = Math.hypot(pos[0] - tgt[0], pos[1] - tgt[1], pos[2] - tgt[2]);
  pos[0] += Math.sin(time * 0.08) * 0.004 * d * br; pos[1] += Math.sin(time * 0.06 + 1.2) * 0.003 * d * br;
  cam.position.set(pos[0], pos[1], pos[2]); cam.lookAt(tgt[0], tgt[1], tgt[2]); cam.rotateZ(bank * br); cam.rotateY(-pointer.sx * 0.03 * br); cam.rotateX(pointer.sy * 0.02 * br);
  if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
  // картина
  if (chapter >= 0) {
    R.setActive(chapter);
    const C = CH[chapter], S = R.scenes[chapter];
    // полотно ещё не догрузилось (медленная сеть, быстрый скролл): держим рельеф в дымке, а не чёрный экран; догрузилось — проступает за секунду
    if (!S.ready) { mixv = 0; fogv = Math.max(fogv, 0.85); } else { if (S.shownAt == null) S.shownAt = time; mixv *= smooth((time - S.shownAt) / 1.2); }
    const pc = R.paintCam; const Hh = W / (S.aspect || 1.6);
    const tf = Math.tan(THREE.MathUtils.degToRad(pc.fov) / 2);
    const D0 = Math.min((Hh / 2) / tf, (W / 2) / (tf * pc.aspect)) * 0.86;   // вплотную: полотно закрывает экран
    const Dfull = Math.max((Hh / 2) / tf, (W / 2) / (tf * pc.aspect)) * 1.04;   // целиком: всё полотно в кадре с полем 4 %
    const D = DIR[C.id] || DIR._; const hs = smooth(hold);
    const open = smooth(hold / 0.55);   // к середине главы полотно раскрыто целиком
    const dolly = lerp(D.cam[2] * D0, Dfull, open) / D0 + 0.08 * (1 - smooth((uCh - 0.5) / 0.25));   // сначала вплотную (камера ещё едет вперёд из дымки), потом отъезд до полного полотна
    const ox = D.cam[0] * (1 - open) * W, oy = D.cam[1] * (1 - open) * W;
    R.uS.uFlowW.value.set(D.flowW[0], D.flowW[1]); R.uS.uFlowS.value.set(D.flowS[0], D.flowS[1]); R.uS.uWarm.value = (D.warm || 0) * hs;
    if (D.fall) { R.uS.uFall.value.set(D.fall[0], D.fall[1], D.fall[2], D.fall[3]); R.uS.uFallV.value = D.fallV || 1; } else R.uS.uFallV.value = 0;
    const px = pointer.sx * 0.8 * br + Math.sin(time * 0.09) * 0.2 * br, py = pointer.sy * 0.45 * br + Math.sin(time * 0.07 + 1.0) * 0.12 * br;
    const land = 1 - smooth((uCh - 0.5) / 0.3);   // 1 — только вошли, 0 — сели
    pc.position.set(px + ox, py + oy + land * 1.4, D0 * dolly); pc.lookAt(px * 0.35 + ox, py * 0.35 + oy - land * 0.6, 0);
    // лучи от солнца полотна (DIR.sun в uv), пока идёт глава
    if (D.sun && !reduced) { R.uP.uRays.value = (D.rays || 0.35) * smooth(hold / 0.15) * (1 - smooth((hold - 0.9) / 0.1)) * (1 - hazeBoost); R.uP.uSunUv.value.set(D.sun[0], D.sun[1]); } else if (!intro.active) R.uP.uRays.value = 0;
    R.uS.uLight.value.set(C.light[0] + Math.sin(time * 0.12) * 0.25 + (hold - 0.5) * 0.3, C.light[1], C.light[2]).normalize();
    R.uS.uHaze.value.set(C.haze[0], C.haze[1], C.haze[2]); R.uS.uHazeK.value = C.hazeK; R.uS.uHazeBoost.value = reduced ? 0 : hazeBoost;
    R.uX.uFogCol.value.set(Math.pow(C.haze[0], 2.2), Math.pow(C.haze[1], 2.2), Math.pow(C.haze[2], 2.2));
    if (R.T && !intro.active) { const ms = MAPSUN[C.id] || [1.0, 0.86, 0.62]; const near = smooth((uCh - 0.3) / 0.3) * (1 - smooth((uCh - 1.7) / 0.2)); const sc = R.T.uni.uSunCol.value; sc.set(lerp(1.0, ms[0], near), lerp(0.86, ms[1], near), lerp(0.62, ms[2], near)); }
    const fx = FX[C.id] || FX._; R.uS.uFx.value.set(fx[0], fx[1], fx[2], fx[3]); R.uS.uGloss.value = GLOSS[C.id] ?? GLOSS._; R.uS.uExposure.value = EXPOSURE[C.id] ?? 1; R.uS.uDepthScale.value = DEPTH * (DEPTHK[C.id] ?? 1) * (1 + land * 0.35);   // на прибытии глубина раскрыта сильнее
    const gustP = Math.max(0, Math.sin(time * 0.13) + 0.7 * Math.sin(time * 0.071) - 0.55); R.uS.uGust.value = Math.min(1, Math.max(gust, gustP));
    R.uS.uFlicker.value = 0.55 * Math.sin(time * 31.4 + Math.sin(time * 7.1) * 2.0) + 0.45 * Math.sin(time * 57.0 + 1.0);
    if (reduced) { strokeA = 0; show = 1; asm = 1; }
    R.uS.uAssemble.value = asm; R.uS.uStrokeA.value = strokeA; R.uS.uShow.value = show;
    if (S.ready) S.mesh.visible = strokeA > 0.001;
  }
  R.uM.uLift.value = reduced ? 0 : lift;
  R.uX.uZoom.value = zoom;
  // булавки: активная глава крупнее и пульсирует
  // булавки строго по порядку: пройденные горят тихо, цель — ядро с пульсом и кольца по земле (uBeacon), будущих не видно
  const target = chapter >= 0 ? chapter : 0;
  const beaconK = chapter >= 0 ? (1 - mixv) : (intro.active ? (R.pins ? (R.pins.pins[0].spr.userData.lit || 0) : 0) : 1);
  if (R.pins) R.pins.pins.forEach((p, i) => { const on = i === target; const lit = i > target ? 0 : (i === 0 && intro.active ? (p.spr.userData.lit || 0) : 1);
    const rv = R.uM.uReveal.value; const pulse = 0.5 + 0.5 * Math.sin(time * 2.2); const sz = on ? 0.026 + 0.006 * pulse : 0.016; p.spr.scale.set(sz, sz, 1); p.spr.material.opacity = (on ? 1 : 0.75) * rv * lit; p.line.material.opacity = 0.5 * lit * rv; });
  if (R.T) { R.T.uni.uBeacon.value = reduced ? 0 : beaconK; R.T.uni.uRingK.value = TUNE.rings; R.T.uni.uHaloK.value = TUNE.halo; R.T.uni.uCoreK.value = TUNE.core; }
  // линия маршрута видна только с высоты
  const ro = 0.45 * clamp((pos[1] - 12) / 40, 0, 1); if (R.routeMat.uniforms) { R.routeMat.uniforms.uOpacity.value = ro; if (!intro.active) { R.routeMat.uniforms.uGhost.value = 0.28; R.routeMat.uniforms.uDraw.value = clamp((Pv - 1) / L / (CH.length - 1), 0, 1); } } else R.routeMat.opacity = ro;
  document.body.classList.toggle('far', pos[1] > 120);
  const end = clamp((Pv - (1 + L * CH.length) + 0.3) / 0.6, 0, 1);
  // диафрагма нырка: полотно открывается из спроецированной точки места, из неё же бьют лучи; на выходе закрывается обратно в точку
  { const ir = R.uX.uIris.value; R.uX.uAspect.value = window.innerWidth / Math.max(1, window.innerHeight); let irR = 0, irK = 0, burst = 0;
    if (chapter >= 0 && !reduced) { const u = uCh; if (u >= 0.40 && u < 0.75) { irR = 1.7 * smooth((u - 0.50) / 0.20); irK = 1; burst = Math.sin(clamp((u - 0.48) / 0.26, 0, 1) * Math.PI); } else if (u >= 1.65) { irR = 1.7 * (1 - smooth((u - 1.66) / 0.19)); irK = 1; burst = 0.6 * Math.sin(clamp((u - 1.66) / 0.2, 0, 1) * Math.PI); } }
    if (irK > 0) { const h = R.routePts[chapter]; R.mapCam.updateMatrixWorld(); const pr = R.project(h.x, h.y, h.z); const cx = clamp(pr.x, 0.1, 0.9), cy = clamp(1 - pr.y, 0.1, 0.9); ir.set(cx, cy, irR, irK); if (burst > 0.001) { R.uP.uRays.value = Math.max(R.uP.uRays.value, 0.6 * burst); R.uP.uSunUv.value.set(cx, cy); } } else ir.w = 0; }
  R.uP.uFade.value = (intro.active ? intro.t : 1) * (1 - end * 0.85);
  return { chapter, mixv, hold, fog: reduced ? 0 : fogv };
}

// ---------- DOM ----------
const marks = [], seas = [];
// подписи к полотнам из самого маршрута
function fillCredits() {
  const el = $('#credits'); if (!el) return;
  const byP = new Map(); let home = 0, photo = 0;
  for (const c of CH) {
    if (c.painter === 'Сцена дома') { home++; continue; }
    if (/Съёмка|фото/i.test(c.painter)) { photo++; continue; }
    const arr = byP.get(c.painter) || []; if (c.pyear && c.pyear < 2026 && !arr.includes(c.pyear)) arr.push(c.pyear); byP.set(c.painter, arr);
  }
  const parts = [...byP].map(([p, ys]) => p + (ys.length ? ' (' + ys.sort().join(', ') + ')' : ''));
  el.textContent = 'Все картины на этой странице — общественное достояние: ' + parts.join(', ') + '. Репродукции — Викисклад.'
    + (home ? ' Сцены 1888–1900 и наших дней написаны для этой страницы по историческим фотографиям и документам.' : '')
    + (photo ? ' Фотографии — архив винодельни.' : '');
}
// «это место сегодня»: карточка с фото Викисклада, по клику шторка на полотне
let NOW = {}, wipeTarget = 0, wipeNow = 0, wipeChapter = -1;
async function loadNow() {
  try { const r = await fetch('now/manifest.json'); if (!r.ok) return; for (const it of await r.json()) if (!NOW[it.id]) NOW[it.id] = it; } catch (e) {}
  // подписи к фотографиям в подвале (по лицензии обязательны)
  const fc = $('#nowCredits'); if (fc) { const seen = new Set(); const parts = []; let own = 0; for (const c of CH) { const it = NOW[c.id]; if (!it || seen.has(it.title)) continue; seen.add(it.title); if (it.own) { own++; continue; } parts.push((it.author || 'автор не указан') + ' (' + it.license + ')'); } fc.textContent = (own ? 'Фотографии Архадерессе — съёмка «Солнечной Долины», 21 августа 2026. ' : '') + (parts.length ? 'Остальные фотографии «Это место сегодня» — Викисклад: ' + parts.join('; ') + '.' : ''); }
  const card = $('#now'); if (!card) return;
  card.addEventListener('click', () => { wipeTarget = wipeTarget > 0.5 ? 0 : 1; card.classList.toggle('open', wipeTarget > 0.5); });
}
function updateNow(st, dt) {
  const card = $('#now'); if (!card) return;
  const C = st.chapter >= 0 ? CH[st.chapter] : null; const it = C ? NOW[C.id] : null;
  if (st.chapter !== wipeChapter) { wipeChapter = st.chapter; wipeTarget = 0; wipeNow = 0; card.classList.remove('open'); if (it) { $('#nowImg').src = 'now/' + it.file; $('#nowCap').textContent = it.own ? 'Архадерессе, 21 августа 2026' : (it.author ? 'Фото: ' + it.author + (it.license ? ' · ' + it.license : '') : ''); } if (it && st.chapter >= 0 && !R.scenes[st.chapter].now) loadImage('now/' + it.file, 2048).then((im) => R.setNow(st.chapter, im)).catch(() => {}); }
  const vis = it && st.mixv > 0.9 && st.hold > 0.08 && st.hold < 0.95 && R.scenes[st.chapter] && R.scenes[st.chapter].now ? 1 : 0;
  card.classList.toggle('on', vis === 1);
  wipeNow += (wipeTarget - wipeNow) * Math.min(1, dt * 3.2); if (Math.abs(wipeTarget - wipeNow) < 0.002) wipeNow = wipeTarget;
  if (st.chapter >= 0) R.setWipe(st.chapter, vis ? wipeNow : 0);
}
// музыка: файл music/theme.mp3, кнопка «Музыка» появляется только если файл есть; громкость плавная, петля
let music = null, musicOn = false, musicGain = 0;
async function setupMusic() {
  const btn = $('#musicBtn'); if (!btn) return;
  try { const h = await fetch('music/theme.mp3', { method: 'HEAD' }); if (!h.ok) { btn.hidden = true; return; } } catch (e) { btn.hidden = true; return; }
  btn.hidden = false;
  btn.addEventListener('click', () => {
    if (!music) { music = new Audio('music/theme.mp3'); music.loop = true; music.preload = 'auto'; music.volume = 0; } window.__music = music;
    musicOn = !musicOn; btn.setAttribute('aria-pressed', String(musicOn));
    if (musicOn) music.play().catch(() => {});
    try { localStorage.setItem('sd-music', musicOn ? '1' : '0'); } catch (e) {}
  });
}
function updateMusic(dt) {
  if (!music) return; const target = musicOn ? 0.55 : 0; musicGain += (target - musicGain) * Math.min(1, dt * (musicOn ? 0.6 : 1.2)); music.volume = Math.max(0, Math.min(1, musicGain));
  if (!musicOn && musicGain < 0.01 && !music.paused) music.pause();
}
// звук: процедурный эмбиент (sound.js), включается только по клику
let snd = null, sndOn = false, sndKey = -2, gust = 0;
async function toggleSound() {
  const btn = $('#soundBtn'); if (!btn) return;
  if (!snd) { try { const m = await import('./sound.js'); snd = m.default(); if (snd.onGust) snd.onGust((g) => { gust = g; }); } catch (e) { console.warn('[krym] sound', e); btn.disabled = true; return; } }
  sndOn = !sndOn; if (sndOn) snd.enable(); else snd.disable(); btn.setAttribute('aria-pressed', String(sndOn)); sndKey = -2;
  try { localStorage.setItem('sd-snd', sndOn ? '1' : '0'); } catch (e) {}
}
function updateSound(st) {
  if (!snd || !sndOn) return;
  const key = st.mixv > 0.5 ? st.chapter : -1; if (key === sndKey) return; sndKey = key;
  const target = key < 0 ? { wind: 0.25 } : (CH[key].snd || { wind: 0.3, cicadas: 0.2 });
  const dip = {}; for (const k2 in target) dip[k2] = target[k2] * 0.35; snd.setMix(dip, 0.8); setTimeout(() => { if (sndKey === key && sndOn) snd.setMix(target, 2.0); }, 900);
}
function setupMarks() {
  const host = $('#marks');
  CH.forEach((c, k) => { const el = document.createElement('div'); el.className = 'mark'; el.innerHTML = `<i></i><b>${c.year}</b><small>${c.place}</small>`; host.appendChild(el); marks.push({ el, p: R.pins ? R.pins.pins[k].top : R.routePts[k] }); });
  // подписи морей — только с высоты
  for (const pl of [{ n: 'Чёрное море', lon: 33.9, lat: 44.05 }, { n: 'Азовское море', lon: 35.55, lat: 45.9 }, { n: 'Севастополь', lon: 33.52, lat: 44.60, c: 1 }, { n: 'Симферополь', lon: 34.10, lat: 44.95, c: 1 }, { n: 'Ялта', lon: 34.17, lat: 44.50, c: 1 }, { n: 'Феодосия', lon: 35.38, lat: 45.03, c: 1 }, { n: 'Керчь', lon: 36.47, lat: 45.36, c: 1 }, { n: 'Евпатория', lon: 33.37, lat: 45.19, c: 1 }, { n: 'Судак', lon: 34.97, lat: 44.85, c: 1 }, { n: 'Ай-Петри', lon: 34.06, lat: 44.45, c: 2 }, { n: 'Чатыр-Даг', lon: 34.30, lat: 44.77, c: 2 }, { n: 'Роман-Кош', lon: 34.23, lat: 44.61, c: 2 }, { n: 'Демерджи', lon: 34.41, lat: 44.75, c: 2 }, { n: 'Карадаг', lon: 35.23, lat: 44.93, c: 2 }, { n: 'Меганом', lon: 35.08, lat: 44.80, c: 2 }, { n: 'Сокол', lon: 34.93, lat: 44.83, c: 2 }]) { const w = map.toWorld(pl.lon, pl.lat); const el = document.createElement('div'); el.className = pl.c === 2 ? 'sea peak' : (pl.c ? 'sea city' : 'sea'); el.dataset.kind = pl.c || 0; el.textContent = pl.n; host.appendChild(el); seas.push({ el, p: new THREE.Vector3(w[0], w[1] + 0.5, w[2]) }); }
}
function updateHud(Pv, st) {
  const heroO = 1 - smooth((Pv - 0.2) / 0.4);
  const hero = $('.s-hero'); hero.style.opacity = heroO.toFixed(3); hero.style.visibility = heroO < 0.01 ? 'hidden' : 'visible';
  const ch = $('#chapter');
  if (st.chapter >= 0) {
    const C = CH[st.chapter];
    if (ch.dataset.k != st.chapter) { ch.dataset.k = st.chapter; ch.classList.toggle('light', (R.scenes[st.chapter].lum || 0) > 0.55); document.body.classList.toggle('lightch', (R.scenes[st.chapter].lum || 0) > 0.5); $('#chYear').textContent = C.year + ' · ' + C.place; const big = $('#chBig'); if (big) { big.textContent = /^\d{4}$/.test(C.year) ? C.year : ''; }
      $('#chTitle').innerHTML = C.title.split(' ').map((w, i) => `<span style="--i:${i}">${w}</span>`).join(' '); ch.classList.remove('in'); void ch.offsetWidth; $('#chPainter').textContent = C.painter + (C.pyear && C.pyear < 2026 ? ', ' + C.pyear : ''); $('#chText').textContent = C.text; }
    const o = smooth((st.hold - 0.05) / 0.25) * (1 - smooth((st.hold - 0.85) / 0.15)) * (st.mixv > 0.5 ? 1 : 0);
    ch.style.opacity = o.toFixed(3); ch.style.visibility = o < 0.01 ? 'hidden' : 'visible'; ch.style.transform = `translateY(${((1 - o) * 24).toFixed(1)}px)`; ch.classList.toggle('in', o > 0.02);
  } else { ch.style.opacity = 0; ch.style.visibility = 'hidden'; }
  // метки на карте
  const mapVis = (1 - st.mixv) * (1 - (st.fog || 0));
  // сначала текущая глава, потом по порядку; подпись прячется, если ближе 64 px к уже показанной (точка остаётся)
  const shown = []; const order = marks.map((m, k) => k); if (st.chapter >= 0) { order.splice(st.chapter, 1); order.unshift(st.chapter); }
  for (const k of order) { const m = marks[k]; const p = R.project(m.p.x, m.p.y, m.p.z); const near = st.chapter === k; const sx = p.x * innerWidth, sy = p.y * innerHeight;
    const crowded = shown.some(q => Math.abs(q[0] - sx) < 110 && Math.abs(q[1] - sy) < 34); if (!crowded) shown.push([sx, sy]);
    const future = k > (st.chapter >= 0 ? st.chapter : 0); const o = mapVis * (p.front ? 1 : 0) * (near ? 1 : 0.55) * (future ? 0 : 1); m.el.style.opacity = o.toFixed(3); m.el.style.left = (p.x * 100).toFixed(2) + '%'; m.el.style.top = (p.y * 100).toFixed(2) + '%'; m.el.classList.toggle('on', near); m.el.classList.toggle('dot', crowded && !near); }
  const camY = R.mapCam.position.y; const nearK = smooth((camY - 8) / 8) * (1 - smooth((camY - 60) / 40));
  for (const sname of seas) { const p = R.project(sname.p.x, sname.p.y, sname.p.z); const isPeak = sname.el.dataset.kind === '2'; sname.el.style.opacity = (mapVis * (p.front ? 1 : 0) * (isPeak ? nearK : (document.body.classList.contains('far') ? 1 : 0))).toFixed(3); sname.el.style.left = (p.x * 100).toFixed(2) + '%'; sname.el.style.top = (p.y * 100).toFixed(2) + '%'; }
  $('#hint').classList.toggle('on', !intro.active && Pv < 0.15);
  const fin = $('#finale'); if (fin) fin.classList.toggle('on', Pv > 1 + L * CH.length - 0.35);
  // лента лет внизу: где мы на дороге
  const ys = $('#years'); if (ys) { if (!ys.childElementCount) { CH.forEach((c, k) => { const e = document.createElement('span'); e.className = 'y'; e.style.left = (k / (CH.length - 1) * 100) + '%'; e.textContent = /^\d{4}$/.test(c.year) ? c.year : c.year.replace(/ до н\. э\./, ''); e.title = c.place; e.addEventListener('click', () => { const y = (1 + L * k + 1.0) * innerHeight; if (lenis) lenis.scrollTo(y, { duration: 2.2 }); else window.scrollTo({ top: y, behavior: 'smooth' }); }); ys.appendChild(e); }); const i = document.createElement('i'); i.className = 'pos'; ys.appendChild(i); }
    const prog = clamp((Pv - 1) / L / (CH.length - 1), 0, 1); ys.querySelector('.pos').style.left = (prog * 100) + '%'; ys.querySelectorAll('.y').forEach((e, k) => e.classList.toggle('on', k === st.chapter)); ys.classList.toggle('on', Pv > 0.7 && Pv < 1 + L * CH.length - 0.1); }
  $('#top').classList.toggle('hide', Pv > 1 + L * CH.length - 0.2);
}

function setupScroll() {
  $('#track').style.height = ((1 + L * CH.length) * 100 + 60) + 'vh';
  if (window.Lenis && !reduced) lenis = new window.Lenis({ lerp: 0.07, smoothWheel: true, wheelMultiplier: 0.9 });
  if (qs.get('p')) debugP = parseFloat(qs.get('p'));
}

async function main() {
  const loader = $('#loader'), bar = $('#loader .bar i');
  const setP = (v) => { bar.style.width = (v * 100).toFixed(1) + '%'; };
  const T0 = performance.now(); const lap = (n) => console.log('[krym] ' + n + ' ' + (performance.now() - T0).toFixed(0) + ' ms');
  setP(0.05);
  await Promise.race([Promise.all([document.fonts.load('300 200px "Cormorant"'), document.fonts.load('400 14px "Golos Text"')]), new Promise(r => setTimeout(r, 2500))]);
  // лёгкий DEM (уменьшен в 4 раза, ~1 МБ): карта точек запечена, высоты нужны только для маршрута; полный z10 — запасной
  let meta, dem; try { meta = await (await fetch('data/dem-crimea-lite.json')).json(); dem = await loadHeights('data/dem-crimea-lite.png'); } catch (e) { meta = await (await fetch('data/dem-crimea-z10.json')).json(); dem = await loadHeights('data/dem-crimea-z10.png'); }
  setP(0.35); lap('dem');
  // рельеф: сетка по высотам вместо точек; точки остаются запасным путём
  let T = null; try { T = await createTerrain({ meta, noiseTex: getNoise(), mobile }); lap('terrain'); T.ready.then(() => lap('terrain patches ' + T.patches.map(p => p.name).join('+'))); } catch (e) { console.warn('[krym] terrain', e); }
  if (T) { const Wd = dem.w, Hd = dem.hgt, KM = 0.108 * 3584 / Wd, EXAG = 4.0, H = dem.h; const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)); map = { KM, toWorld: (lon, lat) => { const px = (lon - meta.lonW) / (meta.lonE - meta.lonW) * Wd; const py = (mercY(lat) - mercY(meta.latN)) / (mercY(meta.latS) - mercY(meta.latN)) * Hd; const h = H[clamp(py | 0, 0, Hd - 1) * Wd + clamp(px | 0, 0, Wd - 1)]; return [(px - Wd / 2) * KM, Math.max(h, 0) / 1000 * EXAG, (py - Hd / 2) * KM]; } }; }
  else { map = await loadMapBaked(dem, meta) || buildMap(dem, meta); }
  setP(0.6); lap('map');
  R = createRenderer($('#gl'), map, T);
  setupMarks(); setupScroll(); fillCredits(); loadNow();
  const sb = $('#soundBtn'); if (sb) sb.addEventListener('click', toggleSound); setupMusic(); setupTune();
  // первая картина — до старта, остальные — фоном
  // мазки: из запечённого файла (tools/krym/bake.js), иначе считаем в браузере
  const loadStrokes = async (k, img, dimg) => {
    if (!USE_STROKES) return { n: 0, a: new Float32Array(0) };
    try {
      const r = await fetch(CH[k].img.replace(/^scenes\/.*$/, 'scenes/' + CH[k].id + '.strokes.bin')); if (!r.ok) throw 0;
      const dv = new DataView(await r.arrayBuffer()); const n = dv.getUint32(0, true); const a = new Float32Array(n * 11);
      for (let i = 0; i < n; i++) { const o = 12 + i * 15, p = i * 11; a[p] = dv.getUint8(o); a[p + 1] = dv.getUint16(o + 1, true) / 65535; a[p + 2] = dv.getUint16(o + 3, true) / 65535; a[p + 3] = dv.getUint8(o + 5) / 255; a[p + 4] = dv.getUint8(o + 6) / 255 * 2 * Math.PI - Math.PI; a[p + 5] = dv.getUint16(o + 7, true) / 65535 / 4; a[p + 6] = dv.getUint16(o + 9, true) / 65535 / 4; a[p + 7] = dv.getUint8(o + 11) / 255; a[p + 8] = dv.getUint8(o + 12) / 255; a[p + 9] = dv.getUint8(o + 13) / 255; a[p + 10] = dv.getUint8(o + 14) / 255; }
      return { n, a };
    } catch (e) { return makeStrokes(img, dimg, { seed: 11 + k, layers: [{ r: 0.0085, sp: 0.0075, thr: -1 }, { r: 0.0045, sp: 0.0036, thr: 0.03 }, { r: 0.0024, sp: 0.0019, thr: 0.045 }] }); }
  };
  const NO_PEOPLE = new Set(['feodosia', 'gurzuf']);   // подлинники: вырезанные фигуры поверх оригинала двоились (головы), слой выключен
  const loadScene = async (k) => { const C = CH[k];
    let meta = null; if (!NO_PEOPLE.has(C.id)) try { const r = await fetch('layers/' + C.id + '-people.json'); if (r.ok) meta = await r.json(); } catch (e) {}
    // на плотных экранах (dpr ≥ 1.5) полотна с крупным оригиналом грузятся в 3072 px из scenes/hi/
    const hiBase = C.img.replace(/^scenes\//, '').replace(/\.[a-z]+$/, ''); const useHi = !mobile && !meta && (window.devicePixelRatio || 1) >= 1.5 && HI_SCENES.has(hiBase);
    const [img, dimg] = await Promise.all([loadImage(meta ? 'layers/' + C.id + '-clean.jpg' : (useHi ? 'scenes/hi/' + hiBase + '.jpg' : C.img), mobile ? 1400 : (useHi ? 3072 : 2048)), loadImage(C.depth, 1024)]); const strokes = await loadStrokes(k, img, dimg); R.addScene(k, img, dimg, strokes);
    if (meta && meta.figures && meta.figures.length) {
      // вторая фаза походки, если есть (tools/krym/people.js <A2> <B> <id>2 → layers/<id>2-people.*)
      let meta2 = null; try { const r2 = await fetch('layers/' + C.id + '2-people.json'); if (r2.ok) meta2 = await r2.json(); } catch (e) {}
      Promise.all([loadImage('layers/' + C.id + '-people.png', 2048), meta2 ? loadImage('layers/' + C.id + '2-people.png', 2048).catch(() => null) : Promise.resolve(null)]).then(([p, p2]) => R.addPeople(k, p, meta, dimg.el, p2, p2 ? meta2 : null)).catch(() => {});
    }
    const base = C.img.replace(/^scenes\//, '').replace(/\.[a-z]+$/, ''); loadImage('masks/' + base + '-life.png', 1024).then((m) => R.setMask(k, m)).catch(() => {}); };
  await loadScene(0);
  setP(1); lap('scene 0');
  applyTimeline(0, 0); R.uP.uFade.value = 0; R.render(0, 0); lap('first frame');
  requestAnimationFrame(loop);
  const gate = $('#gate');
  const ok = qs.get('gate') === '0' || localStorage.getItem('sd-18') === '1';
  loader.classList.add('out');
  if (!ok) { gate.hidden = false; $('#gateYes').addEventListener('click', () => { try { localStorage.setItem('sd-18', '1'); } catch (e) {} gate.classList.add('out'); start(); }); }
  else { gate.hidden = true; start(); }
  (async () => { for (let k = 1; k < CH.length; k++) { await new Promise(r => setTimeout(r, 300)); await loadScene(k); lap('scene ' + k); } })();
}
function start() { intro.active = true; intro.start = performance.now(); $('#top').classList.add('on'); if (reduced) { intro.active = false; sunrise(99); document.body.classList.add('title'); } }
// восход над рельефом: солнце поднимается с востока, тени сползают, море ловит блик, маршрут прочерчивается, булавки зажигаются
const d2r = Math.PI / 180;
function sunrise(ti) {
  if (!R || !R.T) { if (ti > 3.5) document.body.classList.add('title'); return; }
  const k = Math.pow(smooth(ti / 7.0), 1.45); const el = lerp(-5, 25, k), az = lerp(100, 135, k);
  const ce = Math.cos(el * d2r); R.T.uni.uSun.value.set(Math.sin(az * d2r) * ce, Math.sin(el * d2r), -Math.cos(az * d2r) * ce).normalize();
  const w = smooth((el - 1) / 17); R.T.uni.uSunCol.value.set(1.0, lerp(0.38, 0.86, w), lerp(0.14, 0.62, w));
  R.T.uni.uSunI.value = 1.35 * (0.06 + 0.94 * smooth((el + 2) / 14)); R.T.uni.uAmb.value = 0.22 + 0.78 * smooth((el + 4) / 17);
  R.skyDawn.value = (1 - smooth((el - 2) / 12)) * smooth((el + 4) / 5);
  if (intro.active) R.uP.uRays.value = reduced ? 0 : R.skyDawn.value * 0.9;
  { const sd = R.T.uni.uSun.value; const v = new THREE.Vector3(R.mapCam.position.x + sd.x * 400, R.mapCam.position.y + sd.y * 400, R.mapCam.position.z + sd.z * 400).project(R.mapCam); R.uP.uSunUv.value.set(clamp(v.x * 0.5 + 0.5, -0.3, 1.3), clamp(v.y * 0.5 + 0.5, -0.3, 1.3)); }
  const rm = R.routeMat.uniforms; const dr = smooth((ti - 2.4) / 3.6); if (rm) rm.uDraw.value = dr;
  if (R.comet && R.route.userData.pts) { const pts = R.route.userData.pts; const p = pts[Math.min(pts.length - 1, Math.floor(dr * (pts.length - 1)))]; R.comet.position.copy(p); R.comet.material.opacity = 0.9 * smoothstep01(dr, 0.01, 0.06) * (1 - smoothstep01(dr, 0.94, 1.0)); }
  if (R.pins) R.pins.pins.forEach((p, i) => { p.userData = p.userData || {}; p.spr.userData.lit = smooth((ti - 3.0 - i * 0.2) / 0.7); });
  introCam = 1 - smooth(ti / 7.5);
  if (ti > 4.2) document.body.classList.add('title');
}
let introCam = 0;
const smoothstep01 = (x, a, b) => smooth((x - a) / (b - a));

let last = 0, frames = 0, ftAcc = 0, adapted = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const time = now / 1000; const dt = last ? Math.min(0.1, (now - last) / 1000) : 0.016; last = now;
  if (lenis) lenis.raf(now);
  const ls = lenis ? lenis.scroll : NaN; const sy = Number.isFinite(ls) ? ls : window.scrollY;
  P = debugP !== null ? debugP : (sy / innerHeight || 0);
  Psm += (P - Psm) * (lenis ? 1 : 0.12);
  if (intro.active) { const ti = (now - intro.start) / 1000; intro.t = smooth(clamp(ti / 1.6, 0, 1)); sunrise(ti); if (ti >= 8.0) { intro.active = false; sunrise(99); document.body.classList.add('title'); } }
  const st = applyTimeline(Psm, time);
  updateHud(intro.active ? 0 : Psm, st); updateSound(st); updateNow(st, dt); updateMusic(dt); gust *= Math.exp(-dt / 2.5);   // порыв от звука затухает
  R.render(time, st.mixv, st.fog);
  frames++; ftAcc += dt;
  if (!intro.active && frames % 90 === 0) { const avg = ftAcc / 90; ftAcc = 0; if (avg > 0.024 && adapted === 0) { adapted = 1; R.setDpr(Math.min(R.dpr, 1.25)); } else if (avg > 0.024 && adapted === 1) { adapted = 2; R.setDpr(Math.min(R.dpr, 1.0)); } else if (avg > 0.026 && adapted === 2) { adapted = 3; R.setDpr(0.85); } }
  if (statsEl) statsEl.textContent = `P ${Psm.toFixed(2)}  fps ${(1 / dt).toFixed(0)}  ch ${st.chapter} mix ${st.mixv.toFixed(2)}`;
}
const statsEl = qs.get('stats') ? $('#stats') : null; if (statsEl) statsEl.style.display = 'block';
window.addEventListener('resize', () => R && R.resize());

await new Promise((res) => { const s = document.createElement('script'); s.src = '../assets/vendor/lenis.min.js'; s.onload = res; s.onerror = res; document.head.appendChild(s); });
main().catch((err) => { console.error(err); const l = $('#loader .cap'); if (l) l.textContent = 'Ошибка: ' + err.message; });
