// Crew Quarters roster cap (js/data/crew-quarters.js, js/game/crew-quarters.js): node test/crew-quarters.mjs
import * as R from '../js/game/rules.js';
import * as C from '../js/data/crew-quarters.js';
import { expandQuarters } from '../js/game/crew-quarters.js';
import { createRng } from '../js/engine/rng.js';

let bad = 0;
const ok = (cond, msg) => { if (!cond) { bad++; console.log('FAIL', msg); } };
const throws = (fn, msg) => { try { fn(); bad++; console.log('FAIL (no throw)', msg); } catch { /* expected */ } };

// The cap and price curve.
ok(C.capAtLevel(0) === 14 && C.capAtLevel(1) === 21 && C.capAtLevel(5) === 49, 'cap = 14 + 7 per level');
const prices = Array.from({ length: 12 }, (_, i) => C.quartersPriceAt(i));
ok(prices[0] === 800, 'first expansion 800');
ok(prices.every((p, i) => i === 0 || p > prices[i - 1]), 'every level costs more than the last');
ok(prices.every(p => p % 50 === 0), 'prices round to 50');
console.log('prices:', prices.join(', '));

const g = R.newGame(1700000000000);
ok(C.rosterCap(g) === 14 && C.quartersLevel(g) === 0, 'new game: level 0, cap 14');

// Fill to the cap, then hiring stops.
const rng = createRng(3);
while (g.soldiers.length < 14) g.soldiers.push(R.makeRecruit(rng, 'assault', 1));
g.bucs = 100000;
throws(() => R.hire(g, 'medic'), 'hire blocked at the cap');

// Expanding needs CREDs, then makes room for 7.
g.creds = 100;
throws(() => expandQuarters(g), 'expansion needs CREDs');
g.creds = 800;
const r = expandQuarters(g);
ok(r.level === 1 && r.cap === 21 && g.creds === 0 && g.mothership.quarters === 1, 'expanded to level 1 for 800');
R.hire(g, 'medic');
ok(g.soldiers.length === 15, 'hire works after expanding');
ok(C.nextQuartersPrice(g) === C.quartersPriceAt(1), 'next price is level 2 price');

// Grandfathered: an old save with 24 Soldiers and no quarters keeps them all but can't add anyone.
const old = R.newGame(1700000000000);
while (old.soldiers.length < 24) old.soldiers.push(R.makeRecruit(rng, 'tech', 2));
old.bucs = 100000;
ok(C.rosterFull(old) && old.soldiers.length === 24, 'over-cap save keeps its 24 Soldiers');
throws(() => R.hire(old, 'medic'), 'over-cap save cannot hire');
old.creds = 5000;
expandQuarters(old); // cap 21: still over
throws(() => R.hire(old, 'medic'), 'still over the cap at 21');
expandQuarters(old); // cap 28
R.hire(old, 'medic');
ok(old.soldiers.length === 25, 'hiring resumes once the cap passes the roster');

// Corrupt / missing values fall back safely.
ok(C.rosterCap({ soldiers: [] }) === 14 && C.rosterCap({ mothership: { quarters: 'x' }, soldiers: [] }) === 14, 'bad level reads as 0');

console.log(bad ? `${bad} FAILED` : 'crew-quarters: all passed');
process.exit(bad ? 1 : 0);
