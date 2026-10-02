-- Vendor daily ordering window (local Ghana time on clients).
-- NULL on either column = no schedule → customer app treats vendor as closed for orders.

BEGIN;

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS daily_opens_at time,
  ADD COLUMN IF NOT EXISTS daily_closes_at time;

COMMENT ON COLUMN public.vendors.daily_opens_at IS
  'Local time (Ghana) when this vendor starts accepting orders each day. NULL = not scheduled (closed on customer app).';

COMMENT ON COLUMN public.vendors.daily_closes_at IS
  'Local time (Ghana) when this vendor stops accepting orders each day. NULL = not scheduled (closed on customer app).';

COMMIT;
