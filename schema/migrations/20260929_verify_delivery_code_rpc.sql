-- Compare a 4-digit code to orders.delivery_code_hash (pgcrypto crypt/bf).
-- Used by verify-delivery edge function — Deno bcrypt often mismatches pgcrypto hashes.

create or replace function public.verify_delivery_code_hash(p_code text, p_hash text)
returns boolean
language sql
immutable
strict
as $$
  select p_hash is not null and p_hash = crypt(p_code, p_hash);
$$;

revoke all on function public.verify_delivery_code_hash(text, text) from public;
grant execute on function public.verify_delivery_code_hash(text, text) to service_role;
