# Customer App — Operations

## Customer journey (happy path)

1. Open https://waakye-plug2.vercel.app
2. Enter name + phone (profile saved; synthetic email `{uid}@customers.waakyeplug.app`)
3. Allow location → pick vendor within **6 km**
4. Add items / build waakye → cart → delivery address
5. Pay **cash or momo at delivery** (no in-app Paystack for customers yet)
6. Fees: items + **8 GHS delivery** + **1 GHS service**
7. Track: Order Sent → Rider Assigned → Picked Up → Delivered

## Ordering hours (current code vs copy)

| Source | Claim |
|---|---|
| Comments / Landing / Username copy | ~5:30–8:00 AM window |
| `timeUtils.ts` implementation | open `0` … close `23:59` → always open when `DEMO_MODE` false |
| `ClosedScreen` copy | Pre-orders / menu at **5:00 PM**; WhatsApp group CTA |

**Action needed (Lumora P4):** pick one business rule and align code + copy.

## Breakfast (P3)

Landing breakfast path shows coming soon; do not promise breakfast in ops until `SBlinkspage` is rebuilt on the cart model.

## Support

- Closed / waitlist community: WhatsApp group https://chat.whatsapp.com/HM1OVHvnfZr0l1WPhJPRDg
- Delivery issues during an active order are handled by riders (rider app WhatsApp `233599995651` TODO confirm)

## Fees & status (ops cheat sheet)

| Item | Value |
|---|---|
| Delivery | 8 GHS |
| Service | 1 GHS |
| Rider commission | 10% of delivery fee (not shown to customer) |
| Statuses | available → rider_assigned → picked_up → delivered \| cancelled |
| `delivery_fee` column | Expect DB default when client omits it on insert |

## Incident notes

- Profile save 403 after RLS: ensure client uses INSERT/UPDATE split (not upsert) and migrations applied
- Tracker stuck: confirm status is canonical (ghost statuses rejected by CHECK)
- No vendors: check approval + GPS within 6 km + customer location permission

## Related docs

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [FEATURES.md](FEATURES.md)
- [SETUP.md](SETUP.md)
- [../AUDIT.md](../AUDIT.md)
