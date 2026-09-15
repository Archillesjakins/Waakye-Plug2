// Auth-gate tests for the remaining edge functions: create-settlement,
// verify-settlement, paystack-webhook. Expect 401/400 (rejection), NOT 500/200-with-data.
const BASE = 'https://verncapitxzsgcughvil.supabase.co/functions/v1';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlcm5jYXBpdHh6c2djdWdodmlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNzgyMzIsImV4cCI6MjA5NDY1NDIzMn0.pBOZyqnRduPZZksdmy4hJAUxZPSPd1zSkwSMNYAWaeo';

async function test(name, path, body) {
  try {
    const r = await fetch(`${BASE}/${path}`, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    const ok = r.status === 401 || r.status === 403 || r.status === 400 || r.status === 422;
    console.log(`${ok ? '✓' : '✗'} [${r.status}] ${name} → ${text.slice(0, 140)}`);
  } catch (e) {
    console.log(`✗ [ERROR] ${name} → ${e.message}`);
  }
}

(async () => {
  await test('create-settlement (anon)', 'create-settlement', { rider_id: '00000000-0000-4000-8000-000000000000', amount: 10 });
  await test('verify-settlement (anon)', 'verify-settlement', { reference: 'test-ref-123' });
  await test('paystack-webhook (no signature)', 'paystack-webhook', { event: 'charge.success', data: { reference: 'x' } });
})();
