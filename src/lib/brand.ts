/**
 * Branding configuration.
 *
 * The official HPAD logo has not been supplied yet. When it is:
 *   1. Put the original file in /public/brand/ (e.g. /public/brand/hpad-logo.svg)
 *   2. Set `logoSrc` (and `logoLightSrc` if there is a white version for the sidebar)
 *   3. Set the intrinsic width/height so the logo keeps its proportions.
 * Until then a plain text wordmark is shown — no logo is invented.
 */
export const BRAND = {
  name: "HPAD",
  studioName: "Hiren Patel Architects and Design",
  tagline: "First, a drawing. Then, a place to live.",
  appName: "HPAD Travel",
  fullTitle: "HPAD · Digital Travel Form | Flight & Site Visit Outside Ahmedabad",
  logoSrc: "/brand/hpad-mark.svg" as string | null, // official vector mark from hpad.co.in
  logoLightSrc: "/brand/hpad-logo-white.png" as string | null,
  logoWidth: 134,
  logoHeight: 62,
  homeCity: "Ahmedabad",
  timeZone: "Asia/Kolkata",
};
