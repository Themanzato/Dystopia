# Tutorial interactivo

El primer inicio desde START ofrece **Comenzar**, **Saltar** y **Volver** antes
de elegir dificultad. **Ajustes → Repetir tutorial** permite volver a entrenar
desde el menú. Saltarlo y completarlo son decisiones persistentes distintas.

## Recorrido

1. Desplazarse 90 unidades usando el joystick configurado.
2. Golpear tres veces el maniquí con el ataque real. Las reacciones completas
   se encolan y su destrucción se reproduce una sola vez.
3. Derrotar cuatro enemigos comunes y practicar el dash real.
4. Identificar vida, oleada, enemigos restantes y carga por daño/eliminaciones.
5. Activar Frenesis mediante su control real frente a una segunda oleada finita
   de doce enemigos (máximo ocho vivos). Se reservan seis hasta enseñar el giro.
6. Convertirse en Glitch Samurai y teletransportarse a un punto transitable,
   visible y libre de controles/enemigos, con el cooldown real de tres segundos.
7. Mantener ATACAR durante al menos 1,1 segundos y terminar la oleada con el
   ataque giratorio real; el joystick sigue disponible.
8. Mostrar **Entrenamiento completado**, con acceso a partida normal o menú.

La transformación conserva su duración real de quince segundos. Si termina
antes de practicar las acciones, el tutorial prepara otra activación sin
reiniciar los hitos ni producir enemigos indefinidamente. La vida de práctica
no baja de uno; la barra temporal de Frenesis conserva sus reglas normales.

## Integración y aislamiento

`tutorial.ts` controla hitos y apariciones finitas sobre `advanceSurvival` y los
controles existentes. No crea una segunda implementación de ataques, dash,
teletransporte ni IA. El maniquí forma parte del orden por profundidad de
`ActorsScene`; sus imágenes solo se cargan para el entrenamiento.

Las instrucciones se posicionan usando la distribución personalizada y sus
áreas táctiles reales. Los marcos de selección no reciben toques. El destino
del teletransporte se convierte entre pantalla y mundo con la cámara actual.
El reloj compartido congela combate, instrucciones animadas y maniquí durante
pausa, cuenta regresiva y suspensión de la aplicación.

La sesión no genera EXP, orbes, cofres, puntuación, Celdas ni progreso de
misiones; tampoco consume ventajas preparadas del Taller. Las salidas desmontan
la práctica antes de crear otra partida. Solo se guarda el estado del tutorial
en `@dystopia/tutorial/v1`, con escrituras serializadas e idempotentes.

## Assets y comprobaciones

Véanse [TUTORIAL_ASSETS.md](TUTORIAL_ASSETS.md) para las 17 celdas originales del
maniquí y sus tiempos de reproducción, y [TUTORIAL_ENTRY.md](TUTORIAL_ENTRY.md)
para la navegación y persistencia. Los PNG no contienen tiempos de animación;
los FPS elegidos se documentan como decisiones de reproducción.

Las pruebas `check-tutorial-{assets,flow,gameplay,hud,storage}.cjs` cubren recortes,
flujo, aislamiento de recompensas, animaciones completas, oleadas finitas,
controles personalizados, pausa, cooldown 2999/3000 ms y persistencia. Las
pruebas de código y navegador no equivalen a pruebas en un celular físico.

La revisión interactiva en Chrome completó salto, repetición desde Ajustes,
joystick personalizado, tres ataques reales al maniquí, pausa/reanudación,
dash, ambas oleadas, activación, teletransporte, giro y comienzo de una partida
normal limpia. Se inspeccionaron capturas en 844 × 390, 640 × 360 y 1280 × 720;
en las dos últimas se verificaron los controles dentro de pantalla y el panel
informativo sin intersecciones con joystick, ataque, dash o pausa.

También pasan TypeScript, lint y la exportación Android/Hermes con los assets
incluidos. Una exportación no es una prueba de ejecución en teléfono.

## Archivos de integración

- Motor y presentación: `src/game/tutorial.ts`, `tutorialTypes.ts`,
  `tutorialAssets.ts`, `tutorialInstructions.ts`, `TutorialEffects.tsx`,
  `CourtyardScreen.tsx`, `ActorsScene.tsx`, `survival.ts` y `FrenesisMapInput.tsx`.
- Entrada, persistencia y paneles: `src/app/tutorial.tsx`,
  `src/ui/TutorialOffer.tsx`, `TutorialStorage.ts`, `TutorialHUD.tsx`,
  `Application.tsx`, `session.ts`, `Menus.tsx` y `SurvivalHUD.tsx`.
- Pruebas nuevas: los cinco `check-tutorial-*.cjs`. Se adaptaron
  `check-battle-render.cjs`, `check-menus.cjs`, `check-gestures.cjs` y
  `check-follow.cjs` para conservar las comprobaciones de los flujos existentes.
