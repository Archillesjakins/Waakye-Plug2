-- ============================================================================
-- 2026-09-12 — Canonical order status enum (tighten CHECK constraint)
-- Part of FIX #4 (order status mismatch / tracker fix).
--
-- WHY: the customer tracker maps exactly 5 real statuses:
--   available → rider_assigned → picked_up → delivered  (+ cancelled)
-- The old constraint still accepted two ghost statuses ('pending', 'ready')
-- that NO app ever writes (customer inserts 'available', rider app advances
-- rider_assigned/picked_up/delivered, vendor writes 'cancelled'). A stray
-- 'pending'/'ready' row would leave the customer tracker stuck on step 0.
--
-- Safe to tighten: verified 2026-09-12, live data contains ONLY
-- 'cancelled' (2 rows) and 'delivered' (12 rows).
-- ============================================================================

BEGIN;

-- Drop the permissive constraint (name confirmed live:
-- pg_constraint shows orders_status_check on public.orders)
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

-- Canonical set only — the statuses the three apps actually write.
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('available', 'rider_assigned', 'picked_up', 'delivered', 'cancelled'));

-- NOTE (deliberately NOT done): no NOT VALID / no data backfill needed —
-- verified above that zero rows carry ghost statuses.

COMMIT;

-- Verification (run after apply):
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid='public.orders'::regclass AND conname='orders_status_check';
-- Expected: CHECK ((status = ANY (ARRAY['available'::text, 'rider_assigned'::text,
--   'picked_up'::text, 'delivered'::text, 'cancelled'::text])))
-- Also confirm a ghost write is rejected:
--   UPDATE public.orders SET status='pending' WHERE id=(SELECT id FROM public.orders LIMIT 1);
--   → must fail with check_violation.
