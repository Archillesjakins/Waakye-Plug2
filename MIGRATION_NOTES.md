# Migration & Schema Notes

## Live Database State (verncapitxzsgcughvil)

### Already Applied Migrations ✅

#### 1. Delivery Coordinates
**Migration:** `2026-09-16_order_delivery_coords.sql`  
**Applied:** Already live  
**Columns added:**
- `orders.delivery_lat` (double precision)
- `orders.delivery_lng` (double precision)

#### 2. Delivery Code
**Migration:** `20260929_orders_delivery_code.sql`  
**Applied:** Already live (by Archilles)  
**Components:**
- `orders.delivery_code` (text, 4-digit plaintext)
- `orders.delivery_code_hash` (text, bcrypt hash for verification)
- `orders_set_delivery_code()` trigger function
- `verify_delivery_code_hash(order_id, code)` RPC function

**Trigger behavior:**
- Auto-generates 4-digit code on INSERT
- Sets both plaintext and hash
- Customer sees plaintext
- Rider verifies using hash

## This PR's Integration

**No new migrations needed** - This PR integrates with the existing schema:

1. **Location Flow** → Uses existing `delivery_lat` / `delivery_lng`
2. **Order Creation** → Saves coordinates via `createOrder()`
3. **Confirmation Screen** → Reads and displays `delivery_code`
4. **Vendor Matching** → Filters by 6km radius from coordinates

## Customer → Rider Handoff Flow

1. Customer places order → System generates 4-digit code
2. Customer sees code on ConfirmationScreen
3. Customer shows code to rider on arrival
4. Rider enters code in rider app
5. System verifies via `verify_delivery_code_hash()` RPC
6. Match → Delivery confirmed

## Schema Verification Checklist

Before deploying to a new environment:

```sql
-- Verify delivery coordinates exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND column_name IN ('delivery_lat', 'delivery_lng');

-- Verify delivery code columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND column_name IN ('delivery_code', 'delivery_code_hash');

-- Verify trigger exists
SELECT tgname, proname 
FROM pg_trigger 
JOIN pg_proc ON pg_trigger.tgfoid = pg_proc.oid 
WHERE tgname = 'orders_set_delivery_code_trigger';

-- Verify RPC function exists
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'verify_delivery_code_hash';
```

## Development vs Production

**Development:** May need to apply migrations manually if starting fresh

**Production (verncapitxzsgcughvil):** All migrations already applied ✅

**Staging/New Environments:** 
1. Apply `2026-09-16_order_delivery_coords.sql` (or obtain from team)
2. Apply `20260929_orders_delivery_code.sql` (or obtain from team)
3. Deploy this PR's code changes
