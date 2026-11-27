// Big square portraits (Barracks cards): the whole painted portrait, armor recoloured to the
// Soldier's colour, no round crop. Elements rendered as <div class="portrait" data-tok ...> get
// the image painted in as a background once it's ready.
import { recolorArmor, tokenImage, soldierTokenId } from './tokens.js';
import { artStyle } from './art-style.js';

const cache = new Map();
export function portraitURL(s, size = 256) {
  const [a] = s.colors || ['#3a5a8c'];
  const id = soldierTokenId(s), key = `${artStyle()}|${id}|${a}|${size}`;
  if (!cache.has(key)) cache.set(key, tokenImage(id).then(img => {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0, size, size);
    x.putImageData(recolorArmor(x.getImageData(0, 0, size, size), a), 0, 0);
    return c.toDataURL('image/jpeg', 0.9);
  }));
  return cache.get(key);
}

export function hydratePortraits(root = document) {
  for (const el of root.querySelectorAll('.portrait[data-tok]:not([data-done])')) {
    el.dataset.done = '1';
    const s = { specialty: el.dataset.spec, sex: el.dataset.sex, look: +el.dataset.look || 0, portrait: el.dataset.portrait || undefined, colors: [el.dataset.a] };
    portraitURL(s).then(url => { el.style.backgroundImage = `url(${url})`; el.classList.add('loaded'); }).catch(() => {});
  }
}
if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
  new MutationObserver(() => hydratePortraits()).observe(document.documentElement, { childList: true, subtree: true });
}
