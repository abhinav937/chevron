"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import type { MapOverlays } from "./components/Map";
import type { ConditionsPayload } from "@/types";

const Map = dynamic(() => import("./components/Map"), { ssr: false });

const DARK_SPOTS = [
  { name: "Cherry Springs State Park, PA", lat: 41.6501, lng: -77.8164, bortle: 2 },
  { name: "Big Bend National Park, TX",    lat: 29.1872, lng: -103.2504, bortle: 1 },
  { name: "Mauna Kea Peak, HI",            lat: 19.8206, lng: -155.4681, bortle: 1 },
  { name: "Death Valley Basin, CA",        lat: 36.4618, lng: -116.8656, bortle: 1 },
  { name: "Jasper National Park, AB",      lat: 52.8738, lng: -117.9543, bortle: 1 },
  { name: "Great Sand Dunes, CO",          lat: 37.7916, lng: -105.5943, bortle: 2 },
  { name: "Gila Wilderness, NM",           lat: 33.2245, lng: -108.2323, bortle: 1 },
  { name: "Adirondack Northern Wilds, NY", lat: 44.1168, lng: -73.9835,  bortle: 3 },
];

const CITY_POLLUTION = [
  { lat: 40.7128, lng: -74.006,   bortle: 9 },
  { lat: 41.8781, lng: -87.6298,  bortle: 9 },
  { lat: 34.0522, lng: -118.2437, bortle: 9 },
  { lat: 31.1351, lng: -96.3412,  bortle: 9 },
  { lat: 33.749,  lng: -84.388,   bortle: 8 },
  { lat: 47.6062, lng: -122.3321, bortle: 8 },
  { lat: 39.7392, lng: -104.9903, bortle: 8 },
  { lat: 43.6532, lng: -79.3832,  bortle: 9 },
];

function getBortle(lat: number, lng: number): number {
  let pollution = 0;
  for (const c of CITY_POLLUTION) {
    const d = Math.sqrt((lat - c.lat) ** 2 + (lng - c.lng) ** 2);
    pollution += c.bortle * Math.exp(-d / 3.2);
  }
  return Math.max(1, Math.min(9, Math.round(1 + pollution)));
}

interface Insight {
  recommendation: string;
  targets: string[];
  astrophotographyTip: string;
  chevronStatus: string;
}

interface Location {
  name: string;
  lat: number;
  lng: number;
  bortle: number;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

export default function Page() {
  const [query, setQuery] = useState("");
  const [geocodeResults, setGeocodeResults] = useState<NominatimResult[]>([]);
  const [geocoding, setGeocoding] = useState(false);
  const [selected, setSelected] = useState<Location | null>(null);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(false);
  const [conditions, setConditions] = useState<ConditionsPayload | null>(null);
  const [conditionsError, setConditionsError] = useState(false);
  const [overlays, setOverlays] = useState<MapOverlays>({
    lightPollution: true,
    clouds: false,
    precipitation: false,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.length < 3) { setGeocodeResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      setGeocoding(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`,
          { headers: { "Accept-Language": "en" } }
        );
        setGeocodeResults(await res.json());
      } catch {
        setGeocodeResults([]);
      } finally {
        setGeocoding(false);
      }
    }, 400);
  }, [query]);

  async function selectLocation(loc: Location) {
    setSelected(loc);
    setQuery("");
    setGeocodeResults([]);
    setInsight(null);
    setConditions(null);
    setConditionsError(false);
    setLoading(true);

    let conditionsData: ConditionsPayload | null = null;
    try {
      const conditionsRes = await fetch("/api/conditions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: loc.lat, lon: loc.lng, bortle: loc.bortle }),
      });
      if (conditionsRes.ok) {
        const data: ConditionsPayload = await conditionsRes.json();
        conditionsData = data;
        setConditions(data);
        setOverlays(data.suggestedOverlays);
      } else {
        setConditionsError(true);
      }
    } catch {
      setConditionsError(true);
    }

    try {
      const w = conditionsData?.weather;
      const mn = conditionsData?.moon;
      const next12h = w?.forecast?.slice(0, 12) ?? [];
      const precipNext12hMm = next12h.length
        ? Math.max(0, ...next12h.map(h => h.precipitation))
        : null;

      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationName: loc.name,
          lat: loc.lat,
          lng: loc.lng,
          bortle: loc.bortle,
          // Full labeled conditions context for Grok
          cloudCover: w?.cloudCover ?? null,
          transparency: w?.transparency ?? null,
          precipitationNowMm: w?.forecast?.[0]?.precipitation ?? null,
          precipitationNext12hMm: precipNext12hMm,
          temperature: w?.temperature ?? null,
          humidity: w?.humidity ?? null,
          windSpeed: w?.windSpeed ?? null,
          moonIllum: mn ? Math.round(mn.illumination * 100) : null,
          moonPhase: mn?.phase ?? null,
          darkMinutes: mn?.darkMinutes ?? null,
          astronomicalDarkStart: mn?.astronomicalDarkStart ?? null,
          astronomicalDarkEnd: mn?.astronomicalDarkEnd ?? null,
          overallScore: conditionsData?.overallScore ?? null,
        }),
      });
      if (res.ok) setInsight(await res.json());
    } catch { /* leave null */ } finally {
      setLoading(false);
    }
  }

  function selectFromNominatim(r: NominatimResult) {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    selectLocation({
      name: r.display_name.split(",").slice(0, 2).join(",").trim(),
      lat, lng,
      bortle: getBortle(lat, lng),
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    if (geocodeResults.length > 0) { selectFromNominatim(geocodeResults[0]); return; }
    const match = query.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (match) {
      const lat = parseFloat(match[1]), lng = parseFloat(match[2]);
      selectLocation({ name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, lat, lng, bortle: getBortle(lat, lng) });
    }
  }

  const OVERLAY_META: Record<keyof MapOverlays, { label: string; dot: string }> = {
    lightPollution: { label: "light pollution", dot: "#f0a35a" },
    clouds: { label: "cloud cover", dot: "#c8d6f0" },
    precipitation: { label: "precipitation", dot: "#5fb6ff" },
  };

  function scoreColor(score: number): string {
    if (score >= 70) return "var(--good)";
    if (score >= 45) return "var(--warn)";
    return "var(--bad)";
  }

  return (
    <div className="min-h-screen font-mono text-[var(--text)] bg-[var(--bg)]">
      <div className="max-w-3xl mx-auto px-5 sm:px-6 py-10 sm:py-14 text-sm">

        <header className="mb-9 flex items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-[0.3em] uppercase">Chevron</h1>
            <p className="text-[11px] text-[var(--text-dim)] uppercase tracking-[0.2em]">
              Dark sky planning atlas
            </p>
          </div>
          <p className="hidden sm:block text-[10px] text-[var(--text-faint)] text-right leading-relaxed uppercase tracking-wider">
            Lorenz 2024 · Grok AI<br />OpenStreetMap
          </p>
        </header>

        {/* Search */}
        <section className="mb-8 space-y-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)]">Search any location</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="city, park, region or lat, lng"
              className="flex-1 rounded-md border border-[var(--border)] bg-[var(--panel)] px-3.5 py-2.5 text-xs outline-none placeholder-[var(--text-faint)] focus:border-[var(--accent)] transition-colors"
            />
            <button
              onClick={() => geocodeResults.length > 0 ? selectFromNominatim(geocodeResults[0]) : undefined}
              className="rounded-md border border-[var(--border-strong)] bg-[var(--panel-2)] px-4 py-2.5 text-xs uppercase tracking-wider hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
            >
              go
            </button>
          </div>
          {geocoding && <p className="text-xs text-[var(--text-faint)]">searching…</p>}
          {!geocoding && geocodeResults.length > 0 && (
            <ul className="rounded-md border border-[var(--border)] bg-[var(--panel)] overflow-hidden divide-y divide-[var(--border)]">
              {geocodeResults.map((r, i) => (
                <li key={i}>
                  <button
                    onClick={() => selectFromNominatim(r)}
                    className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-[var(--panel-2)] transition-colors"
                  >
                    {r.display_name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Featured sites */}
        {!selected && (
          <section className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)]">Featured dark sites</p>
            <ul className="grid sm:grid-cols-2 gap-2">
              {DARK_SPOTS.map(s => (
                <li key={s.name}>
                  <button
                    onClick={() => selectLocation(s)}
                    className="w-full flex items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--panel)] px-3.5 py-3 text-left text-xs hover:border-[var(--accent)] hover:bg-[var(--panel-2)] transition-colors"
                  >
                    <span>{s.name}</span>
                    <span className="shrink-0 text-[10px] text-[var(--text-faint)] uppercase tracking-wider">Bortle {s.bortle}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Selected location */}
        {selected && (
          <section className="space-y-6">
            <div className="flex justify-between items-start gap-4">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)]">Selected</p>
                <p className="text-base font-bold">{selected.name}</p>
                <p className="text-[var(--text-faint)] text-xs">
                  {selected.lat.toFixed(4)}°, {selected.lng.toFixed(4)}° · Bortle Class {selected.bortle}
                </p>
              </div>
              <button
                onClick={() => { setSelected(null); setInsight(null); setConditions(null); }}
                className="shrink-0 text-[11px] uppercase tracking-wider text-[var(--text-faint)] hover:text-[var(--text)] transition-colors"
              >
                clear
              </button>
            </div>

            {/* Map card */}
            <div className="rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--panel)]">
              <Map
                lat={selected.lat}
                lng={selected.lng}
                overlays={overlays}
                cloudGrid={conditions?.cloudGrid ?? null}
              />

              {/* Overlay controls */}
              <div className="px-4 py-3.5 border-t border-[var(--border)] space-y-3">
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(OVERLAY_META) as (keyof MapOverlays)[]).map(key => {
                    const active = overlays[key];
                    const meta = OVERLAY_META[key];
                    return (
                      <button
                        key={key}
                        onClick={() => setOverlays(prev => ({ ...prev, [key]: !prev[key] }))}
                        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-wider transition-colors ${
                          active
                            ? "border-[var(--border-strong)] bg-[var(--panel-2)] text-[var(--text)]"
                            : "border-[var(--border)] text-[var(--text-faint)] hover:text-[var(--text-dim)]"
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full transition-opacity"
                          style={{ background: meta.dot, opacity: active ? 1 : 0.25 }}
                        />
                        {meta.label}
                      </button>
                    );
                  })}
                </div>

                {/* Cloud legend */}
                {overlays.clouds && (
                  <div className="flex items-center gap-2 text-[9px] uppercase tracking-wider text-[var(--text-faint)]">
                    <span>clear</span>
                    <span
                      className="h-1.5 flex-1 max-w-[160px] rounded-full"
                      style={{ background: "linear-gradient(90deg, rgba(150,170,205,0), rgba(190,200,222,0.3), rgba(240,245,250,0.48))" }}
                    />
                    <span>overcast</span>
                  </div>
                )}

                {/* Status line */}
                {loading && !conditions && (
                  <p className="text-[10px] text-[var(--text-faint)]">loading weather overlays…</p>
                )}
                {conditionsError && (
                  <p className="text-[10px] text-[var(--bad)]">weather data unavailable — light pollution overlay only</p>
                )}
                {conditions && (
                  <p className="text-[10px] text-[var(--text-faint)]">
                    auto-enabled: {[
                      conditions.suggestedOverlays.clouds && "clouds",
                      conditions.suggestedOverlays.precipitation && "radar",
                    ].filter(Boolean).join(", ") || "clear skies — light pollution only"}
                  </p>
                )}
                <p className="text-[9px] text-[var(--text-faint)]">
                  © <a href="https://www.openstreetmap.org/copyright" className="underline hover:no-underline" target="_blank" rel="noreferrer">OpenStreetMap</a> · CARTO
                  {overlays.lightPollution && " · Lorenz 2024"}
                  {overlays.clouds && " · Open-Meteo"}
                  {overlays.precipitation && " · RainViewer"}
                </p>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: "Bortle",
                  value: String(selected.bortle),
                  sub: selected.bortle <= 2 ? "pristine" : selected.bortle <= 4 ? "rural" : selected.bortle <= 6 ? "suburban" : "urban",
                },
                {
                  label: "Clouds",
                  value: conditions ? `${Math.round(conditions.weather.cloudCover)}%` : "—",
                  sub: conditions?.weather.transparency.replace(/_/g, " ") ?? "loading",
                },
                {
                  label: "Moon",
                  value: conditions ? `${Math.round(conditions.moon.illumination * 100)}%` : "—",
                  sub: conditions?.moon.phase.toLowerCase() ?? "loading",
                },
                {
                  label: "Score",
                  value: conditions ? `${conditions.overallScore}` : "—",
                  sub: "observing window",
                  color: conditions ? scoreColor(conditions.overallScore) : undefined,
                },
              ].map(m => (
                <div key={m.label} className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-3.5 py-3 space-y-1">
                  <p className="text-[9px] uppercase tracking-[0.15em] text-[var(--text-faint)]">{m.label}</p>
                  <p className="text-2xl font-bold leading-none" style={m.color ? { color: m.color } : undefined}>{m.value}</p>
                  <p className="text-[10px] text-[var(--text-dim)] truncate">{m.sub}</p>
                </div>
              ))}
            </div>

            {conditions && (
              <p className="text-xs text-[var(--text-dim)] leading-relaxed rounded-md border border-[var(--border)] bg-[var(--panel)] px-4 py-3">
                {conditions.recommendation}
              </p>
            )}

            {/* AI insights */}
            <div className="space-y-4 pt-1">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)]">Grok insights</p>
              {loading && <p className="text-xs text-[var(--text-faint)]">loading…</p>}
              {!loading && !insight && <p className="text-xs text-[var(--text-faint)]">no insights loaded</p>}
              {insight && (
                <div className="space-y-4 text-xs rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.15em] text-[var(--text-faint)] mb-1">Status</p>
                    <p>{insight.chevronStatus}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.15em] text-[var(--text-faint)] mb-1">Recommendation</p>
                    <p className="leading-relaxed text-[var(--text-dim)]">{insight.recommendation}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.15em] text-[var(--text-faint)] mb-1">Targets</p>
                    <ul className="flex flex-wrap gap-1.5">
                      {insight.targets.map(t => (
                        <li key={t} className="rounded-full border border-[var(--border)] bg-[var(--panel-2)] px-2.5 py-1 text-[10px]">{t}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.15em] text-[var(--text-faint)] mb-1">Astrophotography tip</p>
                    <p className="leading-relaxed text-[var(--text-dim)]">{insight.astrophotographyTip}</p>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        <footer className="mt-16 pt-5 border-t border-[var(--border)] text-[10px] text-[var(--text-faint)] uppercase tracking-[0.15em]">
          Chevron · Lorenz Atlas 2024 · Grok AI
        </footer>
      </div>
    </div>
  );
}
