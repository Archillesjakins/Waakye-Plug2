ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_lat double precision,
  ADD COLUMN IF NOT EXISTS delivery_lng double precision;
COMMENT ON COLUMN public.orders.delivery_lat IS 'Customer-confirmed dropoff latitude (GPS pin); rider nav source of truth';
COMMENT ON COLUMN public.orders.delivery_lng IS 'Customer-confirmed dropoff longitude (GPS pin); rider nav source of truth';
