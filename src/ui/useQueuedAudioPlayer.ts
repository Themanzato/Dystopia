import { Asset } from 'expo-asset';
import { useAudioPlayer, type AudioPlayer, type AudioPlayerOptions } from 'expo-audio';
import { useCallback, useLayoutEffect } from 'react';

type Loader = (live: () => boolean) => Promise<void>;
const loaders = new WeakMap<AudioPlayer, Loader>();

/** Empty native players do not start 34 independent SDK download effects.
 * The battle preparation queue explicitly resolves a local file before replace. */
export function useQueuedAudioPlayer(source: number, options: AudioPlayerOptions): AudioPlayer {
  const player = useAudioPlayer(null, { ...options, downloadFirst: false });
  const load = useCallback(async (live: () => boolean) => {
    const asset = Asset.fromModule(source);
    await asset.downloadAsync();
    if (live()) player.replace({ uri: asset.localUri ?? asset.uri });
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
