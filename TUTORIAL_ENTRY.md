# Entrada y persistencia del entrenamiento

El primer botón START / «Comenzar partida» consulta `@dystopia/tutorial/v1` antes
de abrir la dificultad. Si todavía no se ha ofrecido el tutorial, abre la ruta
Expo Router `/tutorial`: **Comenzar**, **Saltar** y **Volver**. El ofrecimiento es
independiente de la carga del juego; no crea una partida ni compra ventajas.

- Comenzar conserva el flujo de carga/oscurecimiento existente e inicia una
  sesión con `tutorial=true`, dificultad de práctica Fácil y equipo vacío.
- Saltar registra la decisión y sigue hacia la dificultad normal. Saltar nunca
  se registra como completar.
- Volver regresa al menú que abrió el ofrecimiento, sin comenzar el juego.
- Ajustes incluye **Repetir tutorial**. Se deshabilita durante una partida para
  no descartar una sesión activa; sigue disponible desde Ajustes del menú.
- La pausa, Ajustes y reanudar mantienen la misma sesión de entrenamiento.
- Tras completar, el callback persiste la finalización una sola vez. «Iniciar
  partida» cubre la escena, desmonta el tutorial y abre la selección de dificultad.
  No convierte la escena tutorial montada en una partida real.
- Salir anticipadamente desmonta el tutorial y vuelve al menú. Los callbacks de
  una sesión anterior están protegidos por una época de sesión.

`TutorialStorage.ts` conserva flags `offered`, `skipped` y `completed` separados;
lee formatos inválidos con valores seguros, serializa escrituras, deduplica
callbacks y permite reintentar una escritura fallida. Completar conserva su estado
al reiniciar y no retrocede si se vuelve a saltar un tutorial repetido.

`GameHost` usa el juego directamente para el tutorial, evitando `EquippedRun` y
`consumePreparedAdvantages`. Tampoco le pasa el callback de victorias Purgatorio.
Las Celdas, ventajas preparadas, misiones y récords usan sus claves existentes y
no se modifican por entrar, pausar o completar el entrenamiento. La sesión normal
siguiente consume sus ventajas al arrancar de la forma habitual.

Verificaciones: `check-tutorial-storage.cjs` prueba validación, reabrir, decisiones
separadas, duplicados y recuperación de errores. `check-tutorial-flow.cjs` ejecuta
la navegación, pausa, salto, repetición, fin y salida sobre los menús reales con
un host de juego simulado. Compra una ventaja de fixture y comprueba que el
tutorial no la consume, mientras que la partida normal siguiente sí lo hace.
`check-menus.cjs` conserva la cobertura completa del flujo normal con tutorial ya
ofrecido. No se afirma prueba de hardware por estas verificaciones.
