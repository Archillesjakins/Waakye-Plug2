-- Store vendor→dropoff distance (km) at checkout for rider/admin display.
-- Required for customer app main (c701edf+) which inserts distance_km on createOrder.
-- Project: verncapitxzsgcughvil — Supabase Dashboard → SQL Editor → Run once.
alter table public.orders
  add column if not exists distance_km numeric;

comment on column public.orders.distance_km is
  'Straight-line km vendor GPS → customer dropoff pin at order placement.';
