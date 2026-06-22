import { NextRequest, NextResponse } from "next/server";

const XAI_API_URL = "https://api.x.ai/v1/chat/completions";

// Bortle class → human description + approximate SQM (mag/arcsec²) range, so Grok
// can interpret the light-pollution number against the same scale shown in the UI.
const BORTLE_LEGEND: Record<number, string> = {
  1: "Class 1 — excellent dark sky (SQM ~21.7–22.0): Milky Way casts shadows, zodiacal light & gegenschein vivid",
  2: "Class 2 — truly dark (SQM ~21.5–21.7): Milky Way highly structured, faint glows on horizon",
  3: "Class 3 — rural (SQM ~21.3–21.5): light domes visible low on the horizon",
  4: "Class 4 — rural/suburban transition (SQM ~20.4–21.3): Milky Way still impressive overhead",
  5: "Class 5 — suburban (SQM ~19.1–20.4): Milky Way washed out near the horizon",
  6: "Class 6 — bright suburban (SQM ~18.4–19.1): Milky Way only visible near zenith",
  7: "Class 7 — suburban/urban transition (SQM ~18.0–18.4): sky has a grayish-white glow",
  8: "Class 8 — city (SQM ~17–18): only bright star clusters and a few constellations visible",
  9: "Class 9 — inner city (SQM <17): only the Moon, planets and brightest stars are visible",
};

function num(v: unknown): string {
  return typeof v === "number" && Number.isFinite(v) ? String(Math.round(v * 10) / 10) : "unknown";
}

function fmtTime(iso: unknown): string {
  if (typeof iso !== "string") return "unknown";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "unknown"
    : d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      locationName,
      lat,
      lng,
      bortle,
      cloudCover,
      transparency,
      precipitationNowMm,
      precipitationNext12hMm,
      temperature,
      humidity,
      windSpeed,
      moonIllum,
      moonPhase,
      darkMinutes,
      astronomicalDarkStart,
      astronomicalDarkEnd,
      overallScore,
    } = body;

    const place = locationName || `Custom coordinates (${num(lat)}, ${num(lng)})`;
    const bortleClass = Number(bortle);
    const bortleLine =
      BORTLE_LEGEND[bortleClass] ?? `Class ${bortle} (1 = pristine dark sky, 9 = inner-city sky)`;
    const darkHours =
      typeof darkMinutes === "number" ? (darkMinutes / 60).toFixed(1) : "unknown";

    const prompt = `You are advising on stargazing and astrophotography for a specific location. Always refer to the location by name — "${place}" — in both the status and the recommendation. Do not use vague phrasing like "this site".

LOCATION
- Name: ${place}
- Coordinates: ${num(lat)}, ${num(lng)}

LIGHT POLLUTION (David Lorenz 2024 atlas)
- Bortle rating: ${bortleLine}
- Scale: Bortle 1 (darkest) → 9 (brightest); lower is better. SQM is sky brightness in mag/arcsec², higher = darker.

CLOUD COVER (Open-Meteo)
- Current cloud cover: ${num(cloudCover)}% → transparency "${transparency ?? "unknown"}"
- Scale: 0–10% excellent · 11–25% above average · 26–50% average · 51–75% below average · 76–100% poor/overcast. Lower is better.

PRECIPITATION (Open-Meteo)
- Now: ${num(precipitationNowMm)} mm · Max over next 12 h: ${num(precipitationNext12hMm)} mm
- Scale (mm/h): 0 dry · 0.1–2.5 light · 2.6–7.5 moderate · >7.5 heavy. Any precipitation generally precludes imaging.

MOON
- Illumination: ${num(moonIllum)}% (phase: ${moonPhase ?? "unknown"})
- Scale: 0% new (best for deep-sky) → 100% full (strong skyglow). <25% favorable, >50% limits faint targets.

ASTRONOMICAL DARKNESS
- True dark window: ${darkHours} h (${fmtTime(astronomicalDarkStart)} → ${fmtTime(astronomicalDarkEnd)})
- This is time the Sun is >18° below the horizon; more is better.

OTHER CONDITIONS
- Temperature: ${num(temperature)}°C · Humidity: ${num(humidity)}% · Wind: ${num(windSpeed)} km/h

OVERALL OBSERVING SCORE
- ${num(overallScore)} / 100 (higher = better; combines cloud, moon, darkness and light pollution).

Using ALL of the above, generate stargazing targets realistically visible given these specific conditions (e.g. Milky Way core, deep-sky nebulae, galaxies, constellations, planets), concrete astrophotography guidance, and a brief professional status statement on the observation window. Tone: professional, scientific, objective, clear — no sci-fi or dramatic language.

Respond with valid JSON only, in this exact shape:
{
  "recommendation": "2-3 sentence recommendation that names ${place}",
  "targets": ["target1", "target2", "target3", "target4"],
  "astrophotographyTip": "exposure or gear tip tuned to the conditions above",
  "chevronStatus": "brief status statement that names ${place}"
}`;

    const response = await fetch(XAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "grok-4.3",
        messages: [
          {
            role: "system",
            content:
              "You are a professional astronomical consultant. Analyze the provided, scale-annotated sky and weather data and return precise, minimalist, scientifically accurate recommendations. Always name the specific location in your prose. Always respond with valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`xAI API error: ${response.status}`);
    }

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error("No content returned from Grok API");
    }

    const data = JSON.parse(text);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Grok Insights Error:", error);
    return NextResponse.json({
      recommendation: "Skies can reveal incredible cosmic gems. Ensure your lens is focused to infinity and your eyes have adapted to the dark.",
      targets: ["Milky Way arch", "Polaris alignment", "Summer Triangle", "Andromeda Galaxy"],
      astrophotographyTip: "Use the 500-rule (500 divided by focal length) to determine your maximum exposure time before star trails form.",
      chevronStatus: "Observation parameters loaded successfully."
    }, { status: 200 });
  }
}
