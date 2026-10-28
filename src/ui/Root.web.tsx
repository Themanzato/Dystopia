import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import BootLogo from './BootLogo';

// CanvasKit must finish loading before importing the native Skia scene on web.
// Mobile continues to use _layout.tsx and the installed native Skia renderer.
export default function WebLayout() {
  return <WithSkiaWeb
    opts={{ locateFile: file => `https://cdn.jsdelivr.net/npm/canvaskit-wasm@0.41.0/bin/full/${file}` }}
    getComponent={() => import('./Application')}
    fallback={<BootLogo />}
  />;
}
