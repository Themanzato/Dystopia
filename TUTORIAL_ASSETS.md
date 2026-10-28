# Maniquí y marcadores del tutorial

Se revisaron visualmente las tres imágenes completas y todas sus celdas antes
de configurar los recortes. Los PNG RGBA originales no se modifican.

| Archivo original | Dimensiones | Celda | Fotogramas | Reproducción |
| --- | --- | --- | --- | --- |
| `assets/assets/tutorial/Training dummy/IDLE.png` | 80 × 48 | 80 × 48 | 1 | Pose estática |
| `assets/assets/tutorial/Training dummy/HIT.png` | 560 × 48 | 80 × 48 | 7 | Una vez, 14 FPS, 500 ms |
| `assets/assets/tutorial/Training dummy/BREAKING.png` | 720 × 48 | 80 × 48 | 9 | Una vez, 12 FPS, 750 ms |

Solo existe metadata sRGB; los archivos no documentan FPS ni duración. Los
14/12 FPS son decisiones explícitas de reproducción, no tiempos extraídos del
asset. El primer fotograma blanco de impacto y destrucción es original y se
conserva. Los últimos fotogramas de destrucción muestran restos y tampoco se
eliminan ni se interpretan como padding.

Todas las celdas mantienen el mismo tamaño y pivote de pies `(40,44)`; el contenido
visible termina en la fila 43, también durante la destrucción. La escala uniforme
es `1.25`, conservando márgenes transparentes, proporciones y bordes nítidos.
Reposo no inventa un bucle; impacto y destrucción terminan en su última celda
hasta que la lógica de tutorial cambia el estado.

`tutorialAssets.ts` expone el catálogo, las duraciones y el selector puro de
fotograma. `TutorialEffects.tsx` recibe estado compartido y coordenadas del mundo
dentro del grupo de cámara existente. Su marcador pequeño de destino se dibuja
con esquinas escalonadas y centro transparente; no añade imágenes ni tapa al
personaje con un panel. Usa el caché y resolución de imágenes Android existentes.
El componente no tiene timers ni reloj propio: pausar el reloj del tutorial
congela también los fotogramas. Solo un atlas emite un sprite a la vez.

La escena jugable integra el maniquí en `ActorsScene` como un `RenderActor` de
profundidad `dummy.y`, usando el orden de dibujo existente para pasar detrás o
delante del personaje y de los objetos. Sus tres imágenes se agregan al final
del banco; no cambian índices de personajes, enemigos, Frenesis ni comerciantes.
Solo las sesiones tutorial las cargan y reservan un actor adicional. El overlay
`TutorialEffects` se usa con `renderDummy={false}` en esa escena para mostrar el
destino sin duplicar el maniquí; también puede dibujarlo solo en una previsualización.

`node scripts/check-tutorial-assets.cjs` verifica las 17 celdas, límites de
recorte, transparencia, pivote estable, primeros destellos, duración completa,
reposo estático, destrucción sin bucle y hashes originales. No prueba hardware.

`node scripts/check-battle-render.cjs` comprueba además que la carga del maniquí
sea exclusiva del tutorial, que mantenga su profundidad y pies al cambiar de
animación y que desaparezca al terminar, sin desplazar los índices existentes.

`node scripts/check-tutorial-gameplay.cjs` ejecuta los worklets serializados con
el movimiento, ataque, dash, daño y teletransporte reales. Comprueba el recorrido
completo, impactos únicos con animaciones HIT completas antes de BREAKING,
oleadas finitas de 4 y 12 enemigos, giro mantenido, pausa sin avanzar el reloj
ni la semilla, recuperación de Frenesis de práctica y ausencia de EXP,
estadísticas o recompensas persistentes. Verifica el cooldown de teletransporte
en 2999/3000 ms. Estas pruebas son simulación de código, no mediciones nativas.
