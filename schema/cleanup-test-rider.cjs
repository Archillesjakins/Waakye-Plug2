const fs = require('fs');
const svc = fs.readFileSync('C:/Users/user/supabase-cli/waakye-service.txt', 'utf8').trim();
const BASE = 'https://verncapitxzsgcughvil.supabase.co';
const H = { apikey: svc, Authorization: 'Bearer ' + svc, 'Content-Type': 'application/json' };

const RIDER_ID = 'cfaa2beb-6f49-4c32-8d46-170e8900145a';
const PROFILE_ID = '4a07a675-5e17-44b1-8aaa-bb50f2a325a3';
const EMAIL = '0999999999@riders.waakyeplug.app';

(async () => {
  // 1. delete auth user (find by synthetic email)
  try {
    const listRes = await fetch(`${BASE}/auth/v1/admin/users?email=${encodeURIComponent(EMAIL)}`, { headers: H });
    const list = await listRes.json();
    const users = (list.users || []).filter((u) => u.email === EMAIL);
    for (const u of users) {
      const del = await fetch(`${BASE}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: H });
      console.log('auth user', u.id, 'delete →', del.status, del.status === 204 ? 'OK' : await del.text());
    }
    if (!users.length) console.log('no auth user found for', EMAIL);
  } catch (e) { console.log('auth cleanup error:', e.message); }

  // 2. delete riders row
  const r1 = await fetch(`${BASE}/rest/v1/riders?id=eq.${RIDER_ID}`, { method: 'DELETE', headers: H });
  console.log('riders row delete →', r1.status, r1.status === 204 ? 'OK' : await r1.text());

  // 3. delete profile row
  const r2 = await fetch(`${BASE}/rest/v1/profiles?id=eq.${PROFILE_ID}`, { method: 'DELETE', headers: H });
  console.log('profile delete →', r2.status, r2.status === 204 ? 'OK' : await r2.text());

  // 4. confirm gone
  const chk = await fetch(`${BASE}/rest/v1/riders?id=eq.${RIDER_ID}&select=id`, { headers: H });
  const rows = await chk.json();
  console.log('confirm riders row gone:', rows.length === 0 ? 'YES ✅' : JSON.stringify(rows));
})();
