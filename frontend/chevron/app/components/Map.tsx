"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  cloudGridBounds,
  cloudGridToDataUrl,
  radarTileUrl,
  type RainViewerFrame,
} from "@/lib/cloudOverlay";
import { CloudGrid } from "@/types";
import { CLOUD_OVERLAY_ENABLED } from "@/lib/featureFlags";

export interface MapOverlays {
  lightPollution: boolean;
  clouds: boolean;
  precipitation: boolean;
}

// Below this zoom the cloud grid under-samples the (huge) viewport, so the
// overlay would be misleadingly coarse and inconsistent between zooms. Hide it.
const MIN_CLOUD_ZOOM = 6;

interface Props {
  /** Pin position; null = no marker. */
  marker: { lat: number; lng: number } | null;
  /** Bump `nonce` to recenter the map (search/featured picks). Map clicks don't. */
  focus: { lat: number; lng: number; zoom?: number; nonce: number } | null;
  /** Initial view when the map first loads. */
  initialView: { lat: number; lng: number; zoom: number };
  overlays: MapOverlays;
  /** Called when the user clicks the map to drop a pin. */
  onPick: (lat: number, lng: number) => void;
}

export default function Map({ marker, focus, initialView, overlays, onPick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const lpLayerRef = useRef<any>(null);
  const cloudLayerRef = useRef<any>(null);
  const radarLayerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const radarFrameRef = useRef<RainViewerFrame | null>(null);
  const cloudGridRef = useRef<CloudGrid | null>(null);
  const cloudFetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudReqId = useRef(0);
  const cloudsOnRef = useRef(overlays.clouds);
  const lastCloudKey = useRef<string>("");
  const [mapReady, setMapReady] = useState(false);
  const [cloudZoomedOut, setCloudZoomedOut] = useState(false);

  // Draw (or clear) the cloud overlay from whatever grid is currently cached.
  const drawCloudLayer = useCallback(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    if (cloudLayerRef.current) {
      map.removeLayer(cloudLayerRef.current);
      cloudLayerRef.current = null;
    }

    const grid = cloudGridRef.current;
    if (!cloudsOnRef.current || !grid || grid.points.length === 0) return;
    if (map.getZoom() < MIN_CLOUD_ZOOM) return;

    const dataUrl = cloudGridToDataUrl(grid);
    if (!dataUrl) return;

    const layer = L.imageOverlay(dataUrl, cloudGridBounds(grid), {
      opacity: 0.8,
      interactive: false,
      pane: "cloudPane",
      className: "cloud-overlay",
      attribution: "© Open-Meteo cloud forecast",
    });
    cloudLayerRef.current = layer;
    layer.addTo(map);
  }, []);

  // Fetch a cloud grid for the current viewport, then redraw. Debounced by caller.
  const fetchCloudGridForViewport = useCallback(async () => {
    const map = mapRef.current;
    if (!map || !cloudsOnRef.current) return;

    // Before the container is laid out, getSize().x can be 0, which collapses
    // the longitude span to a zero-width overlay. Retry once layout settles.
    const size = map.getSize();
    if (!size || size.x < 2 || size.y < 2) {
      map.invalidateSize();
      if (cloudFetchTimer.current) clearTimeout(cloudFetchTimer.current);
      cloudFetchTimer.current = setTimeout(() => fetchCloudGridForViewport(), 250);
      return;
    }

    // Too far out: the grid can't faithfully sample this area — hide rather than
    // show misleading data that disagrees with the zoomed-in view.
    if (map.getZoom() < MIN_CLOUD_ZOOM) {
      setCloudZoomedOut(true);
      cloudGridRef.current = null;
      lastCloudKey.current = "";
      drawCloudLayer();
      return;
    }
    setCloudZoomedOut(false);

    const b = map.getBounds();
    const bounds = {
      south: b.getSouth(),
      west: b.getWest(),
      north: b.getNorth(),
      east: b.getEast(),
    };

    // Dedup: skip if the viewport hasn't meaningfully changed since the last
    // fetch (e.g. setView + moveend firing back-to-back with identical bounds).
    const key = [bounds.south, bounds.west, bounds.north, bounds.east]
      .map(v => v.toFixed(2))
      .join(",");
    if (key === lastCloudKey.current && cloudGridRef.current) return;
    lastCloudKey.current = key;

    const reqId = ++cloudReqId.current;
    try {
      const res = await fetch("/api/cloudgrid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bounds }),
      });
      if (!res.ok) { lastCloudKey.current = ""; return; }
      const grid: CloudGrid = await res.json();
      // Ignore stale responses (user moved again before this resolved).
      if (reqId !== cloudReqId.current || !cloudsOnRef.current) return;
      cloudGridRef.current = grid;
      drawCloudLayer();
    } catch {
      /* clouds optional */
    }
  }, [drawCloudLayer]);

  const scheduleCloudFetch = useCallback(() => {
    if (cloudFetchTimer.current) clearTimeout(cloudFetchTimer.current);
    cloudFetchTimer.current = setTimeout(fetchCloudGridForViewport, 400);
  }, [fetchCloudGridForViewport]);

  const ensureRadarLayer = useCallback(() => {
    const L = leafletRef.current;
    if (!L || radarLayerRef.current || !radarFrameRef.current) return;

    const layer = L.tileLayer(radarTileUrl(radarFrameRef.current), {
      minZoom: 2,
      // RainViewer only serves real radar tiles up to z7; beyond that it returns
      // a "Zoom Level Not Supported" placeholder, so cap native zoom and let
      // Leaflet upscale the z7 tiles instead.
      maxNativeZoom: 7,
      maxZoom: 19,
      opacity: 0.7,
      pane: "radarPane",
      attribution: "© RainViewer",
    });
    radarLayerRef.current = layer;
    if (overlays.precipitation) layer.addTo(mapRef.current);
  }, [overlays.precipitation]);

  const syncOverlays = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    if (lpLayerRef.current) {
      if (overlays.lightPollution) {
        if (!map.hasLayer(lpLayerRef.current)) lpLayerRef.current.addTo(map);
      } else {
        map.removeLayer(lpLayerRef.current);
      }
    }

    ensureRadarLayer();
    if (radarLayerRef.current) {
      if (overlays.precipitation) {
        if (!map.hasLayer(radarLayerRef.current)) radarLayerRef.current.addTo(map);
      } else {
        map.removeLayer(radarLayerRef.current);
      }
    }

    cloudsOnRef.current = CLOUD_OVERLAY_ENABLED && overlays.clouds;
    if (cloudsOnRef.current) {
      // Draw whatever we have immediately; fetch fresh data for this viewport.
      drawCloudLayer();
      fetchCloudGridForViewport();
    } else {
      drawCloudLayer(); // removes the layer
    }
  }, [overlays, ensureRadarLayer, drawCloudLayer, fetchCloudGridForViewport]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let isMounted = true;

    import("leaflet").then(async L => {
      if (!isMounted || !containerRef.current) return;
      if ((containerRef.current as any)._leaflet_id) return;

      leafletRef.current = L;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
      }).setView([initialView.lat, initialView.lng], initialView.zoom);
      mapRef.current = map;

      // Click anywhere to drop a pin at that location.
      map.on("click", (e: any) => {
        onPickRef.current(e.latlng.lat, e.latlng.lng);
      });

      // Explicit panes so overlays stack predictably:
      // base tiles (200) < light pollution (350) < clouds (400) < radar (450).
      map.createPane("lpPane").style.zIndex = "350";
      map.createPane("cloudPane").style.zIndex = "400";
      map.createPane("radarPane").style.zIndex = "450";

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);

      const lpLayer = L.tileLayer(
        "https://djlorenz.github.io/astronomy/image_tiles/tiles2024/tile_{z}_{x}_{y}.png",
        {
          minZoom: 2,
          maxNativeZoom: 8,
          maxZoom: 19,
          tileSize: 1024,
          zoomOffset: -2,
          opacity: 0.6,
          pane: "lpPane",
          errorTileUrl:
            "https://djlorenz.github.io/astronomy/image_tiles/tiles2024/black.png",
          attribution: "© David Lorenz · Light Pollution Atlas 2024",
        }
      );
      lpLayerRef.current = lpLayer;

      // Re-sample clouds for the new viewport whenever the user stops moving.
      map.on("moveend", () => {
        if (cloudsOnRef.current) scheduleCloudFetch();
      });

      try {
        const radarRes = await fetch("/api/radar");
        if (radarRes.ok) {
          const radarData = await radarRes.json();
          if (radarData.available) radarFrameRef.current = radarData.frame;
        }
      } catch { /* radar optional */ }

      if (isMounted) setMapReady(true);
    });

    return () => {
      isMounted = false;
      setMapReady(false);
      if (cloudFetchTimer.current) clearTimeout(cloudFetchTimer.current);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        lpLayerRef.current = null;
        cloudLayerRef.current = null;
        radarLayerRef.current = null;
        leafletRef.current = null;
        radarFrameRef.current = null;
        cloudGridRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    syncOverlays();
  }, [mapReady, syncOverlays]);

  // Marker tracks the pinned location without moving the view.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !mapReady) return;
    if (markerRef.current) {
      map.removeLayer(markerRef.current);
      markerRef.current = null;
    }
    if (marker) {
      markerRef.current = L.marker([marker.lat, marker.lng]).addTo(map);
    }
  }, [marker, mapReady]);

  // Recenter only on explicit focus changes (search / featured picks).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !focus) return;
    map.setView([focus.lat, focus.lng], focus.zoom ?? map.getZoom());
  }, [focus, mapReady]);

  return (
    <>
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        crossOrigin=""
      />
      <div style={{ position: "relative", height: "100%", width: "100%" }}>
        <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
        {overlays.clouds && cloudZoomedOut && (
          <div
            style={{ zIndex: 500 }}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-[var(--border-strong)] bg-[var(--panel)]/90 px-3 py-1 text-[10px] uppercase tracking-wider text-[var(--text-dim)] pointer-events-none"
          >
            zoom in for cloud cover
          </div>
        )}
      </div>
    </>
  );
}