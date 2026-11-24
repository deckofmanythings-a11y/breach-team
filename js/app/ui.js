// Small DOM helpers shared by the screens.
import { STATS, STAT_INFO } from '../data/stats.js';
import { ITEM_BY_ID, RARITY_BY_ID, AFFIX_BY_ID } from '../data/gear.js';
import { SPECIALTY_BY_ID } from '../data/specialties.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

let toastT = 0;
export function toast(msg) {
  const t = document.getElementById('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600);
}
export function modal(box) {
  const m = document.getElementById('modal'); m.innerHTML = ''; m.append(box); m.hidden = false;
  m.onclick = (e) => { if (e.target === m) closeModal(); };
}
export function closeModal() { const m = document.getElementById('modal'); m.hidden = true; m.innerHTML = ''; }

const ICON = { assault: 'AS', breacher: 'BR', marksman: 'MK', medic: 'MD', tech: 'TC', heavy: 'HV', infiltrator: 'IN' };
export function avatar(s, size = 44) {
  const [a, b] = s.colors || ['#456', '#fb0'];
  return `<div class="avatar" style="width:${size}px;height:${size}px;background:${a};border-color:${b}" title="${SPECIALTY_BY_ID[s.specialty]?.name || ''}">${ICON[s.specialty] || '?'}</div>`;
}
export function statGrid(st) {
  return `<div class="stats">${STATS.map(k => `<div title="${STAT_INFO[k].name}: ${STAT_INFO[k].desc}"><b>${st[k]}</b><span>${STAT_INFO[k].short}</span></div>`).join('')}</div>`;
}
export function itemLabel(it, plain = false) {
  const base = ITEM_BY_ID[it.base], r = RARITY_BY_ID[it.rarity];
  const aff = (it.affixes || []).map(a => AFFIX_BY_ID[a.id].name);
  const name = (aff.length ? aff.join(' ') + ' ' : '') + base.name;
  if (plain) return `${name} [${r.name}]`;
  return `<span class="rar-${it.rarity}"><b>${esc(name)}</b></span> <span class="small rar-${it.rarity}">${r.name}</span>`;
}
export function timeLeft(until) {
  const ms = Math.max(0, until - Date.now()); const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
  return ms <= 0 ? 'ready' : `${m}:${String(s).padStart(2, '0')}`;
}
