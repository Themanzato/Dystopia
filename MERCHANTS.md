# Vendedores de arena

Solo en Supervivencia. Se reutilizan los cuatro PNG originales, sin modificarlos ni mostrar sus nombres de archivo en el juego:

| Archivo | Hoja | Celda / recorrido | Animación / escala |
|---|---|---|---|
| `Traveler merchant/01 Traveler Merchant-Idle Blue.png` | 240 × 32 | 24 × 32, 10 columnas | 8 FPS / 1,6 |
| `Gem Merchant/Gem Merchant.png` | 101 × 444 | 101 × 37, 12 filas | 8 FPS / 1,35 |
| `Fruit merchant/03 Fruit Merchant-Red.png` | 552 × 38 | 46 × 38, 12 columnas | 8 FPS / 1,5 |
| `Merchant 1 - Scavenger Merchant/Merchant 1 - Scavenger Merchant 199x106.png` | 2388 × 106 | 199 × 106, 12 columnas | 8 FPS / 1,15 |

Todos están bajo `assets/assets/merchants/`. Se revisaron las hojas completas y sus primeras cuatro celdas ampliadas. El recolector incluye su estructura completa y exige un espacio libre proporcional. Los actores usan el orden por profundidad del escenario, píxeles nearest, sus transparencias y un pivote estable a los pies.

## Aparición e interacción

`merchantConfig.ts` centraliza los valores: hito cada cinco oleadas (5, 10, 15...), vida disponible 30 segundos activos y salida de 600 ms. Ya no hay apariciones por tiempo. El hito se registra una sola vez; si hay un encuentro incompatible queda una sola oportunidad pendiente, con reintentos de un segundo. Un hito posterior reemplaza la oportunidad pendiente; si ya existe un vendedor, ese hito se omite. Nunca se acumula una cola. Purgatorio conserva su exclusión.

Al agotar los 30 segundos, el vendedor deja de aceptar compras y se disuelve en pasos de cuatro píxeles con parpadeo y opacidad decreciente. El recorte y el pivote avanzan juntos para mantener fijos sus pies; no se modifican los sprites originales. Pausa, tienda, selecciones, cuenta regresiva y segundo plano detienen su reloj. Al terminar la partida se limpian el vendedor y la oportunidad pendiente.

La búsqueda prueba como máximo 64 posiciones, con el sprite completo fuera de la cámara más 24 unidades de margen, suelo transitable, ruta alcanzable y separación de edificios, cofres y enemigos. El tipo varía sin repetirse consecutivamente. Dura 30 segundos efectivos de partida. La aparición se indica solo durante los primeros tres segundos mediante una flecha junto al centro/jugador, con el mismo trazado y distancia que la alarma de nave. Apunta al vendedor usando las coordenadas reales del jugador y de la cámara. Reemplaza el marcador del borde y el panel de Suministros; no intercepta toques.

Entrar a 52 unidades abre automáticamente la tienda y detiene simulación, combate, oleadas, música de batalla y temporizador del vendedor. Cerrar inicia la cuenta 3, 2, 1 existente. Hay que alejarse más de 78 unidades antes de que pueda abrirse de nuevo por proximidad. Pausa y segundo plano conservan el estado.

## Inventario y balance

- Suministros: dos mejoras distintas aleatorias del sistema actual, una compra por oferta. Paso ligero 330, Dash calibrado 340, Filo amplio 360, Imán 320, Vitalidad 450 y Ritmo de acero 375 Celdas. Se respetan sus topes y la vida única. Si quedan menos de dos mejoras elegibles, se aplaza ese tipo de visita.
- Fruta: restaura un punto de vida por 50 Celdas. Se puede repetir mientras falte vida; nunca descuenta al estar lleno.
- Recolector: una placa de armadura por 35 Celdas, máximo tres puntos. Absorbe daño antes de la vida normal, puede recibir daño excedente y conserva la invulnerabilidad y respuesta visual normales. No se regenera ni persiste a otra partida. Frenesis conserva su barra temporal como primera protección. La armadura se muestra en HUD y pausa y no está disponible en Dystopia, que exige una sola vida.
- Gemas: paquetes de 150, 300 y 1000 Celdas con precios propuestos de MX$29, MX$49 y MX$129; eliminación de anuncios propuesta a MX$79. También hay una prueba de anuncio de +25 Celdas. **Todo este apartado es una demo gratuita**: no usa SDK de pagos/anuncios, no cobra dinero y no reproduce anuncios. Los paquetes sí suman las Celdas indicadas al saldo persistente. La opción sin anuncios guarda solamente `adFreePreview`, claramente identificada como simulación.

## Compras y persistencia

Se utiliza el mismo archivo y la misma cola serializada de `ScoreStorage` que Taller, misiones y resultados. El precio se deriva del catálogo, no de un valor recibido desde la UI. Cada operación tiene un ID y recibo durable; toques rápidos no duplican la compra. El botón permanece ocupado hasta confirmar el efecto en el hilo de juego y su recibo. Los efectos de mejoras van a la partida actual, nunca a las ventajas preparadas del Taller.

Si el efecto no puede aplicarse porque se cerró la escena, se reembolsa el débito una sola vez. Si la app se cierra entre el pago y la confirmación, el siguiente arranque recupera ese débito pendiente antes de publicar el saldo. Un efecto ya confirmado no admite reembolso. Los fallos de almacenamiento conservan el saldo previo y se muestran en la tienda. Los datos antiguos sin recibos de vendedores siguen siendo válidos.

## Verificación

`check-merchants.cjs` verifica 46 recortes originales, 99 posiciones ocultas y alcanzables, intervalos, expiración, bloqueo de eventos, apertura/reapertura, dos ofertas distintas, topes, curación repetida, armadura e invulnerabilidad, vida única, compras concurrentes, saldo insuficiente, persistencia, errores de escritura, reembolsos y recuperación tras cierre, paquetes de prueba e invocación serializada del worklet.

La revisión web utiliza estados controlados para llegar a cada tienda: cuatro sprites, compra real de mejora, dos curaciones, armadura, paquetes gratuitos, registro del recibo y cierre con cuenta regresiva, en horizontal a 844 × 390 y 568 × 320. Estas comprobaciones no son pruebas en un celular físico ni mediciones de FPS nativos.

También se verificó una aparición mediante el planificador real, con el sprite completo fuera de cámara, la señal desvanecida después de tres segundos y la expiración del vendedor. El panel completo cabe dentro de la pantalla de 568 × 320; su inventario es desplazable. Pasaron TypeScript, lint y las 59 verificaciones automatizadas disponibles, incluyendo las regresiones de combate, eventos, Taller y controles. La exportación Android/Hermes terminó con 181 recursos y 2216 módulos; no se instaló un APK en hardware.
