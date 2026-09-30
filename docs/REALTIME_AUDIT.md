# Customer app — realtime audit

**Goal:** Order progress, vendor hours, and menu changes should update **without reload**.  
**Transport:** Supabase Realtime `postgres_changes` (RLS applies — customer only receives rows they can SELECT).

---

## Summary (after unified orders channel)

| Area | Table(s) | Mechanism | Where |
|------|-----------|-----------|--------|
| **Orders (list + detail + handoff bar)** | `orders` | One channel per customer: `customer_id=eq.{userId}` → refetch changed row | `CustomerOrdersContext.tsx` |
| **Order details / timeline** | `orders` | Same channel via `useLiveOrderDetail(orderId)` | `ConfirmationScreen.tsx` |
| **My Orders** | `orders` | Same shared context (no second subscription) | `MyOrdersScreen.tsx` |
| **Active delivery code bar** | `orders` | Handoff reconciled on every orders list update | `deliveryCode.ts` + context |
| **Selected vendor open/hours** | `vendors` | `id=eq.{vendorId}` UPDATE | `VendorContext.tsx` |
| **Vendor picker list** | `vendors` | All INSERT/UPDATE/DELETE → refresh list | `VendorSelectScreen.tsx` |
| **Menu / combos** | `vendor_menu_items` | `vendor_id=eq.{vendorId}` | `HomeScreen.tsx` |
| **Platform nightly lock** | — | Local clock (Ghana) + 10s tick | `timeUtils.ts`, `App.tsx` |
| **Countdown UI** | — | 1s local timer | `CountdownTimer.tsx` |

**Removed:** Duplicate per-screen order channels, 5s handoff polling (`useActiveOrderHandoffStatusSync`), My Orders 30s poll (replaced by shared realtime + tab-focus refresh on context).

---

## File-by-file

### `src/app/context/CustomerOrdersContext.tsx` (new)
- Subscribes once while the user is signed in.
- On any order change: `fetchOrderById` for that id (keeps rider/vendor joins fresh).
- Calls `reconcileActiveOrderHandoffFromOrders` so the bottom bar status clears/updates live.

### `src/app/App.tsx`
- Wraps authenticated UI in `CustomerOrdersProvider`.
- Handoff bar reads session; context pushes session updates when orders change.

### `src/app/components/screens/ConfirmationScreen.tsx`
- **Before:** Own channel `id=eq.{orderId}` (often weaker with RLS than `customer_id` filter).
- **After:** `useLiveOrderDetail` — timeline and status update from shared realtime.

### `src/app/components/screens/MyOrdersScreen.tsx`
- **Before:** Separate channel + 30s poll.
- **After:** `useCustomerOrders()` only.

### `src/app/components/ActiveOrderHandoffBar.tsx`
- Shows live status label (`Looking for a rider`, `On the way`, …) from handoff session.

### `src/app/context/VendorContext.tsx`
- **Before:** 30s poll only.
- **After:** Realtime UPDATE on selected vendor + 120s safety poll.

### `src/app/components/screens/VendorSelectScreen.tsx`
- **Before:** 30s poll.
- **After:** Realtime on `vendors` + 120s safety poll.

### `src/app/components/screens/HomeScreen.tsx`
- **Before:** Load menu once on mount.
- **After:** Realtime on `vendor_menu_items` for current vendor.

### Not realtime (by design)
- **Auth / profiles** — one-time init (`UserContext.tsx`).
- **Checkout create** — REST insert; realtime INSERT on `orders` picks up the new row.
- **Cart** — local React state only.
- **Build waakye / item detail** — static until menu realtime fires on home.

---

## Supabase checklist (ops)

Realtime must be enabled for:

- `public.orders`
- `public.vendors`
- `public.vendor_menu_items`

If updates never arrive, check Dashboard → Database → Publications (`supabase_realtime`) and RLS SELECT policies for the anon/authenticated role.

---

## Known gaps / future

- **Rider GPS on customer map** — not in customer app yet (no `riders` location subscription).
- **Push notifications** — not implemented; realtime requires app open or background WebSocket.
- **Platform 11:30 PM testing cutoff** — local constant in `timeUtils.ts`, not DB-driven.

Related: [ARCHITECTURE.md](ARCHITECTURE.md), [ORDER_LIFECYCLE.md](ORDER_LIFECYCLE.md).
