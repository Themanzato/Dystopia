# Misiones persistentes

`src/game/missions.ts` centraliza los 35 objetivos, dependencias, categorías y recompensas. Reutiliza únicamente mecánicas implementadas: Supervivencia infinita, Purgatorio individual, nidos, reactor, élite, captura, orbes y Frenesis. La dificultad interna `dystopia` corresponde al modo de vida única llamado Dystopia/Imposible.

## Catálogo

- **Iniciación (15):** Primera baja, Limpieza callejera, La ciudad es tuya, Primera oleada, Superviviente, Imparable, Primer escollo, Cabeza de la serpiente, Cazador de bosses, Zona asegurada, Cortar suministros, Reactivación, La élite cayó, Control de daños y Despertar.
- **Dominio (10):** Sobrecarga, Salto imposible, Torbellino, Recolector, Evolución acelerada, Victoria en Purgatorio, Cacería mayor, Veinticinco oleadas, Diez mil amenazas y Sin un rasguño.
- **Extremos (10):** Cincuenta oleadas, Duelo perfecto, Purgatorio Difícil, Purgatorio Imposible, Sin margen de error, Último superviviente, Ritual completo, Cazador incansable, Objetivo impecable y Reflejos sobrehumanos.

Supervivencia no tiene un final victorioso: **Último superviviente exige alcanzar la oleada 30 en Imposible**, en vez de completar una partida infinita. Las victorias de Purgatorio corresponden a encuentros individuales; Infinito no concede una victoria por cerrar una rotación. Control de daños y Ritual cuentan nidos, reactores y élites completados en la misma partida. Torbellino exige cinco NPC eliminados con un mismo pulso de Glitch Slices. Las capturas perfectas permiten el trayecto inicial, pero ninguna salida después de entrar. Los duelos perfectos incluyen todo el encuentro conjunto y cualquier daño recibido durante él, también a la vida temporal.

## Progreso y Celdas

Cada ficha muestra objetivo, alcance acumulativo o de una partida, progreso, recompensa y estado. Las cadenas se desbloquean al reclamar su predecesora; conservan el progreso obtenido mientras estaban bloqueadas. Los valores acumulativos usan diferencias de contadores por identificador de partida; los objetivos de una partida conservan el máximo y nunca suman partidas distintas. Muertes, oleadas y eventos fallidos no añaden éxitos ficticios.

Las recompensas base son **8 / 30 / 90 Celdas** para Iniciación / Dominio / Extremos, multiplicadas por el factor individual del catálogo (8–40, 30–120 y 90–270 respectivamente). No se entregan al completar: quedan pendientes hasta tocar **Reclamar**. El icono del trofeo en el menú avisa de reclamos disponibles; Récords utiliza un podio distinto.

Se guarda en el archivo existente `@dystopia/scores/v1`, junto al Taller, las Celdas y los récords. Una cola única serializa progreso, compras, liquidaciones y reclamos. Reclamar escribe saldo y estado reclamado en una misma operación, y publica solo después de confirmar el almacenamiento. Reintentos y callbacks concurrentes no pagan dos veces. Los perfiles anteriores sin misiones parten de valores seguros; no se otorgan recompensas retroactivas a partir de récords incompletos.

La escena usa contadores compartidos; solo envía instantáneas cuando cambia una acción medible. Se agrupan escrituras durante 400 ms y se guardan inmediatamente las completadas, las pausas y los finales. La liquidación final incluye una instantánea de misiones dentro de la escritura del resultado. Salir voluntariamente conserva los logros realizados, sin liquidar puntuación ni Celdas de partida. Un cierre abrupto del proceso puede perder hasta el último intervalo de progreso parcial no confirmado; los completados confirmados y pendientes sobreviven al reinicio.

## Correcciones relacionadas

- Captura: **15 s efectivos**, plazo total **90 s**, penalización exterior **+1 s/s hasta +30 s**. Conserva progreso, daño de fallo y congelación por pausa. La flecha desaparece dentro y hasta 28 unidades fuera del borde. Usa la transformación real de cámara.
- Frenesis: un reconocedor de pulsación sostenida tolera el movimiento del dedo. El ataque inicial pasa a ciclos completos de Glitch Slices; dash y blink conservan la intención de mantenerlo, y recuperan el giro al terminar. Soltar completa el clip sin iniciar otro; pausa y final limpian el ataque. El daño respeta `spinIntervalMs / attackSpeedMultiplier`, una vez por serial y enemigo.
- Boss fuera de cámara: indicador de borde con proyección de la cámara real, márgenes y exclusión de las zonas de controles personalizadas y del HUD. Archer/Dagger usan A/D y colores diferentes. Se oculta mientras su cuerpo esté visible, en presentación y al morir.

## Verificación

`node scripts/check-missions.cjs` cubre catálogo, contadores reales, acumulación, máximos, estados, datos inválidos, persistencia simulada, reclamos concurrentes, fallos de escritura y convivencia con la liquidación de partida; también captura, proyección de cámara y giro a pasos de simulación de 120/60/25 Hz. Las regresiones de captura y eventos comprueban sus contadores de éxito. Estos pasos de simulación no constituyen una medición de FPS nativos.

La revisión en Chrome/Skia comprueba tamaños horizontales 844×390, 667×375 y 568×320, categorías, una baja mediante el control real, aviso, persistencia pendiente, reclamo y recarga. Captura e indicador se revisan además con estados preparados en un harness externo, sin añadir API de depuración al juego. No se ha probado en un celular físico.
