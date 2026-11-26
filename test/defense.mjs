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

// ---- M5: defense events ----
{
  const R = await import('../js/game/rules.js');
  const DE = await import('../js/data/defense-events.js');
  const MR = await import('../js/data/mothership-rooms.js');
  const { buildRoom, repairRoom } = await import('../js/game/mothership.js');
  const g = R.newGame();
  g.missions = 5; ok(DE.defenseChance(g, { tier: 1 }) === 0, 'no defenses before mission 12');
  g.missions = 12; ok(DE.defenseChance(g, {}) === DE.DEFENSE_EVENTS.basePct, 'base chance from mission 12');
  ok(DE.defenseChance(g, { alien: true }) === DE.DEFENSE_EVENTS.alienPct, 'higher chance after an alien ship');
  g.lastDefense = 10; ok(DE.defenseChance(g, {}) === 0, 'cooldown between defenses');
  delete g.lastDefense;
  const lv = (L, n = 6) => Array.from({ length: n }, () => ({ level: L }));
  ok(DE.pickThreat(lv(1)).threat === 'corp_repo' && DE.pickThreat(lv(3)).threat === 'pirate_raid' && DE.pickThreat(lv(6)).threat === 'marine_strike', 'threat follows roster level');
  ok(DE.pickThreat(lv(2), { alien: true }).threat === 'hive_outbreak', 'alien ship -> outbreak');
  ok(DE.pickThreat([...lv(8, 6), ...lv(1, 10)]).threat === 'marine_strike', 'only the 6 best Soldiers set the threat');

  // Applying a defense.
  g.bucs = 1000; g.creds = 100000;
  for (const id of ['med_bay', 'armory', 'training_deck']) buildRoom(g, id);
  const out = R.runDefense(g, { threat: 'pirate_raid', power: 100 }, 77);
  ok(out && out.report.defense && out.input.mode === 'defend' && out.input.squad.length === g.soldiers.length + out.report.soldiers.filter(x => x.fate === 'kia').length, 'everyone aboard defends');
  ok(g.lastDefense === g.missions && g.defenses.fought === 1, 'defense is recorded');
  ok(simulate(out.input).hash === out.report.hash, 'a defense replays to the same hash');
  ok(out.report.soldiers.every(x => x.fate !== 'mia'), 'nobody goes Missing at home');
  // A lost defense: theft and damage, applied through applyDefense with a forged battle.
  const g2 = R.newGame(); g2.bucs = 1000; g2.creds = 100000; g2.missions = 30;
  for (const id of ['med_bay', 'armory', 'training_deck', 'chapel']) buildRoom(g2, id);
  const lost = R.runDefense(g2, { threat: 'marine_strike', power: 400 }, 5);
  if (lost.report.result !== 'success') {
    ok(lost.report.stolen > 0 && lost.report.damaged.length === DE.DEFENSE_EVENTS.damagedRooms[lost.report.result], `a lost defense steals BUCs and damages rooms (${lost.report.result})`);
    const id = lost.report.damaged[0];
    ok(DE.isDamaged(g2, id) && !Object.keys(MR.mothershipEffects(g2)).some(k => MR.roomEffect(id, MR.roomLevel(g2, id))[k] && k !== 'grit' && !['med_bay','armory','training_deck','chapel'].filter(x => x !== id && !DE.isDamaged(g2, x)).some(x => MR.roomEffect(x, 1)[k])), 'a damaged room adds nothing');
    throws(() => buildRoom(g2, id), 'cannot upgrade a damaged room');
    const before = g2.creds, price = DE.repairPrice(g2, id);
    ok(price === 300, `repair costs half the level price (got ${price})`);
    repairRoom(g2, id);
    ok(!DE.isDamaged(g2, id) && g2.creds === before - price, 'repair restores the room');
    throws(() => repairRoom(g2, id), 'cannot repair an intact room');
  } else ok(false, 'expected the 400%-power marine strike to beat a starter squad');
  // Game Over when every defender dies.
  const g3 = R.newGame(); g3.missions = 30;
  const inp = { engineVersion: 5, mode: 'defend', seed: 1, threat: 'corp_repo', power: 100, rooms: {}, tactic: 'balanced', squad: g3.soldiers.map(x => R.engineSoldier(g3, x)) };
  const b3 = simulate(inp);
  const rep3 = R.applyDefense(g3, inp, b3, { soldiers: b3.soldiers.map(x => ({ uid: x.uid, state: 'downed', fate: 'kia', kiaChance: 99, injuries: [], xp: 10, healTimePct: 0 })), bucs: 0 });
  ok(rep3.gameOver && g3.gameOver && g3.memorial.length === 4 && g3.memorial.every(m => m.defense && /defending the Mothership/.test(m.diedHow)), 'all defenders dead = Game Over, with defender memorials');

  // The real trigger, inside runMission: keep deploying until one fires.
  const g4 = R.newGame(); g4.missions = 40; g4.bucs = 1e6;
  let hit = null;
  for (let i = 0; i < 400 && !hit; i++) {
    for (const s of g4.soldiers) { s.injuries = []; s.status = 'ready'; }
    while (g4.soldiers.length < 4) g4.soldiers.push(R.makeRecruit({ int: k => 0, roll: () => false, range: (a) => a }, 'assault', 1));
    delete g4.gameOver;
    const r = R.runMission(g4, { ship: 'hauler', entry: 'shuttle', tactic: 'steady', retreat: 'shuttle', squad: g4.soldiers.slice(0, 4).map(s => s.uid) });
    if (r.report.defense) hit = r;
  }
  ok(hit && g4.history[0].defense === hit.report.defense && simulate(hit.report.defense.input).hash === hit.report.defense.hash, 'runMission sometimes triggers a defense, saved with the mission and replayable');
}

// M6: Security Post, Quarantine Bay, damaged rooms in the engine, defense achievements.
{
  const DE = await import('../js/data/defense-events.js');
  const MR = await import('../js/data/mothership-rooms.js');
  const R = await import('../js/game/rules.js');
  const { buildRoom } = await import('../js/game/mothership.js');
  const g = R.newGame(); g.creds = 1e6; g.missions = 30;
  for (const id of ['security', 'quarantine']) { buildRoom(g, id); buildRoom(g, id); buildRoom(g, id); }
  ok(MR.roomLevel(g, 'security') === 3 && MR.roomLevel(g, 'quarantine') === 3, 'Security Post and Quarantine Bay can be built to L3');
  ok(DE.defenseChance(g, { alien: true }) === 3 && DE.defenseChance(g, { tier: 1 }) === DE.DEFENSE_EVENTS.basePct, 'Quarantine Bay L3 cuts outbreaks to a quarter, not other defenses');
  ok(MR.mothershipInput(g) === null, 'defense-only rooms add nothing to missions');
  const b3 = simulate(def({ rooms: { security: 3 } })), b2 = simulate(def({ rooms: { security: 2 } }));
  const bd = b3.events.find(e => e[1] === 'blastdoors');
  ok(bd && b3.map.doors[bd[2]].blast && b3.map.doors[bd[2]].forceTicks >= 4 * 20 && !b2.events.some(e => e[1] === 'blastdoors'), 'Security Post L3 (only) seals the Bridge with blast doors');
  const tur = (b) => b.events.filter(e => e[1] === 'spawn' && e[3] === 'S' && e[4] === 'sys_turret').length;
  const dmg = simulate(def({ rooms: { security: 3 }, damaged: ['security'] }));
  ok(tur(b3) === 4 && tur(dmg) === 1 && !dmg.events.some(e => e[1] === 'blastdoors'), `a damaged Security Post has no turrets or blast doors (got ${tur(b3)} / ${tur(dmg)})`);
  const oq = simulate(def({ threat: 'hive_outbreak', power: 75, rooms: { quarantine: 3 }, damaged: ['quarantine'] }));
  ok(oq.events.find(e => e[1] === 'nest')[2] === oq.map.airlock, 'a damaged Quarantine Bay contains nothing (outbreak starts in the Hangar)');
  // runDefense passes damaged rooms on.
  g.mothership.damaged = { security: true };
  const rd = R.runDefense(g, { threat: 'corp_repo', power: 100 }, 7);
  ok(rd && rd.input.damaged?.join() === 'security' && simulate(rd.input).hash === rd.battle.hash, 'runDefense sends damaged rooms to the engine (and replays match)');
  // Achievements.
  const g5 = R.newGame();
  const inp = { engineVersion: 5, mode: 'defend', seed: 3, threat: 'corp_repo', power: 100, rooms: {}, tactic: 'balanced', squad: g5.soldiers.map(x => R.engineSoldier(g5, x)) };
  const fake = { ...simulate(inp), result: 'success', events: [[50, 'hold', 90, 160]] };
  const rep = R.applyDefense(g5, inp, fake, { soldiers: fake.soldiers.map(x => ({ uid: x.uid, state: 'fine', fate: 'ok', kiaChance: 0, injuries: [], xp: 10, healTimePct: 0 })), bucs: 0 });
  ok(rep.achievements.includes('ach_off_my_ship') && rep.achievements.includes('ach_hold_door') && !rep.achievements.includes('ach_mostly_night'), 'defense achievements: Get Off My Ship + Hold the Door');
}

// M6 part 2: Intel Room scouting (engine v6).
{
  const S = await import('../js/engine/scout.js');
  const R = await import('../js/game/rules.js');
  const { buildRoom } = await import('../js/game/mothership.js');
  const sq = makeSquad(4, SPECS.slice(0, 4), 3, 'standard');
  const base = { engineVersion: 6, ship: 'raider', entry: 'shuttle', tactic: 'balanced', retreat: 'teleport_recall', squad: sq };
  throws(() => simulate({ ...base, seed: 1, scouted: true }), 'scouted needs a map seed');
  throws(() => simulate({ ...base, engineVersion: 5, seed: 1, mapSeed: 9, scouted: true }), 'scouted needs engine v6');
  const kinds = (b) => b.events.filter(e => e[0] === 0 && e[1] === 'spawn' && e[3] === 'E' && e[4] !== 'sys_turret').map(e => e[4]).sort().join();
  const objs = (b) => b.events.filter(e => e[1] === 'objective').map(e => e[2] + '@' + e[3]).join();
  const g = R.newGame(); g.creds = 1e6; g.missions = 20;
  ok(S.scoutReport(g, 'raider') === null, 'no Intel Room, no scouting');
  buildRoom(g, 'intel');
  const rep = S.scoutReport(g, 'raider');
  ok(rep && rep.level === 1 && rep.plan.crew.length > 0, 'Intel Room L1 scouts the crew');
  const a = simulate({ ...base, seed: 11, mapSeed: rep.mapSeed, scouted: true }), b = simulate({ ...base, seed: 222, mapSeed: rep.mapSeed, scouted: true });
  ok(kinds(a) === kinds(b) && objs(a) === objs(b), 'scouted: crew and objectives are the same whatever the battle seed');
  const want = ['raider'].map(() => rep.plan.objectives.map(o => o.id + '@' + o.room)).join();
  ok(objs(a) === ['take_bridge@' + a.map.bridge, want].filter(Boolean).join(), `scouted objectives match the scout report (${objs(a)} vs ${want})`);
  const planned = [...rep.plan.crew.map(c => c.kind), ...rep.plan.civilians.map(() => Object.keys(rep.ship.unitWeights).find(id => UNIT_BY_ID[id].ai === 'flee'))];
  const spawned = a.events.filter(e => e[1] === 'spawn' && e[3] === 'E').map(e => e[4]);
  ok(planned.every(k => spawned.includes(k)) && spawned.length >= planned.length, 'scouted crew spawns as reported');
  ok(a.hash !== b.hash, 'the fight itself still depends on the battle seed');
  ok(simulate({ ...base, seed: 5 }).hash === simulate({ ...base, engineVersion: 5, seed: 5 }).hash, 'unscouted missions on v6 play exactly as v5');
  // runMission uses the scout seed it showed.
  const seedShown = S.scoutSeed(g, 'hauler');
  for (const s of g.soldiers) { s.injuries = []; s.status = 'ready'; }
  const r = R.runMission(g, { ship: 'hauler', entry: 'shuttle', tactic: 'steady', retreat: 'shuttle', squad: g.soldiers.slice(0, 4).map(s => s.uid) });
  ok(r.input.scouted ? r.input.mapSeed === seedShown : r.report.secret, 'runMission boards the scouted map (unless the contact was a secret ship)');
  ok(S.scoutSeed(g, 'hauler') !== seedShown, 'scouting refreshes after a mission');
  g.mothership.damaged = { intel: true };
  ok(S.scoutReport(g, 'raider') === null, 'a damaged Intel Room scouts nothing');
  // Defense: Intel Room sensors (+Aim for defenders, v6 only).
  const acc = (bt) => { const sh = bt.events.filter(e => e[1] === 'shot' && bt.units.find(u => u.id === e[2])?.side === 'S'); return sh.filter(e => e[4] > 0).length / sh.length; };
  let a5 = 0, a6 = 0;
  for (let i = 0; i < 6; i++) { a5 += acc(simulate(def({ seed: 50 + i, engineVersion: 5, rooms: { intel: 3 } }))); a6 += acc(simulate(def({ seed: 50 + i, engineVersion: 6, rooms: { intel: 3 } }))); }
  ok(a6 > a5, `Intel Room: defenders shoot straighter (${(a6 / 6).toFixed(3)} vs ${(a5 / 6).toFixed(3)})`);
}

console.log(`defense: ${fails ? fails + ' FAILED' : 'all passed'}. Results:`, results);
if (fails) process.exit(1);
