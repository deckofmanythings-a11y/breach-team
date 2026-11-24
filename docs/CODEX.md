# Breach Team — Rules Codex

Every rule and number in the game, in one place. The data files in `js/data/` are the source of truth; this codex must be updated whenever they change (it will become the in-game Codex tab later, like Kaiju Clash's). **Never list hidden easter eggs (secret recruits, secret ships, logs) here.**

Engine v2 · run `npm run check` to validate the data and regenerate the sample numbers below.

---

## 1. Time

- The simulation runs in **ticks**. 8 ticks = 1 second of playback at 1×.
- Missions are designed to last **60–90 seconds**.
- At **90 seconds** (720 ticks), if the bridge isn't taken, the squad retreats automatically.
- At **105 seconds** (840 ticks) the mission ends. Anyone still on board is left behind.

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

**Hit chance** = 50 + AIM/2 + weapon accuracy − target evasion − cover − (tiles beyond range × falloff) − 20 if Suppressed. Clamped to 5–95%.

- Cover: none 0, half 20, full 40 (cover bonuses scale this up).
- Evasion = SPD/5 + evasion bonuses.

**Crit chance** = weapon crit + AIM/10 + crit bonuses, max 60%. A crit deals **150%** damage (more with crit-damage bonuses).

**Damage** = weapon roll × (100 + damage% + vs-type%)/100 → ×150% if crit → minus (target ARM/10 − Pierce) → × (100 + damage-taken%)/100. Minimum 1.

**Movement**: ticks per tile = 8 − (SPD/20), between 2 and 8. Speed 35 → 7 ticks, 55 → 6, 65 → 5. Tactics speed this up or slow it down. Soldiers falling back to an exit move 1 tick per tile faster.

**Panic** (when hit hard, an ally goes Down nearby, or a hazard triggers): chance = 25 + pressure − GRT/2, reduced by morale bonuses, clamped 0–75%.

**Spotting a stealthed unit** (per check, in line of sight): 40 + observer TEC/4 + detection bonus − target STL − 3 per tile. Clamped 3–90%.

Examples (Aim-50 rifleman vs Speed-45 target): open ground at 5 tiles 74%, half cover 54%, full cover 34%, open at 12 tiles 58%. A 15-damage rifle shot into 20 Armor deals 13 (20 on a crit).

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

**Death chance when Downed** = base by ship tier (12% / 18% / 25%) + 1% per 30 ticks (about 4 seconds) spent Down (max +20%) + up to 15% for overkill damage, then reduced by survival bonuses. It **never goes below 5%**. Max 85%.

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
| Teleport | 4 | A room 3 doors from the bridge (closer if none) | Calm | 6% per Soldier to scatter to a random room, 5 s late (more vs shields) |
| Boarding Shuttle | 6 | Airlock | Alert | +5 Grit, +5 Armor; shuttle stays docked for the retreat |
| Breaching Pod | 4 | Hull room nearest the bridge (never the bridge itself) | Alert | +5% damage; stuns the room 5 s; vacuum in that room for 7.5 s (2 dmg every 1.25 s) |
| Vent Crawl | 3 | 2–4 doors from the bridge | Calm | Starts hidden; +15 Stealth, +15% damage, +10% crit |

3. **Squad**: up to the entry's cap. Soldiers with a major injury can't deploy.
4. **Tactic**

| Tactic | Style | Modifiers | Retreats at |
|---|---|---|---|
| Balanced | Even | +5 Aim, +10 Grit | 50% casualties |
| Blitz | Fast, close, loud | +10% damage, +20% damage taken, −5 Aim | 60% |
| Slow & Steady | Room by room, cover | +40% cover, −15% damage taken, +10 Grit | 40% |
| Stealthy | Avoid fights, go for objective | +20 Stealth, +10% crit, −10 Grit; starts hidden | 50% |
| Sharpshooting | Hold sightlines | +10 Aim, +1 range, −15% damage at 2 tiles or less | 50% |

5. **Retreat plan** (triggers automatically at the tactic's casualty threshold, or at the time limit)

| Retreat | Exit | Risk |
|---|---|---|
| Teleport Recall | Anywhere, 2.5 s | 8% per standing Soldier of a misfire (stuck 7.5 s longer). Downed Soldiers are harder to lock onto: 16% each to be **left behind**. Shields add to both. |
| Back to the Shuttle | Airlock if you came by shuttle, otherwise the hull room nearest the squad | Shuttle takes 10 s to arrive unless already docked. Soldiers take 25% less damage while falling back. Nobody gets lost. |
| Escape Pods | Pod bay | Soldiers take 45% less damage while running for the pods. 10% per Soldier to drift: Missing for 30 min. |
| Rear Guard | Everyone else gets out in under a second | The highest-Grit Soldier stays and fights for 15 s, then tries to get out. |

For Shuttle and Escape Pods, the squad drags its Downed along: as soon as one Soldier reaches the exit, every Downed squadmate comes out with them. If nobody makes it, everyone Downed is left behind.

**Pairing tip:** Blitz doesn't retreat until 60% casualties. With a walk-out retreat (Shuttle, Pods) that can mean one Soldier trying to get everyone home.

## 8. Ships

| Ship | Faction | Tier | Rooms | Crew | Reinforcements | Turrets | Locked doors | Reward |
|---|---|---|---|---|---|---|---|---|
| Cargo Hauler | Corporate Security | 1 | 8–10 | 8 pts + Chief + 2–4 crew | 1 wave (4 pts) | 1 | 10% | 220 |
| Pirate Raider | Void Pirates | 2 | 9–11 | 20 pts + Captain | 2 waves (6 pts) | 1 | 15% | 380 |
| Patrol Corvette | Fleet Marines | 3 | 10–12 | 22 pts + Lieutenant | 3 waves (5 pts) | 2 | 30% | 600 |

- Crew is spread through the ship; about 1 in 5 starts on the bridge. Reinforcements only arrive once the ship is at full alarm.
- **Alarm:** gunfire, breaching and being spotted raise it. Level 1 (alert) wakes nearby crew; level 2 (full alarm) sends everyone hunting the squad and starts reinforcements.
- Primary objective: **take the bridge**: have a Soldier on the bridge with no defenders left there for 15 seconds in total (the timer pauses while defenders are present).
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
| Decompression | 2 dmg every 1.25 s for 7.5 s (Breaching Pod arrival room) |
| Radiation Leak | 1 dmg every 2.5 s, whole mission (reactor rooms) |
| Fire | 4 dmg every 1.25 s, panic checks, 10 s (started by Flamer hits) |

## 9. BUCs

Your roster, BUCs, packs and Store purchases live on the server (sign in to play). Missions are fought on the server with a fresh random seed, then replayed in your browser from that same seed, so what you watch is exactly what happened.

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

- After **12 item packs** in a row without a Relic, the next one is guaranteed one.
- Packs never contain Xeno gear (alien ships only).
- Recruit grades: Rookie (level 1, 65%), Seasoned (level 3, 26%), Veteran (level 5, 7.5%), Elite (level 8, 1.5%).

### Store

- Daily rotation (midnight Pacific): 6 items + 2 Soldiers, the same for every player. Each can be bought once per player per day.
- Item prices: Standard 60, Mil-Spec 150, Prototype 400, Relic 1,100. Xeno is never sold.
- Soldier prices: Rookie 150, Seasoned 400, Veteran 900, Elite 2,000.
- Selling returns 25%. Roster cap: 24 Soldiers.

## 8b. Alien ships

Six alien ships, each with one signature mechanic. All alien units are **Xeno** (Xeno-Bane affixes and the Mk.41 Pulse Rifle hit them harder). A successful boarding has a chance to drop **Xeno gear**, which you can't get anywhere else.

| Ship | Faction | Tier | Reward | Signature mechanic | Xeno drop |
|---|---|---|---|---|---|
| Fungal Derelict | Mycelid Bloom | 2 | 420 | **Spores**: a quarter of the rooms are spore-filled and Spore Puffers pulse more. A Soldier who breathes them may be **Confused** for 4 s and fire at whoever is nearest, friend or foe (Grit resists). The Bloom Mother grows new Shamblers | 30% |
| Gravity Anomaly | Drifters | 2 | 400 | **Shifting gravity** every 15 s: normal, then HEAVY (Soldiers move 3 ticks/tile slower and aim worse), then normal, then ZERO-G (faster, but nobody gets cover). Drifters are used to it | 25% |
| Hive Ship | The Hive | 3 | 650 | **Egg pods** hatch Hive Drones when a Soldier comes within 3 tiles (and on their own at full alarm). **Acid blood**: killing a Hive creature in melee range splashes acid on adjacent Soldiers. The Queen keeps birthing drones | 40% |
| Crystal Spire | The Lattice | 3 | 640 | **Ricochets**: half of all missed shots glance into someone within 3 tiles of the target, friend or foe. Prisms shield their room (-25% damage). The crystal field adds 25% to teleport misfires | 40% |
| Void Hulk | Void Wraiths | 3 | 640 | **Darkness**: the squad only sees 6 tiles (+4 with a Motion Tracker, +2 with Tech 60+) and panics more easily. Shades are invisible until they strike, and The Reaper hunts the squad wherever it goes | 40% |
| Parasite Ship | The Thrall | 3 | 660 | **Possession**: a Soldier left Down for 12.5 s rises as a possessed enemy at half health. Down them again to free them. Possessed Soldiers can't be extracted, so a retreat leaves them aboard | 40% |

Alien natural weapons (claws, acid spit, crystal beams, psychic screams) never appear in packs, the Store or your Armory.

## 9b. Ladder

**Weekly Contract.** Each week (Monday 00:00 to Monday 00:00, Pacific time) one ship is chosen from the Deploy list by the week itself, along with a fixed map. Every commander boards that same ship on that same map; you choose the squad, entry, tactic and retreat, and the fight itself rolls fresh each time. Contract runs are ordinary missions (normal BUCs, injuries and permadeath) and can never turn out to be an unknown contact.

Your **best** run of the week is your leaderboard entry. Score:

| | Points |
|---|---|
| Take the ship | +1000, plus 4 for every second under the 90-second retreat deadline |
| Each optional objective completed | +150 |
| Each enemy killed | +10 |
| Each Soldier who went Down (even if they lived) | −40 |
| Each Soldier left aboard | −150 |
| Each Soldier killed | −300 |

Scores can go below zero, so even a failed run ranks against other failed runs. Anyone's leaderboard run can be watched: it replays the exact mission in your browser.

**Career board.** Lifetime totals for every commander: ships taken, missions, kills, alien ships taken, BUCs earned, best Soldier level, Soldiers lost, and how many unknown contacts they've identified.

## 10. Balance targets and current results

From `node test/balance.mjs` (Engine v2; alien ships with 40–60 runs per combination). Each ship is tested with the squad a player would realistically bring.

| Ship | Test squad | Success (all entries and tactics) | KIA per mission | Average successful mission, fastest to slowest entry |
|---|---|---|---|---|
| Cargo Hauler | Starter squad, level 1, Standard gear | 65% | 0.20 | 53–71 s |
| Pirate Raider | Level 5, Mil-Spec, full kit (grenades, smoke…) | 63% | 0.19 | 56–75 s |
| Patrol Corvette | Level 9, Prototype, full kit | 45% | 0.43 | 58–77 s |
| Fungal Derelict | Level 5, Mil-Spec | 58% | 0.23 | 56–76 s |
| Gravity Anomaly | Level 5, Mil-Spec | 54% | 0.29 | 58–75 s |
| Hive Ship | Level 9, Prototype | 48% | 0.37 | 55–77 s |
| Crystal Spire | Level 9, Prototype | 47% | 0.52 | 59–80 s |
| Void Hulk | Level 9, Prototype | 44% | 0.51 | 55–75 s |
| Parasite Ship | Level 9, Prototype | 51% | 0.26 | 60–77 s |

- Averaged over the other choices, every entry method and every tactic lands between 34% and 77% on every ship, so there's no dead option. Individual combinations range wider (16–93%): some pairings really are bad, like a Slow & Steady shuttle boarding of the Corvette (16%): it gives the Marines all the time they need.
- Vent Crawl is the riskiest entry; the Boarding Shuttle is the safest on small ships and the weakest against the Corvette (the Marines expect it).
- On the Void Hulk the Boarding Shuttle is by far the best entry (70%): a big squad together in the dark beats a small one feeling its way.

## 11. Special effects

How every perk and item special works in the engine (`node test/effects.mjs` proves each one triggers).

**Perks**

| Perk | Specialty | Effect |
|---|---|---|
| Run and Gun | Assault | +5 Aim; fires a free shot each step while advancing on a target |
| Bayonet Drill | Assault | Charge stuns the target for about 2 s |
| Adrenaline | Assault | +15% damage below half HP |
| Spearhead | Assault | Entering a room the squad hasn't been in: −25% damage taken for 5 s |
| Killing Spree | Assault | Each kill halves the time left on Charge's cooldown |
| Shaped Charges / Concussive | Breacher | Breach Charge 40% faster / stun twice as long |
| Door Ram | Breacher | +10 Armor; +10% damage to targets in or next to a doorway |
| Close Quarters | Breacher | +15% damage at 2 tiles or less |
| Chain Breach | Breacher | Breach Charge also blows the next closed door toward the bridge, stunning that room too |
| Kill Zone | Marksman | Overwatch fires up to 3 times |
| Ghost Sniper | Marksman | +20 Stealth; shots don't reveal a hidden Marksman |
| Combat Stims | Medic | Healed or revived allies deal +20% damage for 5 s |
| Smoke Cover | Medic | Reviving pops smoke: 3×3 area counts as full cover for 7.5 s |
| Guardian Angel / Bedside Manner | Medic | Whole squad: −15% death chance / injuries heal 25% faster |
| Turret Whisperer | Tech | Hacked turrets fight for the squad |
| Hazard Control | Tech | Shuts down hackable hazards in the Tech's room (uses the Hack cooldown) |
| Combat Drone | Tech | Starts with a drone (40 HP, Aim 45, SMG) that follows the Tech and fights; it can be destroyed |
| System Crash | Tech | Once the Tech is on a quiet bridge, reinforcements stop |
| Immovable | Heavy | Never panics |
| Walking Fortress | Heavy | Allies within 2 tiles take 15% less damage |
| Bullet Storm | Heavy | Suppressing Fire deals full damage instead of half |
| Backstab | Infiltrator | Attacks from stealth always crit |
| Saboteur | Infiltrator | Plants a charge on a turret within reach (2.5 s) to destroy it. With nothing in sight, rigs a nearby reactor (5 s): every enemy turret shuts down and every locked door opens |
| Vanish / Ghost Protocol | Infiltrator | Auto-Cloak below 30% HP / Cloak lasts 50% longer |

**Items**

| Item | Effect |
|---|---|
| Frag Grenades | 2 per mission. Thrown at a group of at least 2 enemies 2–6 tiles away: 16–24 damage to everything in a 3×3 blast (armor still applies, cover doesn't). Loud |
| Smoke Grenades | 1 per mission. Popped automatically when the carrier drops below 60% HP: 3×3 full cover for 7.5 s |
| Motion Tracker | +40% detection. The first time each enemy walks into view within 10 tiles of the carrier, the nearest Soldier gets a free shot |
| Martial Arts Download | +25% melee damage; +20 evasion against melee attacks |
| Personal Shield Belt | +30 Armor, but melee attacks ignore the wearer's armor completely |
| Flamer (weapon type) | Each hit has a 15% chance to set the target's room on fire (Fire hazard) |

## 12. Service record and commendations

Every Soldier keeps a service record: missions, ships taken, kills, times Downed, death rolls survived, revives given and injuries. Commendations are awarded automatically after a mission (posthumously, too).

| Commendation | How to earn it |
|---|---|
| First Blood | First kill |
| Combat Ribbon | 25 kills |
| Centurion | 100 kills |
| Boarding Badge | Part of 5 successful boardings |
| Ship Breaker | Part of 25 successful boardings |
| Veteran | 10 missions |
| Old Guard | 30 missions |
| Purple Star | Wounded in action |
| Cheated Death | Went Down and survived the death roll |
| Nine Lives | Survived 3 death rolls |
| Guardian Angel | Revived 5 squadmates |
| Last Out | Volunteered as rear guard |
| Lone Survivor | The only one of a squad of 3 or more to come home |
| Natural Talent | Had a Breakthrough level-up |
| Lost and Found | Went Missing and found the way home |

**Fleet Command replacement:** if you can't field 2 Soldiers and can't afford a Rookie (150 BUCs), a free Rookie arrives with a standard weapon and a Flak Vest. At most once every 10 minutes.

**Gear of the fallen:** a Soldier who dies after being carried out comes home with their gear (it returns to the Armory). A Soldier left aboard loses their gear with them.

## 13. Not implemented yet

- Decompression does damage but doesn't pull anyone toward the breach yet.
