// Same input => same output, regardless of run order or JSON round-trips.
// Run: node test/determinism.mjs
import { simulate } from '../js/engine/battle.js';
import { rollAftermath } from '../js/engine/aftermath.js';
import { makeSquad } from './fixtures.mjs';
import { SHIPS } from '../js/data/ships.js';
import { ENTRIES, RETREATS } from '../js/data/entries.js';
import { TACTICS } from '../js/data/tactics.js';

const SPECS = ['assault', 'breacher', 'marksman', 'medic', 'tech', 'heavy', 'infiltrator'];
const cases = [];
let n = 0;
for (const ship of SHIPS) for (const entry of ENTRIES) for (const tactic of TACTICS) {
  const retreat = RETREATS[n % RETREATS.length];
  const specs = []; for (let i = 0; i < entry.maxSquad; i++) specs.push(SPECS[(n + i) % SPECS.length]);
  const level = 1 + (n % 10);
  cases.push({ seed: 1000 + n * 7919, ship: ship.id, entry: entry.id, tactic: tactic.id, retreat: retreat.id, squad: makeSquad(n, specs, level, 'milspec') });
  n++;
}

const run = (c) => { const b = simulate(c); const a = rollAftermath(b, c.squad); return b.hash + '|' + JSON.stringify(a); };
const first = cases.map(run);
const second = cases.slice().reverse().map(c => run(JSON.parse(JSON.stringify(c)))).reverse();
let bad = 0;
first.forEach((h, i) => { if (h !== second[i]) { bad++; console.error('MISMATCH case', i, cases[i].ship, cases[i].entry, cases[i].tactic); } });
const results = {}; for (const c of cases) { const r = simulate(c).result; results[r] = (results[r] || 0) + 1; }
console.log(`${cases.length} cases, ${bad} mismatches. Results:`, results);
process.exit(bad ? 1 : 0);
