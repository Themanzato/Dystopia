# Dystopia

Juego de acción y supervivencia para celulares, con vista superior, orientación
horizontal y una ciudad distópica abandonada. Desarrollado con React Native y
Expo, renderizado con Skia y simulación mediante Reanimated y Worklets.

## Ejecutar el proyecto

Con Node.js y npm instalados:

```sh
npm ci
npx expo start
```

La versión instalada de Expo es `^57.0.31`. Usa una versión de Expo Go compatible
con ese SDK o una compilación de desarrollo compatible con las dependencias del
proyecto. No actualices dependencias de forma aislada; sigue `AGENTS.md`.

## Verificar

```sh
npx tsc --noEmit
npm run lint
```

Las comprobaciones de lógica e integración se encuentran en `scripts/check-*.cjs`.
Por ejemplo:

```sh
node scripts/check-tutorial-gameplay.cjs
node scripts/check-battle-audio.cjs
```

## Compilación Android

`eas.json` contiene los perfiles de compilación. El perfil `preview` genera un APK:

```sh
npx eas-cli@latest build --platform android --profile preview
```

## Organización

- `src/app/`: pantallas y rutas de Expo Router.
- `src/game/`: escenario, jugador, enemigos, oleadas y sistemas de combate.
- `src/ui/`: menús, controles, HUD, audio y persistencia.
- `assets/`: imágenes, animaciones y sonidos originales y derivados del juego.
- `scripts/`: comprobaciones de assets, lógica e integración.

## Guías del juego

- [Escenario](SCENARIO.md), [controles](CONTROLS.md) y [Frenesis](FRENESIS.md).
- [Bosses](BOSSES.md), [misiones](MISSIONS.md) y [comerciantes](MERCHANTS.md).
- [Puntuaciones y Taller](SCORES.md), [audio](AUDIO.md) y [tutorial](TUTORIAL.md).
- [Inicio en Android](ANDROID_STARTUP.md) y [assets visuales](VISUAL_ASSETS.md).

Los archivos de procedencia y licencias de recursos se conservan en sus carpetas
correspondientes dentro de `assets/`.
