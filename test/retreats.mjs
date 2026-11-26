// Compares the four retreat plans on failed missions: who gets out, who's left, who dies.
// Run: node test/retreats.mjs [samples=150]
import { simulate } from '../js/engine/battle.js';
import { rollAftermath } from '../js/engine/aftermath.js';
import { makeSquad, STARTER } from './fixtures.mjs';
import { RETREATS } from '../js/data/entries.js';

const N = +(process.argv[2] || 150);
const TACTIC = process.argv[3] || 'balanced';
console.log('tactic: ' + TACTIC);
console.log('ship      retreat          fails  out/fail  left/fail  mia/fail  KIA/fail  avg retreat s');
for (const ship of ['hauler', 'raider', 'corvette']) for (const r of RETREATS.filter(x => !x.noRetreat)) {
  let fails = 0, out = 0, left = 0, mia = 0, kia = 0, rt = 0;
  for (let i = 0; i < N; i++) {
    const level = { hauler: 1, raider: 5, corvette: 9 }[ship];
    const squad = makeSquad(i * 13 + 1, STARTER, level, level > 1 ? 'milspec' : 'standard');
    const b = simulate({ seed: 90000 + i * 104729, ship, entry: 'breach_pod', tactic: TACTIC, retreat: r.id, squad });
    if (b.result === 'success') continue;
    fails++; rt += b.ticks - b.retreatAt;
    const a = rollAftermath(b, squad);
    for (const s of b.soldiers) { if (s.state === 'left') left++; else if (s.state === 'mia') mia++; else out++; }
    for (const s of a.soldiers) if (s.fate === 'kia') kia++;
  }
  const f = (x) => (fails ? (x / fails).toFixed(2) : '-');
  console.log(`${ship.padEnd(9)} ${r.id.padEnd(16)} ${String(fails).padEnd(6)} ${f(out).padEnd(9)} ${f(left).padEnd(10)} ${f(mia).padEnd(9)} ${f(kia).padEnd(9)} ${fails ? (rt / fails / 8).toFixed(1) : '-'}`);
}
