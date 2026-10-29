import { Asset } from 'expo-asset';
import { useAudioPlayer, type AudioPlayer, type AudioPlayerOptions } from 'expo-audio';
import { useCallback, useLayoutEffect } from 'react';

type Loader = (live: () => boolean) => Promise<void>;
const loaders = new WeakMap<AudioPlayer, Loader>();
const sources = new Map<number, Promise<{ uri: string }>>();
function localSource(source: number): Promise<{ uri: string }> {
  let pending = sources.get(source);
  if (!pending) {
    const asset=Asset.fromModule(source);
    pending = asset.downloadAsync().then(() => ({ uri: asset.localUri ?? asset.uri }));
    sources.set(source, pending);
    void pending.catch(() => { if (sources.get(source) === pending) sources.delete(source); });
  }
  return pending;
}

/** Empty native players do not start 34 independent SDK download effects.
 * The battle preparation queue explicitly resolves a local file before replace. */
export function useQueuedAudioPlayer(source: number, options: AudioPlayerOptions): AudioPlayer {
  const player = useAudioPlayer(null, { ...options, downloadFirst: false });
  const load = useCallback(async (live: () => boolean) => {
    const local = await localSource(source);
    if (live()) player.replace(local);
  }, [player, source]);
  useLayoutEffect(() => {
    loaders.set(player, load);
    return () => { loaders.delete(player); };
  }, [player, load]);
  return player;
}

export function loadQueuedAudioPlayer(player: AudioPlayer, live: () => boolean): Promise<void> {
  const load = loaders.get(player);
  return load ? load(live) : Promise.reject(new Error('No se registró el recurso del reproductor.'));
}
