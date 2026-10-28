import { Asset } from 'expo-asset';
import { Image, Platform } from 'react-native';
import { loadSharedImage } from './sharedImages';

/** Fresco's getSize AND prefetch use encoded fetch paths which reject packaged
 * res:/ drawables. Verify/decode those through Skia's native resource reader,
 * exactly like the rest of the menu; never send them to either Fresco method. */
export async function prepareImage(source: number, expired: () => boolean = () => false): Promise<void> {
  const asset = await Asset.fromModule(source).downloadAsync();
  if (expired()) throw new Error('La solicitud de imagen venció.');
  const uri = asset.localUri ?? asset.uri;
  if (!uri) throw new Error('El recurso no tiene una ubicación válida.');
  if (Platform.OS === 'android' && (!uri.includes(':') || /^res:\/+/.test(uri))) {
    await loadSharedImage(source);
  } else if (await Image.prefetch(uri) === false) {
    throw new Error('No se pudo preparar la imagen.');
  }
  if (expired()) throw new Error('La solicitud de imagen venció.');
}
