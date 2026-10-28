# Frenesis: ataques separados por toque y pulsación sostenida

## Recursos verificados

Carpeta: `assets/assets/characters/Glitch Samurai/`.

| Archivo original | Dimensiones | Celdas | Cadencia configurada |
| --- | --- | --- | --- |
| Glitch Samurai-Slash 1.png | 980 × 46 | 7 de 140 × 46 | 20 fps, 350 ms |
| Glitch Samurai-Slash 2.png | 700 × 46 | 5 de 140 × 46 | 18 fps, 277.78 ms |
| Glitch Samurai-Glitch Slices.png | 1540 × 46 | 11 de 140 × 46 | 20 fps, loop de 550 ms |

Las PNG no contienen metadatos de tiempo: se conservan las cadencias ya configuradas. Se inspeccionaron las imágenes completas y cada celda RGBA. Slices incluye dos arcos y su desvanecimiento; sus últimos frames son prácticamente transparentes. Se repite la secuencia completa con esa desaparición natural, sin inventar fotogramas, invertirla ni multiplicar instancias. Los originales permanecen intactos.

## Seleccionar el ataque

`requestAttack` registra la entrada sin iniciar una animación equivocada. Una ventana de 180 ms distingue los gestos sin timers JavaScript: soltar antes inicia la secuencia normal Slash 1 -> Slash 2; mantener inicia directamente Glitch Slices. No se reproducen slashes antes del giro ni se dibuja Slices como efecto.

Los estados exclusivos son `slash1`, `slash2` y `slices`. Los dos slashes completan sus frames; el giro recorre sus once frames y se repite mientras se mantenga pulsado. Soltar completa el ciclo actual sin iniciar otra acción. Si una nueva pulsación sostenida llega durante un ataque normal ya aceptado, espera a que termine esa secuencia antes de girar. No se acumula una cola de toques.

Cada acción usa un serial de impacto y el cooldown existente de 550 ms dividido por la velocidad de ataque. El golpe normal ocurre en el frame 3 de Slash 1; el giro aplica un pulso por ciclo. No se causa daño por frame. Slash 2 completa el seguimiento del golpe sin duplicarlo. La secuencia normal puede durar más que el cooldown mínimo para conservar ambos clips completos.

## Sprite principal, orientación y alcance

`frenesisFrame` selecciona las imágenes 2/3 para los slashes o la 6 para el giro, dentro del mismo actor principal. No queda un cuerpo idle ni otra instancia de Slices debajo o encima. `FrenesisEffects` conserva exclusivamente las estelas del teletransporte existente. Se mantienen todos los frames transparentes del giro original; no se rellenan con otro cuerpo.

La orientación lógica se actualiza con el joystick incluso durante el ataque, sin sustituirlo por locomoción. Los sprites normales Slash 1 y Slash 2 tienen la espada dibujada hacia la izquierda: `FRENESIS_AUTHORED_FACING` aplica -1 a esos dos clips y +1 al resto. `ActorsScene` combina esa orientación del recurso con la del jugador, conservando el anclaje y el pixel art. No se inventan frames verticales; el área del golpe usa el vector de movimiento, incluidas diagonales.

El alcance base durante Frenesis es 82 x 1.20 = **98.4 unidades**, multiplicado después por las mejoras de alcance existentes. Los tajos normales afectan al frente de la orientación actual; el giro conserva el área radial. Ambos respetan obstáculos, daño de un golpe a enemigos comunes e inmunidades de bosses. Fuera de Frenesis no cambia el alcance.

## Prioridades y limpieza

Pausa, cuenta regresiva y cambios de controles descartan la intención pendiente y liberan el botón, pero conservan el clip y frame de una acción ya aceptada. Cancelar un gesto durante la pausa no crea un tajo normal por accidente. Al reanudar termina el ciclo sin encadenar otro. Muerte, aturdimiento, dash, teletransporte y fin de Frenesis conservan las prioridades y limpieza existentes. El reloj del ataque está en valores compartidos; no hay renders React por frame ni un segundo reloj visual para Slices.

## Archivos y comprobaciones

Jugador y controles: `player.ts`, `frenesis.ts`, `TouchControls.tsx`. Imagen principal: `frenesisAssets.ts`, `ActorsScene.tsx`; estelas: `FrenesisEffects.tsx`. Combate: `combat.ts`, con constantes centrales en `FRENESIS`. La misión Torbellino cuenta bajas del giro por serial, manteniendo sus identificadores y progreso persistido.

Las pruebas de Frenesis verifican toques, 180 ms de selección, slashes completos, ciclos sostenidos exclusivos, giro radial frente a tajo dirigido, alcance 98.4, cambios de orientación, pausa, cancelación y frames originales. Las de renderizado comprueban un único actor y el recurso principal correcto en ambas orientaciones; las de efectos comprueban la ausencia completa de Slices en overlays. Se ejercita también el código serializado por el plugin real de Worklets.

Pasaron TypeScript, lint y los 60 scripts de comprobación. Se repitieron las pruebas afectadas por el ajuste final de orientación, incluidos los frames serializados y el render del actor. En Expo web se probaron toque, cuatro ciclos sostenidos, movimiento, reflejo izquierda/derecha, soltado, pausa, cuenta regresiva, reanudación y expiración, con capturas de 844×390 y 667×375 y sin errores de aplicación. Se preparó el encuentro con fixtures externos al producto. La exportación Android final generó el bundle Hermes con 190 recursos. Los hashes de los tres sprites originales se conservaron. No se probó en un celular físico ni se midieron FPS nativos.
