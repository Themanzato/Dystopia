// Each PNG is an individual transparent glyph, extracted at integer 3x scale
// from the original UI pack. See scripts/create-title-letters.py for provenance.
export const TITLE_HEIGHT = 54;
export const TITLE_GAP = 9;
export const TITLE_CYCLE_MS = 18000;
export const TITLE_LETTERS = [
  { character: 'D', source: require('../../assets/title/letters/D.png'), width: 27 },
  { character: 'Y', source: require('../../assets/title/letters/Y.png'), width: 27 },
  { character: 'S', source: require('../../assets/title/letters/S.png'), width: 27 },
  { character: 'T', source: require('../../assets/title/letters/T.png'), width: 27 },
  { character: 'O', source: require('../../assets/title/letters/O.png'), width: 27 },
  { character: 'P', source: require('../../assets/title/letters/P.png'), width: 27 },
  { character: 'I', source: require('../../assets/title/letters/I.png'), width: 9 },
  { character: 'A', source: require('../../assets/title/letters/A.png'), width: 33 },
] as const;
export const TITLE_WIDTH = TITLE_LETTERS.reduce((total, letter) => total + letter.width, 0) + TITLE_GAP * (TITLE_LETTERS.length - 1);
