# Clear Delivery Fee Debt Edge Function

This Supabase Edge Function clears a customer's `pending_delivery_fee_owed` after they complete a successful order where the debt was included in the total amount.

## Why This Is Needed

The customer app cannot directly clear `profiles.pending_delivery_fee_owed` due to RLS (Row Level Security) restrictions:
- Authenticated users only have `UPDATE` grants on `profiles(full_name, phone)`
- The `pending_delivery_fee_owed` column requires service-role privileges
- See migrations: `schema/migrations/2026-09-13_profiles_self_write_lockdown.sql`

## How It Works

1. Customer places order with debt included in total (CartContext adds `pendingDeliveryFeeOwed` to `totalPrice`)
2. After successful `createOrder()`, the customer app calls this edge function
3. Function uses service role to bypass RLS and set `pending_delivery_fee_owed = 0`

## Deployment

```bash
# Deploy to Supabase (requires Supabase CLI)
supabase functions deploy clear-delivery-fee-debt

# Or deploy via Supabase Dashboard:
# Functions → New Function → Upload index.ts
```

## Usage from Customer App

After successful order creation in `App.tsx`:

```typescript
async function handleOrderConfirmed() {
  // ... existing order creation code ...

  try {
    const created = await createOrder({
      customerId: userId,
      // ... other params
    });
    
    setLastOrderId(created.id);
    
    // Clear debt if customer had outstanding amount
    if (pendingDeliveryFeeOwed > 0) {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/clear-delivery-fee-debt`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ customer_id: userId }),
        }
      );
      
      if (!response.ok) {
        console.error('Failed to clear debt:', await response.text());
        // Non-critical: debt will be applied again next order if this fails
      } else {
        // Reset local state
        setPendingDeliveryFeeOwed(0);
      }
    }
  } catch (e) {
    console.error('Could not create order', e);
    toast.error('Could not place your order — please try again.');
    return;
  }

  setCurrentScreen('confirm');
}
```

## Testing

```bash
# Test locally
curl -i --location --request POST 'http://localhost:54321/functions/v1/clear-delivery-fee-debt' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"customer_id":"uuid-here"}'

# Expected response:
# {"success":true,"message":"Debt cleared successfully"}
```

## Security

- ✅ Uses service role key (bypasses RLS)
- ✅ CORS headers allow browser requests
- ✅ Validates customer_id input
- ⚠️ **No authentication check** - anyone with the anon key can call this

**Recommendation:** Add auth verification to ensure only the authenticated customer can clear their own debt:

```typescript
// Get user from JWT
const authHeader = req.headers.get('Authorization')!
const token = authHeader.replace('Bearer ', '')
const { data: { user }, error: authError } = await supabase.auth.getUser(token)

if (authError || !user) {
  return new Response(
    JSON.stringify({ error: 'Unauthorized' }),
    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Verify customer_id matches authenticated user
if (customer_id !== user.id) {
  return new Response(
    JSON.stringify({ error: 'Forbidden: can only clear your own debt' }),
    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
```
