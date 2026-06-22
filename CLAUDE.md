# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chevron is a map-first web app for astrophotographers to plan travel to dark sky sites. It combines David Lorenz's 2024 Light Pollution Atlas with real-time environmental data (weather, cloud cover, moon phase) and presents contextual insights as the user interacts with an interactive map.

The frontend is handled separately. This repo is the **Next.js full-stack backend**, acting as a data aggregation and API layer. Keep logic lightweight — most intelligence lives on the frontend.

## Tech Stack

- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript throughout
- **Backend pattern**: API Routes (`app/api/`) + Server Actions for simple mutations
- **Database**: Supabase or Vercel Postgres (start simple, add when needed)
- **Hosting**: Vercel
- **Weather data**: Open-Meteo (preferred)
- **Map data**: David Lorenz 2024 Light Pollution Atlas (`NorthAmerica2024.png` and related files)

## Commands

```bash
npm run dev       # Start dev server (localhost:3000)
npm run build     # Production build
npm run lint      # ESLint
npm run test      # Run tests
npm run test -- --testPathPattern=<file>  # Run a single test file
```

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
