// Syntax-checks every browser/server module (a single bad quote breaks the whole app on load).
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
let bad = 0;
for (const dir of ['js/app', 'js/render', 'js/game', 'js/data', 'js/engine']) for (const f of readdirSync(dir).filter(f => f.endsWith('.js'))) {
  try { execFileSync(process.execPath, ['--check', `${dir}/${f}`], { stdio: 'pipe' }); }
  catch (e) { bad++; console.log('SYNTAX ERROR', `${dir}/${f}`, String(e.stderr).split('\n').slice(0, 4).join('\n')); }
}
console.log(bad ? `${bad} file(s) with syntax errors` : 'All modules parse.');
process.exit(bad ? 1 : 0);
