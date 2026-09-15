// Test Supabase REST reads for each table in tables.txt
// Assumes the same .env credentials as api-probe.cjs
const fs = require('fs');

const env = fs.readFileSync(__dirname + '/../.env', 'utf8');
const vars = {};
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && !line.trim().startsWith('#')) vars[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const url = vars.VITE_SUPABASE_URL || Object.entries(vars).find(([k]) => /SUPABASE_URL/i.test(k))?.[1];
const key = vars.VITE_SUPABASE_ANON_KEY || Object.entries(vars).find(([k]) => /ANON|PUBLISHABLE/i.test(k))?.[1];
if (!url || !key) { console.log('FATAL: missing URL or anon key'); process.exit(1); }

const headers = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };

(async () => {
  const tables = fs.readFileSync(__dirname + '/../schema/tables.txt', 'utf8')
    .split(/\r?\n/)
    .filter(line => line && !line.startsWith('//'))
    .map(line => line.trim());

  console.log('Starting REST read tests...');
  for (const table of tables) {
    const path = table.startsWith('/') ? table.slice(1) : table;
    try {
      const r = await fetch(url + '/rest/v1/' + path + '?select=*', { headers });
      if (r.ok) {
        const body = await r.text();
        let rows = 0;
        try {
          const parsed = JSON.parse(body);
          rows = Array.isArray(parsed) ? parsed.length : 1;
        } catch {
          // non-JSON or empty body -> treat as scalar (e.g. RPC result)
          rows = body ? 1 : 0;
        }
        console.log('✓', path, '→', r.status, 'rows', rows);
      } else {
        const text = await r.text();
        console.log('✗', path, '→', r.status, text.slice(0, 200));
      }
    } catch (e) {
      console.log('✗', path, '→ ERROR', e.message);
    }
  }
})();