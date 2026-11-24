// Item tooltips: what an item and each of its affixes actually do.
// Hover (mouse) or long-press (touch) anything with a data-tip attribute; itemLabel() adds one.
import { ITEM_BY_ID, RARITY_BY_ID, AFFIX_BY_ID, WEAPON_TYPES } from '../data/gear.js';
import { itemMods, weaponProfile } from '../engine/progression.js';

const S = (v) => (v > 0 ? '+' : '') + v;
// One readable line per modifier key.
const WORDS = {
  hp: v => `${S(v)} HP`, aim: v => `${S(v)} Aim`, arm: v => `${S(v)} Armor`, spd: v => `${S(v)} Speed`, grit: v => `${S(v)} Grit`,
  tech: v => `${S(v)} Tech`, stl: v => `${S(v)} Stealth`,
  hpPct: v => `${S(v)}% HP`, aimPct: v => `${S(v)}% Aim`, armPct: v => `${S(v)}% Armor`, spdPct: v => `${S(v)}% Speed`,
  gritPct: v => `${S(v)}% Grit`, techPct: v => `${S(v)}% Tech`, stlPct: v => `${S(v)}% Stealth`,
  dmgPct: v => `${S(v)}% damage dealt`, critPct: v => `${S(v)}% critical hit chance`, critDmgPct: v => `${S(v)}% critical hit damage`,
  pierce: v => `ignores ${v} of the target's armor`, rangeAdd: v => `${S(v)} weapon range (tiles)`, rofPct: v => `${S(v)}% fire rate`,
  suppressPct: v => `${S(v)}% suppression`, dmgTakenPct: v => `${v < 0 ? `takes ${-v}% less` : `takes ${v}% more`} damage`,
  evasion: v => `${S(v)} evasion`, coverPct: v => `${S(v)}% cover bonus`, healPct: v => `${S(v)}% healing done`,
  reviveChance: v => `${S(v)}% revive chance`, hackSpeedPct: v => `${S(v)}% hacking speed`, breachSpeedPct: v => `${S(v)}% breaching speed`,
  detectPct: v => `${S(v)}% detection`, abilityCdPct: v => `${v < 0 ? `${-v}% shorter` : `${v}% longer`} ability cooldowns`,
  moralePct: v => `${S(v)}% squad morale`, hazardResistPct: v => `${S(v)}% hazard resistance`,
  survivalPct: v => `${v}% less likely to die when Downed`, healTimePct: v => `${v < 0 ? `heals ${-v}% faster` : `heals ${v}% slower`}`,
  xpPct: v => `${S(v)}% XP`,
};
const VS = { synthetic: 'synthetics (robots, drones, turrets)', xeno: 'aliens', leader: 'leaders', human: 'humans' };
function modLines(mods) {
  const out = [];
  for (const [k, v] of Object.entries(mods || {})) {
    if (k === 'dmgVs') { for (const [tag, n] of Object.entries(v)) out.push(`${S(n)}% damage vs ${VS[tag] || tag}`); continue; }
    if (!v) continue;
    out.push(WORDS[k] ? WORDS[k](v) : `${k} ${S(v)}`);
  }
  return out;
}
function affixLine(a) {
  const af = AFFIX_BY_ID[a.id]; if (!af) return '';
  const v = af.values[a.tier];
  return `${af.name}: ${af.key === 'dmgVs' ? `+${v}% damage vs ${VS[af.vs] || af.vs}` : WORDS[af.key] ? WORDS[af.key](v) : `${af.key} +${v}`}`;
}

// Plain multi-line text for an item instance.
export function itemTipText(it) {
  const base = ITEM_BY_ID[it.base]; if (!base) return '';
  const r = RARITY_BY_ID[it.rarity];
  const lines = [`${base.name} · ${r?.name || it.rarity}${base.type ? ` · ${base.type}` : ''}`];
  if (base.slot === 'weapon' && WEAPON_TYPES[base.type]) {
    const w = weaponProfile(it);
    lines.push(`Damage ${w.dmg[0]}–${w.dmg[1]} · range ${w.range}`);
  }
  // Base effects (rarity-scaled), without the affixes.
  const own = modLines(itemMods({ ...it, affixes: [] }));
  if (own.length) lines.push(...own.map(l => '• ' + l));
  if (it.affixes?.length) { lines.push('Affixes:'); for (const a of it.affixes) lines.push('• ' + affixLine(a)); }
  if (base.flavor) lines.push(`“${base.flavor}”`);
  return lines.join('\n');
}
export function affixSummary(it) { return (it.affixes || []).map(affixLine).join(' · '); }

// ---------- the floating tooltip ----------
let tip = null, pressTimer = 0, pressedOn = null;
function show(target, x, y) {
  const text = target.getAttribute('data-tip'); if (!text) return;
  if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; document.body.append(tip); }
  tip.textContent = text; tip.hidden = false;
  const r = tip.getBoundingClientRect(), pad = 12;
  let left = x + pad, top = y + pad;
  if (left + r.width > innerWidth - 8) left = Math.max(8, x - r.width - pad);
  if (top + r.height > innerHeight - 8) top = Math.max(8, y - r.height - pad);
  tip.style.left = left + 'px'; tip.style.top = top + 'px';
}
const hide = () => { if (tip) tip.hidden = true; };
if (typeof document !== 'undefined') {
  document.addEventListener('mouseover', (e) => { const t = e.target.closest?.('[data-tip]'); if (t) show(t, e.clientX, e.clientY); else hide(); });
  document.addEventListener('mousemove', (e) => { if (tip && !tip.hidden && e.target.closest?.('[data-tip]')) show(e.target.closest('[data-tip]'), e.clientX, e.clientY); });
  // Touch: long-press (450 ms) shows it; any other touch hides it.
  document.addEventListener('touchstart', (e) => {
    hide(); clearTimeout(pressTimer);
    const t = e.target.closest?.('[data-tip]'); if (!t) return;
    const p = e.touches[0]; pressedOn = t;
    pressTimer = setTimeout(() => { show(t, p.clientX, p.clientY - 40); pressedOn = 'shown'; }, 450);
  }, { passive: true });
  document.addEventListener('touchmove', () => clearTimeout(pressTimer), { passive: true });
  document.addEventListener('touchend', (e) => { clearTimeout(pressTimer); if (pressedOn === 'shown') { e.preventDefault(); setTimeout(hide, 2500); } pressedOn = null; });
  document.addEventListener('contextmenu', (e) => { if (e.target.closest?.('[data-tip]')) e.preventDefault(); });
  addEventListener('scroll', hide, true);
}
