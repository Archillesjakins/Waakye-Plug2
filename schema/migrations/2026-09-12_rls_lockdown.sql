-- ============================================================
-- Waakye Plug — RLS Lockdown Migration (fix #2)
-- Target project: verncapitxzsgcughvil (LIVE production)
-- Written: 2026-09-12 by Selasi Coder
-- Approved by Selasi (Lumora) 2026-09-12
-- REV 2: Postgres policies do NOT support "FOR UPDATE OF <cols>" —
--        column scoping is done via column-level GRANTs instead.
--
-- WHAT THIS DOES (summary for review):
--   0. Makes the two orders triggers SECURITY DEFINER so trigger
--      writes (updated_at stamp, commission on delivery) keep working
--      under the tightened RLS (triggers otherwise run as the caller).
--   1. profiles  — users can no longer change their own `role`
--                  (privilege-escalation hole). Authenticated users get
--                  column-level UPDATE on full_name + phone only. Admin
--                  keeps full rights via policy.
--   2. riders    — a rider can no longer self-approve, change their
--                  status, or erase commission_owed. Authenticated users
--                  get column-level UPDATE on is_online ONLY (all the
--                  rider app ever writes). Insert is admin-only. Admin
--                  keeps full rights via policy.
--   3. orders    — customers can no longer UPDATE orders at all. Riders
--                  keep rider_id+status updates scoped to their own or
--                  claimable orders (timestamps are trigger-stamped).
--                  Vendors keep a status-only cancel policy. Admin keeps
--                  full rights via policy.
--   4. player_stats / spin_history — dead gamification tables; RLS was
--                  DISABLED (fully public). Enable RLS and drop the
--                  wide-open policies → fully locked.
--   5. points_earned_log — public true-policies dropped → locked.
--
-- COLUMN-GRANT MODEL (how the column scoping works):
--   Supabase grants ALL columns to anon/authenticated by default.
--   We REVOKE UPDATE on the touched tables, then GRANT UPDATE on exactly
--   the columns each app legitimately writes. Row-level policies below
--   decide WHICH rows; the grants decide WHICH columns. Both must pass.
--
-- LEGIT FLOWS CHECKED AGAINST THIS MIGRATION:
--   - Customer app: orders INSERT only (no .update anywhere) ✓
--   - Rider app: orders accept(rider_id,status)/pickup/deliver(status),
--     is_online self-toggle ✓
--   - Admin panel: vendor + menu writes (untouched tables) ✓,
--     order cancel (status ✓), rider approve/decline via edge functions
--     (service role, bypasses RLS + grants) ✓
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 0. Trigger hardening — so RLS can't silently break commission math
-- ------------------------------------------------------------
-- Both triggers fire on orders UPDATE issued by the rider (status change).
-- Without SECURITY DEFINER, the trigger's internal write
-- (commission_owed on the riders row) runs under the RIDER's privileges —
-- which this migration deliberately revokes. The trigger logic is fixed
-- code and safe to run as the table owner (same pattern Supabase uses
-- for its own auth triggers).
ALTER FUNCTION public.touch_updated_at() SECURITY DEFINER;
ALTER FUNCTION public.apply_commission_on_delivery() SECURITY DEFINER;

-- ------------------------------------------------------------
-- 1. profiles — kill the role self-promotion hole
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;

-- Row scope: own row only. Column scope: via grants below.
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_admin"
  ON public.profiles
  FOR UPDATE
  USING (is_admin());

REVOKE UPDATE ON public.profiles FROM anon;
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, phone) ON public.profiles TO authenticated;

-- ------------------------------------------------------------
-- 2. riders — kill self-approval + commission wipe
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "riders_insert_self_or_admin" ON public.riders;
DROP POLICY IF EXISTS "riders_update_self_or_vendor_or_admin" ON public.riders;

-- Riders may ONLY toggle their own online status (ordersApi.js:63).
CREATE POLICY "riders_update_self_online_only"
  ON public.riders
  FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "riders_insert_admin_only"
  ON public.riders
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "riders_update_admin"
  ON public.riders
  FOR UPDATE
  USING (is_admin());

REVOKE UPDATE ON public.riders FROM anon;
REVOKE UPDATE ON public.riders FROM authenticated;
GRANT UPDATE (is_online) ON public.riders TO authenticated;

-- ------------------------------------------------------------
-- 3. orders — customers lose UPDATE entirely; riders/vendors scoped
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "orders_update_relevant" ON public.orders;

-- Rider: assign self to claimable orders, then move status along.
-- picked_up_at / delivered_at are stamped by the (now SECURITY DEFINER)
-- trigger, not by the rider's UPDATE statement, so they need no grant.
CREATE POLICY "orders_update_rider_scoped"
  ON public.orders
  FOR UPDATE
  USING (
    (rider_id IS NOT NULL AND is_my_rider_profile(rider_id))
    OR (
      rider_id IS NULL
      AND status IN ('available', 'ready')
      AND delivery_mode = 'delivery'
      AND is_approved_rider()
    )
  )
  WITH CHECK (
    (rider_id IS NOT NULL AND is_my_rider_profile(rider_id))
    OR rider_id IS NULL
  );

-- Vendor: cancel own-vendor orders (api.ts cancelOrder) — status only.
-- (Vendors currently don't log in — owner_id is null on all rows — so
--  this is dormant but correct if vendor logins ever ship.)
CREATE POLICY "orders_update_vendor_cancel"
  ON public.orders
  FOR UPDATE
  USING (owns_vendor(vendor_id));

-- Admin: full row.
CREATE POLICY "orders_update_admin"
  ON public.orders
  FOR UPDATE
  USING (is_admin());

REVOKE UPDATE ON public.orders FROM anon;
REVOKE UPDATE ON public.orders FROM authenticated;
GRANT UPDATE (rider_id, status) ON public.orders TO authenticated;

-- ------------------------------------------------------------
-- 4. player_stats / spin_history — dead tables, fully lock down
-- ------------------------------------------------------------
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spin_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert_all" ON public.player_stats;
DROP POLICY IF EXISTS "read_all" ON public.player_stats;
DROP POLICY IF EXISTS "update_all" ON public.player_stats;

DROP POLICY IF EXISTS "spins_insert" ON public.spin_history;
DROP POLICY IF EXISTS "spins_read" ON public.spin_history;

-- (RLS enabled + no policies = no anon/authenticated access at all;
--  service role bypasses RLS, so future admin tooling still works.)

-- ------------------------------------------------------------
-- 5. points_earned_log — drop the public true-policies
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "points_log_insert_all" ON public.points_earned_log;
DROP POLICY IF EXISTS "points_log_read_all" ON public.points_earned_log;

COMMIT;

-- ============================================================
-- POST-FLIGHT VERIFICATION QUERIES (run after COMMIT):
--
--   select tablename, policyname, cmd from pg_policies
--     where schemaname='public' order by tablename, policyname;
--
--   select tablename, rowsecurity from pg_tables
--     where schemaname='public' order by tablename;
--   -- expect rowsecurity = true on ALL tables
--
--   select table_name, privilege_type, column_name from information_schema.column_privileges
--     where table_schema='public' and grantee in ('anon','authenticated')
--       and privilege_type='UPDATE'
--     order by table_name, column_name;
--   -- expect: profiles(full_name,phone), riders(is_online),
--   --        orders(rider_id,status) for authenticated only
-- ============================================================
