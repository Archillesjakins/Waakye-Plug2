-- Rider GPS column grants (companion to 2026-09-12_rls_lockdown.sql)
--
-- Why: After login the rider app calls updateRiderLocation, which UPDATEs
-- riders.current_lat / current_lng / location_updated_at. The lockdown
-- migration only granted UPDATE (is_online). Live already has these three
-- grants (applied ad-hoc); this file versions them so a re-apply of lockdown
-- cannot quietly strip GPS sync.
--
-- Safe to re-run. Does NOT revoke anything. Does NOT re-run lockdown.
-- Apply in Supabase Dashboard → SQL Editor (requires elevated privileges).

GRANT UPDATE (current_lat, current_lng, location_updated_at)
  ON public.riders
  TO authenticated;
