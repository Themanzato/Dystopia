# Fases de Sage / Archer y rotación de Purgatorio infinito

`RANGED_PHASE_BALANCE` en `src/game/bossBalance.ts` centraliza los ajustes.
Ambas fases se activan a **vida × 2 <= vida máxima**, una sola vez y sin
reiniciarse al curarse. Reutilizan el destello, sonido de fase y nombre vino del
sistema existente. No añaden mensajes ni figuras geométricas de peligro.

## The Evil Sage

| Ajuste | Fácil | Difícil | Dystopia |
| --- | ---: | ---: | ---: |
| Movimiento en fase | ×1.35 | ×1.50 | ×1.65 |
| Multiplicador extra al retirarse | ×1.15 | ×1.15 | ×1.15 |
| Explosiones por secuencia distante | 1 | 2 | 3 |

La carga se multiplica por 0.75, con mínimo de 550 ms. Se aplica sobre el ritmo
ya escalado por dificultad/oleada/encuentro. Una carga que ya empezó conserva
su duración; las nuevas cargas usan la fase potenciada. El ataque y la carga
mantienen todos sus frames, con el clip de carga sincronizado a su duración.

Conserva la alternancia entre explosión propia y distante. Las explosiones
distantes de la fase se ejecutan una detrás de otra con 180 ms adicionales
entre acciones, cada una con su sonido y FX de carga. La primera fija el blanco
actual; las siguientes predicen 180/360 ms de movimiento suavizado, limitados a
64 unidades por eje. Los puntos quedan inmóviles y separados al menos 80
unidades de **todos** los anteriores. Se comprueba terreno/cámara; si no hay
un destino seguro distinto, se cancela el resto de esa secuencia.

Los FX originales son `evil shockwave.png` y `shockwave VFX 137x39.png` en
`enemies/mini bosses/Evil sage/`. El cuerpo usa `The Evil Sage 52x21.png`,
incluidas las ocho celdas de carga y las catorce del ataque. El daño solo
comprueba al jugador; ninguna explosión puede herir al propio Sage.

## Archer

Estos valores se aplican solo al ID `archer`, nunca a `archer-bandit`:

| Ajuste en fase | Fácil | Difícil | Dystopia |
| --- | ---: | ---: | ---: |
| Movimiento | ×1.25 | ×1.45 | ×1.65 |
| Ritmo de animación/ataque adicional | ×1.30 | ×1.45 | ×1.60 |
| Recuperación | ×0.70 | ×0.60 | ×0.50 |
| Cooldown de teleport | 4800 ms | 3800 ms | 2900 ms |
| Velocidad del frente del láser | ×1.20 | ×1.40 | ×1.60 |

El ritmo total se limita a 1.8, la preparación a un mínimo de 600 ms y la
recuperación a 650 ms. Hay al menos dos láseres entre teletransportes para que
la mayor movilidad no sustituya la presión de disparo. Las acciones terminan
antes de iniciar la siguiente; el cooldown solo habilita un teleport desde
recuperación. Una transición de fase no corta la acción ya empezada.

Archer ya usa un láser, no flechas móviles. Se conserva ese mismo ataque,
su alcance de 1200 y sus piezas originales: el frente del haz ahora se propaga
a 2800 unidades/s antes de la fase, acelerándose según la tabla. Dibujo y daño
usan la misma longitud alcanzada; el extremo todavía puede cruzar toda su zona
activa antes de terminar la animación.

El cuerpo y teleport provienen de `enemies/mini bosses/Archer/All.png`; el haz
usa `Archer/attack.png`. Las primeras once celdas de la columna 522 contienen
solo desaparición. Para la llegada se reutilizan esas mismas celdas en reversa,
sin arte nuevo. El traslado ocurre con el sprite invisible, y la última celda
de llegada conserva el pivote original 75/24 antes de volver al movimiento.

El destino se comprueba al preparar y al trasladar: transitable, libre de
edificios, dentro de cámara y al menos a 150 unidades del jugador. Si la cámara
o el jugador cambian durante la preparación se busca otro destino válido antes
de dibujar la llegada; si no lo hay, se cancela el traslado.

## Purgatorio infinito

Reutiliza `rotation.ts` (Fisher–Yates con semilla propia de cada partida).
`PurgatorioState.bag` guarda como máximo los 14 IDs elegibles del catálogo,
su último ID, semilla y número de ciclo. No filtra por identificación ni usa
el número de oleada/dificultad para elegir el orden. Archer and Dagger conserva
su ID conjunto; los clones no son entradas.

`nextPurgatorioEnemy` prepara el candidato sin consumirlo.
`confirmPurgatorioAppearance` lo consume únicamente al finalizar con éxito
`beginSpecial`, después de validar todos los actores de un encuentro compuesto.
Los fallos de spawn reintentan el mismo candidato sin descartarlo. Cada ciclo
recorre una permutación completa antes de mezclar otro, evitando una repetición
entre sus extremos. Cada nueva partida crea una bolsa nueva desde `runSeed`.

No cambia el guardado de identificaciones: una derrota real completa en
Supervivencia/Infinito sigue desbloqueando el ID estable, con la dificultad
indiferente. El calendario, la exclusión de especiales, presión de enemigos
comunes y progresión de estadísticas conservan sus sistemas actuales.

Todos los relojes de cargas, secuencias, beams y teleport pertenecen a la
simulación. Pausa/segundo plano los congelan; muerte/salida/reinicio usan la
limpieza de ataques y audio por propietario existente.

## Comprobaciones

- `npx tsc --noEmit`, `npm run lint` y las 78 comprobaciones del proyecto
  pasaron, incluidas las repeticiones de las regresiones afectadas.
- `check-ranged-phases.cjs`: umbrales inclusivos/únicos en tres dificultades,
  retirada real, secuencias completas de 1/2/3 explosiones, blancos fijos y
  separados, muerte/pausa, cadencia real de un minuto, propagación del láser,
  destino/clip inverso/anclaje y aislamiento de Archer Bandit.
- `check-purgatorio-shuffle.cjs`: 16 800 selecciones serializadas como worklets,
  100 semillas y 12 ciclos por semilla, cero repeticiones por ciclo/borde,
  candidatos desconocidos, reintentos reales y clones sin consumo.
- Regresiones de mecánicas, clips, identificación, guardado y cadena completa
  de Purgatorio. Revisión en navegador de Sage/Archer, con pausa/reanudación.
- En la prueba controlada de 60 segundos, los láseres pasan de 15/17/19 a
  16/18/20 según dificultad, incluyendo el tiempo de los teletransportes.
  Esto verifica presión de disparo real, además de las estadísticas configuradas.
- Expo web en horizontal: tres explosiones de Sage en Dystopia, aparición y
  láser de Archer, pausa y cuenta regresiva; sin errores de aplicación.
- Exportación Android con Hermes y 217 recursos completada. No equivale a
  instalar ni ejecutar el APK en un teléfono.

No se ha probado en un celular físico ni medido rendimiento nativo.
