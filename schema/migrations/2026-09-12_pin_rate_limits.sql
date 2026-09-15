-- ============================================================
-- Waakye Plug — PIN rate limiting infrastructure (Fix #3: S1/S2)
-- 2026-09-12
--
-- Backs the new `rider-login` edge function and the hardened
-- `reset-pin` edge function. All writes happen through the
-- SECURITY DEFINER functions below; the table itself is locked
-- down (RLS on, no grants, no policies) so nothing can be read
-- or tampered with through the public API.
-- ============================================================

create table if not exists public.auth_rate_limits (
  bucket            text primary key,
  attempt_count     integer not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until      timestamptz,
  updated_at        timestamptz not null default now()
);

alter table public.auth_rate_limits enable row level security;

-- No policies on purpose: only the service role (edge functions) may touch it.
revoke all on public.auth_rate_limits from anon, authenticated;

-- ------------------------------------------------------------
-- begin_auth_attempt: call BEFORE processing any login/reset.
-- Atomically checks the failure window + lockout for this bucket.
-- Returns { allowed, retry_after_sec?, attempts_left? }.
-- Failure counting itself happens in record_auth_failure.
-- ------------------------------------------------------------
create or replace function public.begin_auth_attempt(
  p_bucket          text,
  p_max_attempts    int default 5,
  p_window_minutes  int default 15,
  p_lockout_minutes int default 15
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count        int;
  v_window_start timestamptz;
  v_locked_until timestamptz;
begin
  -- Make sure the row exists, then lock it so concurrent attempts serialize.
  insert into auth_rate_limits (bucket) values (p_bucket)
  on conflict (bucket) do nothing;

  select attempt_count, window_started_at, locked_until
    into v_count, v_window_start, v_locked_until
  from auth_rate_limits
  where bucket = p_bucket
  for update;

  -- Currently locked out?
  if v_locked_until is not null and v_locked_until > now() then
    return jsonb_build_object(
      'allowed',         false,
      'retry_after_sec', ceil(extract(epoch from (v_locked_until - now())))::int
    );
  end if;

  -- Outside the failure window -> start a fresh window.
  if v_window_start < now() - make_interval(mins => p_window_minutes) then
    update auth_rate_limits
       set attempt_count = 0,
           window_started_at = now(),
           locked_until = null,
           updated_at = now()
     where bucket = p_bucket;
    v_count := 0;
  end if;

  -- Too many failures inside the active window -> lock the bucket.
  if v_count >= p_max_attempts then
    update auth_rate_limits
       set locked_until = now() + make_interval(mins => p_lockout_minutes),
           updated_at = now()
     where bucket = p_bucket;
    return jsonb_build_object(
      'allowed',         false,
      'retry_after_sec', p_lockout_minutes * 60
    );
  end if;

  return jsonb_build_object(
    'allowed',       true,
    'attempts_left', p_max_attempts - v_count
  );
end;
$$;

-- ------------------------------------------------------------
-- record_auth_failure: call AFTER a failed verification.
-- ------------------------------------------------------------
create or replace function public.record_auth_failure(p_bucket text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into auth_rate_limits (bucket, attempt_count, window_started_at)
  values (p_bucket, 1, now())
  on conflict (bucket) do update
    set attempt_count = auth_rate_limits.attempt_count + 1,
        updated_at    = now();
$$;

-- ------------------------------------------------------------
-- clear_auth_failures: call AFTER a successful verification.
-- ------------------------------------------------------------
create or replace function public.clear_auth_failures(p_bucket text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from auth_rate_limits where bucket = p_bucket;
$$;

-- Only the service role (edge functions) may call these.
revoke all on function public.begin_auth_attempt(text, int, int, int) from public, anon, authenticated;
revoke all on function public.record_auth_failure(text) from public, anon, authenticated;
revoke all on function public.clear_auth_failures(text) from public, anon, authenticated;

grant execute on function public.begin_auth_attempt(text, int, int, int) to service_role;
grant execute on function public.record_auth_failure(text) to service_role;
grant execute on function public.clear_auth_failures(text) to service_role;
