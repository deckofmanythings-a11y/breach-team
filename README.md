# Breach Team

Starship boarding-party autobattler. Build a stable of Soldiers, pick a target ship, entry method, tactic and retreat plan, then watch the boarding action play out top-down.

- `docs/PLAN.md`: design and build phases
- `docs/CODEX.md`: every rule and number (keep in sync with `js/data/`)
- `js/data/`: game data (integer-only, shared with the server later)
- `js/engine/`: deterministic RNG + progression/loot rolls

Check the data: `npm run check`

Status: Phase 1 (data + codex) done. No UI yet.
