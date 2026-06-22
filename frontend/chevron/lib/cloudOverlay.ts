import { CloudGrid } from '@/types';

/**
 * Maps a cloud-cover fraction (0..1) to an RGBA tuple tuned for a dark basemap.
 * Thin cloud reads as a faint cool haze; thick cloud as a soft, brighter white.
 * Alpha stays well below opaque so the map underneath remains legible.
 */
function cloudRGBA(c: number): [number, number, number, number] {
  // Clear sky (<~12%) stays fully transparent; the veil ramps up gently so even
  // full overcast keeps the light-pollution map readable underneath.
  const t = Math.min(1, Math.max(0, (c - 0.12) / 0.88));
  const eased = Math.pow(t, 0.9);

  // Cool slate-blue (thin) → soft white (thick).
  const r = Math.round(150 + eased * 90);
  const g = Math.round(170 + eased * 75);
  const b = Math.round(205 + eased * 45);
  const alpha = Math.round(eased * 122); // 0..122 (~0.48 max, before layer opacity)

  return [r, g, b, alpha];
}

/**
 * Renders a coarse cloud-cover grid into a smooth raster using bilinear
 * interpolation, so the 3×3 sample grid reads as a continuous haze rather than
 * a checkerboard of hard-edged cells.
 *
 * The source grid is ordered south→north (row 0 = southernmost). Leaflet draws
 * the image top edge at the north bound, so rows are sampled flipped vertically.
 */
export function cloudGridToDataUrl(grid: CloudGrid, resolution = 256): string {
  const steps = Math.round(Math.sqrt(grid.points.length));
  if (steps < 1) return '';

  const canvas = document.createElement('canvas');
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const coverAt = (row: number, col: number): number =>
    grid.points[row * steps + col]?.cloudCover ?? 0;

  // Single sample → flat fill, no interpolation possible.
  if (steps === 1) {
    const [r, g, b, a] = cloudRGBA(coverAt(0, 0) / 100);
    ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
    ctx.fillRect(0, 0, resolution, resolution);
    return canvas.toDataURL('image/png');
  }

  const img = ctx.createImageData(resolution, resolution);
  const data = img.data;
  const last = steps - 1;

  for (let py = 0; py < resolution; py++) {
    // Flip vertically: image top (py=0) = northernmost row (last).
    const gy = (1 - py / (resolution - 1)) * last;
    const y0 = Math.floor(gy);
    const y1 = Math.min(last, y0 + 1);
    const fy = gy - y0;

    for (let px = 0; px < resolution; px++) {
      const gx = (px / (resolution - 1)) * last;
      const x0 = Math.floor(gx);
      const x1 = Math.min(last, x0 + 1);
      const fx = gx - x0;

      const top = coverAt(y0, x0) + (coverAt(y0, x1) - coverAt(y0, x0)) * fx;
      const bot = coverAt(y1, x0) + (coverAt(y1, x1) - coverAt(y1, x0)) * fx;
      const cover = (top + (bot - top) * fy) / 100;

      const [r, g, b, a] = cloudRGBA(cover);
      const idx = (py * resolution + px) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = a;
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

export function cloudGridBounds(grid: CloudGrid): [[number, number], [number, number]] {
  const half = grid.spanDeg / 2;
  return [
    [grid.center.lat - half, grid.center.lon - half],
    [grid.center.lat + half, grid.center.lon + half],
  ];
}

export interface RainViewerFrame {
  host: string;
  path: string;
}

export async function fetchLatestRadarFrame(): Promise<RainViewerFrame | null> {
  try {
    const res = await fetch('https://api.rainviewer.com/public/weather-maps.json', {
      next: { revalidate: 600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const past = data?.radar?.past;
    if (!Array.isArray(past) || past.length === 0) return null;
    const latest = past[past.length - 1];
    return { host: data.host, path: latest.path };
  } catch {
    return null;
  }
}

export function radarTileUrl(frame: RainViewerFrame): string {
  // color scheme 4 (Universal Blue) on a transparent smoothed background reads
  // well over the dark basemap; "1_1" = smooth + show snow.
  return `${frame.host}${frame.path}/256/{z}/{x}/{y}/4/1_1.png`;
}
