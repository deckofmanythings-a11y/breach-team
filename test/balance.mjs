// Balance harness. Runs many missions per ship / entry / tactic and reports success rate,
// mission length, how often Soldiers go Down, deaths and BUCs.
// Run: node test/balance.mjs [samples=60] [ship]
import { simulate } from '../js/engine/battle.js';
import { rollAftermath } from '../js/engine/aftermath.js';
import { makeSquad } from './fixtures.mjs';
import { SHIPS } from '../js/data/ships.js';
import { ENTRIES } from '../js/data/entries.js';
import { TACTICS } from '../js/data/tactics.js';
import { TICKS_PER_SEC } from '../js/data/stats.js';

const N = +(process.argv[2] || 60);
const only = process.argv[3];

// The squad a player would realistically bring to each ship.
const PROFILE = {
  hauler:   { level: 1, rarity: 'standard', note: 'fresh starter squad' },
  raider:   { level: 5, rarity: 'milspec',  note: 'level 5, Mil-Spec' },
  corvette: { level: 9, rarity: 'prototype', note: 'level 9, Prototype' },
  fungal_derelict: { level: 5, rarity: 'milspec', note: 'level 5, Mil-Spec' },
  gravity_vessel:  { level: 5, rarity: 'milspec', note: 'level 5, Mil-Spec' },
  hive_ship:       { level: 9, rarity: 'prototype', note: 'level 9, Prototype' },
  crystal_spire:   { level: 9, rarity: 'prototype', note: 'level 9, Prototype' },
  void_hulk:       { level: 9, rarity: 'prototype', note: 'level 9, Prototype' },
  parasite_ship:   { level: 9, rarity: 'prototype', note: 'level 9, Prototype' },
};
const SQUADS = {
  3: ['infiltrator', 'assault', 'medic'],
  4: ['assault', 'breacher', 'marksman', 'medic'],
  6: ['assault', 'breacher', 'marksman', 'medic', 'heavy', 'tech'],
};
const pct = (a, b) => (b ? Math.round((a * 100) / b) : 0);
const pad = (s, n) => String(s).padEnd(n);

for (const ship of SHIPS) {
  if (only && !only.split(',').includes(ship.id)) continue;
  const prof = PROFILE[ship.id];
  console.log(`\n=== ${ship.name} (tier ${ship.tier}) — ${prof.note}, ${N} runs each ===`);
  console.log('entry        tactic          success  avg s   succ s  downed/run  KIA/run  left  BUCs');
  const tot = { s: 0, n: 0, kia: 0 };
  for (const entry of ENTRIES) for (const tactic of TACTICS) {
    let succ = 0, ticks = 0, sTicks = 0, downed = 0, kia = 0, left = 0, bucs = 0;
    for (let i = 0; i < N; i++) {
      const squad = makeSquad(i * 31 + 7, SQUADS[entry.maxSquad], prof.level, prof.rarity);
      const b = simulate({ engineVersion: 2, seed: 50000 + i * 7919, ship: ship.id, entry: entry.id, tactic: tactic.id, retreat: 'teleport_recall', squad });
      const a = rollAftermath(b, squad);
      if (b.result === 'success') { succ++; sTicks += b.ticks; }
      ticks += b.ticks; bucs += a.bucs;
      for (const s of b.soldiers) { if (s.downed) downed++; if (s.state === 'left') left++; }
      for (const s of a.soldiers) if (s.fate === 'kia') kia++;
    }
    tot.s += succ; tot.n += N; tot.kia += kia;
    console.log(`${pad(entry.id, 12)} ${pad(tactic.id, 15)} ${pad(pct(succ, N) + '%', 8)} ${pad((ticks / N / TICKS_PER_SEC).toFixed(0), 7)} ${pad(succ ? (sTicks / succ / TICKS_PER_SEC).toFixed(0) : '-', 7)} ${pad((downed / N).toFixed(2), 11)} ${pad((kia / N).toFixed(2), 8)} ${pad(left, 5)} ${Math.round(bucs / N)}`);
  }
  console.log(`overall success ${pct(tot.s, tot.n)}%, KIA per mission ${(tot.kia / tot.n).toFixed(2)}`);
}
