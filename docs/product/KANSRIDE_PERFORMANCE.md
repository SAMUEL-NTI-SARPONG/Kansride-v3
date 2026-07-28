# KansRide — Performance Review (UX-Focused)

**Date:** 2026-07-27
**Lens:** how current implementation and proposed UI ideas affect battery, RAM, CPU, and network on Ghanaian realities (2 GB Android devices, 3G/4G MTN, prepaid data costing real money).
**Non-goals:** backend scalability review (out of scope; no defects asserted).

---

## 1. Current-State Findings

| # | Finding | Impact | Evidence | Recommendation | Priority / Release |
| --- | --- | --- | --- | --- | --- |
| P1 | Driver emits location every 10 s unconditionally (fixed fake coordinate today) | Radio wakeups every 10 s while online = top battery drain; Redis geo write per event | `apps/mobile-driver/src/api/socket.ts:67-78` | **Stationarity gate:** emit on ≥ 25 m displacement or 30 s heartbeat, whichever first; during active ride keep 5–10 s cadence. Backend staleness threshold is 60 s — 30 s heartbeat stays safely inside | Critical / V1 (with GPS fix) |
| P2 | Passenger app instantiates React Query but uses raw `useEffect` fetching | Dead weight + no cache/dedupe/retry | `app/_layout.tsx`; grep shows no `useQuery` | Either adopt React Query for activity/profile (gets cache + retry free) or remove provider. Recommend adopt with component refactor | Medium / V1 |
| P3 | Socket reconnect loops (driver: infinite, 3–10 s; passenger: 10 attempts) | Acceptable; ensure backoff pauses when app backgrounded to save radio | both `socket.ts` files | Add AppState-aware connect/disconnect (V1.1) | Low / V1.1 |
| P4 | Activity screen: full history fetch, no pagination UI | Unbounded list growth on heavy users | `activity.tsx` (API supports limit/offset ✓) | Paginate 20/page on scroll | Medium / V1.1 |
| P5 | Tracking web refetches full snapshot on every status socket event | Small payloads; fine | `track/[token]/page.tsx:117` | Keep; add refetch debounce | Low / V1 |
| P6 | `console.log` in hot paths (socket events with ride IDs) | Logcat overhead + privacy | passenger `socket.ts` (4 sites), `ride/[id].tsx:79`, `activity.tsx:36`, `profile.tsx:35` | Strip or gate behind `__DEV__` | High / V1 |
| P7 | Admin tables 20 rows/page, no virtualization | Fine at this size | admin pages | No action; revisit at 100+ rows | — |
| P8 | No app icon asset; no splash config | Build risk, cold-start brand void | passenger `app.json` → missing `./assets/icon.png` | Produce icon/splash set (design task) | High / V1 |
| P9 | `paddingTop: 60` manual safe-area hacks | Not perf, but layout jank risk on notched devices | most mobile screens | `useSafeAreaInsets` with component adoption | Medium / V1 |

## 2. Risk Assessment of Proposed UI Ideas

| Proposed idea (from these docs) | Risk | Mitigation (binding) |
| --- | --- | --- |
| Live driver marker interpolation (Map doc §3) | Per-frame JS work → CPU/battery | Native-driver/Reanimated interpolation; ≤ 1 state update per second into React tree |
| Searching radar animation | Loop cost trivial, but keeps screen awake | Loop only while screen focused; stop on assignment (spec'd); static frame under reduced motion |
| Admin live map with 50+ drivers | Marker thrash | Cluster > 20 (spec'd); poll 15 s not 5 s; V1.1 socket diffs |
| Heatmaps | Client-side grid on 10k rides = jank | Server aggregation **[BE]** or capped date range (30 days default) |
| Dark mode | None meaningful | Ship |
| Tile caching/offline maps | Storage growth | 50 MB cap; clear-cache setting |
| Real routing polylines (V1.1) | Geometry churn per update | Update route only on status change or ≥ 100 m deviation |
| Skeleton shimmer | GPU overdraw | Flat gradient sweep on single layer; off in low-power (spec'd) |
| Dark map style | Slightly lower OLED drain | Free win on AMOLED Tecno/Infinix devices |

## 3. Budgets (V1 acceptance)

| Metric | Budget | How checked |
| --- | --- | --- |
| Passenger cold start (2 GB Android, 4G) | ≤ 3 s to interactive | Perf monitor / manual lab |
| Map first paint | ≤ 2 s after permission | Manual on 3G throttling |
| Driver battery: 8 h online shift | ≤ 25% app-attributed drain | Field test with 3 drivers |
| Data per completed trip (passenger) | ≤ 3 MB including map tiles (cache-warm ≤ 1 MB) | Charles/data-usage audit |
| Install size | ≤ 60 MB | EAS build report |
| Re-renders during active ride | Marker-driven only; no full-screen re-render per location event | React DevTools profiler |

## 4. Data-Frugality Principles (prepaid-data respect)

- WebSocket-only transport on mobile (already configured ✓) — keep; no polling fallbacks on mobile.
- Payloads are already minimized (tracking contract exemplary ✓) — keep payloads small as fields are added; never add "nice-to-have" fields to per-10-s events.
- Images: WebP; illustrations SVG→optimized PNG; no remote hero images on core flows.
- Prefetch nothing on mobile data; tile prefetch Wi-Fi-only (V1.1).

## 5. What NOT to Do

- No background GPS for passengers (battery + trust).
- No analytics SDK firehose in V1; batch events, V1.1 decision on vendor.
- No crash-course of third-party SDKs (each = startup ms + APK MB). Map engine + Reanimated + NetInfo + icons is the V1 ceiling.
