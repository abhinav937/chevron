"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  cloudGridBounds,
  cloudGridToDataUrl,
  radarTileUrl,
  type RainViewerFrame,
} from "@/lib/cloudOverlay";
import { CloudGrid } from "@/types";

export interface MapOverlays {
  lightPollution: boolean;
  clouds: boolean;
  precipitation: boolean;
}

interface Props {
  lat: number;
  lng: number;
  overlays: MapOverlays;
  cloudGrid: CloudGrid | null;
}

export default function Map({ lat, lng, overlays, cloudGrid }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const lpLayerRef = useRef<any>(null);
  const cloudLayerRef = useRef<any>(null);
  const radarLayerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const radarFrameRef = useRef<RainViewerFrame | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const syncCloudLayer = useCallback(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    if (cloudLayerRef.current) {
      map.removeLayer(cloudLayerRef.current);
      cloudLayerRef.current = null;
    }

    if (!overlays.clouds || !cloudGrid || cloudGrid.points.length === 0) return;

    const dataUrl = cloudGridToDataUrl(cloudGrid);
    if (!dataUrl) return;

    const layer = L.imageOverlay(dataUrl, cloudGridBounds(cloudGrid), {
      opacity: 0.8,
      interactive: false,
      pane: "cloudPane",
      className: "cloud-overlay",
      attribution: "© Open-Meteo cloud forecast",
    });
    cloudLayerRef.current = layer;
    layer.addTo(map);
    layer.bringToFront();
  }, [overlays.clouds, cloudGrid]);

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

    syncCloudLayer();
  }, [overlays, ensureRadarLayer, syncCloudLayer]);

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
      }).setView([lat, lng], 8);
      mapRef.current = map;

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
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        lpLayerRef.current = null;
        cloudLayerRef.current = null;
        radarLayerRef.current = null;
        leafletRef.current = null;
        radarFrameRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    syncOverlays();
  }, [mapReady, syncOverlays]);

  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then(L => {
      mapRef.current.setView([lat, lng], 8);
      mapRef.current.eachLayer((layer: any) => {
        if (layer instanceof L.Marker) mapRef.current.removeLayer(layer);
      });
      L.marker([lat, lng]).addTo(mapRef.current);
    });
  }, [lat, lng, mapReady]);

  return (
    <>
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        crossOrigin=""
      />
      <div ref={containerRef} style={{ height: "460px", width: "100%" }} />
    </>
  );
}