// Crew Quarters expansion (Ver. 0.23.0), shared by the browser and boarding-api. Rules in js/data/crew-quarters.js.
import { GameError } from './rules.js';
import { quartersLevel, nextQuartersPrice, capAtLevel } from '../data/crew-quarters.js';

/** Expand the Crew Quarters one level (+7 roster space), paid in CREDs. No top level; the price keeps climbing. */
export function expandQuarters(g) {
  const price = nextQuartersPrice(g);
  if ((g.creds || 0) < price) throw new GameError(`Not enough CREDs (need ${price.toLocaleString()}).`);
  g.creds -= price;
  g.mothership ||= {};
  const level = quartersLevel(g) + 1;
  g.mothership.quarters = level;
  return { level, cap: capAtLevel(level), spent: price };
}
