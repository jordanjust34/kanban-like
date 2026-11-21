import { describe, expect, it } from 'vitest';
import { SWATCHES } from './domain';
import { contrastRatio, swatchColors } from './swatch';

describe('swatchColors', () => {
  it('gives every palette color AA-contrast text on its tint', () => {
    for (const hex of SWATCHES) {
      const { background, text } = swatchColors(hex);
      expect({ hex, ratio: contrastRatio(text, background) >= 4.5 }).toEqual({ hex, ratio: true });
    }
  });

  it('keeps already-dark colors unchanged', () => {
    expect(swatchColors('#1F2A5A').text).toBe('#1f2a5a');
  });

  it('rejects invalid input', () => {
    expect(() => swatchColors('blue')).toThrow('Invalid hex color');
  });
});
