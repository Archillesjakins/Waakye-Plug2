// V5 live verification of decline-rider commission guard, using a REAL admin
// session (V4 could only prove the auth gate with a bogus JWT, because it
// seeded profiles without auth users and the FK blocked it).
//
// Branches covered:
//   A. bogus JWT            -> 401 (invalid token)
//   B. real JWT, role=customer -> 403 (admin access required)
//   C. real admin, commission_owed = 25.50 -> 409, rider NOT deleted
//   D. real admin, after settling to 0 -> 200, rider + profile + auth gone
//
// Throwaway users are fully cleaned up at the end. Never prints secrets.
const fs = require('fs');
const svc = fs.readFileSync('C:/Users/user/supabase-cli/waakye-service.txt', 'utf8').trim();
const anon = fs.readFileSync('C:/Users/user/supabase-cli/waakye-anon.txt', 'utf8').trim();
const BASE = 'https://verncapitxzsgcughvil.supabase.co';

const TS = Date.now().toString().slice(-8);
const ADMIN_EMAIL = `v5admin${TS}@waakyeplug-test.app`;
const RIDER_EMAIL = `v5rider${TS}@waakyeplug-test.app`;
const PASSWORD = 'V5-tmp-' + Math.random().toString(36).slice(2, 12) + '!A';

const H_SVC = { apikey: svc, Authorization: 'Bearer ' + svc, 'Content-Type': 'application/json' };
const H_ANON = { apikey: anon, Authorization: 'Bearer ' + anon, 'Content-Type': 'application/json' };

let createdAuthIds = [];
function pass(name, cond, extra) {
  console.log(`${cond ? 'PASS' : 'FAIL'} | ${name}${extra ? ' | ' + extra : ''}`);
  if (!cond) process.exitCode = 1;
}
async function jres(res) {
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; }
  catch { return { status: res.status, body: text.slice(0, 200) }; }
}
async function createAuthUser(email) {
  const r = await jres(await fetch(`${BASE}/auth/v1/admin/users`, {
    method: 'POST', headers: H_SVC,
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  }));
  if (r.status !== 200 && r.status !== 201) throw new Error('createAuthUser ' + email + ' -> ' + r.status + ' ' + JSON.stringify(r.body));
  createdAuthIds.push(r.body.id);
  return r.body.id;
}
async function deleteAuthUser(id) {
  await fetch(`${BASE}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: H_SVC });
}

(async () => {
  try {
    // ── seed: admin + rider with valid FK chains (auth user first) ──
    const adminAuthId = await createAuthUser(ADMIN_EMAIL);
    const riderAuthId = await createAuthUser(RIDER_EMAIL);

    const pAdmin = await jres(await fetch(`${BASE}/rest/v1/profiles`, {
      method: 'POST', headers: H_SVC,
      body: JSON.stringify({ id: adminAuthId, email: ADMIN_EMAIL, full_name: 'V5 Test Admin', phone: '0977770001', role: 'admin' }),
    }));
    const pRider = await jres(await fetch(`${BASE}/rest/v1/profiles`, {
      method: 'POST', headers: H_SVC,
      body: JSON.stringify({ id: riderAuthId, email: RIDER_EMAIL, full_name: 'V5 Test Rider', phone: '0977770002', role: 'rider' }),
    }));
    const rRow = await jres(await fetch(`${BASE}/rest/v1/riders`, {
      method: 'POST', headers: { ...H_SVC, Prefer: 'return=representation' },
      body: JSON.stringify({ profile_id: riderAuthId, is_approved: true, commission_owed: 25.5 }),
    }));
    console.log('seed admin profile ->', pAdmin.status, '| rider profile ->', pRider.status, '| rider row ->', rRow.status);
    if (pAdmin.status >= 300 || pRider.status >= 300 || rRow.status >= 300) throw new Error('seed failed: ' + JSON.stringify({ pAdmin, pRider, rRow }));

    const riderId = (Array.isArray(rRow.body) ? rRow.body[0].id : rRow.body.id); // PostgREST returns an array for inserts
    const riderRowUrl = `${BASE}/rest/v1/riders?id=eq.${riderId}&select=id,commission_owed`;

    // ── mint a real admin JWT via password grant ──
    const tok = await jres(await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: H_ANON,
      body: JSON.stringify({ email: ADMIN_EMAIL, password: PASSWORD }),
    }));
    const adminToken = tok.body && tok.body.access_token;
    console.log('admin JWT minted ->', tok.status, adminToken ? 'yes (len ' + String(adminToken).length + ')' : 'NO: ' + JSON.stringify(tok.body).slice(0, 120));
    if (!adminToken) throw new Error('no admin token');

    // mint a customer JWT for the 403 branch
    const custEmail = `v5cust${TS}@waakyeplug-test.app`;
    const custAuthId = await createAuthUser(custEmail);
    await fetch(`${BASE}/rest/v1/profiles`, {
      method: 'POST', headers: H_SVC,
      body: JSON.stringify({ id: custAuthId, full_name: 'V5 Test Customer', phone: '0977770003', role: 'customer' }),
    });
    const tokC = await jres(await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: H_ANON,
      body: JSON.stringify({ email: custEmail, password: PASSWORD }),
    }));
    const custToken = tokC.body && tokC.body.access_token;

    const callDecline = (token, rider_id) => fetch(`${BASE}/functions/v1/decline-rider`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || 'bogus-token') },
      body: JSON.stringify({ rider_id }),
    }).then(jres);

    // ── A: bogus JWT -> 401 ──
    const a = await callDecline('bogus-token', riderId);
    pass('A bogus JWT rejected', a.status === 401, `got ${a.status}`);

    // ── B: non-admin JWT -> 403 ──
    if (custToken) {
      const b = await callDecline(custToken, riderId);
      pass('B non-admin rejected', b.status === 403, `got ${b.status}`);
    } else {
      pass('B non-admin rejected', false, 'could not mint customer token ' + tokC.status);
    }

    // ── C: admin + commission_owed 25.50 -> 409, rider survives ──
    const c = await callDecline(adminToken, riderId);
    pass('C commission guard returns 409', c.status === 409, `got ${c.status} ${JSON.stringify(c.body).slice(0, 160)}`);
    pass('C 409 names the owed amount', c.body && typeof c.body.commission_owed === 'number' && c.body.commission_owed === 25.5,
      c.body ? 'owed=' + c.body.commission_owed : 'no body');
    const chk = await jres(await fetch(riderRowUrl, { headers: H_SVC }));
    const stillThere = Array.isArray(chk.body) && chk.body.length === 1;
    pass('C rider NOT deleted while owed', stillThere, chk.status + ' rows=' + (Array.isArray(chk.body) ? chk.body.length : '?'));
    pass('C auth account of rider intact', createdAuthIds.includes(riderAuthId) && (await (await fetch(`${BASE}/auth/v1/admin/users?page=1&per_page=200`, { headers: H_SVC })).json()).users.some(u => u.id === riderAuthId));

    // ── settle (as the real admin flow would), then retry ──
    await fetch(`${BASE}/rest/v1/riders?id=eq.${riderId}`, {
      method: 'PATCH', headers: H_SVC, body: JSON.stringify({ commission_owed: 0 }),
    });

    // ── D: admin + settled -> 200, everything deleted ──
    const d = await callDecline(adminToken, riderId);
    pass('D settled removal returns 200', d.status === 200, `got ${d.status} ${JSON.stringify(d.body).slice(0, 120)}`);
    const chk2 = await jres(await fetch(riderRowUrl, { headers: H_SVC }));
    pass('D riders row deleted', Array.isArray(chk2.body) && chk2.body.length === 0, 'rows=' + (Array.isArray(chk2.body) ? chk2.body.length : '?'));
    const chk3 = await jres(await fetch(`${BASE}/rest/v1/profiles?id=eq.${riderAuthId}&select=id`, { headers: H_SVC }));
    pass('D profile deleted', Array.isArray(chk3.body) && chk3.body.length === 0, 'rows=' + (Array.isArray(chk3.body) ? chk3.body.length : '?'));
    const usersNow = (await (await fetch(`${BASE}/auth/v1/admin/users?page=1&per_page=200`, { headers: H_SVC })).json()).users.map(u => u.id);
    pass('D auth account deleted', !usersNow.includes(riderAuthId));
  } catch (e) {
    console.log('FATAL | ' + (e && e.message));
    process.exitCode = 1;
  } finally {
    // ── cleanup: rows first (FK), then auth users ──
    try { await fetch(`${BASE}/rest/v1/riders?profile_id=in.(${createdAuthIds.join(',')})`, { method: 'DELETE', headers: H_SVC }); } catch {}
    try { if (createdAuthIds.length) await fetch(`${BASE}/rest/v1/profiles?id=in.(${createdAuthIds.join(',')})`, { method: 'DELETE', headers: H_SVC }); } catch {}
    for (const id of createdAuthIds) { try { await deleteAuthUser(id); } catch {} }
    console.log('cleanup done (auth users removed: ' + createdAuthIds.length + ')');
  }
})();
