# UI pixel alphabet

`ui-alphabet.png` is a 128 x 208 transparent atlas derived from the existing UI pack. It contains 60 glyphs and no downloaded font or new source art. Rebuild with `scripts/create-pixel-font.py`; verify with `--check`.

Twenty-one uppercase letters are exact crops of `assets/assets/UI/UI - Words/Words without BG/UI - Words*.png`, rows 7-24. Their original transparency, white/grey worn texture and proportions remain intact. The crop map is in the script. The original title's Y construction is reused: the upper nine rows of X and lower nine rows of I.

The pack does not contain a complete alphabet. F is E without its lower arm; H uses I stems and T's bar; J uses U's curve and right stem; Z uses T's bars and I's diagonal steps. Digits, punctuation and Spanish accent marks use those same original strokes and sampled white/grey palette. No original asset is modified. Accents have six reserved pixels above the original 18-pixel caps.

`PixelText` lays out complete words in source pixels, wraps long names and retains the original text as its accessibility label. Native rendering caches a nearest-sampled raster at physical device resolution; up to two individual letters have independent opacity overlays. Web rendering clips the one shared atlas with pixelated sampling and never allocates a Skia canvas per letter. `preloadPixelFont` shares one asset/decode promise across screens and retries failed preparation. Animation stops on unmount, background or when inactive.
