# Preparación del menú en Android

En el APK sin Expo Updates, `expo-asset` puede devolver imágenes estáticas como nombres de recursos `drawable`, sin esquema URI. El `Asset.fromModule` de la versión instalada conserva ese nombre en `localUri` y marca la imagen como descargada. No es una URL de Metro ni un archivo ausente.

La precarga anterior pasaba esos nombres a `Image.prefetch`. En React Native 0.86.3 para Android, ese método crea directamente una petición Fresco con `Uri.parse`, sin la resolución de recursos que sí realiza `ImageSource`. Por ello puede rechazar el nombre y bloquear `MenuPreparation` aunque la imagen exista en el APK. Las letras del título se preparaban por esa ruta; también afectaba a la precarga de la fuente en las transiciones.

La primera corrección utilizó `Image.getSize`, pero el error observado en el APK (`Unsupported uri scheme for encoded image fetch! uri res:/2131230934`) confirma que tampoco es válido para esta comprobación: aunque resuelve el nombre con `ImageSource`, React Native 0.86.3 llama después a `fetchEncodedImage`, que rechaza el recurso `res:/`.

`prepareImage.ts` ahora decodifica los recursos empaquetados de Android mediante `loadSharedImage`, el cargador Skia ya usado por el fondo, la UI y la galería. No llama a `Image.getSize` ni `Image.prefetch` para nombres drawable ni URI `res:/`. La implementación Android instalada de Skia utiliza `Resources.getIdentifier` y `openRawResource`. `sharedImages.ts` conserva nombres drawable y convierte `res:/2131230934` en el ID decimal `2131230934` que acepta `getIdentifier`. Esta conversión también cubre `res://`; los URI de archivos y HTTP no cambian. La imagen debe decodificarse realmente: una lectura fallida o una imagen inválida sigue mostrando error y permite reintentar. Se comparte el resultado en caché.

HTTP, archivos locales, iOS y web conservan la precarga existente. Se mantienen los límites de concurrencia, caducidad y reintento. No cambian dependencias, fuentes ni assets originales.

La pantalla inicial ahora muestra el recurso y el error concreto debajo del mensaje general. No depende de Skia ni de la fuente del juego para poder mostrar el diagnóstico. Si vuelve a fallar, ese detalle permite identificar otro recurso sin confundirlo con el fallo de los nombres Android.

## Verificación y distribución

- `node scripts/check-android-images.cjs`: el error exacto reportado se reproduce en ambos métodos Fresco simulados; se comprueba que ninguno se invoque, que el cargador compartido lea y decodifique nombres/IDs con Skia, y que no esconda recursos ausentes o imágenes inválidas. También cubre caché, archivos/HTTP, web/iOS y caducidad.
- `node scripts/check-menu-preparation.cjs`: arranque Android simulado con nombres drawable, comprobación de todas las letras, caché, reintento, detalle de error, seis trabajos simultáneos como máximo y ausencia de I/O al volver a rutas preparadas.
- Regresiones de fuente, caché de cargas y navegación: `check-pixel-font.cjs`, `check-loading-images.cjs` y `check-menus.cjs`.

Los cambios JavaScript deben incorporarse a un APK nuevo. El proyecto mantiene el perfil `preview` de EAS con `buildType: apk`:

```powershell
npx eas-cli@latest build --platform android --profile preview
```

Instalar el APK como actualización conserva el almacenamiento del juego. La exportación del bundle Android y las pruebas con APIs nativas simuladas no equivalen a ejecutar ese APK en un celular físico.
