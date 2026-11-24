// Soldier voice lines ("barks"): paraphrased movie homages from the easter-egg registry, said at
// fitting moments. Purely cosmetic and computed from the battle record with a seeded RNG, so a
// replay always says the same lines at the same moments.
import { createRng, hashString } from '../engine/rng.js';
import { EASTER_EGGS } from '../data/easter-eggs.js';
import { UNIT_BY_ID } from '../data/factions.js';
import { SHIP_BY_ID } from '../data/ships.js';

const BARK = Object.fromEntries(EASTER_EGGS.filter(e => e.kind === 'bark').map(e => [e.data.trigger, e]));

function isRed(hex) {
  const n = parseInt(String(hex || '').replace('#', ''), 16); if (Number.isNaN(n)) return false;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return r > 110 && r > g * 1.6 && r > b * 1.6;
}

// Returns [{ t, unit, text, egg }] sorted by time.
export function computeBarks(battle, input, colors) {
  const rng = createRng(hashString('barks:' + battle.seed));
  const out = [];
  const say = (t, unit, trigger, pct) => { const b = BARK[trigger]; if (b && unit !== undefined && rng.roll(pct)) out.push({ t, unit, text: b.data.text, egg: b.id }); };
  const squadUnits = battle.soldiers.map(s => s.unit);
  const squadIdx = Object.fromEntries(battle.soldiers.map((s, i) => [s.unit, i]));
  const units = Object.fromEntries(battle.units.map(u => [u.id, u]));
  const ship = SHIP_BY_ID[battle.ship];

  say(12, squadUnits[rng.int(squadUnits.length)], 'missionStart', 25);
  if (ship.dark) say(20, squadUnits[rng.int(squadUnits.length)], 'enterDarkRoom', 70);

  const down = new Set();
  let downToOneSaid = false, bledSaid = false, hazardSaid = false;
  for (const e of battle.events) {
    const [t, k] = e;
    if (k === 'down' && squadIdx[e[2]] !== undefined) {
      down.add(e[2]);
      const left = squadUnits.filter(u => !down.has(u));
      if (!downToOneSaid && squadUnits.length >= 3 && left.length === 1) { downToOneSaid = true; say(t + 4, left[0], 'squadDownToOne', 70); }
      if (isRed(colors?.[battle.soldiers[squadIdx[e[2]]].uid]?.[0]) && left.length) say(t + 6, left[rng.int(left.length)], 'redArmorDowned', 50);
    }
    if (k === 'revive' && e[4]) { down.delete(e[3]); say(t + 3, e[3], 'revived', 35); }
    if (k === 'shot' && !bledSaid && e[4] > 0 && squadIdx[e[2]] !== undefined && UNIT_BY_ID[units[e[3]]?.kind]?.tags.includes('leader')) {
      bledSaid = true; say(t + 2, e[2], 'woundedBigEnemy', 45);
    }
    if (k === 'hazard' && !hazardSaid && squadIdx[e[2]] !== undefined) {
      hazardSaid = true;
      const i = squadIdx[e[2]];
      if (input?.squad?.[i]?.gear?.utility?.base === 'hyper_towel') say(t + 2, e[2], 'hazardEnter', 100);
    }
  }
  return out.sort((a, b) => a.t - b.t);
}
