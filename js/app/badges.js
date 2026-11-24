// Small shared UI badges (new file: new names must come from new files, see the stale-cache note).
// A round level medallion in the Soldier's accent colour. size: 'sm' | 'md' | 'lg'.
export function levelBadge(level, color = 'var(--accent)', size = 'md') {
  return `<span class="lvl lvl-${size}" style="--lc:${color}" title="Level ${level}"><small>LV</small>${level}</span>`;
}
