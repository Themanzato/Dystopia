# Identificación de encuentros de Purgatorio

Los 14 encuentros seleccionables comienzan bloqueados. Cada tarjeta conserva
la misma geometría antes y después de desbloquearse; mientras está bloqueada
solo muestra número, marco, `?`, **NO IDENTIFICADO** y **Bloqueado**. No se monta
su retrato ni se calcula un nombre visible/accesible. Al tocarla se muestra:

> Derrota a este jefe en Supervivencia o Purgatorio infinito para identificarlo

El acceso a Infinito permanece disponible. Su ilustración tampoco muestra a
Tarnished Widow hasta que haya sido identificada. La selección de una tarjeta
bloqueada se rechaza también en `Application`, no solo en su botón.

## Confirmación de una derrota

La ruta de daño letal de `advanceBoss` marca al enemigo real con
`defeatConfirmed`. La resolución del encuentro recoge esa confirmación en el
conjunto acumulativo `SurvivalState.identifiedDefeats` solo en Supervivencia y
Purgatorio infinito, sin depender de la dificultad.

- Aparecer, perder vida, cambiar de fase, terminar una oleada o retirar una
  animación no constituyen una confirmación.
- Los clones y los esqueletos de apoyo no identifican a su propietario.
- El tutorial y los encuentros individuales no crean identificaciones nuevas.
- Archer and Dagger conserva una sola tarjeta y el ID estable `dagger-bandit`:
  deben morir ambos miembros del encuentro. El alias `archer-bandit` antiguo se
  normaliza al mismo ID.
- Bomb Droid se identifica tras completar su grupo, no al matar solo al líder.
- The Plague se identifica solo después de confirmar la muerte de todos sus
  insectos. Su incorporación no borra las identificaciones anteriores: la
  migración v1 recorre el roster antiguo y la versión actual guarda IDs estables.

`SurvivalHUD` transmite los IDs confirmados al guardado, deduplicados. El
conjunto acumulativo mantiene victorias anteriores si React agrupa varias
actualizaciones; la pausa y el desmontaje hacen un último envío del estado
confirmado. No se crean temporizadores ni actualizaciones React por fotograma.

## Guardado y migración

Se mantiene AsyncStorage y la clave existente `@dystopia/purgatorio/v1`; el
contenido pasa a `{ version: 2, cleared: [IDs] }`. `cleared` ahora representa
identificaciones independientes, no una frontera de acceso por posición.

La migración recupera únicamente los IDs de victorias validadas del formato v1,
incluida la antigua pareja duplicada. No identifica al siguiente enemigo que el
sistema anterior dejaba seleccionar sin haberlo derrotado. Las victorias nuevas
obtenidas antes de terminar la lectura se unen a las del disco. Las escrituras
son serializadas y deduplicadas; un fallo puede reintentarse sin perder los IDs
de la sesión. Un fallo de lectura no sobrescribe el guardado desconocido.

Supervivencia no guardaba un historial de IDs derrotados, solo totales. No se
deducen identidades a partir de esos totales ni del número de oleada. Celdas,
Taller, récords, misiones, controles y tutorial conservan sus claves y datos.

## Pruebas

- `check-boss-identification.cjs`: 101 golpes letales reales en worklets
  aislados; los 13 encuentros en ambos modos y las tres dificultades,
  exclusiones, pareja, grupo y deduplicación.
- `check-purgatorio-storage.cjs`: guardado nuevo, migración de cada prefijo v1,
  hidratación tardía, IDs desordenados, alias, errores, reintento y reinicio.
- `check-identification-menu.cjs`: identidad y accesibilidad ocultas, requisito
  sin combate, actualización inmediata y tarjetas estables en cuatro tamaños
  horizontales (568, 667, 844 y 1280 píxeles de ancho).
- Las regresiones de menús, HUD, tutorial y Purgatorio verifican la integración
  con los flujos de partida existentes.

Las pruebas de código y navegador no equivalen a una prueba en celular físico.

Verificación final: TypeScript, lint y los 72 scripts `check-*.cjs` pasan. En
Chrome, con almacenamiento de prueba aislado, se comprobaron las 13 tarjetas
iniciales, la explicación del bloqueo y una derrota mediante el botón real de
ataque en Purgatorio infinito. La prueba coloca al jugador detrás del Shielder
durante su preparación y deja un punto de vida restante; el golpe y la
confirmación de muerte siguen la lógica real. El guardado v2 aparece
inmediatamente y una recarga completa conserva únicamente ese encuentro
identificado. Se inspeccionaron capturas en 844 × 390 y 568 × 320.
