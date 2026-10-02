# Vendor ordering hours & platform cutoff (Sep 2026)

Cross-team notes for the **customer app** (`Waakye-Plug2`), **admin panel** (`waakyeplug-vendor`), and shared Supabase project `verncapitxzsgcughvil`.

## Summary

| Layer | Rule |
|--------|------|
| **Platform** | Customer app stops **new orders at 9:00 PM** local time (Ghana). Opens again at **midnight**. Constant: `PLATFORM_CLOSE_HOUR` in `src/app/utils/timeUtils.ts`. |
| **Vendor schedule** | Each vendor has **`daily_opens_at`** / **`daily_closes_at`** (Postgres `time`, Ghana local on clients). **Both must be set** or the customer app shows the shop as **closed**. |
| **Vendor toggle** | Admin **`is_open`** is a manual override. Customer accepts orders only when: **platform open ∧ is_open ∧ inside daily hours**. |

Old global “morning window” / sunrise `ClosedScreen` copy was removed. Per-vendor hours replace app-wide breakfast-time gating.

---

## Database migration (required before deploy)

**File:** `schema/migrations/2026-09-26_vendor_daily_hours.sql`

Run in **Supabase → SQL Editor** on production (do not rely on CI):

```sql
-- Adds vendors.daily_opens_at, vendors.daily_closes_at (time, nullable)
```

After migration:

1. Open **admin** → each vendor → **Settings → Ordering hours** and save opens/closes.
2. Existing rows with **NULL** hours stay **closed** on the customer app until hours are set.
3. New vendors from **Add Vendor** default to **07:00 – 20:00** (admin onboarding).

---

## Customer app changes (`Waakye-Plug2`)

| Area | Change |
|------|--------|
| `src/app/utils/timeUtils.ts` | Platform open until 21:00; `getPlatformOrderingStatus()`. |
| `src/app/lib/vendorHours.ts` | `isWithinDailyHours`, `vendorAcceptingOrders()`. |
| `src/app/lib/vendorMenu.ts` | Selects `daily_opens_at`, `daily_closes_at`; `getVendorById` for refresh. |
| `src/app/context/VendorContext.tsx` | Refreshes selected vendor every 30s (picks up admin `is_open` / hour edits). |
| `src/app/App.tsx` | Gates ordering screens; switch vendor **clears cart**; blocks checkout when closed. |
| `src/app/components/screens/VendorSelectScreen.tsx` | Open badge = accepting orders (hours + toggle). |
| `src/app/components/screens/LandingScreen.tsx` | Status badge + copy aligned with platform/vendor hours. |
| `src/app/components/screens/ClosedScreen.tsx` | Evening platform-closed UX. |
| `src/app/components/screens/VendorClosedScreen.tsx` | Vendor closed / outside hours. |
| `src/app/components/screens/OrderSummaryScreen.tsx` | `canPlaceOrders` disables confirm when closed. |

**My Orders** and **order confirmation** remain available after platform close.

---

## Admin panel changes (`waakyeplug-vendor`)

| Area | Change |
|------|--------|
| `src/lib/vendorHours.ts` | Same hour logic as customer (for “accepting orders now” hint). |
| `src/lib/api.ts` | `Vendor` type + create/update `daily_opens_at` / `daily_closes_at`. |
| `src/pages/tabs/SettingsTab.tsx` | **Ordering hours** form; live status; shop toggle + build-your-own cards separated. |
| `src/pages/OnboardingPage.tsx` | Opens/closes time inputs on new vendor (defaults 07:00–20:00). |

Vendors do **not** log into this app — admins set hours and the open toggle.

---

## Rollout checklist

- [ ] Apply `2026-09-26_vendor_daily_hours.sql` on live Supabase.
- [ ] Deploy **admin** (so hours can be edited).
- [ ] Set hours for every **approved** vendor with NULL columns.
- [ ] Deploy **customer** app.
- [ ] Smoke test: pick vendor during hours → order; after 9 PM → platform closed; toggle closed in admin → vendor closed within ~30s.

---

## Future (not in this release)

- Per-day schedules (Mon–Sun), timezone column, or auto-`is_open` from cron.
- Customer UI showing “Opens at 7:00 AM” from stored hours when closed.

Questions: see `docs/OPERATIONS.md` or ping whoever owns Supabase migrations in this repo.
