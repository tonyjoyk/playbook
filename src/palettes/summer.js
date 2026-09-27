// Warm-summer prehistoric palette (dusty / muted / matte). Hex values from the
// design spec. Helper functions give controlled tonal variation per mass.

export const summer = {
  skyTop: "#AECDD6",
  sky: "#BCD8E0",
  skyLow: "#CFE0DF",
  cloud: "#F3C4C9",
  cloudHi: "#F8D7DA",
  mesa: "#D4837A",
  mesaShade: "#BC6A62",
  mesaHi: "#E3A89C",
  farHills: "#CFA199",
  sauropodBlue: "#6F9FB0",
  sauropodBlueShade: "#5A8597",
  sauropodSpot: "#5A8597",
  sauropodPink: "#E59AAE",
  sauropodPinkShade: "#CE7E96",
  stego: "#C97A4A",
  stegoShade: "#A85F36",
  stegoPlate: "#E0A06A",
  // Dusty, desaturated 6-value green ramp (dark -> light) + a teal accent.
  greenDark: "#2F4A32",
  greenDeep: "#42613F",
  greenMid: "#5E7A50",
  greenOlive: "#7C8F5E",
  greenSage: "#9AAE78",
  greenLight: "#BCC79A",
  greenTeal: "#3D6B63",
  pond: "#9CC1BD",
  pondDeep: "#7FA9A6",
  lotus: "#E96F8E",
  lotusLight: "#F2A7B8",
  flower: "#E8849A",
  flowerCoral: "#EA9A6E",
  trunk: "#7A5A43",
  trunkShade: "#5E4533",
  silhouette: "#33414A",
  paper: "#F6EFE2",
  ink: "#3A2F2A",
  childSkinA: "#8A5A3C",
  childSkinB: "#C98D63",
  childHair: "#2B2320",
  childShirt: "#E8E2D2",
  childStripe: "#C9603F",
  childDress: "#E59AAE",
};

// Shift a hex color lighter/darker by amount (-1..1). Keeps it matte (no gradients).
export function tone(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const adj = (c) =>
    amount >= 0
      ? Math.round(c + (255 - c) * amount)
      : Math.round(c * (1 + amount));
  r = Math.max(0, Math.min(255, adj(r)));
  g = Math.max(0, Math.min(255, adj(g)));
  b = Math.max(0, Math.min(255, adj(b)));
  return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
}
