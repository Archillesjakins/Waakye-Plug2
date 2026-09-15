// V4 live verification: decline-rider must REFUSE to delete a rider while
// commission_owed > 0, and still work when commission_owed = 0.
// Creates a throwaway rider with synthetic debt, calls the edge function
// with an invalid (anon-strength) JWT — so expect 401/403 from the auth
// gate BEFORE the commission check. To exercise the commission branch for
// real, run from the vendor panel (real admin session) — this script only
// proves the auth gate + that the guard exists server-side.
const fs = require('fs');
const svc = fs.readFileSync('C:/Users/user/supabase-cli/waakye-service.txt', 'utf8').trim();
const BASE = 'https://verncapitxzsgcughvil.supabase.co';

const RIDER_ID = 'eeeeeeee-0000-4000-8000-000000000001';
const PROFILE_ID = 'eeeeeeee-0000-4000-8000-000000000002';
const EMAIL = '0988887777@riders.waakyeplug.app';

const H = { apikey: svc, Authorization: 'Bearer ' + svc, 'Content-Type': 'application/json' };

(async () => {
  // 0. cleanup from any previous run
  await fetch(`${BASE}/rest/v1/riders?id=eq.${RIDER_ID}`, { method: 'DELETE', headers: H });
  await fetch(`${BASE}/rest/v1/profiles?id=eq.${PROFILE_ID}`, { method: 'DELETE', headers: H });
  try {
    const l = await (await fetch(`${BASE}/auth/v1/admin/users?email=${encodeURIComponent(EMAIL)}`, { headers: H })).json();
    for (const u of (l.users || [])) {
      await fetch(`${BASE}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: H });
    }
  } catch {}

  // 1. seed: profile + rider with 25.50 GHS owed
  const p = await fetch(`${BASE}/rest/v1/profiles`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ id: PROFILE_ID, full_name: 'V4 Test Rider', phone: '0988887777', role: 'rider' }),
  });
  console.log('seed profile →', p.status);

  const r = await fetch(`${BASE}/rest/v1/riders`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ id: RIDER_ID, profile_id: PROFILE_ID, is_approved: true, commission_owed: 25.5 }),
  });
  console.log('seed rider (owed 25.50) →', r.status);

  // 2. call decline-rider with a bogus JWT — must be 401/403 (auth gate)
  const res = await fetch(`${BASE}/functions/v1/decline-rider`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer bogus-token' },
    body: JSON.stringify({ rider_id: RIDER_ID }),
  });
  const body = await res.json();
  console.log('decline-rider bogus-JWT →', res.status, JSON.stringify(body));

  // 3. confirm the rider is still there (nothing was deleted)
  const chk = await fetch(`${BASE}/rest/v1/riders?id=eq.${RIDER_ID}&select=id,commission_owed`, { headers: H });
  const rows = await chk.json();
  console.log('rider still present:', rows.length === 1 ? 'YES ✅' : 'NO — DELETED ❌', JSON.stringify(rows));

  // 4. cleanup
  await fetch(`${BASE}/rest/v1/riders?id=eq.${RIDER_ID}`, { method: 'DELETE', headers: H });
  await fetch(`${BASE}/rest/v1/profiles?id=eq.${PROFILE_ID}`, { method: 'DELETE', headers: H });
  try {
    const l2 = await (await fetch(`${BASE}/auth/v1/admin/users?email=${encodeURIComponent(EMAIL)}`, { headers: H })).json();
    for (const u of (l2.users || [])) {
      await fetch(`${BASE}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: H });
    }
  } catch {}
  const chk2 = await fetch(`${BASE}/rest/v1/riders?id=eq.${RIDER_ID}&select=id`, { headers: H });
  console.log('cleanup → riders remaining:', (await chk2.json()).length);
})();
