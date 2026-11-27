// Skeuomorphic booster-pack opening: a foil pack you tear open along the top (drag with mouse or finger),
// then pull the contents out one physical card at a time. Every card gets a celebration; rarer ones get
// a longer build-up and a much bigger one. Purely presentation: the pack was already rolled on the server.
// New file (stale-cache rule).
//
// openPackShow(pack, { items, soldiers, rare, cyborg, pity }) -> Promise (resolves when closed)
import * as snd from '../audio/pack-sfx.js';
import { esc, statGrid } from './ui.js';
import { levelBadge } from './badges.js';
import { itemTipText } from './itemtip.js';
import { iconSvg, itemIcon } from './item-icons.js';
import { ITEM_BY_ID, RARITY_BY_ID, AFFIX_BY_ID, RARITY_ORDER } from '../data/gear.js';
import { GRADE_BY_ID, GRADES } from '../data/economy.js';
import { SPECIALTY_BY_ID, SPECIALTIES } from '../data/specialties.js';

const TIER_COLOR = ['#c3ccd4', '#4fa3ff', '#b26bff', '#ffb02e', '#3dffb5'];
const PACK_LOOK = {
  recruit:  { c1: '#16385a', c2: '#6fb4f5', icon: 'vest' },
  armory:   { c1: '#323d17', c2: '#b4c264', icon: 'rifle' },
  boarding: { c1: '#5a0d0d', c2: '#ff6b3d', icon: 'breach' },
  elite:    { c1: '#241803', c2: '#ffd25a', icon: 'eye' },
};
const SLOT_NAME = { weapon: 'Weapon', armor: 'Armor', utility: 'Utility', implant: 'Implant' };
const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : '';
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------- particles
function makeFX(canvas) {
  const g = canvas.getContext('2d');
  let ps = [], raf = 0, W = 0, H = 0;
  const resize = () => {
    const dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  const add = (p) => { if (ps.length < 2600) ps.push(p); if (!raf) raf = requestAnimationFrame(tick); };
  const fx = {
    resize,
    conf(x, y, vx, vy, colors, size = 1) {
      add({ k: 'c', x, y, vx, vy, c: pick(colors), w: rnd(6, 11) * size, h: rnd(9, 16) * size, r: rnd(0, 6.3), vr: rnd(-0.25, 0.25),
        t: rnd(0, 6.3), vt: rnd(0.08, 0.25), g: 0.17 * Math.min(1, size + 0.3), d: 0.985, life: rnd(170, 280) });
    },
    spark(x, y, vx, vy, c, life = rnd(40, 80), grav = 0.04, rad = rnd(1.5, 3.2), d = 0.97) {
      add({ k: 's', x, y, vx, vy, c, life, max: life, g: grav, d, rad });
    },
    coin(x, y) { add({ k: 'o', x, y, vx: rnd(-1.2, 1.2), vy: rnd(1, 5), t: rnd(0, 6), vt: rnd(0.12, 0.3), g: 0.2, d: 0.995, life: 300, rad: rnd(7, 11) }); },
    rocket(x, ty, colors) {
      const vy = -Math.sqrt(2 * 0.12 * Math.max(60, H + 10 - ty));
      add({ k: 'r', x, y: H + 10, vx: rnd(-1.2, 1.2), vy, g: 0.12, d: 1, colors, life: 600 });
    },
    // A ring burst from a point.
    burst(x, y, n, colors, speed = 10, kind = 'conf') {
      for (let i = 0; i < n; i++) {
        const a = rnd(0, Math.PI * 2), s = rnd(speed * 0.35, speed);
        if (kind === 'conf') fx.conf(x, y, Math.cos(a) * s, Math.sin(a) * s - speed * 0.35, colors);
        else fx.spark(x, y, Math.cos(a) * s, Math.sin(a) * s, pick(colors), rnd(35, 75), 0.06);
      }
    },
    // Confetti cannon from a screen corner.
    cannon(left, n, colors, power = 1) {
      const x = left ? -10 : W + 10, y = H + 10;
      for (let i = 0; i < n; i++) {
        const a = (left ? -62 : -118) * Math.PI / 180 + rnd(-0.28, 0.28), s = rnd(13, 24) * power * Math.sqrt(H / 800);
        fx.conf(x, y, Math.cos(a) * s, Math.sin(a) * s, colors);
      }
    },
    // Sparks sucked into a point (charging up).
    implode(x, y, n, colors) {
      for (let i = 0; i < n; i++) {
        const a = rnd(0, Math.PI * 2), r = rnd(160, 360), life = rnd(28, 45);
        fx.spark(x + Math.cos(a) * r, y + Math.sin(a) * r, -Math.cos(a) * r / life, -Math.sin(a) * r / life, pick(colors), life, 0, rnd(1.5, 3), 1);
      }
    },
    rain(n, colors) { for (let i = 0; i < n; i++) fx.conf(rnd(0, W), rnd(-260, -10), rnd(-1, 1), rnd(0, 3), colors); },
    clear() { ps = []; },
    stop() { cancelAnimationFrame(raf); raf = 0; ps = []; },
  };
  function explode(p) {
    snd.crackle();
    const n = 70, c = pick(p.colors);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd(-0.05, 0.05), s = rnd(2.5, 6.5);
      fx.spark(p.x, p.y, Math.cos(a) * s, Math.sin(a) * s, Math.random() < 0.2 ? '#ffffff' : c, rnd(55, 95), 0.05, rnd(1.6, 3));
    }
  }
  function tick() {
    raf = 0;
    g.clearRect(0, 0, W, H);
    const cur = ps; ps = [];
    for (const p of cur) {
      p.vx *= p.d; p.vy = p.vy * p.d + p.g; p.x += p.vx; p.y += p.vy; p.life--;
      if (p.k === 'r') {
        fx.spark(p.x, p.y, rnd(-0.4, 0.4), rnd(0.5, 1.5), '#ffe9b0', 16, 0.02, 1.6);
        if (p.vy >= -0.6) { explode(p); continue; }
      }
      if (p.life <= 0 || p.y > H + 60) continue;
      ps.push(p);
      if (p.k === 'c') {
        p.t += p.vt; p.r += p.vr; p.x += Math.sin(p.t) * 0.7;
        g.save(); g.globalAlpha = Math.min(1, p.life / 40); g.translate(p.x, p.y); g.rotate(p.r); g.scale(1, Math.cos(p.t));
        g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore();
      } else if (p.k === 's') {
        const a = p.life / p.max;
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = a * 0.35; g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.rad * 3, 0, 7); g.fill();
        g.globalAlpha = a; g.beginPath(); g.arc(p.x, p.y, p.rad, 0, 7); g.fill();
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      } else if (p.k === 'o') {
        p.t += p.vt;
        const w = Math.abs(Math.cos(p.t)) * p.rad + 1;
        g.fillStyle = Math.cos(p.t) > 0 ? '#ffd34d' : '#e0a21a'; g.strokeStyle = '#8a5a08'; g.lineWidth = 1.5;
        g.beginPath(); g.ellipse(p.x, p.y, w, p.rad, 0, 0, 7); g.fill(); g.stroke();
      }
    }
    if (ps.length) raf = requestAnimationFrame(tick);
  }
  return fx;
}

// ---------------------------------------------------------------- card content
function cardData(r) {
  const cards = [];
  for (const s of r.soldiers) {
    const rare = (r.rare || []).includes(s.uid), cyborg = (r.cyborg || []).includes(s.uid);
    const gi = Math.max(0, GRADES.findIndex(x => x.id === s.grade));
    const tier = rare || cyborg ? 4 : Math.min(3, gi);
    cards.push({ kind: 'soldier', s, tier, rare, cyborg, color: cyborg ? '#ff4040' : rare ? '#ff5fd2' : TIER_COLOR[tier] });
  }
  r.items.forEach((it) => {
    const tier = Math.max(0, RARITY_ORDER.indexOf(it.rarity));
    cards.push({ kind: 'item', it, tier, color: TIER_COLOR[tier] });
  });
  if (r.pity) { const best = cards.filter(c => c.kind === 'item').sort((a, b) => b.tier - a.tier)[0]; if (best) best.pity = true; }
  // Like a real pack: the good stuff is at the back.
  return cards.map((c, i) => ({ ...c, i })).sort((a, b) => (a.tier * 2 + (a.kind === 'soldier')) - (b.tier * 2 + (b.kind === 'soldier')) || a.i - b.i);
}
const itemName = (it) => [...(it.affixes || []).map(a => AFFIX_BY_ID[a.id]?.name).filter(Boolean), ITEM_BY_ID[it.base].name].join(' ');

function frontHTML(c, idx, n, packName) {
  let head, art, type, text;
  if (c.kind === 'item') {
    const it = c.it, base = ITEM_BY_ID[it.base], rar = RARITY_BY_ID[it.rarity];
    head = itemName(it);
    art = `${itemIcon(it, 120)}<div class="pc-slot">${SLOT_NAME[base.slot] || cap(base.slot)}</div>`;
    type = `<span>${SLOT_NAME[base.slot] || cap(base.slot)}${base.type ? ' · ' + cap(base.type) : ''}</span><b>${esc(rar?.name || it.rarity)}</b>`;
    const lines = itemTipText(it).split('\n').slice(1);
    let inAff = false;
    text = lines.map(l => {
      if (l === 'Affixes:') { inAff = true; return ''; }
      if (l.startsWith('“')) return `<i>${esc(l)}</i>`;
      return `<div class="${inAff ? 'aff' : ''}">${esc(l)}</div>`;
    }).join('');
    if (base.slot === 'weapon') {
      const who = SPECIALTIES.filter(sp => sp.weapons.includes(base.type)).map(sp => sp.name);
      if (who.length) text += `<div class="pc-who">Used by: ${esc(who.join(' · '))}</div>`;
    }
  } else {
    const s = c.s, sp = SPECIALTY_BY_ID[s.specialty], [a] = s.colors || ['#3a5a8c'];
    head = s.name + (s.callsign ? ` "${s.callsign}"` : '');
    art = `<div class="portrait" data-tok="1" data-spec="${s.specialty}" data-sex="${s.sex === 'f' ? 'f' : 'm'}" data-look="${s.look || 0}"${s.portrait ? ` data-portrait="${esc(s.portrait)}"` : ''} data-a="${a}"></div><div class="pc-slot">Soldier</div>`;
    const grade = c.cyborg ? 'Rebuilt' : c.rare ? 'Rare' : GRADE_BY_ID[s.grade]?.name || '';
    type = `<span>${levelBadge(s.level, (s.colors || [])[1], 'sm')} ${esc(sp?.name || s.specialty)}</span><b>${esc(grade)}</b>`;
    text = statGrid(s.stats, s.specialty) + (s.bio ? `<i>${esc(s.bio)}</i>` : '');
  }
  return `<div class="pc-face pc-front">
    <div class="pc-frame">
      <div class="pc-head"><span class="pc-name">${esc(head)}</span><span class="pc-gem"></span></div>
      <div class="pc-art">${art}</div>
      <div class="pc-type">${type}</div>
      <div class="pc-text">${text}</div>
      <div class="pc-foot"><span>BREACH TEAM · ${esc(packName.toUpperCase())}</span><span>${idx + 1}/${n}</span></div>
    </div>
    <div class="pc-holo"></div><div class="pc-glare"></div>
  </div>`;
}
const BACK = `<div class="pc-face pc-back"><div class="pcb-ring"><div class="pcb-logo">BREACH<br><span>TEAM</span></div></div></div>`;

function bannerFor(c) {
  if (c.kind === 'soldier') {
    if (c.cyborg) return ['✦ UNREGISTERED UNIT ✦', 'No sender. No paperwork. It has joined your Barracks.'];
    if (c.rare) return ['✦ RARE RECRUIT ✦', `${c.s.name} joins the team!`];
    return [['NEW RECRUIT!', 'SEASONED PRO!!', 'VETERAN!!!', '★ ELITE ★'][c.tier], `${c.s.name} joins the team!`];
  }
  const t = [pick(['NICE PULL!', 'GEAR GET!', 'LOCKED & LOADED!', 'FRESH KIT!', 'SOLID!']), 'MIL-SPEC!!', 'PROTOTYPE!!!', '★ RELIC ★', '✦ XENO ✦'][c.tier];
  return [t, itemName(c.it) + (c.pity ? ' · pity guarantee!' : '')];
}

// ---------------------------------------------------------------- the show
export function openPackShow(pack, r) {
  return new Promise((resolve) => {
    const look = PACK_LOOK[pack.id] || PACK_LOOK.recruit;
    const cards = cardData(r), n = cards.length;
    const best = Math.max(0, ...cards.map(c => c.tier));
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const root = document.createElement('div');
    root.className = 'pko';
    root.style.setProperty('--pc1', look.c1); root.style.setProperty('--pc2', look.c2);
    const contents = [pack.soldiers ? `${pack.soldiers} SOLDIER${pack.soldiers > 1 ? 'S' : ''}` : '', pack.items ? `${pack.items} ITEM${pack.items > 1 ? 'S' : ''}` : ''].filter(Boolean).join(' · ');
    root.innerHTML = `
      <div class="pko-dim"></div><div class="pko-rays"></div>
      <div class="pko-stage">
        <div class="pk-pos"><div class="pk">
          <div class="pk-back"></div>
          <div class="pk-cards">${cards.map((_, i) => `<div class="pk-stub" style="--i:${i}">${BACK}</div>`).join('')}</div>
          <div class="pk-glow"></div>
          <div class="pk-front"><div class="pk-face">
            <div class="pk-tearline"><span>✂ TEAR HERE</span></div>
            <div class="pk-logo">BREACH<span>TEAM</span></div>
            <div class="pk-emblem">${iconSvg(look.icon, 64)}</div>
            <div class="pk-name">${esc(pack.name)}</div>
            <div class="pk-contents">${contents}</div>
            ${pack.floor && pack.floor !== 'standard' ? `<div class="pk-guar">★ ${esc(RARITY_BY_ID[pack.floor]?.name || '')} or better guaranteed ★</div>` : ''}
            <div class="pk-series">SERIES 01 · BOARDING ACTION TRADING CARDS</div>
          </div></div>
          <div class="pk-strip-wrap attach"><div class="pk-strip"><span>BREACH TEAM ◆ BREACH TEAM ◆ BREACH TEAM ◆ BREACH TEAM</span></div></div>
          <div class="pk-strip-wrap flap"><div class="pk-strip"><span>BREACH TEAM ◆ BREACH TEAM ◆ BREACH TEAM ◆ BREACH TEAM</span></div></div>
        </div></div>
      </div>
      <canvas class="pko-fx"></canvas>
      <div class="pko-flash"></div>
      <div class="pko-banner" hidden><div class="t"></div><div class="s"></div></div>
      <div class="pko-hint"></div>
      <div class="pko-top"><span class="pko-title">${esc(pack.name)}</span><button class="pko-skip" type="button">Skip ⏭</button></div>
      <div class="pko-actions"><button class="pko-rip" type="button">✂ Just rip it</button><button class="pko-done primary" type="button" hidden>Collect ✔</button></div>`;
    document.body.append(root);

    const $ = (s) => root.querySelector(s);
    const stage = $('.pko-stage'), packPos = $('.pk-pos'), pk = $('.pk'), dimEl = $('.pko-dim'), rays = $('.pko-rays');
    const flashEl = $('.pko-flash'), banner = $('.pko-banner'), hint = $('.pko-hint');
    const attach = $('.pk-strip-wrap.attach'), flap = $('.pk-strip-wrap.flap');
    const stubs = [...root.querySelectorAll('.pk-stub')];
    const fx = makeFX($('.pko-fx'));
    // Torn edge (jagged line 15% down) and the crimped seals top and bottom.
    (() => {
      const jag = []; for (let x = 0; x <= 100; x += 4) jag.push([x, 15 + rnd(-1.3, 1.3)]);
      const D = 1.8, crB = [], crT = [];
      for (let i = 0; i <= 30; i++) { crB.push([100 - i * 100 / 30, i % 2 ? 100 - D : 100]); crT.push([i * 100 / 30, i % 2 ? D : 0]); }
      const P = (pts) => `polygon(${pts.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(',')})`;
      const body = P([...jag, ...crB]);
      $('.pk-front').style.clipPath = body; $('.pk-back').style.clipPath = body;
      const strip = P([...crT, ...jag.slice().reverse()]);
      for (const el of root.querySelectorAll('.pk-strip')) el.style.clipPath = strip;
    })();
    const packColors = [look.c2, '#ffffff', look.c1];

    let phase = 'sealed', gen = 0, next = 0, active = null, zoomed = null;
    const L = {};
    const wait = (ms) => new Promise(res => setTimeout(res, ms));

    // ---------- layout
    function layout() {
      const W = innerWidth, H = innerHeight;
      const pw = Math.round(Math.max(150, Math.min(270, W * 0.62, (H - 190) / 1.96)));
      Object.assign(L, { W, H, pw, ph: pw * 1.55, cw: Math.round(pw * 0.86) });
      L.ch = L.cw * 1.4;
      L.packY = Math.round(((56 + 0.41 * pw + L.ph / 2) + (H - 140 - L.ph / 2)) / 2 - H / 2);
      L.S = Math.min(0.3, 96 / L.ch);
      const trayH = L.ch * L.S + 24;   // the kept cards along the bottom
      L.R = Math.max(0.6, Math.min(1.35, (H - 150 - trayH - 16) / L.ch, (W - 24) / L.cw));
      L.cy = Math.round((150 + H - trayH - 8) / 2 - H / 2);
      root.style.setProperty('--trayh', Math.round(trayH) + 'px');
      root.style.setProperty('--pw', pw + 'px'); root.style.setProperty('--cw', L.cw + 'px');
      root.style.setProperty('--ry', `${H / 2 + L.cy}px`);
      fx.resize();
    }
    layout();
    const trayT = (k) => {
      const kept = cards.filter(c => c.place === 'tray');
      const i = kept.indexOf(k), m = kept.length;
      const x = (i - (m - 1) / 2) * (L.cw * L.S + 10), y = L.H / 2 - (L.ch * L.S) / 2 - 12;
      return `translate(${x}px, ${y}px) rotate(${k.rz || 0}deg) scale(${L.S})`;
    };
    const centerT = (s = 1, dy = 0) => `translate(0px, ${L.cy + dy}px) scale(${L.R * s})`;
    function gridT(i) {
      const top = 150, bottom = 92, aw = L.W - 24, ah = L.H - top - bottom;
      let g = null;
      for (let cols = 1; cols <= n; cols++) {
        const rows = Math.ceil(n / cols);
        const s = Math.min(1.05, (aw - (cols - 1) * 14) / (cols * L.cw), (ah - (rows - 1) * 14) / (rows * L.ch));
        if (!g || s > g.s) g = { cols, rows, s };
      }
      const row = Math.floor(i / g.cols), col = i % g.cols, inRow = Math.min(g.cols, n - row * g.cols);
      const x = (col - (inRow - 1) / 2) * (L.cw * g.s + 14);
      const y = top + ah / 2 - L.H / 2 + (row - (g.rows - 1) / 2) * (L.ch * g.s + 14);
      return `translate(${x}px, ${y}px) scale(${g.s})`;
    }
    const packT = () => phase === 'summary' ? `translate(0px, ${L.H}px) rotate(14deg)` : (active && phase !== 'pull') ? `translate(0px, ${L.H * 0.95}px)` : `translate(0px, ${L.packY}px)`;
    function place(c) {
      if (!c.el) return;
      c.el.style.transform = c.place === 'tray' ? trayT(c) : c.place === 'grid' ? gridT(cards.indexOf(c)) : c.place === 'zoom' ? centerT() : centerT();
    }
    function relayout() {
      layout();
      packPos.style.transform = packT();
      for (const c of cards) if (c.el) { c.el.getAnimations().forEach(a => a.cancel()); place(c); }
    }
    packPos.style.transform = packT();

    // Animate from wherever an element visually is now to a new transform.
    function moveTo(el, to, opts, mid) {
      const from = getComputedStyle(el).transform;
      el.getAnimations().forEach(a => a.cancel());
      el.style.transform = to;
      const frames = [{ transform: from === 'none' ? 'none' : from }, ...(mid ? [mid] : []), { transform: to }];
      return el.animate(frames, { easing: 'cubic-bezier(.2,.9,.3,1)', ...opts }).finished.catch(() => {});
    }

    // ---------- celebration pieces
    function setHint(text, low = false) { hint.textContent = text || ''; hint.classList.toggle('on', !!text); hint.classList.toggle('low', low); }
    function flash(t, color) {
      if (reduced() && t < 3) return;
      flashEl.style.background = t >= 3 ? `radial-gradient(circle, #fff 0%, #fff 35%, ${color} 100%)` : '#fff';
      flashEl.animate([{ opacity: 0 }, { opacity: [0.45, 0.55, 0.7, 0.95, 1][t], offset: 0.12 }, { opacity: 0 }], { duration: 600 + t * 180, easing: 'ease-out' });
    }
    function shake(t) {
      if (reduced()) return;
      const amp = [0.6, 1, 1.7, 2.8, 3.8][t], frames = [];
      for (let i = 0; i < 12; i++) frames.push({ transform: `translate(${rnd(-4, 4) * amp}px, ${rnd(-4, 4) * amp}px) rotate(${rnd(-0.4, 0.4) * amp}deg)` });
      frames.push({ transform: 'none' });
      stage.animate(frames, { duration: [260, 360, 520, 850, 1200][t], easing: 'ease-out' });
    }
    function showBanner(text, sub, color, big) {
      banner.hidden = false; banner.style.setProperty('--bc', color); banner.classList.toggle('big', !!big);
      // Long lines shrink to fit the screen (Rajdhani + letter-spacing ~0.62em per character).
      banner.querySelector('.t').style.fontSize = `min(${big ? 'clamp(36px, 10vw, 96px)' : 'clamp(30px, 7.5vw, 72px)'}, ${Math.floor((L.W - 24) / ([...text].length * 0.62))}px)`;
      banner.querySelector('.t').innerHTML = [...text].map((ch, i) => `<span style="animation-delay:${i * 38}ms">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('');
      banner.querySelector('.s').textContent = sub || '';
      banner.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, fill: 'forwards' });
    }
    function hideBanner() { banner.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }).finished.then(() => { if (phase === 'keeping' || phase === 'pull') banner.hidden = true; }); }
    function setRays(op, color, t4) { rays.style.setProperty('--rc', color); rays.classList.toggle('t4', !!t4); rays.style.opacity = op; }
    function setDim(op) { dimEl.style.opacity = op; }
    function celebrate(c, myGen) {
      const t = c.tier, col = c.color;
      const colors = t >= 4 ? ['#ff4f6d', '#ffb02e', '#ffe14d', '#3dffb5', '#4fa3ff', '#b26bff', '#ffffff', col]
        : [col, col, '#ffffff', '#ffd34d', ...packColors];
      const cx = L.W / 2, cy = L.H / 2 + L.cy;
      flash(t, col); shake(t);
      fx.burst(cx, cy, [90, 130, 170, 230, 300][t], colors, [10, 12, 14, 16, 18][t]);
      fx.burst(cx, cy, [30, 50, 80, 120, 170][t], [col, '#ffffff'], [7, 8, 10, 12, 14][t], 'spark');
      fx.cannon(true, [55, 80, 110, 150, 200][t], colors); fx.cannon(false, [55, 80, 110, 150, 200][t], colors);
      setRays([0.18, 0.3, 0.5, 0.75, 0.9][t], col, t >= 4);
      const rockets = [0, 0, 2, 6, 11][t], span = [0, 0, 1200, 2800, 4600][t];
      for (let i = 0; i < rockets; i++) setTimeout(() => { if (gen === myGen) fx.rocket(rnd(L.W * 0.12, L.W * 0.88), rnd(L.H * 0.12, L.H * 0.45), colors); }, rnd(150, span));
      if (t >= 3) {
        for (let k = 0; k < (t >= 4 ? 8 : 5); k++) setTimeout(() => { if (gen !== myGen) return; for (let i = 0; i < 22; i++) fx.coin(rnd(0, L.W), rnd(-140, -10)); snd.coin(); }, k * 260);
        for (let k = 0; k < (t >= 4 ? 10 : 6); k++) setTimeout(() => { if (gen === myGen) fx.rain(30, colors); }, k * 200);
        setTimeout(() => { if (gen === myGen) { flash(Math.min(t, 3), col); fx.cannon(true, 120, colors, 1.1); fx.cannon(false, 120, colors, 1.1); } }, t >= 4 ? 900 : 1300);
      }
      if (t >= 4) setTimeout(() => { if (gen === myGen) { flash(4, col); shake(3); fx.burst(cx, cy, 260, colors, 19); } }, 1900);
    }

    // ---------- card elements
    function makeCard(c) {
      const idx = cards.indexOf(c);
      const el = document.createElement('div');
      el.className = `pc t${c.tier}${c.cyborg ? ' cyborg' : ''}${c.rare ? ' rare' : ''}`;
      el.style.setProperty('--rc', c.color);
      el.innerHTML = `<div class="pc-sh"><div class="pc-in">${frontHTML(c, idx, n, pack.name)}${BACK}</div></div>`;
      stage.append(el);
      c.el = el; c.inner = el.querySelector('.pc-in'); c.sh = el.querySelector('.pc-sh'); c.front = el.querySelector('.pc-front');
      c.rz = rnd(-5, 5);
      return el;
    }
    const flipUp = (c, ms = 650) => {
      c.up = true;
      c.inner.getAnimations().forEach(a => a.cancel());
      c.inner.style.transform = 'rotateY(0deg)';
      return c.inner.animate([{ transform: 'rotateY(180deg)' }, { transform: 'rotateY(-20deg)', offset: 0.7 }, { transform: 'rotateY(0deg)' }],
        { duration: ms, easing: 'cubic-bezier(.3,.9,.4,1)' }).finished.catch(() => {});
    };

    // ---------- tearing
    let tear = null, tearP = 0, tearDir = 0;
    function drawTear() {
      const x = (tearDir > 0 ? tearP : 1 - tearP) * 100;
      attach.style.clipPath = tearDir > 0 ? `inset(0 0 0 ${x}%)` : `inset(0 ${100 - x}% 0 0)`;
      flap.style.clipPath = tearDir > 0 ? `inset(0 ${100 - x}% 0 0)` : `inset(0 0 0 ${x}%)`;
      flap.style.transformOrigin = `${x}% 15%`;
      flap.style.transform = `rotate(${(6 + tearP * 30) * (tearDir > 0 ? 1 : -1)}deg) translateY(${-tearP * 6}px)`;
    }
    async function completeTear() {
      if (phase !== 'sealed') return;
      phase = 'opening'; tear = null; const myGen = gen;
      $('.pko-rip').hidden = true; setHint('');
      snd.rip();
      attach.style.display = 'none'; flap.style.clipPath = 'none';
      const dir = tearDir || 1;
      moveTo(flap, `translate(${dir * L.W * 0.7}px, ${-L.ph * 0.9}px) rotate(${dir * 140}deg)`, { duration: 900, easing: 'cubic-bezier(.2,.6,.4,1)' });
      flap.animate([{ opacity: 1 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }], { duration: 900, fill: 'forwards' });
      const pr = pk.getBoundingClientRect();
      for (let i = 0; i < 40; i++) fx.conf(pr.left + rnd(0, pr.width), pr.top + pr.height * 0.15, rnd(-3, 3), rnd(-7, -1), packColors, 0.55);
      pk.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.06) rotate(-2deg)' }, { transform: 'scale(.98) rotate(1deg)' }, { transform: 'scale(1)' }], { duration: 420 });
      pk.style.setProperty('--gc', TIER_COLOR[best]);
      pk.classList.add('glowing', `best${best}`);
      if (best >= 3) fx.implode(pr.left + pr.width / 2, pr.top + pr.height * 0.15, 60, [TIER_COLOR[best], '#fff']);
      await wait(380); if (gen !== myGen) return;
      pk.classList.add('open'); snd.whoosh();
      await wait(650); if (gen !== myGen) return;
      phase = 'pull'; promptPull();
    }
    async function ripIt() {
      if (phase !== 'sealed') return;
      snd.unlock(); tearDir = tearDir || 1; tear = null;
      const p0 = tearP, t0 = performance.now(), myGen = gen;
      while (tearP < 1) {
        await new Promise(requestAnimationFrame); if (gen !== myGen || phase !== 'sealed') return;
        tearP = Math.min(1, p0 + (performance.now() - t0) / 420 * (1 - p0)); drawTear(); snd.tearBit();
      }
      completeTear();
    }
    const promptPull = () => setHint(`Pull a card out: drag it up, or tap the pack (${n - next} left)`);

    // ---------- pulling a card
    let pull = null;
    const topStub = () => stubs[stubs.length - 1 - next];
    async function doPull() {
      if (phase !== 'pull') return;
      const c = cards[next], stub = topStub();
      phase = 'reveal'; pull = null; const myGen = gen; setHint('');
      snd.whoosh();
      stub.style.transition = 'transform .18s ease-in';
      stub.style.transform = `translateY(${-L.ch * 0.95}px) rotate(${rnd(-4, 4)}deg)`;
      await wait(170); if (gen !== myGen) return;
      const sr = stub.getBoundingClientRect();
      stub.remove(); next++;
      makeCard(c); active = c; c.place = 'center';
      const sx = sr.left + sr.width / 2 - L.W / 2, sy = sr.top + sr.height / 2 - L.H / 2;
      c.el.style.transform = `translate(${sx}px, ${sy}px) scale(${sr.width / L.cw})`;
      packPos.style.transform = packT();
      await moveTo(c.el, centerT(), { duration: 620 }, { transform: `translate(0px, ${L.cy - 50}px) scale(${L.R * 1.06}) rotate(${rnd(-6, 6)}deg)`, offset: 0.65 });
      if (gen !== myGen) return;
      reveal(c, myGen);
    }
    async function reveal(c, myGen) {
      const t = c.tier;
      const build = [120, 380, 1050, 1750, 2600][t];
      setDim([0.1, 0.25, 0.5, 0.75, 0.88][t]);
      if (t >= 2) setRays([0, 0, 0.12, 0.2, 0.25][t], c.color, false);
      snd.build(build, t);
      c.el.classList.add('charge');
      const t0 = performance.now(), cx = L.W / 2, cy = L.H / 2 + L.cy;
      if (t >= 3) moveTo(c.el, centerT(1.06, -18), { duration: build, easing: 'ease-in-out' });
      while (performance.now() - t0 < build) {
        const k = (performance.now() - t0) / build;
        c.el.style.setProperty('--amp', (0.3 + k * (1 + t)).toFixed(2));
        if (t >= 1 && Math.random() < 0.25 + t * 0.12) fx.implode(cx, cy, 2 + t * 2, [c.color, '#ffffff']);
        await wait(60); if (gen !== myGen) return;
      }
      c.el.classList.remove('charge');
      snd.snap();
      flipUp(c);
      if (t >= 3) moveTo(c.el, centerT(), { duration: 500 }, { transform: centerT(1.18, -10), offset: 0.3 });
      else c.el.animate([{ scale: '1' }, { scale: '1.12' }, { scale: '1' }], { duration: 420 });
      await wait(200); if (gen !== myGen) return;
      c.el.classList.add('revealed');
      const [text, sub] = bannerFor(c);
      showBanner(text, sub, c.color, t >= 3);
      snd.fanfare(t);
      celebrate(c, myGen);
      await wait(550 + t * 200); if (gen !== myGen) return;
      phase = 'admire';
      setHint(next < n ? 'Tap to keep it' : 'Tap to keep it: that was the last one!', true);
    }
    async function keepActive() {
      const c = active; if (!c || phase !== 'admire') return;
      phase = 'keeping'; const myGen = gen; active = null;
      snd.keep(); setHint(''); hideBanner(); setRays(0, c.color); setDim(0);
      c.place = 'tray';
      for (const k of cards) if (k.place === 'tray' && k !== c) moveTo(k.el, trayT(k), { duration: 350 });
      moveTo(c.inner, 'rotateY(0deg)', { duration: 300 });
      c.front.style.removeProperty('--mx'); c.front.style.removeProperty('--my');
      await moveTo(c.el, trayT(c), { duration: 520, easing: 'cubic-bezier(.5,0,.3,1)' });
      if (gen !== myGen) return;
      if (next < n) { phase = 'pull'; packPos.style.transform = packT(); promptPull(); }
      else summary();
    }

    // ---------- summary
    async function summary(fromSkip = false) {
      gen++; const myGen = gen;
      phase = 'summary'; active = null; tear = null; pull = null;
      $('.pko-rip').hidden = true; setHint(''); setDim(0.15);
      for (const c of cards) c.el?.classList.remove('charge');
      if (fromSkip) { fx.clear(); attach.style.display = 'none'; flap.style.display = 'none'; }
      packPos.style.transform = packT();
      packPos.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 600, fill: 'forwards', delay: 200 });
      setRays(0.22, TIER_COLOR[best], best >= 4);
      const top = cards.reduce((a, c) => c.tier > a.tier ? c : a, cards[0]);
      showBanner('PACK HAUL!', `${n} card${n === 1 ? '' : 's'} · everything is already in your Barracks and Armory`, top?.color || '#fff', false);
      for (const [i, c] of cards.entries()) {
        if (!c.el) {
          makeCard(c);
          const pr = packPos.getBoundingClientRect();
          c.el.style.transform = `translate(0px, ${pr.top + pr.height * 0.4 - L.H / 2}px) scale(1)`;
        }
        c.place = 'grid';
        setTimeout(() => {
          if (gen !== myGen) return;
          moveTo(c.el, gridT(i), { duration: 650 }, { transform: `${gridT(i)} translateY(-40px)`, offset: 0.6 });
          if (!c.up) { flipUp(c, 700); c.el.classList.add('revealed'); }
          const cr = { x: L.W / 2, y: L.H / 2 };
          fx.burst(cr.x + rnd(-120, 120), cr.y + rnd(-60, 60), 40 + c.tier * 20, [c.color, '#fff', '#ffd34d'], 9);
          snd.snap();
        }, 120 + i * 140);
      }
      setTimeout(() => { if (gen === myGen) { snd.fanfare(Math.min(best, 2)); fx.cannon(true, 90, [TIER_COLOR[best], '#fff', ...packColors]); fx.cannon(false, 90, [TIER_COLOR[best], '#fff', ...packColors]); } }, 160 + n * 140);
      $('.pko-skip').textContent = 'Close ✕';
      const done = $('.pko-done'); done.hidden = false;
      setTimeout(() => done.focus(), 300);
    }
    function close() {
      gen++; fx.stop(); cancelAnimationFrame(tiltRaf);
      removeEventListener('resize', relayout); removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' }).finished.then(() => root.remove());
      resolve();
    }
    function toggleZoom(c) {
      if (zoomed === c) { zoomed = null; c.place = 'grid'; c.el.style.zIndex = ''; c.el.classList.remove('zoomed'); stage.classList.remove('zooming'); moveTo(c.el, gridT(cards.indexOf(c)), { duration: 420 }); moveTo(c.inner, 'rotateY(0deg)', { duration: 300 }); setDim(0.15); return; }
      if (zoomed) toggleZoom(zoomed);
      zoomed = c; c.place = 'zoom'; c.el.style.zIndex = 6; c.el.classList.add('zoomed'); stage.classList.add('zooming'); setDim(0.6); snd.whoosh();
      moveTo(c.el, centerT(), { duration: 480 });
    }

    // ---------- holo tilt for the card being admired
    let tiltRaf = 0, ptr = null, tx = 0, ty = 0;
    function tiltLoop(now) {
      tiltRaf = requestAnimationFrame(tiltLoop);
      const c = phase === 'admire' ? active : (phase === 'summary' ? zoomed : null);
      if (!c || !c.up || c.inner.getAnimations().some(a => a.playState === 'running')) return;
      let wx, wy;
      if (ptr && now - ptr.t < 1800) {
        const w = L.cw * L.R, h = L.ch * L.R;
        wy = Math.max(-24, Math.min(24, (ptr.x - L.W / 2) / w * 40));
        wx = Math.max(-18, Math.min(18, -(ptr.y - (L.H / 2 + L.cy)) / h * 32));
      } else { wy = Math.sin(now / 900) * 12; wx = Math.cos(now / 1300) * 6; }
      tx += (wx - tx) * 0.12; ty += (wy - ty) * 0.12;
      c.inner.style.transform = `rotateX(${tx.toFixed(2)}deg) rotateY(${ty.toFixed(2)}deg)`;
      c.front.style.setProperty('--mx', (50 + ty * 2.2).toFixed(1) + '%');
      c.front.style.setProperty('--my', (50 - tx * 2.6).toFixed(1) + '%');
    }
    tiltRaf = requestAnimationFrame(tiltLoop);

    // ---------- input
    const isUI = (t) => t.closest('button');
    root.addEventListener('pointerdown', (e) => {
      snd.unlock();
      if (isUI(e.target)) return;
      if (phase === 'sealed') {
        const r = pk.getBoundingClientRect();
        const onPack = e.clientX > r.left - 30 && e.clientX < r.right + 30 && e.clientY > r.top - 40 && e.clientY < r.bottom;
        if (!onPack) return;
        snd.crinkle(1);
        if (e.clientY > r.top + r.height * 0.45) {   // squeezing the pack body: just a wobble
          pk.animate([{ transform: pk.style.transform || 'none' }, { transform: `${pk.style.transform || ''} scale(.97, 1.02)` }, { transform: pk.style.transform || 'none' }], { duration: 260 });
          return;
        }
        tear = { id: e.pointerId, x0: e.clientX, p0: tearP, w: r.width };
        root.setPointerCapture?.(e.pointerId);
      } else if (phase === 'pull') {
        pull = { id: e.pointerId, y0: e.clientY, x0: e.clientX, dy: 0, stub: topStub() };
        pull.stub.style.transition = 'none';
        root.setPointerCapture?.(e.pointerId);
      }
    });
    root.addEventListener('pointermove', (e) => {
      ptr = { x: e.clientX, y: e.clientY, t: performance.now() };
      if ((phase === 'sealed' || phase === 'pull') && !reduced()) {
        const rx = (e.clientY - L.H / 2) / L.H * -16, ry = (e.clientX - L.W / 2) / L.W * 22;
        pk.style.transform = `rotateX(${rx.toFixed(1)}deg) rotateY(${ry.toFixed(1)}deg)`;
      }
      if (tear && e.pointerId === tear.id && phase === 'sealed') {
        const dx = e.clientX - tear.x0;
        if (!tearDir && Math.abs(dx) > 8) tearDir = Math.sign(dx);
        if (tearDir) {
          const p = Math.min(1, Math.max(tearP, tear.p0 + (dx * tearDir) / (tear.w * 0.8)));
          if (p > tearP + 0.004) {
            tearP = p; drawTear(); snd.tearBit();
            const r = pk.getBoundingClientRect();
            for (let i = 0; i < 3; i++) fx.conf(e.clientX, r.top + r.height * 0.15, rnd(-2, 2), rnd(-4, 0), packColors, 0.4);
          }
          if (tearP >= 1) completeTear();
        }
      } else if (pull && e.pointerId === pull.id && phase === 'pull') {
        pull.dy = Math.max(0, pull.y0 - e.clientY);
        pull.moved = pull.moved || Math.hypot(e.clientX - pull.x0, e.clientY - pull.y0) > 6;
        pull.stub.style.transform = `translateY(${-pull.dy}px)`;
        if (pull.dy > 4) snd.crinkle(0.4);
        if (pull.dy > L.ch * 0.22) doPull();
      }
    });
    const endPtr = (e) => {
      if (tear && e.pointerId === tear.id) tear = null;
      if (pull && e.pointerId === pull.id && phase === 'pull') {
        const p = pull; pull = null;
        if (!p.moved || p.dy > L.ch * 0.15) doPull();
        else { p.stub.style.transition = ''; p.stub.style.transform = ''; }
      }
    };
    root.addEventListener('pointerup', endPtr);
    root.addEventListener('pointercancel', endPtr);
    root.addEventListener('click', (e) => {
      if (isUI(e.target)) return;
      if (phase === 'admire') keepActive();
      else if (phase === 'summary') { const el = e.target.closest('.pc'); const c = cards.find(k => k.el === el); if (c) toggleZoom(c); else if (zoomed) toggleZoom(zoomed); }
    });
    $('.pko-rip').onclick = ripIt;
    $('.pko-skip').onclick = () => { if (phase === 'summary') close(); else { $('.pko-skip').textContent = 'Close ✕'; summary(true); } };
    $('.pko-done').onclick = close;
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); $('.pko-skip').click(); }
      else if (e.key === 'Enter' || e.key === ' ') {
        if (phase === 'summary' && document.activeElement?.classList.contains('pko-done')) return;
        e.preventDefault();
        if (phase === 'sealed') ripIt(); else if (phase === 'pull') doPull(); else if (phase === 'admire') keepActive();
        else if (phase === 'summary') close();
      }
    }
    addEventListener('keydown', onKey, true);
    addEventListener('resize', relayout);

    // Entrance: the pack drops in with a spin.
    snd.crinkle(1);
    packPos.animate([{ transform: `translate(0px, ${-L.H}px) rotate(-25deg)` }, { transform: `translate(0px, ${L.packY + 20}px) rotate(4deg)`, offset: 0.7 }, { transform: packT() }], { duration: 750, easing: 'cubic-bezier(.3,1.2,.5,1)' });
    setTimeout(() => { if (phase === 'sealed') setHint('Drag (or swipe) across the top of the pack to tear it open ✂'); }, 500);
    setTimeout(() => { if (phase === 'sealed') fx.burst(L.W / 2, L.H / 2 + L.packY, 50, packColors, 9, 'spark'); }, 600);
  });
}
