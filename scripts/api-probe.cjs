// Probe the Supabase boot sequence exactly the way the app does from a browser:
// 1. GET  /auth/v1/health   (with apikey)
// 2. POST /auth/v1/signup   (empty body = anonymous sign-in — what signInAnonymously calls)
// 3. GET  /rest/v1/vendors  (public read the VendorSelectScreen needs)
// Reads .env directly so we always test the exact creds baked into the bundle.
const fs = require('fs');

const env = fs.readFileSync(__dirname + '/../.env', 'utf8');
const vars = {};
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && !line.trim().startsWith('#')) vars[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
console.log('VITE_ vars in .env:', Object.keys(vars).join(', ') || '(none)');

const url = vars.VITE_SUPABASE_URL || Object.entries(vars).find(([k]) => /SUPABASE_URL/i.test(k))?.[1];
const key = vars.VITE_SUPABASE_ANON_KEY || Object.entries(vars).find(([k]) => /ANON|PUBLISHABLE/i.test(k))?.[1];
if (!url || !key) { console.log('FATAL: missing URL or anon key in .env'); process.exit(1); }
console.log('URL:', url);
console.log('KEY length:', key.length, 'prefix:', key.slice(0, 10) + '...');

// JWT payload decode — check expiry/project ref
try {
  const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64').toString('utf8'));
  console.log('KEY ref:', payload.ref, '| role:', payload.role, '| iss:', payload.iss);
} catch (e) { console.log('KEY is not a JWT:', e.message); }

(async () => {
  const headers = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };

  try {
    const r = await fetch(url + '/auth/v1/health', { headers });
    console.log('\n[1] auth health:', r.status, (await r.text()).slice(0, 120));
  } catch (e) { console.log('\n[1] auth health FAIL:', e.message); }

  try {
    const r = await fetch(url + '/auth/v1/signup', { method: 'POST', headers, body: '{}' });
    const body = await r.text();
    console.log('[2] anon signup:', r.status, body.slice(0, 300));
  } catch (e) { console.log('[2] anon signup FAIL:', e.message); }

  try {
    const r = await fetch(url + '/rest/v1/vendors?select=id&limit=1', { headers });
    console.log('[3] vendors read:', r.status, (await r.text()).slice(0, 200));
  } catch (e) { console.log('[3] vendors read FAIL:', e.message); }
})();
