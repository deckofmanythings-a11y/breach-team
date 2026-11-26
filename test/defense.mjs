// Mothership defense battles (engine v5, input.mode = 'defend'). Run: node test/defense.mjs [N]
import { simulate } from '../js/engine/battle.js';
import { makeSquad } from './fixtures.mjs';
import { THREATS, DEFENSE } from '../js/data/threats.js';
import { UNIT_BY_ID } from '../js/data/factions.js';
import { stationKey } from '../js/engine/defense-setup.js';

let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.error('FAIL', msg); } };
const throws = (fn, msg) => { let t = false; try { fn(); } catch { t = true; } ok(t, msg); };
const N = +(process.argv[2] || 20);
const SPECS = ['assault', 'breacher', 'marksman', 'medic', 'heavy', 'tech'];
const MAXED = { med_bay: 3, training_deck: 3, armory: 3, teleporter: 3, chapel: 3, hangar: 3, security: 3 };
const def = (o) => ({ engineVersion: 5, mode: 'defend', seed: 1, threat: 'pirate_raid', rooms: {}, squad: makeSquad(1, SPECS, 5, 'milspec'), ...o });

// Data.
for (const t of THREATS) {
  ok(Object.keys(t.units).every(id => UNIT_BY_ID[id]?.faction === t.faction && UNIT_BY_ID[id].cost > 0), `${t.id}: pool units exist, cost > 0 and match the faction`);
  ok(!t.leader || UNIT_BY_ID[t.leader], `${t.id}: leader exists`);
  ok(t.kind === 'boarding' || t.kind === 'outbreak', `${t.id}: kind`);
}

// Input checks.
throws(() => simulate(def({ engineVersion: 4 })), 'defense needs engine v5');
throws(() => simulate(def({ threat: 'nope' })), 'unknown threat');
throws(() => simulate(def({ squad: [] })), 'empty roster');
ok(simulate(def({ squad: makeSquad(2, [...SPECS, ...SPECS], 3, 'standard') })).soldiers.length === 12, 'the whole roster defends (12 Soldiers, more than any boarding squad)');

// Determinism, every threat, bare and maxed.
const results = {};
for (const t of THREATS) for (const rooms of [{}, MAXED]) for (let i = 0; i < 4; i++) {
  const inp = def({ threat: t.id, rooms, seed: 50 + i * 7919, squad: makeSquad(i, SPECS, 5, 'milspec') });
  const a = simulate(inp), b = simulate(JSON.parse(JSON.stringify(inp)));
  ok(a.hash === b.hash, `${t.id} deterministic`);
  ok(['success', 'lost', 'wipe'].includes(a.result), `${t.id}: result is success/lost/wipe (got ${a.result})`);
  ok(a.mode === 'defend' && a.threat === t.id && a.ship === 'mothership', `${t.id}: output names the defense`);
  ok(a.soldiers.every(s => ['fine', 'revived', 'downed'].includes(s.state)), `${t.id}: nobody is left behind or MIA at home`);
  ok(a.events.filter(e => e[1] === 'breach').length === a.breaches && a.breaches <= DEFENSE.waves, `${t.id}: breach events match the wave count`);
  results[a.result] = (results[a.result] || 0) + 1;
}

// Map and setup.
{
  const b = simulate(def({ rooms: MAXED }));
  const turrets = b.events.filter(e => e[1] === 'spawn' && e[4] === 'sys_turret' && e[3] === 'S').length;
  ok(turrets === 1 + 3 + 1, `the Bridge, Security Post L3 and Armory L3 turrets all fight for the squad (got ${turrets})`);
  ok(b.map.rooms.some(r => r.key === 'security') && b.map.slots.length > 0, 'the defense is fought on the Mothership map');
  const sq = makeSquad(3, SPECS, 5, 'milspec');
  const c = simulate(def({ rooms: MAXED, squad: sq }));
  const spawns = c.events.filter(e => e[1] === 'spawn' && e[3] === 'S' && e[4] !== 'sys_turret' && e[4] !== 'sys_drone');
  const built = (k) => c.map.rooms.some(r => r.key === k);
  spawns.forEach((e, i) => {
    const room = c.map.rooms[c.map.roomAt[e[6] * c.map.w + e[5]]];
    const guard = i % DEFENSE.guardEvery === DEFENSE.guardEvery - 1;
    ok(room && room.key === (guard ? 'bridge' : stationKey(built, sq[i])), `Soldier ${i} starts at ${guard ? 'Bridge watch' : 'their station'} (got ${room?.key})`);
  });
  // Outbreak: hatches in the Hangar, or the Quarantine Bay (sealed) when it's built.
  const o1 = simulate(def({ threat: 'hive_outbreak' }));
  ok(o1.events.find(e => e[1] === 'nest')[2] === o1.map.airlock, 'outbreak starts in the Hangar');
  const o2 = simulate(def({ threat: 'hive_outbreak', rooms: { quarantine: 2 } }));
  const q = o2.map.rooms.find(r => r.key === 'quarantine');
  ok(o2.events.find(e => e[1] === 'nest')[2] === q.id, 'outbreak starts in the Quarantine Bay when built');
  ok(o2.map.doors.some(d => (d.a === q.id || d.b === q.id) && d.forceTicks > 80), 'the Quarantine Bay door is sealed (slow to force)');
}

// Room bonuses change the fight.
{
  let diff = 0;
  for (let i = 0; i < 6; i++) {
    const sq = makeSquad(i, SPECS, 5, 'milspec');
    const a = simulate(def({ seed: 9 + i, squad: sq, rooms: { armory: 1 } })), b = simulate(def({ seed: 9 + i, squad: sq, rooms: { armory: 3 } }));
    if (a.hash !== b.hash) diff++;
  }
  ok(diff > 0, 'Armory level changes defense battles');
}

// Balance smoke test: a Level 5 roster of 6 on a well-built ship beats pirates nearly always.
{
  let win = 0;
  for (let i = 0; i < N; i++) if (simulate(def({ seed: 1000 + i * 7919, rooms: MAXED, squad: makeSquad(i * 13 + 6, SPECS, 5, 'milspec'), mothership: { mods: { grit: 12 }, entry: {}, retreat: {}, after: {} } })).result === 'success') win++;
  ok(win * 100 >= N * 80, `L5 x6, maxed ship vs pirates wins >= 80% (got ${Math.round(win * 100 / N)}%)`);
}

// Boarding missions are untouched by v5.
{
  let diff = 0;
  for (const ship of ['hauler', 'raider', 'corvette', 'hive_ship']) for (let i = 0; i < 3; i++) {
    const c = { seed: 300 + i * 77, ship, entry: 'shuttle', tactic: 'steady', retreat: 'shuttle', squad: makeSquad(i, ['assault', 'breacher', 'marksman', 'medic'], 5, 'milspec') };
    if (simulate({ ...c, engineVersion: 4 }).hash !== simulate({ ...c, engineVersion: 5 }).hash) diff++;
  }
  ok(diff === 0, 'boarding missions on v5 play exactly as v4');
}

console.log(`defense: ${fails ? fails + ' FAILED' : 'all passed'}. Results:`, results);
if (fails) process.exit(1);
