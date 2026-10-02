# Clear Delivery Fee Debt Edge Function

This Supabase Edge Function clears a customer's `pending_delivery_fee_owed` after they complete a successful order where the debt was included in the total amount.

## Why This Is Needed

The customer app cannot directly clear `profiles.pending_delivery_fee_owed` due to RLS (Row Level Security) restrictions:
- Authenticated users only have `UPDATE` grants on `profiles(full_name, phone)`
- The `pending_delivery_fee_owed` column requires service-role privileges
- See migrations: `schema/migrations/2026-09-13_profiles_self_write_lockdown.sql`

## How It Works

1. Customer places order with debt included in total (CartContext adds `pendingDeliveryFeeOwed` to `totalPrice`)
2. After successful `createOrder()`, the customer app calls this edge function with user's JWT access token
3. Function verifies JWT, extracts authenticated user ID, and uses service role to clear only that user's debt

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
      // Get user's access token from current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        console.error('No active session for debt clearing');
        return;
      }
      
      const response = await fetch(
        `${supabaseUrl}/functions/v1/clear-delivery-fee-debt`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
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
# Test with valid JWT access token
curl -i --location --request POST 'http://localhost:54321/functions/v1/clear-delivery-fee-debt' \
  --header 'Authorization: Bearer USER_JWT_ACCESS_TOKEN' \
  --header 'Content-Type: application/json'

# Expected response:
# {"success":true,"message":"Debt cleared successfully","user_id":"uuid"}

# Test with missing token (should fail)
curl -i --location --request POST 'http://localhost:54321/functions/v1/clear-delivery-fee-debt' \
  --header 'Content-Type: application/json'

# Expected response:
# HTTP/1.1 401 Unauthorized
# {"error":"Missing Authorization header"}
```

## Security

- ✅ **JWT authentication required** - verifies user identity via `supabase.auth.getUser(token)`
- ✅ **User ID binding** - uses authenticated user.id only, never trusts body input
- ✅ Uses service role key (bypasses RLS after auth verification)
- ✅ CORS headers allow browser requests
- ✅ Returns 401 on missing/invalid token
- ✅ Cannot clear another user's debt (user ID extracted from verified JWT)

**Security Model:**
1. Client sends JWT access token in Authorization header
2. Function verifies token with Supabase Auth
3. Extracts authenticated user.id from verified token
4. Clears debt only for that authenticated user
5. No way to clear arbitrary user's debt via body payload
