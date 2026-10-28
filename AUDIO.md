# Audio de acciones y mezcla

Se integran los 18 MP3 originales de `assets/sounds/sonidos por agregar/`.
Sus nombres son la descripción disponible; no hay un archivo de instrucciones adicional.
No se cambian imágenes, recortes, estadísticas, versiones ni archivos de audio originales.

| Original | Acción real |
| --- | --- |
| `dash-jugador.mp3` | Inicio del dash del jugador y teletransporte exitoso de Frenesis. |
| `archer-shot.mp3` | Primer frame activo del láser de Archer; salida de la flecha hacia el cielo de Archer Bandit. |
| `dagger-attack1.mp3` | Primer intervalo activo del tajo/embestida de Dagger Bandit y Dagger Mush. |
| `charge-explosion-evil-sage.mp3` | Preparación de Evil Sage; se detiene al terminar su carga. |
| `explosiones-evil-sage.mp3` | Inicio real de ambas explosiones, local y distante. |
| `varios-laseres-guardian.mp3` | Inicio de las columnas eléctricas de Guardian (`attack`, frame activo a 550 ms). |
| `laser-guardian-cuadrado.mp3` | Ataque de descarga cuadrada de Guardian (`blast`, 600 ms). |
| `laser-guardian.mp3` | Rayo horizontal de Guardian (`laser`, 580 ms). |
| `teleport-guardian.mp3` | Inicio de su animación de desaparición/teletransporte. |
| `proyectil-electrocutioner.mp3` | Salida visible de cada rayo; respeta el escalonamiento real de la ráfaga. |
| `electrocutioner-explosion.mp3` | Fase activa de la tormenta eléctrica (`storm`, 930 ms). |
| `teleport-electrocutioner.mp3` | Inicio de su animación de teletransporte. |
| `tarnished-widow-voice1.mp3` | Ataque cuerpo a cuerpo de Widow. |
| `tarnished-widow-voice2.mp3` | Ataques de salto y veneno de Widow. |
| `jump duster/beepbeepcount.mp3` | Pulsos del marcador mientras sigue al jugador. |
| `jump duster/beepbeepcount-corto.mp3` | Pulsos rápidos durante el bloqueo previo a caer. |
| `jump duster/bomba-jump-duster.mp3` | Inicio de la animación de lanzamiento: el mismo archivo incluye vuelo, caída y explosión. No se reinicia al impactar. |
| `jump duster/slam-jump-duster.mp3` | Impacto real del salto, sincronizado con Slam VFX. |

Los tiempos indicados son de animación base: se ajustan por la velocidad de ataque
existente. El salto de Dust usa su cronología dinámica, incluida la variante crítica.
Los frames, transparencias y dimensiones se comprobaron sobre los atlas originales.
No se reproduce el sonido genérico de ataque encima de una acción con audio específico.
La recogida de EXP sigue siendo silenciosa; la subida de nivel conserva su sonido.

## Normalización

`assets/sounds/mixed/` contiene copias PCM WAV de 16 bits / 48 kHz, compatibles con
el reproductor existente de Expo Audio SDK 57. Los efectos anteriores de combate y
los tres clics de UI también se normalizan para compartir la misma referencia.
La música existente permanece intacta.

- Objetivo: **−26 LUFS** con ponderación K BS.1770 y compuertas absoluta y relativa.
- Bloques de 400 ms, pasos de 100 ms; efectos de menos de 400 ms usan su duración completa.
- Comprobación de pico reconstruido a 4× y techo de −3 dB; sin compresión ni clipping añadido.
- Mezcla centralizada en `audioMix.ts`: efectos del usuario × 1; música de combate × 0.16; música de derrota × 0.8.
- Se quita silencio marginal y se aplican entradas/salidas de 5 ms en las copias.
- Cada archivo de beeps contiene una cuenta completa: se extrae su primer pulso íntegro.
  El reloj de simulación reproduce esos pulsos a su ritmo real, sin superponer cuentas.
- `mixed/sources.json` registra procedencia, hashes SHA-256 originales y derivados,
  recortes temporales, duración, ganancia, sonoridad medida y picos.

`scripts/normalize-action-audio.py --decoded-dir <carpeta>` reproduce la preparación
con Python y NumPy como herramientas de desarrollo, sin dependencias nuevas en la app.
La carpeta de entrada contiene `decoded.json` y PCM float32 intercalado a 48 kHz;
`scripts/decode-action-audio.cjs <salida>` permite obtenerlo con Chrome y Playwright
instalados para desarrollo (`PLAYWRIGHT_MODULE` y `CHROME_PATH` opcionales).
Las mediciones digitales no sustituyen escuchar la mezcla en un celular físico.

## Ciclo de vida y rendimiento

Los eventos se emiten una sola vez al cruzar límites de animación o FX. Un contador
escalar despierta el puente al hilo JS; no se crea un reproductor ni un timer por frame.
Hay 34 reproductores de batalla persistentes y **máximo tres efectos simultáneos**.
Los avisos y acciones específicas tienen prioridad frente a bajas comunes.
Todos participan en la barrera real de preparación de audio y su porcentaje existente.
Un fallo opcional se registra y deja solo ese sonido desactivado, sin bloquear la partida.

Los sonidos sostenidos terminan con su intervalo activo. La muerte del dueño cancela
sus sonidos y los de sus clones; tombstones por serial evitan reproducir un inicio
y una muerte coalescidos en el mismo callback. Pausa, suspensión de la app, derrota,
reinicio y salida detienen los efectos sin dejar callbacks de reproducción pendientes.
No se repiten sonidos antiguos al reanudar ni al activar el volumen.

## Verificación

`node scripts/check-action-sounds.cjs` comprueba todos los disparadores, cronologías,
limpieza por dueño, pausa, dash, cobertura de los 18 originales, hashes y mezcla.
`check-battle-audio.cjs` cubre los 34 reproductores, preparación, volumen, silencio,
presupuesto de voces, pausas, suspensión, reinicio y cancelación de inicios obsoletos.
`check-audio.cjs` comprueba también el volumen inmediato de los botones de UI.

### Resultado de esta revisión

- `npx tsc --noEmit` y `npm run lint`: correctos.
- 64 verificaciones `scripts/check-*.cjs`: correctas, incluida la nueva prueba de audio.
- Prueba web de la app: 14 casos de combate; los 18 sonidos nuevos se reprodujeron,
  con el mismo factor de volumen configurado, sin errores de audio ni fallos de carga.
- Revisión visual de animaciones y FX, pausa/reanudación y cuenta regresiva en horizontal.
- Exportación Android/Hermes: correcta (206 assets, sin crear un APK).
- No se probó escucha, latencia ni rendimiento en un celular físico.


## Corrección de carga lenta en Android

La preparación de batalla ya no inicia 34 efectos `downloadFirst` simultáneos.
`useQueuedAudioPlayer` crea el reproductor vacío y registra su recurso. Una cola
con concurrencia de tres descarga/resuelve cada archivo con Expo Asset y pasa su
URI local al reproductor. Los originales y la mezcla normalizada no cambian.

Se distinguen transferencia del archivo y preparación nativa. El límite de ocho
segundos ya no cuenta la espera de los demás archivos en la cola: se controla la
inactividad real y la preparación individual después de disponer del archivo.
Si un recurso opcional se retrasa, la escena puede continuar con un fallback,
pero su escucha de estado permanece activa: al llegar `STATE_READY`, vuelve a
estar disponible automáticamente para acciones futuras. No se reproducen
ataques pasados ni se reinicia la música de batalla al recuperar un efecto.
Los errores reales de descarga/decodificación siguen notificándose.

Salir o reiniciar cancela cola, suscripciones y temporizadores. Una descarga de
Expo Asset ya iniciada puede completar su caché, pero no reemplaza ni reproduce
un recurso sobre un componente desmontado. `check-audio-queue.cjs` comprueba
34 fuentes con más de ocho segundos de carga total, concurrencia, recuperación
tardía, errores reales, carreras al suscribir y cancelación. Sin prueba física.


En SDK57 web, `currentStatus.isLoaded` puede ser verdadero incluso en un
reproductor sin fuente. La cola usa el getter real `player.isLoaded`, no ese
valor de la instantánea, para no omitir la asignación del archivo. Los clics de
UI tampoco encolan `play()` sobre un reproductor aún vacío: así no se reproducen
tarde al volumen predeterminado del nuevo elemento. Un clip ya terminado en
Android sigue pudiendo repetirse gracias a su duración conocida.

Verificación de esta corrección: 65 comprobaciones correctas, TypeScript y lint
sin errores ni advertencias. La app web con transferencias ralentizadas tardó
19,379 ms entre el primer y último recurso, con máximo tres solicitudes
simultáneas. Los 18 sonidos nuevos se reprodujeron en 14 casos de combate, sin
avisos de audio desactivado y con el volumen configurado. No prueba en hardware.


### Balance entre efectos y música

La pista de combate mide aproximadamente −10.96 LUFS en sus primeros 30 segundos;
los efectos normalizados están cerca de −26 LUFS. Por eso el volumen numérico de
ambas fuentes no puede ser el mismo. `AUDIO_MIX` aumenta un 25% el factor anterior
de efectos (0.8 → 1), y atenúa la pista hasta aproximadamente −26.88 LUFS con su
control al 100%. Los ajustes guardados de música y efectos siguen siendo independientes.
Se conservan los originales, la normalización, la cola de carga y el límite de tres voces.

La bomba de Dust Jumper emite un único evento de sonido al entrar en la animación
de lanzar. Las explosiones de sus una a tres bombas no reinician esa grabación.
La prueba de simulación verifica lanzamiento, impactos y ausencia de duplicaciones.

### Dash durante ráfagas de sonidos

El presupuesto de tres efectos se procesaba antes para los ataques de jefes y
después para el dash. Cuando coincidían varios eventos, se consumía el contador
del dash sin reproducirlo; además otro efecto de igual prioridad podía cortarlo
en la siguiente actualización. El orden de admisión ahora atiende daño y dash
primero, y ambos tienen prioridad superior a los efectos de jefes al sustituir
una voz. Se conserva el límite de tres efectos y el cooldown del dash.

`check-battle-audio.cjs` reproduce doce dashes entre ráfagas simultáneas de jefes,
240 actualizaciones de pulsaciones sin un dash nuevo y ráfagas posteriores que
no deben cortar su voz. Comprueba también que mute, pausa, segundo plano y salida
siguen deteniendo los sonidos. Es una prueba de lógica, no de hardware móvil.
