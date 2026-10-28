# Electrocutioner y exclusividad de Frenesis

**Actualización:** Frenesis ahora separa el toque normal (Slash 1 -> Slash 2) del giro sostenido (Glitch Slices como animación principal). Slices ya no es un efecto. La guía vigente es [FRENESIS.md](FRENESIS.md); las notas siguientes sobre el giro corresponden a la implementación anterior. Electrocutioner conserva su implementación.

## Frenesis

El giro sostenido ya no solicita Slash 1/Slash 2. Usa el cuerpo de reposo de Glitch Samurai y las once celdas originales de **Glitch Slices** como una sola acción, sin superponer otro ataque. El botón mantenido repite el clip completo; soltarlo termina el ciclo actual y vuelve a reposo o movimiento. El joystick sigue funcionando durante el giro. El daño conserva sus intervalos y seriales, sin impactos por fotograma. Dash, teletransporte, pausa y muerte conservan sus prioridades y cancelación existentes.

Se corrigió el índice de las texturas de Frenesis: se calculaba desde el final del array, pero los merchants habían añadido imágenes después de los FX. Ahora parte del offset explícito del catálogo de enemigos. La animación normal de The Swordmaster conserva su último frame durante un tick de presentación antes de aceptar el siguiente ataque.

## Recursos originales

La carpeta real es `assets/assets/bosses/Electrocutioner/`; sus archivos escriben el nombre como **Electricuitioner**. El nombre mostrado es **Electrocutioner**. No se han alterado las imágenes ni se carga la hoja combinada de 16014 píxeles de ancho.

| Archivo | Dimensiones | Celdas y uso |
| --- | --- | --- |
| Electricuitioner-Idle.png | 1884 × 107 | 12 de 157 × 107, reposo y desplazamiento |
| Electricuitioner-Attack.png | 6123 × 107 | 39 de 157 × 107; carga 0–5 y tormenta 6–38 |
| Electricuitioner-Range Attack.png | 2512 × 107 | 16 de 157 × 107; carga 0–6 y liberación 7–15 |
| Electricuitioner-Teleport.png | 1884 × 107 | 12 de 157 × 107, desaparición original |
| Electricuitioner-Appear.png | 942 × 107 | 6 de 157 × 107, llegada del original y de los clones |
| Electricuitioner-Death.png | 2512 × 107 | 16 de 157 × 107, muerte |
| Volley Projectile 157x122.png | 2826 × 122 | 18 de 157 × 122, descenso, impacto y partículas |

El cuerpo mantiene el anclaje de pies (73, 96) y escala 2.1. El FX usa (73, 110), escala 1.5. Durante el teletransporte se cambia la posición del mundo una sola vez al pasar de desaparecer a aparecer; no se restaura el origen al recuperar. Las celdas transparentes originales se conservan.

## Combate y balance

Configuración central en `bossBalance.ts`, patrones en `bossAttacks.ts`, ejecución compartida en `survival.ts`. Vida base 54, velocidad base 58; se aplican los escalados actuales de dificultad/oleada/Purgatorio. El roster incorpora al boss al final para conservar el progreso anterior.

- El rayo fija la posición del jugador al iniciar la preparación. Una chispa de `FX/Electric Hit 3.png`, el gesto del boss y el sonido anuncian el impacto; no hay círculos ni cuadrados de hitbox visibles.
- El descenso dura 180 ms y el impacto daña durante 220 ms. Los 900 ms de presentación de partículas no prolongan ese daño.
- A **2/3 o menos**, una transición única activa velocidad ×1.85, ráfagas de 2/3/3 rayos en Fácil/Difícil/Dystopia, separación lateral 130 y desfase de 240 ms. La posición de cada rayo queda fija. Se alternan descarga, tormenta cercana y teletransporte; este último tiene cooldown de 8500 ms.
- A **1/3 o menos**, una transición única inicia el reloj de clones. Aparece como máximo uno cada **6000 ms de simulación activa**, sin primera aparición instantánea ni cola de intentos pendientes. Límites vivos: **2/3/4** según dificultad. Si no hay espacio válido o se alcanza el límite, se consume ese intervalo.
- Los clones usan la llegada original, opacidad 0.5, movimiento y descarga eléctrica. Tienen 1 PV; no invocan clones ni apoyos especiales, no dan EXP/cofre/recompensa de boss, no completan el encuentro y no reemplazan su barra de vida.
- La muerte del principal elimina clones y peligros asociados antes de procesar otro impacto de esos clones. Pausa/segundo plano congelan sus relojes. Reinicio, victoria y muerte del jugador limpian la acción.

## Audio

Se reutilizan `Audio sounds effect/zapThreeToneUp.ogg` y `zap1.ogg`. `scripts/build-gameplay-audio.cjs --electrocutioner` crea copias PCM WAV mono/22050 Hz para el flujo de audio existente; no modifica los originales. La procedencia y hashes quedan en `assets/sounds/gameplay/sources.json`. Los dos reproductores son persistentes, tienen cooldown, respetan volumen/silencio/pausa y comparten el límite de voces del juego.

## Verificación

Pasaron `npx tsc --noEmit`, `npm run lint` y los **60 scripts `check-*.cjs`** disponibles. Se conservan versiones y cambios locales previos.

`check-electrocutioner.cjs` valida 101 celdas de actor y 18 de FX, daño y esquiva, umbrales inclusivos sin repetición, teletransporte estable, las tres dificultades, reloj exacto de 6000 ms, límites sin backlog, muerte de un golpe, ausencia de recompensas duplicadas y limpieza al morir el original o jugador: 13 escenarios y 4797 frames de simulación. Ejecuta el combate transformado con el plugin real de Worklets.

`check-frenesis.cjs`, `check-frenesis-effects.cjs`, `check-player.cjs` y `check-worklet-config.cjs` cubren exclusividad, orden de frames, movimiento durante giro, liberación, último frame del ataque base y resolución de capturas nativas. Las regresiones de audio, FX, menús, roster y Purgatorio incluyen el nuevo boss.

La app Expo web/Skia se verificó en horizontal con controles reales de activación/ataque, movimiento compartido, pausa/cuenta regresiva, carga/impacto eléctrico, fases, aparición y eliminación del clon, muerte del original y victoria. Se prepararon estados controlados para alcanzar las fases; no se agregó una API de depuración al producto. La exportación Android generó el bundle Hermes con 190 assets. No equivale a instalar un APK: no se probó en celular físico ni se midieron FPS nativos.

## Archivos de esta revisión

- Jugador y FX: `src/game/player.ts`, `frenesisAssets.ts`, `FrenesisEffects.tsx`.
- Enemigo, patrones y renderizado: `enemyCatalog.ts`, `enemyAnimations.ts`, `enemyVisuals.ts`, `enemyPresentation.ts`, `bossBalance.ts`, `bossAttacks.ts`, `bossEffects.ts`, `BossCombatEffects.tsx`, `survival.ts`, `survivalAssets.ts`, `ActorsScene.tsx`.
- Integración: `purgatorio.ts`, `CourtyardScreen.tsx`, `src/ui/loadingCatalog.ts`, `PurgatorioPortrait.web.tsx`, `BattleAudio.tsx`, `SurvivalHUD.tsx`.
- Audio derivado: `assets/sounds/gameplay/electro-charge.wav`, `electro-impact.wav`, `sources.json` y `scripts/build-gameplay-audio.cjs`.
- Pruebas: nuevo `check-electrocutioner.cjs` y ajustes en comprobaciones de Frenesis, efectos, worklets, catálogo, carga, audio, renderizado, dificultad, supervivencia, menús, pareja y Purgatorio.
- Documentación: este archivo, `BOSSES.md` y `BOSS_ASSETS.md`.
