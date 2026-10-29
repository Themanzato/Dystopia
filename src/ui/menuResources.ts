import { assetDeadline } from './assetDeadline';
import { Platform } from 'react-native';
import { prepareImage } from './prepareImage';
import { loadSharedImage } from './sharedImages';
import { UI_ASSETS } from './uiAssets';
import { MENU_ASSETS } from './menuAssets';
import { PIXEL_FONT_SOURCE } from './pixelFontAsset';
import { TITLE_LETTERS } from './titleAssets';
import { LOADING_ENTITIES } from './loadingCatalog';
import { PLAGUE_PORTRAITS } from './plaguePortraits';

const gallery = [...LOADING_ENTITIES, ...PLAGUE_PORTRAITS].map(entity => entity.source);
const ui = [...Object.values(UI_ASSETS), PIXEL_FONT_SOURCE];
const title = TITLE_LETTERS.map(letter => letter.source);
const prefetched = new Map<number, Promise<void>>();
let prepared = false;
let pending: Promise<void> | null = null;
export const isMenuPrepared = () => prepared;

function prefetch(source: number): Promise<void> {
  const cached = prefetched.get(source);
  if (cached) return cached;
  const request = assetDeadline(expired => prepareImage(source, expired));
  prefetched.set(source, request);
  void request.catch(() => { if (prefetched.get(source) === request) prefetched.delete(source); });
  return request;
}

// Prepare only the finite menu/gallery manifest, not the game actor library.
// Six workers avoid a download/decode storm on lower-powered phones.
export function prepareMenu(): Promise<void> {
  if (pending) return pending;
  const native = Platform.OS !== 'web';
  const decoded = [...new Set([...Object.values(MENU_ASSETS), ...(native ? [...ui, ...gallery] : [])])];
  const displayed = [...new Set([...title, ...(native ? [] : [...ui, ...gallery])])];
  const labels = new Map<number,string>([
    ...Object.entries(MENU_ASSETS).map(([key,source]):[number,string]=>[source,`fondo/${key === 'npc' ? 'enemigos' : key}`]),
    ...Object.entries(UI_ASSETS).map(([key,source]):[number,string]=>[source,`UI/${key}`]),
    ...LOADING_ENTITIES.map((entity):[number,string]=>[entity.source,`galería/${entity.id}`]),
    ...PLAGUE_PORTRAITS.map((entity):[number,string]=>[entity.source,`galería/${entity.id}`]),
    ...TITLE_LETTERS.map((letter):[number,string]=>[letter.source,`título/${letter.character}`]),
    [PIXEL_FONT_SOURCE,'tipografía'],
  ]);
  const jobs = [...decoded.map(source => ({ source, run: () => loadSharedImage(source) })), ...displayed.map(source => ({ source, run: () => prefetch(source) }))];
  let cursor = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && cursor < jobs.length) {
      const job=jobs[cursor++];
      try { await job.run(); } catch (error) {
        failed = true;
        throw new Error(`${labels.get(job.source) ?? 'imagen'}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  };
  pending = Promise.all(Array.from({ length: Math.min(6, jobs.length) }, worker)).then(() => { prepared = true; });
  const attempt = pending;
  void attempt.catch(() => { if (pending === attempt) pending = null; });
  return attempt;
}
