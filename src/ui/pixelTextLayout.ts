import { PIXEL_GLYPHS } from './pixelGlyphs';

export type PixelGlyph = { character: string; index: number; x: number; y: number; width: number; height: number;
  source: { x: number; y: number; width: number; height: number } };
export type PixelLayout = { glyphs: PixelGlyph[]; width: number; height: number; scale: number; lines: number };
export const PIXEL_LINE_HEIGHT = 26;
const TRACKING = 2;
export function normalizePixelText(text: string): string {
  return text.normalize('NFC').toUpperCase().replace(/[\u2013\u2014]/g, '-').replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"').replace(/\u2026/g, '...');
}
export function pixelSource(character: string) {
  return PIXEL_GLYPHS[character as keyof typeof PIXEL_GLYPHS] ?? PIXEL_GLYPHS['?'];
}
function measure(text: string): number {
  return Array.from(text).reduce((total, character, index) => total + pixelSource(character).width + (index ? TRACKING : 0), 0);
}
/** Stable word wrapping in source pixels. No measuring native fonts or per-frame layout. */
export function layoutPixelText(text: string, size = 18, maxWidth?: number, align: 'left' | 'center' = 'left'): PixelLayout {
  const requestedScale = Math.max(1, Number.isFinite(size) ? size : 18) / 18;
  const limit = maxWidth !== undefined && Number.isFinite(maxWidth) && maxWidth > 0 ? maxWidth : undefined;
  const scale = limit === undefined ? requestedScale : Math.min(requestedScale, limit / 15);
  const columns = limit === undefined ? Infinity : limit / scale;
  const lines: string[] = [];
  for (const paragraph of normalizePixelText(text).split('\n')) {
    let line = '';
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate) <= columns) { line = candidate; continue; }
      if (line) { lines.push(line); line = ''; }
      for (const character of word) {
        if (line && measure(line + character) > columns) { lines.push(line); line = ''; }
        line += character;
      }
    }
    lines.push(line);
  }
  const width = limit ?? Math.max(0, ...lines.map(measure)) * scale;
  const glyphs: PixelGlyph[] = [];
  let index = 0;
  lines.forEach((line, row) => {
    let x = align === 'center' ? (width / scale - measure(line)) / 2 : 0;
    for (const character of line) {
      const source = pixelSource(character);
      if (character !== ' ') glyphs.push({ character, index: index++, x: x * scale, y: row * PIXEL_LINE_HEIGHT * scale,
        width: source.width * scale, height: source.height * scale, source });
      x += source.width + TRACKING;
    }
  });
  return { glyphs, width, height: Math.max(1, lines.length) * PIXEL_LINE_HEIGHT * scale, scale, lines: lines.length };
}
/** At most two individual faulty letters; the rest of the advice stays readable. */
export function pixelFlickerIndices(text: string, count: number): number[] {
  if (count < 4) return [];
  let hash = 0;
  for (const character of text) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0;
  const first = hash % count;
  const second = (first + Math.max(2, Math.floor(count * 0.57))) % count;
  return first === second ? [first] : [first, second];
}
