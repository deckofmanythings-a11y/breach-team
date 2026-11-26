// Tests for js/game/rules.js (the server-authoritative save rules). Run: node test/rules.mjs
import * as R from '../js/game/rules.js';
import { stripAll } from '../js/game/armory.js';
import { simulate } from '../js/engine/battle.js';
import { shipAt } from '../js/engine/ship-at.js';
import { SHIP_BY_ID } from '../js/data/ships.js';
import { ENGINE_VERSION } from '../js/data/version.js';
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

// Weekly Contract + stats
{
  const L = await import('../js/game/ladder.js');
  const c1 = L.weeklyContract(Date.parse('2026-11-24T08:00:00Z')), c2 = L.weeklyContract(Date.parse('2026-11-27T07:59:00Z')), c3 = L.weeklyContract(Date.parse('2026-11-27T08:00:00Z')), c0 = L.weeklyContract(Date.parse('2026-11-24T07:59:00Z'));
  ok(c1.week === '2026-11-24' && c2.week === '2026-11-24' && c3.week === '2026-11-27' && c0.week === '2026-11-21', `72-hour contracts reset at midnight Pacific every 3 days (${c0.week}, ${c1.week}, ${c2.week}, ${c3.week})`);
  ok(c1.mapSeed === c2.mapSeed && c1.mapSeed !== c3.mapSeed, 'same contract for 72 hours, new one after');
  ok(c1.endsAt === Date.parse('2026-11-27T08:00:00Z') && L.weeklyContract(Date.parse('2027-07-01T06:00:00Z')).endsAt === Date.parse('2027-07-01T07:00:00Z'), 'contract end is midnight Pacific (standard and daylight time)');
  const a = R.newGame(), b = R.newGame();
  const ra = R.runMission(a, { contract: true, ship: 'corvette', entry: 'shuttle', tactic: 'balanced', retreat: 'teleport_recall', squad: a.soldiers.map(s => s.uid) });
  const rb = R.runMission(b, { contract: true, entry: 'teleport', tactic: 'blitz', retreat: 'teleport_recall', squad: b.soldiers.map(s => s.uid) });
  ok(ra.input.ship === rb.input.ship && ra.input.mapSeed === rb.input.mapSeed, 'everyone boards the same contract ship and map (the plan ship is ignored)');
  ok(Number.isInteger(ra.report.contract.score) && Number.isInteger(rb.report.contract.score), `contract run scored (${ra.report.contract.score}, ${rb.report.contract.score})`);
  ok(a.stats.missions === 1 && a.stats.contracts === 1, `stats count one mission (${JSON.stringify(a.stats)})`);
  ok(!ra.report.secret && !rb.report.secret, 'no secret ships on contracts');
}

// Hidden egg: a fallen Soldier comes back from a pack as a cyborg
{
  const { ITEM_BY_ID } = await import('../js/data/gear.js');
  const { STATS } = await import('../js/data/stats.js');
  const g = R.newGame();
  const dead = g.soldiers[0];
  dead.kills = 7; dead.level = 6; dead.perks = ['x'];
  g.memorial.unshift({ ...dead, gear: {}, diedAt: 1, diedOn: 'Cargo Hauler', diedHow: 'test', diedResult: 'wipe', gearLost: false });
  g.soldiers = g.soldiers.slice(1);
  let cy = null, opened = 0;
  for (; opened < 2000 && !cy; opened++) {
    g.bucs = 10000; g.soldiers = g.soldiers.slice(0, 3);
    const got = R.openPack(g, 'recruit');
    if (got.cyborg) cy = g.soldiers.find(s => s.uid === got.cyborg[0]);
  }
  ok(cy, `a cyborg turns up in packs (after ${opened})`);
  if (cy) {
    const m = g.memorial[0];
    ok(m.recovered && cy.origin === m.uid, 'the memorial entry is marked recovered');
    ok(cy.specialty === m.specialty && cy.level === m.level && cy.sex === m.sex && cy.colors.join() === m.colors.join() && cy.perks.join() === m.perks.join(), 'carbon copy: specialty, level, sex, colours, perks');
    ok(STATS.every(k => cy.stats[k] > m.stats[k]), 'every stat is better');
    ok(cy.name !== m.name && !cy.name.includes(m.name.split(' ')[1]), `mysterious name (${cy.name})`);
    const ch = R.itemById(g, cy.gear.implant);
    ok(ch && ITEM_BY_ID[ch.base].builtin && ITEM_BY_ID[ch.base].hidden, 'built-in chassis in the implant slot');
    let threw = 0;
    try { R.equip(g, cy.uid, 'implant', null); } catch { threw++; }
    try { R.sellItem(g, ch.uid); } catch { threw++; }
    const other = g.soldiers.find(s => !s.cyborg);
    try { R.equip(g, other.uid, 'implant', ch.uid); } catch { threw++; }
    ok(threw === 3 && cy.gear.implant === ch.uid, 'chassis cannot be removed, sold or moved');
    const before = g.items.length;
    R.dismiss(g, cy.uid);
    ok(g.items.length === before - 1 && !R.itemById(g, ch.uid), 'dismissing takes the chassis with them');
    let again = 0;
    for (let i = 0; i < 400; i++) { g.bucs = 10000; g.soldiers = g.soldiers.slice(0, 3); if (R.openPack(g, 'recruit').cyborg) again++; }
    ok(again === 0, 'a fallen Soldier only comes back once');
    console.log('  cyborg sample:', cy.name, '|', cy.bio);
  }
}

// Faces, Game Over and starting over
{
  const C = await import('../js/game/commander.js');
  const { LOOK_COUNT } = await import('../js/data/looks.js');
  const looks = new Set();
  for (let i = 0; i < 40; i++) for (const s of R.newGame().soldiers) looks.add(s.look);
  ok(looks.size === LOOK_COUNT, `recruits get every face (${looks.size}/${LOOK_COUNT})`);
  const g0 = R.newGame(); const s0 = g0.soldiers[0];
  R.customize(g0, s0.uid, { look: 3 }); ok(s0.look === 3, 'face can be chosen');
  R.customize(g0, s0.uid, { look: 99 }); ok(s0.look === 3, 'bad face rejected');
  ok(R.engineSoldier(g0, s0).look === 3, 'face rides along in the engine input (for playback)');

  // Game Over: send everyone on a doomed run until the roster is empty.
  let g = R.newGame(), over = null, tries = 0;
  g.memorial.push({ uid: 'old', name: 'Old Timer', specialty: 'assault', stats: {}, kills: 1 });
  g.mothership = { level: 2 };
  while (!g.gameOver && tries++ < 400) {
    g.soldiers = g.soldiers.slice(0, 3);   // trim BEFORE the run (a rescued prisoner may join after it)
    for (const s of g.soldiers) { s.injuries = []; s.status = 'ready'; s.stats = { hp: 1, aim: 1, arm: 0, spd: 1, grit: 0, tech: 0, stl: 0 }; }
    const m = R.runMission(g, { ship: 'corvette', entry: 'vent_crawl', tactic: 'blitz', retreat: 'shuttle', squad: g.soldiers.map(s => s.uid) });
    if (m.report.gameOver) over = m.report;
  }
  ok(g.gameOver && over && g.soldiers.length === 0, `a mission with no survivors ends the game (${tries} runs)`);
  R.upkeep(g, Date.now() + 3600e3);
  ok(g.soldiers.length === 0, 'no free replacement after a Game Over');
  const fallen = g.memorial.length;
  g.bucs = 99999;
  const r = C.newCommander(g);
  ok(r.newCommander === 2 && g.generation === 2 && !g.gameOver, 'a new commander takes over');
  ok(g.memorial.length === fallen && g.memorial.some(m => m.uid === 'old'), 'the Memorial Wall carries over');
  ok(g.mothership && g.mothership.level === 2, 'the Mothership carries over');
  ok(g.soldiers.length === 4 && g.missions === 0 && g.stats.missions === 0 && g.bucs !== 99999, 'fresh crew, fresh BUCs, fresh record');
  let threw = false; try { C.newCommander(g); } catch { threw = true; }
  ok(threw, 'no new commander without a Game Over');
  C.restartAccount(g);
  ok(g.memorial.length === 0 && !g.mothership && !g.generation && g.soldiers.length === 4, 'Restart Account wipes everything');
}

// ---- Easy-ship balance (engine v3) and hired Rookies' standard kit ----
{
  const g = R.newGame(0); g.bucs = 5000;
  const { soldier } = R.hire(g, 'heavy');
  const s = g.soldiers.find(x => x.uid === soldier);
  ok(R.itemById(g, s.gear.weapon)?.base === 'lmg_std' && R.itemById(g, s.gear.armor)?.base === 'armor_heavy', 'a hired Rookie reports with a standard weapon and armour');
  const h = SHIP_BY_ID.hauler;
  ok(shipAt(h, 2).turrets === 1 && shipAt(h, 2).crewBudget === 8, 'old hauler replays keep their old numbers');
  ok(shipAt(h, 3).turrets === 0 && shipAt(h, 3).crewBudget === 6, 'engine v3 hauler has no turret and a smaller crew');
  // A fresh starter squad should usually take the tier-1 ship.
  let wins = 0; const N = 60;
  for (let i = 0; i < N; i++) {
    const f = R.newGame(0);
    const b = simulate({ engineVersion: ENGINE_VERSION, seed: 4242 + i * 97, ship: 'hauler', entry: 'shuttle', tactic: 'balanced', retreat: 'teleport_recall', squad: f.soldiers.map(x => R.engineSoldier(f, x)) });
    if (b.result === 'success') wins++;
  }
  ok(wins >= N * 0.75, `a fresh starter squad wins the Cargo Hauler most of the time (${wins}/${N})`);
}

// ---- Strip all Equipment ----
{
  const g = R.newGame(0);
  const worn = g.soldiers.reduce((n, s) => n + Object.keys(s.gear).length, 0);
  const r = stripAll(g);
  ok(r.stripped === worn && worn > 0 && g.soldiers.every(s => !Object.keys(s.gear).length), `Strip all Equipment takes everything off (${worn} items)`);
  ok(g.items.length >= worn, 'stripped gear stays in the Armory');
  g.soldiers[0].gear.implant = R.addItem(g, { base: 'sarcophagus_chassis', rarity: 'relic', affixes: [] }).uid;
  stripAll(g);
  ok(g.soldiers[0].gear.implant, 'built-in enhancements stay put');
}

// ---- XP for recruits hired above Level 1 ----
{
  const { createRng } = await import('../js/engine/rng.js');
  const v = R.makeRecruit(createRng(7), 'assault', 5);
  ok(v.xp === 800, `a Level 5 recruit starts with 800 XP (got ${v.xp})`);
  const g = R.newGame(0); g.soldiers[0].level = 5; g.soldiers[0].xp = 0; R.migrate(g);
  ok(g.soldiers[0].xp === 800, 'migrate lifts a Level 5 Soldier stuck at 0 XP to 800');
  g.soldiers[1].level = 5; g.soldiers[1].xp = 1000; R.migrate(g);
  ok(g.soldiers[1].xp === 1000, 'migrate leaves earned XP alone');
}

// ---- Class accent colours ----
{
  const { applyClassAccents, setClassAccents } = await import('../js/game/class-colors.js');
  const { DEFAULT_CLASS_ACCENTS } = await import('../js/data/class-colors.js');
  const g = applyClassAccents(R.newGame(0));
  ok(g.soldiers.every(s => s.colors[1] === DEFAULT_CLASS_ACCENTS[s.specialty]), 'every Soldier wears their class default accent');
  const spec = g.soldiers[0].specialty, armor = g.soldiers[0].colors[0];
  setClassAccents(g, { [spec]: '#123ABC' });
  ok(g.soldiers.filter(s => s.specialty === spec).every(s => s.colors[1] === '#123abc') && g.soldiers[0].colors[0] === armor, 'changing a class accent recolours that class, armour kept');
  ok(g.soldiers.filter(s => s.specialty !== spec).every(s => s.colors[1] === DEFAULT_CLASS_ACCENTS[s.specialty]), 'other classes untouched');
  setClassAccents(g, { [spec]: null });
  ok(g.soldiers[0].colors[1] === DEFAULT_CLASS_ACCENTS[spec], 'reset returns to the default');
  throws(() => setClassAccents(g, { assault: 'red' }), 'bad colour rejected');
  throws(() => setClassAccents(g, { wizard: '#ffffff' }), 'unknown class rejected');
}

// ---- Mission clock (v4): bridge pause + Grit push-on; v3 untouched ----
{
  const { makeSquad } = await import('./fixtures.mjs');
  let pushOn = 0, overtimeWins = 0, v3Clock = 0;
  for (let i = 0; i < 60; i++) {
    const inp = { seed: 7000 + i, ship: 'raider', entry: 'shuttle', tactic: 'steady', retreat: 'teleport_recall', squad: makeSquad(i, ['assault', 'breacher', 'marksman', 'medic'], 5, 'milspec') };
    const b4 = simulate({ ...inp, engineVersion: 4 });
    if (b4.events.some(e => e[1] === 'pushon')) pushOn++;
    if (b4.result === 'success' && b4.ticks > 720) overtimeWins++;
    const b3 = simulate({ ...inp, engineVersion: 3 });
    if (b3.events.some(e => ['clock', 'pushon', 'pushfail'].includes(e[1])) || b3.ticks > 840) v3Clock++;
  }
  ok(pushOn > 0, `v4 squads dig in on Grit sometimes (${pushOn}/60)`);
  ok(overtimeWins > 0, `v4 squads can win past 90 s (${overtimeWins}/60)`);
  ok(v3Clock === 0, 'v3 missions keep the old fixed clock');
}

// ---- Blitz time bonus ----
{
  const { blitzTimeBonus } = await import('../js/data/blitz-bonus.js');
  const ship = SHIP_BY_ID.raider;
  const base = { engineVersion: 4, result: 'success', tactic: 'blitz', clockLeft: 40 * 8 };
  ok(blitzTimeBonus(ship, base).bucs === Math.floor(ship.reward * 20 / 100), '40 s left = +20% of the reward');
  ok(blitzTimeBonus(ship, { ...base, clockLeft: 90 * 8 }).bucs === Math.floor(ship.reward * 30 / 100), 'capped at +30%');
  ok(blitzTimeBonus(ship, { ...base, tactic: 'steady' }).bucs === 0, 'only Blitz');
  ok(blitzTimeBonus(ship, { ...base, result: 'retreat' }).bucs === 0, 'only on a win');
  ok(blitzTimeBonus(ship, { ...base, engineVersion: 3 }).bucs === 0, 'not on old-engine missions');
}

console.log(fails ? `\n${fails} failure(s)` : 'All rules tests passed.');
process.exit(fails ? 1 : 0);
