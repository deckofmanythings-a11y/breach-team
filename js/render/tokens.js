// Round unit tokens: a painted portrait in a coloured ring.
// Soldier portraits are painted with green armor; recolorArmor() swaps that green for the
// Soldier's chosen armor colour (HSL swap, soft mask on hue + saturation), so one portrait serves
// every colour scheme. Enemies keep their painted colours and get a faction ring.
// Portraits in assets/tokens/ are already cropped to the token framing (tools/art/pick.py).

export const TOKEN_PX = 128;                                   // canvas size of a finished token
export const RAW_CROP = { cx: 0.5, cy: 0.40, size: 0.78 };     // framing for uncropped raw renders (tools/art)
const FULL = { cx: 0.5, cy: 0.5, size: 1 };
const ASSET_V = 2;                                             // bump when re-picking token art (cache bust)

export const FACTION_RING = { pirates: '#c4581c', corpsec: '#1fb5a8', military: '#8a8f86', system: '#d04040',
  hive: '#9b5cff', mycelid: '#9ee86a', lattice: '#7f8cff', wraith: '#e8e8ff', drifters: '#3dd6ff', thrall: '#5dff6a' };
export const tokenSrc = (id) => new URL(`../../assets/tokens/${id}.jpg?v=${ASSET_V}`, import.meta.url).href;
export const floorSrc = (faction) => new URL(`../../assets/floors/floor-${faction}.jpg?v=${ASSET_V}`, import.meta.url).href;
export const soldierTokenId = (s) => s.portrait || `soldier-${s.specialty}-${s.sex === 'f' ? 'f' : 'm'}${+s.look ? '-' + +s.look : ''}`;

const imgCache = new Map();
export function loadImage(src) {
  if (!imgCache.has(src)) imgCache.set(src, new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }));
  return imgCache.get(src);
}

const hexRgb = (h) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

// Replace green armour with `hex` (in place). Keeps the painted lightness, pulled a little toward
// the target's lightness so very dark / very light colours still read.
export function recolorArmor(data, hex) {
  const [th, ts, tl] = rgbToHsl(...hexRgb(hex));
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const [h, s, l] = rgbToHsl(r, g, b);
    const w = (1 - smooth(40, 65, Math.abs(h - 100))) * smooth(0.06, 0.2, s) * smooth(0.04, 0.12, l);
    if (w <= 0.01) continue;
    const nl = Math.max(0, Math.min(1, l * 0.75 + tl * 0.25 + (tl - 0.45) * 0.25));
    const [nr, ng, nb] = hslToRgb(th, Math.max(ts, 0.08), nl);
    d[i] = r + (nr - r) * w; d[i + 1] = g + (ng - g) * w; d[i + 2] = b + (nb - b) * w;
  }
  return data;
}

function greyscale(data, darken = 0.75) {
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) { const y = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) * darken; d[i] = d[i + 1] = d[i + 2] = y; }
  return data;
}

// Build a token canvas. opts: { armor, ring, ringWidth, leader, recolor, grey, crop, size }
export function makeToken(img, opts = {}) {
  const S = opts.size || TOKEN_PX, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d', { willReadFrequently: true });
  const cr = opts.crop || FULL;
  const sw = img.width * cr.size, sx = img.width * cr.cx - sw / 2, sy = Math.max(0, img.height * cr.cy - sw / 2);
  const rw = opts.ringWidth ?? Math.round(S * 0.08);
  x.save(); x.beginPath(); x.arc(S / 2, S / 2, S / 2 - rw / 2, 0, Math.PI * 2); x.clip();
  x.drawImage(img, sx, sy, sw, sw, 0, 0, S, S);
  x.restore();
  if ((opts.recolor && opts.armor) || opts.grey) {
    const id = x.getImageData(0, 0, S, S);
    if (opts.recolor && opts.armor) recolorArmor(id, opts.armor);
    if (opts.grey) greyscale(id);
    x.putImageData(id, 0, 0);
  }
  x.lineWidth = rw; x.strokeStyle = opts.grey ? '#555' : (opts.ring || '#f2c14e');
  x.beginPath(); x.arc(S / 2, S / 2, S / 2 - rw / 2, 0, Math.PI * 2); x.stroke();
  x.lineWidth = Math.max(1, S / 64); x.strokeStyle = 'rgba(0,0,0,.85)';
  x.beginPath(); x.arc(S / 2, S / 2, S / 2 - x.lineWidth / 2, 0, Math.PI * 2); x.stroke();
  x.beginPath(); x.arc(S / 2, S / 2, S / 2 - rw, 0, Math.PI * 2); x.stroke();
  if (opts.leader) { x.fillStyle = '#ffd34d'; x.strokeStyle = '#000'; x.lineWidth = 2; x.font = `bold ${Math.round(S * 0.22)}px sans-serif`; x.textAlign = 'center'; x.strokeText('★', S / 2, S * 0.2); x.fillText('★', S / 2, S * 0.2); }
  return c;
}

// Cached token for a Soldier (or any object with specialty/sex/colors).
const tokCache = new Map();
export async function soldierToken(s, opts = {}) {
  const [a, b] = s.colors || ['#3a5a8c', '#f2c14e'];
  const key = `${soldierTokenId(s)}|${a}|${b}|${opts.grey ? 1 : 0}|${opts.size || TOKEN_PX}`;
  if (!tokCache.has(key)) tokCache.set(key, loadImage(tokenSrc(soldierTokenId(s))).then(img => makeToken(img, { armor: a, ring: b, recolor: true, ...opts })));
  return tokCache.get(key);
}
export async function unitToken(kind, ring, opts = {}) {
  const key = `${kind}|${ring}|${opts.grey ? 1 : 0}|${opts.leader ? 1 : 0}|${opts.size || TOKEN_PX}`;
  if (!tokCache.has(key)) tokCache.set(key, loadImage(tokenSrc(kind)).then(img => makeToken(img, { ring, ...opts })));
  return tokCache.get(key);
}

// DOM avatars: elements rendered as <span class="avatar" data-tok=...> get their token painted in
// as soon as it's ready (the initials stay as a fallback if the image fails to load).
const urlCache = new Map();
export function hydrateAvatars(root = document) {
  for (const el of root.querySelectorAll('.avatar[data-tok]:not([data-done])')) {
    el.dataset.done = '1';
    const s = { specialty: el.dataset.spec, sex: el.dataset.sex, look: +el.dataset.look || 0, portrait: el.dataset.portrait || undefined, colors: [el.dataset.a, el.dataset.b] };
    const key = `${soldierTokenId(s)}|${s.colors.join('|')}`;
    const p = urlCache.get(key) || soldierToken(s, { size: 96 }).then(c => c.toDataURL('image/png'));
    urlCache.set(key, p);
    p.then(url => { el.style.backgroundImage = `url(${url})`; el.classList.add('tok'); }).catch(() => {});
  }
}
if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
  new MutationObserver(() => hydrateAvatars()).observe(document.documentElement, { childList: true, subtree: true });
}
