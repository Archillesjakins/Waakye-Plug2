# Waakye Plug — Initial Audit & Bug Report

**Date:** 2026-09-09
**Repo:** `Waakye-Plug2` (customer app) — github.com/Spidey2342/Waakye-Plug2
**Scope of this doc:** customer-facing web app only. Admin panel and Rider app are separate codebases — to be audited separately.
**Auditor:** Selasi Coder (automated audit + manual code review)

---

## 1. Summary

| Item | Result |
|---|---|
| Stack | Vite 6 + React 18 + Tailwind 4 + Supabase (anon auth) + Figma Make export |
| Production build | ✅ Passes — 2075 modules, 1m42s, zero errors |
| Bundle size | ⚠️ 630KB single JS chunk (no code splitting) |
| npm vulnerabilities | ⚠️ 7 total (1 critical, 4 high, 1 moderate, 1 low) |
| Secrets hygiene | ✅ `.env` gitignored, nothing committed |
| Overall verdict | **Solid bones. 2–3 focused sessions from launch-ready, not a rewrite.** |

---

## 2. Bugs & Issues (ranked by severity)

### 🔴 P1 — Order status mismatch breaks the live order tracker
- **Where:** `src/app/lib/orders.ts:49` inserts orders with `status: 'available'`
- **Conflict:** `ConfirmationScreen.tsx:17-22` expects `pending → accepted → preparing → ready → picked_up → delivered`
- **Effect:** `currentStepIndex` computes to `-1`, so the tracker never activates. Every step stays grey from the moment the order is placed — even after the vendor accepts.
- **Fix:** align the insert status with the tracker's first step (`'pending'`), and confirm the DB/vendor app writes the exact statuses the tracker keys on.

### 🟠 P2 — Two competing order-history systems (data divergence)
- Real orders go to Supabase, **but** `App.tsx` + `ConfirmationScreen.handleDone` *also* save every cart line to localStorage (`utils/orderHistory`).
- `OrderHistoryScreen` reads localStorage → can show stale/divergent data.
- `MyOrdersScreen` reads Supabase → the "truth".
- **Fix:** delete the localStorage path entirely; make OrderHistoryScreen read Supabase like MyOrdersScreen.

### 🟠 P3 — Breakfast flow is dead code
- `App.tsx:171` hard-disables it with a `"coming soon"` toast.
- `SBlinkspage` was never converted to the cart model and is special-cased in App.tsx (see comments at lines 113, 216).
- **Decision needed:** if breakfast ships at launch, this is blocking work, not polish.

### 🟡 P4 — Opening-hours logic contradicts itself
- `timeUtils` comments claim a **5:30AM–8AM** ordering window; the actual code allows **00:00–23:59 (always open)**.
- `ClosedScreen` copy tells users the "menu drops at 5:30 AM" — and links a WhatsApp group whose URL has a garbage suffix (`?mode=gi_t  /`).
- **Decision needed:** which is real business logic — the window, or always-open?

### 🟡 P5 — Dead / broken code dragging the bundle
| File | Problem |
|---|---|
| `components/screens/CartScreen.tsx` | Fully orphaned — nothing imports it |
| `utils/orderTypes.ts` | `StoredOrder extends OrderItem` **without importing** OrderItem — crashes if ever imported |
| `lib/supabase.ts:8-36` | Leftover gamification block from another project (`PlayerStats`, `SPIN_REWARDS`, `POINTS_PER_ORDER`) — unused |

### 🟡 P6 — Rough edges
- 3× `alert()` for geolocation errors in `OrderSummaryScreen` (lines 27, 60) and `ClosedScreen:70` — should be toasts.
- Build script (`package.json`) has **no `tsc` step** — type errors never fail a build, which is exactly why P5's broken file survives silently.
- Junk commit messages ("done", "hh", "test", "move") — hurts traceability.
- 630KB single JS chunk — needs route-level code splitting before launch.

---

## 3. What's Verified Good ✅
- Real architecture, not a Figma dump: `UserContext` / `VendorContext` / `CartContext` + a `lib/` layer (`supabase`, `orders`, `customerOrders`, `vendorMenu`).
- Real Supabase anon auth + DB writes, with **realtime order status tracking** via channels.
- `VendorSelectScreen` has proper loading / denied / unavailable states; geolocation with distance-sorted vendor list.
- Money handled via constants (`DELIVERY_FEE = 8`, `SERVICE_FEE = 1` GHS) — no magic numbers.
- `UserProvider` correctly wraps `App` in `main.tsx`.

---

## 4. Environment Notes
- App requires `.env` with `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. ✅ Present locally as of 2026-09-09 (keys not reproduced in this doc).
- **2026-09-13 correction:** an earlier session note claimed "no `.env` on the machine" — **false**. The file is at `Waakye-Plug2/.env` (291B, 9/9). The check that produced the wrong answer ran `ls .env*` inside a broken nested-powershell (`Select-Object` typo → error before listing), so the absence was never actually observed. Lesson: re-run with list_directory before concluding a file is missing.
- DB tables referenced by code: `profiles`, `vendors` (status='approved'), `vendor_menu_items`, `orders`; `customerOrders.ts` also expects a riders→profiles join.

---

## 5. Recommended Fix Order
1. **P1** status mismatch — directly breaks post-order experience.
2. **P2** kill the localStorage history path.
3. **P4/P3** get business decisions (opening hours, breakfast scope) from Lumora.
4. **P5/P6** dead-code sweep + add `tsc` to build + toasts over alerts.
5. Pre-launch: npm audit fix, code splitting, proper commit hygiene.

## 6. Pending
- [ ] Audit **Rider app** (separate repo — to be pulled next). *(Done — see `../Waakye-plug-rider/RIDER_AUDIT.md`)*
- [ ] Audit **Admin panel** (separate codebase).
- [ ] Confirm with Lumora: intended order `status` lifecycle across all three apps (they must agree).

---

## 7. Fix log

### 2026-09-12 — Cross-system hardening landed in THIS repo (P1–P6 still open) ✅
Two system-wide migrations + shared schema tooling were added here because this repo is the schema home (`schema/`), even though the holes they close were filed in the companion docs:
- `schema/migrations/2026-09-12_rls_lockdown.sql` — full RLS lockdown of the live DB (closes vendor **V2**, rider-side self-approval/commission-wipe, customer fake-status writes). Details: `../waakyeplug-vendor/VENDOR_AUDIT.md` fix log.
- `schema/migrations/2026-09-12_pin_rate_limits.sql` — `auth_rate_limits` table + `begin_auth_attempt` / `record_auth_failure` / `clear_auth_failures` SECURITY DEFINER functions backing the new `rider-login` and hardened `reset-pin` edge functions (closes rider **S1/S2**). Details: `../Waakye-plug-rider/RIDER_AUDIT.md` fix log.
- Shared tooling: `schema/fetch-schema.js` (schema dump), `schema/smoke-test.cjs` (rerunnable live smoke test), `schema/cleanup-test-rider.cjs`.
- **Status of P1–P6:** all still open. P1 (status mismatch) is now the top launch-blocker — the RLS lockdown deliberately did NOT touch the status lifecycle; that needs the canonical enum decision from Lumora first (rider doc **S4** / vendor doc **V3** are the same issue).

### 2026-09-12 — FIX #4 (P1) canonical status enum + live tracker fix ✅ DEPLOYED
Lumora decision: tracker shows **friendly labels mapped to the real statuses** (no fake vendor-accept step). Fixes applied:

**1. Customer tracker rebuilt — `src/app/components/screens/ConfirmationScreen.tsx`**
- `STATUS_STEPS` now matches reality: `available → rider_assigned → picked_up → delivered` with friendly labels (Order Sent / Rider Assigned / On the way / Delivered). Ghost `pending`/`accepted`/`preparing`/`ready` steps removed.
- `LEGACY_STEP_INDEX` maps any old-row legacy status onto the closest real step (defaults to step 0) so the tracker can never show a wrong position.
- Mount-time status fetch added: re-entering the screen (or reloading) shows the REAL current status instead of always "Order Sent".
- `cancelled` handled explicitly (red state, vendor-cancelled copy).
- Live subscription retained: `postgres_changes` UPDATE on this order's row, filtered by `id=eq.{orderId}` (requires realtime replication — verified enabled, see below).

**2. Migration — `schema/migrations/2026-09-12_canonical_status.sql` ✅ APPLIED LIVE**
- Replaced permissive `orders_status_check` (allowed `pending`+`ready` ghosts) with canonical 5: `available, rider_assigned, picked_up, delivered, cancelled`.
- Pre-flight safety: verified live data contains ONLY `cancelled` (2) + `delivered` (12) — zero legacy rows; grep-verified all 3 apps write only canonical statuses (customer: `available`; rider: `rider_assigned`/`picked_up`/`delivered`; vendor: `cancelled` only).
- Verified live: constraint def now `CHECK (status = ANY(ARRAY['available','rider_assigned','picked_up','delivered','cancelled']))`; negative test (UPDATE to `'pending'` in a rolled-back tx) correctly rejected with `23514 check_violation`.

**3. Realtime verified** — `orders` is in the `supabase_realtime` publication (`pg_publication_tables`), so the tracker's live subscription works.

**4. Crash recovery** — the session stream died mid-edit and corrupted `src/app/types/orderTypes.ts` (interfaces squashed, invalid `class _unused{}` junk). Restored byte-for-byte from upstream `raw.githubusercontent.com/Spidey2342/Waakye-Plug2/main` (repo had no un-committed canonical copy; local git hung — 2 stuck `git.exe` processes killed). Verified no other source file was corrupted (repo-wide grep for corruption markers: clean) and nothing imported the corrupted-only `Customer`/`StoredOrder` interfaces.

**P1 is CLOSED.** Remaining: P2/P5 (dual history, rider-removal commission check, dead-code sweep), P6 (alert()→toast + WhatsApp link).

### 2026-09-15 — FIX #5 + #6 (P2/P5/P6) customer app ✅ code complete — ⚠️ dist rebuild pending

**FIX #5a — dual order history consolidated (P2)**
- Duplicate `OrderHistoryScreen` deleted; **`MyOrdersScreen` is the single order history** (realtime subscription on own orders + 30s fallback poll).
- "Order Again" wired in `App.tsx` → fresh `BuildWaakyeScreen` (fetches fresh menu, never replays old cart lines). The localStorage order-history path from the original P2 finding is gone.

**FIX #5b — rider-removal commission guard (P5, server side)**
- `decline-rider` edge fn now refuses to delete a rider while `commission_owed > 0` → 409 naming the amount ("Settle the balance first"); owed=0 → full deletion (riders + profile + auth account).
- VERIFIED LIVE with a real admin session: bogus JWT → 401, customer JWT → 403, owed 25.50 → 409 (row + auth intact), settled → 200 + full deletion. Test: `schema/test-v5-commission-guard.cjs` (rerunnable, self-cleaning). Full entry: `../Waakye-plug-rider/RIDER_AUDIT.md` §6.

**FIX #5c — dead-code sweep (P5)**
- `components/screens/CartScreen.tsx` DELETED (fully orphaned).
- `utils/orderTypes.ts` DELETED (StoredOrder import bug, imported nowhere).
- `lib/supabase.ts` gamification block removed (`PlayerStats` / `SPIN_REWARDS` / `POINTS_PER_ORDER` — leftovers from another project).

**FIX #6 — alert()→toast sweep + ClosedScreen cleanup (P6)**
- Zero `alert(` remain in `src/` (grep-verified). Geolocation errors in `OrderSummaryScreen` are on sonner toasts.
- `ClosedScreen.tsx` was left in a broken state by an earlier edit: THREE buttons all opening WhatsApp (2× identical "Follow on Whatsapp" + "View Tomorrow's Menu" also opening WhatsApp; an unused `toast` import betrayed the intended behavior). Rebuilt: ONE "Follow on WhatsApp" button using the real group link, "View Tomorrow's Menu" now shows a sonner toast ("Tomorrow's menu drops at 5:00 PM…"), unused `Instagram` import removed, heading whitespace cleaned.

**Verification:** `scripts/syntax-gate.cjs` — 75 files parsed, 0 failed. **Production build ✅ SUCCEEDED 2026-09-15 ~01:00** (2nd attempt; 1st wedged mid-transform at 0.48 GB free RAM — playbook confirms retry pattern works): fresh `dist/assets/index-CU_s9DH_.js` (613kB, down from 630kB — dead-code removal shows in the bundle) + `index-5NNaxt36.css` (104kB). Chunk-size warning unchanged (known pre-launch item: code splitting).

**Still needing Lumora's decision:** P3 (breakfast flow scope), P4 (opening-hours window vs always-open).
