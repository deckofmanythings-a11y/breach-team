// Commendations: medals a Soldier earns from their service record. Checked after every mission.
// `test(r)` reads the Soldier's record (see SERVICE_RECORD in js/app/state.js).
// Never name a hidden easter egg here (secret ships, recruits): this list is shown to players.

export const COMMENDATIONS = [
  { id: 'first_blood',   name: 'First Blood',        ribbon: ['#b91c1c', '#fca5a5'], desc: 'Scored a first kill.',                         test: r => r.kills >= 1 },
  { id: 'marksmanship',  name: 'Combat Ribbon',      ribbon: ['#1d4ed8', '#93c5fd'], desc: '25 confirmed kills.',                          test: r => r.kills >= 25 },
  { id: 'centurion',     name: 'Centurion',          ribbon: ['#7c2d12', '#fdba74'], desc: '100 confirmed kills.',                         test: r => r.kills >= 100 },
  { id: 'boarding_badge',name: 'Boarding Badge',     ribbon: ['#166534', '#86efac'], desc: 'Part of 5 successful boardings.',              test: r => r.successes >= 5 },
  { id: 'ship_breaker',  name: 'Ship Breaker',       ribbon: ['#065f46', '#5eead4'], desc: 'Part of 25 successful boardings.',             test: r => r.successes >= 25 },
  { id: 'veteran',       name: 'Veteran',            ribbon: ['#57534e', '#e7e5e4'], desc: 'Flew 10 missions.',                            test: r => r.missions >= 10 },
  { id: 'old_guard',     name: 'Old Guard',          ribbon: ['#3f3f46', '#facc15'], desc: 'Flew 30 missions.',                            test: r => r.missions >= 30 },
  { id: 'purple_star',   name: 'Purple Star',        ribbon: ['#6b21a8', '#e9d5ff'], desc: 'Wounded in action.',                           test: r => r.injuries >= 1 },
  { id: 'cheated_death', name: 'Cheated Death',      ribbon: ['#111827', '#f87171'], desc: 'Went Down and survived the death roll.',       test: r => r.deathRolls >= 1 },
  { id: 'nine_lives',    name: 'Nine Lives',         ribbon: ['#0f172a', '#fbbf24'], desc: 'Survived 3 death rolls.',                      test: r => r.deathRolls >= 3 },
  { id: 'guardian',      name: 'Guardian Angel',     ribbon: ['#0e7490', '#f0f9ff'], desc: 'Revived 5 squadmates in the field.',           test: r => r.revives >= 5 },
  { id: 'last_out',      name: 'Last Out',           ribbon: ['#92400e', '#fde68a'], desc: 'Volunteered as rear guard.',                   test: r => r.rearGuards >= 1 },
  { id: 'lone_survivor', name: 'Lone Survivor',      ribbon: ['#1e1b4b', '#c7d2fe'], desc: 'The only one of a squad of 3+ to come home.',  test: r => r.loneSurvivor >= 1 },
  { id: 'natural',       name: 'Natural Talent',     ribbon: ['#a16207', '#fef08a'], desc: 'Had a Breakthrough level-up.',                 test: r => r.breakthroughs >= 1 },
  { id: 'lost_found',    name: 'Lost and Found',     ribbon: ['#334155', '#bae6fd'], desc: 'Went Missing and found the way home.',         test: r => r.mia >= 1 },
];
export const COMMENDATION_BY_ID = Object.fromEntries(COMMENDATIONS.map(c => [c.id, c]));
