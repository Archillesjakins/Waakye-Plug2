const fs = require('fs');
const URL_BASE = 'https://verncapitxzsgcughvil.supabase.co/rest/v1';
const anon = fs.readFileSync('C:/Users/user/supabase-cli/waakye-anon.txt', 'utf8').trim();

const H = { apikey: anon, Authorization: 'Bearer ' + anon, 'Content-Type': 'application/json' };

async function show(label, p) {
  try {
    const r = await p;
    let body = '';
    try { body = JSON.stringify(await r.clone().json()).slice(0, 120); } catch { body = '(no json body)'; }
    console.log(label, '→ HTTP', r.status, body);
  } catch (e) {
    console.log(label, '→ ERROR', e.message);
  }
}

(async () => {
  // ATTACK 1: read the locked gamification tables (was fully public before)
  await show('READ player_stats (expect ~empty/200-but-no-rows)', fetch(URL_BASE + '/player_stats?select=*', { headers: H }));
  await show('READ spin_history (expect ~empty)', fetch(URL_BASE + '/spin_history?select=*', { headers: H }));
  await show('READ points_earned_log (expect ~empty)', fetch(URL_BASE + '/points_earned_log?select=*', { headers: H }));

  // ATTACK 2: INSERT into player_stats (was public before)
  await show('INSERT player_stats (expect 401/403/404-ish)',
    fetch(URL_BASE + '/player_stats', { method: 'POST', headers: H, body: JSON.stringify({ user_id: '00000000-0000-0000-0000-000000000000' }) }));

  // ATTACK 3: anonymous UPDATE on riders (the self-approval hole — RLS+grants)
  await show('UPDATE riders SET is_approved=true (expect 401/403)',
    fetch(URL_BASE + '/riders?profile_id=eq.4a07a675-5e17-44b1-8aaa-bb50f2a325a3', { method: 'PATCH', headers: H, body: JSON.stringify({ is_approved: true }) }));

  // ATTACK 4: anonymous UPDATE on profiles (role self-promotion)
  await show('UPDATE profiles SET role=admin (expect 401/403)',
    fetch(URL_BASE + '/profiles?id=eq.4a07a675-5e17-44b1-8aaa-bb50f2a325a3', { method: 'PATCH', headers: H, body: JSON.stringify({ role: 'admin' }) }));

  // ATTACK 5: anonymous UPDATE on orders (fake status)
  await show('UPDATE orders SET status=delivered (expect 401/403)',
    fetch(URL_BASE + '/orders?id=eq.00000000-0000-0000-0000-000000000000', { method: 'PATCH', headers: H, body: JSON.stringify({ status: 'delivered' }) }));

  // LEGIT 1: public vendor+menu read must still work (customer app depends on it)
  await show('LEGIT READ vendors (expect 200 with rows)', fetch(URL_BASE + '/vendors?select=id,business_name,status&limit=3', { headers: H }));
  await show('LEGIT READ orders limit 1 (customer tracking — expect 200)', fetch(URL_BASE + '/orders?select=id,status&limit=1', { headers: H }));
  await show('LEGIT READ riders limit 1 (rider listing — expect 200)', fetch(URL_BASE + '/riders?select=id,is_online,is_approved&limit=1', { headers: H }));
})();
