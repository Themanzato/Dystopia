# Iconos y presentación de combate

## Familia de recompensas

`scripts/create-reward-icons.py` dibuja nueve iconos originales sobre una cuadrícula de 16 × 16 y los exporta a PNG RGBA de 32 × 32 sin suavizado. Solo escribe en `assets/ui/rewards/`; no toca las imágenes originales del pack. La paleta comparte los controles de ataque/dash: vino `#281923`, marfil `#e6d1ac`, acero `#778e91`, turquesa `#7dc4bd` y un acento `#9d6076`.

Los símbolos representan botiquín, servo/engranaje con filo, bota, bobina eléctrica, imán, impulso de dash, alcance de espada, cristal de experiencia y curación. `ui/rewardIcons.ts` es el registro único y declara alias para que Botiquín/Vitalidad, Servo/Ritmo, Botas/Paso ligero y Bobina/Frenesis compartan exactamente la misma imagen. `UpgradeIcon` usa la caché de imágenes existente y muestreo nearest tanto en pantallas nativas como web.

El Taller muestra los iconos por ID de compra. La pausa conserva un solo icono por tipo agregado y presenta únicamente sus valores efectivos debajo; los nombres y acumulaciones siguen disponibles para accesibilidad. Frenesis muestra sus dos multiplicadores efectivos y, mientras existe, su tiempo restante. No se cambian los porcentajes ni la forma de acumular mejoras.

Los cofres abiertos usan el mismo registro de iconos, con nombre y efecto en dos líneas separadas. La información proviene de la recompensa que realmente se entregó; el texto antiguo se conserva como fallback para estados anteriores.

## EXP y FX existentes

Se revisaron visualmente `FX/All.png`, `Electric Hit 1.png`, `Sparks Hit 1.png` y `Electric Hit 2.png`, además del tercer fotograma recortado y ampliado. Los orbes reutilizan **Electric Hit 2.png**, una tira RGBA de 656 × 65 con ocho celdas de 82 × 65. El tercer fotograma tiene un núcleo turquesa con aro claro; su región no transparente es `x=194,y=24,w=22,h=22` dentro de la tira completa. Se usa como textura estática, no como una animación inventada. Los tamaños efectivos son aproximadamente 8,8 y 11 unidades, con una respiración de escala de ±3,5 %. Solo cambia el atlas de orbes, sin modificar proyectiles ni otros efectos.

## Daño y avisos de bosses

El daño aceptado por el combate establece `hitFlashMs`; la presentación usa un parpadeo breve de opacidad (220 ms) en el actor existente, con el mismo frame, pivote, coordenadas y profundidad. `BossHitHUD` aplica al nombre y barra un desplazamiento acotado a 2,2 × 0,9 puntos y termina exactamente en cero. Ambos dependen de la simulación pausada; no tienen relojes independientes ni interrumpen animaciones.

Se retiraron los Paths que dibujaban áreas exactas de ataque, polígonos de láser, círculos de impacto y la barra de contorno de flecha. También se ocultan la primera celda cuadrada de Dusk Bomb y el marcador geométrico previo a Slam. Las animaciones de preparación del enemigo, señales de audio y FX reales de impacto continúan. Las hitboxes, seguimientos, fijación del destino, avisos temporales y daño permanecen en la lógica de combate. La explosión de la bomba empieza en su segunda celda original, al inicio del intervalo activo, y Slam conserva sus frames de aterrizaje.

## Comprobaciones

- `check-reward-visuals.cjs`: dimensiones, transparencia binaria, nueve imágenes distintas, alias compartidos, recorte EXP real y tamaños, parpadeo/temblor acotados, ausencia de geometría de hitbox y conservación de los frames de impacto.
- `check-battle-render.cjs`: capacidad y orden de actores, orientación, parpadeo sin sustitución del actor, atlas de EXP, apertura real del cofre, etiquetas y efectos sin Paths de hitbox.
- `check-dust-patterns.cjs`: mantiene los seguimientos y bloqueos internos, daño real y esquivas, cadencia según vida y dificultad, pausa y limpieza; confirma que los marcadores exactos no se dibujan.
- `check-boss-fx.cjs`: recortes originales, fotogramas válidos, láser continuo y efectos acotados.

La revisión de las imágenes y las pruebas automatizadas no constituyen una medición de FPS o una prueba en un celular físico.
