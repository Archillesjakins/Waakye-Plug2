# Implementation Summary: Cancel Debt + Delivery Fee Persistence

## ✅ Completed Work

### 1. Delivery Fee Persistence
**File:** `src/app/lib/orders.ts`
- Added `deliveryFee: number` parameter to `createOrder()` function
- Now writes `delivery_fee: deliveryFee` to the orders table insert
- Uses `DELIVERY_FEE` constant (8 GHS) from orderTypes.ts
- **Why:** Enables cancel-order backend logic to calculate 70% debt correctly

### 2. Debt State Management
**File:** `src/app/context/CartContext.tsx`
- Added `pendingDeliveryFeeOwed` state to cart context
- Added `setPendingDeliveryFeeOwed` setter function
- Updated `totalPrice` calculation to include `+ pendingDeliveryFeeOwed`
- **Result:** Debt automatically flows into order total

### 3. Debt Fetching & Display
**File:** `src/app/components/screens/OrderSummaryScreen.tsx`
- Added `useEffect` to fetch `profiles.pending_delivery_fee_owed` on mount
- Queries by `userId` from `useUser()` hook
- Conditional UI: shows "Outstanding Delivery Fee" line item if debt > 0
- Clear messaging: "From a previous cancelled order (applied to this order)"
- Styled in orange to distinguish from regular fees
- **User Experience:** Customer sees and understands the debt before confirming

### 4. Order Creation with Debt
**File:** `src/app/App.tsx`
- Added `DELIVERY_FEE` import from orderTypes
- Updated `createOrder()` call to pass `deliveryFee: DELIVERY_FEE`
- Added `setPendingDeliveryFeeOwed` to destructured cart context
- **Flow:** Total includes debt → customer pays it → order created with full amount

### 5. Cancelled Copy Fix
**File:** `src/app/components/screens/ConfirmationScreen.tsx`
- Updated cancelled message from "The vendor cancelled..." to "This order was cancelled..."
- Added "...or support" to acknowledge admin/support cancellations
- Updated both the HEADER_COPY object and the JSX rendering
- **Why:** Admin cancellations shouldn't look like vendor actions

### 6. Documentation
**File:** `CANCEL_DEBT_IMPLEMENTATION.md`
- Full implementation guide for server-side debt clearing
- Two options: Edge Function (recommended) or RPC
- Code examples for both approaches
- Integration point clearly marked in App.tsx
- Schema dependency documentation
- Testing checklist

## 🔧 Server-Side Work Required

### The Problem
Customer app **cannot** clear `profiles.pending_delivery_fee_owed` because:
- RLS grants authenticated users `UPDATE(full_name, phone)` only
- `pending_delivery_fee_owed` column requires service-role privileges
- See `schema/migrations/2026-09-13_profiles_self_write_lockdown.sql`

### The Solution (Not Yet Implemented)
Create one of:
1. **Edge Function** `supabase/functions/apply-delivery-fee-debt` (recommended)
2. **RPC Function** `clear_delivery_fee_debt(customer_uuid)` with SECURITY DEFINER

Call it after successful `createOrder()` in `App.tsx` to set debt back to 0.

**See `CANCEL_DEBT_IMPLEMENTATION.md` for complete code examples.**

## 📦 Git & PR Status

### Branch
- **Name:** `cursor/cancel-debt-delivery-fee-7401`
- **Base:** `main` (fork: Archillesjakins/Waakye-Plug2)
- **Commit:** `277b3e5` "feat(orders): customer cancel debt + delivery_fee persistence"

### Pull Requests
1. **Fork PR:** https://github.com/Archillesjakins/Waakye-Plug2/pull/1 (created ✅)
2. **Upstream PR:** Cannot auto-create due to permissions
   - **Compare URL:** https://github.com/Spidey2342/Waakye-Plug2/compare/main...Archillesjakins:cursor/cancel-debt-delivery-fee-7401
   - User can create PR manually using this link

## 🔍 Testing Guidance

### Prerequisites
- Database must have columns from `2026-09-24_order_lifecycle_prep.sql`:
  - `orders.delivery_fee` (required, numeric)
  - `profiles.pending_delivery_fee_owed` (numeric, default 0)

### Test Scenarios

#### Scenario 1: Order with No Debt
1. Navigate to checkout
2. Verify breakdown shows:
   - Subtotal
   - Delivery Fee: GH₵8
   - Service Fee: GH₵1
   - Total = subtotal + 8 + 1
3. Confirm order
4. Verify `orders` row has `delivery_fee: 8`

#### Scenario 2: Order with Debt
1. Manually set `pending_delivery_fee_owed = 5.60` in profiles table (70% of 8)
2. Navigate to checkout
3. Verify breakdown shows:
   - Subtotal
   - Delivery Fee: GH₵8
   - Service Fee: GH₵1
   - **Outstanding Delivery Fee: GH₵5.60** (in orange)
   - Message: "From a previous cancelled order"
   - Total = subtotal + 8 + 1 + 5.60
4. Confirm order
5. Verify `orders` row has `total_amount` including the 5.60
6. **Manual verification:** `pending_delivery_fee_owed` still = 5.60 (requires server-side clearing)

#### Scenario 3: Cancelled Order Copy
1. Create an order
2. Have admin/vendor cancel it via their app
3. Customer views ConfirmationScreen
4. Verify red XCircle icon and text: "This order was cancelled. Reach out to the vendor or support if you're not sure why."
5. Confirm no "vendor cancelled" language (admin cancels shouldn't blame vendor)

## 📝 Files Changed
```
src/app/lib/orders.ts                          | Added deliveryFee param + persist
src/app/context/CartContext.tsx                 | Added pendingDeliveryFeeOwed state
src/app/components/screens/OrderSummaryScreen.tsx | Fetch + display debt
src/app/components/screens/ConfirmationScreen.tsx | Fixed cancelled copy
src/app/App.tsx                                 | Pass DELIVERY_FEE to createOrder
CANCEL_DEBT_IMPLEMENTATION.md                   | Full server-side guide
IMPLEMENTATION_SUMMARY.md                       | This file
```

**Total:** 6 files changed, 193 insertions(+), 6 deletions(-)

## ⚠️ Known Limitations
1. **Debt clearing not implemented** — requires edge function or RPC (see CANCEL_DEBT_IMPLEMENTATION.md)
2. **No service_fee column** — `orders` table only has `delivery_fee`, not `service_fee`
   - SERVICE_FEE is included in `total_amount` but not persisted separately
   - Not blocking: cancel logic only needs delivery_fee for 70% math
3. **No upstream write access** — PR to Spidey2342/Waakye-Plug2 must be created manually

## 🎯 Definition of Done
- [x] `createOrder` persists `delivery_fee`
- [x] Fetch `pending_delivery_fee_owed` at checkout
- [x] Add debt to displayed total
- [x] Customer pays debt with order
- [x] Cancelled copy doesn't only say "vendor cancelled"
- [x] Clear documentation for server-side debt clearing
- [x] Branch pushed to fork
- [x] PR created (fork) or compare URL provided (upstream)
- [x] Implementation guide with code examples
- [x] Testing scenarios documented

## 🚀 Next Steps (Post-Merge)
1. Apply upstream migration `2026-09-24_order_lifecycle_prep.sql` if not already done
2. Implement server-side debt clearing (edge function or RPC)
3. Test full flow with real order cancellation + next order
4. Verify debt resets to 0 after successful payment
