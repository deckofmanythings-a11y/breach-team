// Player-facing changelog ("What's new"). Add an entry with EVERY version bump.
// Never mention hidden easter eggs here.
import { el, esc, modal, closeModal } from './ui.js';

export const CHANGELOG = [
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
