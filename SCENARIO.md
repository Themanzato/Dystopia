# Dystopia: ciudad abandonada y The Swordmaster

Los vendedores de arena de Supervivencia, sus cuatro sprites animados, frecuencia, compras, armadura y pruebas gratuitas de Celdas están documentados en `MERCHANTS.md`. No se muestran sus nombres de archivo en la interfaz ni se añaden vendedores al modo Purgatorio.



## Eventos opcionales del modo principal (24 de octubre de 2026)

`optionalEvents.ts` centraliza intervalos, pesos, dificultad, objetivos y premios. `world.optional.active` es la única ranura para **Oleada Élite**, **Desactivar nido** y **Reactor inestable**; los guards de capturas, naves y especiales leen esa ranura. Las oportunidades llegan tras **150–240 segundos de simulación**, con pesos iguales y sin repetir el último tipo. Si hay conflicto se conserva una sola oportunidad y se vuelve a comprobar tras **12–20 s**, o al cambiar la fase/oleada estando ya vencida. No existe una cola de eventos. Después de completar, fallar o cancelar uno hay un cooldown mínimo de **120 s** y una nueva oportunidad en **150–240 s**. La elegibilidad/sorteo no se evalúa cada fotograma: solo se consultan los vencimientos y límites de fase; por cuadro se actualizan los temporizadores y las zonas activas.

No se inician en Purgatorio, pausa, presentación de boss, captura/nave/especial ocupado ni durante sus avisos. Se eligen inicios en pasos **1/2/3/6/7/8** del ciclo, desde la segunda oleada; se evitan los pasos previos inmediatos a bosses. Los nuevos eventos nunca utilizan la excepción de captura/nave desde la oleada 25. La ranura bloquea otras misiones y especiales; si alcanza una nueva oleada programada de boss, el evento se cancela sin premio ni daño, restaura la visión y libera la ranura **antes** de comprobar el boss, conservando el calendario 5/10 sin acumular encuentros.

**Oleada Élite:** reserva la siguiente oleada común, espera hasta 60 s a que termine la actual y anuncia **3 s** antes de sus apariciones. Reemplaza una fracción exacta de los spawns normales, sin sumar enemigos. Fácil: **25%, 2 HP, velocidad ×1.12**; Difícil: **32%, 2 HP, ×1.16**; Dystopia/Imposible: **40%, 3 HP, ×1.20**. Los factores de velocidad se aplican al escalado normal por modo/oleada. Todos usan los mismos tres NPC, proporciones y animaciones; una corona vino y pequeñas marcas de vida identifican a los élites. Los demás NPC continúan muriendo de un golpe. El plazo activo es de **90 s**, y solo se premia al terminar toda la oleada, incluidos pendientes y activos.

**Desactivar nido:** reutiliza `Ember Pit Shrine.png` como foco de aparición: tira RGBA de **320×33**, diez celdas reales de **32×33**. Tras el aviso de tres segundos genera NPC normales alrededor, fuera del espacio inmediato del jugador, con posiciones transitables y conectadas. El intervalo parte de **3200 ms / combatRate** del balance existente, con mínimo de 2000 ms. Grupos de **1/2/2** y máximo propio de **6/8/10** vivos en Fácil/Difícil/Dystopia; comparte el cupo global de **60**. Se desactiva con **8 s acumulados** dentro de un radio de 76; salir pausa sin reiniciar. El plazo activo es de **90 s**. Al resolverlo se detienen los spawns y se retiran solo sus NPC, sin simular muertes ni conceder sus EXP.

**Reactor inestable:** tres puntos en patios ya verificados, conectados, a **160–950 unidades** del jugador y separados al menos **220 unidades**. Cada uno requiere **4 s acumulados** en radio de 76, sin pérdida al salir. Plazo activo de **120 s**. La visión entra gradualmente en 850 ms: radio inicial 180 y recuperación parcial hasta 460; cada punto restaura un tercio. Una máscara radial Skia oscurece solo la escena y los actores lejanos: jugador/NPC cercanos quedan en el área clara, mientras proyectiles, señales de ataque, flechas y HUD se dibujan después. Se restaura al completar/fallar; muerte y entrada de boss la limpian inmediatamente. Se conserva joystick, ataque, dash y teletransporte de Frenesis.

Premios, una sola vez al completar: **Élite +16 EXP/+8 carga de Frenesis; Nido +12 EXP/+4 carga; Reactor +20 EXP/+6 carga**. Son bonificaciones explícitas del evento, independientes de la carga por daño y de la EXP. Si Frenesis está activo se guarda su carga de recompensa y se aplica una vez al terminar la transformación; no se pierde por recogerla durante la ulti. Fallar no concede premio ni aplica daño. Se conserva la vida única y todas las reglas de dificultad.

Los avisos reutilizan `gameplay/wave.wav` para Élite, la voz grave seca `Voices_03/Single_Low_AU_No_Reverb_v1_wav.wav` para el nido y `gameplay/dust-beep.wav` para el reactor; completar reutiliza `gameplay/chest.wav`. No se crean nuevos reproductores: se mantienen los 15 existentes y el presupuesto máximo de tres voces. La alerta opcional evita duplicar el aviso de oleada en el mismo cuadro, respeta volumen/silencio y no se reproduce de nuevo al reanudar.

Verificación: `check-optional-events.cjs` prueba quince escenarios con transformación de worklets nativos: intervalos/variedad, exclusión normal/avanzada, aviso élite, vida y seriales reales, cupos, entrada/salida, tres recuperaciones de visión, premios únicos, tiempo agotado, boss prioritario, muerte/pausa y aislamiento de Purgatorio. `check-optional-effects.cjs` comprueba los recortes de la animación, zonas, marcas élite y recuperación de máscara; las pruebas de audio verifican un cue por inicio/recompensa, silencios y ausencia de duplicación. La revisión Chrome/Skia usa estados preparados por un harness externo; no constituye una prueba en un celular físico ni una medición de FPS nativos.


Comprobaciones finales: pasaron TypeScript, lint sin avisos y los 47 scripts del proyecto; la prueba de camara se reejecuto con el contrato de seguimiento visual de Frenesis. Chrome/Skia verifico los tres eventos a 844x390, 667x375 y 568x320, incluidos los dos golpes de un elite, salir del nido con joystick real, conservar progreso, limpiar NPC propios, pausar y restaurar vision al completar o fallar el reactor. No se probo en un celular fisico ni se midieron FPS nativos.

## Frenesis — habilidad ultimate (revisión de animaciones, 24 de octubre de 2026)

Se conserva la carga exclusiva por daño real/muertes, el aporte limitado de especiales, los 15 segundos máximos, cinco puntos de vida temporal y el cooldown de teletransporte de 3000 ms. `frenesis.ts` centraliza estos valores. EXP y niveles no cargan la habilidad; la pausa y el segundo plano congelan sus relojes. La vida temporal no cura ni transfiere exceso de daño a la normal.

Ataque: pulsar inicia `Slash 1` completo (7 celdas, 350 ms de animación), con daño en el frame 3. Mantener encadena el barrido de `Slash 2` con los **11 frames originales de Glitch Slices** (550 ms de animación), conservando el cuerpo visible entre las estelas transparentes. La velocidad de ataque de la partida acelera el reloj completo. El último fotograma se conserva antes del siguiente serial; pulsar rápidamente no reinicia el clip. Soltar completa el ataque ya iniciado sin encadenar otro; pausar, terminar la habilidad o quedar fuera de la partida detiene sus efectos. Se puede mover durante el ataque. Cada secuencia aplica como máximo un impacto por enemigo, mantiene el alcance y las colisiones existentes, y respeta la protección frontal de Shielder.

Teletransporte: el destino lógico se valida con navegación/obstáculos y conserva el cooldown exacto de **3 segundos**. La presentación dura **420 ms**: `Glitch Out` al salir (160 ms), `Jump Glitch` durante el desplazamiento visual (120 ms), y aparición con el mismo clip al llegar (140 ms). Cámara y sprite comparten una interpolación suave y terminan en los pies exactos del destino. No se avanza con joystick ni se inicia otro ataque/dash durante este breve blink; el daño se difiere hasta que la aparición es visible. Las estelas usan imágenes ya cargadas, sin descargas al activar. No se modificaron assets originales.

Se eliminó la órbita/círculo procedural alrededor del héroe. `FrenesisScreenEffects.tsx` crea ráfagas breves de estática con separación de color sobre el escenario completo, más trazos sutiles de velocidad en los bordes. La estática solo aparece al transformar, en ventanas de 110 ms separadas por silencios y al iniciar el blink; no es un filtro CRT ni scanlines permanentes. El HUD se dibuja después, conservando su legibilidad. Todo depende del reloj de simulación y valores compartidos, sin renderizar la escena React en cada fotograma.

El botón muestra porcentaje al cargar, **LISTA / TOCA** con marco parpadeante al completar, y **ACTIVA + segundos restantes** con color cian durante el uso. La barra de vida Glitch sigue separada de la vida normal. Su texto se actualiza por porcentaje o segundo, no por fotograma; los valores se leen directamente desde el shared value para detectar también cambios de carga sin otros eventos del HUD.

Assets RGBA originales de `assets/assets/characters/Glitch Samurai/`, celdas **140×46**: `Idle Gltich` (11), `Run` (12), `Slash 1` (7), `Slash 2` (5), `Glitch Sweep` (6), `Glitch Out` (5), `Glitch Slices` (11) y `Jump Glitch` (4). Pivote (66,44), proporciones y filtrado nearest originales. La carrera acompasa sus frames al aumento de velocidad.

Verificación: `check-frenesis.cjs` cubre carga/daño/vida, recortes, cadencia completa, pulsaciones repetidas, blink progresivo, protección y destino final; `check-frenesis-effects.cjs` comprueba el FX Slices original, ausencia de círculo, ráfagas acotadas, silencios, pausa y limpieza; `check-worklet-config.cjs` verifica los closures serializados. También se mantienen las pruebas de controles, cámara, HUD y renderizado. La revisión visual usa Chrome/Skia y estados preparados externamente; no equivale a una prueba en celular físico ni a una medición de FPS nativos.

## Combate de especiales — revisión vigente

La guía actual de bosses, minibosses, peligros físicos, fases y balance está en [BOSSES.md](BOSSES.md), y las rutas/celdas de los nuevos efectos en [BOSS_ASSETS.md](BOSS_ASSETS.md). Estas guías prevalecen sobre las descripciones históricas siguientes de combate solo cuerpo a cuerpo, daño fijo, tres esqueletos o un único actor especial: ahora hay proyectiles y explosiones reales, estados temporales, grupos propios de Droid y encuentro Bandit conjunto, sin admitir otro encuentro especial simultáneo. Se conserva la ciudad y sus recursos originales.


## Coordinación de capturas y naves — revisión actual (24 de octubre de 2026)

Esta sección prevalece sobre la descripción histórica de los temporizadores de captura. `canRunWorldEvent` en `worldEvents.ts` deriva la admisión del estado real de la zona, nave y encuentro: antes de la oleada **25**, una captura impide armar/activar una nave y la alarma o miniboss de nave aplaza la captura. Se conserva una sola oportunidad de nave aplazada, incluso si cambia la oleada; no se acumula una cola de encuentros. Los bosses programados y las presentaciones conservan prioridad y la exclusión de especiales existente. Al finalizar o fallar la captura se libera su bloqueo; el miniboss conserva el suyo hasta limpiar su animación de muerte.

`ADVANCED_EVENT_OVERLAP_WAVE = 25` permite coincidir captura y nave desde esa oleada. `eventSeparationMs = 8000` separa los inicios; nunca se crean ambos en el mismo instante. No permite superponer bosses ni minibosses adicionales, ni abrir una captura durante un boss programado.

La captura requiere **15 segundos acumulados dentro**. El plazo total es de **90 segundos desde la activación**, incluido el trayecto inicial. Al salir después de entrar, conserva el progreso y añade **un segundo de trabajo por cada segundo fuera**, hasta **30 segundos extra** (45 segundos requeridos como máximo). El plazo sigue consumiéndose fuera. Pausa, elecciones de mejoras y segundo plano congelan la simulación y estos relojes. El HUD compacto distingue tiempo de captura y plazo, y muestra la recompensa; el círculo mantiene sus límites/progreso y ya no tiene un icono de premio en el centro.

Agotar el plazo cancela la misión sin premio y solicita **2 puntos de daño una sola vez** mediante `hurtPlayer`. Si hay invulnerabilidad, la penalización espera hasta que el sistema normal permita el golpe; no la omite ni vuelve a generarla. Utiliza la muerte, temblor e invulnerabilidad normales. Un `-2` rojo sigue al jugador, asciende y desaparece a los 1.2 segundos. Completar justo al agotarse el plazo cuenta como éxito.

Verificación automatizada: `node scripts/check-capture-events.cjs` cubre diez escenarios con worklets transformados para el runtime nativo: exclusión normal/avanzada, separación, aplazamiento, límites de tiempo, salida/regreso, penalización única, invulnerabilidad, muerte de una vida, pausa y entrega de premio. `check-world-events.cjs` conserva las pruebas de patios, salidas seguras, presión de NPC y continuidad de los ataques. Ninguna de estas simulaciones constituye una medición en celular físico. La revisión en Chrome/Skia a 844×390 y 667×375 comprobó entrada, salida con el joystick real, progreso conservado, pausa exacta, regreso y premio único, además de fallo con vida 5→3, indicador flotante y limpieza. Los estados de misión se prepararon mediante un harness externo de desarrollo, sin añadir API de depuración al juego. También pasaron TypeScript, lint y las regresiones de supervivencia, HUD, renderizado y worklets. No se probó en hardware móvil.
## Purgatorio — encuentros individuales e Infinito

Purgatorio es un modo independiente accesible desde el menú principal. START conserva el modo de supervivencia actual: misma ciudad, oleadas, eventos de edificios/naves, calendario 5/10 y recompensas. No se cambiaron versiones, dependencias ni recursos originales.

### Roster y desbloqueos

`src/game/purgatorio.ts` centraliza el orden, la selección y el escalado. Se usan los **seis minibosses y siete bosses existentes**, con los mismos sprites, ataques, animaciones, sonidos y reglas de impacto:

1. Shielder.
2. The Evil Sage.
3. Archer.
4. Bomb Droid.
5. Dagger Mush.
6. Shock Sweeper.
7. Guardian.
8. Skeleton Summoner.
9. Archer and Dagger (ambos Bandit en un solo encuentro).
10. Dust Jumper.
11. Rock boss.
12. The Tarnished Widow.

Inicialmente solo Shielder está disponible para combate individual. Derrotar al enemigo del frente de progreso desbloquea el siguiente; los ya completados pueden repetirse. El controlador de inicio valida también el bloqueo, no solo los botones. Las victorias en cualquiera de las dos modalidades de Purgatorio avanzan este mismo frente, compartido entre dificultades. Las partidas de supervivencia permanecen separadas.

Se guarda un prefijo validado de identificadores en AsyncStorage existente, bajo `@dystopia/purgatorio/v1`. Ganar de nuevo o recibir un callback repetido no concede desbloqueos adicionales. La hidratación tardía combina victorias de la sesión sin retroceder el registro. Si falla la lectura, no se sobrescribe un registro desconocido con los valores iniciales; se conserva la sesión y se vuelve a intentar al abrir el menú. Las escrituras se ordenan y los errores muestran un mensaje.

La lista presenta todos los nombres y retratos originales, también los bloqueados. Archer and Dagger comparte una sola tarjeta, con los dos retratos a escala común; los guardados antiguos de 13 entradas conservan su progreso al eliminar la duplicación del encuentro. Ambos se entierran buscando la posición del jugador y anuncian una salida fijada 420 ms antes de emerger. No usan desplazamiento en bola. Las flechas al cielo caen 320–430 ms después del disparo visible. Los retratos recortan el primer fotograma mediante los límites alfa ya auditados en el catálogo de carga. En web se recorta la imagen original con muestreo pixelado; en Android/iOS se reutiliza la imagen decodificada del catálogo y se rasteriza una sola vez con nearest a tamaño físico. La caché está limitada y no hay un canvas o animación permanente por tarjeta.

### Modalidades y dificultad

- **Individual:** una partida nueva contra el enemigo seleccionado, sin el calendario de oleadas de supervivencia. Conserva su repertorio completo, incluyendo el escudo trasero de Shielder y las invocaciones normales de Skeleton Summoner. Después de su animación de muerte, se muestra victoria con Reintentar y Menú principal. La derrota ofrece las mismas salidas. Reintentar conserva enemigo y dificultad, y reinicia vida, mejoras y estado de la partida.
- **Infinito:** siempre disponible. Recorre primero los 12 encuentros únicos una vez en el orden indicado. Después selecciona aleatoriamente entre todo el roster sin repetir inmediatamente el anterior. Continúa sin fin hasta perder la vida. No se guarda un historial creciente de combates ni se acumulan spawns.
- **Fácil / Difícil / Imposible:** reutilizan los identificadores internos `easy`, `hard` y `dystopia`. En Purgatorio la dificultad de una sola vida se llama **Imposible**; el nombre **Dystopia** del modo anterior permanece intacto. No existe continuación ni resurrección al perder esa vida. Los límites existentes de Vitalidad siguen aplicándose.

El combate se ejecuta en `advanceSurvival` y `advanceBoss`, sin una segunda implementación. Purgatorio solo sustituye el controlador de encuentros. Sus eventos de ciudad y el calendario 5/10 están desactivados en esta modalidad. Mientras el especial vive, sigue la presión acotada de NPC y sus apoyos normales. Al morir, se retiran los apoyos y las apariciones pendientes para que ninguno bloquee el relevo o dañe a través de la victoria. Nunca se crea un segundo boss o miniboss simultáneo.

Infinito espera la muerte original, deja un interludio de **1400 ms**, y reutiliza la presentación animada de **1800 ms** antes del siguiente combate. Los controles siguen disponibles en esos intervalos seguros. Pausa, segundo plano y elección de mejoras congelan el mismo reloj, incluidas las transiciones. Se mantienen EXP, cofres físicos y mejoras existentes durante la partida. El HUD muestra encuentro, NPC, progreso 0/12–12/12 y la barra del enemigo por separado; a partir del 13 indica selección aleatoria y dificultad aumentada.

### Escalado configurable

Para el encuentro `N`, `p = (N-1) / (N-1+18)`:

- Vida del especial: `ceil(vidaBase * (1 + 2*p))`, con tope asintótico de 3×. Los NPC comunes conservan un golpe de vida y los esqueletos normales también.
- Velocidad: base de la dificultad elegida por `1 + 0.30*p`.
- Ritmo: base de dificultad por `1 + 0.24*p`, limitado a 1.65×.
- Frecuencia de presión normal: base por `1 + 0.25*p`; se conservan los límites simultáneos actuales.

El daño continúa siendo una unidad. Se conservan los avisos mínimos de 500 ms, recuperaciones de 650 ms y la reserva de ataques. La traslación de los ataques de minibosses sigue comprometida en el mundo mediante `enemyMotion`, sin restaurar sus posiciones iniciales.

### Archivos y comprobaciones

Nuevos: `src/game/purgatorio.ts`, `src/app/purgatorio.tsx`, `src/ui/PurgatorioMenu.tsx`, `PurgatorioPortrait.tsx`, `PurgatorioPortrait.web.tsx`, `PurgatorioProgress.ts` y `PurgatorioInterlude.tsx`. Integración en `survival.ts`, `worldEvents.ts`, `CourtyardScreen.tsx`, `Application.tsx`, `session.ts`, `Menus.tsx` y `SurvivalHUD.tsx`. Se añadieron `scripts/check-purgatorio.cjs`, `check-purgatorio-storage.cjs` y `check-purgatorio-portraits.cjs`; se ampliaron las pruebas de menús, HUD y controles existentes.

Las pruebas específicas incluyen **36 victorias individuales con vida original en tres dificultades**, una cadena simulada de **40 combates**, 30 000 muestras de escalado, repetición aleatoria, guardado/recarga/errores, victoria y derrota, pausa, presión sin superposición y **24 finales de ataque de minibosses con ritmo escalado**, además de las regresiones anteriores. Los retratos nativos se verifican con APIs simuladas a DPR 1/2/3; las capturas web muestran los 13 sprites originales.

En la app web real se verificaron menús a 844×390 y 667×375, desbloqueo desde Shielder, reintento, muerte en Imposible, otro encuentro individual en Difícil, los 13 encuentros de Infinito, transición pausada, selección aleatoria 14/15 con vida aumentada, recarga con el roster desbloqueado y vuelta a la supervivencia original. El harness prepara posiciones y reduce la vida enemiga para recorrer la cadena con el botón real de ataque; no hay API de depuración añadida al producto. No se capturaron errores ni cancelaciones de audio en esa revisión. La ejecución web y la exportación Android no equivalen a una prueba en celular físico ni miden FPS o audio/latencia nativos.

Verificación final: **TypeScript y lint sin errores; 33/33 scripts de comprobación aprobados**. La exportación Android final generó Hermes de **4.8 MB con 145 assets**. Se comparó la supervivencia contra la copia anterior fotograma a fotograma durante veinte oleadas en Fácil, Difícil y Dystopia: **21 405 estados idénticos**, excluyendo únicamente el campo nuevo `purgatorio: null`. Los **502 assets originales** conservan sus hashes y no falta ninguno. La comprobación web final repitió la galería resuelta por plataforma, la victoria con el botón real y el desbloqueo persistente. No se instaló un APK ni se probó en un celular físico.
## Eventos de ciudad y continuidad de ataques — 23 de octubre de 2026

Esta sección prevalece sobre las descripciones históricas de invocaciones múltiples y audio. No cambia la ciudad, su suelo, los assets originales ni las versiones instaladas.

- **Zona de recompensa:** una sola zona roja vino en uno de 21 patios transitables asociados a edificios existentes. Se activa desde la oleada 2 o a los 45 s; tras completarla, vuelve a ser elegible cuatro oleadas o 90 s después. Una flecha junto al jugador solo fuera de la zona y a más de 28 unidades de su borde; el icono del premio y el contador se mantienen en el HUD compacto. Hay que permanecer **15 s acumulados** en el círculo: salir pausa el tiempo y regresar lo continúa. La barra circular y el panel muestran el progreso. Entrega una sola mejora real (Vitalidad junto a medicina, Ritmo de acero o Paso ligero según los topes) o 32 EXP cuando no quedan mejoras aplicables. La recompensa aparece encima de la zona antes de desaparecer. Vitalidad respeta la única vida del modo Dystopia.
- **Naves descompuestas:** se reutilizan las seis instancias existentes de los cascos de 80×80 del Tileset (antes denominadas relés en los datos del mapa). Las oleadas 3 y 7 de cada ciclo pueden armar una nave aleatoria; la cercanía o seis segundos inician una alarma. Hay **3 s de advertencia**, tres pulsos del sonido existente `gameplay/wave.wav`, marca sobre la nave y flecha. Después aparece un miniboss del catálogo actual desde un punto de salida transitable, separado del jugador y libre de edificios. Se usan los clips de aparición que existen, o idle si el asset carece de ellos. Si no hay salida segura en la búsqueda acotada, se descarta el evento; no aparece dentro del casco.
- **Un único especial:** `canStartSpecial` centraliza la exclusión entre bosses programados y minibosses de naves. El cupo continúa reservado hasta terminar la muerte del actor. Las alarmas se cancelan si otro especial ocupa el lugar; los programados omitidos no se acumulan. El calendario 5/10 continúa normalmente. Mientras vive un especial llegan NPC comunes, con presión acotada a 12/18/24 según modo; se conserva el pool máximo de 60. Los bosses ya no invocan otros minibosses. Skeleton Summoner conserva hasta tres esqueletos normales de un golpe, que no son especiales.
- **Ataques sin salto:** el salto visible no restauraba una coordenada inicial: procedía del desplazamiento del cuerpo dentro de las celdas de Dagger Mush, Shock Sweeper y Archer. `enemyMotion.ts` documenta sus curvas medidas. El movimiento original se incorpora una sola vez a la posición del mundo mediante colisiones y se descuenta del pivote visual del fotograma. Terminar, recibir un golpe o morir limpia el cursor visual, conserva las coordenadas alcanzadas y mantiene la embestida y los frames originales.

Datos y ajuste: `worldEventSites.ts` separa los patios y salidas del mapa; `WORLD_EVENT_CONFIG` concentra tiempos, oleadas, distancias y presión. Los efectos usan Skia y valores compartidos. El panel React solo recibe cambios de evento, estado o segundo restante. Pausa, mejoras, muerte y segundo plano congelan el reloj de los eventos junto al resto de la partida. La alarma añade un reproductor persistente: 12 en batalla, con el mismo límite de tres voces; la recompensa reutiliza el sonido de cofre.

Prueba específica: `node scripts/check-world-events.cjs` comprueba los 21 patios, seis naves, permanencia/salida/regreso, premio único, topes, reserva compartida, descarte sin cola, NPC durante especiales y 72 ciclos de ataque de los seis minibosses en ambos sentidos y varias posiciones, incluida interrupción por muerte. Las verificaciones de aplicación/exportación se registran al finalizar esta revisión. Las simulaciones y la revisión web no equivalen a pruebas en un celular físico ni miden 120 FPS.


### Verificación de esta revisión

Pasaron TypeScript, lint sin avisos y los **30 scripts `check-*.cjs`**, incluida la simulación de veinte oleadas, topes de 60 NPC y las nuevas pruebas de eventos/continuidad. En Chrome/Skia se verificaron los controles reales, salida/regreso y premio único de zona, pausa exacta, alarma de tres segundos y aparición desde la nave, presión de NPC con un único especial y ataque/recuperación de los seis minibosses. Se inspeccionaron capturas a **844×390 y 667×375**. Los estados avanzados se prepararon solo en el harness de desarrollo, sin API de depuración nueva en el juego. No se capturaron errores de ejecución ni cancelaciones de audio en esa revisión.

La exportación Android final produjo correctamente **Hermes de 4.8 MB y 145 assets**. No es un APK instalado. Los **502 assets originales** conservan sus hashes, sin ausencias ni cambios. No se probó en un celular físico ni se midieron FPS o latencia/audio nativos.

Archivos de esta tarea:
- Nuevos: `src/game/worldEvents.ts`, `worldEventSites.ts`, `WorldEventEffects.tsx`, `enemyMotion.ts` y `scripts/check-world-events.cjs`.
- Integración: `src/game/survival.ts`, `survivalAssets.ts`, `ActorsScene.tsx`, `Scene.tsx`, `CourtyardScreen.tsx`, `src/ui/SurvivalHUD.tsx` y `BattleAudio.tsx`.
- Pruebas existentes ajustadas a un único especial: `scripts/check-survival.cjs`, `check-difficulty.cjs`, `check-battle-render.cjs`, `check-battle-audio.cjs`, `check-gestures.cjs` y `check-follow.cjs`.
- Documentación: `SCENARIO.md` y `assets/sounds/gameplay/README.md`.
## Dificultad y presentaciones de bosses — 23 de octubre de 2026

Esta sección describe la revisión más reciente y prevalece sobre los balances y ataques históricos de los apartados siguientes. Se conservan dependencias, ciudad, suelo, audio de menú/batalla/derrota, controles y recompensas existentes. No se descargaron recursos ni se modificaron imágenes o sonidos originales.

### Modos y escalado acotado

START abre `/difficulty` mediante Expo Router. Cada tarjeta comienza directamente la preparación de una partida; Volver y el botón Atrás del dispositivo regresan al menú sin pantallas de carga adicionales. El modo se mantiene en `Application`, llega a `GameHost` y a `createSurvival`, y se conserva al pausar, abrir ajustes o reintentar. Reintentar siempre crea un estado y una semilla nuevos: no continúa ni revive la partida perdida.

`src/game/difficulty.ts` concentra `DIFFICULTIES`, `WAVE_BALANCE` y `difficultyTuning`. Los ajustes de cantidad, intervalos, velocidad y ritmo de combate están separados por modo. La cantidad conserva la estructura del ciclo de diez oleadas, incluidos recuperación y apoyo reducido en encuentros de jefe. Los comunes siguen muriendo de un golpe.

| Modo | Vida inicial / máxima posible | Multiplicador inicial de cantidad | Velocidad inicial de enemigos | Intervalos de aparición | Ritmo inicial de patrones |
| --- | --- | --- | --- | --- | --- |
| Fácil | 5 / 10 con mejoras | 1 | 1 | 1 | 1 |
| Difícil | 5 / 10 con mejoras | 1.3 | 1.2 | 0.84 | 1.12 |
| Dystopia | 1 / 1 | 1.6 | 1.4 | 0.68 | 1.25 |

Fácil conserva las cantidades del primer ciclo `7/10/12/15/3/9/14/17/20/2`, los 350 ms iniciales entre apariciones y la pausa inicial de grupos de 1550 ms. La primera oleada contiene 7, 10 y 12 comunes respectivamente. A partir de esa base, la velocidad crece suavemente mediante `(oleada-1)/(oleada+35)`, con topes asintóticos de 1.28, 1.50 y 1.72; los patrones también tienen límites. Los intervalos nunca bajan de 150 ms y la pausa entre grupos nunca baja de 650 ms. Se conservan 60 NPC comunes simultáneos, un jefe principal y hasta tres apoyos: la capacidad de dibujo continúa siendo 65 actores incluido Swordmaster.

El calendario no cambia: minibosses en 5/15/25… y bosses en 10/20/30…, aleatorios dentro de los catálogos existentes y sin repetición inmediata. Dystopia tiene tarjeta roja/vino y vida máxima estricta de uno: Vitalidad no se ofrece ni puede aplicarse; cofres y EXP no permiten revivir una partida terminada. Un golpe válido termina la partida. Las mejoras cada tres niveles y los cofres físicos independientes siguen funcionando.

### Presentación antes del combate

Cada jefe principal programado, incluidos los minibosses de oleada, inicia una presentación de **1800 ms** una sola vez por `entityId`. Se muestra su nombre con PixelText, una banda oscura con entrada y salida suaves y su sprite animado con celdas auténticas. `enemyPresentation.ts` almacena la unión alfa auditada de todos los fotogramas de idle; para el idle estático de Shock Sweeper se utiliza su marcha real. Así se centran y escalan las siluetas sin deformarlas ni cortar sus píxeles visibles.

`BossPresentation.tsx` reutiliza exactamente los `SkImage` ya decodificados por `ActorsScene`: no vuelve a cargar texturas ni utiliza un temporizador de React por fotograma. La presentación y los frames consultan el valor compartido de la simulación. Durante ella se congelan combate, apariciones normales y temporizadores de recompensas, mientras joystick, dash y cámara siguen respondiendo sin recibir daño. Pausa y segundo plano congelan también la presentación; reanudar no reinicia su duración ni reproduce otra vez el sonido. Los apoyos invocados conservan su aparición breve en el mundo, sin interrumpir repetidamente el juego con tarjetas.

El evento `bossIntro` activa una sola vez la voz grave existente `assets/sounds/DialogTextSoundEffects/Voices_03/Single_Low_AU_Reverb_v1_wav.wav` (PCM16, estéreo 44.1 kHz, 1.625 s). Comparte el reproductor persistente de avisos de jefe y respeta volumen, silencio, pausa y segundo plano; siguen existiendo once reproductores de batalla y hasta tres voces de efectos simultáneas.

### Repertorios y Summoner

`src/game/bossAttacks.ts` centraliza clips, tiempos de preparación, ventanas activas, alcance, movimiento y recuperación. Los frames se sincronizan con el mismo ritmo que usa la detección de impacto. Se integran 18 acciones entre los siete bosses:

- Guardian: área, Blast y Laser originales.
- Skeleton Summoner: golpe directo de bastón y Summon, con su fila auténtica de 16 frames.
- Dagger Bandit: tajo y Bat Fang Attack.
- Archer Bandit: ataque y evasión con Vanish/Appear originales; no se convierten poses estáticas de salto en fotogramas inventados.
- Dust Jumper: ataque directo y secuencia de salto/aterrizaje, con sus filas reales de 9 y 10 frames.
- Rock boss: melee, giro con cierre, super ataque y alcance frontal con el recurso range attack. Se cargan cuatro strips originales adicionales una sola vez durante la preparación.
- The Tarnished Widow: ataque, variante frontal y salto de ataque.

Se conserva el combate sin proyectiles independientes de la revisión anterior: beams y efectos integrados en las imágenes mantienen impactos locales anunciados. Los avisos reflejan el tipo de acción (área, franja, recorrido de embestida, invocación o evasión) y los golpes comprueban que no atraviesen suelo sólido. Se mantiene el escudo trasero de Shielder. La advertencia nunca es menor de 500 ms y la recuperación nunca menor de 650 ms.

El jefe y sus apoyos comparten una reserva de acción: como máximo uno anuncia/ejecuta un especial peligroso a la vez, con 260 ms adicionales de respiro. La reserva usa el reloj pausado del juego y no bloquea una oleada después de eliminar al actor.

Skeleton Summoner inicia una invocación al vencer su intervalo, incluso fuera de alcance de melee. La pose aparece antes de materializar al NPC, en su ventana activa. Invoca sus esqueletos existentes, de un golpe, con un máximo compartido de tres apoyos. Los intervalos iniciales son 12/10.5/9 s por modo y se reducen suavemente con un mínimo de 7.5 s. Las posiciones se validan contra navegación y obstáculos; una búsqueda sin posición válida no crea un enemigo bloqueado. Entre invocaciones continúa acercándose y golpeando con el bastón. Al liberar slots vuelve a invocar. Los demás bosses conservan sus refuerzos de minibosses acotados.

### Archivos de esta revisión

- Nuevos: `src/game/difficulty.ts`, `bossAttacks.ts`, `enemyPresentation.ts`; `src/ui/DifficultyMenu.tsx`, `BossPresentation.tsx`; `src/app/difficulty.tsx`; `scripts/check-difficulty.cjs`.
- Simulación/render: `src/game/survival.ts`, `survivalAssets.ts`, `enemyAnimations.ts`, `enemyVisuals.ts`, `ActorsScene.tsx`, `BattleEffects.tsx`, `CourtyardScreen.tsx`.
- Integración de interfaz/audio: `src/ui/Application.tsx`, `Menus.tsx`, `session.ts`, `SurvivalHUD.tsx`, `BattleAudio.tsx`.
- Pruebas ampliadas: `scripts/check-survival.cjs`, `check-enemy-catalog.cjs`, `check-battle-render.cjs`, `check-gestures.cjs`, `check-menus.cjs`, `check-survival-hud.cjs`, `check-battle-audio.cjs`.
- Documentación: `SCENARIO.md` y `assets/sounds/gameplay/README.md`.

### Verificación realizada

Pasaron TypeScript (`tsc --noEmit`), Expo lint y las **29 pruebas** `scripts/check-*.cjs`. La nueva prueba comprueba 15.000 planes de oleada y su ejecución como worklets serializados, valores iniciales de Fácil, curvas acotadas, orden de dificultad, velocidad real de NPC, vida única terminal y exclusión de Vitalidad, presentaciones únicas de los siete bosses y un miniboss, pausa exacta, todos los ataques alternativos, invocación recurrente con ataques directos y coordinación de cuatro actores en los tres modos. La simulación de supervivencia completó veinte oleadas y cuatro encuentros de jefe en 6610 frames sin bloqueos.

Se revisaron **1085 celdas originales en 27 texturas**, incluyendo comparaciones píxel a píxel de los nuevos strips contra sus hojas. Los 502 assets originales conservan sus hashes, sin modificaciones ni ausencias.

La app real se ejecutó en Chrome a 844×390 y 667×375: selección de los tres modos, tarjeta vino, presentación programada, controles activos durante la entrada, pausa/reanudación sin repetirla, las siete tarjetas animadas, todos los patrones, invocación y melee del Summoner, muerte de un golpe y reintento como partida nueva en Dystopia. Los estados avanzados se prepararon mediante el harness de fibras React de desarrollo, sin añadir API de depuración al producto. En esta ejecución no hubo errores ni cancelaciones de audio capturadas.

La exportación Android generó correctamente un bundle Hermes de 4.7 MB con 145 assets. **No es un APK instalado, no se probó en un celular físico y no se midieron 120 FPS ni latencia/audio táctil nativos.** Las simulaciones y la revisión web verifican lógica y presentación, no garantizan el balance definitivo ni rendimiento idéntico en todos los dispositivos.


## Integración actual — catálogo completo, recompensas y controles (23 de octubre de 2026)

Esta revisión prevalece sobre las descripciones anteriores de selección de enemigos, recompensas y audio. Los apartados previos se conservan como historial; la ciudad, el suelo uniforme, los assets originales y las versiones de Expo/React Native/Skia/Reanimated/Worklets permanecen intactos.

### Enemigos y animaciones originales

Se integran los **seis minibosses** Shielder, The Evil Sage, Archer, Bomb Droid, Dagger Mush y Shock Sweeper; y los **siete bosses** Guardian, Skeleton Summoner, Dagger Bandit, Archer Bandit, Dust Jumper, Rock boss y The Tarnished Widow. Skeleton Summoner puede invocar además Skeleton Unarmed, Skeleton Archer y Skeleton Swordsman, con sus animaciones originales y un golpe de vida. Se mantienen Ghoul, Spitter y Summoner como los tres NPC comunes.

`enemyCatalog.ts` centraliza estadísticas y ventanas de ataque; `enemyAnimations.ts` contiene recortes, pivotes y clips comprobados; `enemyVisuals.ts` carga las imágenes y `survivalAssets.ts` selecciona los fotogramas mediante `bossFrame`. Se usan idle, desplazamiento, ataque y muerte realmente disponibles, así como apariciones cuando el recurso las contiene. Las filas, columnas y orientaciones corresponden a los originales inspeccionados, incluidos los strips verticales. No se inventan fotogramas ni se modifican las imágenes fuente.

Las oleadas 5, 15, 25… eligen entre los seis minibosses; las 10, 20, 30… entre los siete bosses. Una semilla nueva por partida alimenta el generador determinista de la simulación. Cada categoría evita repetir inmediatamente su última entidad, también entre invocaciones. Los bosses invocan minibosses aleatorios; Skeleton Summoner usa sus tres esqueletos de apoyo en su lugar. Se conserva un máximo de tres invocados y de 60 NPC comunes simultáneos, con apariciones válidas fuera de edificios y del espacio inmediato del jugador.

El combate continúa siendo físico y sin proyectiles. Cada ataque se anuncia, fija la dirección y aplica daño durante las poses activas verificadas de su animación. Shielder solo recibe daño por detrás; un bloqueo frontal consume el serial del golpe y no permite contarlo otra vez al rodearlo. La muerte reproduce su clip, desactiva colisiones y concede EXP/botín una sola vez. Los esqueletos de apoyo conceden EXP, sin cofres propios. La oleada espera también a sus invocados antes del descanso.

### Elección de mejora adicional al cofre

La curva lenta de EXP se mantiene: `40 + 20*(L-1) + 5*(L-1)^2`. Los niveles ordinarios no interrumpen la partida. **Cada nivel 3, 6, 9… concede una elección de power-up entre hasta tres mejoras disponibles distintas**, además del cofre físico que ya se entregaba. El panel detiene simulación y controles hasta elegir. Las opciones conservan sus topes y afectan únicamente a la partida actual.

El cofre es una recompensa independiente: al acercarse reproduce su apertura, aplica automáticamente su premio y muestra el texto encima antes de desaparecer; nunca pide elegir. La elección y el cofre no se sustituyen. `pendingUpgrades` conserva todos los hitos cruzados por un lote de EXP; `upgradeOfferId` rechaza pulsaciones obsoletas o duplicadas y la EXP sobrante se conserva. Los cofres mantienen su propio control de recompensa única y sus cargas limitadas. Si todas las mejoras llegaron a sus topes, no se presenta una elección sin opciones y el cofre conserva su recuperación de vida.

### Audio actual

El menú vuelve al `assets/sounds/music/menu.mp3` original. La escena jugable utiliza `heavy_battle_1_bpm190.mp3` en bucle; su licencia CC0 y procedencia están registradas en `assets/sounds/music/BATTLE_LICENSE.md`. Al morir se detiene esa pista y se reproduce `die menu.mp3`; reintentar o abandonar la partida detiene la música de derrota. Glitched conserva su uso exclusivo durante cargas.

Ningún sonido en ejecución depende ya de la carpeta `assets/sounds/battle/`, que se conserva sin borrar archivos. Los efectos portables de `assets/sounds/gameplay/` derivan de otros originales existentes de `Audio sounds effect`: ataque `spaceTrash3`, dash `phaseJump4`, daño `highDown`, muerte de enemigo `spaceTrash4`, subida de nivel `powerUp7`, cofre `powerUp2`, oleada `twoTone2`, aparición/derrota de jefe `lowRandom` y ataque de miniboss/boss `spaceTrash2`. `sources.json` registra fuente, transformación y hashes; `scripts/build-gameplay-audio.cjs` reproduce las conversiones sin alterar los originales.

**Recoger EXP no reproduce sonido**; la subida de nivel sí. `bossAttack` señala el inicio de cada ataque de miniboss/boss sin duplicarlo por fotograma. Los reproductores persistentes limitan voces, respetan volumen y silencio y se detienen al pausar, pasar a segundo plano o salir de la partida; los sonidos no se acumulan para sonar al volver. Se mantiene Expo Audio compatible con SDK 57, sin actualizar dependencias.

### Controles, iconos y enlaces

Ajustes incluye **Configurar controles**, accesible desde menú o pausa: tamaño del joystick, zona muerta, opacidad, altura del conjunto táctil y orden de ataque/dash. Se pueden restablecer los valores predeterminados. `ControlPreferences.ts` aplica los cambios de inmediato y los guarda con AsyncStorage; una lectura tardía no sobrescribe cambios hechos por el usuario. Se validan rangos y tipos, las escrituras se ordenan y un fallo conserva la configuración de la sesión mostrando un mensaje.

Ataque y dash conservan el tamaño táctil existente y usan los nuevos símbolos sin letras `assets/ui/controls/attack.png` y `dash.png`, con sus fuentes SVG. `ControlArt.tsx` los muestra sin interceptar toques ni añadir animaciones de fade. La posición del jugador, la cámara y las animaciones siguen actualizándose mediante valores compartidos y worklets.

Los botones del creador usan las URL de `src/ui/links.ts` y llaman a `url => Linking.openURL(url)`. Este wrapper conserva el contexto de `Linking`: pasar su método sin enlazar provocaba el error nativo al acceder a `this._validateURL`. La apertura se intenta directamente y conserva el manejo de errores. **Apoya a este creador** utiliza `https://buymeacoffee.com/manzato`; **Sobre el creador** utiliza `https://portfolio-two-gamma-if8rur9x6r.vercel.app/`. Un fallo muestra un mensaje en Ajustes; abrir el navegador desde una partida pausada mantiene esa pausa al regresar. Esto documenta las URL y el manejo de errores, sin garantizar la disponibilidad externa de esos sitios.

### Verificación de esta integración

Pasaron TypeScript, Expo lint y las **28 pruebas** `scripts/check-*.cjs` del proyecto. La simulación comprueba 20 oleadas, 52 apariciones válidas de jefe, 60 NPC simultáneos, las ventanas físicas y las muertes de las 16 entidades del catálogo, el escudo de Shielder y las invocaciones limitadas. Tres mil selecciones deterministas cubren los catálogos completos sin repetición inmediata. También se verifican elecciones adicionales cada tres niveles, desbordes de EXP/recompensas, tokens contra elecciones duplicadas y cofres automáticos independientes.

Las pruebas de configuración comprueban datos corruptos, límites, hidratación tardía, escritura ordenada, recuperación tras fallos y restablecimiento persistente. Las de audio comprueban selección de pistas, derrota, pausa, silencio y recogida de EXP sin efecto. También se ejecutó la app web a 844×390 y 667×375: movimiento, ataque y dash reales; ajustes persistentes tras recargar; selección de nivel 3 con cofre adicional; render de las 16 familias en una plaza despejada; ataques, invocación, pausa, derrota, reintento y regreso al menú. Los estados avanzados se prepararon en el harness mediante fibras de React de desarrollo, sin hooks de depuración en producción. Se verificaron las URL exactas de las dos ventanas externas interceptando sus destinos, sin garantizar la disponibilidad remota. Los iconos conservaron áreas de 88×88 y 72×72; se corrigió el desbordamiento inicial de sus PNG exportados a 4x. Los 502 assets originales conservaron sus hashes, sin ausencias ni modificaciones. La exportación Android de esta revisión terminó correctamente: bundle Hermes de 4.7 MB y 141 assets, con los nuevos iconos, las 23 texturas enemigas de juego y los recursos de audio actuales; no es un APK instalado ni una prueba en dispositivo. En Chrome se registró por separado un `AbortError` al pausar una reproducción: el módulo web instalado de Expo Audio no captura la promesa de `HTMLAudioElement.play()`. No hubo otros errores de ejecución. **No se ha probado en un celular físico ni medido 120 FPS, latencia audible ni apertura nativa del navegador.**



## Historial previo — balance y combate físico

Esta sección describe el juego actual y sustituye las limitaciones de las integraciones históricas documentadas más abajo. Se conservan la ciudad, su suelo, los recursos originales y las versiones de Expo/React Native/Skia/Reanimated/Worklets.

### EXP lenta y mejoras cada tres niveles

`src/game/survival.ts` centraliza el balance. El coste para pasar del nivel L al siguiente es `40 + 20*(L-1) + 5*(L-1)^2`: 40, 65, 100, 145 y 200 EXP para los primeros saltos. Los comunes conservan sus valores 2/3/4, por lo que ya no se sube de nivel cada pocos enemigos. La EXP sobrante nunca se pierde. Subir de nivel no pausa ni abre un panel.

Las seis mejoras existentes solo se conceden al abrir los cofres de nivel 3, 6, 9…: Paso ligero, Dash calibrado, Filo amplio, Imán de suministros, Vitalidad y Ritmo de acero. Se selecciona automáticamente una mejora disponible, respetando sus topes; si ya están todas completas, el cofre cura. Los cofres de botín de miniboss y boss dan suministros: curan hasta 2 de vida, o dan 16 EXP si la vida ya está completa. Así no adelantan power-ups fuera de los hitos de tres niveles.

### Cofres físicos y recompensa visible

Los cofres de nivel aparecen cerca del jugador en posiciones verificadas contra los edificios y otros cofres. Al acercarse, pasan de closed a opening; la animación original dura 900 ms. Al terminar se aplica exactamente una recompensa y se muestra su nombre flotando encima durante 1800 ms. Después el texto y el cofre se desvanecen y desaparecen. No hay elección ni interrupción de la partida. Pausa congela también apertura, texto, desaparición y concesión de recompensa.

`Chest 3-Silver.png` contiene 40 celdas de **22×26**. Se usan la celda 0 cerrada, las 24–39 para apertura y la 39 al mostrar la recompensa. No se recortan dos cofres como uno. `BattleEffects.tsx` dibuja los cofres y sus textos con atlas de Skia y la fuente UI existente, sin React por fotograma. Máximo seis cofres visibles; el exceso se acumula en cargas separando las de mejora de las de suministro. Una misma apertura nunca da dos recompensas.

### Oleadas, 60 NPC y combate cuerpo a cuerpo

Se mantiene el ciclo infinito de diez oleadas: Shielder en 5/15/25…, Rock boss en 10/20/30… y descanso aproximado de 3 segundos. El primer ciclo usa 7/10/12/15/3/9/14/17/20/2 comunes, con pocos apoyos junto a jefes. Cada ciclo aumenta la cantidad y el ritmo hasta **60 NPC por oleada y 60 simultáneos**. Ghoul, Spitter y Summoner mantienen sus animaciones originales y mueren con un impacto válido. Una cuadrícula espacial limita los vecinos revisados para la separación.

Los jefes y minibosses **no generan proyectiles**. Se acercan mediante navegación y realizan ataques físicos anunciados, con orientación fijada durante el golpe. Shielder usa 17 frames reales de melee y embiste a 160 unidades/s durante la parte activa de su movimiento; solo recibe daño desde su espalda. El bloqueo frontal también consume el serial del ataque para impedir girar durante el mismo golpe y contarlo dos veces. Rock usa los 23 frames de `Melee attack.png`, con orientación original corregida, aproximación lenta y golpe pesado. Las ventanas de daño están sincronizadas con sus frames auditados.

Rock puede invocar un Shielder cada 12 segundos, hasta tres simultáneos. Los invocados conservan escudo, melee y salud propia. La oleada no termina hasta eliminarlos junto con todos los NPC y apariciones pendientes. Las apariciones verifican navegación y distancia de 300–460; los jefes tienen margen adicional de silueta contra techos. Los avisos visuales son locales al alcance físico; se retiraron los abanicos y anillos radiales de disparo.

### Vida, daño y HUD compacto

El jugador empieza con 5 de vida; contacto o ataque físico quita 1, con 1.1 segundos de invulnerabilidad y parpadeo. Dash permite escapar sin daño durante el impulso. `damageFeedback.ts` añade un temblor amortiguado de 280 ms y un destello tenue al perder vida. Se mueve solo la cámara del mundo, los controles permanecen fijos y el temblor también respeta los límites de cámara y la pausa.

Arriba a la izquierda quedan únicamente oleada y enemigos restantes, en tamaño reducido. El contador incluye comunes pendientes/vivos y minibosses invocados. Abajo en el centro se muestran vida, nivel y dos barras compactas de vida/EXP, entre las zonas del joystick y los botones. El jefe principal conserva su nombre y barra independiente arriba en el centro. Todo el HUD es transparente a los toques. A cero de vida se congela el juego y aparecen Reintentar y Menú principal. Reintentar restablece completamente la sesión.

### Audio de suspenso

Dash reproduce una variante de teletransporte derivada del `phaseJump2` existente. El ataque usa un soplido de filo suave de 170 ms derivado de `spaceTrash5`, filtrado y con envolvente, a menor volumen. Los originales se conservan; los hashes y copias WAV portables están registrados en `assets/sounds/battle/sources.json` y se reproducen con `scripts/build-battle-audio.cjs`.

La música del menú es **Lost in a bad place** de congusbongus; la de la partida es **Insistent** de yd. Ambas son loops existentes CC0 de ambiente oscuro, suspenso y paranoia; no se presentan como composiciones exclusivas. Procedencia, originales OGG, hashes y copias PCM se conservan en `assets/sounds/music/SUSPENSE_LICENSE.md`. Las pistas épicas previas quedan intactas sin usarse. Glitched sigue siendo exclusivo de carga.

Diez reproductores persistentes y máximo tres efectos simultáneos. Volumen/silencio, pausa, segundo plano y desmontaje se respetan sin duplicar música o acumular sonidos pendientes. Se usa Expo Audio ~57.0.5 compatible con SDK57, sin añadir dependencias ni permisos.

### Verificación de esta revisión

Pasaron TypeScript, Expo lint y las **26 pruebas** `scripts/check-*.cjs`. También pasó la exportación Android Hermes (bundle, no APK instalado). La comparación SHA-256 de los 502 assets originales confirmó cero modificaciones y cero archivos ausentes. La simulación completa recorre 20 oleadas y cuatro jefes, comprueba 52 ubicaciones de jefes, saturación de 60 comunes, escudo frontal/espalda, melee, ausencia de balas, máximo tres invocados, EXP lenta, cofres automáticos sin duplicados, hitos 3/6/9, desborde de recompensas y pausa. Es una simulación con posiciones controladas, no una prueba de dificultad humana.

Se ejecutó la app web real a 844×390 y 667×375. Se prepararon estados avanzados mediante el árbol React de desarrollo (sin añadir trucos al juego): EXP 8 sin subida, umbrales 40/65, cofre alcanzado con joystick real, apertura/pausa/recompensa/texto/desaparición, golpe frontal bloqueado y trasero válido, Rock cuerpo a cuerpo e invocación, daño/temblor, render de 60 NPC, HUD compacto, silencio, derrota y reinicio. No hubo errores de ejecución. Los sprites y textos se revisaron en capturas. No se ha instalado ni medido FPS, audio audible o respuesta táctil en un celular físico; no se afirma rendimiento de 120 FPS.

## Pantallas de carga (estado actual)

Los bosses y mini bosses usan un factor de escala de 0.30, con aumentos enteros y proporciones originales. Sus cuerpos se centran sobre los nombres, con al menos 14 px de espacio y margen para el movimiento ambiental. Los nombres se centran en su columna. Los NPC conservan su escala y encuadre.

El rediseño usa solo DYSTOPIA a la izquierda, el nombre de la criatura a la derecha y un consejo corto en la franja inferior. Se retiraron categorías, descripciones, etiquetas de preparación, el rectángulo diagonal y la tipografía del sistema. Las criaturas siguen usando sus animaciones originales; no se añaden entidades ni mecánicas al combate.

### Transiciones y duración

`Application.tsx` conserva el origen durante un fade negro continuo. La capa nativa cubre en 500 ms, mantiene un fotograma opaco y revela en 560 ms. Solo se utiliza para entrar a la pantalla de carga al iniciar o abandonar una partida. Abrir el destino, ajustes, pausa o pulsar sus botones no introduce otro fade.

Flujo: `coverSource -> awaitVisual -> revealLoading -> loading -> destino listo`. El arranque abre directamente el menú. Las cargas solo aparecen al iniciar o abandonar una partida. El juego y sus controles permanecen detenidos hasta terminar la ficha. Los callbacks verifican identidad y fase para ignorar respuestas obsoletas.

Se precargan la criatura elegida, el banner y la fuente bajo la pantalla saliente. La cortina espera también al fondo y los textos. La criatura entra desde la derecha en 400 ms, sin retraso previo, durante revealLoading: ya es visible mientras se levanta la oscuridad. No avanza bajo la cortina opaca ni en background. Conserva sus frames originales y se detiene al salir.

`useLoadingMinimum.ts` conserva cinco segundos completos visibles después del reveal, sin contar background ni tiempo oculto. También espera la preparación real del destino. Al cumplir ambas condiciones retira la ficha directamente, sin otro fade. Ante errores permite volver al menú sin esperar ese mínimo.


### Verificación de la respuesta del menú

TypeScript, Expo lint y las 21 pruebas scripts/check-*.cjs pasan. Tras extender el clic temprano al icono de pausa se repitieron menús, seguimiento, gestos, TypeScript y lint sin errores. La app web real se revisó a 844×390 y 667×375: criatura visible durante el reveal, cinco segundos conservados (5426 ms observados), solo cuatro fases de oscuridad para las dos entradas a carga y sin fades al terminar ni navegar en pausa/ajustes. No hubo errores de ejecución ni nuevos reproductores al navegar. La solicitud de reproducción del clic ocurrió 57.7 ms después de pointerdown, antes de soltar: mide despacho en navegador de desarrollo, no latencia audible en un celular. No se midió audio nativo ni FPS en un teléfono.

### Arte y tipografía

La carga reutiliza MenuBackdrop como escenario estático, más oscuro, y espera que sus imágenes estén listas antes de revelarlo. `assets/ui/loading-tip-mist.svg` es la nueva base del consejo: vectorial, suave, sin pixel art ni ornamentos recortados. Su PNG transparente se exporta a 1600×180 y utiliza filtrado lineal, mientras los sprites conservan nearest. El texto se centra horizontalmente y se ancla abajo respetando el área segura; los originales anteriores se conservan sin usarse.

`PixelText.tsx` / `.web.tsx` dibujan todos los nombres, consejos y mensajes de error de las fichas con un atlas de 60 glifos derivado del pack UI. Veintiuna letras reutilizan sus píxeles originales; las faltantes y las marcas españolas se construyen con los mismos trazos. `assets/ui/font/README.md` y `scripts/create-pixel-font.py --check` documentan y verifican la derivación. No se descarga ninguna fuente. Native usa rasters nearest cacheados; web recorta el atlas con imágenes nativas sin crear superficies Skia por letra.

Los consejos son más oscuros y dos letras tienen fallos breves de iluminación a ~1.3 y ~3.7 segundos. El resto del mensaje permanece legible. El título conserva sus letras y parpadeos anteriores, sin efectos de viscosidad. El fallback web previo a CanvasKit también utiliza negro, sin texto del sistema.

### Catálogo y consejos

Se conservan **16 entidades y 172 fotogramas originales**, con escalas uniformes, transparencia y nearest. Los cuatro strips verticales usan `columns: 1`; las demás tiras recorren columnas en la fila auditada. El anclaje corporal de Shock Sweeper impide que su arma larga desplace la cabeza fuera del encuadre. Las cadencias de 8–12/s son decisiones de presentación, no metadatos del PNG.

| Entidad | Categoría | Celda | Fotogramas | Disposición |
| --- | --- | --- | --- | --- |
| Ghoul | NPC | 62 × 33 | 9 | horizontal |
| Spitter | NPC | 57 × 39 | 6 | horizontal |
| Summoner | NPC | 46 × 44 | 6 | horizontal |
| Shielder | Mini boss | 129 × 46 | 6 | horizontal |
| The Evil Sage | Mini boss | 52 × 21 | 9 | horizontal |
| Guardian | Boss | 166 × 96 | 24 | horizontal |
| Skeleton Summoner | Boss | 132 × 83 | 12 | horizontal |
| Dagger Bandit | Boss | 128 × 78 | 8 | horizontal |
| Archer | Mini boss | 174 × 25 | 20 | vertical |
| Bomb Droid | Mini boss | 32 × 32 | 6 | vertical |
| Dagger Mush | Mini boss | 144 × 80 | 5 | vertical |
| Shock Sweeper | Mini boss | 88 × 30 | 8 | vertical |
| Archer Bandit | Boss | 85 × 112 | 8 | horizontal |
| Dust Jumper | Boss | 42 × 91 | 12 | horizontal |
| Rock boss | Boss | 201 × 94 | 24 | horizontal |
| The Tarnished Widow | Boss | 188 × 90 | 9 | horizontal |

Hay 14 consejos abreviados sobre joystick, dash, ataques, Ghoul, oleadas, exploración, cámara y pausa. Los dos mensajes sobre mini bosses y bosses aclaran que pertenecen a estas fichas y no a las oleadas actuales. Ni criatura ni consejo se repiten en dos cargas consecutivas de la misma sesión.

`loadingImages.ts` conserva las imágenes decodificadas de las fuentes auditadas y la franja compartida. Solo precarga la entidad elegida, no todas las criaturas; comparte peticiones entre precarga y componente, permite reintentar fallos y descarta actualizaciones desmontadas. `preloadPixelFont()` comparte la preparación del atlas. No se generan animaciones a partir de imágenes estáticas ni se alteran los originales.

`AudioProvider.tsx` conserva cinco reproductores persistentes. `assets/sounds/music/glitched.mp3` suena en bucle durante la carga, con volumen de música/silencio y prioridad exclusiva sobre `menu.mp3`. Se detiene al desmontar la ficha o pasar a background; los cambios de pantalla no crean copias. Se mantienen los tres efectos de UI y no se añade audio de combate.

Archivos del rediseño: `Application.tsx`, `LoadingScreen.tsx`, `loadingImages.ts`, `loadingPresentation.ts`, `loadingCatalog.ts`, `Root.web.tsx`, los nuevos `DarknessTransition.tsx`, `darknessMotion.ts`, `loadingArt.ts`, `useLoadingMinimum.ts`, `PixelText.tsx/.web.tsx`, `pixelFontAsset.ts`, `pixelGlyphs.ts`, `pixelTextLayout.ts`, `pixelTextTypes.ts` y `usePixelFlicker.ts`; nuevo arte y atlas bajo `assets/ui`. Se amplían las pruebas de menú, carga, caché y worklets, y se agregan las de oscuridad y fuente. Sin instalaciones ni cambios de versiones.

Verificación de la revisión anterior: pasaron TypeScript, Expo lint sin avisos, las 21 pruebas `scripts/check-*.cjs`, la reproducción del atlas (`create-pixel-font.py --check`), Expo Doctor 21/21 y `expo install --check`. Se comprobaron los 172 recortes y 64 composiciones. Las pruebas virtuales verifican cinco segundos visibles, pausa/reanudación del cronómetro, entrada sin avanzar oculta, precarga compartida, callbacks obsoletos y serialización nativa de oscuridad/entrada.

Se ejecutó la app web real y se inspeccionaron las 16 fichas a 844×390, más revisiones a 667×375, 932×430 y 1200×675. Se capturaron entrada, ficha asentada, cierre oscuro desde menú, partida y regreso al menú. Todas las criaturas estaban preparadas antes de revelar su ficha; todas permanecieron al menos cinco segundos. Se comprobó Glitched exclusivo, ausencia de duplicados, pausa conservada y ningún error de ejecución. La exportación Android Hermes pasó con el banner y el atlas incluidos; es un bundle, no un APK instalado.

Los SHA-256 de los 502 assets originales permanecen intactos. Se conservan dependencias, escenario, jugador, controles y oleadas. No hubo prueba en un celular físico: audio nativo, comportamiento del dispositivo y FPS físicos siguen pendientes.

Revisión del fade y acceso: TypeScript, lint y las 21 pruebas pasan. Se verificó el arranque directo al menú sin ficha ni precarga de criaturas; iniciar y abandonar la partida conservan sus cargas de cinco segundos. Se revisó la app web a 844×390 y 667×375, con escenario oscurecido, consejo anclado al borde inferior y el nuevo asset suave. Una captura de 473 fotogramas comprobó continuidad de opacidad entre cover/hold/reveal (paso máximo observado 0.097), sin salto en los relevos. Esta medición es del navegador de prueba, no de un celular físico.

## Menú ambiental animado (estado actual)

El título usa ocho assets separados de `assets/title/letters/`, uno por letra de DYSTOPIA. Cada uno tiene variantes @2x y @3x para preservar los bordes en distintas densidades. Se derivan de los glifos del pack UI; la Y combina la bifurcación de X y el asta de I. `scripts/create-title-letters.py` permite regenerar y comprobar los 24 PNG sin alterar los originales.

`InfectedTitle.tsx` mantiene un ciclo de 18 segundos: Y, T e I tienen breves fallos de iluminación escalonados, como focos defectuosos. Las demás letras permanecen encendidas. Se eliminaron líquido, gotas, filamentos y barrido de brillo. No se actualiza React por fotograma; la animación se detiene al salir o pasar a segundo plano.

`MenuMotion.tsx` / `menuButtonPose.ts` añaden flotación de menos de dos píxeles y temblores escalonados de medio segundo cada 14 segundos. Solo se mueve la cara visual; los Pressable conservan sus áreas táctiles estables. El movimiento se detiene en background y descarta el primer delta al volver.

`MenuBackdrop.tsx` / `menuAmbient.ts` dibujan cuatro Ghouls ambientales con las filas originales de aparición, despertar, caminar y muerte. Sus ciclos están desfasados y se repiten en calles libres del lado derecho, sin instanciar encuentros ni modificar las oleadas. Se conserva el boss ambiental. Escenario, animaciones y capas siguen en Skia/Reanimated.

`useMenuGyroscope.ts` añade parallax nativo con expo-sensors ~57.0.3, instalado mediante Expo y compatible con Expo Go del SDK57. Integra velocidad angular a un objetivo amortiguado, limita el desplazamiento a 18x12 unidades, con una respuesta un 50% mayor y suaviza la respuesta. La suscripción permanece a menos de30Hz solo con el menú activo; se limpia al entrar a la partida o al pasar a background. En web o sin sensor se conserva la deriva ambiental suave, sin solicitar permisos del navegador.

Verificación: TypeScript, lint, `check-menu-motion`, `check-menu-ambient`, `check-menus`, `check-audio`, `check-follow` y `check-worklet-config` pasaron. El generador verifica píxeles, paletas, transparencia y densidades de las letras. La app web real se revisó durante un ciclo completo de18segundos y en dos tamaños horizontales: parpadeos, NPC, navegación, enlaces, audio y escena pausada idéntica píxel a píxel. La exportación Android Hermes pasó con los 24 PNG de letras incluidos; Expo Doctor pasó 21/21 y Expo confirmó dependencias compatibles. Los 502 assets originales mantienen sus hashes. El giroscopio se comprobó con lecturas simuladas, límites, amortiguación y cleanup; falta comprobarlo físicamente en un celular. No se midieron FPS físicos.

## UI con assets originales (revisión actual)

La presentación actual se simplificó: principal solo con Dystopia, START y SETTINGS; sin textos de sector, transmisión, lemas ni etiquetas duplicadas bajo los rótulos. El título usa letras separadas y parpadeos de iluminación; la animación se detiene al salir o pasar a segundo plano. Los enlaces muestran solo sus nombres españoles, y la pausa en partida es un icono de 48x44 con etiqueta accesible. La confirmación conserva únicamente el aviso de pérdida de partida. Pasaron TypeScript, lint, pruebas de menú/pausa y revisión web en dos tamaños horizontales.


Se inspeccionaron visualmente los 54 PNG de `assets/assets/UI` (la carpeta UI disponible en este proyecto). Ahora los menús y controles usan 21 imágenes originales del pack, sin modificar ni sustituir los archivos fuente.

- `UI - Words/Words without BG`: START, SETTINGS, RESUME, MAIN MENU, BACK, QUIT, CONTINUE y CREDITS. Se recorta solo el texto en y=7, altura18; se conservan sus píxeles y proporciones. Debajo se mantienen las etiquetas españolas para que todas las acciones sigan siendo claras. El botón vacío Words15 aporta sus bordes para enlaces y botones secundarios.
- `UI - Borders and HP/UI - 16x16 UI Tileset.png`: marcos tecnológicos y geométricos de 48x48, recortados en (160,64) y (112,64), esquinas de16px. Nueve divisiones conservan las esquinas al adaptar paneles y botones. Se usa también el ornamento (14,40,68,13).
- `UI - ICONS`: engranaje, gamepad, nota musical, volumen, silencio, cerrar, lista y flechas; se respetan los límites alfa de cada icono. El joystick y botones de ataque/dash mantienen exactamente sus zonas táctiles y gestos, con marcos del pack; el botón PAUSAR utiliza el icono de lista.
- `UI - Sliders/Sliders 35x16.png`: trece posiciones reales de la fila y=16, seleccionadas por volumen. Son estados discretos, no animaciones. Silencio emplea los iconos y un botón del pack.

Los rótulos no son un alfabeto completo: faltan F, H, J, Y y Z. Por ello el título Dystopia y las explicaciones en español conservan texto nativo; no se inventaron glifos ni se cambiaron textos españoles por palabras incompletas. No se utiliza el material de HP/ammo para crear un HUD de combate.

`src/ui/uiAssets.ts` separa imágenes y coordenadas. `PixelArtRenderer.tsx` carga las imágenes una vez y rasteriza recortes con muestreo nearest en superficies CPU a la densidad física del teléfono. Una caché LRU de128 entradas reutiliza imágenes; se liberan surfaces y snapshots y no hay un Canvas/GL activo por icono. `PixelArt.web.tsx` usa los mismos recortes sobre PNG originales con clipping e image-rendering pixelated, sin crear superficies CanvasKit adicionales.

La revisión web real pasó a 844x390 y 667x375: principal, ajustes, pausa, confirmación y controles sin cortes ni deformaciones. Pasaron TypeScript, lint y las pruebas de assets UI, menús, audio, seguimiento/pausa y gestos. La escena pausada permaneció idéntica píxel a píxel y los dos enlaces externos funcionaron. La exportación Android Hermes también pasó e incluye los 21 PNG originales de UI; no es un APK. La revisión en un celular físico sigue pendiente.

Se conservan navegación, confirmación de abandono, pausa completa, oleadas, audio y enlaces. No se agregaron dependencias ni se cambiaron versiones. `check-ui-assets.cjs` valida PNG reales, alfa/paletas, letras completas, iconos, posiciones de slider, nueve divisiones, densidades, caché limitada y liberación de recursos. `check-menus`, `check-follow` y `check-gestures` se adaptaron conservando sus comprobaciones funcionales.

## Interfaz y audio (integración actual)

La app prepara el menú principal bajo una pantalla de carga y después lo muestra. Expo Router organiza `src/app/{index,game,pause,settings}.tsx`; `src/app/_layout.tsx` monta la sesión una sola vez. `src/ui/Application.tsx` conserva `CourtyardScreen` durante pausa y ajustes. Volver al menú exige confirmar el abandono y desmonta la partida; Comenzar crea otra desde cero. Los ajustes de audio se conservan.

- **Principal:** título Dystopia, Comenzar partida y Ajustes. Fondo independiente, tétrico y horizontal con Picture de Skia, desplazamiento sutil, niebla y luz. No instancia NPC ni modifica oleadas.
- **Pausa:** botón PAUSAR arriba a la derecha, Reanudar, Ajustes y Menú principal. Detiene jugador, cámara, NPC, oleadas, navegación, recuperación de dash y animaciones ambientales. Los controles desaparecen y se restablece el joystick. El primer delta al reanudar se descarta; no recupera tiempo transcurrido. Cambiar de aplicación desde una partida abre pausa; volver de un enlace o de background nunca reanuda una pausa explícita.
- **Ajustes:** música y efectos de 0–100%, pasos de 10% con botones +/− y selección por segmentos, y silencio global. Cambios inmediatos, compartidos y persistidos con AsyncStorage; fallos de lectura/escritura son visibles y no bloquean el juego. Debajo se muestran Apoya a este creador y Sobre el creador, abiertos por `Linking.openURL` al navegador del sistema, con error visible si falla.

### Recursos del menú

Sin alterar imágenes o sonidos originales. El fondo usa `Tileset.png`, Gun Shop, Resturant, Shed y Lookout Tower. **Skeleton Summoner-Walk.png** contiene doce celdas reales de **132×83** en una franja RGBA de 1584×83; camina a 10 fps, primera aparición tras 3,5 s y siguientes cada 31 s. Solo existe en el fondo, detrás de los botones, sin interacción ni combate.

Audio con **expo-audio ~57.0.5**, compatible con SDK57 e incluido en Expo Go. Una instancia persistente de `assets/sounds/music/menu.mp3` en bucle solo en principal y sus ajustes; se pausa al comenzar la partida y en background. Tres efectos PCM WAV originales de `DialogTextSoundEffects/Skeleton_01/Skeleton_Single_v{1,2,3}_wav.wav` para pulsación, pausa y reanudación. El hook libera los reproductores al desmontarse. Los efectos se precargan con downloadFirst y se disparan al presionar los botones, sin esperar a soltarlos ni a resolver seekTo(0). La reproducci?n se solicita inmediatamente despu?s del seek, como indica SDK 57; resolverlo tarde nunca vuelve a reproducir un clic. No se crean copias al navegar y se respeta silencio/volumen. No se añade música a la partida, sonidos de combate ni permisos de micrófono o audio en segundo plano.

### Archivos e instalación

Se agregan `src/ui/{Application,session,Menus,MenuBackdrop,AudioProvider,audioSettings,links,Root}.tsx/ts`, la variante `Root.web.tsx`, las rutas de `src/app/` y `scripts/check-{audio,menus}.cjs`. Se actualizan App.tsx, package.json/lock, app.json, CourtyardScreen.tsx, Scene.tsx, check-follow.cjs y check-gestures.cjs. La entrada es `expo-router/entry`; la variante web carga CanvasKit antes de importar la escena. El renderizador móvil sigue siendo Skia nativo.

Dependencias instaladas con Expo: Router y sus módulos requeridos (Linking, Constants, SafeAreaContext, Screens), Audio, Asset y AsyncStorage. React DOM y React Native Web se usan para revisión web. Se conservan Expo ^57.0.31, RN0.86.3, React19.2.3, Skia2.6.2, Reanimated4.5.1 y Worklets0.10.1.

### Verificación de los menús

Pasaron TypeScript, lint, los 21/21 controles de Expo Doctor, `expo install --check` y las trece pruebas `scripts/check-*.cjs`, incluidas serialización de worklets, audio, navegación, pausa y orden visual. Se generó el bundle Android Hermes; no es un APK. Los 502 assets originales conservan su SHA-256 y no cambiaron mapa, cámara, colisiones ni controles de Swordmaster.

Se ejecutó la app web real a **844×390** y **667×375** y se inspeccionaron capturas de principal, partida, pausa, ajustes y confirmación. Prueba automatizada: navegación completa, ambos enlaces en pestañas externas, música pausada al jugar, silencio aplicado a los cuatro reproductores sin duplicación y canvas pausado idéntico píxel a píxel tras 1,1 s. El boss se revisó también en un render real Skia del componente con su animación ambiental. En la prueba web se suministró el WASM local de la misma versión de CanvasKit; el arranque web normal usa el CDN especificado en Root.web.tsx.

No se dispone de celular/emulador conectado: escucha nativa, navegador externo del teléfono, multitouch físico y FPS en dispositivo quedan pendientes. Las comprobaciones web y simuladas no prueban 120 FPS en un celular.

Para abrir la versión actual: `npx expo start --clear`. Para revisar menús/audio: `node scripts/check-menus.cjs`, `node scripts/check-audio.cjs` y `node scripts/check-follow.cjs`.


## Ciudad reconstruida

El mapa conserva **3072 × 3072 unidades**, la orientación horizontal, la escala del personaje y el límite circular en sombra. Ahora tiene **56 edificios**: nueve edificios existentes recolocados y dieciséis añadidos para completar frentes y conjuntos de servicio. El suelo continúa como un único relleno plano **#513a3d**. No se dibujan baldosas, cuadrados de parcelas, parches de color, CRT ni scanlines.

- **Mercado viejo:** farmacia, taller y cantina forman un frente más continuo; dos almacenes posteriores sirven al conjunto. La aparición del personaje conserva una explanada despejada.
- **Talleres del norte:** un segundo taller, repuestos y un puesto de primeros auxilios completan el patio interior. Los restos de cimientos se trasladaron a un espacio entre edificios, evitando que atravesaran el nuevo taller.
- **Servicios cívicos:** puestos sanitarios, taller y almacenes comparten accesos desde la avenida. El relé se retiró de la zona del nuevo depósito y se sitúa en un patio libre.
- **Subestación:** depósitos auxiliares y asistencia a trabajadores completan la transición hacia la terminal. Se mantienen los relés, su maquinaria y los restos de una nave derrumbada.
- **Manzana demolida:** garaje y taller reordenados, almacén de recuperación y agrupaciones de bloques, piedras y maleza en los sectores deteriorados.
- **Terminal de carga:** primeros auxilios, taller y almacén lateral completan los edificios de despacho y almacenamiento. La plataforma rota está fuera de la ruta de distribución.

Las seis calles de `ROUTES` conservan recorridos conectados y corredores de **128 a 180 unidades**. Son datos espaciales: no se pintan sobre el suelo. Los edificios tienen separación entre imágenes y sus huellas no invaden los corredores. Los cables sueltos se acercaron a los relés para que se lean como material de mantenimiento del mismo conjunto.

## Pasto, piedras y terreno

Se usan únicamente regiones transparentes inspeccionadas visualmente de `Tileset.png`:

| Recurso | Celdas originales de 16 × 16 |
| --- | --- |
| Diez pastos secos | Ocho variantes en y=96, x=80,96,112,128,144,160,176,192; dos matas en (112,80) y (176,80). |
| Cuatro rocas | y=80; x=16,32,48,64. |
| Dos detalles de gravilla | (128,80) y (192,80). |

Se distribuyen **2,404 detalles**: **1,392 pastos, 523 piedras y 489 gravillas**. El pasto es seco y cobrizo, con los colores originales del asset. No se han creado variantes mediante filtros o recoloreado.

La colocación combina 28 zonas de abandono, agrupaciones asimétricas en los zócalos de edificios, márgenes interrumpidos junto a las calles y una dispersión ligera en las transiciones y el perímetro. La densidad es mayor junto a ruinas y patios desatendidos; disminuye en la plaza y las rutas. No se crean anillos rectangulares alrededor de todos los edificios ni una cuadrícula de plantas. Cada zona reúne pequeños grupos con huecos entre ellos.

La distribución es determinista y se calcula una vez al cargar los datos del mapa. `TERRAIN_SOURCES` permite elegir variantes y `TERRAIN_HABITATS` editar centros, extensión y densidad de cada área. Se respeta un espacio libre alrededor de la aparición y se evitan las imágenes de edificios y equipos. Las plantas, rocas pequeñas y gravilla son decoración transitable, sin nuevas colisiones. Las escalas conservan proporciones: 1.5–1.9 para pasto/roca y 1.35–1.65 para gravilla.

## Cofres y animación ambiental

**No aparece ningún cofre por ahora**, ni estático ni animado. Se retiraron las instancias de `chest`, `cargo` y `smallChest` y sus tres texturas de la carga activa. Los archivos originales siguen intactos, disponibles para implementar apariciones ocasionales más adelante; no se añade todavía ese sistema.

Se conservan dos hornos de `Ember Pit Shrine.png`, con sus diez fotogramas reales de 32 × 33 a 10/s. `Ancient Door.png` solo aporta la referencia cerrada estática de 64 × 48 en (0,0). No se animan el pasto, las piedras ni los edificios. La escena carga ocho imágenes de escenario, una de Swordmaster y dos de Ghoul: **once recursos** en total.

## NPC comunes y oleadas (historial anterior a supervivencia)

Se inspeccionaron visualmente todos los recursos de `assets/assets/enemies/npc/`. Se integra **únicamente Ghoul**, humanoide oscuro con ojos rojos y marcha corporal sencilla. Spitter muestra un ataque de expulsión y recursos de proyectil; Summoner muestra una invocación. Ambos se excluyen junto a los mini bosses, para conservar el alcance de comunes sin habilidades especiales ni ataques a distancia. No se han descargado ni generado sprites nuevos.

Se cargan dos PNG originales de Ghoul: `Ghoul Sprite Sheet 62 x 33.png` (**682 × 198**) y `static idle.png` (**62 × 33**). El pivote es **(31,32)** y la escala **1.75**, coherente con Swordmaster. Las celdas completas conservan proporción, transparencia y margen; el sprite se refleja horizontalmente al moverse a la izquierda.

| Estado | Fila desde cero / Y | Fotogramas | Cadencia elegida |
| --- | --- | --- | --- |
| Aparición | 5 / 165 | 11 | 14/s |
| Despertar | 0 / 0 | 4 | 10/s |
| Marcha | 1 / 33 | 9 | 12/s |
| Muerte | 4 / 132 | 8 | 14/s |
| Reposo | PNG independiente | 1 estático | Sin animación |

Las filas se cotejaron con cada PNG individual: contienen exactamente los mismos píxeles. El último fotograma de muerte conserva partículas de alfa muy bajo y se reproduce completo antes de retirar el NPC. Las cadencias son decisiones de implementación, no metadatos del archivo. Las filas de ataque e impacto del Ghoul se identificaron pero no se activan: este alcance añade persecución y eliminación, sin daño ni salud del jugador.

La configuración está en **`WAVE_CONFIG` de `src/game/encounter.ts`**:

| Ajuste | Valor actual |
| --- | --- |
| Primera oleada | 6 Ghoul |
| Aumento por oleada | +2 |
| Máximo total por oleada | 36 |
| Máximo simultáneo | 24, incluida la ocupación de animaciones de muerte |
| Intervalo entre apariciones | 650 ms |
| Pausa al eliminar la oleada | 2500 ms |
| Espera inicial tras cargar | 1200 ms |
| Distancia de aparición al jugador | 300–460 unidades |
| Velocidad / distancia de parada | 60 unidades/s / 23 unidades |

Cada oleada termina cuando no quedan enemigos vivos ni apariciones pendientes. Se espera la pausa antes de iniciar la siguiente; las oleadas grandes esperan un slot libre en vez de superar el límite. Los identificadores de NPC son únicos incluso al reutilizar el pool. Una búsqueda fallida de aparición se reintenta de forma acotada, sin consumir enemigos pendientes ni generar un bucle por fotograma.

Las apariciones comprueban distancia al jugador, separación de otros NPC, pies transitables, conexión al jugador y una región libre para el cuerpo completo: no se materializan bajo techos o encima de edificios y maquinaria. Los Ghoul comparten un campo de navegación sobre la geometría real, con una cuadrícula de 32 unidades y aristas verificadas contra las colisiones. El campo se actualiza como máximo cada 350 ms cuando cambia la celda del jugador. Así rodean edificios en vez de limitarse a empujar contra una pared. La separación local reduce las superposiciones entre NPC; al llegar al jugador se detienen y muestran su pose estática.

## Impacto de la espada (historial anterior a supervivencia)

`SWORD_STRIKES` en `src/game/combat.ts` define el área y los fotogramas activos de cada uno de los cuatro tajos. Los rectángulos se expresan en píxeles de la celda original, se escalan y se reflejan alrededor del mismo pivote usado al dibujar. El cuarto tajo admite el barrido posterior que aparece en el sprite. Las poses de preparación y recuperación no golpean.

La prueba de impacto usa una cápsula sencilla que cubre el cuerpo del Ghoul y verifica que no haya una base sólida entre él y Swordmaster. Un golpe pasa inmediatamente al estado de muerte: el NPC deja de perseguir y de recibir impactos, se cuenta una vez y reproduce sus ocho fotogramas. No hay puntos de salud, impactos acumulados ni recompensas. El identificador `attackSerial`, incrementado solo al aceptar una nueva pulsación de ataque, evita impactos duplicados. No se añaden proyectiles, sonidos, HUD, daño al jugador ni progresión.

## Personaje y controles

**The Swordmaster** aparece en **(1425,1345)**, en un espacio abierto del mercado. Se conserva la orientación horizontal.

- **Joystick izquierdo:** ocho direcciones, pequeña zona muerta y velocidad proporcional. Un desplazamiento corto reproduce marcha; cerca del borde reproduce carrera. Al soltar o cancelar el gesto se detiene.
- **ATAQUE:** reproduce un tajo completo. Pulsaciones consecutivas, después de terminar cada tajo, recorren cuatro secuencias originales; la cadena vuelve a empezar tras una pausa. Mantener pulsado no repite el ataque. El personaje permanece en su sitio y conserva su orientación durante el tajo. El efecto visible procede de la propia hoja, con impacto de un golpe sobre los NPC durante los fotogramas activos del tajo.
- **DASH:** avanza hasta 144 unidades durante 240 ms, en la dirección del joystick o, si está quieto, en la última dirección de movimiento. Puede cancelar un ataque. No se reinicia mientras está activo; tiene 900 ms de recuperación desde su activación. El propio botón se atenúa y su pequeña línea indica la recuperación, sin añadir un HUD.

Los gestos son locales a cada control y declaran simultaneidad: un pulgar puede mantener el joystick mientras el otro pulsa un botón. Los controles se sitúan en las esquinas inferiores, separados del personaje centrado. No hay reconocedores de gestos sobre toda la escena.

La hoja original presenta una vista lateral hacia la derecha, sin ocho orientaciones dibujadas. El personaje se refleja horizontalmente al cambiar izquierda/derecha y conserva esa orientación al moverse solo verticalmente. El movimiento y el dash sí funcionan en ocho direcciones. Los tajos usan la orientación lateral visible del personaje; no se han inventado vistas superiores o inferiores.

## Recortes y animaciones del personaje

Se inspeccionaron las imágenes completas, las filas y la transparencia. Se carga únicamente **`characters/The SwordMaster/Sword Master Sprite Sheet 90x37.png`**, RGBA de **900 × 999**, organizada en celdas **90 × 37**. La celda se mantiene completa, incluidos sus márgenes reservados a la espada y las partículas. El ancla de pies es **(28,34)** y la escala uniforme **1.75**. El reflejo se realiza alrededor de ese ancla, sin desplazar el cuerpo ni estirar los recortes.

| Acción | Fila desde cero | Y | Fotogramas | Cadencia elegida |
| --- | --- | --- | --- | --- |
| Reposo | 1 | 37 | 9 | 9/s |
| Marcha | 2 | 74 | 8 | 10/s |
| Carrera con espadas | 3 | 111 | 8 | 13/s |
| Ataque 1 | 7 | 259 | 7 | 18/s |
| Ataque 2 | 8 | 296 | 5 | 16/s |
| Ataque 3 | 9 | 333 | 5 | 16/s |
| Ataque 4 | 10 | 370 | 6 | 18/s |
| Dash | 12 | 444 | 6 | 25/s |

Son **54 fotogramas originales** utilizados, con orden horizontal y sin recorrer las celdas vacías al final de cada fila. Las cadencias son decisiones de implementación: los PNG no aportan tiempos. Los efectos de espada y las ráfagas de dash ya vienen integrados; no se superpone la hoja VFX separada.

Se identificaron también volteretas, posturas aéreas, escalada, impacto, desaparición y muerte. No se activan sin sus mecánicas correspondientes: no hay salto, plataformas, daño ni muerte del jugador en esta prueba. Se conservan todos los archivos originales, incluida la variante sin efectos y la hoja de escalada. No se generaron ni descargaron recursos artísticos nuevos.

## Cámara, colisiones y capas

La cámara sigue al personaje y se limita al rectángulo del mundo. La escala depende únicamente del tamaño de pantalla; no hay zoom ni arrastre manual de cámara. Se conservan el joystick, los botones, las secuencias del personaje y sus tiempos.

La colisión circular de radio 9 en los pies usa las **92 huellas sólidas** actuales. El hash espacial de 128 unidades y los subpasos de hasta 4 unidades permiten deslizarse junto a obstáculos e impiden atravesarlos durante un dash. El perímetro transitable continúa en el círculo existente de radio 1410 menos el radio del personaje.

El dibujo respeta el orden de profundidad de los pies de cada objeto y actor. Con NPC activos, el renderer usa un árbol inmutable de rangos de `SkPicture`: dibuja los objetos estáticos entre dos actores consecutivos y luego el actor siguiente. Swordmaster, todos los Ghoul y los dos hornos participan en el mismo orden, incluidas las transparencias y sombras originales. Las referencias de dibujo cambian al cruzar una profundidad, sin regrabar el mapa ni reconstruir React por fotograma. El modo anterior de escena sin NPC sigue disponible para exportaciones de revisión.

Los 2404 detalles del terreno conservan su caché espacial de **512 unidades**, con límites ajustados y descarte nativo de regiones fuera de la vista. No se crean componentes React por piedra o planta, ni se regenera terreno al desplazarse.

## Arquitectura y rendimiento

Se conservan Expo 57, React Native 0.86.3, Skia 2.6.2, Reanimated 4.5.1, Worklets 0.10.1 y Gesture Handler ~2.32.0. No se añadieron dependencias ni se modificaron proyectos nativos. La posición y la cámara siguen usando valores compartidos y worklets; las animaciones se pausan en segundo plano.

**No se midieron 120 FPS en un celular físico.** Se optimizó la caché para el escenario más detallado, pero la fluidez sostenida, latencia táctil y consumo necesitan medición nativa. No había dispositivo ADB conectado ni emulador configurado en esta revisión.

## Archivos de esta integración

- `npc.ts` / `npcAssets.ts`: Ghoul, celdas originales, estados y las dos imágenes autorizadas.
- `encounter.ts`: pool fijo, oleadas, aparición segura, persecución y retirada de muertes.
- `navigation.ts`: grafo transitable y campo de navegación compartido.
- `combat.ts` / `player.ts`: ventanas reales de impacto y serial único de ataque.
- `ActorsScene.tsx`: carga de actores y datos de dibujo compartidos.
- `ActorLayers.tsx` / `renderTypes.ts` / `Scene.tsx`: orden de profundidad de escenario y actores sin React por fotograma.
- `CourtyardScreen.tsx`: un único callback de simulación, preparación de assets y pausa de oleadas al suspender la app.
- `scripts/check-{encounter,npc-assets,navigation,actor-depth}.cjs`: pruebas nuevas.
- `scripts/check-{gestures,follow}.cjs`: integración de pantalla actualizada; se conservan las demás pruebas.
- `SCENARIO.md`: este estado y sus controles.

El mapa, sus recursos ambientales, la cámara, el motor de colisiones, los controles táctiles y el renderer original de Swordmaster conservan sus archivos anteriores. El SHA-256 de los 502 assets originales capturados confirma que no se alteraron imágenes ni sonidos. En aquella integración de NPC no se revirtieron cambios locales ni se cambiaron dependencias o versiones; las dependencias actuales de interfaz se detallan al inicio.

## Ejecutar y verificar

```sh
npx expo start --clear
```

Abrir con una instalación compatible con SDK 57 o la compilación de desarrollo existente. Comandos de verificación:

```sh
npx tsc --noEmit
npx expo lint
node scripts/check-npc-assets.cjs
node scripts/check-encounter.cjs
node scripts/check-navigation.cjs
node scripts/check-actor-depth.cjs
node scripts/check-scenery.cjs
node scripts/check-collision.cjs
node scripts/check-player.cjs
node scripts/check-gestures.cjs
node scripts/check-follow.cjs
node scripts/check-camera.cjs
npx expo-doctor
```

En la integración anterior de NPC pasaron TypeScript, lint sin avisos, las diez pruebas y **21/21 controles de Expo Doctor**. La exportación Android generó el bundle Hermes y once imágenes: las únicas dos imágenes enemigas incluidas son las de Ghoul dentro de `npc`. La exportación no es un APK.

Las pruebas cubren recortes RGBA reales, idle estático, todos los tajos reflejados, preparación/recuperación sin daño, impacto bloqueado por paredes, muertes y seriales sin duplicación, pool de 24, pausas, búsquedas fallidas acotadas, 26 ubicaciones de aparición, 29 tramos de navegación y persecución de un objetivo móvil. La navegación conecta 5615 celdas y evita cortar esquinas sólidas. El orden visual comprobó exhaustivamente 4560 intervalos y comparó 36 posiciones de actores en tres zonas: **cero diferencias de píxeles** frente al dibujo directo por profundidad.

Se renderizaron 193 fotogramas del componente real `ActorsScene` con Skia/CanvasKit, incluidas apariciones, persecución, ataques de Swordmaster, muertes, pausa y segunda oleada. La automatización de ataques se usa únicamente en ese harness de revisión; en la aplicación ataca el usuario con su botón.

Se intentó ejecutar `expo start --android --offline`; Expo informó que no había dispositivo Android conectado ni emulador disponible. Por eso la ejecución nativa, los gestos físicos y la medición de FPS siguen pendientes. Las simulaciones y los renders no miden rendimiento de un celular; no se afirma alcanzar 120 FPS.


## Preparación y reutilización de recursos de menú

Al arrancar se preparan una sola vez los recursos originales de la UI, la tipografía, el fondo del menú, las letras del título y los retratos de la galería. Se muestran el logo Dystopia y un indicador discreto solo mientras existe carga real; no hay duración mínima ni fade añadido a los botones o a la navegación entre menús. Un fallo de recursos ofrece Reintentar, y las solicitudes atascadas caducan a los 20 segundos.

`sharedImages.ts` comparte los mismos SkImage decodificados entre tipografía, interfaz, fondo, galería y pantallas de carga. Las etiquetas repetidas y las pantallas revisitadas reutilizan sus rasters; los botones nativos no usan el fade automático de Image. La preparación usa seis trabajos simultáneos como máximo y conserva los recursos completados si hay que reintentar. Los actores completos de la partida siguen cargándose mediante su sistema existente.

La preparación inicial no se vuelve a mostrar al abrir dificultad, Purgatorio o ajustes ni al volver desde una partida. Se conservan las transiciones y las pantallas de carga propias de entrada/salida de la escena jugable.

Verificación específica: `node scripts/check-menu-preparation.cjs` cubre la espera de recursos reales, recuperación, concurrencia, caché compartida y cuarenta etiquetas que reutilizan un único raster. La revisión visual web se realizó en horizontal a 844×390 y 667×375, reteniendo la tipografía y simulando el fallo de START; no se midió la latencia en un celular físico.


## Aislamiento de cargas y secuencias finales

Cada transición conserva su identificador y la propiedad de su ruta hasta liberar la tarjeta. Una solicitud de pausa durante la preparación de partida queda aplazada hasta desmontar la carga: no se monta la pausa por debajo de una tarjeta de boss aún activa. Las acciones de navegación consultan la referencia vigente y los callbacks de cargas anteriores no pueden cerrar la actual. El temporizador mínimo rechaza callbacks ya cancelados; una transición completada en segundo plano se entrega una sola vez al regresar, conservando la limpieza de listeners y animaciones.

Swordmaster utiliza la fila 26 de su hoja original de 90×37 para morir: seis frames a 10 FPS, sin bucle. El combate se detiene al perder la última vida, se reproduce la muerte completa y luego transcurren 2000 ms antes del menú de derrota. El reloj de presentación está separado del permiso de combatir, se pausa al suspender la app y deja de ejecutarse al mostrar el menú. No se usan temporizadores de navegación que sobrevivan al reinicio.

El contador de oleada/enemigos tiene un marco discreto. La vida/EXP y Frenesis se sitúan en dos contenedores independientes, con un cuadrado de 54×54 para la ultimate. La distribución usa el tamaño medido del área de juego y el margen inferior seguro; se conserva el bloqueo de toques de HUD para el teletransporte.

## Interfaz, preparación de partida y reanudación

El editor ocupa la pantalla horizontal completa, sin marco interior. Guarda posiciones normalizadas, tamaños y opacidades independientes de botones y HUD en el perfil existente. Solo la interfaz jugable recibe esas opacidades; el editor, pausa, carga, resultados y selecciones conservan su apariencia. Detalles y arte de controles: `CONTROLS.md`.

La selección de dificultad muestra únicamente Fácil, Difícil y Dystopia. La clave extrema continúa siendo `dystopia`. Récords presenta Supervivencia y Purgatorio infinito; los resultados individuales antiguos se conservan en almacenamiento. Las tarjetas de misiones mantienen progreso, recompensa a la derecha y reclamo, sin etiquetas redundantes. Los resultados muestran desenlace, modo/dificultad, oleada y enemigos eliminados; **Mostrar más** abre las estadísticas guardadas sin volver a liquidar la partida.

Antes de liberar la carga se esperan escenario, actores, nombres rasterizados de los jefes, controles, textura de EXP, cofres y los 15 reproductores de batalla. El porcentaje representa grupos de preparación reales y permanece por debajo de 100 hasta completar el destino y la tarjeta. Los iconos opcionales pueden fallar conservando el nombre de recompensa; un sonido opcional con error o que exceda ocho segundos queda desactivado para esa partida. No se añade una espera fija para disimular recursos incompletos; se conserva el mínimo de presentación previamente configurado.

En web, los componentes importados anticipadamente por Router usan imágenes de navegador y no inicializan Skia antes de CanvasKit. Android conserva el lector nativo para los recursos `res:/`, sin enviarlos a Fresco. Las solicitudes existentes conservan caché, caducidad y recuperación.

Al reanudar desde pausa o cerrar la última selección de mejora se muestra **3, 2, 1**, un segundo por número mediante tiempo real. El reloj compartido bloquea simulación y combate antes de comenzar la cuenta. Se conserva el botón de pausa para cancelarla; volver a reanudar inicia una cuenta nueva. Los callbacks atrasados se rechazan después de pausa, suspensión o desmontaje.

Los cofres por nivel se colocan dentro de la cámara y más allá del radio de recogida, considerando incluso la siguiente mejora de imán. La búsqueda comprueba el sprite completo, edificios, transitabilidad, otras interacciones y cofres. Si no encuentra sitio, conserva la entrega pendiente en lugar de colocar el cofre sobre el jugador. Los cofres normales mantienen su comportamiento. Los iconos, nombres y efectos de recompensas comparten el registro descrito en `VISUAL_ASSETS.md`.

### Verificación de esta integración

Pasaron TypeScript, lint y los 58 scripts de comprobación del proyecto (incluida la nueva regresión de importaciones web). La prueba de bosses comprueba un golpe real en cada uno de los 13 enemigos especiales, rechazo de golpes repetidos y del escudo frontal, y congelación del destello al pausar. La simulación general recorre 20 oleadas. Las pruebas de cofres conservan las siete entregas de un desborde de niveles aunque el pool solo admita seis objetos visibles.

Se ejecutó la aplicación en Chrome/CanvasKit a 844×390, 667×375 y 568×320: Purgatorio, dificultades, récords, misiones, resultados y estadísticas reversibles; editor, arrastre a dos píxeles del borde, persistencia, opacidades, Cancelar y Restablecer; Taller, Ajustes y pausa con iconos consolidados. La prueba integrada registró progreso real 75/85/90/95/100, comprobó la retirada del overlay, pausa y cancelación de la cuenta, selección tras recoger EXP, bloqueo de simulación durante 3/2/1 y apertura del cofre separado con su recompensa real. Las pruebas utilizan estados controlados en el navegador para alcanzar casos concretos, sin introducir API de depuración en el juego.

La exportación Android/Hermes terminó correctamente, con 177 recursos y un bundle de 2207 módulos. No se construyó ni instaló un APK en un dispositivo físico y no se midieron FPS nativos. Chrome emitió ocasionalmente un `AbortError` de reproducción al pausar audio HTML5 durante una transición; se registró aparte de los errores de aplicación y no impidió completar los flujos. La comprobación del audio, multitáctil y rendimiento en hardware sigue pendiente.


## Revisión: pausa, rotaciones y merchants por oleadas (26-10-2026)

- La cuenta de reanudación conserva sus tres pasos y ahora usa 30 px en vez de 60.
- Pausa usa un recognizer local del mismo sistema de gestos que joystick/ataque/dash, con relaciones simultáneas explícitas. Detiene reloj e input en el hilo UI al comenzar el toque, antes de navegar o emitir audio por JS. Un latch admite una sola solicitud hasta volver a la partida/cuenta.
- En pausa, cada icono abre nombre, descripción, valor efectivo y acumulaciones; Frenesis incluye sus multiplicadores efectivos y tiempo restante. Cambiar de icono sustituye la ficha, tocar fuera la cierra y no reanuda el combate.
- Captura: 10 segundos efectivos como base; plazo independiente 90 segundos. Salir conserva progreso, añade un segundo requerido por segundo fuera (tope +30 s) y consume el plazo. Fallar sigue quitando 2 puntos por la ruta normal de daño, una sola vez.
- `rotation.ts` implementa bolsas barajadas deterministas: captura, élite, nido y reactor comparten una; mini bosses y bosses tienen dos bolsas independientes compartidas por naves y oleadas. Se consume al inicio real, nunca al reservar un élite ni al aplazar un spawn. Cada vuelta usa todos sus tipos y evita repetir el último al comenzar otra. Los Bandits cuentan como un solo encuentro. Se reinician por partida y no cambian el calendario ni Purgatorio.
- Las misiones comparten además un cooldown de 120 segundos tras completarse/fallar. Se conservan los intervalos de oportunidades y la exclusión previa con bosses/naves, incluida la excepción avanzada existente.
- Bomb Droid conserva su vida y grupo por dificultad. Un ID vincula líder, acompañantes y apariciones pendientes. Solo la última baja efectiva entrega una caja de mejora; finalizar/limpiar una partida no entrega cajas. Las referencias se liberan al terminar.
- Los merchants siguen las reglas actuales de `MERCHANTS.md`: hito cada cinco oleadas, 30 s activos y disolución de 600 ms sin compras durante la salida.


Verificación de esta revisión: TypeScript y lint sin errores; suite de 62 scripts (incluye nuevas pruebas de grupos y rotaciones). Se probaron 800 vueltas barajadas, 24 inicios reales de misiones y cuatro vueltas completas por categoría a través de oleadas/naves. Bomb Droid se comprobó en los tres modos, matando primero y al final al líder. Las pruebas de gestos demuestran que reloj/input se detienen antes de despachar la navegación con JS pendiente.

Se ejecutó la app web real a 844×390 y 667×375: pausa/reanudación, fichas con porcentajes/acumulaciones, selección de otro icono, cierre exterior, cuenta reducida, aparición de merchant en oleada 5, reloj congelado en pausa y salida sin duplicado. Se inspeccionaron las capturas; no hubo errores de ejecución. Se usaron estados controlados en el harness de pruebas, sin añadir una API de depuración al producto. La exportación Android/Hermes terminó con 190 assets y bundle de 5.3 MB. No es un APK instalado, ni una prueba de latencia táctil o rendimiento en un celular físico.


Prueba adicional en navegador con multitáctil emulado: 60 enemigos activos, joystick y ataque sostenidos, tercer toque sobre pausa. El primer toque abrió pausa y congeló reloj/input; permanecieron detenidos durante la comprobación. Sin errores de ejecución. Esto no mide latencia nativa ni sustituye una prueba en celular.


Nota del entorno web: Expo Audio registró el `AbortError` ya conocido cuando `HTMLAudioElement.play()` queda interrumpido por pausa. El harness lo separó de errores de lógica/renderizado; no se cambió audio en esta tarea. No hubo nuevos errores funcionales en las comprobaciones descritas.
