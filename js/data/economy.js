// BUCs (Basic Universal Credits): rewards, packs, store, roster.
// All rolls (packs, store stock, recruits) happen SERVER-SIDE in boarding-api; the client only
// shows results. These tables are shared by both.

export const STARTING_BUCS = 500;
export const ROSTER_CAP = 24;
export const MAX_DEPLOY = 6;            // absolute cap; the entry method usually caps lower

// Starter squad: everyone begins with these four, each with standard gear.
export const STARTER_SQUAD = [
  { specialty: 'assault',  weapon: 'carbine_std', armor: 'armor_medium' },
  { specialty: 'breacher', weapon: 'shotgun_std', armor: 'armor_medium', utility: 'breach_kit' },
  { specialty: 'marksman', weapon: 'sniper_std',  armor: 'armor_light' },
  { specialty: 'medic',    weapon: 'smg_std',     armor: 'armor_light',  utility: 'medkit' },
];

// ---------- Mission rewards ----------
// Success: ship.reward + sum of completed optional objectives' bonusPct, + loot crates.
// Failure (retreat): salvage = ship.reward * progressPct * FAIL_SALVAGE_PCT / 10000,
//   progressPct = % of rooms the squad cleared (0-100).
export const FAIL_SALVAGE_PCT = 30;
export const LOOT_CRATE_BUCS = 25;          // each 'loot' feature the squad passes through
export const KIA_DEATH_BENEFIT = 0;         // deliberately 0: deaths cost you, they don't pay
export function successReward(ship, bonusPcts = [], lootCrates = 0) {
  let pct = 100; for (const b of bonusPcts) pct += b;
  return Math.floor((ship.reward * pct) / 100) + lootCrates * LOOT_CRATE_BUCS;
}
export function failReward(ship, progressPct) {
  return Math.floor((ship.reward * progressPct * FAIL_SALVAGE_PCT) / 10000);
}

// ---------- Soldier grades (for recruits from packs / store) ----------
// level: starting level (level-ups are rolled normally, perks picked at random for 5+).
export const GRADES = [
  { id: 'rookie',   name: 'Rookie',   level: 1, weight: 650, price: 150 },
  { id: 'seasoned', name: 'Seasoned', level: 3, weight: 260, price: 400 },
  { id: 'veteran',  name: 'Veteran',  level: 5, weight: 75,  price: 900 },
  { id: 'elite',    name: 'Elite',    level: 8, weight: 15,  price: 2000 },
];
export const GRADE_BY_ID = Object.fromEntries(GRADES.map(g => [g.id, g]));

// ---------- Booster packs ----------
//   soldiers / items   how many of each
//   floor              the BEST item in the pack is at least this rarity
//   gradeFloor         the best soldier is at least this grade
//   rarityBoost        multiplies non-standard rarity weights (%), shifting odds upward
export const PACKS = [
  { id: 'recruit', name: 'Recruit Pack',    price: 250, soldiers: 1, items: 1, floor: 'standard', gradeFloor: 'rookie',
    desc: 'One new Soldier and a piece of kit.' },
  { id: 'armory',  name: 'Armory Pack',     price: 300, soldiers: 0, items: 3, floor: 'milspec',  gradeFloor: null,
    desc: 'Three pieces of equipment. At least one is Mil-Spec or better.' },
  { id: 'boarding',name: 'Boarding Crate',  price: 600, soldiers: 1, items: 3, floor: 'prototype', gradeFloor: 'rookie', rarityBoost: 125,
    desc: 'A Soldier and three items. At least one item is Prototype or better.' },
  { id: 'elite',   name: 'Elite Crate',     price: 1500, soldiers: 1, items: 3, floor: 'relic', gradeFloor: 'veteran', rarityBoost: 160,
    desc: 'A Veteran-or-better Soldier and three items, one guaranteed Relic.' },
];
export const PACK_BY_ID = Object.fromEntries(PACKS.map(p => [p.id, p]));
// Pity: after this many packs in a row without a Relic, the next pack's best item is a Relic.
export const PITY_RELIC_AFTER = 12;
// Chance an item roll picks a homage special instead of a standard item (fixed rarity; filtered by floor).
export const SPECIAL_ITEM_PCT = 4;

// ---------- Store ----------
// Daily rotation, same for everyone that day (seeded by the date, Pacific time like Kaiju Clash).
export const STORE = { items: 6, soldiers: 2, refreshHourPT: 0 };
export const ITEM_PRICE = { standard: 60, milspec: 150, prototype: 400, relic: 1100 };  // xeno never sold
export const SELL_PCT = 25;            // selling returns 25% of the store price
export const DISMISS_REFUND = 0;       // dismissing a Soldier refunds nothing

// ---------- Names for generated recruits ----------
export const FIRST_NAMES = {
  m: ['Marcus', 'Diego', 'Kenji', 'Tomas', 'Ezra', 'Malik', 'Ivan', 'Owen', 'Rafael', 'Dmitri', 'Jonah', 'Kofi', 'Silas', 'Arjun', 'Bram', 'Cole',
      'Tariq', 'Wei', 'Chidi', 'Mateo', 'Ravi', 'Hemi', 'Takoda', 'Omar', 'Jin-ho', 'Kwame', 'Luis', 'Sanjay', 'Tavita', 'Yusuf', 'Hiroshi', 'Ayo', 'Nayeli', 'Bao', 'Elias', 'Kai'],
  f: ['Ana', 'Yara', 'Mei', 'Freya', 'Imani', 'Zoe', 'Lena', 'Priya', 'Sasha', 'Noor', 'Talia', 'Rosa', 'Kira', 'Elena', 'Jun', 'Maeve',
      'Amara', 'Leilani', 'Ximena', 'Aiyana', 'Fatima', 'Hana', 'Zainab', 'Lucia', 'Anjali', 'Malia', 'Nia', 'Soo-ah', 'Ayasha', 'Layla', 'Thandi', 'Linh', 'Valentina', 'Kalani', 'Ines', 'Wren'],
};
export const LAST_NAMES = ['Vance', 'Okafor', 'Reyes', 'Tanaka', 'Kowalski', 'Haddad', 'Mbeki', 'Novak', 'Castillo', 'Lindqvist', 'Park', 'Duarte', 'Brennan', 'Sato', 'Volkov', 'Achebe', 'Moreau', 'Quinn',
  'Nguyen', 'Mensah', 'Patel', 'Kealoha', 'Begay', 'Al-Amin', 'Hernandez', 'Kim', 'Adeyemi', 'Singh', 'Tupou', 'Redcloud', 'Chen', 'Mahmoud', 'Ortiz', 'Nakamura', 'Diallo', 'Rangi', 'Iyer', 'Santos', 'Yazzie', 'Farouk'];
export const CALLSIGNS = ['Ghost', 'Hammer', 'Doc', 'Sparks', 'Tank', 'Viper', 'Patch', 'Bishop', 'Rook', 'Static', 'Brick', 'Echo', 'Wraith', 'Lucky', 'Fuse', 'Sarge', 'Hex', 'Moth'];
export const SEXES = ['m', 'f'];
// Default armor/accent colour pairs for new recruits (player can change them freely).
export const COLOR_PRESETS = [
  ['#3a5a8c', '#f2c14e'], ['#6b2d2d', '#e0e0e0'], ['#2f5d3a', '#c9a227'], ['#3b3b44', '#ff6b35'],
  ['#5a3a7a', '#7fd1ff'], ['#7a6a4a', '#202020'], ['#1f4f5a', '#ff4f6d'], ['#8c8c8c', '#2e86de'],
];
