import { Asset } from 'expo-asset';
import { Image } from 'react-native';

// Menus are evaluated by Router before CanvasKit is initialized. The browser
// prefetch path must stay independent of Android's Skia resource decoder.
export async function prepareImage(source: number, expired: () => boolean = () => false): Promise<void> {
  const asset = await Asset.fromModule(source).downloadAsync();
  if (expired()) throw new Error('La solicitud de imagen venció.');
  const uri = asset.localUri ?? asset.uri;
  if (!uri) throw new Error('El recurso no tiene una ubicación válida.');
  if (await Image.prefetch(uri) === false) throw new Error('No se pudo preparar la imagen.');
  if (expired()) throw new Error('La solicitud de imagen venció.');
}
