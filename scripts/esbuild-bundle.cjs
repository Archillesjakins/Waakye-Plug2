// Fallback production bundler — builds the app bundle with esbuild DIRECTLY,
// bypassing vite/rollup (which intermittently wedge at ~0 CPU on this machine).
// Same parser/transformer vite uses under the hood; single process, low RAM.
//
// Usage: node scripts/esbuild-bundle.cjs
// Output: dist/assets/index-esbuild.js  (then point dist/index.html at it)
//
// CSS note: src imports styles/index.css (tailwind 4, needs the vite plugin).
// Those imports are stubbed to empty here ON PURPOSE — the compiled stylesheet
// is unchanged by JS-only fixes and dist/assets/index-CEKW9Gnv.css already
// contains it, linked from dist/index.html. If styles/** ever changes, a real
// vite build must regenerate that file.
const fs = require('fs');
const path = require('path');
const esbuild = require('../node_modules/esbuild');

const ROOT = path.resolve(__dirname, '..');

// --- load .env the way vite's import.meta.env would expose it -------------
const env = {};
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith('#')) {
      env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
} else {
  console.error('FATAL: no .env found at ' + envPath);
  process.exit(1);
}

const define = {
  'import.meta.env.MODE': JSON.stringify('production'),
  'import.meta.env.DEV': 'false',
  'import.meta.env.PROD': 'true',
  'import.meta.env.SSR': 'false',
};
for (const [k, v] of Object.entries(env)) {
  if (k.startsWith('VITE_')) define[`import.meta.env.${k}`] = JSON.stringify(v);
}
console.log('env injected: ' + Object.keys(define).filter((k) => k.startsWith('import.meta.env.VITE_')).join(', '));

// --- stub all CSS imports (see note at top) --------------------------------
const emptyCssPlugin = {
  name: 'empty-css',
  setup(build) {
    build.onResolve({ filter: /\.css$/ }, (args) => ({
      path: args.path,
      namespace: 'empty-css',
    }));
    build.onLoad({ filter: /.*/, namespace: 'empty-css' }, () => ({
      contents: '',
      loader: 'js',
    }));
  },
};

const outfile = path.join(ROOT, 'dist', 'assets', 'index-esbuild.js');

esbuild
  .build({
    entryPoints: [path.join(ROOT, 'src', 'main.tsx')],
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2020'],
    jsx: 'automatic',
    tsconfig: path.join(ROOT, 'tsconfig.json'),
    alias: { '@': path.join(ROOT, 'src') },
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
    define,
    plugins: [emptyCssPlugin],
    outfile,
    legalComments: 'none',
    logLevel: 'info',
    metafile: true,
  })
  .then((result) => {
    const bytes = fs.statSync(outfile).size;
    console.log('WROTE ' + outfile + ' (' + (bytes / 1024).toFixed(1) + ' kB)');
    process.exit(0);
  })
  .catch((err) => {
    console.error('BUILD FAILED');
    console.error(String(err && err.message ? err.message : err));
    process.exit(1);
  });
