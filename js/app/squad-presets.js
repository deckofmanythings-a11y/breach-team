// Saved squad presets on the Deploy screen (Ver. 0.22.0): named squads, each with a preferred entry method, kept in
// the save (g.squads) so they follow the account to every device. Picking one sets the entry and the squad (in its
// marching order); the squad never exceeds the entry's seats (the server checks too).
import * as G from './state.js?v=3';
import { el, esc, toast, modal, closeModal } from './ui.js';
import { ENTRIES, ENTRY_BY_ID } from '../data/entries.js';
import { presetView } from '../game/quartermaster.js';
import { MAX_SQUAD_PRESETS, SQUAD_NAME_MAX } from '../data/quartermaster.js';

const save = async (list) => {
  try { await G.act('saveSquads', { squads: list }); return true; }
  catch (e) { toast(e.message || 'Could not save the squads.'); return false; }
};
const plain = (p) => ({ id: p.id, name: p.name, entry: p.entry, squad: p.squad });

/**
 * The preset bar for section 3. p: the Deploy pick ({entry, squad, ...}); ready(uid) says if a Soldier can go now;
 * maxOf(entry) is the entry's current seat count; rerender() redraws Deploy after a change.
 */
export function presetBar(p, { ready, maxOf, persist, rerender }) {
  const S = G.state();
  const list = S.squads || [];
  const bar = el(`<div class="presets"><span class="small dim">Saved squads:</span></div>`);
  for (const raw of list) {
    const v = presetView(S, raw), e = ENTRY_BY_ID[v.entry];
    const on = p.entry === v.entry && v.squad.length === p.squad.length && v.squad.every((u, i) => p.squad[i] === u);
    const chip = el(`<button class="preset ${on ? 'on' : ''}" title="${esc(e?.name || '')} · ${v.squad.length} Soldier${v.squad.length === 1 ? '' : 's'}">${esc(v.name)} <span class="small dim">${esc(e?.name || '?')} · ${v.squad.length}</span></button>`);
    chip.onclick = () => {
      const go = v.squad.filter(ready), missing = v.squad.length - go.length;
      p.entry = v.entry;
      p.squad = go.slice(0, maxOf(e));
      persist();
      if (missing) toast(`${missing} of ${v.name} can't go right now (recovering, missing or not eligible).`);
      else if (v.dropped) toast(`${v.dropped} Soldier${v.dropped === 1 ? ' from this squad is' : 's from this squad are'} no longer on the roster.`);
      rerender();
    };
    bar.append(chip);
  }
  if (list.length < MAX_SQUAD_PRESETS) {
    const add = el('<button class="preset add">💾 Save this squad…</button>');
    add.disabled = !p.squad.length;
    add.onclick = async () => {
      const name = (prompt(`Name this squad (${ENTRY_BY_ID[p.entry]?.name}, ${p.squad.length} Soldier${p.squad.length === 1 ? '' : 's'}):`, `Squad ${list.length + 1}`) || '').trim().slice(0, SQUAD_NAME_MAX);
      if (!name) return;
      if (await save([...list.map(plain), { name, entry: p.entry, squad: p.squad.slice() }])) { toast(`Saved "${name}".`); rerender(); }
    };
    bar.append(add);
  }
  if (list.length) { const m = el('<button class="preset ghost">✎ Manage</button>'); m.onclick = () => manage(p, maxOf, rerender); bar.append(m); }
  return bar;
}

function manage(p, maxOf, rerender) {
  const S = G.state();
  const rows = (S.squads || []).map(plain);
  const box = el(`<div class="box" style="width:min(640px,96vw)"><div class="spread"><h2>Saved squads</h2><button id="x">✕</button></div>
    <div class="small dim" style="margin-bottom:8px">Each squad remembers its entry method. A squad can't be bigger than its entry allows.</div>
    <div id="rows" style="display:grid;gap:8px"></div>
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button id="no">Cancel</button><button class="primary" id="yes">Save changes</button></div></div>`);
  const host = box.querySelector('#rows');
  const draw = () => {
    host.replaceChildren();
    rows.forEach((r, i) => {
      const e = ENTRY_BY_ID[r.entry], max = maxOf(e), names = r.squad.map(u => G.soldierById(u)?.name).filter(Boolean);
      const row = el(`<div class="card" style="padding:8px 10px">
        <div class="row" style="gap:6px;flex-wrap:wrap"><input class="pname" maxlength="${SQUAD_NAME_MAX}" value="${esc(r.name)}" style="flex:1;min-width:140px">
          <select class="pentry">${ENTRIES.map(x => `<option value="${x.id}" ${x.id === r.entry ? 'selected' : ''}>${esc(x.name)} (up to ${maxOf(x)})</option>`).join('')}</select>
          <button class="pcur" title="Replace the members with the squad picked on the Deploy screen">Use current squad</button>
          <button class="pdel danger" title="Delete this squad">🗑</button></div>
        <div class="small ${names.length > max ? 'bad' : 'dim'}" style="margin-top:4px">${names.length}/${max}: ${esc(names.join(', ') || 'nobody')}${names.length > max ? ` · too many for ${esc(e.name)}: the last ${names.length - max} will be dropped` : ''}</div></div>`);
      row.querySelector('.pname').oninput = (ev) => { r.name = ev.target.value; };
      row.querySelector('.pentry').onchange = (ev) => { r.entry = ev.target.value; draw(); };
      row.querySelector('.pcur').onclick = () => { r.squad = p.squad.slice(); draw(); };
      row.querySelector('.pdel').onclick = () => { rows.splice(i, 1); draw(); };
      host.append(row);
    });
    if (!rows.length) host.append(el('<div class="dim">No saved squads.</div>'));
  };
  draw();
  box.querySelector('#x').onclick = box.querySelector('#no').onclick = closeModal;
  box.querySelector('#yes').onclick = async () => {
    const out = rows.map(r => ({ ...r, name: r.name.trim(), squad: r.squad.filter(u => G.soldierById(u)).slice(0, maxOf(ENTRY_BY_ID[r.entry])) }));
    if (await save(out)) { closeModal(); toast('Squads saved.'); rerender(); }
  };
  modal(box);
}
