/**
 * Colors for user-picked swatches (labels, team members). FROZEN: main session only.
 *
 * DESIGN §6.2 asks for "12 % tint background + full-strength text", but several palette colors
 * (amber, orange, teal) fail WCAG AA as text on their own tint. `swatchColors` keeps the hue and
 * darkens the text just enough to reach 4.5:1.
 */

type Rgb = [number, number, number];

function parseHex(hex: string): Rgb {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m?.[1]) throw new Error(`Invalid hex color: ${hex}`);
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

function mix(a: Rgb, b: Rgb, amountOfA: number): Rgb {
  return [0, 1, 2].map((i) => a[i]! * amountOfA + b[i]! * (1 - amountOfA)) as Rgb;
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [la, lb] = [luminance(parseHex(a)), luminance(parseHex(b))];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];

/** Tint background (12 % over white), AA-readable text in the same hue, and the raw color. */
export function swatchColors(hex: string, minContrast = 4.5) {
  const base = parseHex(hex);
  const background = toHex(mix(base, WHITE, 0.12));
  let text = toHex(base);
  for (let keep = 1; contrastRatio(text, background) < minContrast && keep > 0; keep -= 0.02) {
    text = toHex(mix(base, BLACK, keep));
  }
  return { solid: toHex(base), background, text };
}
