// Auto-equip button + confirmation (Quartermaster, Ver. 0.22.0). Shown in the Barracks and Armory once the
// Quartermaster is hired. The server does the outfitting (js/game/quartermaster.js autoEquip).
import * as G from './state.js?v=3';
import { el, esc, toast, modal, closeModal } from './ui.js';
import { hasQuartermaster, quartermasterWorking } from '../game/quartermaster.js';

/** The header button, or null when there's no Quartermaster yet. */
export function autoEquipButton(run, rerender) {
  const S = G.state();
  if (!hasQuartermaster(S)) return null;
  const b = el(`<button id="autoequip" title="${quartermasterWorking(S) ? 'Your Quartermaster outfits the roster with the best gear for each class' : 'Repair the Armory to use the Quartermaster again'}">📦 Auto-equip</button>`);
  b.disabled = !quartermasterWorking(S);
  b.onclick = () => openAutoEquip(run, rerender);
  return b;
}

export function openAutoEquip(run, rerender) {
  const S = G.state();
  const squads = (S.squads || []).filter(p => p.squad?.length);
  const box = el(`<div class="box" style="width:min(500px,94vw)"><h2>📦 Auto-equip</h2>
    <p>Your Quartermaster takes back every piece of gear and hands it out again: highest-level Soldiers first, each getting the best gear you own for their class (Techs get Tech gear, Medics get healing gear, Infiltrators get Stealth...).</p>
    <p class="small dim">Built-in enhancements stay where they are. Soldiers who are MIA keep what they took with them.</p>
    ${squads.length ? `<label class="small">Outfit first: <select id="first"><option value="">Highest level first</option>${squads.map(p => `<option value="${esc(p.id)}">Squad: ${esc(p.name)}</option>`).join('')}</select></label>` : ''}
    <div class="row" style="justify-content:flex-end;margin-top:14px"><button id="no">Cancel</button><button class="primary" id="yes">Outfit the roster</button></div></div>`);
  box.querySelector('#no').onclick = closeModal;
  box.querySelector('#yes').onclick = async (e) => {
    e.target.disabled = true;
    const pick = box.querySelector('#first')?.value;
    const soldiers = pick ? (squads.find(p => p.id === pick)?.squad || []) : [];
    const r = await run(() => G.act('autoEquip', { soldiers }));
    if (r) { closeModal(); toast(r.changed ? `Quartermaster done: ${r.changed} gear change${r.changed === 1 ? '' : 's'}.` : 'Everyone already has the best gear for them.'); rerender(); }
    else e.target.disabled = false;
  };
  modal(box);
}
