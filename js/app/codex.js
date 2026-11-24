// In-game Codex: renders docs/CODEX.md (the single source for rules text, so the game and the
// docs never drift apart). Tiny Markdown subset: headings, tables, lists, bold, italics, code.
// RULE: the codex must never name hidden easter eggs (secret ships, recruits, logs).
import { el, esc } from './ui.js';

function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>');
}

export function mdToHtml(md) {
  const lines = md.replace(/\r/g, '').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    const h = l.match(/^(#{1,4})\s+(.*)$/);
    if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
    if (/^---+$/.test(l.trim())) { out.push('<hr style="border-color:var(--line)">'); i++; continue; }
    if (l.trim().startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(lines[i++]);
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const head = cells(rows[0]);
      const body = rows.slice(rows[1] && /^[\s|:-]+$/.test(rows[1]) ? 2 : 1);
      out.push(`<table><tr>${head.map(c => `<th>${inline(c)}</th>`).join('')}</tr>${body.map(r => `<tr>${cells(r).map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</table>`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(l) || /^\s*\d+\.\s+/.test(l)) {
      const ordered = /^\s*\d+\./.test(l);
      const items = [];
      while (i < lines.length && (/^\s*[-*]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]) || /^\s{2,}\S/.test(lines[i]))) {
        const t = lines[i].replace(/^\s*([-*]|\d+\.)\s+/, '');
        if (/^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i]) && items.length) items[items.length - 1] += ' ' + t.trim();
        else items.push(t);
        i++;
      }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.map(x => `<li>${inline(x)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#|\||\s*[-*]\s|\s*\d+\.\s|---)/.test(lines[i])) para.push(lines[i++]);
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('\n');
}

let cache = null;
export async function renderCodex(panel) {
  const wrap = el('<div class="codex"><div class="dim">Loading the Codex…</div></div>');
  panel.append(wrap);
  try {
    if (!cache) { const r = await fetch('docs/CODEX.md?v=' + Date.now()); if (!r.ok) throw new Error(r.status); cache = await r.text(); }
    wrap.innerHTML = mdToHtml(cache);
  } catch (e) { wrap.innerHTML = `<div class="bad">Couldn't load the Codex (${esc(e.message)}).</div>`; }
}
