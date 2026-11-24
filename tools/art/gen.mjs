// Generate token portraits through a local ComfyUI (SDXL), save raw renders + a review sheet.
//   node tools/art/gen.mjs --only soldier-assault-m,pirate_captain --variants 2
//   node tools/art/gen.mjs --all --variants 1 --ckpt juggernautXL_ragnarokBy.safetensors
// Raw renders land in tools/art/raw/<id>__<seed>.png (gitignored). tools/art/review.html shows them.
// Pick the keepers with tools/art/pick.mjs, which downsizes them into assets/tokens/.
import { writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOKENS, STYLE, OBJECT_STYLE, FLOOR_STYLE, NEGATIVE } from './manifest.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = join(HERE, 'raw');
const COMFY = process.env.COMFY_URL || 'http://127.0.0.1:8188';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const has = (k) => process.argv.includes('--' + k);

const CKPT = arg('ckpt', 'dreamshaperXL_lightningDPMSDE.safetensors');
const LIGHTNING = /lightning/i.test(CKPT);
const variants = +arg('variants', 1);
const only = arg('only', '');
const seedBase = +arg('seed', 1000);
const list = has('all') ? TOKENS.filter(t => !t.floor) : TOKENS.filter(t => only.split(',').includes(t.id));
if (!list.length) { console.log('Nothing to do: pass --all or --only id1,id2'); process.exit(1); }

function workflow(prompt, seed, negative = '', style = STYLE) {
  return {
    '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: CKPT } },
    '2': { class_type: 'CLIPTextEncode', inputs: { clip: ['1', 1], text: `${prompt}, ${style}` } },
    '3': { class_type: 'CLIPTextEncode', inputs: { clip: ['1', 1], text: negative ? `${NEGATIVE}, ${negative}` : NEGATIVE } },
    '4': { class_type: 'EmptyLatentImage', inputs: { width: 1024, height: 1024, batch_size: 1 } },
    '5': { class_type: 'KSampler', inputs: { model: ['1', 0], positive: ['2', 0], negative: ['3', 0], latent_image: ['4', 0], seed,
      steps: LIGHTNING ? 7 : 30, cfg: LIGHTNING ? 2 : 5.5, sampler_name: LIGHTNING ? 'dpmpp_sde' : 'dpmpp_2m', scheduler: 'karras', denoise: 1 } },
    '6': { class_type: 'VAEDecode', inputs: { samples: ['5', 0], vae: ['1', 2] } },
    '7': { class_type: 'SaveImage', inputs: { images: ['6', 0], filename_prefix: 'breachteam/token' } },
  };
}

async function run(prompt, seed, negative, style) {
  const r = await fetch(`${COMFY}/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: workflow(prompt, seed, negative, style) }) });
  const j = await r.json();
  if (!j.prompt_id) throw new Error('ComfyUI rejected the prompt: ' + JSON.stringify(j).slice(0, 300));
  for (;;) {
    await new Promise(res => setTimeout(res, 1500));
    const h = await (await fetch(`${COMFY}/history/${j.prompt_id}`)).json();
    const e = h[j.prompt_id];
    if (!e) continue;
    if (e.status?.status_str === 'error') throw new Error('generation failed');
    const img = Object.values(e.outputs || {}).flatMap(o => o.images || [])[0];
    if (!img) continue;
    const v = await fetch(`${COMFY}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder)}&type=output`);
    return Buffer.from(await v.arrayBuffer());
  }
}

mkdirSync(RAW, { recursive: true });
let n = 0;
for (const t of list) for (let k = 0; k < variants; k++) {
  const seed = seedBase + k * 7919 + [...t.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const file = join(RAW, `${t.id}__${seed}.png`);
  if (existsSync(file) && !has('force')) { console.log('exists', t.id, seed); continue; }
  const t0 = Date.now();
  writeFileSync(file, await run(t.prompt, seed, t.negative, t.floor ? FLOOR_STYLE : t.object ? OBJECT_STYLE : STYLE));
  console.log(`made ${t.id} seed ${seed} (${((Date.now() - t0) / 1000).toFixed(1)}s) [${++n}]`);
}

// Review sheet: every raw render, grouped by token, previewed inside a round token mask.
const files = readdirSync(RAW).filter(f => f.endsWith('.png')).sort();
const byId = {};
for (const f of files) (byId[f.split('__')[0]] ||= []).push(f);
const html = `<!doctype html><meta charset="utf-8"><title>Breach Team token review</title>
<style>body{background:#0b0f14;color:#d7e3ee;font:14px Inter,system-ui;padding:16px}h2{font:700 18px sans-serif;margin:18px 0 6px}
.row{display:flex;gap:14px;flex-wrap:wrap}.c{text-align:center;font-size:11px;color:#8197ab}
.big{width:220px;height:220px;object-fit:cover;border-radius:8px}.tok{width:64px;height:64px;border-radius:50%;object-fit:cover;border:4px solid #f2c14e;margin-top:6px}
.tok.s{width:32px;height:32px;border-width:3px}</style>
<h1>Token review (${CKPT})</h1>${Object.entries(byId).map(([id, fs]) => `<h2>${id}</h2><div class="row">${fs.map(f => `<div class="c"><img class="big" src="raw/${f}"><br>
<img class="tok" src="raw/${f}"> <img class="tok s" src="raw/${f}"><br>${f.split('__')[1].replace('.png', '')}</div>`).join('')}</div>`).join('')}`;
writeFileSync(join(HERE, 'review.html'), html);
console.log('review sheet: tools/art/review.html');
