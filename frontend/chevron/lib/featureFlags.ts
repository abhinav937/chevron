// Feature flags for the Chevron frontend.
//
// CLOUD_OVERLAY_ENABLED — the viewport-following cloud-cover map overlay
// (Open-Meteo grid). Disabled for now: Open-Meteo's free tier can't sustain the
// per-viewport sampling, and the overlay is only faithful at higher zooms. The
// cloud-cover *number* in the metrics and the score are unaffected. Flip to true
// to bring the overlay (toggle, legend, fetching) back.
export const CLOUD_OVERLAY_ENABLED = false;
