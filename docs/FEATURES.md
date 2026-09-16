# Customer App — Features (exhaustive inventory)

Every product screen, context, lib, utility, shared component used by the flow, and schema migration. UI kit files under `components/ui/` are listed as a group (design-system dump), not as product features.

## Screens (`src/app/components/screens/`)

### `UsernameScreen.tsx`
- Collects display name + phone before ordering
- Copy references fresh mornings **5:30 – 8:00 AM**
- Calls `UserContext.setUser`

### `VendorSelectScreen.tsx`
- Uses `VendorContext` location status: pending / granted / denied / unavailable
- Lists approved vendors sorted by distance; filters to **`MAX_DISTANCE_KM = 6`**
- On select → continues into landing flow

### `LandingScreen.tsx`
- Waakye vs Breakfast entry
- Breakfast CTA shows **Coming soon** / App routes breakfast build to toast (`Breakfast ordering is coming soon!`)
- Copy: made fresh **5:30 – 8:00 AM**

### `HomeScreen.tsx`
- Vendor menu browsing (from `vendorMenu` / cart flows)
- Open item detail, build-own waakye, my orders

### `ItemDetailScreen.tsx`
- Single menu item detail → add to cart

### `BuildWaakyeScreen.tsx`
- Custom waakye builder (sizes/proteins/extras from menu categories / `orderTypes` helpers)
- Adds composed line to cart → typically summary

### `SBlinkspage.tsx` (breakfast)
- Legacy breakfast builder UI
- **Dormant:** not converted to cart model; `App.tsx` `build2` case exists but Landing no longer navigates here for real orders (P3)

### `OrderSummaryScreen.tsx`
- Cart review; shows **DELIVERY_FEE (8)** and **SERVICE_FEE (1)**
- Delivery address + payment method `cash` | `momo`
- Geolocation assists; uses `alert()` for some geo errors (rough edge)
- Places order via `createOrder`

### `ConfirmationScreen.tsx`
- Live status tracker for canonical steps: available → rider_assigned → picked_up → delivered
- Realtime subscription on the order row
- Cancelled handled via header copy map

### `MyOrdersScreen.tsx`
- `fetchMyOrders(customerId)` from Supabase (single history source after P2 fix)
- Realtime-friendly status display; rider name/phone when joined

### `ClosedScreen.tsx`
- Shown when ordering status is closed (or forced)
- Countdown via `CountdownTimer`
- **Follow on WhatsApp** → `https://chat.whatsapp.com/HM1OVHvnfZr0l1WPhJPRDg`
- Copy currently mentions **5:00 PM** pre-orders / menu drop — conflicts with AM window comments (P4)

---

## App shell & shared components

| File | Role |
|---|---|
| `src/app/App.tsx` | Screen state machine; hours polling; breakfast toast; order submit → confirm |
| `src/main.tsx` | Mount + providers |
| `CountdownTimer.tsx` | HH:MM:SS countdown |
| `FloatingCartButton.tsx` | Jump to summary when cart non-empty |
| `MenuItemThumbnail.tsx` | Menu thumbnails |
| `figma/ImageWithFallback.tsx` | Image with fallback |
| `components/ui/*` | Full Radix/shadcn-style kit (accordion … tooltip, etc.) — not product screens |

---

## Contexts (`src/app/context/`)

### `UserContext.tsx`
- Anonymous auth session → `userId`
- `setUser(name, phone)` with synthetic email `{userId}@customers.waakyeplug.app`
- INSERT vs UPDATE split (no upsert) for RLS safety
- Exposes `hasUser`, `ready`

### `VendorContext.tsx`
- `MAX_DISTANCE_KM = 6`
- `getApprovedVendors` + Haversine `distanceKm`
- Location permission state machine
- `selectedVendor` selection

### `CartContext.tsx`
- Cart lines / quantities; `lineUnitPrice`
- `deliveryMode` default `'delivery'`; pickup disabled coming soon
- Totals: items + delivery fee (if delivery) + service fee
- `paymentMethod: 'cash' | 'momo'`

---

## Libraries (`src/app/lib/`)

### `supabase.ts`
- `createClient` from `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`

### `orders.ts`
- `flattenCartItems(lines)`
- `createOrder({ customerId, vendorId, lines, totalAmount, deliveryAddress, paymentMethod })`
  - Inserts `status: 'available'`, `delivery_mode: 'delivery'`
  - **Omits `delivery_fee`** → DB default

### `customerOrders.ts`
- `CustomerOrder` type (joins vendors + riders.profiles)
- `fetchMyOrders(customerId)`

### `vendorMenu.ts`
- Types `MenuItem`, `Vendor`
- `getApprovedVendors`, `getVendorMenu`, `groupMenuByCategory`, `distanceKm`

---

## Types & utils

### `src/app/types/orderTypes.ts`
- Bowl/breakfast types; `BOWL_SIZES`, `PROTEINS`, `EXTRAS`, etc. (some legacy breakfast structs)
- **`export const DELIVERY_FEE = 8`**
- **`export const SERVICE_FEE = 1`**
- `calculateOrderTotal` / `calculateBreakfastTotal` / message formatters

### `src/app/utils/timeUtils.ts`
- Comments: open **5:30 AM – 8:00 AM**
- Actual code: `openTime = 0`, `closeTime = 23*60+59` → **effectively always open**
- `DEMO_MODE`, `TEST_TIME` overrides
- `checkOrderingStatus`, `formatCountdown`

---

## Schema & migrations (`schema/`)

### Migrations
| File | Purpose |
|---|---|
| `migrations/2026-09-12_canonical_status.sql` | CHECK status ∈ available, rider_assigned, picked_up, delivered, cancelled |
| `migrations/2026-09-12_pin_rate_limits.sql` | `auth_rate_limits` + `begin_auth_attempt` / failure RPCs for rider-login & reset-pin |
| `migrations/2026-09-12_rls_lockdown.sql` | RLS + column grants; SECURITY DEFINER on commission/updated_at triggers; lock dead gamification tables |
| `migrations/2026-09-13_profiles_self_write_lockdown.sql` | Column-level INSERT grants without `role` |

### Other schema artifacts
| Path | Role |
|---|---|
| `schema.sql` | Dumped schema |
| `tables.txt` | Table/RPC list |
| `openapi-spec.json` | PostgREST OpenAPI |
| `rls-policies.json` / `rls-policies-clean.json` | Policy snapshots |
| `orderTypes.ORIGINAL.ts` | Historical types snapshot |
| `fetch-schema.cjs`, `smoke-test.cjs`, `cleanup-test-rider.cjs` | Tooling |
| `test-v4-commission-guard.cjs`, `test-v5-commission-guard.cjs` | decline-rider commission 409 tests |
| `git-show-error.txt` | Scratch |

### Tables referenced (`tables.txt`)
`vendors`, `orders`, `profiles`, `rider_settlements`, `vendor_menu_items`, `riders`, `order_issues`, plus legacy `player_stats`, `spin_history`, `points_earned_log`; RPCs `is_admin`, `get_my_role`, `is_approved_rider`, `is_my_rider_profile`, `owns_vendor`.

---

## Scripts (`scripts/`)

Operational/dev helpers (not runtime app features): `api-probe.cjs`, `deploy-settlements.ps1`, `esbuild-bundle.cjs`, `serve-dist.cjs`, `syntax-gate.cjs`, `test-all-tables.cjs`, `test-edge-auth.cjs`, `test-edge-auth-2.cjs`, `verify-profile-save.mjs`.

Also: `guidelines/Guidelines.md`, `ATTRIBUTIONS.md`.

---

## Constants & live URLs

| Item | Value |
|---|---|
| Live | https://waakye-plug2.vercel.app |
| Delivery / service | 8 / 1 GHS |
| Max distance | 6 km |
| Status enum | available → rider_assigned → picked_up → delivered \| cancelled |
| Customer synthetic email | `{userId}@customers.waakyeplug.app` |
| Rider synthetic email (sibling) | `{phone}@riders.waakyeplug.app` |
| WhatsApp group (ClosedScreen) | https://chat.whatsapp.com/HM1OVHvnfZr0l1WPhJPRDg |
| Rider support WhatsApp | 233599995651 TODO |
| Commission / Accra noon / Paystack +0.5 | rider/DB |
| PR #1 | rider accept+Accra lock |

## Known open gaps (customer)

1. Breakfast P3 disabled / `SBlinkspage` dormant
2. Hours P4 contradiction (comments vs always-open code vs ClosedScreen 5:00 PM copy)
3. No `tsc` in `npm run build`
4. `createOrder` relies on DB default `delivery_fee`
5. Pickup coming soon
6. Some `alert()` for geolocation errors
