// Item icons: one silhouette per item type (weapon type, armour weight, utility and implant kind).
// 24x24 viewBox, drawn in currentColor. Specials share the icon of the kind of thing they are.
// New file (stale-cache rule).
import { ITEM_BY_ID } from '../data/gear.js';

const P = {
  // ---- weapons (by weapon type) ----
  pistol:  'M3 7h15v2h2v3h-7l-1 2h-2l-1 4H5l1.5-6H3z',
  smg:     'M2 8h16v-1h2v1h2v3h-6v1h-3l-1 2h-1l-.5 4H7.5l.5-4H6l-.5 2H3.5l.5-3H2z',
  carbine: 'M1 9h19v-1h2v3h-6l-2 1h-3l-1 3H8l.5-3H5l-2 3H1l1-3H1z',
  rifle:   'M1 9h22v2h-6l-1 1h-4l-1 3H9l.5-3H6l-3 3H1l1.5-3H1z M14 7h4v2h-4z',
  shotgun: 'M1 8.5h20V11h-4v1.5h-5l-1 3H8.5l.5-3H6l-3.5 3H1l2-3H1z M11 11h5v1h-5z',
  sniper:  'M1 10h23v1.5h-8l-1 1h-4l-1 3H8l.5-3H6l-3 3H1l1.5-3H1z M9 6.5h7v2.5H9z M8 7.5h1v1H8z',
  lmg:     'M1 8h21v3h-4v2h-6l-1 3H9l.5-3H6l-3 3H1l1-3H1z M13 13h4v4h-4z M19 11h2v4h-2z',
  flamer:  'M2 9h12v4H9l-1 4H6l.5-4H2z M14 10h3l1 1-1 1h-3z M18 9c2 0 3 1 3 2.5S20 14 18 13.5c1-.7 1-2.3 0-4.5z M5 6h5v3H5z',
  blade:   'M3 21l2-2-1-1 1.5-1.5 1 1L18 6l3-3-1 4L8.5 18.5l1 1L8 21l-1-1-2 2z',
  arc:     'M2 10h8l2-2h3v8h-3l-2-2H2z M16 7.5l5.5 1.5-3 2.5 4 1.5-6 3.5 2.5-3.5-3.5-1.5z',
  // ---- armour ----
  vest:    'M7 3l2 2h6l2-2 3 2-1 5 1 11H4l1-11-1-5z M10 9h4v2h-4z',
  armor:   'M6 3h4l2 2 2-2h4l3 4-2 4v10H5V11L3 7z M8 10h8v2H8z M8 14h8v2H8z',
  plate:   'M4 3h16l1 4-2 2v12H5V9L3 7z M7 6h10v4H7z M7 12h4v7H7z M13 12h4v7h-4z',
  cloak:   'M12 2c3 0 5 2 5 5l3 14c-3-1-5-1-8-1s-5 0-8 1L7 7c0-3 2-5 5-5z M9.5 7h5l-1 2h-3z',
  shield:  'M12 2l9 3v6c0 6-4 10-9 12-5-2-9-6-9-12V5z M12 5l-6 2v4c0 4 2.5 7 6 9z',
  // ---- utility ----
  medkit:  'M8 4h8v3h5v13H3V7h5z M10 6v1h4V6z M10.5 10h3v2.5H16v3h-2.5V18h-3v-2.5H8v-3h2.5z',
  frag:    'M10 3h4v2h2l1 2h-1.5A7 7 0 1 1 8.5 7H7l1-2h2z M12 10a1 1 0 0 0 0 2 1 1 0 0 0 0-2z',
  smoke:   'M9 12h6v9H9z M10 10h4v2h-4z M7 7a3 3 0 0 1 5-2 3.5 3.5 0 0 1 6 1.5A2.5 2.5 0 0 1 17 11H8a2 2 0 0 1-1-4z',
  hack:    'M3 5h18v11H3z M5 7v7h14V7z M2 17h20l-1 2H3z M7 9l2.5 1.5L7 12z M10 11.5h4v1h-4z',
  breach:  'M4 6h16v12H4z M6 8v8h12V8z M7 10h4v4H7z M13 9l4 3-4 3z',
  tracker: 'M5 3h14v18H5z M7 5v10h10V5z M12 14a5 5 0 0 1-4-2h8a5 5 0 0 1-4 2z M12 6l1 6h-2z M8 17h8v2H8z',
  cat:     'M5 4l3 4h8l3-4 1 7c0 5-3.5 9-8 9s-8-4-8-9z M9 12a1 1 0 0 0 0 2 1 1 0 0 0 0-2z M15 12a1 1 0 0 0 0 2 1 1 0 0 0 0-2z M11 16h2l-1 1z',
  pack:    'M8 3h8v3h3v15H5V6h3z M10 5v1h4V5z M8 11h8v2H8z',
  // ---- implants ----
  reflex:  'M13 2L5 13h6l-2 9 9-12h-6z',
  eye:     'M12 5c5 0 9 4 10 7-1 3-5 7-10 7S3 15 2 12c1-3 5-7 10-7z M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
  plating: 'M12 2l4 2.5v5L12 12 8 9.5v-5z M6 10.5l4 2.5v5L6 20.5 2 18v-5z M18 10.5l4 2.5v5l-4 2.5-4-2.5v-5z',
  pain:    'M12 21l-8-8a5 5 0 0 1 8-6 5 5 0 0 1 8 6z M7 11h3l1-2 2 4 1-2h3v1.5h-2l-2 3-2-4-.5 1H7z',
  neural:  'M12 3c4 0 7 3 7 6.5 0 2-1 3.5-2 4.5v4h-4v3h-2v-3H7v-4c-1-1-2-2.5-2-4.5C5 6 8 3 12 3z M9 8h2v2H9z M13 8h2v2h-2z M11 11h2v3h-2z',
  chip:    'M7 7h10v10H7z M9 9v6h6V9z M9 3h1.5v3H9z M13.5 3H15v3h-1.5z M9 18h1.5v3H9z M13.5 18H15v3h-1.5z M3 9h3v1.5H3z M3 13.5h3V15H3z M18 9h3v1.5h-3z M18 13.5h3V15h-3z',
  life:    'M4 3h16v18H4z M6 5v14h12V5z M8 11h2l1.5-3 2 6 1.5-3h1v1.5h-.5l-2 4-2-6-1 2H8z',
};
// Fallbacks for an unknown or empty slot.
const SLOT_ICON = { weapon: 'rifle', armor: 'armor', utility: 'pack', implant: 'chip' };
const BY_BASE = {
  armor_light: 'vest', armor_medium: 'armor', armor_heavy: 'plate', armor_stealth: 'cloak',
  white_armor: 'armor', loader_frame: 'plate', shield_belt: 'shield',
  medkit: 'medkit', frag_grenades: 'frag', smoke_grenades: 'smoke', hack_rig: 'hack', breach_kit: 'breach',
  motion_tracker: 'tracker', ships_cat: 'cat',
  reflex_booster: 'reflex', targeting_eye: 'eye', dermal_plating: 'plating', pain_editor: 'pain', neural_link: 'neural',
  combat_download: 'neural', precog_lens: 'eye', sarcophagus_chassis: 'life',
};
export function iconKey(base) {
  const b = typeof base === 'string' ? ITEM_BY_ID[base] : base;
  if (!b) return 'pack';
  if (b.slot === 'weapon' && P[b.type]) return b.type;
  return BY_BASE[b.id] || SLOT_ICON[b.slot] || 'pack';
}
// An <svg> string. `key` is an iconKey() result or a slot name (for empty slots).
export function iconSvg(key, size = 24) {
  const d = P[key] || P[SLOT_ICON[key]] || P.pack;
  return `<svg class="ico" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="${d}" fill="currentColor" fill-rule="evenodd"/></svg>`;
}
export const itemIcon = (it, size) => iconSvg(iconKey(it.base), size);
export const slotIcon = (slot, size) => iconSvg(SLOT_ICON[slot] || slot, size);
