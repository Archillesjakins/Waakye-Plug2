# URGENT Security Fix Applied — JWT-Bind Complete

## ✅ Security Hardening Completed

**Commit:** `764f7b2` - security: JWT-bind debt clearing edge function  
**Branch:** `cursor/cancel-debt-delivery-fee-7401`  
**Status:** Pushed and ready for merge

## Critical Security Issue Fixed

### Problem (Before)
The edge function accepted any `customer_id` from the request body with only anon key authentication:

```typescript
// INSECURE - anyone could clear any user's debt
const { customer_id } = await req.json()
Authorization: Bearer ANON_KEY
```

**Impact:** Any authenticated user could clear another user's debt by sending arbitrary UUID.

### Solution (After)
The edge function now:
1. **Requires JWT access token** in Authorization header
2. **Verifies token** with `supabase.auth.getUser(token)`
3. **Extracts user ID** from verified JWT only
4. **Never trusts body input** for customer_id
5. **Returns 401** on missing/invalid token

```typescript
// SECURE - only clears authenticated user's own debt
const authHeader = req.headers.get('Authorization')
const token = authHeader.replace('Bearer ', '')
const { data: { user } } = await supabase.auth.getUser(token)
const customerId = user.id // from verified JWT only
```

## Files Changed

### 1. `supabase/functions/clear-delivery-fee-debt/index.ts`

**Changes:**
- ✅ Extract and validate Authorization header
- ✅ Call `supabase.auth.getUser(token)` to verify JWT
- ✅ Return 401 if missing/invalid token
- ✅ Use `user.id` from verified token only
- ✅ Removed body `customer_id` acceptance
- ✅ Service role used only AFTER auth verification

**Key code:**
```typescript
const authHeader = req.headers.get('Authorization')
if (!authHeader) {
  return new Response(
    JSON.stringify({ error: 'Missing Authorization header' }),
    { status: 401, headers: corsHeaders }
  )
}

const token = authHeader.replace('Bearer ', '')
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

const { data: { user }, error: authError } = await supabase.auth.getUser(token)

if (authError || !user) {
  return new Response(
    JSON.stringify({ error: 'Unauthorized: invalid or expired token' }),
    { status: 401, headers: corsHeaders }
  )
}

// Use authenticated user's ID only
const customerId = user.id

// Clear debt for this user only
await supabase
  .from('profiles')
  .update({ pending_delivery_fee_owed: 0 })
  .eq('id', customerId)
```

### 2. `src/app/App.tsx`

**Changes:**
- ✅ Get user's session with `await supabase.auth.getSession()`
- ✅ Extract `session.access_token` (JWT)
- ✅ Send JWT in `Authorization: Bearer ${session.access_token}`
- ✅ Removed anon key usage
- ✅ Removed body `customer_id` payload
- ✅ Graceful handling if no active session

**Key code:**
```typescript
if (pendingDeliveryFeeOwed > 0) {
  try {
    // Get user's JWT access token from current session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      console.error('No active session for debt clearing');
    } else {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/clear-delivery-fee-debt`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          // No body - user ID extracted from JWT
        }
      );
      
      if (response.ok) {
        setPendingDeliveryFeeOwed(0);
      }
    }
  } catch (debtError) {
    console.error('Error calling debt clearing function:', debtError);
  }
}
```

### 3. `supabase/functions/clear-delivery-fee-debt/README.md`

**Changes:**
- ✅ Updated documentation to reflect JWT requirement
- ✅ Removed incorrect examples showing anon key usage
- ✅ Added security model explanation
- ✅ Updated test examples with JWT tokens
- ✅ Removed "recommendation" section (now implemented)

## Security Model

### Authentication Flow
1. **Client** places order and needs to clear debt
2. **Client** gets own session: `supabase.auth.getSession()`
3. **Client** sends JWT: `Authorization: Bearer ${session.access_token}`
4. **Edge function** verifies JWT: `supabase.auth.getUser(token)`
5. **Edge function** extracts: `customerId = user.id`
6. **Edge function** clears debt for that user only

### Attack Prevention
- ❌ **Cannot** send arbitrary customer_id in body
- ❌ **Cannot** use anon key alone
- ❌ **Cannot** clear another user's debt
- ❌ **Cannot** bypass with invalid/expired JWT
- ✅ **Only** authenticated user can clear own debt

## Testing

### Valid JWT (Should Succeed)
```bash
# Get user's JWT access token from authenticated session
curl -X POST 'https://PROJECT.supabase.co/functions/v1/clear-delivery-fee-debt' \
  -H 'Authorization: Bearer USER_JWT_ACCESS_TOKEN' \
  -H 'Content-Type: application/json'

# Expected response:
# HTTP/1.1 200 OK
# {"success":true,"message":"Debt cleared successfully","user_id":"uuid"}
```

### Missing Token (Should Fail)
```bash
curl -X POST 'https://PROJECT.supabase.co/functions/v1/clear-delivery-fee-debt' \
  -H 'Content-Type: application/json'

# Expected response:
# HTTP/1.1 401 Unauthorized
# {"error":"Missing Authorization header"}
```

### Invalid Token (Should Fail)
```bash
curl -X POST 'https://PROJECT.supabase.co/functions/v1/clear-delivery-fee-debt' \
  -H 'Authorization: Bearer invalid-token' \
  -H 'Content-Type: application/json'

# Expected response:
# HTTP/1.1 401 Unauthorized
# {"error":"Unauthorized: invalid or expired token"}
```

### Anon Key (Should Fail)
```bash
curl -X POST 'https://PROJECT.supabase.co/functions/v1/clear-delivery-fee-debt' \
  -H 'Authorization: Bearer ANON_KEY' \
  -H 'Content-Type: application/json'

# Expected response:
# HTTP/1.1 401 Unauthorized
# {"error":"Unauthorized: invalid or expired token"}
```

## PR Status

**Branch:** `cursor/cancel-debt-delivery-fee-7401`  
**Fork PR:** https://github.com/Archillesjakins/Waakye-Plug2/pull/1 (commented)  
**Upstream PR:** https://github.com/Spidey2342/Waakye-Plug2/pull/6 (head SHA updated)

**Commit SHA:** `764f7b283c8b6a554bf51dadc2ca7a32837f83f6`

### Changes Summary
```
src/app/App.tsx                                     | 43 ±
supabase/functions/clear-delivery-fee-debt/README.md | 71 ±
supabase/functions/clear-delivery-fee-debt/index.ts  | 33 +
Total: 3 files, 85 insertions(+), 62 deletions(-)
```

## ✅ Security Checklist

- [x] Require Authorization Bearer JWT
- [x] Resolve caller with supabase.auth.getUser(token)
- [x] Ignore/forbid body customer_id - use user.id from JWT only
- [x] Only clear profiles.pending_delivery_fee_owed for authenticated user
- [x] Return 401 on missing/invalid token
- [x] Keep CORS + JSON responses consistent
- [x] Update App.tsx to send session access_token
- [x] Push to same branch (PR #6 head SHA updated)
- [x] PR comment added noting JWT binding complete

## Result

✅ **Edge function cannot clear another user's debt**  
✅ **PR #6 head SHA updated to `764f7b2`**  
✅ **Ready for merge**

---

**Status:** Security hardening complete. The edge function is now safe to deploy to production.
