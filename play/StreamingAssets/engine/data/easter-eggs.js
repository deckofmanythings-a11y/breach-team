// Easter-egg registry: every sci-fi movie homage in the game, in one place.
//
// RULES
// - Homages only: parody names, paraphrased lines, suggestive looks. Never a real character name,
//   logo, ship name or art. The game is public on GitHub Pages.
// - `source` is for US, never shown to players. Don't put it in any player-facing text.
// - `hidden: true` eggs (secret ships, secret recruits) must not be named anywhere in the UI,
//   changelog, codex or hints until the player has met them (Kaiju Clash rare-Wild rule).
//
// kind: 'item' (gear.js `egg` field) | 'recruit' | 'bark' (soldier voice line) | 'ship' (secret
//       encounter, Phase 7) | 'loot' | 'achievement' | 'log' (ship log flavour text)

export const EASTER_EGGS = [
  // ---- Items (defined in gear.js) ----
  { id: 'pulse_rifle',      kind: 'item', source: 'Aliens' },
  { id: 'smartgun',         kind: 'item', source: 'Aliens' },
  { id: 'motion_tracker',   kind: 'item', source: 'Aliens' },
  { id: 'loader_frame',     kind: 'item', source: 'Aliens' },
  { id: 'plasma_40w',       kind: 'item', source: 'The Terminator' },
  { id: 'citizen_rifle',    kind: 'item', source: 'Starship Troopers' },
  { id: 'hand_blaster',     kind: 'item', source: 'Star Wars' },
  { id: 'white_armor',      kind: 'item', source: 'Star Wars' },
  { id: 'hum_blade',        kind: 'item', source: 'Star Wars' },
  { id: 'detective_cannon', kind: 'item', source: 'Blade Runner' },
  { id: 'red_button',       kind: 'item', source: 'The Fifth Element' },
  { id: 'phase_pistol',     kind: 'item', source: 'Star Trek' },
  { id: 'plasma_caster',    kind: 'item', source: 'Predator' },
  { id: 'shield_belt',      kind: 'item', source: 'Dune' },
  { id: 'towel',            kind: 'item', source: "The Hitchhiker's Guide to the Galaxy" },
  { id: 'combat_download',  kind: 'item', source: 'The Matrix' },
  { id: 'precog_lens',      kind: 'item', source: 'Minority Report' },

  // ---- Rebuilt fallen (js/game/cyborg.js): a dead Soldier returns from a pack as a walking life-support machine ----
  { id: 'cyborg_operator', kind: 'revive', source: 'Warhammer 40,000 Dreadnought / RoboCop', hidden: true },

  // ---- Rare recruits (show up very rarely in packs; fixed look, rolled stats) ----
  { id: 'rec_wisecrack',  kind: 'recruit', source: 'Aliens', hidden: true,
    data: { name: 'Pvt. Hutson', specialty: 'tech', sex: 'm', note: 'Panics early, keeps talking, never stops shooting.' } },
  { id: 'rec_tough',      kind: 'recruit', source: 'Aliens', hidden: true,
    data: { name: 'Pvt. Vascoe', specialty: 'heavy', sex: 'f', note: 'Smartgunner. Has been mistaken for an illegal alien.' } },
  { id: 'rec_warrant',    kind: 'recruit', source: 'Alien', hidden: true,
    data: { name: 'W.O. Rippon', specialty: 'assault', sex: 'f', note: 'Survivor. Huge Grit bonus against xeno ships.' } },
  { id: 'rec_mobile',     kind: 'recruit', source: 'Starship Troopers', hidden: true,
    data: { name: 'Cpl. Johnny Rizzo', specialty: 'assault', sex: 'm', note: 'Mobile infantry made me the man I am.' } },
  { id: 'rec_dutch',      kind: 'recruit', source: 'Predator', hidden: true,
    data: { name: 'Maj. "Dutch" Shepherd', specialty: 'heavy', sex: 'm', note: 'Bleeds. Therefore can be patched up.' } },
  { id: 'rec_trooper',    kind: 'recruit', source: 'Star Wars', hidden: true,
    data: { name: 'Trooper KT-412', specialty: 'marksman', sex: 'm', note: 'Keeps wandering away from his post.' } },
  { id: 'rec_multipass',  kind: 'recruit', source: 'The Fifth Element', hidden: true,
    data: { name: 'Maj. Korby Dale', specialty: 'assault', sex: 'm', note: 'Ex-special forces cab driver. Has a multipass.' } },

  // ---- Barks (voice lines). Paraphrased; trigger = engine event ----
  { id: 'bark_game_over', kind: 'bark', source: 'Aliens',            data: { trigger: 'squadDownToOne', text: "That's it, man. Game over! ...Wait, we're still going?" } },
  { id: 'bark_bleed',     kind: 'bark', source: 'Predator',          data: { trigger: 'woundedBigEnemy', text: 'It bleeds. We can do this.' } },
  { id: 'bark_bad_feel',  kind: 'bark', source: 'Star Wars',         data: { trigger: 'enterDarkRoom',  text: 'I have a really bad feeling about this room.' } },
  { id: 'bark_more',      kind: 'bark', source: 'Starship Troopers', data: { trigger: 'missionStart',   text: 'Come on, you apes! You wanna live forever?' } },
  { id: 'bark_back',      kind: 'bark', source: 'The Terminator',    data: { trigger: 'revived',        text: "I'm back." } },
  { id: 'bark_redshirt',  kind: 'bark', source: 'Star Trek',         data: { trigger: 'redArmorDowned', text: 'Should never have worn the red one.' } },
  { id: 'bark_towel',     kind: 'bark', source: "The Hitchhiker's Guide to the Galaxy", data: { trigger: 'hazardEnter', text: "Don't panic. I've got my towel." } },

  // ---- Loot / logs ----
  { id: 'loot_cat',       kind: 'loot', source: 'Alien', hidden: true,
    data: { text: 'A ginger cat in a carry crate. It hisses at the ventilation shaft.', reward: 'mascot_cat' } },
  { id: 'log_dont_open',  kind: 'log',  source: 'Event Horizon', hidden: true,
    data: { text: 'Captain\'s log, final entry: "Do not open the gravity drive. Whatever you hear, do not open it."' } },
  { id: 'log_open_pod',   kind: 'log',  source: '2001: A Space Odyssey', hidden: true,
    data: { text: 'Ship AI: "I\'m sorry. I\'m afraid I can\'t open the pod bay doors."', effect: 'podBayLockedOnce' } },

  // ---- Achievements ----
  { id: 'ach_short_controlled', kind: 'achievement', source: 'Aliens',     data: { name: 'Short, Controlled Bursts', how: 'Win a mission without anyone using a full-auto weapon.' } },
  { id: 'ach_nuke_orbit',       kind: 'achievement', source: 'Aliens',     data: { name: 'Only Way To Be Sure', how: 'Retreat from an alien ship with nobody left behind.' } },
  { id: 'ach_kobayashi',        kind: 'achievement', source: 'Star Trek',  data: { name: 'No-Win Scenario', how: 'Succeed on a mission after the retreat threshold was almost reached.' } },
  { id: 'ach_off_my_ship',      kind: 'achievement', source: 'Air Force One', data: { name: 'Get Off My Ship', how: 'Win a Mothership defense.' } },
  { id: 'ach_hold_door',        kind: 'achievement', source: 'Game of Thrones', data: { name: 'Hold the Door', how: 'Win a Mothership defense after the attackers had the Bridge more than halfway taken.' } },
  { id: 'ach_mostly_night',     kind: 'achievement', source: 'Aliens',     data: { name: 'Mostly at Night', how: 'Repel a parasite outbreak with nobody killed.' } },
  { id: 'ach_tears_rain',       kind: 'achievement', source: 'Blade Runner', data: { name: 'Lost in Time', how: 'Have a Soldier reach level 10 and then fall in battle.' } },

  // ---- Secret ships (Phase 7; never named in UI until met) ----
  { id: 'ship_derelict_horseshoe', kind: 'ship', source: 'Alien',        hidden: true, data: { note: 'Horseshoe-shaped derelict, egg chamber, one-way signal.' } },
  { id: 'ship_gravity_drive',      kind: 'ship', source: 'Event Horizon', hidden: true, data: { note: 'Rescue ship with a hell-dimension gravity drive. Gore-free but very unsettling.' } },
  { id: 'ship_bug_hauler',         kind: 'ship', source: 'Starship Troopers', hidden: true, data: { note: 'Ship overrun by giant arachnids. Everyone gets citizen-rifle bonuses.' } },
];
export const EGG_BY_ID = Object.fromEntries(EASTER_EGGS.map(e => [e.id, e]));
