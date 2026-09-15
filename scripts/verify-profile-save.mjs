// Repro + verification for the 403-on-profiles-save regression.
// Replays the EXACT call sequence UserContext.tsx makes from a browser session:
//   1. signInAnonymously()  -> role = authenticated
//   2. select id from profiles where id = uid  (maybeSingle)
//   3a. no row -> INSERT (id, full_name, phone, email)
//   3b. row exists -> UPDATE full_name/phone
// Run: node scripts/verify-profile-save.mjs   (exit 0 = all green)
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

const step = (n, msg) => console.log(`[${n}] ${msg}`)
let failures = 0
const ok = (n, msg) => console.log(`  PASS [${n}] ${msg}`)
const fail = (n, msg, err) => { failures++; console.log(`  FAIL [${n}] ${msg}`, err ?? '') }

// ---------- step 1: anonymous sign-in ----------
step(1, 'anonymous sign-in (browser role = authenticated)')
const { data: auth, error: authErr } = await supabase.auth.signInAnonymously()
if (authErr) { fail(1, 'anon sign-in', authErr); process.exit(1) }
const uid = auth.user.id
ok(1, `signed in as ${uid}`)

try {
  // ---------- step 2: does a profile row exist? ----------
  step(2, 'select id from profiles (maybeSingle)')
  const { data: existing, error: selErr } = await supabase
    .from('profiles').select('id').eq('id', uid).maybeSingle()
  if (selErr) { fail(2, 'select', selErr); process.exit(1) }
  ok(2, existing ? 'row exists -> will UPDATE' : 'no row -> will INSERT')

  // ---------- step 3: save ----------
  const syntheticEmail = `${uid}@customers.waakyeplug.app`
  step(3, existing ? 'UPDATE full_name/phone' : 'INSERT (id, full_name, phone, email)')
  const name = 'QA Save Test'
  const phoneNum = '0500000000'
  const { error: saveErr } = existing
    ? await supabase.from('profiles').update({ full_name: name, phone: phoneNum }).eq('id', uid)
    : await supabase.from('profiles').insert({ id: uid, full_name: name, phone: phoneNum, email: syntheticEmail })
  if (saveErr) { fail(3, existing ? 'update' : 'insert', saveErr); process.exit(1) }
  ok(3, 'save accepted (no 403)')

  // ---------- step 4: read back + second save (the UPDATE path) ----------
  step(4, 'read back + second save (update path)')
  const { data: after } = await supabase.from('profiles').select('full_name, phone').eq('id', uid).maybeSingle()
  if (after?.full_name !== name || after?.phone !== phoneNum) { fail(4, 'read-back mismatch', after); process.exit(1) }
  const { error: updErr } = await supabase.from('profiles').update({ full_name: `${name} II`, phone: phoneNum }).eq('id', uid)
  if (updErr) { fail(4, 'second update', updErr); process.exit(1) }
  ok(4, 'read-back + update path green')
} finally {
  // ---------- cleanup: delete the QA profile row + auth user ----------
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (svcKey) {
    const admin = createClient(env.VITE_SUPABASE_URL, svcKey)
    await admin.from('profiles').delete().eq('id', uid)
    await admin.auth.admin.deleteUser(uid)
    console.log('[cleanup] QA profile + auth user deleted (service role)')
  } else {
    console.log(`[cleanup] SKIPPED — set SUPABASE_SERVICE_ROLE_KEY to auto-delete uid ${uid}`)
  }
}

console.log(failures === 0 ? '\nALL GREEN ✅' : `\n${failures} FAILURE(S) ❌`)
process.exit(failures === 0 ? 0 : 1)
