# Order lifecycle (locked)

Schema home: this repo (`schema/migrations/`). Live project: `verncapitxzsgcughvil`.

Companion migration: `schema/migrations/2026-09-24_order_lifecycle_prep.sql`.

## Canonical statuses

| Status | Meaning |
|---|---|
| `available` | Placed; waiting for an approved rider to claim |
| `rider_assigned` | A rider has claimed the order (`rider_id` set) |
| `picked_up` | Rider has the food |
| `delivered` | Complete |
| `cancelled` | Terminal cancel |

Ghost statuses (`pending`, `ready`) must not be written. `orders_status_check` rejects them; RLS claim quals are `available`-only after Story 1 prep.

## Transition matrix

| From | To | Who / when | Side effects |
|---|---|---|---|
| *(insert)* | `available` | Customer app insert | `status` DEFAULT is `available`; `rider_id` null |
| `available` | `rider_assigned` | Approved rider claims | Set `rider_id` to claiming rider |
| `rider_assigned` | `picked_up` | Assigned rider | `picked_up_at` stamped by trigger |
| `picked_up` | `delivered` | Assigned rider | `delivered_at` + commission trigger |
| `rider_assigned` | `available` | **Release only** | Clear `rider_id`; set `released_at` / `release_reason` |
| `available` | `cancelled` | Admin cancel | Clear `rider_id` if any; set cancel audit cols |
| `rider_assigned` | `cancelled` | Admin cancel | Clear `rider_id`; set cancel audit cols |
| `picked_up` | `cancelled` | Admin cancel (cancel-after-moving) | Clear `rider_id`; set cancel audit cols; **refund food**; add **70% of `delivery_fee`** to `profiles.pending_delivery_fee_owed` for the customer |
| `delivered` | *(none)* | Terminal | — |
| `cancelled` | *(none)* | Terminal | — |

Disallowed examples: release from `picked_up` or `available`; rider self-cancel; customer UPDATE of orders; any write of `pending` / `ready`.

## Locked decisions

1. **Statuses** — exactly: `available | rider_assigned | picked_up | delivered | cancelled`.
2. **Release** — only `rider_assigned → available` and clear `rider_id`. Not allowed from other statuses.
3. **Admin cancel** — allowed from `available | rider_assigned | picked_up`. Always clear `rider_id`. Record `cancel_reason`, `cancelled_at`, `cancelled_by`.
4. **Cancel-after-moving** (`picked_up → cancelled`) — refund food; customer owes **70% of that order’s delivery fee** on the **next** order via `profiles.pending_delivery_fee_owed` (numeric, default `0`).
5. **Delivery code** — store `orders.delivery_code_hash` (bcrypt) only. Riders never get plaintext; verify server-side.
6. **Grants** — do **not** broadly expand authenticated `UPDATE` on `orders` beyond `(rider_id, status)`. New audit / hash / debt columns are admin or service-role writes.

## Columns added by Story 1 prep

**`orders`**

- `delivery_code_hash` (text, nullable)
- `cancel_reason` (text)
- `cancelled_at` (timestamptz)
- `cancelled_by` (uuid)
- `released_at` (timestamptz)
- `release_reason` (text)

**`profiles`**

- `pending_delivery_fee_owed` (numeric NOT NULL DEFAULT 0)

## Out of scope (later stories)

- Edge functions / UI that enforce the transition matrix at runtime
- Generating and verifying delivery codes end-to-end
- Applying / clearing `pending_delivery_fee_owed` at checkout
- Any `riders_one_active_order` constraint (not present in this repo’s migrations as of Story 1)

## Apply note

Do **not** apply from CI. Morrison merges this PR, then runs the SQL on `verncapitxzsgcughvil` in the Supabase SQL Editor.
