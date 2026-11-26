# Breach Team — Design & Build Plan

Starship boarding-party autobattler. Player manages a stable of Soldiers, picks a target ship and a boarding plan, then watches a 2D top-down simulation of the boarding action.

## Locked decisions (2026-11-24)

| Topic | Decision |
|---|---|
| Name | **Breach Team** |
| Healing | Injuries heal in **minutes** (same feel as Kaiju Clash) |
| Permadeath | **On, on ANY mission.** Death is always a possible outcome, even on easy ships |
| Mission length | **60–90 s** of playback at 1× speed |
| Backend | raided-hex Supabase project, tables prefixed **`bp_`**, Edge Function `boarding-api` |

## Stack (mirrors Kaiju Clash)

- Static ES modules on GitHub Pages; visible `APP_VERSION` + player-facing changelog.
- **Deterministic integer-only engine**: `(ENGINE_VERSION, seed, ship, loadout snapshot, mothershipBonuses)` → event log. Server re-simulates to validate ladder results; replays are free; headless balance tests in `test/*.mjs`.
- **Renderer**: PixiJS, 2D top-down, plays back the engine event log only — never decides outcomes.
- **Server-authoritative**: BUC balance, pack rolls, store purchases, heal timers, aftermath (injury/death) rolls, ladder submissions.
- **Art**: Sprite Forge paper-doll layers for Soldiers (body/armor/helmet/weapon, tinted by player colors); ComfyUI for enemies/tiles. No flat generated SVG.

## Soldiers

- Specialties: Assault, Breacher, Marksman, Medic, Tech, Heavy, Infiltrator.
- Stats: HP, Aim, Armor, Speed, Grit (morale), Tech, Stealth.
- Customization: name, sex (sprite body set), primary/secondary color, optional callsign.
- Leveling: XP from mission + actions; random stat rolls on level-up weighted by specialty, rare "breakthrough" bonus. Perk choice (1 of 2) at levels 5/10/15.
- Aftermath (deterministic from battle record): Healthy / Wounded / Critical / KIA. Heal timers in minutes. KIA → Memorial Wall.
- Permadeath risk exists on every mission; difficulty scales the odds, never zeroes them.

## Equipment

- Slots: Weapon, Armor, Utility, Implant.
- Rarity: Standard → Mil-Spec → Prototype → Relic → Xeno (Xeno drops only from alien ships).
- Higher rarity = better base + affixes (e.g. "+10% vs Synthetics").

## Economy (BUCs)

- Earned per mission (ship class × difficulty + cargo bonus). Retreats pay partial salvage.
- Spent on Booster Packs (Recruit / Armory / Mixed, tiered with rarity floors, pity timer) and a rotating daily Store.
- Any daily cap needs loud UI banners.

## Pre-mission decisions (engine inputs)

1. **Target ship** — hauler, corvette, pirate raider, frigate, research vessel, derelict, alien hulls.
2. **Entry** — Teleport (anywhere, scramble risk), Shuttle (airlock, full squad, loud), Breaching Pod (any section, stun + decompression), Vent Crawl (stealth, small squad).
3. **Squad** — size capped by entry method.
4. **Tactic** — Blitz, Slow & Steady, Balanced, Stealthy, Sharpshooting (AI weight profiles).
5. **Retreat** — Teleport recall (misfire risk), Back to Shuttle (fight to dock), Escape Pods (random exit), Rear Guard (one volunteer covers). Auto-triggers on casualty threshold or objective impossible.

## Simulation

- Procedural ship from room templates on a tile grid (doors, cover, terminals, hazards).
- Objectives: take the bridge + optional (cargo, captain, data core).
- Tick-based: LOS, cover, tactic weights → move / shoot / ability / interact.
- Defender escalation: alarm levels, reinforcements, turrets.
- Result withheld until playback ends.

## Factions (one silhouette + one palette + one movement style each)

- Pirates (rust/orange, erratic), Corporate Security (white/teal, shields, formation), Military (olive/grey, cover), Synthetics (chrome/red eyes, no morale).
- Alien hulls: Hive (eggs hatch, acid blood), Fungal (spores → friendly fire), Crystal (ricochet walls, teleport scramble), Void Wraith (darkness, hunter), Gravity Anomaly (shifting gravity), Parasite (downed soldiers turn).

## Ladder

1. **Weekly Contract** — same seeded ship for everyone; score = objectives, time, casualties. Server re-sim validates.
2. **Career board** — lifetime stats (ships taken, success %, BUCs, soldiers lost, longest-serving veteran).
- Click a rival's best Contract run to watch the replay.

## Easter eggs

- Homages only: parody names, paraphrased lines, suggestive silhouettes — no real names/logos/art.
- Rare secret ships (~5%) never named in UI until encountered (Kaiju Clash Wild-frame pattern).
- Central registry: `js/data/easter-eggs.js`.

## Mothership (future)

- Reserve now: `bp_mothership` table + `mothershipBonuses` engine input (zeroed) so no engine migration later.
- Facilities: Med Bay, Training Deck, Armory, Teleporter Array, Hangar, Intel Room.

## Build phases

1. Design + data files (stats, specialties, gear, tactics, 3 ship classes) + codex.
2. Headless engine (mapgen, sim, aftermath) + determinism & balance tests.
3. Playable loop with placeholder graphics (roster, pre-mission, report, local save).
4. Progression: leveling, injuries/heal timers, permadeath, Memorial Wall.
5. Server: auth, `bp_` tables, `boarding-api`, BUCs, packs, store, server re-sim.
6. Art pass: Sprite Forge soldiers + faction sprites + tiles + FX.
7. Content: alien ships/hazards, more classes, secret ships, easter eggs.
8. Ladder: Weekly Contract + Career, replay viewer.
9. Mothership: see docs/MOTHERSHIP.md.
