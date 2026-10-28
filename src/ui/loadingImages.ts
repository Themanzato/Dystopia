import { LOADING_ENTITIES } from './loadingCatalog';
import { LOADING_BANNER } from './loadingArt';
import { loadSharedImage, useSharedImageState } from './sharedImages';

const sources = new Set([...LOADING_ENTITIES.map(entity => entity.source), LOADING_BANNER]);
export function useLoadingImage(source: number) {
  return useSharedImageState(source, sources.has(source));
}
// Preloading and portraits reuse the same decoded image as every later mount.
export async function preloadLoadingImages(source: number): Promise<void> {
  if (!sources.has(source)) throw new Error('Unknown loading-gallery asset');
  await Promise.all([loadSharedImage(source), loadSharedImage(LOADING_BANNER)]);
}
