// Memorial-only badges: honours a Soldier can only receive by dying a particular way. Kept apart
// from the commendations list (which living Soldiers see as "still to earn").
export const SUICIDE_SQUAD_BADGE = {
  name: 'Suicide Squad',
  desc: 'Volunteered for a boarding with no retreat, and gave everything.',
};

const DEFENDER_BADGE = { name: 'Died Defending the Mothership', short: 'Mothership defender', desc: 'Fell holding the squad’s own ship against boarders.' };

// HTML for every memorial badge this fallen Soldier holds ('' when none). compact = icon only.
export function memorialBadges(m, compact = false) {
  const one = (cls, icon, label, b) => `<span class="mbadge ${cls}${compact ? ' compact' : ''}" title="${b.name}: ${b.desc}"><span class="mbadge-icon">${icon}</span>${compact ? '' : `<span class="mbadge-text">${label.toUpperCase()}</span>`}</span>`;
  return (m?.suicideSquad ? one('ss', '☠', SUICIDE_SQUAD_BADGE.name, SUICIDE_SQUAD_BADGE) : '')
    + (m?.defense ? one('def', '🛡', DEFENDER_BADGE.short, DEFENDER_BADGE) : '');
}
