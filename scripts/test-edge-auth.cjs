// Test edge function auth gates (add-rider, decline-rider, approve-rider)
// Edge functions are deployed at https://<project>.supabase.co/functions/v1/<func>
const project = 'verncapitxzsgcughvil';
const base = `https://${project}.supabase.co/functions/v1`;
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlcm5jYXBpdHh6c2djdWdodmlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNzgyMzIsImV4cCI6MjA5NDY1NDIzMn0.pBOZyqnRduPZZksdmy4hJAUxZPSPd1zSkwSMNYAWaeo';

// Helper to make fetch
async function testFunc(name, url, method = 'POST', body = null, extraHeaders = {}) {
  const headers = {
    'apikey': anonKey,
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  try {
    const r = await fetch(url, opts);
    const text = await r.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = null; }
    console.log(`[${r.status}] ${name} → ${text.slice(0, 120)}`);
    return { status: r.status, body: parsed };
  } catch (e) {
    console.log(`[ERROR] ${name} → ${e.message}`);
    return null;
  }
}

(async () => {
  console.log('=== Edge function auth gate tests (expect 401/403 on unauthorized) ===');

  // add-rider (admin required)
  await testFunc('add-rider', `${base}/add-rider`, 'POST', {
    full_name: 'Test Rider',
    phone: '1234567890',
    pin: '1234',
    photo_url: null,
    transport_type: 'walk',
    ghana_card_number: 'GH-1234567-8',
    home_area: 'Test',
    emergency_contact_name: 'Emergency',
    emergency_contact_phone: '0999999999',
    deposit_amount: 0,
  });

  // decline-rider (admin required)
  await testFunc('decline-rider', `${base}/decline-rider`, 'POST', {
    rider_id: '550e8400-e29b-41d4-a716-446655440000',
  });

  // approve-rider (admin required)
  await testFunc('approve-rider', `${base}/approve-rider`, 'POST', {
    rider_id: '550e8400-e29b-41d4-a716-446655440000',
  });

  // rider-login (should return 400/401 if no matching rider)
  await testFunc('rider-login', `${base}/rider-login`, 'POST', {
    phone: '9999999999',
    pin: '0000',
  });

  // reset-pin (should return 400/429 if missing fields)
  await testFunc('reset-pin', `${base}/reset-pin`, 'POST', {
    phone: '9999999999',
    ghana_card_number: 'GH-0000000-0',
    new_pin: '5678',
  });

  console.log('\n=== Auth gate checks completed ===');
})();