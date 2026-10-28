# Puntuaciones y potenciadores en pausa

## Estadísticas y fórmula

`src/game/scores.ts` centraliza `SCORE_WEIGHTS`:

`puntos = NPC × 10 + minibosses × 250 + bosses × 1000 + oleadas completadas × 100 + objetivos completados × 150`.

No se conceden puntos por EXP, orbes, cofres, presentaciones de enemigos ni por repetir una animación. Los contadores de `SurvivalState.stats` se actualizan en la primera transición real a muerte, al cerrar una oleada y al resolver correctamente una captura o evento opcional. Los esqueletos de apoyo cuentan como NPC; los miembros especiales de un grupo Droid y ambos Bandit cuentan como entidades de su categoría. Un encuentro conjunto sigue contando como un solo encuentro de Purgatorio.

El resumen muestra Derrota/Victoria, puntos, oleada alcanzada o encuentros superados, NPC eliminados, bosses, minibosses, tiempo de supervivencia, nivel, oleadas completadas y objetivos. El tiempo usa `clockMs`, el reloj activo existente: no incluye pausas, cargas, presentaciones que suspenden el combate, elección de mejoras ni secuencias finales. La fórmula no multiplica por dificultad; la dificultad queda guardada y visible como contexto.

## Persistencia y navegación

`ScoreStorage.ts` usa el AsyncStorage ya instalado, bajo `@dystopia/scores/v1`. Conserva tres entradas por cada categoría independiente:

- Supervivencia.
- Purgatorio individual, con el identificador del encuentro elegido.
- Purgatorio Infinito.

Cada entrada conserva identificador de partida, fecha ISO, dificultad, resultado, estadísticas y equipamiento inicial. Las escrituras se serializan después de hidratar el archivo y se publican solo cuando el almacenamiento confirma el guardado. Los empates conservan primero el resultado más antiguo. Además de los identificadores del ranking y de los últimos 256 cierres, se conservan recibos permanentes de liquidación para impedir pagos duplicados aunque una partida ya no esté entre los récords. Cada reintento crea un identificador nuevo. Un error de lectura no sobrescribe un archivo desconocido con valores vacíos.

`RunResultPanel` captura el resultado al finalizar y comienza a guardarlo mientras termina la animación. El resumen espera la secuencia existente: muerte completa + 2000 ms, o muerte del último especial de Purgatorio individual + 3000 ms. Si el disco sigue pendiente se indica el guardado; si falla se permite reintentarlo o salir expresamente sin guardar. Los callbacks asíncronos no actualizan componentes desmontados.

El podio de Récords del menú abre `/scores` mediante Expo Router. Las tres pestañas mantienen separados los rankings y cada puesto libre indica «Sin registro». El trofeo y los símbolos de mejoras se componen con píxeles de la paleta de UI en código; no se descargaron imágenes.

## Pausa y efectos reales

`CurrentRun.ts` publica únicamente la referencia compartida de la partida actual, al montar/desmontar o reintentar. La pausa consulta esa misma partida; no ejecuta otra simulación. Un desmontaje antiguo no puede borrar la referencia de una partida nueva.

`UPGRADE_EFFECTS` se comparte entre combate y descripción. Cada tipo aparece una sola vez con sus acumulaciones: movimiento +8% por unidad, recuperación del dash −8%, ampliación del filo +10%, recogida +22%, velocidad de ataque +8% y Vitalidad según la diferencia real entre vida máxima y vida inicial del modo. Estas mejoras se acumulan aditivamente en el juego actual; se muestra el efecto real, no una fórmula multiplicativa inventada.

Frenesis solo aparece mientras está activa y tiene tiempo restante. Su tarjeta identifica el efecto **TOTAL** temporal: multiplica las mejoras permanentes por ×1,45 en movimiento y ×1,5 en ataque. Por ejemplo, dos unidades de velocidad y ritmo producen +68,2% de movimiento y +74% de ataque durante Frenesis, no +61%/+66%. El tiempo restante se congela junto con la pausa. No aparecen opciones rechazadas, curaciones instantáneas, perjuicios ni efectos vencidos.

La fuente derivada `assets/ui/font/ui-alphabet.png` incorpora `%` a través del generador existente. `--check` verifica que las 21 letras recortadas del pack mantienen exactamente sus píxeles originales; los PNG fuente de UI permanecen intactos.

## Celdas y Taller

`game/workshop.ts` centraliza costos, IDs, número de huecos, efectos y `CELL_BALANCE`:

`Celdas = floor((floor(puntuación / 1000) + 3 × oleadas completadas + 8 × minibosses + 15 × bosses + 5 × objetivos completados) × multiplicador)`.

Multiplicadores: Fácil ×1, Difícil ×1,25 y Dystopia/Imposible ×1,5. Se liquida únicamente una derrota o victoria final, nunca el abandono. `finalRunResult` rechaza estados activos. El recibo, la nueva puntuación y el saldo se guardan en una sola escritura del mismo archivo de AsyncStorage; no hay dos claves que puedan quedar desincronizadas. Un callback repetido devuelve el recibo original. Los récords anteriores se mantienen y migran con recibos de cero Celdas: no conceden recompensas retroactivas.

El resumen espera la animación y el guardado existentes y muestra las Celdas ganadas y el saldo de esa liquidación. La esquina superior derecha del menú contiene, de izquierda a derecha, el saldo informativo sin acción, la llave inglesa del Taller, el podio de Récords y el trofeo de Misiones. La tipografía y los marcos originales se reutilizan; la llave y el símbolo de Celdas se componen con píxeles en código.

| ID estable | Ventaja de una partida | Costo | Efecto inicial |
| --- | --- | ---: | --- |
| `frenesis-coil` | Bobina de Frenesis | 100 | 15% de carga al crear la partida. |
| `assault-boots` | Botas de asalto | 110 | +8% de movimiento sobre la base. |
| `attack-servo` | Servo de ataque | 125 | +8% de velocidad de ataque sobre la base. |
| `field-kit` | Botiquín de campaña | 150 | +1 de vida inicial y máxima; no disponible con vida única. |

### Preparar, retirar y consumir

Las compras ya no desbloquean ventajas permanentes. Comprar descuenta Celdas y guarda `{ id, cost }` en `economy.prepared`. Solo se admiten dos IDs distintos; el Taller separa las preparadas de las disponibles. Retirar devuelve exactamente el costo pagado y elimina la preparación, en una sola escritura. Los fallos de lectura/escritura no publican saldos ni consumos ficticios.

La selección pendiente se muestra en dificultad y Purgatorio. `EquippedRun` espera a `consumePreparedAdvantages(startId, difficulty)` antes de montar el juego: guarda el consumo y su recibo por ID de inicio, vacía las compras pendientes y devuelve la selección inmutable de esa partida. Un callback repetido del mismo inicio obtiene el mismo recibo sin consumir otra compra. Cada reintento crea un ID nuevo y comienza sin las ventajas ya usadas. No se cargan ventajas desde los récords ni desde un desbloqueo permanente. Un cierre después del consumo no restaura el consumible.

Si se prepara un Botiquín en otro modo y después se inicia Imposible/Dystopia, se reembolsa en esa misma operación en vez de consumirlo sin efecto. `workshopBonuses` conserva además la protección de una vida. `createSurvival` aplica vida/carga iniciales una vez; `applyPlayerUpgrades` deriva velocidades desde las bases sin acumular porcentajes en cada render. La pausa agrupa los efectos de las ventajas consumidas con las mejoras reales de esa partida.

### Persistencia y migración

Se conserva `@dystopia/scores/v1` y sus récords, misiones y recibos de liquidación. Su economía tiene `version: 2`, `cells`, `prepared`, `starts`, `creatorRewards` y `settlements`; los vendedores añaden `merchantReceipts` y `adFreePreview` opcionales. Compras, reembolsos, consumos, premios de misiones, visitas, resultados y tiendas de arena comparten una cola de escritura. Los recibos de vendedores pendientes de entregar se reembolsan una sola vez al reiniciar; los confirmados conservan su débito. Véase `MERCHANTS.md`.

Los desbloqueos del sistema anterior se retiran y se reembolsa una vez su costo original: Botiquín 100, Servo 80, Botas 80, Bobina 90. No se convierten en ventajas gratuitas para la siguiente partida. La migración se persiste antes de habilitar el saldo; una escritura fallida permite reintentar sin duplicar la devolución. Los IDs duplicados o desconocidos no crean compras adicionales.

### Primeras visitas al creador

`CreatorVisit.ts` reutiliza `Linking.openURL` y los destinos exactos de `links.ts`: `https://buymeacoffee.com/manzato` y `https://portfolio-two-gamma-if8rur9x6r.vercel.app/`.

Cada sección concede **200 Celdas**, una vez e independientemente de la otra, tras la confirmación de apertura del navegador. `creatorRewards` y el saldo se guardan juntos; como máximo se obtienen 400 Celdas. No se comprueba una donación, pago ni actividad en la web externa. Una apertura rechazada no concede Celdas. Si abre pero falla el guardado, se informa y se permite volver a tocar para reintentar. Una sección ya recompensada sigue abriendo su enlace, sin volver a pagar.

Los botones incluyen el aviso de primera visita o recompensa obtenida. Etiquetas, porcentajes (incluido `%`), silencio y enlaces de Ajustes usan `PixelText` con el atlas ya existente. No se modificaron fuentes ni imágenes originales.

## Verificación

`check-workshop.cjs` comprueba los cuatro precios, 33 combinaciones iniciales, porcentajes sin acumulación por render, límite de dos preparadas, compras/reembolsos/consumos concurrentes, saldo insuficiente, errores de escritura, persistencia, reintentos sin efectos, migración y reembolso de Botiquín al cambiar a vida única. También prueba aperturas fallidas sin premio, recompensas independientes, duplicados, recarga y fallo de guardado tras abrir. `check-menus.cjs` revisa rutas y conserva la partida pausada al abrir los enlaces.

La revisión Chrome/Skia utiliza 844×390, 667×375 y 568×320. Los destinos externos se interceptan con respuestas de prueba: se valida la URL y la apertura de la ventana, no el contenido de esos sitios ni el navegador nativo. Se comprueban preparación, reembolso, recarga, consumo dentro del juego y reintento sin repetir ventajas. No constituye una prueba en celular físico.
