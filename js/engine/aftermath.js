// After the mission: who died, who's hurt, XP and BUCs. Deterministic from (seed, battle record).
// Permadeath is possible on EVERY ship (see injuries.js kiaChance floor).
import { createRng, hashString } from './rng.js';
import { XP } from '../data/stats.js';
import { SHIP_BY_ID, OBJECTIVES } from '../data/ships.js';
import { MINOR, MAJOR, kiaChance, LEFT_BEHIND_KIA, REAR_GUARD_KIA_MULT, KIA_MIN_PCT, INJURY_DIV, REVIVED_MAJOR_PCT, DOWNED_EXTRA_MINOR_PCT } from '../data/injuries.js';
import { successReward, failReward } from '../data/economy.js';
import { blitzTimeBonus } from '../data/blitz-bonus.js';
import { SUICIDE_SQUAD, isSuicideSquad } from '../data/suicide-squad.js';
import { SPECIALTIES } from '../data/specialties.js';
import { sumMods, itemMods } from './progression.js';
import { SLOTS } from '../data/gear.js';

const PERK_BY_ID = {};
for (const sp of SPECIALTIES) for (const pair of sp.perks) for (const p of pair) PERK_BY_ID[p.id] = p;

// battle: simulate() output. squad: the same squad array passed to simulate().
export function rollAftermath(battle, squad, mothership = null) {
  const rng = createRng(hashString('after:' + battle.seed + ':' + battle.hash));
  const ship = SHIP_BY_ID[battle.ship];
  const success = battle.result === 'success';
  const suicide = isSuicideSquad(battle.retreat);
  // Squad-wide perks (Medic: Guardian Angel / Bedside Manner) count if that Medic deployed.
  let squadSurvival = 0, squadHealTime = 0;
  for (const s of squad) for (const id of s.perks || []) {
    const p = PERK_BY_ID[id];
    if (p?.flag === 'squadSurvival') squadSurvival = Math.max(squadSurvival, p.mods.survivalPct || 0);
    if (p?.flag === 'squadHealTime') squadHealTime = Math.min(squadHealTime, p.mods.healTimePct || 0);
  }
  const msMods = mothership?.after || {};   // Mothership rooms: xpPct, healTimePct, survivalPct

  const results = battle.soldiers.map((rec, i) => {
    const s = squad[i];
    const own = sumMods([...SLOTS.map(sl => s.gear?.[sl]).filter(Boolean).map(itemMods),
      ...(s.perks || []).map(id => (PERK_BY_ID[id]?.flag === 'squadSurvival' || PERK_BY_ID[id]?.flag === 'squadHealTime') ? null : PERK_BY_ID[id]?.mods)]);
    const survivalPct = (own.survivalPct || 0) + squadSurvival + (msMods.survivalPct || 0);
    const healTimePct = (own.healTimePct || 0) + squadHealTime + (msMods.healTimePct || 0);
    const injuries = [];
    const minor = () => injuries.push(MINOR[rng.int(MINOR.length)]);
    const major = () => injuries.push(MAJOR[rng.int(MAJOR.length)]);
    let fate = 'ok', kia = 0;

    switch (rec.state) {
      case 'fine':
        if (rng.roll(Math.floor(rec.hpLostPct / INJURY_DIV))) minor();
        break;
      case 'revived':
        if (rng.roll(REVIVED_MAJOR_PCT)) major(); else minor();
        break;
      case 'downed':
        kia = kiaChance({ tier: ship.tier, ticksDown: rec.ticksDown, overkillPct: rec.overkillPct, survivalPct });
        if (rng.roll(kia)) fate = 'kia';
        else { major(); if (rng.roll(DOWNED_EXTRA_MINOR_PCT)) minor(); }
        break;
      case 'left': {
        if (suicide) { kia = 100; fate = 'kia'; break; }   // no retreat, no rescue
        let base = LEFT_BEHIND_KIA;
        if (rec.rearGuard) base = Math.floor((base * REAR_GUARD_KIA_MULT) / 100);
        kia = Math.max(KIA_MIN_PCT, Math.floor((base * (100 - Math.min(80, survivalPct))) / 100));
        if (rng.roll(kia)) fate = 'kia';
        else { fate = 'mia'; major(); }
        break;
      }
      case 'mia':
        fate = 'mia';
        if (rng.roll(50)) minor();
        break;
    }

    let xp = XP.missionBase + (success ? XP.success : 0) + rec.kills * XP.kill + rec.assists * XP.objectiveAssist
      + rec.revives * XP.revive + rec.hacks * XP.hack + rec.breaches * XP.breach + (rec.rearGuard ? XP.rearGuard : 0);
    const ssXp = suicide && success && fate !== 'kia' ? SUICIDE_SQUAD.xpBonusPct : 0;   // Suicide Squad survivors
    xp = Math.floor((xp * (100 + (own.xpPct || 0) + (msMods.xpPct || 0) + ssXp)) / 100);
    return { uid: rec.uid, state: rec.state, fate, kiaChance: kia, injuries, xp, healTimePct };
  });

  const bonus = battle.objectives.filter(o => o.done && OBJECTIVES[o.id].bonusPct).map(o => OBJECTIVES[o.id].bonusPct);
  const timeBonus = suicide ? { bucs: 0, secs: 0 } : blitzTimeBonus(ship, battle);
  const bucs = suicide
    ? (success ? Math.floor((successReward(ship, bonus, battle.lootCrates) * SUICIDE_SQUAD.rewardPct) / 100) : 0)
    : (success ? successReward(ship, bonus, battle.lootCrates) : failReward(ship, battle.progressPct)) + timeBonus.bucs;
  const gearDrop = success && battle.objectives.some(o => o.done && OBJECTIVES[o.id].gearDrop);
  const prisoner = success && battle.objectives.some(o => o.done && o.id === 'free_prisoner');
  return { soldiers: results, bucs, timeBonus, gearDrop, prisoner };
}
