// Player-facing changelog ("What's new"). Add an entry with EVERY version bump.
// Never mention hidden easter eggs here.
import { el, esc, modal, closeModal } from './ui.js';

export const CHANGELOG = [
  { v: '0.7.7', date: '2026-11-25', items: [
    "XP numbers now match the XP bar: they count progress through the current level (e.g. 130/400 toward Level 6) instead of total XP against the next level's total, which made bars look far emptier than the numbers. Total XP is still on the Soldier's page and in the tooltip.",
  ] },
  { v: '0.7.6', date: '2026-11-25', items: [
    "Accent colours now match the class: every Assault wears the same accent, every Medic another, and so on (level badge, card trim and map token), so you can tell classes apart at a glance.",
    "Pick each class's accent with the new Class colours button in the Barracks, or from the Accent picker on any Soldier's page (it changes the whole class). Armour colour is still yours to set per Soldier.",
  ] },
  { v: '0.7.5', date: '2026-11-25', items: [
    "Fixed XP bars for Soldiers hired above Level 1 (Seasoned, Veteran and Elite recruits): they started with no XP, so their bar sat empty until they had earned back the levels they were hired at. They now start with the XP for their level, and existing Soldiers have been corrected.",
  ] },
  { v: '0.7.4', date: '2026-11-25', items: [
    'Strip all Equipment: a new button on the Armory screen takes every piece of gear off every Soldier at once (after you confirm). Built-in enhancements stay put.',
    "Commendations on a Soldier's page are folded away by default. Earned ribbons still show; click the heading to see the full list.",
    "Changing a Soldier's gear no longer jumps their page back to the top.",
  ] },
  { v: '0.7.3', date: '2026-11-24', items: [
    "The Cargo Hauler is easier, as a one-star ship should be: no defence turret and a smaller security team. A fresh Level 1 squad now takes it about 85% of the time (it was closer to 65%), and losses are much rarer.",
    'Hired Rookies now report with a standard-issue weapon and armour for their specialty, instead of turning up with a sidearm and no armour.',
  ] },
  { v: '0.7.2', date: '2026-11-24', items: [
    'Mission map camera: drag to pan, scroll the mouse wheel or pinch to zoom, double-click to zoom in. The + / − buttons zoom too, and the percentage button snaps back to the whole ship.',
    'Ship walls are now painted: every faction has its own bulkhead plating, with raised edges and shadows so rooms and corridors read at a glance.',
  ] },
  { v: '0.7.1', date: '2026-11-24', items: [
    "Stats are colour-coded against a new Soldier's starting values for that specialty: red below, white about the same, green higher, gold exceptional. Hover or long-press a stat for the exact numbers.",
    'Levels now stand out: a big level medallion on every Barracks card and Soldier page, and smaller ones in Deploy, the Store and the Memorial.',
  ] },
  { v: '0.7.0', date: '2026-11-24', items: [
    'New Home page: your commander at a glance, with your top Soldiers, service record, the current contract, your last mission and quick links.',
    'Restart Account (on the Home page): wipe all progress and start over with a fresh squad.',
    'Game Over: if a mission ends with no living Soldiers, your commander is relieved. A new commander takes over with a fresh crew and starting BUCs, and the Memorial Wall carries over.',
    'Sound effects: gunfire for every weapon type, breaching charges, alarms, alien screams, pack openings, victory and defeat stingers. Use the speaker button in the top bar to mute or set the volume.',
    'Hover over (or long-press) any item to see exactly what it and each of its affixes do. The equipped item’s affixes also show under each gear slot.',
    "Eight faces for every Soldier: recruits now come from all over Earth, with many more names. Pick a Soldier's face on their page.",
  ] },
  { v: '0.6.4', date: '2026-11-24', items: [
    'Bigger Barracks cards: each Soldier now shows their full painted portrait in their own colours, with larger, easier-to-read stats.',
  ] },
  { v: '0.6.3', date: '2026-11-24', items: [
    'Small text fixes.',
  ] },
  { v: '0.6.2', date: '2026-11-24', items: [
    'Fleet R&D has requested access to the Memorial Wall records. Request approved.',
  ] },
  { v: '0.6.1', date: '2026-11-24', items: [
    'The Weekly Contract is now a 72-Hour Contract: a new ship and map every 3 days, resetting at midnight Pacific.',
    'Vent Crawl, explained: a stealth insertion where a handful of small one-man pods enter through the hull into the service tunnels of the ship.',
  ] },
  { v: '0.6.0', date: '2026-11-24', items: [
    "New Ladder tab. The Weekly Contract: every commander boards the same ship on the same map each week (it changes Monday, Pacific). Your best run is scored and ranked.",
    "Watch any run on the contract leaderboard: it replays the exact mission in your browser.",
    "Career board: compare ships taken, kills, alien ships taken, BUCs earned, best Soldier level and more with everyone else.",
    "Contract runs are real missions: normal rewards, and Soldiers can still die.",
  ] },
  { v: '0.5.0', date: '2026-11-24', items: [
    'Six alien ships to board: the Fungal Derelict, Gravity Anomaly, Hive Ship, Crystal Spire, Void Hulk and Parasite Ship. Each has its own deadly trick: spores that turn Soldiers on each other, shifting gravity, hatching eggs and acid blood, ricocheting shots, total darkness, and parasites that take over the Downed.',
    'Xeno gear: the rarest equipment in the game, found only by taking alien ships.',
    'Achievements: four of them, tracked in the Mission Log.',
    'Your Soldiers now say the odd familiar line at the right moment.',
    'Space is big. Not every contact is what it seems.',
  ] },
  { v: '0.4.0', date: '2026-11-24', items: [
    'Art pass: every Soldier and enemy now has a painted portrait token on the mission map.',
    "Your Soldier's armor colour is painted onto their portrait, and their accent colour is the ring. Change colours in the Barracks and the token updates instantly.",
    'Each enemy faction has its own ring colour (Pirates orange, Corporate teal, Marines grey), and leaders wear a gold star.',
    'Each ship class has its own deck: rusty pirate plating, clean corporate panels, olive military tread.',
    'Muzzle flashes and impact sparks; Downed units grey out with a red X.',
    'Portraits replace the initials everywhere: Barracks, Deploy, Store, Memorial.',
  ] },
  { v: '0.3.0', date: '2026-11-24', items: [
    'Online accounts: sign in to keep your roster on the server and play from any device. Old browser-only saves don\'t carry over: everyone starts with a fresh starter squad.',
    'Store: four Booster Packs (Recruit, Armory, Boarding Crate, Elite Crate) with guaranteed rarities, plus a daily stock of gear and recruits that is the same for every player.',
    'Pity guarantee: twelve item packs in a row without a Relic and the next one has one.',
    'Sell unequipped gear from the Armory for a quarter of its Store price.',
    'Missions are fought on the server, then replayed in your browser from the same seed.',
  ] },
  { v: '0.2.0', date: '2026-11-24', items: [
    'Commendations: Soldiers earn 15 different medals from their service record. See them on the Soldier page, their Barracks card and the Memorial Wall.',
    'Service record on every Soldier page: ships taken, kills, times Downed, death rolls survived, revives and injuries.',
    'The Memorial Wall now says how each Soldier fell.',
    'Level-ups that unlock a perk show a "Choose perk" button right on the mission report, and the Barracks reminds you who has one waiting.',
    'Fleet Command sends a free Rookie if you are broke and can\'t field two Soldiers (once every 10 minutes).',
    'Deploy warns you when you are about to send a very small squad.',
    'New Codex tab: every rule and number in the game.',
    'XP bars on Barracks cards.',
  ] },
  { v: '0.1.0', date: '2026-11-24', items: [
    'First playable version: Barracks, Deploy, mission playback, mission report, Mission Log replays, Armory and Memorial Wall.',
    'Three ships to board: Cargo Hauler, Pirate Raider and Patrol Corvette.',
    'Permadeath is on: any Soldier who goes Down can die, on any mission.',
  ] },
];

const SEEN = 'bt_seen_version';
export function showWhatsNew() {
  localStorage.setItem(SEEN, CHANGELOG[0].v);
  document.getElementById('whatsnew').classList.remove('new');
  const box = el(`<div class="box"><div class="spread"><h2>What's new</h2><button id="x">Close</button></div>
    ${CHANGELOG.map(c => `<h3>Ver. ${c.v} <span class="dim small">${c.date}</span></h3><ul>${c.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`).join('')}</div>`);
  box.querySelector('#x').onclick = closeModal;
  modal(box);
}
export function initWhatsNew(version) {
  const b = document.getElementById('whatsnew');
  b.onclick = showWhatsNew;
  if (localStorage.getItem(SEEN) !== CHANGELOG[0].v) b.classList.add('new');
}
