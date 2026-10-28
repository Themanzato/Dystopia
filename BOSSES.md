# Dystopia: bosses y minibosses

El comportamiento de Frenesis se documenta en [FRENESIS.md](FRENESIS.md): toque para Slash 1 -> Slash 2 o pulsación sostenida para Glitch Slices como sprite principal exclusivo, con alcance +20% y orientación corregida por clip.

## Ajustes de escala, Dust Jumper y presentación

`bossBalance.ts.visualScale` amplía un 20% todos los clips de Shielder, The Evil Sage, Dagger Mush, Shock Sweeper, Skeleton Summoner, Dust Jumper y Electrocutioner; Guardian crece un 30%. Se aplica una sola vez al catálogo, conservando proporciones, celdas y anclajes de pies. Los demás enemigos no cambian. Skeleton Summoner recibe un multiplicador de vida 1.20 después del escalado/ redondeo previo, igual que el ajuste existente de Rock, para obtener exactamente un 20% adicional en cada dificultad y encuentro.

Dust Jumper vuelve a mostrar su `Indicator Sprite Sheet 21x10.png` durante el seguimiento y hasta el impacto. Se había ocultado junto con las primitivas de hitbox; ahora se restaura solo el sprite original, sin círculos ni cuadrados añadidos por código. El Slam VFX pasa de escala 2 a 2.5 (+25% visual), conservando su radio de daño. Por encima de 1/3 de vida se conserva el seguimiento y bloqueo habitual. Por debajo, el ataque guarda su variante al comenzar: sigue durante 1000 ms, no añade bloqueo y reproduce la caída en 180 ms divididos por el ritmo del ataque; sigue hasta el contacto y conserva esa posición al recuperar. La variante no cambia a mitad de animación si cambia la vida.

El HUD lee el estado actual al recibir sus callbacks, en vez de volver a presentar snapshots retrasados. La introducción valida la identidad del encuentro y oculta sprite/sombreado dentro del propio Canvas, además de su vista nativa. Pausa y cuenta regresiva no montan la tarjeta. La carga limpia su dibujo antes de notificar la salida y congela sus callbacks al desmontarse. La cuenta regresiva conserva 3, 2, 1 y sus tiempos, con texto de 60 en vez de 84.

Las comprobaciones de carga incluyen un componente retenido con snapshot obsoleto y validan que el Canvas quede invisible al terminar, cambiar de identidad o desmontarse. Las de Dust incluyen impacto/esquiva con dash en las tres dificultades y pasos de 8/16/40 ms, seguimiento de un segundo sin bloqueo, pausa y posición final. Se comprueban los multiplicadores en todos los clips y el +20% de vida efectiva del Summoner. No se modifican assets originales ni versiones.

Verificación de estos ajustes: TypeScript y lint sin errores; los 60 scripts disponibles pasaron, después de adaptar las expectativas de tamaño, vida y salto crítico. Se revisaron dos inicios reales y tres ciclos de pausa/cuenta regresiva/reanudación en Expo web, sin restos de carga ni errores de aplicación; seguimiento, impacto normal/crítico y regreso al menú en 844×390 y 667×375. Las fases se prepararon con fixtures fuera del producto. La exportación Android produjo el bundle Hermes con 190 recursos. No se instaló ni probó en un celular físico, por lo que la reproducción intermitente del compositor nativo sigue requiriendo confirmación en el APK.

## Electrocutioner y Frenesis

La revisión actual incorpora **Electrocutioner** al roster, con rayos de objetivo fijo, tormenta, teletransporte y clones limitados de un golpe a partir de 1/3 de vida. Se corrigieron la exclusividad del giro sostenido de Frenesis y sus índices de texturas tras añadir merchants. Recursos, configuración, fases y pruebas están documentados en [ELECTROCUTIONER.md](ELECTROCUTIONER.md).

Esta es la guía vigente de combate. Sustituye las descripciones históricas de ataques exclusivamente cuerpo a cuerpo en SCENARIO.md. Se conservan Expo 57, RN 0.86.3, React 19.2.3, Skia 2.6.2, Reanimated 4.5.1 y Worklets 0.10.1; no se instalaron dependencias ni se alteraron assets originales.

## Balance y configuración

- `enemyCatalog.ts` define la vida base y las velocidades por rol. `bossAttacks.ts` define clips, preparación, ventanas activas y recuperación; `bossBalance.ts` centraliza los ajustes por modo y límites.
- Vida de especiales: base × 1 en Fácil, × 1.15 en Difícil y × 1.25 en Dystopia/Imposible, redondeada hacia arriba. Se aplica además el escalado acotado de oleadas o Purgatorio existente. **Bomb Droid conserva 6 PV por unidad en todos los casos.** Los NPC comunes y los esqueletos normales conservan un golpe de vida.
- Preparaciones mínimas de 550 ms y recuperaciones mínimas existentes de 650 ms; la reserva compartida impide superponer dos ataques especiales peligrosos. Una ráfaga o combo reserva también sus siguientes acciones. Los ataques pueden esquivarse con el movimiento y el dash existentes.
- Los peligros físicos viven en un pool de hasta 96 entradas, identificados por enemigo propietario. Se retiran al impactar, caducar, chocar con obstáculos, alejarse de la zona activa o morir su propietario. Láseres, explosiones y proyectiles usan la misma geometría y reloj que sus avisos.
- Solo puede existir un encuentro especial. La pareja Bandit y el grupo propio de Bomb Droid pertenecen al mismo encuentro; no admiten otro boss ni miniboss. Continúa la presión normal de NPC, limitada por los sistemas actuales.

## Repertorio vigente

| Enemigo | PV base | Mecánicas funcionales |
| --- | ---: | --- |
| Shielder | 18 | Conserva el ataque cercano y el bloqueo frontal: solo recibe tajos por detrás. Alterna una carga con 3/4/5 bolas de energía en abanico según el modo. Dirección fijada durante el aviso, daño real y limpieza por impacto/obstáculo/vida útil. |
| The Evil Sage | 16 | Se retira y busca salidas laterales frente a límites y obstáculos. Permanece quieto durante su carga original. Alterna explosión alrededor de sí mismo y explosión distante señalada; utiliza las dos hojas nuevas de shockwave. Solo se comprueba daño contra el jugador, nunca contra sí mismo. |
| Archer | 16 | Mantiene distancia y dispara un láser continuo apuntado, con piezas de pixel art a escala uniforme, sin estirar el haz. Bajo media vida añade teletransporte anunciado, con recuperación y cooldown de 6.8 s. No causa daño por contacto ni recibe golpes mientras su sprite desaparece. |
| Bomb Droid | 6 | Grupo de 2/3/4 unidades por dificultad, incorporadas cada 450 ms en posiciones válidas y separadas. Persecución rápida, explosión original y ventana de daño; cada miembro debe ser derrotado antes de completar el encuentro, incluso si el líder muere antes de terminar las apariciones escalonadas. La barra muestra la vida total del grupo, incluidos los miembros pendientes, sin vaciarse al morir solo el líder. |
| Dagger Mush | 17 | Mezcla tajos, giros y secuencias de uno o dos ataques; algunas regresan por su dirección anterior. Avisos entre golpes y pausas de recuperación. La marca de embestida incluye la traslación del cuerpo dentro de los frames; los residuos del giro ya no dañan fuera del intervalo activo. |
| Shock Sweeper | 20 | Conserva el barrido de lanza; intercala al menos tres ataques normales entre slams e impone 16 segundos de recuperación para la invocación. El encuentro limita a 30 NPC vivos todas las fuentes comunes (oleada, apoyos e invocaciones). El impacto aplica 650 ms de aturdimiento con efecto eléctrico sobre el jugador y genera 10 NPC válidos cuando existen huecos; Difícil/Dystopia añaden 2/4 apoyos. Acelera temporalmente los NPC durante 5 s, sin alterar su vida. |
| Guardian | 24 | Conserva área, golpe y láser originales. Bajo 2/3 de vida gana velocidad ×1.85; bajo 1/3 añade teletransportes preparados con cooldown. Cada umbral se activa una sola vez y no se repite por curación. |
| Skeleton Summoner | 26 | Alterna ataques directos con invocaciones recurrentes en grupos de 2/3/4 esqueletos. Máximo vivo de 8/12/16 según modo; vuelve a invocar al liberarse huecos. Bajo media vida acelera ×1.6 tanto al Summoner como a sus esqueletos. Sus apoyos se retiran al finalizar el encuentro. |
| Dagger + Archer Bandit | 24 + 24 | Una tarjeta y un encuentro con dos actores y vidas independientes. Dagger conserva sus tajos y embestida. El único ataque de Archer es disparar al cielo con su animación original: caída señalada 320 ms después del disparo, o tres flechas separadas si está potenciado. Ambos conservan su salida de tierra anunciada; no se desplazan en bola ni disparan flechas horizontales. Al morir uno, el otro gana velocidad ×1.55, cura hasta un 18% y causa 2 de daño, una sola vez. |
| Dust Jumper | 36 | Completa su animación de lanzar y muestra únicamente Dusk Bomb en el suelo: primera celda de cuadrado durante 750 ms y luego las siete celdas de estallido. Bajo 2/3 de vida añade el salto: nueve frames reales de despegue desde su posición, indicador original que sigue al jugador con beeps, bloqueo fijo de 1000 ms y diez frames reales de caída sobre el punto fijado. Slam VFX y daño comienzan en el primer frame de contacto. La posición final se conserva. |
| Rock boss | 84 efectivos | Persigue, gira, golpea y cambia la distancia de combate. Bajo media vida gana velocidad ×1.8. Para el láser busca primero un corredor transitable visible dentro de la cámara; prepara el haz y cruza mientras está activo. Si no puede entrar o el corredor deja de ser válido, cancela de forma segura y continúa sus otros patrones, sin disparar desde fuera de pantalla ni teletransportarse. |
| The Tarnished Widow | 88 | Ataques y escupida con desplazamiento rápido desde cualquier cantidad de vida. Salta, aterriza y crea explosiones con NPC. Un impacto causa 1 de daño y veneno: duración máxima 4 s, ticks de 2 PV cada 1.8 s (dos ticks), sin acumulación multiplicativa. El icono pequeño sigue al personaje. Cada explosión genera una única tanda de 10 NPC, limitada por huecos disponibles. Su salto impacta desde el frame de contacto a 1090 ms. |
| Electrocutioner | 54 | Rayos de objetivo fijo y tormenta; a 2/3 de vida aumenta velocidad y suma teletransportes y descargas escalonadas. A 1/3 crea un clon de un golpe cada 6 s, con límite de 2/3/4 por dificultad. Los clones no dan recompensas de boss ni sustituyen su barra; desaparecen al morir el original. |

Las velocidades de la tabla son multiplicadores de fase, además del modo/oleada existente. Los grupos y tandas no aparecen dentro del jugador ni de edificios. Si faltan posiciones seguras o huecos en el pool, se respeta el límite y se evita forzar spawns inválidos.

Purgatorio presenta 13 encuentros únicos. Archer and Dagger es una sola tarjeta con ambos sprites a la misma escala y abre el combate conjunto. Los guardados antiguos de 13 identificadores se normalizan omitiendo la entrada duplicada Archer Bandit, sin perder victorias ni desbloqueos; el alias antiguo sigue abriendo la pareja. La victoria y el siguiente encuentro esperan a ambos miembros y a sus clips de muerte. Lo mismo ocurre con todos los Droid de un grupo.

## Fases, estados, sonido y limpieza

Las fases potenciadas conservan un marcador monotónico: curarse no vuelve a dispararlas. Producen un destello/temblor breve y una señal sonora, y el nombre cambia a vino sin mensajes explicativos. El daño de boss tiene cooldown de 220 ms; el sonido de fase, 700 ms. Se reutilizan Voices_01/Single_Low_O_No_Reverb_v1_wav.wav y Voices_03/Single_Low_AU_No_Reverb_v1_wav.wav. El gestor limita a tres voces simultáneas y respeta ajustes, silencio, pausa y segundo plano.

Aturdimiento, veneno, fases, cooldowns, FX, invocaciones y proyectiles usan el reloj de simulación. La pausa conserva el estado exacto; reintentar crea un estado nuevo. Morir o terminar el encuentro retira los peligros y estados pertenecientes al combate. En Imposible/Dystopia sigue existiendo una única vida, sin resurrección.

La posición del mundo del enemigo permanece separada del desplazamiento dibujado dentro de cada clip. Las curvas se miden por animación; terminar, cambiar de estado o morir no restaura una posición previa. Los teletransportes explícitos son acciones anunciadas, no una corrección accidental al acabar una animación.

## Assets y comprobación

Véase [BOSS_ASSETS.md](BOSS_ASSETS.md) para rutas exactas, equivalencias, dimensiones y frames de FX. Los recortes del cuerpo se auditan en enemyAnimations/enemyVisuals y check-boss-clips.cjs. Para Rock se reutiliza el tramo uniforme del láser de Archer, porque no existe un archivo de haz separado en su carpeta. El asset de bombas se llama Dusk Bomb. Widow no tiene una araña enemiga independiente en su hoja: las tandas utilizan los NPC comunes existentes. The Dark Warden está en los recursos, pero no forma parte del roster y los cambios solicitados de esta revisión.

Pruebas nuevas: check-boss-clips, check-boss-fx, check-boss-landings, check-boss-mechanics y check-boss-pair. Comprueban recortes RGBA reales, raíces, daño físico, geometría/tiempos, estados, umbrales, grupos, límites, curaciones únicas, recompensas y limpieza. También se ejecutan TypeScript, lint y las regresiones existentes de supervivencia, Purgatorio, controles, cámara, HUD y audio.

La revisión visual ejecuta la app Expo web con Skia/CanvasKit en horizontal. Sus fixtures de desarrollo preparan encuentros y posiciones para recorrer los ataques, sin añadir una API de depuración al producto. La exportación Android solo valida la construcción del bundle Hermes; no es una instalación en un dispositivo. **No se probaron FPS, multitáctil ni audio nativo en un celular físico.**


## Verificación de la implementación

Pasaron TypeScript, npm run lint y los 39 scripts check-*.cjs. La suite nueva ejecuta 36 escenarios funcionales y 16 944 frames de simulación, además de 12 combates conjuntos con espada, 39 victorias de encuentros individuales en tres dificultades, 40 encuentros sucesivos y veinte oleadas normales. Tras el ajuste final de la cola de Droid se repitieron las pruebas afectadas de mecánicas, Purgatorio y worklets. Los tests de sprites verifican 1 298 celdas corporales, 83 frames de FX y los primeros frames de aterrizaje a varias velocidades.

La app web real se revisó en 23 ataques de los 13 especiales, incluyendo advertencia e impacto, pausa exacta y retorno al menú; sin errores de aplicación. Se repitieron cinco encuentros con vida normal y sin invulnerabilidad artificial para revisar controles, impactos, veneno, cámara y barra del grupo Droid. Las capturas y fixtures permanecen fuera del producto, en el workspace de revisión. La exportación Android generó el bundle Hermes con 158 assets; no se instaló un APK ni se midió rendimiento en un celular físico. Los 502 assets originales de la referencia conservan sus hashes.


## Archivos de esta revisión

- Combate y límites: src/game/survival.ts, bossAttacks.ts, bossBalance.ts, bossHazards.ts, enemyCatalog.ts y worldEvents.ts.
- Sprites y dibujo: src/game/enemyAnimations.ts, enemyVisuals.ts, enemyMotion.ts, survivalAssets.ts, ActorsScene.tsx, BattleEffects.tsx, BossCombatEffects.tsx y bossEffects.ts.
- Jugador y cámara: src/game/player.ts y CourtyardScreen.tsx.
- Interfaz y sonido: src/ui/SurvivalHUD.tsx y BattleAudio.tsx.
- Pruebas nuevas: scripts/check-boss-clips.cjs, check-boss-fx.cjs, check-boss-landings.cjs, check-boss-mechanics.cjs y check-boss-pair.cjs.
- Regresiones adaptadas: check-battle-audio, check-battle-render, check-camera, check-difficulty, check-enemy-catalog, check-gestures, check-npc-assets, check-purgatorio, check-survival-hud, check-survival y check-world-events.
- Documentación: BOSSES.md, BOSS_ASSETS.md y SCENARIO.md.

### Revisión Archer and Dagger

TypeScript, lint y los 40 scripts de comprobación pasaron. Se probaron seis seguimientos/salidas bajo tierra, impactos y esquivas de las flechas rápidas en las tres dificultades, guardados antiguos completos y parciales, 36 victorias individuales y 40 encuentros encadenados. La galería web se revisó en 844×390 y 667×375; en la app web real se comprobaron ambas salidas bajo tierra y una esquiva con el joystick después del disparo al cielo, sin perder vida ni errores de aplicación. No se probó en celular físico.

## Descargas al cielo y señales de Dust Jumper

`dustJumper.ts` comparte el reloj real entre simulación, sprites y efectos. El despegue dura 900 ms y el seguimiento 1200 ms, divididos por el ritmo del modo; el bloqueo final siempre dura 1000 ms. La caída reproduce diez celdas en 600 ms ajustados por ritmo; el contacto es su frame 2. Durante el intervalo aéreo el cuerpo queda oculto, y su posición se confirma una sola vez al comenzar la caída. El indicador aparece en el origen del salto y se acerca al jugador; al bloquearse guarda un punto transitable debajo de él.

El lanzamiento normal no dibuja bombas en vuelo. Después de completar el lanzamiento, cada cuadrado original queda fijo 750 ms antes del estallido. Su área de daño rectangular coincide con la base del sprite. Ambos ataques eliminan sus efectos al morir el propietario y congelan marcadores, tiempos y beeps al pausar.

Los beeps usan una copia PCM corta de `Audio sounds effect/tone1.ogg`: cada 350 ms durante el seguimiento y cada 180 ms durante el bloqueo. Se detienen al comenzar la caída, respetan silencio/volumen y comparten el límite de tres voces. No se alteran originales ni se crean reproductores por fotograma.


Dust Jumper aumenta suavemente su movimiento hasta ×1.65 y el ritmo de lanzamiento/despegue/caída hasta ×1.4 conforme pierde vida, además de la dificultad existente. Lanza una bomba por encima de 2/3 de vida, dos por debajo y tres desde 1/3; nunca supera tres. El marcador del salto usa escala 3 (63 × 30 unidades), mientras el Slam VFX recupera su escala original 2. Se conserva el radio de daño de 45 unidades. Conserva el segundo de bloqueo para esquivar antes de la caída.


## Continuidad de salida, vida de Rock y final de encuentro

`bossBalance.ts` aplica `rockHealthMultiplier = 0.70` una sola vez, después del escalado y redondeo previo de dificultad/oleada/Purgatorio. Así la vida máxima efectiva es exactamente el 70% de la anterior en cada caso (84 en Fácil inicial); puede conservar una fracción de PV tras escalar. No cambian velocidades, patrones ni umbrales porcentuales.

Las salidas de tierra Bandit contienen traslación horizontal dentro de sus celdas. `banditExitRoot` sincroniza esa traslación con coordenadas del mundo y la retira del anclaje del frame actual. Los centros de los pies medidos en el frame final de salida son x=75.5 (Dagger) y x=69.5 (Archer); el primer frame de recuperar apoya en x=43 y x=36. Se conservan deltas de 32.5 y 33.5 píxeles originales para que los pies coincidan exactamente al cambiar de clip. Al recuperar, interrumpir o morir se conserva la posición alcanzada; los assets permanecen intactos.

La derrota de un encuentro individual de Purgatorio bloquea inmediatamente combate, daño, controles y nuevas apariciones. Solo avanza la presentación de los clips de muerte que faltan, incluidos ambos Bandit o los miembros Droid. Al concluir el último clip transcurren 3000 ms de juego activo antes de mostrar **Victoria**, con Salir al menú, Volver a intentar y Cambiar de dificultad. Esta última opción abre la selección existente y prepara el mismo encuentro con el modo elegido. Purgatorio Infinito continúa su cadena; las oleadas de supervivencia no terminan por derrotar un boss.

El renderizador no ofrece callbacks de fin de clip. La duración original de cada animación sirve como fallback determinista en el reloj compartido de simulación, que se detiene en pausa/segundo plano y se descarta al reiniciar. `check-end-sequences.cjs`, `check-bandit-refinements.cjs` y las pruebas de Purgatorio/pareja verifican estos contratos.
