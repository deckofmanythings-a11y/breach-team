// Default accent colour for each specialty. Every Soldier of a class wears that class's accent
// (level badge, card trim, token ring); the player can re-pick them per class in the Barracks.
export const DEFAULT_CLASS_ACCENTS = {
  assault: '#e8483b',     // red
  breacher: '#ff8c1a',    // orange
  marksman: '#3fb8ff',    // sky blue
  medic: '#4fd67a',       // green
  tech: '#f2c14e',        // gold
  heavy: '#9a6bff',       // violet
  infiltrator: '#ff5fd2', // magenta
};
export const HEX_COLOR = /^#[0-9a-f]{6}$/i;
// The accent a save uses for a specialty (player override, else the default).
export function classAccent(g, specialty) {
  return g?.classAccents?.[specialty] || DEFAULT_CLASS_ACCENTS[specialty] || '#f2c14e';
}
