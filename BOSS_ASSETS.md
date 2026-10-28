# Efectos de bosses: auditoría de los originales

`src/game/bossEffects.ts` conserva las rutas reales y los recortes. Las imágenes originales no se editan. `scripts/check-boss-fx.cjs` comprueba sus dimensiones, los 92 fotogramas utilizados con contenido, los límites de cada recorte y el mosaico continuo del láser.

| Uso | Archivo original bajo `assets/assets/` | Organización comprobada |
| --- | --- | --- |
| Bola energética de Shielder | `FX/Electric Hit 3.png` | 656 × 65, 8 celdas de 82 × 65. La tercera celda ofrece la bola circular; se mueve como imagen estática. |
| Explosión oscura del Sage | `enemies/mini bosses/Evil sage/evil shockwave.png` | 1918 × 39, 14 celdas horizontales de 137 × 39; 13 contienen imagen. |
| Explosión cian del Sage | `enemies/mini bosses/Evil sage/shockwave VFX 137x39.png` | 548 × 156, cuadrícula 4 × 4 de 137 × 39; 13 celdas con imagen en orden por filas. |
| Láser de Archer y extensión del de Rock | `enemies/mini bosses/Archer/attack.png` | 174 × 350, 14 celdas verticales de 174 × 25. Se toma el tramo uniforme de la quinta celda (x100, y111, 16 × 5) y su origen (x86, y111, 14 × 5). No hay un archivo de láser independiente para Rock. |
| Dusk Bomb de Dust Jumper | `bosses/Dust Jumper/Dusk Bomb/Dusk Bomb.png` | 256 × 37, 8 celdas de 32 × 37. La primera celda es el cuadrado original, fijado en el suelo durante 750 ms; las otras siete son el estallido y desaparición. Ninguna representa una bomba aérea. |
| Indicador del salto de Dust Jumper | `bosses/Dust Jumper/Dust Jumper/Indicator Sprite Sheet 21x10.png` | 189 × 10, nueve celdas de 21 × 10, animadas en su orden original y ancladas al suelo. Sigue al jugador y se bloquea 1000 ms antes de la caída. |
| Aterrizaje de Dust Jumper | `bosses/Dust Jumper/Dust Jumper/Slam VFX 98x103.png` | 980 × 103, 10 celdas de 98 × 103; las dos primeras están vacías. Se reproducen las ocho restantes. |
| Golpe de Shock Sweeper | `enemies/mini bosses/Shock Sweeper/VFX for Slam.png` | 88 × 300, 10 celdas verticales de 88 × 30; cinco de preparación y cinco de impacto/desaparición. |
| Arco y flecha horizontal, conservados | `bosses/ARCHER AND DAGER/Archer Bandit/Bow sprite 114x35.png` | Recurso original disponible; Archer Bandit ya no selecciona el ataque horizontal. Su disparo al cielo usa el cuerpo completo y Volley VFX. |
| Flecha que cae | `bosses/ARCHER AND DAGER/Archer Bandit/Volley VFX 74x111.png` | 592 × 111, 8 celdas de 74 × 111; flecha vertical seguida de impacto y tierra. |
| Veneno | `FX/Poison 2.png` | 1148 × 65, 14 celdas horizontales de 82 × 65; 13 contienen imagen. El estado del jugador usa escala 0.8 y sigue su posición. |
| Aturdimiento y teletransporte | `FX/Electric Hit 3.png` | El efecto eléctrico circular se reproduce siguiendo el tiempo de simulación; no mantiene temporizadores propios. |

Las dos explosiones del Sage comparten siluetas de alfa, pero tienen colores propios, verificados visualmente. Las cuatro celdas iniciales forman la carga; el daño y el estallido comienzan a partir de la quinta. El último tramo del láser se recorta a la longitud restante: no se estiran los píxeles y no quedan huecos. Su posición y rotación usan el mismo origen, ángulo y longitud del área de daño.

`BossCombatEffects.tsx` mantiene doce atlas de imagen fijos. Las posiciones, fotogramas y señales se calculan mediante valores derivados en el hilo de animación, sin componentes React por proyectil. Las texturas usan la caché de imágenes compartidas y forman parte de la preparación real de los actores. Pausar congela el tiempo de estos efectos. El veneno y el aturdimiento desaparecen cuando su estado de simulación termina.

La hoja de Tarnished Widow contiene las animaciones de su cuerpo; no contiene un enemigo araña independiente. Las invocaciones emplean los NPC existentes del juego y no convierten partículas de la hoja en enemigos inventados.




El cuerpo reproduce las nueve celdas de la fila y182 para despegar y las diez de y273 para caer. La espera entre ambas secuencias no estira ni inventa fotogramas: el cuerpo permanece oculto y solo se muestra el indicador. El Slam se ancla a la misma posición que los pies y la colisión.

El indicador de salto usa escala 3 (63 × 30 unidades), y el Slam recupera su escala original 2, con radio de impacto conservado en 45. El ritmo de caída utiliza el mismo multiplicador por vida que la animación y la simulación.
# Electrocutioner: ampliación del atlas

Los seis strips originales `Electricuitioner-*` y `Volley Projectile 157x122.png` se inspeccionaron completos y por celdas. Dimensiones, frames, anclajes y usos se detallan en [ELECTROCUTIONER.md](ELECTROCUTIONER.md). `BossCombatEffects` ahora mantiene **doce** atlas fijos, incluido el proyectil eléctrico; no se carga la hoja combinada de 16014 píxeles ni se alteran originales.

