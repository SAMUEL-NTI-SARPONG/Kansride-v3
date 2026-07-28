# KansRide — Map Experience

**Date:** 2026-07-27
**Premise (user instruction):** the map engine is not the product — the experience is. Assumed stack: MapLibre (mobile via RN binding, web via `maplibre-gl`), OpenStreetMap tiles/data, PostGIS backend, Socket.IO live updates.
**Current reality:** no map renders anywhere (Audit C1). `react-native-maps` is installed-but-unused in both mobile apps; no map library exists in the web apps. Backend dispatch uses Redis geo (not PostGIS) with straight-line Haversine distances — noted as a V1-acceptable simplification.

---

## 1. Experience Principles

1. **The map breathes but never shouts.** Motion is reserved for the Pragya markers and camera; the basemap is quiet.
2. **Sunlight legibility first.** High-contrast roads, sparse labels, big markers.
3. **Local texture.** Label the landmarks people actually navigate by (Market Circle, Sekondi Station, UHAS, Pragya ranks) — even as a custom POI overlay on OSM.
4. **Honesty.** Straight-line ETA is labelled "~"; nothing animated implies data we don't have.

## 2. Custom Map Style ("KansStyle")

Two variants from the tokens in `KANSRIDE_DESIGN_TOKENS.md` §5 (Day / Night). Derived from a minimal OSM base style (e.g. Positron-like) customized:

- Roads: white/day, muted green-grey/night; primary roads 1.4× default width for zoom 13–16 (the working zoom band for tricycle trips).
- Labels: English + local names; landmark POIs (markets, stations, ranks, churches, mosques) promoted one zoom level earlier than default.
- Water (Takoradi harbour coast) calm blue; harbour/industrial desaturated.
- Buildings visible from z15 for pickup orientation ("the blue kiosk" mental model).
- Day/night auto-switch with app theme; **weather readiness**: style isolated so a rain/harmattan overlay layer can be added without restyling (V2+).

## 3. Markers & Icons

| Marker | Design | Behaviour |
| --- | --- | --- |
| Driver (Pragya) | Top-view Pragya glyph in `primary` disc, white ring, direction wedge | **Heading rotation** smoothed (exponential smoothing, ~300 ms); position interpolated between 10 s updates (dead-reckoning along heading at last speed); idle > 60 s = dimmed (matches backend staleness rule) |
| Passenger (me) | `passengerMarker` blue dot + accuracy halo | Halo pulses only while acquiring; static otherwise |
| Pickup pin | `pickupPin` teardrop, draggable on home | Drop-bounce animation on placement |
| Dropoff pin | `dropoffPin` teardrop | — |
| Selected POI | Secondary-yellow ring | — |
| Cluster (admin) | Count bubble, primary shades by density | Tap zooms to expansion |
| Offline driver (admin) | Grey Pragya | No animation |

Marker assets: single SVG master per type → PNG @1x/2x/3x (RN) + sprite (web). **Pragya icon is a brand asset** — one geometry across app icon, map, illustrations.

## 4. Routes & Trip Progress

- Route line: `routeLine` (`#1B8B4B`), 4 pt, white casing 6 pt, rounded caps. V1 draws straight-line pickup→dropoff (matching Haversine backend); V1.1 adds OSRM/Valhalla routing via the existing `IMapsProvider` interface **[provider task]** — animated draw-in (600 ms) once real geometry exists.
- Trip progress: completed portion in `primaryDark`, remaining in `primary` at 60% opacity; progress derived from driver position projection (V1: distance ratio).
- Driver-to-pickup approach line: dashed `info` until pickup, then solid route.

## 5. Camera Grammar

| Moment | Camera |
| --- | --- |
| Home idle | z15 on user, 300 ms ease to GPS fix |
| Destination selected | Fit pickup+dropoff padding 80 pt, 500 ms |
| Driver assigned | Fit driver+pickup, tilt 0 (no 3-D in V1 — battery + low-end GPU) |
| Trip | Follow driver, heading-up optional toggle (V1.1) |
| Admin live map | z13 zone overview; fit on selection |

## 6. Live Data Wiring (existing contracts — preserved)

- Passenger app: `ride:driver-location` (already received, currently rendered as raw text) → animate marker.
- Driver app: emits `driver:location` every 10 s (today: fake coordinates — fix per Driver doc §3.4).
- Tracking web: `tracking:driver-location` on `/tracking` namespace (already wired) → animate; snapshot for static context.
- Admin: V1 poll `/admin/drivers?status=online` + `/admin/rides?status=active`; V1.1 `admin:subscribe` room (exists, unused) for push updates.

## 7. Surface-Specific Compositions

**Passenger home:** full map, my-location FAB (44 pt, bottom-right above sheet), pickup pin, collapsed sheet. **Active ride:** approach/trip layers + ETA chip + driver card sheet. **Driver app:** navigation mode (bigger arrow, next-action bar). **Tracking web:** map-first layout above the status card (today's placeholder block), auto-fit to driver + endpoints, "live" pulse dot with `prefers-reduced-motion` off-switch. **Admin:** cluster + filters + trip overlay panel.

## 8. States

| State | Treatment |
| --- | --- |
| Tiles loading | `mapPlaceholder`-grey with skeleton streets pattern + spinner; < 2 s target on 3G |
| Permission denied | Map renders centred on Kansaworodo default (existing constant) + PermissionPanel; pickup set manually |
| Network loss | Last tiles persist (cache); OfflineBanner; live markers freeze with "last seen 2 min ago" caption |
| GPS lost mid-trip (driver) | Marker desaturates + "GPS signal lost" pill; admin sees staleness dim |
| Invalid/expired tracking token | No map; error card (exists) |
| Terminal trip (tracking) | Route completes → "Trip completed" card; live layer removed (server revokes token ✓) |

## 9. Offline Maps

- V1: OSM tile cache (default MapLibre cache) sized ~50 MB; zone prefetch on Wi-Fi is V1.1.
- V2: offline pack for the Sekondi-Takoradi bounding box (driver app first — they roam; passengers get cache-only).

## 10. Heatmaps, Geofences, Overlays (admin, V1.1+)

- **Heatmap:** pickup-density from `rides` rows (grid aggregation client-side; PostGIS `ST_SnapToGrid` aggregation **[BE]** V2), primary-green sequential ramp, legend, date filter.
- **Geofences:** operating zone polygon (V2 **[BE: zones]**); rendered as soft primary fill + dashed border on admin; driver app shows "You're outside the service area" (V2).
- **Dispatch overlays (V2 experimental):** demand-vs-supply imbalance cells for dispatcher view, consuming `dispatch:view_live_map`.

## 11. Future-Proofing (hooks, not builds)

- **Traffic:** style reserves a `traffic` source layer slot; V2+ provider decision (OSM has no live traffic — requires commercial provider; document as owner decision).
- **Road closures:** admin-drawn closure polylines (V2 **[BE]**) rendered red-dashed; dispatch routing must respect them when real routing lands.
- **AI dispatch overlays:** the admin map's layer registry (markers/clusters/trips/heat/zones) is the extension point; no refactor needed later.

## 12. Mobile Engine Choice (decision required)

`react-native-maps` (installed) is Google/Apple-native; MapLibre-RN matches the web stack and avoids Google billing. **Recommendation: standardize on MapLibre** (one style JSON for all four surfaces; OSM terms honoured; no API keys). Replacing the unused `react-native-maps` dependency is dependency hygiene, not architecture change. **Owner decision D1.**

## 13. Performance Guardrails (see Performance doc)

- Marker updates batched at ≤ 1 fps re-render; interpolation on the UI thread/native driver.
- Cluster when > 20 markers (admin).
- Disable rotation/tilt gestures in V1 (saves GPU, prevents disorientation).
- Tile zoom cap 17 (trip band) to bound cache.
