-- Optional: store vendor→dropoff distance at checkout for rider/admin display.
alter table public.orders
  add column if not exists distance_km numeric;
