-- ============================================================
-- Waakye Plug — Order lifecycle schema prep (Story 1)
-- Target project: verncapitxzsgcughvil (LIVE production)
-- Written: 2026-09-24
--
-- WHAT THIS DOES (summary for review):
--   1. orders.status DEFAULT → 'available' (was 'pending';
--      'pending' is a ghost status rejected by orders_status_check).
--   2. Add delivery_code_hash (bcrypt hash only — never plaintext for riders).
--   3. Add cancel / release audit columns on orders.
--   4. Add profiles.pending_delivery_fee_owed for cancel-after-moving debt
--      (customer owes 70% of delivery fee on next order — see COMMENT).
--   5. Strip ghost status 'ready' from orders SELECT + rider UPDATE RLS
--      (canonical statuses only: available | rider_assigned | picked_up |
--      delivered | cancelled).
--
-- LOCKED PRODUCT RULES (do not drift):
--   - Statuses: available | rider_assigned | picked_up | delivered | cancelled
--   - Release: only rider_assigned → available + clear rider_id
--   - Admin cancel: available | rider_assigned | picked_up; clear rider_id
--   - Cancel-after-moving (picked_up → cancelled): refund food;
--     customer owes 70% of delivery_fee on next order
--       → profiles.pending_delivery_fee_owed += 0.70 * delivery_fee
--   - delivery_code_hash: bcrypt; riders never see plaintext
--   - orders UPDATE grants stay (rider_id, status) ONLY — new columns
--     are written by admin / service-role paths, not by authenticated grants
--
-- DOES NOT: apply runtime triggers for transitions, change app UI,
--           or broaden column GRANT UPDATE on orders.
-- Apply in Supabase Dashboard → SQL Editor after Morrison merges.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. orders.status DEFAULT: pending → available
-- ------------------------------------------------------------
ALTER TABLE public.orders
  ALTER COLUMN status SET DEFAULT 'available';

-- ------------------------------------------------------------
-- 2. Delivery code (hash only) + cancel / release audit columns
-- ------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_code_hash text,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid,
  ADD COLUMN IF NOT EXISTS released_at timestamptz,
  ADD COLUMN IF NOT EXISTS release_reason text;

COMMENT ON COLUMN public.orders.delivery_code_hash IS
  'bcrypt hash of the customer delivery confirmation code. Riders never receive plaintext; verify via edge function / service role.';

COMMENT ON COLUMN public.orders.cancel_reason IS
  'Human-readable reason when status becomes cancelled (admin/vendor/system).';

COMMENT ON COLUMN public.orders.cancelled_at IS
  'Timestamp when the order was cancelled.';

COMMENT ON COLUMN public.orders.cancelled_by IS
  'auth.users.id (or service actor) who cancelled the order.';

COMMENT ON COLUMN public.orders.released_at IS
  'Timestamp when a rider release returned the order to available (rider_assigned → available, rider_id cleared).';

COMMENT ON COLUMN public.orders.release_reason IS
  'Why the rider was released from the order.';

-- ------------------------------------------------------------
-- 3. Cancel-after-moving debt on profiles (least invasive)
-- ------------------------------------------------------------
-- When an order is cancelled after pickup (picked_up → cancelled):
--   - Refund food to customer
--   - Customer owes 70% of that order's delivery_fee on their NEXT order
-- App / edge function should:
--   UPDATE profiles SET pending_delivery_fee_owed =
--     pending_delivery_fee_owed + (0.70 * orders.delivery_fee)
--   WHERE id = orders.customer_id;
-- Then on the next successful checkout, apply and clear the balance.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pending_delivery_fee_owed numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.pending_delivery_fee_owed IS
  'GHS owed from cancel-after-moving: add 70% of cancelled order delivery_fee; collect on next order then clear. Default 0. Written by admin/service role only — not granted to authenticated self-UPDATE.';

-- Intentionally NO new GRANT UPDATE on profiles for this column.
-- Authenticated self-update remains (full_name, phone) only
-- (see 2026-09-12_rls_lockdown.sql / 2026-09-13_profiles_self_write_lockdown.sql).

-- Intentionally NO new GRANT UPDATE columns on orders.
-- Authenticated order UPDATE remains (rider_id, status) only.

-- ------------------------------------------------------------
-- 4. RLS: remove ghost status 'ready' from claimable-order quals
-- ------------------------------------------------------------
-- Live SELECT policy (untouched by 2026-09-12 lockdown) still listed
-- 'ready' alongside 'available'. Rider UPDATE policy from lockdown also
-- listed 'ready'. Canonical CHECK already rejects 'ready' writes; clean
-- policies so claimable pool is available-only.

DROP POLICY IF EXISTS "orders_select_relevant" ON public.orders;

CREATE POLICY "orders_select_relevant"
  ON public.orders
  FOR SELECT
  USING (
    (customer_id = auth.uid())
    OR owns_vendor(vendor_id)
    OR (
      rider_id IS NULL
      AND status = 'available'
      AND delivery_mode = 'delivery'
      AND is_approved_rider()
    )
    OR (
      rider_id IS NOT NULL
      AND is_my_rider_profile(rider_id)
    )
    OR is_admin()
  );

DROP POLICY IF EXISTS "orders_update_rider_scoped" ON public.orders;

CREATE POLICY "orders_update_rider_scoped"
  ON public.orders
  FOR UPDATE
  USING (
    (rider_id IS NOT NULL AND is_my_rider_profile(rider_id))
    OR (
      rider_id IS NULL
      AND status = 'available'
      AND delivery_mode = 'delivery'
      AND is_approved_rider()
    )
  )
  WITH CHECK (
    (rider_id IS NOT NULL AND is_my_rider_profile(rider_id))
    OR rider_id IS NULL
  );

COMMIT;

-- ============================================================
-- POST-FLIGHT VERIFICATION (run after apply on verncapitxzsgcughvil):
--
--   SELECT column_name, column_default
--   FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='orders' AND column_name='status';
--   -- expect default involving 'available'
--
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='orders'
--     AND column_name IN (
--       'delivery_code_hash','cancel_reason','cancelled_at','cancelled_by',
--       'released_at','release_reason'
--     )
--   ORDER BY 1;
--
--   SELECT column_name, column_default
--   FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='profiles'
--     AND column_name='pending_delivery_fee_owed';
--
--   SELECT policyname, qual FROM pg_policies
--   WHERE schemaname='public' AND tablename='orders'
--     AND policyname IN ('orders_select_relevant','orders_update_rider_scoped');
--   -- quals must NOT mention 'ready'
--
--   SELECT table_name, column_name FROM information_schema.column_privileges
--   WHERE table_schema='public' AND table_name='orders'
--     AND grantee='authenticated' AND privilege_type='UPDATE'
--   ORDER BY column_name;
--   -- expect ONLY rider_id, status
-- ============================================================
