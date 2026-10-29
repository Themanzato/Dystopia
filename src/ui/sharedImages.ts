import { assetDeadline } from './assetDeadline';
import { useEffect, useMemo, useState } from 'react';
import { Asset } from 'expo-asset';
import { Skia, type SkImage } from '@shopify/react-native-skia';

// One decoded image per bundled source, shared by menu, preloads and gameplay.
// Finite audited manifests own these resources across runs; run cleanup must
// never dispose a texture that a loading card or another screen still uses.
const pending = new Map<number, Promise<SkImage>>();
const decoded = new Map<number, SkImage>();
type ImageState = { request: object; image: SkImage | null; error: boolean };

// Skia Android calls Resources.getIdentifier(), accepting drawable names or
// decimal IDs. Fresco's res:/ prefix is not a URL scheme supported by Skia.
export function skiaResourceUri(uri: string): string {
  return uri.replace(/^res:\/+([0-9]+)$/, '$1');
}

export function loadSharedImage(source: number): Promise<SkImage> {
  const cached = decoded.get(source);
  if (cached) return Promise.resolve(cached);
  const existing = pending.get(source);
  if (existing) return existing;
  const request = assetDeadline(async expired => {
    const asset = Asset.fromModule(source);
    await asset.downloadAsync();
    if (expired()) throw new Error('Expired image request');
    const data = await Skia.Data.fromURI(skiaResourceUri(asset.localUri ?? asset.uri));
    try {
      if (expired()) throw new Error('Expired image request');
      const image = Skia.Image.MakeImageFromEncoded(data);
      if (!image) throw new Error('Cannot decode bundled image');
      decoded.set(source, image);
      return image;
    } finally {
      data.dispose();
    }
  });
  pending.set(source, request);
  // Rejected requests are not cached: a later load can retry the same source.
  const release = () => { if (pending.get(source) === request) pending.delete(source); };
  void request.then(release, release);
  return request;
}

export function useSharedImageState(source: number, valid = true): { image: SkImage | null; error: boolean } {
  // Each selection gets an identity even when the user returns to a previously
  // failed source before another request completes. Old errors cannot flash.
  const request = useMemo(() => ({ source }), [source]);
  const [state, setState] = useState<ImageState>(() => ({ request, image: decoded.get(source) ?? null, error: false }));
  useEffect(() => {
    let mounted = true;
    if (valid && !decoded.has(source)) {
      void loadSharedImage(source).then(
        image => { if (mounted) setState({ request, image, error: false }); },
        () => { if (mounted) setState({ request, image: null, error: true }); },
      );
    }
    return () => { mounted = false; };
  }, [source, request, valid]);
  const cached = valid ? decoded.get(source) : null;
  // Cached selections are available during render, without an effect-triggered
  // state update. Pending selections never show another sheet or stale error.
  return !valid ? { image: null, error: true } : cached ? { image: cached, error: false } : state.request === request
    ? { image: state.image, error: state.error } : { image: null, error: false };
}


export function useSharedImage(source: number | null, onError?: (error: Error) => void): SkImage | null {
  const { image, error } = useSharedImageState(source ?? 0, source !== null);
  useEffect(() => { if (source !== null && error) onError?.(new Error('No se pudo cargar una imagen de Dystopia.')); }, [source, error, onError]);
  return image;
}
