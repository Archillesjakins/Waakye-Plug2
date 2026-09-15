// Syntax gate: parse every TS/JS source file with esbuild (same parser vite uses).
// Replaces vite build as compile verification while the machine's vite hang is worked around.
const fs = require('fs');
const path = require('path');
const { transformSync } = require('C:/Users/user/Desktop/Waakye-Plug2/node_modules/esbuild');

const ROOT = 'C:/Users/user/Desktop/Waakye-Plug2/src';
const EXT_OK = new Set(['.ts', '.tsx', '.js', '.jsx']);

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (EXT_OK.has(path.extname(e.name))) out.push(p);
  }
  return out;
}

const files = walk(ROOT, []);
let failed = 0;
for (const f of files) {
  const rel = path.relative(ROOT, f);
  try {
    transformSync(fs.readFileSync(f, 'utf8'), {
      loader: path.extname(f).slice(1),
      jsx: 'automatic',
    });
    console.log('OK   ' + rel);
  } catch (err) {
    failed++;
    console.log('FAIL ' + rel);
    console.log('     ' + String(err.message || err).split('\n').slice(0, 4).join('\n     '));
  }
}
console.log('---');
console.log(files.length + ' files parsed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
