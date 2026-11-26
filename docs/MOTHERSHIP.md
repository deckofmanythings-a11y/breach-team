# Mothership (Phase 9) plan

The squad's home ship: rooms and upgrades bought with **CREDs**, shown as a real, walkable map.
Rarely, that map becomes a battlefield: the Mothership is boarded (or something you brought home
gets loose) and every Soldier you have defends it.

Status: **plan, not built.** The design decisions are in section 7.

---

## 1. What already exists

Earlier phases reserved hooks for this, so the engine's input shape doesn't change:

- `js/data/mothership.js`: `MOTHERSHIP_ENABLED = false`, six placeholder facilities, and
  `ZERO_BONUSES = { mods, entry, retreat }`.
- `battle.js` already reads `input.mothership.mods` into every Soldier's squad-wide mods.
- `aftermath.js` already takes a `mothership` argument (`survivalPct`, `healTimePct`, `xpPct`).
- `commander.js` carries `g.mothership` across a Game Over, like the Memorial Wall.
- The stat vocabulary (`MOD_KEYS` in `stats.js`) is enforced by `test/data-check.mjs` and covers
  Mothership mods too.

## 2. CREDs (Capital Resource Exchange Denominations)

**Rule:** every XP point a Soldier earns on a mission adds 1 CRED to the commander's balance.
CREDs are separate from BUCs and are only spent on the Mothership.

- Earned server-side in `applyMission` (summing the aftermath XP), saved as `g.creds`, and shown in
  the top bar next to BUCs and on the mission report ("+184 CREDs").
- **Rate (measured, 180 missions per row, 4-Soldier squads):**

  | Squad | CREDs per mission |
  |---|---|
  | Level 1, Hauler | about 205 |
  | Level 5, Raider | about 204 |
  | Level 8, Corvette | about 170 |

  So it's very close to the "predictable" goal: about 200 per mission whatever the squad's level.
  Bigger squads earn more (6 Soldiers ≈ 300).
- **All XP counts**, bonuses included (Training Deck, Suicide Squad's +100%, gear and perks).
  1 XP = 1 CRED, no exceptions. The Training Deck's prices allow for it speeding up its own income.
- **Fallen Soldiers' XP counts too**: the CREDs are the XP shown on the report, including Soldiers
  who were Killed in Action.
- **Backfill:** existing commanders get a one-time grant on their first load after M1 ships. It's
  the XP banked by the roster and the Memorial, minus the XP each hired recruit started with
  (`xpToReach(starting level)`, from the recruit's grade when it's known, otherwise their hire
  level).
- CREDs carry over a Game Over with the Mothership.
- New file `js/data/creds.js` (stale-cache rule: new export names come from new files).

## 3. Rooms and upgrades

Each room has **3 levels**. Building it is level 1; upgrades raise the bonus. A room exists on the
map once built, and most rooms also change the defense battles (section 5).

**Starting rooms (free):** Bridge, Hangar/Airlock, Crew Quarters, corridors.

| Room | What it does (L1 / L2 / L3) | In a defense battle |
|---|---|---|
| **Med Bay** | Injuries heal 10 / 20 / 30% faster; L3: +5% death-roll survival | A Medic inside revives faster; Downed Soldiers carried here stabilise |
| **Training Deck** | +5 / 10 / 15% mission XP | Cover-heavy room; good fallback position |
| **Armory** | Store prices −5 / −10 / −15%; L2: +1 store item slot | Turret; Soldiers who fight here get a damage bonus |
| **Teleporter Array** | Teleport misfires −33 / −66 / −100% (entry and recall) | Lets Soldiers jump between Bridge and Array once |
| **Hangar upgrades** | L2: Boarding Shuttle carries +1; L3: shuttle retreat arrives 50% faster | Main breach point: attackers land here |
| **Intel Room** | Before boarding: L1 shows crew size, L2 shows optional objectives, L3 previews the map | Shows every attacker from the start (no ambushes) |
| **Security Post** | No mission bonus | 1 / 2 / 3 turrets on the Mothership; blast doors at L3 |
| **Quarantine Bay** | Lowers the chance of a parasite outbreak after alien ships | Outbreaks start contained in this room |
| **Memorial Chapel** | The Memorial Wall as a room; +5 Grit squad-wide per level | Grit bonus for defenders |

Mission bonuses go through the existing `input.mothership` shape (`mods` for squad-wide stats,
`entry`/`retreat` for teleport, shuttle and Hangar changes) and `aftermath`'s `mothership`
argument, so it's all deterministic and server-checked.

**Pricing target:** first room after about 3 missions; everything at L3 after about 150 missions.

| Level | Price (CREDs) | Missions at 200 per mission |
|---|---|---|
| Build (L1) | 600 | 3 |
| L2 | 1,800 | 9 |
| L3 | 4,000 | 20 |

That's 6,400 per room and about 57,600 for all nine at L3. Prices need tuning once the bonuses
are final.

## 4. The Mothership as a map

- **A fixed, hand-authored layout, not procedural.** One template grid with a slot for every room.
  Unbuilt slots are sealed hull sections (blank walls). Building a room fills its slot, so the
  ship visibly grows.
- `buildMothershipMap(state)` in a new `js/engine/mothership-map.js` returns the **same map
  structure** `generateShip` returns (tiles, rooms, doors, features, bridge, console, distance
  fields). The battle engine and the Pixi renderer then work on it unchanged.
- **Mothership screen** (new tab): the map drawn by the existing renderer (no playback). Tap a room
  or an empty slot to build or upgrade. Idle Soldiers stand around in Quarters and the rooms
  they'd use (flavour only).
- Room upgrades show on the map: L2/L3 adds features (turret mounts, extra cover, consoles).

## 5. Defense battles ("Boarded!")

### Scenarios

1. **Boarding party:** pirates or a rival faction breach the Hangar and one or two hull sections,
   in waves.
2. **Parasite outbreak:** after an alien-ship mission, something hitched a ride. It starts inside
   (Cargo, Med Bay or Quarantine Bay) and spreads using the existing egg/hatch and possession
   mechanics.
3. (Later) more, e.g. a saboteur, or a derelict that docks and wakes up.

### How a defense battle plays

- **Who fights:** every Soldier on board. Missing Soldiers are away and miss it. Wounded Soldiers
  fight with a penalty.
- **Objective (inverted):** the attackers try to reach and hold the **Bridge** (outbreak: to infect
  enough rooms). The squad wins by killing every wave or surviving to the end of the timer, and
  loses if the Bridge is held long enough or everyone is Down.
- **No retreat**: it's home. Downed Soldiers roll death rolls as normal.

### Triggers

- Rolled server-side after each mission. Low base chance with a cooldown, nothing during the first
  N missions, and higher after alien ships (Quarantine Bay lowers it).
- **It's fought right away**: the defense plays automatically straight after the mission report
  that triggered it ("Incoming: the Mothership is being boarded!"). There's no time to heal or
  hire first. Soldiers just back from the mission fight too, with their fresh injuries.
- The server simulates both battles in the same `deploy` call, so the player can't dodge a defense
  by closing the tab.

### Stakes

- **Win:** BUCs and CREDs salvage, a chance of gear from the boarders, and an achievement.
- **Loss:** deaths from death rolls, a chunk of BUCs stolen, and 1–2 rooms **damaged**. A damaged
  room's bonus is off until it's repaired with CREDs.
- **Fully deadly:** the normal permadeath rules apply. If every Soldier dies, it's a Game Over (the
  Mothership, its rooms and the CREDs carry over to the next commander as usual).
- Because it's fought right away and can end a run, the trigger chance must stay genuinely rare.
  Balance target: a well-built Mothership should win most defenses.

### Engine work (the biggest piece)

- `ENGINE_VERSION = 5`, with `input.mode = 'defend'`. Everything gated so old replays stay
  identical (the same 480-case hash check used for Suicide Squad).
- New pieces in the engine:
  - squad placement in their rooms
  - an attacker AI that pushes for the Bridge
  - wave spawns at breach points
  - the inverted win/lose check
  - Mothership turrets and features
- The same event log means replay, playback and server validation all keep working.

## 6. Build phases

| # | Phase | Size |
|---|---|---|
| M1 | **CREDs:** earn on missions, save, top bar, report, changelog. Backfill if wanted (Q3). | Small |
| M2 | **Rooms:** room data, build/upgrade/repair API action, mission bonuses wired in, Mothership tab with room cards. | Medium |
| M3 | **The map:** fixed layout, `buildMothershipMap`, map view with tap-to-build. | Medium |
| M4 | **Defense engine (v5):** headless only, with determinism and balance tests. | Large |
| M5 | **Defense events:** triggers, pending alert, playback, aftermath (room damage, theft, salvage). | Medium |
| M6 | **Polish:** art for Mothership tiles and rooms, SFX, codex, achievements. | Medium |

M1–M2 already give players something to spend CREDs on. M3 makes it a place, and M4–M5 make it
dangerous.

## 7. Decisions (2026-11-25)

1. **Trigger flow:** fought right away, straight after the mission that triggered it.
2. **Worst case:** fully deadly. A lost defense that kills everyone is a Game Over.
3. **Backfill:** yes, a one-time CRED grant from XP already banked.
4. **Bonus XP:** all XP becomes CREDs, bonuses included.
