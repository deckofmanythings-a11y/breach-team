// Proves each alien ship's signature mechanic actually happens. Run: node test/aliens.mjs [samples=30]
import { simulate } from '../js/engine/battle.js';
import { makeSquad } from './fixtures.mjs';
const N = +(process.argv[2] || 30);
const CHECK = {
  hive_ship: ['hatch', 'acid'], fungal_derelict: ['confused', 'spores'], crystal_spire: ['ricochet'],
  void_hulk: [], gravity_vessel: ['gravity'], parasite_ship: ['possessed'],
  secret_horseshoe: ['hatch'], secret_gravity_drive: ['gravity', 'log'], secret_bug_carrier: ['acid'],
};
let fail = 0;
for (const [ship, kinds] of Object.entries(CHECK)) {
  const counts = {}; let wins = 0;
  for (let i = 0; i < N; i++) {
    const b = simulate({ engineVersion: 2, seed: 4242 + i * 7919, ship, entry: 'shuttle', tactic: 'balanced', retreat: 'shuttle', squad: makeSquad(i, ['assault', 'breacher', 'marksman', 'medic', 'heavy', 'tech'], 9, 'prototype') });
    for (const e of b.events) counts[e[1]] = (counts[e[1]] || 0) + 1;
    if (b.result === 'success') wins++;
  }
  const miss = kinds.filter(k => !counts[k]);
  if (miss.length) fail++;
  console.log(`${miss.length ? 'FAIL' : 'OK  '} ${ship.padEnd(22)} wins ${wins}/${N}  ` + kinds.map(k => `${k}:${counts[k] || 0}`).join(' ') + (counts.freed ? ` freed:${counts.freed}` : '') + (counts.friendlyfire ? ` friendlyfire:${counts.friendlyfire}` : ''));
}
process.exit(fail ? 1 : 0);
