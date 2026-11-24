# Breach Team — Rules Codex

Every rule and number in the game, in one place. The data files in `js/data/` are the source of truth; this codex must be updated whenever they change (it will become the in-game Codex tab later, like Kaiju Clash's). **Never list hidden easter eggs (secret recruits, secret ships, logs) here.**

Engine v1 · run `npm run check` to validate the data and regenerate the sample numbers below.

---

## 1. Time

- The simulation runs in **ticks**. 10 ticks = 1 second of playback at 1×.
- Missions are designed to last **60–90 seconds** (600–900 ticks).
- Hard cap: **900 ticks**. If the bridge isn't taken by then, the squad retreats automatically.

## 2. Stats

| Stat | Short | What it does |
|---|---|---|
| Health | HP | Damage before going Down |
| Aim | AIM | Hit chance (+½ per point) and crit chance (+1% per 10) |
| Armor | ARM | Flat damage reduction: 1 per 10 Armor |
| Speed | SPD | Movement (see below) and evasion (1 per 5 Speed) |
| Grit | GRT | Resists panic and suppression |
| Tech | TEC | Hacking, breaching, healing, spotting hidden things |
| Stealth | STL | How hard the Soldier is to spot |

Caps: HP 400, Speed 120, all others 150.

## 3. Combat formulas

**Hit chance** = 55 + AIM/2 + weapon accuracy − target evasion − cover − (tiles beyond range × falloff) − 20 if Suppressed. Clamped to 5–95%.

- Cover: none 0, half 20, full 40 (cover bonuses scale this up).
- Evasion = SPD/5 + evasion bonuses.

**Crit chance** = weapon crit + AIM/10 + crit bonuses, max 60%. A crit deals **150%** damage (more with crit-damage bonuses).

**Damage** = weapon roll × (100 + damage% + vs-type%)/100 → ×150% if crit → minus (target ARM/10 − Pierce) → × (100 + damage-taken%)/100. Minimum 1.

**Movement**: ticks per tile = 8 − (SPD/20), between 2 and 8. Speed 35 → 7 ticks, 55 → 6, 65 → 5.

**Panic** (when hit hard, an ally goes Down nearby, or a hazard triggers): chance = 25 + pressure − GRT/2, reduced by morale bonuses, clamped 0–75%.

**Spotting a stealthed unit** (per check, in line of sight): 40 + observer TEC/4 + detection bonus − target STL − 3 per tile. Clamped 3–90%.

Examples (Aim-50 rifleman vs Speed-45 target): open ground at 5 tiles 79%, half cover 59%, full cover 39%, open at 12 tiles 63%. A 15-damage rifle shot into 20 Armor deals 13 (20 on a crit).

## 4. Soldiers

### Specialties

| Specialty | Role | Weapons | Signature ability |
|---|---|---|---|
| Assault | Front-line rifleman | Carbine, Rifle, SMG, Shotgun | **Charge**: dash 3 tiles, +25% damage shot |
| Breacher | Doors and demolitions | Shotgun, SMG, Carbine, Blade | **Breach Charge**: blow a sealed door, stun the room behind |
| Marksman | Long range | Sniper, Rifle, Pistol | **Overwatch**: reaction shot at the first enemy to appear |
| Medic | Healing, revives | Pistol, SMG, Carbine | **Patch Up**: heal, or try to revive a Downed ally (55% base) |
| Tech | Hacking, turrets, hazards | Pistol, SMG, Arc | **Hack**: open locks, disable turrets, use terminals |
| Heavy | Fire support | Machine Gun, Flamer, Shotgun | **Suppressing Fire**: cone that Suppresses enemies |
| Infiltrator | Stealth, assassination | Pistol, SMG, Blade | **Cloak**: invisible; first attack +50% damage |

### Leveling

- XP needed to reach level L = 40 × (L−1) × L. Level 2 at 80 XP, level 10 at 3,600, max level 20 at 15,200.
- Each level-up gives **4 stat points**, each placed randomly using the specialty's growth weights. One point = +4 HP, or +2 of any other stat.
- **Breakthrough** (8% per level-up): +3 bonus points into the specialty's main stat.
- **Perks** at levels 5, 10 and 15: choose one of two.
- XP per mission: 20 for deploying, +25 for success, +4 per kill, +10 for being there when an objective is taken, +8 per revive, +5 per hack or breach, +40 for volunteering as Rear Guard.

Average stats by level (from `npm run check`):

| | HP | AIM | ARM | SPD | GRT | TEC | STL |
|---|---|---|---|---|---|---|---|
| Assault L10 | 126 | 67 | 27 | 69 | 56 | 10 | 14 |
| Heavy L10 | 179 | 46 | 58 | 39 | 65 | 10 | 0 |
| Marksman L10 | 92 | 95 | 14 | 52 | 56 | 19 | 36 |
| Infiltrator L20 | 111 | 75 | 10 | 95 | 55 | 45 | 107 |

### Customization

Name, sex (picks the body sprite set), primary and accent colour, optional callsign. Purely cosmetic.

## 5. Injuries, death and healing

**Permadeath is on for every mission.** Any Soldier who goes Down can die, on any ship.

At the end of a mission each Soldier is in one state:

| State | Meaning | Outcome |
|---|---|---|
| Fine | Never went Down | Injury chance = (% of HP lost) / 2 |
| Revived | Went Down, a Medic got them up | Always injured; 50% chance it's major |
| Downed | Down at the end, carried out | Rolls for death (below); survivors get 1 major injury, 40% chance of a minor too |
| Left behind | Couldn't be carried out | 60% death; survivors come back Missing with a major injury |
| Missing | Escape pod drifted | Returns after 30 minutes |

**Death chance when Downed** = base by ship tier (12% / 18% / 25%) + 1% per 3 seconds spent Down (max +20%) + up to 15% for overkill damage, then reduced by survival bonuses. It **never goes below 5%**. Max 85%.

Rear Guard volunteers who fall get 80% of the left-behind death chance.

**Injuries** heal in real minutes (10–60, never more than 60). Minor injuries apply penalties but the Soldier can still deploy. **A major injury benches the Soldier until healed.** Instant heal costs 20 BUCs (minor) or 60 BUCs (major) at full time, pro-rated by time left.

Fallen Soldiers go to the **Memorial Wall**.

## 6. Equipment

Four slots: **Weapon, Armor, Utility, Implant.**

| Rarity | Stat scaling | Affixes | Base drop odds |
|---|---|---|---|
| Standard | 100% | 0 | 60% |
| Mil-Spec | 110% | 1 | 27% |
| Prototype | 122% | 1 (stronger) | 10% |
| Relic | 135% | 2 (stronger) | 3% |
| Xeno | 150% | 2 (strongest) | Alien ships only |

Positive stats scale with rarity; drawbacks (like Assault Plate's −Speed) don't.

### Weapon types (standard rarity)

| Type | Damage | Range | Fire delay (ticks) | Damage/tick | Notes |
|---|---|---|---|---|---|
| Pistol | 8–12 | 5 | 10 | 1.0 | Quiet sidearm |
| SMG | 5–8 | 4 | 5 | 1.3 | |
| Carbine | 9–13 | 6 | 8 | 1.4 | |
| Rifle | 12–17 | 8 | 11 | 1.3 | Pierce 1 |
| Shotgun | 18–28 | 3 | 16 | 1.4 | Very loud |
| Sniper | 28–40 | 14 | 28 | 1.2 | Pierce 3, high crit |
| Machine Gun | 7–10 | 7 | 5 | 1.7 | Suppresses, inaccurate |
| Flamer | 6–9 | 3 | 5 | 1.5 | Pierce 5, splash |
| Blade | 20–28 | 1 | 10 | 2.4 | Melee, silent |
| Arc Projector | 10–14 | 5 | 12 | 1.0 | Pierce 4, chains, +30% vs synthetics |

### Affixes

Hollow-Point (+damage), Piercing, Scoped (+Aim), Rapid (+fire rate), Vicious (+crit), Extended (+range), Synth-Bane, Xeno-Bane (weapons) · Reinforced (+Armor), Padded (+HP), Vacuum-Sealed (+hazard resist), Lightweight (+Speed), Muffled (+Stealth) (armor) · Steady (+Grit), Smart (+Tech), Lucky (better survival), Veteran's (+XP) (utility/implants). Higher rarity rolls stronger values.

Some special items have fixed rarity and unique flavour. You'll find them in packs.

## 7. Before each mission

1. **Target ship** (section 8).
2. **Entry**

| Entry | Squad | Arrives | Alarm | Notes |
|---|---|---|---|---|
| Teleport | 4 | Room nearest the objective | Calm | 6% per Soldier to scatter to a random room (more vs shields) |
| Boarding Shuttle | 6 | Airlock | Alert | Shuttle stays docked for the retreat |
| Breaching Pod | 4 | Hull room nearest objective | Alert | Stuns the room 4 s; opens it to vacuum |
| Vent Crawl | 2 | Within 3 rooms of objective | Calm | Starts hidden, +15 Stealth |

3. **Squad**: up to the entry's cap. Soldiers with a major injury can't deploy.
4. **Tactic**

| Tactic | Style | Modifiers | Retreats at |
|---|---|---|---|
| Balanced | Even | none | 50% casualties |
| Blitz | Fast, close, loud | +10% damage, +15% damage taken, −5 Aim | 60% |
| Slow & Steady | Room by room, cover | +25% cover, −10% damage taken | 40% |
| Stealthy | Avoid fights, go for objective | +20 Stealth, +10% crit, −10 Grit; starts hidden | 50% |
| Sharpshooting | Hold sightlines | +10 Aim, +1 range, −15% damage at 2 tiles or less | 50% |

5. **Retreat plan** (triggers automatically at the tactic's casualty threshold, or at the time limit)

| Retreat | Exit | Risk |
|---|---|---|
| Teleport Recall | Anywhere, 2 s | 8% per Soldier of a misfire (stuck 6 s longer); worse near shields |
| Back to the Shuttle | Airlock | Shuttle takes 8 s to arrive unless you came by shuttle |
| Escape Pods | Pod bay | 10% per Soldier to drift: Missing for 30 min |
| Rear Guard | Arrival room | Highest-Grit Soldier stays 12 s to cover everyone else |

## 8. Ships

| Ship | Faction | Tier | Rooms | Crew | Reinforcements | Turrets | Locked doors | Reward |
|---|---|---|---|---|---|---|---|---|
| Cargo Hauler | Corporate Security | 1 | 8–10 | 14 pts + Chief + 2–4 crew | 1 wave | 1 | 10% | 220 |
| Pirate Raider | Void Pirates | 2 | 9–11 | 26 pts + Captain | 2 waves | 1 | 15% | 380 |
| Patrol Corvette | Fleet Marines | 3 | 10–12 | 34 pts + Lieutenant | 3 waves | 3 | 30% | 600 |

- Primary objective: **take the bridge** and hold the console for 6 seconds.
- Optional objectives (1–2 per mission) add bonus BUCs: Seize the Cargo +30%, Pull the Data Core +25%, Capture the Captain +35%, Free the Prisoner +20%, Raid the Armory +20% and a guaranteed item.
- Pirates break when their Captain goes Down: every pirate makes a panic check.
- The Patrol Corvette is shielded: teleport entry and recall are 10% more likely to go wrong.

### Factions

| Faction | Look | Moves | Units |
|---|---|---|---|
| Void Pirates | Rust and orange, ragged coats | Erratic rushes | Deckhand, Cutthroat (melee), Scattergunner, Captain |
| Corporate Security | White and teal, riot shields | Tight formation | Crew (unarmed, flee), Guard, Riot Officer, Security Drone, Chief |
| Fleet Marines | Olive and grey plate | Cover-to-cover | Marine, Heavy Marine, Combat Engineer, Sniper, Lieutenant |

Every ship can also mount hackable **Defense Turrets**.

### Hazards

| Hazard | Effect |
|---|---|
| Decompression | 3 dmg/s, drags units toward the breach, 12 s |
| Radiation Leak | 1 dmg/s, whole mission (reactor rooms) |
| Fire | 4 dmg/s, panic checks, 8 s |

## 9. BUCs

- Start with **500 BUCs** and four Soldiers: Assault, Breacher, Marksman, Medic.
- **Success** pays the ship's reward + optional objective bonuses + 25 per loot crate.
- **Retreat** pays salvage: 30% of the reward × % of rooms cleared.
- Deaths pay nothing.

### Booster packs

| Pack | Price | Contents |
|---|---|---|
| Recruit Pack | 250 | 1 Soldier + 1 item |
| Armory Pack | 300 | 3 items, one Mil-Spec+ |
| Boarding Crate | 600 | 1 Soldier + 3 items, one Prototype+, better odds |
| Elite Crate | 1,500 | Veteran+ Soldier + 3 items, one Relic, better odds |

- After **12 packs** in a row without a Relic, the next pack is guaranteed one.
- Recruit grades: Rookie (level 1, 65%), Seasoned (level 3, 26%), Veteran (level 5, 7.5%), Elite (level 8, 1.5%).

### Store

- Daily rotation (midnight Pacific): 6 items + 2 Soldiers.
- Item prices: Standard 60, Mil-Spec 150, Prototype 400, Relic 1,100. Xeno is never sold.
- Soldier prices: Rookie 150, Seasoned 400, Veteran 900, Elite 2,000.
- Selling returns 25%. Roster cap: 24 Soldiers.
