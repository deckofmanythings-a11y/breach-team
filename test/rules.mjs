// Tests for js/game/rules.js (the server-authoritative save rules). Run: node test/rules.mjs
import * as R from '../js/game/rules.js';
import { PACKS, PITY_RELIC_AFTER } from '../js/data/economy.js';
import { RARITY_ORDER, ITEM_BY_ID } from '../js/data/gear.js';
import { GRADE_BY_ID } from '../js/data/economy.js';

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('FAIL', msg); } };
const throws = (fn, msg) => { try { fn(); fails++; console.log('FAIL (no error)', msg); } catch (e) { if (!(e instanceof R.GameError)) { fails++; console.log('FAIL (wrong error)', msg, e); } } };
const r = (x) => RARITY_ORDER.indexOf(x);

// New game
const g = R.newGame();
ok(g.soldiers.length === 4 && g.bucs === 500, 'starter squad + 500 BUCs');
ok(g.soldiers.every(s => s.gear.weapon && s.gear.armor), 'starters have weapon + armor');

// Packs: floors, sizes, grade floors, pity
for (const p of PACKS) {
  let minBest = 99, elite = true;
  for (let i = 0; i < 200; i++) {
    const t = R.newGame(); t.bucs = 1e6; t.soldiers = [];
    const got = R.openPack(t, p.id);
    ok(got.items.length === p.items && got.soldiers.length === p.soldiers, `${p.id} sizes`);
    if (got.items.length) minBest = Math.min(minBest, Math.max(...got.items.map(it => r(it.rarity))));
    for (const id of got.soldiers) { const s = R.soldierById(t, id); if (p.gradeFloor && GRADE_BY_ID[s.grade].level < GRADE_BY_ID[p.gradeFloor].level) elite = false; }
    ok(got.items.every(it => it.rarity !== 'xeno'), `${p.id} never gives Xeno`);
  }
  if (p.items) ok(minBest >= r(p.floor), `${p.id} best item always >= ${p.floor} (got ${RARITY_ORDER[minBest]})`);
  ok(elite, `${p.id} soldier grade floor`);
}
{
  const t = R.newGame(); t.bucs = 1e6; let streak = 0, maxStreak = 0;
  for (let i = 0; i < 400; i++) { const got = R.openPack(t, 'armory'); if (got.items.some(it => it.rarity === 'relic')) streak = 0; else streak++; maxStreak = Math.max(maxStreak, streak); }
  ok(maxStreak <= PITY_RELIC_AFTER, `pity: never more than ${PITY_RELIC_AFTER} packs in a row without a Relic (max streak ${maxStreak})`);
}
{ const t = R.newGame(); t.bucs = 10; throws(() => R.openPack(t, 'recruit'), 'pack needs BUCs'); ok(t.bucs === 10, 'failed buy spends nothing'); }

// Store
const day = R.storeDay(Date.parse('2026-11-24T12:00:00Z'));
ok(day === '2026-11-24', 'store day in Pacific time');
ok(JSON.stringify(R.storeStock(day)) === JSON.stringify(R.storeStock(day)), 'store stock is the same for everyone');
ok(JSON.stringify(R.storeStock(day)) !== JSON.stringify(R.storeStock('2026-11-25')), 'store stock changes daily');
{
  const t = R.newGame(); t.bucs = 1e6; const now = Date.parse('2026-11-24T12:00:00Z');
  const n0 = t.items.length; R.buyStore(t, 'i0', now); ok(t.items.length === n0 + 1, 'store item bought');
  throws(() => R.buyStore(t, 'i0', now), 'store slot only once per day');
  R.buyStore(t, 'i0', now + 86400e3); ok(true, 'next day restocks');
  const s0 = t.soldiers.length; R.buyStore(t, 's0', now); ok(t.soldiers.length === s0 + 1, 'store soldier bought');
  const st = R.storeStock(day).soldiers[0], bought = t.soldiers[t.soldiers.length - 1];
  ok(bought.name === st.name && bought.level === st.level, 'store soldier matches the listing');
}

// Sell, equip, heal, perks, customize
{
  const t = R.newGame(); const s = t.soldiers[0]; const w = s.gear.weapon;
  throws(() => R.sellItem(t, w), 'cannot sell equipped');
  R.equip(t, s.uid, 'weapon', null); const b = t.bucs; R.sellItem(t, w); ok(t.bucs === b + 15, 'standard item sells for 15');
  const sniper = R.addItem(t, { base: 'sniper_std', rarity: 'standard' });
  throws(() => R.equip(t, s.uid, 'weapon', sniper.uid), 'assault cannot wield a sniper rifle');
  throws(() => R.equip(t, s.uid, 'armor', sniper.uid), 'wrong slot');
  s.injuries.push({ id: 'gunshot', until: Date.now() + 40 * 60e3 });
  ok(R.condition(s) === 'benched' && !R.canDeploy(s), 'major injury benches');
  const c = R.healCost(s); ok(c > 50 && c <= 60, `heal cost pro-rated (${c})`);
  R.heal(t, s.uid); ok(s.injuries.length === 0, 'healed');
  s.pendingPerks = [5];
  throws(() => R.choosePerk(t, s.uid, 'deadeye'), 'perk from another specialty');
  R.choosePerk(t, s.uid, 'run_and_gun'); ok(s.perks[0] === 'run_and_gun' && !s.pendingPerks.length, 'perk chosen');
  R.customize(t, s.uid, { name: '  Vex  ', colors: ['#112233', 'not a colour'], sex: 'x' });
  ok(s.name === 'Vex' && s.colors[0] !== '#112233' && s.sex !== 'x', 'customize validates input');
}

// Missions
{
  const t = R.newGame();
  throws(() => R.runMission(t, { ship: 'hauler', entry: 'vent_crawl', tactic: 'balanced', retreat: 'shuttle', squad: t.soldiers.map(s => s.uid) }), 'squad too big for vents');
  throws(() => R.runMission(t, { ship: 'nope', entry: 'shuttle', tactic: 'balanced', retreat: 'shuttle', squad: [t.soldiers[0].uid] }), 'bad ship');
  const b0 = t.bucs;
  const out = R.runMission(t, { ship: 'hauler', entry: 'shuttle', tactic: 'balanced', retreat: 'shuttle', squad: t.soldiers.map(s => s.uid) });
  ok(t.missions === 1 && t.history.length === 1 && t.bucs === b0 + out.after.bucs, 'mission applied');
  ok(out.report.hash === out.battle.hash, 'report carries the battle hash');
}

// Upkeep: emergency Rookie
{
  const t = R.newGame(); t.bucs = 0;
  for (const s of t.soldiers.slice(1)) s.injuries.push({ id: 'gunshot', until: Date.now() + 1e7 });
  const notes = R.upkeep(t); ok(notes.length === 1 && t.soldiers.length === 5, 'emergency rookie');
  ok(R.upkeep(t).length === 0, 'emergency cooldown');
}

console.log(fails ? `\n${fails} failure(s)` : 'All rules tests passed.');
process.exit(fails ? 1 : 0);
