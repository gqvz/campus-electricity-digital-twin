# IITR Pulse — Chromatic

An independent student electricity-wastage audit prototype for IIT Roorkee. **Chromatic is the final selected interface**: a warm illustrated campus, civic-blue building index and cream evidence panel. The gallery, comparisons, other themes and inspiration-board routes have been retired.

```sh
npm install
npm run dev -- --host 0.0.0.0
```

Open `http://localhost:5173/`. Retired design URLs return to the sole campus interface. Campus and Findings are views within this prototype.

## Working prototype

Drawing/list selection, searchable building index, type/audit-scope and recorded-time/device filters, four schematic hero-building floor interactions, evidence dialogs, findings, whole-campus zoom/focus/rotation/reset, pointer drag, arrow-key panning, a manual five-stop tour and sample CSV export.

The shared-scale map contains 231 OSM building features within the mapped boundary, 229 road/path ways, 47 landscape/sport areas and 17 mapped tree nodes. It preserves geographic placement, relative size, orientation, courtyards and irregular wings. Five coarse outlines (Ravindra, Govind, ECE, Mechanical, Management Studies) were corrected against satellite imagery, approximately. Coverage is not a surveyed inventory of every structure. Twelve buildings form the illustrative audit scope; other structures are explicitly Not audited.

Observations are fixed illustrative fixtures, not collected results or live telemetry. Watts use count × configured wattage; kWh requires an explicit verification interval. Heights, floor layouts and façade details remain schematic. Recent height research is preserved separately, not adopted as verified geometry.

The campus is a real-time 3D model (React Three Fiber, orthographic camera). Drag to orbit, right-drag or arrow keys to pan, scroll or +/- to zoom, and use the rotate buttons for 45° turns. The ground follows an estimated elevation surface (about 7-9 m higher around the Main Building and library than at Rajiv/Jawahar Bhawan and the stadium); a toggle exaggerates it three times. Building plan shapes are the sourced OSM rings; storeys, windows, columns, balconies, domes and towers are procedural studies from photographs (see [docs/building-research.txt](docs/building-research.txt)). Supabase, authentication, audit capture, review/publication and real observations are upcoming work.

## Design and sources

- [theme.ts](src/designs/theme.ts) contains the sole selected palette.
- [Prototype.tsx](src/designs/Prototype.tsx), [CampusScene3D.tsx](src/designs/CampusScene3D.tsx), [campus3d/](src/designs/campus3d) and [designs.css](src/designs/designs.css) implement the interface and 3D map.
- `src/designs/campus/` preserves geographic layers and OSM identities; identical data is public at `/campus/` under ODbL 1.0.
- [buildingGeometry.ts](src/designs/buildingGeometry.ts) owns the reversible transform and shared 50-metres-per-scene-unit scale.
- [Geometry source notes](public/geometry-sources.txt) record attribution, sources and identity/coverage caveats in plain text.

Retired design code and gallery assets are recoverably archived locally, outside the shipped app. Existing screenshots in Downloads are preserved.

## Verification

```sh
npm run build
npm test
npx playwright install chromium
npm run test:e2e   # uses SwiftShader software WebGL in headless Chromium; slow without a GPU
```

Tests cover geographic coverage/round trips, courtyards, 3D model generation, camera rotation/zoom, hero-floor slabs, list/map selection, evidence and verified-duration honesty, filters, retired routes, keyboard controls, modal focus, tour, CSV export and responsive views. Screenshots go to ignored `artifacts/designs/`. Axe scans are automated evidence, not complete WCAG conformance or a screen-reader audit.
