export type PaletteSlot = {
  name: string;
  hex: string;
};

export const PALETTE_SLOTS: PaletteSlot[] = [
  { name: 'skyTop', hex: '#AECDD6' },
  { name: 'sky', hex: '#BCD8E0' },
  { name: 'skyLow', hex: '#CFE0DF' },
  { name: 'cloud', hex: '#F3C4C9' },
  { name: 'cloudHi', hex: '#F8D7DA' },
  { name: 'mesa', hex: '#D4837A' },
  { name: 'mesaShade', hex: '#BC6A62' },
  { name: 'mesaHi', hex: '#E3A89C' },
  { name: 'farHills', hex: '#CFA199' },
  { name: 'sauropodBlue', hex: '#6F9FB0' },
  { name: 'sauropodBlueShade', hex: '#5A8597' },
  { name: 'sauropodPink', hex: '#E59AAE' },
  { name: 'stego', hex: '#C97A4A' },
  { name: 'stegoShade', hex: '#A85F36' },
  { name: 'greenDark', hex: '#2F4A32' },
  { name: 'greenDeep', hex: '#42613F' },
  { name: 'greenMid', hex: '#5E7A50' },
  { name: 'greenOlive', hex: '#7C8F5E' },
  { name: 'greenSage', hex: '#9AAE78' },
  { name: 'greenLight', hex: '#BCC79A' },
  { name: 'greenTeal', hex: '#3D6B63' },
  { name: 'pond', hex: '#9CC1BD' },
  { name: 'pondDeep', hex: '#7FA9A6' },
  { name: 'lotus', hex: '#E96F8E' },
  { name: 'flower', hex: '#E8849A' },
  { name: 'flowerCoral', hex: '#EA9A6E' },
  { name: 'trunk', hex: '#7A5A43' },
  { name: 'silhouette', hex: '#33414A' },
  { name: 'paper', hex: '#F6EFE2' },
  { name: 'ink', hex: '#3A2F2A' },
];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function nearestSlot(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  let best = PALETTE_SLOTS[0].name;
  let bestDist = Infinity;
  for (const slot of PALETTE_SLOTS) {
    const [sr, sg, sb] = hexToRgb(slot.hex);
    const dist = (r - sr) ** 2 + (g - sg) ** 2 + (b - sb) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = slot.name;
    }
  }
  return best;
}

export function normalizeHex(fill: string): string | null {
  const m = fill.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  if (m[1].length === 3) {
    const [a, b, c] = m[1];
    return `#${a}${a}${b}${b}${c}${c}`.toLowerCase();
  }
  return `#${m[1].toLowerCase()}`;
}
