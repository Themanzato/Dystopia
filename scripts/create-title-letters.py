"""Derive DYSTOPIA glyph PNGs from the original UI lettering, without modifying it.
Requires Pillow only when regenerating; generated PNGs are checked in.
The pack lacks Y: its fork is the top nine rows of X, its stem the bottom
nine rows of I. Both preserve the pack's original three-pixel stroke.
"""
from pathlib import Path
import sys
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/assets/UI/UI - Words/Words without BG'
OUTPUT = ROOT / 'assets/title/letters'
GLYPHS = {'D': (6, 44, 9), 'S': (4, 10, 9), 'T': (1, 41, 9),
          'O': (1, 19, 9), 'P': (9, 23, 9), 'I': (1, 51, 3), 'A': (2, 56, 11)}

def crop(word, x, width):
    return Image.open(SOURCE / f'UI - Words{word}.png').convert('RGBA').crop((x, 7, x + width, 25))

def rgba_palette(image):
    pixels = image.tobytes()
    return {pixels[i:i + 4] for i in range(0, len(pixels), 4)}

def main():
    check = '--check' in sys.argv
    if not check:
        OUTPUT.mkdir(parents=True, exist_ok=True)
    glyphs = {letter: crop(*region) for letter, region in GLYPHS.items()}
    y = Image.new('RGBA', (9, 18))
    y.paste(crop(14, 38, 9).crop((0, 0, 9, 9)), (0, 0))
    y.paste(glyphs['I'].crop((0, 9, 3, 18)), (3, 9))
    glyphs['Y'] = y
    for letter in 'DYSTOPIA':
        original = glyphs[letter]
        palette = rgba_palette(original)
        for density in (1, 2, 3):
            scale = 3 * density
            expected = original.resize((original.width * scale, 18 * scale), Image.Resampling.NEAREST)
            suffix = '' if density == 1 else f'@{density}x'
            target = OUTPUT / f'{letter}{suffix}.png'
            if check:
                actual = Image.open(target).convert('RGBA')
                assert actual.size == expected.size and actual.tobytes() == expected.tobytes(), f'{letter}{suffix}: glyph differs from original UI pixels'
                assert rgba_palette(actual) == palette, f'{letter}{suffix}: RGBA palette changed'
                assert actual.getchannel('A').getextrema() == original.getchannel('A').getextrema(), f'{letter}{suffix}: transparency changed'
            else:
                expected.save(target)
    print('Verified 24 glyph PNGs: original pixels, RGBA palette, transparency and integer 3x/6x/9x scales.' if check else 'Generated eight title glyphs at 1x, 2x and 3x device densities from existing UI art.')

if __name__ == '__main__':
    main()
