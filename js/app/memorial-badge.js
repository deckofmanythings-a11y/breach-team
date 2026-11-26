// Memorial-only badges: honours a Soldier can only receive by dying a particular way. Kept apart
// from the commendations list (which living Soldiers see as "still to earn").
export const SUICIDE_SQUAD_BADGE = {
  name: 'Suicide Squad',
  desc: 'Volunteered for a boarding with no retreat, and gave everything.',
};

// HTML for every memorial badge this fallen Soldier holds ('' when none). compact = icon only.
export function memorialBadges(m, compact = false) {
  if (!m?.suicideSquad) return '';
  const b = SUICIDE_SQUAD_BADGE;
  return `<span class="mbadge ss${compact ? ' compact' : ''}" title="${b.name}: ${b.desc}"><span class="mbadge-icon">☠</span>${compact ? '' : `<span class="mbadge-text">${b.name.toUpperCase()}</span>`}</span>`;
}
