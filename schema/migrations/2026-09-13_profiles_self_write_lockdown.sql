-- 2026-09-13 — profiles self-write lockdown
--
-- REGRESSION CONTEXT (Fix #5):
-- PostgREST's upsert (INSERT ... ON CONFLICT DO UPDATE) demands UPDATE
-- privileges on EVERY column in the payload, even when the row does not exist
-- yet. UserContext.setUser() upserted {id, full_name, phone, email, role}.
-- After the Fix #2 lockdown, anon had no UPDATE grant at all and authenticated
-- only had UPDATE(full_name, phone) -> every profile save failed with
-- 42501 "permission denied for table profiles", surfaced by PostgREST as
-- HTTP 403 (the exact error Selasi saw from UserContext.tsx:84 in a real
-- browser). Fix: the client no longer upserts — first save is an INSERT,
-- repeat saves are a targeted UPDATE of full_name/phone only.
--
-- DEFENCE IN DEPTH:
-- The profiles_insert_self RLS policy already forces (role = 'customer'), so
-- a self-serve INSERT cannot self-assign admin/vendor/rider. Revoke the
-- privilege as well so role can never be written directly by anon/auth, no
-- matter what a client sends. role is set by its column default ('customer')
-- for customers, and by service-role edge functions (add-rider etc.) for staff.
--
-- NOTE: Postgres table-level and column-level privileges are OR'ed, not
-- overridden, so a bare "REVOKE INSERT (role)" is a NO-OP while the table-wide
-- "GRANT INSERT" (which Supabase grants by default) still stands. We must drop
-- the table-level INSERT first, then re-grant INSERT on just the columns a
-- customer legitimately sends. role is intentionally excluded.
REVOKE INSERT ON public.profiles FROM anon, authenticated;
GRANT INSERT (id, full_name, phone, email) ON public.profiles TO anon, authenticated;

-- Verify grants (expect: INSERT on id/full_name/phone/email ONLY, no 'role'):
--   SELECT grantee, privilege_type, column_name
--   FROM information_schema.column_privileges
--   WHERE table_schema='public' AND table_name='profiles'
--     AND grantee IN ('anon','authenticated') AND privilege_type='INSERT'
--   ORDER BY grantee, column_name;

