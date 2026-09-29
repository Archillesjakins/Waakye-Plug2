# 4-digit delivery confirmation code (customer + rider)

Cross-app feature: every **delivery** order gets a **4-digit code** so the customer and rider can confirm the **same order** at the **right dropoff**.

| App | Repo | Shipped in (example) |
|---|---|---|
| **Customer** | [Waakye-Plug2](https://github.com/Spidey2342/Waakye-Plug2) | `8cc4d06` — generate on checkout, show in UI |
| **Rider** | [Waakye-plug-rider](https://github.com/Spidey2342/Waakye-plug-rider) | `d23ce9a` — display on active order, verify at delivery |
| **Database** | Customer repo `schema/migrations/` | `20260929_orders_delivery_code.sql` |
| **Edge function** | Rider repo `supabase/functions/verify-delivery/` | Redeploy after SQL migration |

**Supabase project:** `verncapitxzsgcughvil`

---

## Product flow

1. Customer places order → row gets `delivery_code` (e.g. `4829`) and `delivery_code_hash` (bcrypt, server-side).
2. Customer sees the code on **Order details** and **My Orders** while the order is active (not delivered/cancelled).
3. Rider accepts order → **Active order** screen shows the **same code** (from `orders.delivery_code` via `select *`).
4. At dropoff, customer shows the code; rider taps **Confirm delivery code**, enters the 4 digits, confirms cash if needed.
5. App calls **`verify-delivery`** when `delivery_code_hash` exists → on match, status becomes **`delivered`** (commission trigger unchanged).

---

## Database

**Migration (run once in SQL Editor):**  
`schema/migrations/20260929_orders_delivery_code.sql`

Adds:

- `orders.delivery_code` — `text`, 4 digits, shown to customer + assigned rider (RLS: existing order SELECT policies).
- Trigger `orders_set_delivery_code_trg` — on INSERT for `delivery_mode = delivery`:
  - Fills `delivery_code` if the client omitted it.
  - Sets `delivery_code_hash` via `pgcrypto` `crypt(..., gen_salt('bf'))` for the edge function.

Requires **`delivery_code_hash`** column from earlier migration `2026-09-24_order_lifecycle_prep.sql`.

---

## Customer app (this repo)

| Area | What changed |
|---|---|
| `src/app/lib/deliveryCode.ts` | Generate / format code helpers |
| `src/app/lib/orders.ts` | Sends `delivery_code` on insert (trigger still hashes) |
| `src/app/lib/customerOrders.ts` | Selects `delivery_code` for history/detail |
| `src/app/components/DeliveryCodeCard.tsx` | Prominent code display |
| `src/app/components/screens/ConfirmationScreen.tsx` | Code above timeline |
| `src/app/components/screens/MyOrdersScreen.tsx` | Code on active order cards |

If Supabase is missing the column, checkout may still work (insert retry strips `delivery_code`); codes will not persist until migration 3 in [OPERATIONS.md](OPERATIONS.md) is applied.

---

## Rider app (sibling repo)

| Area | What changed |
|---|---|
| `src/components/screens/ActiveOrderScreen.jsx` | “Customer delivery code” block; delivery sheet with 4-digit input |
| `src/lib/ordersApi.js` | Existing `verifyDelivery()` used when hash present |
| `supabase/functions/verify-delivery/index.ts` | Fix: ownership check uses `riders.id` vs `orders.rider_id` (not profile id) |

**Deploy:** Vercel (rider app) + **redeploy** `verify-delivery` edge function after SQL.

Rider copy of this doc: [Waakye-plug-rider/docs/DELIVERY_CONFIRMATION_CODE.md](https://github.com/Spidey2342/Waakye-plug-rider/blob/main/docs/DELIVERY_CONFIRMATION_CODE.md) (kept in sync).

---

## Ops checklist

- [ ] Run `20260929_orders_delivery_code.sql` on production Supabase
- [ ] Run `20260929_verify_delivery_code_rpc.sql` and update **verify-delivery** to call RPC `verify_delivery_code_hash(p_code, p_hash)` instead of Deno `bcrypt.compare` (pgcrypto hashes from the trigger do not always match Deno bcrypt)
- [ ] Redeploy **customer** + **rider** on Vercel
- [ ] Redeploy Supabase function **`verify-delivery`**
- [ ] Smoke test: place order → customer sees code → rider sees same code → verify completes delivery

---

## Security notes

- Code is **short by design** for in-person handoff (like a food pickup PIN), not a standalone auth secret.
- Wrong guesses on verify are **rate-limited** (see `verify-delivery` + `begin_auth_attempt`).
- Do not log plaintext codes in edge functions or analytics.

Related: [ORDER_LIFECYCLE.md](ORDER_LIFECYCLE.md), [OPERATIONS.md](OPERATIONS.md).
