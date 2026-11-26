// Armory-wide actions. Shared by the browser and boarding-api (new file: new names must come from new files).
import { ITEM_BY_ID } from '../data/gear.js';

// Take every piece of removable gear off every Soldier and put it back in the Armory.
// Built-in items (fused in, e.g. a Life-Support Sarcophagus) stay where they are.
export function stripAll(g) {
  let removed = 0;
  for (const s of g.soldiers) for (const slot of Object.keys(s.gear || {})) {
    const it = g.items.find(i => i.uid === s.gear[slot]);
    if (it && ITEM_BY_ID[it.base]?.builtin) continue;
    delete s.gear[slot]; removed++;
  }
  return { stripped: removed };
}
