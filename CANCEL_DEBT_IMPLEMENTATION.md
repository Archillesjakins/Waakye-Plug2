# Cancel Debt Implementation — Customer App

## Overview
This implementation adds customer-side support for the cancel-after-moving debt feature, where customers who have an order cancelled after pickup owe 70% of the delivery fee on their next order.

## What's Implemented (Customer Side)

### 1. Delivery Fee Persistence ✅
- `createOrder()` in `src/app/lib/orders.ts` now persists `delivery_fee` to the orders table
- The `DELIVERY_FEE` constant (currently 8 GHS) is written to each order
- This enables the cancel-order backend logic to calculate the 70% debt correctly

### 2. Debt Display at Checkout ✅
- `OrderSummaryScreen` fetches `profiles.pending_delivery_fee_owed` on mount
- If debt > 0, it's displayed as "Outstanding Delivery Fee" in the order breakdown
- The debt is added to the total amount the customer pays
- Clear messaging: "From a previous cancelled order (applied to this order)"

### 3. Order Total Includes Debt ✅
- `CartContext.totalPrice` now includes `pendingDeliveryFeeOwed`
- `createOrder()` receives the full `totalAmount` including debt
- The customer pays the debt as part of their order total

### 4. Cancelled Order Copy Fixed ✅
- `ConfirmationScreen` now says "This order was cancelled. Reach out to the vendor or support..."
- No longer implies only vendor cancellations (admin/support cancels are also handled)

## ⚠️ Server-Side Work Required

### Clearing the Debt
The customer app **cannot** clear `profiles.pending_delivery_fee_owed` after a successful order because:
- RLS grants authenticated users UPDATE on `profiles(full_name, phone)` **only**
- `pending_delivery_fee_owed` requires service-role or a SECURITY DEFINER path

### Required Implementation
Create a Supabase Edge Function or RPC to clear the debt after order creation:

**Option A: Edge Function (Recommended)**
```typescript
// supabase/functions/apply-delivery-fee-debt/index.ts
import { createClient } from '@supabase/supabase-js'

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // service role bypasses RLS
  )

  const { order_id } = await req.json()

  // 1. Fetch the order to get customer_id
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('customer_id, total_amount')
    .eq('id', order_id)
    .single()

  if (orderError) return new Response(JSON.stringify({ error: orderError }), { status: 400 })

  // 2. Clear the debt (order total already included it)
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ pending_delivery_fee_owed: 0 })
    .eq('id', order.customer_id)

  if (profileError) return new Response(JSON.stringify({ error: profileError }), { status: 500 })

  return new Response(JSON.stringify({ success: true }), { status: 200 })
})
```

**Option B: Database RPC (Alternative)**
```sql
CREATE OR REPLACE FUNCTION clear_delivery_fee_debt(customer_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET pending_delivery_fee_owed = 0
  WHERE id = customer_uuid;
END;
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION clear_delivery_fee_debt(uuid) TO authenticated;
```

### Integration Point
After `createOrder()` succeeds in `App.tsx`:
```typescript
async function handleOrderConfirmed() {
  if (!selectedVendor) return;

  try {
    const created = await createOrder({
      customerId: userId,
      vendorId: selectedVendor.id,
      lines,
      totalAmount: totalPrice, // includes debt
      deliveryAddress: customerLocation,
      paymentMethod,
      deliveryFee: DELIVERY_FEE,
    });
    
    // TODO: Clear debt after successful order
    // Call edge function or RPC here if pendingDeliveryFeeOwed > 0
    // if (pendingDeliveryFeeOwed > 0) {
    //   await clearDebt(userId); // or pass created.id to edge function
    // }
    
    setLastOrderId(created.id);
  } catch (e) {
    console.error('Could not create order', e);
    toast.error('Could not place your order — please try again.');
    return;
  }

  setCurrentScreen('confirm');
}
```

## Testing Checklist
- [ ] Order with no debt: total = subtotal + delivery_fee + service_fee
- [ ] Order with debt: total includes outstanding amount, UI shows breakdown
- [ ] Cancelled copy displays correctly for vendor/admin cancellations
- [ ] After debt-clearing server work: debt resets to 0 after successful order

## Files Modified
- `src/app/lib/orders.ts` — added `deliveryFee` param and persist it
- `src/app/context/CartContext.tsx` — added `pendingDeliveryFeeOwed` state
- `src/app/components/screens/OrderSummaryScreen.tsx` — fetch and display debt
- `src/app/components/screens/ConfirmationScreen.tsx` — fixed cancelled copy
- `src/app/App.tsx` — pass DELIVERY_FEE to createOrder

## Schema Dependencies
Requires the upstream migration `2026-09-24_order_lifecycle_prep.sql`:
- `orders.delivery_fee` column (required, numeric)
- `profiles.pending_delivery_fee_owed` column (numeric, default 0)

If these columns don't exist yet, this PR is blocked until the migration is applied.
