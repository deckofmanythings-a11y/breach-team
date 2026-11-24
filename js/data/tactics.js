// Squad tactics. A tactic doesn't add a single bonus: it sets the AI's weights for every Soldier
// in the squad, plus a small squad-wide modifier set (mods, MOD_KEYS vocabulary).
//
// aggression    0-100  chance-weight of pushing to attack vs holding position
// coverUse      0-100  how strongly units seek cover before shooting
// advancePct    pace when moving between rooms (100 = normal; scales ticksPerTile inversely)
// rangePct      preferred engagement distance as % of weapon range (low = close in)
// objectiveFocus 0-100 how much the squad ignores side fights to reach the objective
// noisePct      how loud the squad is (feeds the ship alarm)
// retreatAt     casualty % (Downed or KIA, of the deployed squad) that triggers the retreat
// hidden        squad starts undetected and stays hidden until spotted or it opens fire

export const TACTICS = [
  { id: 'balanced', name: 'Balanced',
    desc: 'A sensible mix of pace and caution. No big strengths, no big weaknesses.',
    aggression: 50, coverUse: 50, advancePct: 100, rangePct: 80, objectiveFocus: 50, noisePct: 100, retreatAt: 50,
    mods: {} },
  { id: 'blitz', name: 'Blitz',
    desc: 'Go fast, hit hard. Reaches the bridge before the defenders organise, but takes more fire.',
    aggression: 90, coverUse: 15, advancePct: 135, rangePct: 50, objectiveFocus: 75, noisePct: 150, retreatAt: 60,
    mods: { dmgPct: 10, dmgTakenPct: 15, aim: -5 } },
  { id: 'steady', name: 'Slow & Steady',
    desc: 'Clear every room, always fight from cover. Safest, but slow: reinforcements have time to arrive.',
    aggression: 30, coverUse: 90, advancePct: 75, rangePct: 90, objectiveFocus: 25, noisePct: 90, retreatAt: 40,
    mods: { coverPct: 25, dmgTakenPct: -10 } },
  { id: 'stealthy', name: 'Stealthy',
    desc: 'Avoid contact and head for the objective. Brutal if it works; messy if the squad gets spotted.',
    aggression: 15, coverUse: 70, advancePct: 85, rangePct: 70, objectiveFocus: 95, noisePct: 40, retreatAt: 50, hidden: true,
    mods: { stl: 20, critPct: 10, grit: -10 } },
  { id: 'sharpshooting', name: 'Sharpshooting',
    desc: 'Hold long sightlines and let the enemy walk into them. Excellent with Marksmen, weak up close.',
    aggression: 35, coverUse: 75, advancePct: 85, rangePct: 110, objectiveFocus: 40, noisePct: 100, retreatAt: 50,
    mods: { aim: 10, rangeAdd: 1 }, flag: 'closeRangePenalty' },   // -15% damage at 2 tiles or less
];
export const TACTIC_BY_ID = Object.fromEntries(TACTICS.map(t => [t.id, t]));
