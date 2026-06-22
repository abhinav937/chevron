# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chevron is a map-first web app for astrophotographers to plan travel to dark sky sites. It combines David Lorenz's 2024 Light Pollution Atlas with real-time environmental data (weather, cloud cover, moon phase) and presents contextual insights as the user interacts with an interactive map.

This repository contains **two Next.js apps**:

- **Root (`/`)** — the original **data-aggregation backend** (`app/`, `lib/`, `types/`). A lightweight API layer over Open-Meteo + the Lorenz atlas + moon math. Has the Jest test suite.
- **`frontend/chevron/`** — the **user-facing Next.js app** (Leaflet map UI + its own API routes, including the Grok/xAI-powered insights endpoint). This is what `npm run dev` from the root launches.

The two share the same domain concepts but are independent Next apps with their own `package.json`, `lib/`, and `types/`. When editing, be clear which app a file belongs to — most logic referenced day-to-day now lives in `frontend/chevron/`.

## Tech Stack

- **Framework**: Next.js 15+ (App Router), both apps
- **Language**: TypeScript throughout
- **Backend pattern**: API Routes (`app/api/`) + Server Actions for simple mutations
- **Map UI**: Leaflet + CARTO dark basemap (`frontend/chevron`)
- **Database**: Supabase or Vercel Postgres (start simple, add when needed)
- **Hosting**: Vercel
- **Weather data**: Open-Meteo (preferred)
- **Precipitation radar**: RainViewer (tile overlay)
- **AI insights**: xAI Grok (`grok-4.3`) via `XAI_API_KEY`
- **Map data**: David Lorenz 2024 Light Pollution Atlas — served as raster tiles from `djlorenz.github.io`

## Commands

Root `npm run dev`/`build`/`start` delegate to `frontend/chevron`; the root's own
backend can be run/built with the `:api` variants.

```bash
npm install                                    # Install root deps
npm run dev                                    # Start the frontend app (frontend/chevron)
npm run dev:api                                # Start the root backend app only
npm run build                                  # Build the frontend app
npm run build:api                              # Build the root backend app
npm run lint                                   # ESLint (root)
npm test                                       # Run all root tests (Jest)
npm test -- --testPathPattern=lib/astronomy    # Run a single test file

# frontend/chevron has its own scripts:
cd frontend/chevron && npm install && npm run dev
```

> Run only **one** `next dev` per app. Multiple dev servers sharing a `.next`
> directory corrupt the build cache (`__webpack_modules__ is not a function`,
> missing vendor-chunks). If that happens: kill stray `next` processes, `rm -rf
> .next`, and start a single server.

## Architecture

### Folder Structure

```
app/
  api/
    insights/route.ts   # Primary endpoint — combines all data sources
    weather/route.ts    # Cloud cover + forecast from Open-Meteo
    moon/route.ts       # Moon phase, illumination, astronomical darkness
    locations/route.ts  # Saved dark sites (CRUD, later phase)
    maps/route.ts       # Lorenz atlas data serving (if needed server-side)
lib/
  lorenz.ts             # Helpers for interpreting Lorenz atlas data
  weather.ts            # Open-Meteo API calls
  astronomy.ts          # Moon phase + darkness window calculations
  utils.ts
types/
  index.ts              # Shared TypeScript interfaces
data/maps/              # Raw Lorenz atlas files (not publicly served)
public/maps/            # Map images served directly to frontend
```

#### `frontend/chevron/` (user-facing app)

```
app/
  page.tsx                # Main UI: search, featured sites, map, metrics, Grok insights
  components/Map.tsx      # Leaflet map + overlay layers (LP / clouds / radar)
  api/
    conditions/route.ts   # Coords → weather + moon + cloud grid + score + suggested overlays
    insights/route.ts     # Grok (xAI) call → recommendation, targets, tip, status
    radar/route.ts        # Latest RainViewer radar frame
lib/
  cloudOverlay.ts         # Cloud-grid → smooth raster (bilinear); RainViewer tile URL
  weather.ts              # Open-Meteo calls + cloud grid sampling
  astronomy.ts, conditions.ts, geo.ts
```

### Map overlays (`frontend/chevron`)

Leaflet panes enforce z-order: base tiles (200) < light pollution (350) < clouds (400) < radar (450).

- **Light pollution** — Lorenz raster tiles. URL pattern is `tile_{z}_{x}_{y}.png` (all underscores) with `tileSize: 1024, zoomOffset: -2, maxNativeZoom: 8`. Getting the path wrong makes every tile 404 → silent black fallback.
- **Cloud cover** — `getCloudGrid` samples a 3×3 Open-Meteo grid; `cloudGridToDataUrl` bilinear-interpolates it into a smooth raster (grid is ordered south→north, so the image is flipped vertically). Keep alpha well below opaque so the map stays legible.
- **Precipitation** — RainViewer tiles. RainViewer only serves real tiles up to **z7**; beyond that it returns a "Zoom Level Not Supported" placeholder, so the layer uses `maxNativeZoom: 7` and lets Leaflet upscale.

### Key Design Decisions

**`/api/insights` is the primary endpoint.** It accepts coordinates or map viewport bounds and returns a combined payload: Lorenz darkness rating, weather/cloud data, moon phase, and any derived recommendations. The frontend calls this single endpoint when the user moves or zooms the map.

Individual endpoints (`/api/weather`, `/api/moon`) exist as standalone utilities but `insights` is the main integration point.

**Lorenz data is static.** The atlas PNG and any processed derivatives live in `data/maps/` (or `public/maps/` if served directly). Server-side pixel sampling or pre-processed lookup tables go in `lib/lorenz.ts`. Credit David Lorenz in comments wherever his data is used.

**API keys go in `.env.local`** and are never committed. Access them server-side only (inside `lib/` or API routes, never in client components).

## API Contract (MVP)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/insights` | POST | Coords/bounds → combined Lorenz + weather + moon payload |
| `/api/weather` | GET | Current + forecast cloud/weather for a location |
| `/api/moon` | GET | Moon phase, illumination, darkness windows for a date/location |
| `/api/locations` | GET/POST | Saved dark sites (future feature) |

Each route should clearly document what it receives and what it returns via TypeScript types in `types/index.ts`.

### Frontend API (`frontend/chevron/app/api`)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/conditions` | POST | Coords (+bortle) → weather, moon, cloud grid, score, suggested overlays |
| `/api/insights` | POST | Full labeled conditions → Grok recommendation/targets/tip/status |
| `/api/radar` | GET | Latest RainViewer radar frame (`{ available, frame }`) |

**Grok insights expect fully labeled, scale-annotated context.** `/api/insights` builds a prompt that gives Grok each metric *with its scale/legend* (Bortle 1–9 + SQM, cloud-cover transparency bands, precipitation mm thresholds, moon illumination meaning, dark-window hours) and **requires it to name the location** in the output. When adding a new data source, pass it the same way (value + scale) rather than as a bare number.
