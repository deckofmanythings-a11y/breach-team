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

// Easter eggs
{
  const t = R.newGame();
  for (const s of t.soldiers) s.level = 10;
  let secrets = 0, xeno = 0, alienWins = 0, cat = 0;
  for (let i = 0; i < 400; i++) {
    t.missions = 5; t.soldiers.forEach(s => { s.injuries = []; s.status = 'ready'; });
    while (t.soldiers.length < 4) R.hire(Object.assign(t, { bucs: t.bucs + 150 }), 'assault');
    const ship = i % 2 ? 'hive_ship' : 'gravity_vessel';
    const out = R.runMission(t, { ship, entry: 'shuttle', tactic: 'balanced', retreat: 'teleport_recall', squad: t.soldiers.slice(0, 4).map(s => s.uid) });
    if (out.report.secret) { secrets++; ok(out.input.ship.startsWith('secret_') && out.report.plannedShip === ship, 'secret ship swapped in'); }
    if (out.report.result === 'success' && !out.report.secret) alienWins++;
    if (out.report.extras.some(x => x.xeno)) xeno++;
    if (out.report.extras.some(x => x.egg === 'loot_cat')) cat++;
  }
  ok(secrets > 4 && secrets < 40, `secret encounters ~4% (${secrets}/400)`);
  // Xeno drops: a fresh, strong squad each time so wins (and therefore drops) actually happen.
  for (let i = 0; i < 80; i++) {
    const f = R.newGame();
    for (const s of f.soldiers) { s.level = 12; s.stats = { hp: 160, aim: 90, arm: 40, spd: 70, grit: 80, tech: 60, stl: 30 }; }
    const out = R.runMission(f, { ship: 'gravity_vessel', entry: 'shuttle', tactic: 'balanced', retreat: 'teleport_recall', squad: f.soldiers.map(s => s.uid) });
    if (out.report.result === 'success') alienWins++;
    if (out.report.extras.some(x => x.xeno)) { xeno++; ok(out.report.extras.find(x => x.xeno).item.rarity === 'xeno', 'Xeno drop has Xeno rarity'); }
  }
  ok(xeno > 0, `Xeno drops from alien ships (${xeno} drops, ${alienWins} wins)`);
  ok(cat <= 1, `the ship's cat can only be found once (${cat})`);
  ok(new Set(t.discovered).size === t.discovered.length, 'discovered list has no duplicates');
  console.log('  achievements earned in that run: ' + (t.achievements.join(', ') || 'none'));
  const fresh = R.newGame();
  let early = 0;
  for (let i = 0; i < 100; i++) {
    fresh.missions = 1; fresh.soldiers.forEach(s => { s.injuries = []; s.status = 'ready'; });
    if (!fresh.soldiers.length) break;
    const o = R.runMission(fresh, { ship: 'hauler', entry: 'shuttle', tactic: 'balanced', retreat: 'teleport_recall', squad: [fresh.soldiers[0].uid] });
    if (o.report.secret) early++;
  }
  ok(early === 0, 'no secret ships before mission 3');
}
{
  const t = R.newGame(); t.bucs = 1e7; let rare = 0;
  for (let i = 0; i < 1500; i++) { t.soldiers = []; const got = R.openPack(t, 'recruit'); rare += (got.rare || []).length; }
  ok(rare > 0 && rare <= 7, `rare recruits appear, each at most once (${rare})`);
  ok(new Set(t.eggs).size === t.eggs.length, 'egg list has no duplicates');
}

console.log(fails ? `\n${fails} failure(s)` : 'All rules tests passed.');
process.exit(fails ? 1 : 0);
