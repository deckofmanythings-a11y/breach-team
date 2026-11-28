// Standard-issue gear a hired Rookie reports with (weapon + armour, Standard rarity), like the starter squad.
// Without it a new hire fights with a fallback pistol and no armour.
export const HIRE_KIT = {
  assault:     { weapon: 'carbine_std', armor: 'armor_medium' },
  breacher:    { weapon: 'shotgun_std', armor: 'armor_medium' },
  marksman:    { weapon: 'sniper_std',  armor: 'armor_light' },
  medic:       { weapon: 'smg_std',     armor: 'armor_light' },
  tech:        { weapon: 'arc_std',     armor: 'armor_light' },
  heavy:       { weapon: 'lmg_std',     armor: 'armor_heavy' },
  infiltrator: { weapon: 'blade_std',   armor: 'armor_stealth' },
};
