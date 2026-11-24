// Player-facing changelog ("What's new"). Add an entry with EVERY version bump.
// Never mention hidden easter eggs here.
import { el, esc, modal, closeModal } from './ui.js';

export const CHANGELOG = [
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
