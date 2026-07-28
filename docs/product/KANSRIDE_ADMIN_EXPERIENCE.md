# KansRide — Complete Admin Experience

**Date:** 2026-07-27
**App audited:** `apps/admin-web` (Next.js 15; routes: `/`, `/login`, `/dashboard` + drivers/rides/subscriptions/live-map/users). Backend: `AdminController` — five read-only GETs; RBAC defines 30 permissions across 11 roles (8 staff-capable), of which the admin-web login admits 5 (`finance_officer`, `ops_admin`, `system_admin`, `super_admin`, `auditor`); `admin:subscribe` socket room exists but is unused by the web app.

**Framing:** the admin app is today a **read-only viewer**. A commercial launch needs it to be an **operations console**. All write capabilities below are marked **[BE]** — they are new, separately-approved backend tasks that consume permissions RBAC already defines. No existing contract changes.

---

## 1. Information Architecture (target)

```
/dashboard            Operations overview (KPIs, live feed, alerts)
/live-map             Live driver map + active trips (replaces placeholder)
/rides                All rides: search, filter, investigate
/rides/[id]           Ride investigation detail            [BE: detail endpoint exists — GET /admin/rides list only; add detail or reuse]
/drivers              Driver directory + approval queue
/drivers/[id]         Driver profile, vehicle, docs, actions [BE: approve/suspend]
/users                User directory, roles, status         [BE: suspend]
/subscriptions        Daily-fee monitoring (exists; extend)
/payments             Subscription & fare payments          [BE: payments table is dead]
/incidents            Safety & complaints                   [BE: no tables/endpoints]
/analytics            Charts, heatmaps, demand, revenue     [BE: aggregations]
/audit-logs           Audit trail                           [BE: table dead — wire writes]
/settings             Fares, zones, fees, SMS config        [BE: config tables]
/system               Health, providers, queues             [BE: extend /health]
```

Sidebar sections: **Operate** (Overview, Live Map, Rides, Incidents) · **People** (Drivers, Users) · **Money** (Subscriptions, Payments, Analytics) · **System** (Audit Logs, Settings, System Health). Role-filtered by the JWT role's permissions (map from `rbac.ts`; client hides, server enforces — current design principle preserved).

## 2. Screen Designs

### 2.1 Login (exists — polish)
- Existing phone-OTP with role gate (5 staff roles admitted) is correct and secure in principle. Fix label association (`htmlFor`), add `autoComplete="tel"` / `one-time-code`, error banners instead of inline red text only, and a "provisioned accounts only" hint. **Priority:** High · **Release:** V1.

### 2.2 Operations Dashboard (exists — deepen)
- **Existing:** 4 stat cards + recent rides table; skeletons/errors/empty states present ✓.
- **Add (V1):** live strip: "Active trips now · Online drivers now" (poll 15 s — socket is V1.1 via `admin:subscribe`); alert row (unapproved driver applications count, failed-payment count **[BE]**); GHS revenue formatting (already via `formatGhsFromPesewas` ✓).
- **V1.1:** socket-driven live counters, sparklines.

### 2.3 Live Driver Map (placeholder → flagship)
- **Existing:** static emoji placeholder; no map library installed; `admin:subscribe` room + `ride:driver-location` events exist on the backend.
- **V1 design:** MapLibre map (OSM tiles), green Pragya markers for online drivers (poll `GET /admin/drivers?status=online` 15 s; socket in V1.1), active-trip route overlays, marker clustering > 20 drivers, driver popup (name, plate, rating, current ride). Filters: online/all, active trips only. Night style follows system.
- **Priority:** Critical · **Release:** V1 (poll-based), V1.1 (socket live).

### 2.4 Ride Investigation
- **Existing:** paginated rides table with status tabs; no detail; no search.
- **V1:** search by public reference/phone **[BE: query params]**; detail drawer/page: full timeline (status history from timestamps), passenger/driver summaries, fare in GHS, cancellation actor/reason (schema has `cancellationReason`), rating, tracking-link status. Actions: admin cancel (transition table supports admin actor; endpoint accepts `super_admin` today — permission mapping decision **[BE]**).
- **Priority:** Critical (support core loop) · **Release:** V1.

### 2.5 Driver Management + Approval Queue
- **Existing:** table with online/offline filter. Registration leaves drivers inactive (`driver_applicant`); approval is out-of-band — **launch blocker**.
- **V1:** "Pending approval" queue (drivers where `isActive=false` + role `driver_applicant`) **[BE: list filter + PATCH approve/reject endpoints, `admin:manage_drivers`]**. Detail: submitted fields (name, licence, plate, colour, make/model — register contract), approve → activates; reject → reason stored. Suspension toggle for active drivers **[BE]**.
- **Priority:** Critical · **Release:** V1.

### 2.6 Passenger/User Management
- **Existing:** users table, no filters.
- **V1:** search by phone **[BE]**; status badges (active/suspended/banned — enum exists); suspend/unsuspend **[BE: `admin:manage_users`]** with confirm dialog + reason. **Priority:** High · **Release:** V1.

### 2.7 Driver Daily Fee Monitoring
- **Existing:** subscriptions table + static "GHS 10.00" banner.
- **V1:** expiring-soon filter (< 2 h), expiring-today counter on dashboard, revenue-today card (sum active subscription amounts — data exists in table). **Priority:** High · **Release:** V1.
- **V1.1:** payment success/failure rates once real MoMo lands **[BE]**.

### 2.8 Complaints & Incidents **[BE: no support/incident tables]**
- V1: run via WhatsApp/phone + a simple internal log (even a spreadsheet) — do not build.
- V1.1: incident register (ride-linked, severity, status, notes) consuming `safety:*` permissions; complaint intake from passenger/driver support screens.
- **Priority:** Medium · **Release:** V1.1.

### 2.9 Analytics, Heatmaps, Demand, Revenue
- **Existing:** none beyond counters.
- V1.1: rides/day chart, revenue/day (GHS), acceptance rate, cancellation breakdown (all derivable from `rides`); heatmap of pickup points (PostGIS or client-side grid from ride rows) **[BE: aggregation endpoints]**.
- V2: demand forecast (hour-of-week model from history), zone performance.
- **Priority:** Medium · **Release:** V1.1/V2.

### 2.10 Audit Logs
- **Existing:** table + permission; **nothing writes it** (grep-verified).
- Wire writes into every new admin mutation (approve, suspend, cancel, config change) as those endpoints land — `audit_logs` schema already has `entityType/entityId/action/changes/ipAddress/userAgent`. Viewer page V1.1 (table, filter by actor/entity). **Priority:** High (with first mutations) · **Release:** V1 (writes), V1.1 (viewer).

### 2.11 Configuration
- **Existing:** fares/fee hardcoded in `shared-config/constants.ts` (base 200p, 150p/km, 10p/min, min 300p, priority 1.5×, fee 1000p/24 h). Permissions `admin:manage_fares/zones` exist.
- V1: **constants stay hardcoded** (single zone, pre-launch — correct simplicity).
- V2: config tables + UI **[BE]**; until then changes are code releases.
- **Priority:** Low · **Release:** V2.

### 2.12 System Health
- **Existing:** `GET /health` (basic).
- V1.1: admin page showing API up/down, DB/Redis connectivity, provider status (SMS/maps/payment mock-vs-live flag), Socket.IO connection count **[BE: extend health]**. **Priority:** Medium · **Release:** V1.1.

## 3. Cross-Cutting UX Requirements

| Item | Current | Required | Release |
| --- | --- | --- | --- |
| Search | none anywhere | Global search (phone, plate, reference) | V1 |
| Detail pages | none | Rides, drivers, users | V1 |
| Mutations | none (api.post/put/delete dead) | Approve, reject, suspend, cancel + audit | V1 |
| Realtime | none (no socket dep) | `admin:subscribe` live map/feed | V1.1 |
| Responsive sidebar | fixed w-64 always | Collapse < 1024 px, hamburger < 768 px | V1 |
| Table overflow | clips on small screens | `overflow-x-auto` wrapper | V1 |
| Labels/a11y | unassociated labels, no scope attrs | Associated labels, `scope="col"`, skip link, focus management | V1 |
| Auth gating | client-only localStorage check | Keep (backend RBAC authoritative) + httpOnly-cookie session is a V2 hardening decision | V1/V2 |

## 4. Admin Priority Matrix

| Priority | Items | Release |
| --- | --- | --- |
| Critical | Driver approval queue + actions **[BE]**, ride investigation + search **[BE]**, real live map (poll), user suspend **[BE]**, audit-log writes with first mutations | V1 |
| High | Subscription expiring-soon monitoring, login a11y fixes, responsive sidebar, table overflow | V1 |
| Medium | Socket live feed, incidents/complaints **[BE]**, analytics/heatmaps **[BE]**, system health **[BE]** | V1.1 |
| Low | Fares/zones config UI **[BE]**, demand forecast, audit viewer polish | V2 |
