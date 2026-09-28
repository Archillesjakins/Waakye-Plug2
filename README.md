# Waakye Plug — Customer App (`Waakye-Plug2`)

Customer-facing ordering web app for Waakye Plug — Ghanaian waakye / food delivery. Users pick a nearby vendor (geo-filtered within **6 km**), build a bowl / add menu items, checkout for delivery, and track order status in realtime. Live testing and ops are centered on **Ho, Volta Region** (not exclusively Accra); do not assume broader city coverage beyond that.

**Live:** https://waakye-plug2.vercel.app  
**Repo:** [Spidey2342/Waakye-Plug2](https://github.com/Spidey2342/Waakye-Plug2)  
**Shared Supabase:** `verncapitxzsgcughvil`

## Platform siblings

| App | Repo | Live |
|---|---|---|
| **Customer (this repo)** | Spidey2342/Waakye-Plug2 | https://waakye-plug2.vercel.app |
| Rider | [Spidey2342/Waakye-plug-rider](https://github.com/Spidey2342/Waakye-plug-rider) | https://waakye-plug-rider.vercel.app |
| Admin | [Spidey2342/waakyeplug-vendor](https://github.com/Spidey2342/waakyeplug-vendor) | https://waakyeplug-vendor.vercel.app |

## Stack

- Vite 6 + React 18 + TypeScript + Tailwind 4
- Figma Make export heritage (Radix/MUI UI kit under `src/app/components/ui/`)
- Supabase anon Auth + Realtime
- **This repo also owns `schema/` migrations** for the shared database

## Quick start

See **[docs/SETUP.md](docs/SETUP.md)**.

```bash
npm install
# .env: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev
```

Note: `npm run build` is `vite build` only — **no `tsc` in the build script** (known gap).

## Documentation

| Doc | Contents |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Contexts, auth, order create, schema ownership |
| [docs/FEATURES.md](docs/FEATURES.md) | Every screen, lib, context, migration, helper component |
| [docs/SETUP.md](docs/SETUP.md) | Env, scripts, migrations apply notes |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Hours gating, fees, WhatsApp group, gaps |
| [docs/VENDOR_ORDERING_HOURS.md](docs/VENDOR_ORDERING_HOURS.md) | **Platform 9 PM cutoff + per-vendor daily hours** (team rollout) |
| [AUDIT.md](AUDIT.md) | Security/bug audit + fix log (keep) |

## Platform constants

| Constant | Value |
|---|---|
| Delivery fee | **8 / 10 / 15 GHS** by vendor→dropoff distance (`deliveryPricing.ts`: ≤3.5 / ≤4 / >4 km) |
| `SERVICE_FEE` | **1 GHS** |
| Commission (rider) | **10% of delivery fee** (DB trigger) |
| `MAX_DISTANCE_KM` | **6** (`VendorContext`) |
| Status enum | `available` → `rider_assigned` → `picked_up` → `delivered` \| `cancelled` |
| Synthetic customer email | `{userId}@customers.waakyeplug.app` |
| ClosedScreen WhatsApp group | https://chat.whatsapp.com/HM1OVHvnfZr0l1WPhJPRDg |
| Accra noon lock | Rider settlement (sibling app) |
| PR #1 | Rider accept `status=available` + Accra lock (sibling) |

## Known open gaps

- **Breakfast (P3):** Landing “breakfast” → toast “coming soon”; `SBlinkspage` dormant / unreachable from primary CTA
- **Hours:** Platform closes **9 PM**; per-vendor `daily_opens_at` / `daily_closes_at` — see [docs/VENDOR_ORDERING_HOURS.md](docs/VENDOR_ORDERING_HOURS.md). Migration `2026-09-26_vendor_daily_hours.sql` must be applied on Supabase.
- Build has **no `tsc`** step
- `createOrder` sets **`delivery_fee`** (+ **`distance_km`** when computable) from vendor GPS → dropoff pin
- Pickup mode is a disabled “coming soon” affordance; delivery-only in practice

## Schema home

SQL migrations under `schema/migrations/` are the shared source of truth for status CHECK, PIN rate limits, and RLS lockdown. See FEATURES / SETUP.
