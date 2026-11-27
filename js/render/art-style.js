// Portrait / token art style: 'painted' (assets/tokens/) or 'anime' (assets/tokens-anime/).
// A per-device preference (localStorage), not part of the save. New file (stale-cache rule).
export const ART_STYLES = [{ id: 'painted', name: 'Painted' }, { id: 'anime', name: 'Anime' }];
const KEY = 'bt.artStyle';
let style = (() => { try { return localStorage.getItem(KEY) === 'anime' ? 'anime' : 'painted'; } catch { return 'painted'; } })();
const listeners = new Set();
export const artStyle = () => style;
export function setArtStyle(s) {
  style = s === 'anime' ? 'anime' : 'painted';
  try { localStorage.setItem(KEY, style); } catch { /* storage unavailable */ }
  for (const fn of listeners) fn(style);
}
export const onArtStyle = (fn) => listeners.add(fn);
const ANIME_V = 1;   // bump when re-picking anime art (cache bust)
export const animeSrc = (id) => new URL(`../../assets/tokens-anime/${id}.jpg?v=${ANIME_V}`, import.meta.url).href;
