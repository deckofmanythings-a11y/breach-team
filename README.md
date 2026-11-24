# Breach Team

Starship boarding-party autobattler. Build a stable of Soldiers, pick a target ship, entry method, tactic and retreat plan, then watch the boarding action play out top-down.

- `docs/PLAN.md`: design and build phases
- `docs/CODEX.md`: every rule and number (keep in sync with `js/data/`)
- `js/data/`: game data (integer-only, shared with the server later)
- `js/engine/`: deterministic RNG + progression/loot rolls

Check the data: `npm run check`

Status: Phase 6 (art pass: painted tokens, ship floors) done. Ver. 0.4.0.

Art: `node tools/art/gen.mjs --only <ids> --variants N` (needs ComfyUI on :8188), review in tools/art/sheet.html, set picks in tools/art/pick.py and run it. Local render test: tools/art/mission-test.html?ship=raider.

Server: `supabase/functions/boarding-api` on the raided-hex project (bp_ tables). Deploy: `node scripts/sync-engine.mjs` then `supabase functions deploy boarding-api --project-ref uaoxvhihwiygrajicend --no-verify-jwt --use-api`, then push the client right away.

Run locally: `python -m http.server 4395` in this folder, open http://localhost:4395 (launch config "breach-team").

Tests: `npm run check` (data), `node test/determinism.mjs`, `node test/balance.mjs [runs] [ship]`, `node test/retreats.mjs [runs] [tactic]`
