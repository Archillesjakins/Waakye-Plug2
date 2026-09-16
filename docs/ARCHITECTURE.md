# Customer App — Architecture

## Role

Customers:

1. Sign in anonymously (Supabase Auth) and save name/phone to `profiles`
2. Grant location → choose an **approved** vendor within **6 km**
3. Browse menu / build waakye → cart → delivery checkout
4. Order inserted as `status: 'available'`
5. Track status on Confirmation / My Orders via Realtime

Riders claim and advance status; admin manages vendors/menus. Shared project: `verncapitxzsgcughvil`.

## Provider tree

```
main.tsx
  UserProvider
    VendorProvider
      CartProvider
        App (screen state machine)
```

No React Router for the product flow — `App.tsx` switches `currentScreen`.

### Gate order in `App.tsx`

1. Wait for `UserProvider.ready`
2. If `!hasUser` → `UsernameScreen`
3. If no `selectedVendor` → `VendorSelectScreen`
4. Else render current screen (+ FloatingCartButton on select screens)
5. Ordering-hours effect can force `ClosedScreen` when `checkOrderingStatus()` says closed

## Auth / profiles

- Anonymous Supabase session → `userId`
- Profile email is **synthetic**: `{userId}@customers.waakyeplug.app` (NOT NULL + UNIQUE on `profiles.email`)
- Saves intentionally **avoid upsert**: first visit INSERT (`role` default `customer`); later UPDATE `full_name` + `phone` only (RLS column grants after lockdown)
- Migration `2026-09-13_profiles_self_write_lockdown.sql` documents why upsert broke after Fix #2

## Contexts

| Context | Responsibility |
|---|---|
| `UserContext` | Auth uid, name/phone, `setUser` |
| `VendorContext` | Geolocation, approved vendors, distance sort/filter ≤ 6 km, selection |
| `CartContext` | Lines, delivery mode (delivery default; pickup coming soon), fees, payment method cash/momo |

## Order create path

`orders.ts` → `createOrder`:

- Flattens cart lines to item rows
- Inserts: customer_id, vendor_id, items, total_amount, `delivery_mode: 'delivery'`, delivery_address, payment_method, **`status: 'available'`**
- **Does not set `delivery_fee` in the insert** — depends on DB default (documented gap)
- Cart totals on the client still add `DELIVERY_FEE` (8) + `SERVICE_FEE` (1)

## Status tracker

`ConfirmationScreen` / My Orders expect the **canonical** enum:

`available → rider_assigned → picked_up → delivered` (+ `cancelled`)

Aligned with migration `2026-09-12_canonical_status.sql` and rider writers. Friendly labels (“Order Sent”, “Rider Assigned”, …).

## Schema ownership

This repo’s `schema/` includes:

- `schema.sql`, `tables.txt`, OpenAPI dump, RLS JSON snapshots
- Migrations (2026-09-12 status, PIN rate limits, RLS lockdown; 2026-09-13 profiles insert grants)
- Probe / smoke / commission-guard test scripts used during audits

Edge functions themselves live in the **rider** repo; PIN rate-limit **tables/RPCs** were migrated from here.

## Money & distance constants

| Symbol | Where | Value |
|---|---|---|
| `DELIVERY_FEE` | `orderTypes.ts` | 8 |
| `SERVICE_FEE` | `orderTypes.ts` | 1 |
| `MAX_DISTANCE_KM` | `VendorContext.tsx` | 6 |

Commission **10%** and Accra noon settlement lock are rider/DB concerns, not calculated in this app.

## UI kit

`src/app/components/ui/*` is the large Radix-based design-system dump from Figma Make. Product screens are under `components/screens/`; prefer those when documenting behavior.
