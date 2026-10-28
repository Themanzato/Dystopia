import { prepareImage } from './prepareImage';
import { assetDeadline } from './assetDeadline';

export const PIXEL_FONT_SOURCE = require('../../assets/ui/font/ui-alphabet.png');
let prepared: Promise<void> | null = null;
/** One download/decode request for every glyph and every loading screen. */
export function preloadPixelFont(): Promise<void> {
  if (!prepared) {
    prepared = assetDeadline(expired => prepareImage(PIXEL_FONT_SOURCE, expired)).catch(error => { prepared = null; throw error; });
  }
  return prepared;
}
