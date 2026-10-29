# The Plague

Mini jefe único compuesto por cuatro tipos de insecto de los assets originales
`assets/assets/enemies/mini bosses/The plague/`. Los recortes, transparencias,
anclajes y tiempos se documentan en [BOSS_ASSETS.md](BOSS_ASSETS.md).

## Balance

`src/game/plague.ts` centraliza la composición, vida, vuelo y límites:

| Variante | Vida | Velocidad base | Recuperación base |
| --- | ---: | ---: | ---: |
| Pequeño | 2 fijos | 106 | 1.65 s |
| Mediano | 4 fijos | 86 | 2.10 s |
| Mediano alargado | 5 fijos | 96 | 1.85 s |
| Grande | 12 × escalado de especiales existente | 66 | 2.70 s |

Se inicia con 6/8/10 insectos en Fácil/Difícil/Dystopia, respectivamente.
Cada ciclo de diez oleadas añade uno, hasta cuatro adicionales y un máximo
absoluto de 14. En Purgatorio se usa el número de encuentro. La velocidad y
el ritmo leen el mismo escalado de dificultad/oleadas o Purgatorio que los
demás especiales, con topes de velocidad y cadencia. Los pequeños nunca
reciben vida adicional oculta. El primer encuentro Fácil suma 27 PV.

Los cuatro tipos están presentes desde Fácil. Los pequeños son más ágiles;
el mediano alargado busca acercamientos con mayor frecuencia y los grandes
rodean más, vuelan más despacio y necesitan una recuperación mayor.

## Vuelo y picotazo

Cada insecto guarda su ruta, velocidad suavizada, semilla y reloj propios.
Alterna entre vagar, rodear, acercarse, preparar, picar y retirarse. Recalcula
objetivos cada 0.65–1.55 segundos, combina desplazamiento lateral y curvas,
separación local y cohesión ligera; no comparte una órbita sincronizada.

La preparación dura 780 ms ajustados por ritmo, nunca menos de 620 ms.
Retrocede, acelera el aleteo original y pulsa su opacidad; suena el efecto
de ataque existente al empezar el aviso. El objetivo se fija al preparar el
picotazo, con predicción limitada a 40 unidades por eje. No sigue al jugador
durante la embestida. Solo los frames activos auditados pueden hacer daño;
la comprobación barrida evita saltarse el contacto entre cuadros. La vida,
invulnerabilidad y dash siguen sus reglas actuales. Como máximo se preparan
o atacan 1/2/2 insectos a la vez según dificultad; cada uno debe retirarse y
recuperarse antes de otro intento.

Las posiciones se eligen dentro de la cámara, fuera del jugador, edificios
y obstáculos, conectadas al área transitable. Se preparan todas antes de
admitir el encuentro: un fallo no genera medio enjambre ni consume rotación.
El movimiento usa las colisiones y navegación actuales. Si la cámara se aleja,
los insectos vuelven progresivamente; no se teletransportan. La altura es
exclusivamente visual y no cambia sus coordenadas de combate.

## Integración y recompensas

El primer insecto ocupa `boss` y el resto el pool existente `minibosses`.
`SurvivalState.plague` conserva IDs iniciales, bajas confirmadas y el estado
de recompensa; la muerte del líder no libera el encuentro. No hay temporizadores
nativos ni actualizaciones React por insecto y por cuadro.

La barra **THE PLAGUE** usa la suma real de PV restantes y el total inicial
inmutable. **INSECTOS RESTANTES** se actualiza por baja; no se mezcla con el
contador de enemigos comunes. Los cuatro tipos tienen sus clips auténticos
de vuelo, ataque y muerte, con una sola animación activa por actor.

Cada insecto deja 4/5/5/8 EXP según variante. El último otorga una sola
recompensa de mini jefe: 22 EXP, un cofre y una unidad en las estadísticas de
mini jefes. Los insectos no cuentan individualmente como mini jefes derrotados.
Solo la eliminación completa y confirmada puede identificar la tarjeta.
Purgatorio espera los clips de muerte antes del siguiente encuentro.

Las oleadas y naves usan la bolsa existente de mini jefes sin repetición.
No se abre una segunda ruta de spawn. El enjambre mantiene la exclusión de
especiales mientras continúa la presión de enemigos comunes. El HUD, las
presentaciones, la carga y el selector incluyen sus recursos originales.

Pausa, cuenta regresiva y segundo plano detienen el reloj de simulación.
Morir elimina el enjambre activo; reiniciar crea un estado nuevo. Abandonar
la escena desmonta sus valores compartidos y el audio existente.

## Verificación

- `npx tsc --noEmit` y `npm run lint` pasaron. Las 76 comprobaciones del
  proyecto pasaron, incluidas las repeticiones de las regresiones afectadas.
- `check-plague-assets.cjs`: cuatro timelines Aseprite, 102 celdas contrastadas
  píxel a píxel, tiempos, transparencias, anclajes y preparación sin hitboxes.
- `check-plague.cjs`: spawns reales, escalado y tope, todos los estados de vuelo,
  daño/esquiva, concurrencia, cámara, pausa, bajas reales, recompensa única,
  exclusión, naves, rotaciones e identificación; 6060 cuadros simulados y 72
  bajas individuales reales en nueve combates. También verifica la limpieza
  tras un picotazo letal y los reintentos de aparición sin consumir rotación.
- Regresiones del HUD, Purgatorio, guardados, carga y combate existente.
- Revisión en Expo web con Skia/CanvasKit: 844 × 390, 568 × 320 y 1280 × 720;
  seis insectos y cuatro variantes en Fácil, 27/27 PV, todas las fases de vuelo
  y congelación exacta al pausar. Sin errores de aplicación en esa revisión.
- Exportación Android completada con Hermes y 217 recursos incluidos; valida
  el bundle, no la ejecución de un APK ni el rendimiento nativo.

## Archivos de integración

- `game/plague.ts`, `plagueAssets.ts`, `survival.ts`: balance, movimiento,
  animaciones, daño, grupo, recompensa y limpieza.
- `game/enemyCatalog.ts`, `enemyAnimations.ts`, `enemyVisuals.ts`,
  `survivalAssets.ts`, `enemyPresentation.ts`, `ActorsScene.tsx`,
  `BossOffscreenIndicators.tsx`: catálogo, recursos y dibujo.
- `ui/SurvivalHUD.tsx`, `GameHudVisuals.tsx`, `BossHitHUD.tsx`: barra sumada,
  contador y respuesta a impactos.
- `ui/PurgatorioMenu.tsx`, `PurgatorioEncounterPortrait.tsx`,
  `PurgatorioPortrait.tsx`, `PurgatorioPortrait.web.tsx`, `plaguePortraits.ts`,
  `loadingCatalog.ts`, `loadingImages.ts`, `menuResources.ts`: selección,
  retratos y precarga. `game/purgatorio.ts` conserva el progreso legado.
- `scripts/check-plague*.cjs` y regresiones de catálogo, Purgatorio, carga,
  controles y supervivencia; `BOSSES.md`, `BOSS_ASSETS.md` y la guía de
  identificación documentan la incorporación.

No se ha probado en un celular físico ni se han medido FPS nativos.
