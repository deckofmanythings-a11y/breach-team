# Breach Team

Starship boarding-party autobattler. Build a stable of Soldiers, pick a target ship, entry method, tactic and retreat plan, then watch the boarding action play out top-down.

- `docs/PLAN.md`: design and build phases
- `docs/CODEX.md`: every rule and number (keep in sync with `js/data/`)
- `js/data/`: game data (integer-only, shared with the server later)
- `js/engine/`: deterministic RNG + progression/loot rolls

Check the data: `npm run check`

Status: Phase 3 (playable loop, placeholder graphics, local save) done.

Run locally: `python -m http.server 4395` in this folder, open http://localhost:4395 (launch config "breach-team").

Tests: `npm run check` (data), `node test/determinism.mjs`, `node test/balance.mjs [runs] [ship]`, `node test/retreats.mjs [runs] [tactic]`
