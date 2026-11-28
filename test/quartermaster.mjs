// Quartermaster, Auto-equip and saved squads (js/game/quartermaster.js): node test/quartermaster.mjs
import * as R from '../js/game/rules.js';
import * as Q from '../js/game/quartermaster.js';
import { ITEMS, ITEM_BY_ID } from '../js/data/gear.js';
import { createRng } from '../js/engine/rng.js';

let bad = 0;
const ok = (cond, msg) => { if (!cond) { bad++; console.log('FAIL', msg); } };
const throws = (fn, msg) => { try { fn(); bad++; console.log('FAIL (no throw)', msg); } catch { /* expected */ } };

const g = R.newGame(1700000000000);
const rng = createRng(7);
for (const sp of ['tech', 'medic', 'infiltrator', 'heavy', 'marksman']) g.soldiers.push(R.makeRecruit(rng, sp, 3 + g.soldiers.length));
for (const it of ITEMS) { if (it.builtin || it.enemyOnly) continue; for (const r of ['standard', 'prototype', 'relic']) R.addItem(g, { base: it.id, rarity: r, affixes: [] }); }
g.creds = 5000;

throws(() => Q.autoEquip(g), 'auto-equip needs a Quartermaster');
throws(() => Q.buyQuartermaster(g), 'needs the Armory built');
g.mothership = { rooms: { armory: 1 } };
Q.buyQuartermaster(g);
ok(g.creds === 3000 && Q.hasQuartermaster(g), 'bought for 2000');
throws(() => Q.buyQuartermaster(g), 'only once');

const r1 = Q.autoEquip(g);
ok(r1.changed > 0, 'auto-equip changed gear');
ok(Q.autoEquip(g).changed === 0, 'second run is stable');
for (const s of g.soldiers) for (const [slot, uid] of Object.entries(s.gear)) {
  const it = R.itemById(g, uid);
  ok(ITEM_BY_ID[it.base].slot === slot && R.canWield(s, it), `${s.specialty} ${slot} legal`);
}
const worn = g.soldiers.flatMap(s => Object.values(s.gear));
ok(new Set(worn).size === worn.length, 'no item worn twice');
// Highest level picks first: the top Soldier's weapon outscores the lowest same-class Soldier's.
const byLv = g.soldiers.slice().sort((a, b) => b.level - a.level);
const medics = byLv.filter(s => s.specialty === 'medic');
ok(ITEM_BY_ID[R.itemById(g, medics[0].gear.utility).base].mods.healPct > 0, 'top Medic gets healing gear');
const w = (s) => Q.itemScore(s.specialty, R.itemById(g, s.gear.weapon));
ok(w(medics[0]) >= w(medics[medics.length - 1]), 'higher-level Medic has the better weapon');
// Priority list: a level-1 Soldier listed first gets first pick.
const low = byLv[byLv.length - 1];
Q.autoEquip(g, [low.uid]);
const sameClass = g.soldiers.filter(s => s.specialty === low.specialty && s !== low);
for (const o of sameClass) ok(w(low) >= w(o), 'priority Soldier picked first');
// MIA Soldiers keep their gear.
const mia = byLv[1]; const kept = { ...mia.gear }; mia.status = 'mia';
Q.autoEquip(g);
ok(JSON.stringify(mia.gear) === JSON.stringify(kept), 'MIA keeps gear');
mia.status = 'ready';
// Damaged Armory switches it off.
g.mothership.damaged = { armory: true };
throws(() => Q.autoEquip(g), 'damaged Armory');
delete g.mothership.damaged;

// Saved squads.
const four = g.soldiers.slice(0, 4).map(s => s.uid);
Q.saveSquads(g, [{ name: 'Alpha', entry: 'shuttle', squad: four }]);
ok(g.squads.length === 1 && g.squads[0].squad.length === 4 && g.squads[0].entry === 'shuttle', 'squad saved');
throws(() => Q.saveSquads(g, [{ name: 'Big', entry: 'teleport', squad: g.soldiers.map(s => s.uid) }]), 'too many for the entry');
throws(() => Q.saveSquads(g, [{ name: '', entry: 'shuttle', squad: four }]), 'needs a name');
throws(() => Q.saveSquads(g, Array.from({ length: 9 }, (_, i) => ({ name: 'S' + i, entry: 'shuttle', squad: [four[0]] }))), 'max 8');
Q.saveSquads(g, [{ name: 'Ghosts', entry: 'shuttle', squad: [...four, 'nobody'] }]);
ok(g.squads[0].squad.length === 4, 'unknown uids dropped');
g.soldiers = g.soldiers.filter(s => s.uid !== four[0]);
ok(Q.presetView(g, g.squads[0]).squad.length === 3, 'dismissed Soldier dropped from the view');

console.log(bad ? `${bad} FAILED` : 'quartermaster: all passed');
process.exit(bad ? 1 : 0);
