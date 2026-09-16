# Customer App — Setup

## Prerequisites

- Node.js 20+
- npm
- Access to Supabase `verncapitxzsgcughvil` (or staging)

## Install

```bash
# Prefer upstream for pull; this account pushes docs via fork Archillesjakins/Waakye-Plug2
git clone https://github.com/Spidey2342/Waakye-Plug2.git
cd Waakye-Plug2
npm install
```

## Environment

`.env` (gitignored; never commit keys):

```bash
VITE_SUPABASE_URL=https://verncapitxzsgcughvil.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | `vite build` only (**no tsc**) |

## Applying migrations

Migrations in `schema/migrations/` target the **shared live project**. Apply via Supabase SQL Editor or CLI **in order**:

1. `2026-09-12_canonical_status.sql`
2. `2026-09-12_pin_rate_limits.sql`
3. `2026-09-12_rls_lockdown.sql`
4. `2026-09-13_profiles_self_write_lockdown.sql`

Do not re-apply casually on production without review — several are already live.

## Deploy

- Vercel project for customer app → https://waakye-plug2.vercel.app
- Set `VITE_SUPABASE_*` in Vercel

## Fork / PR workflow (docs)

Upstream `Spidey2342/Waakye-Plug2` is pull-only for Archillesjakins. Push documentation branches to `Archillesjakins/Waakye-Plug2` and open PRs into upstream `main`.

## Related

Rider edge functions + Paystack secrets are configured on the same Supabase project but authored in `Waakye-plug-rider`.
