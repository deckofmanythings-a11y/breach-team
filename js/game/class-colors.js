// Per-class accent colours (server-authoritative). A Soldier's accent (colors[1]) always follows
// their specialty; applyClassAccents is run on every save load and after every action.
import { DEFAULT_CLASS_ACCENTS, HEX_COLOR, classAccent } from '../data/class-colors.js';
import { GameError } from './rules.js';

export function applyClassAccents(g) {
  if (!g.classAccents || typeof g.classAccents !== 'object') g.classAccents = {};
  for (const s of [...(g.soldiers || []), ...(g.memorial || [])]) {
    const a = classAccent(g, s.specialty);
    s.colors = [(s.colors && s.colors[0]) || '#3a5a8c', a];
  }
  return g;
}

// colors: { specialty: '#rrggbb' | null }. null resets that class to its default.
export function setClassAccents(g, colors) {
  if (!colors || typeof colors !== 'object') throw new GameError('No colours given.');
  if (!g.classAccents) g.classAccents = {};
  for (const [spec, c] of Object.entries(colors)) {
    if (!(spec in DEFAULT_CLASS_ACCENTS)) throw new GameError('Unknown specialty.');
    if (c === null) delete g.classAccents[spec];
    else if (typeof c === 'string' && HEX_COLOR.test(c)) g.classAccents[spec] = c.toLowerCase();
    else throw new GameError('Bad colour.');
  }
  applyClassAccents(g);
  return {};
}
