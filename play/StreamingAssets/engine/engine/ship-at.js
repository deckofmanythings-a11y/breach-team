// A ship's numbers as of engine version V: each entry in ship.revisions applies from its version on,
// so replays fought on an older engine keep the numbers they were fought with.
export function shipAt(ship, V) {
  let s = ship;
  for (const r of ship?.revisions || []) if (V >= r.v) { const { v, ...f } = r; s = { ...s, ...f }; }
  return s;
}
