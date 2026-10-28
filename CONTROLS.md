# Editor de controles y HUD

El editor muestra la escena del juego dentro de un cuadro con borde y márgenes. Conserva las proporciones de la pantalla real, con mapa y Swordmaster estáticos: no ejecuta combate, apariciones, movimiento ni audio de partida. Usa los mismos sprites de botones y componentes visuales que la interfaz jugable. Guardar/Volver están en la barra superior; Ocultar/Mostrar panel y Restablecer por defecto están debajo del cuadro. La lista y los deslizadores están en un panel lateral fuera de la vista previa.

## Elementos

Se editan 10 elementos existentes: joystick, ataque, dash, pausa, Frenesis, vida/EXP/nivel/protección, oleada/cadena y enemigos restantes en un único contenedor, nombre y vida del jefe, panel de objetivos y avisos de misiones completadas. Captura, alarma de nave y eventos opcionales comparten el mismo slot de objetivos porque su presentación es excluyente. Los potenciadores activos solo se presentan en pausa: ese menú no se altera ni se duplica dentro del HUD jugable.

Se puede seleccionar desde el marco o la lista horizontal. El seleccionado se dibuja por delante de los demás, con marco resaltado. La lista permite seleccionar elementos cubiertos por otro. Los gestos del editor no llaman a movimiento, ataque, dash ni activación de Frenesis.

## Posiciones y tamaños

`controlSettings.ts` registra IDs estables y validación. `controlLayout.ts` comparte la geometría entre editor, controles reales y `GameplayElement`. Las posiciones se guardan como centros normalizados y la escala conserva las proporciones del arte. Los límites editables son los bordes del área simulada completa; el cuadro exterior no introduce márgenes extra dentro del juego. `controlEditorPreview.ts` calcula una escala uniforme para encajar la escena. El arrastre convierte las distancias de pantalla dividiéndolas por esa escala antes de actualizar los centros normalizados. Ocultar el panel cambia la escala de presentación, no la configuración del juego. Las áreas seguras guían la distribución inicial, sin convertirse en barreras de arrastre. Todos los controles de acción conservan al menos 48 px táctiles.

No se empujan elementos ni se buscan posiciones alternativas automáticamente. Un solapamiento produce una advertencia discreta. Al pulsar Guardar se pide confirmación si existen superposiciones; Guardar así confirma la distribución. Se conservan ambos lados del par para mantener su alineación al adaptar la resolución. Volver descarta todo el borrador, incluidas superposiciones no guardadas.

La adaptación limita el dibujo al rectángulo visible sin reescribir las coordenadas guardadas. Los perfiles antiguos `layout` se interpretan con su antiguo origen de áreas seguras y margen de 2 px, y se convierten al nuevo sistema sin perder sus centros. Los elementos que no se personalizaron conservan la distribución predeterminada adaptable.

## Opacidad y persistencia

Cada elemento dispone de tamaño y opacidad propios. Los deslizadores muestran el valor actual y tienen controles +/-, descripciones y acciones accesibles. Se muestra además la opacidad efectiva: individual multiplicada por la global correspondiente.

- Opacidad de botones: joystick, ataque, dash, pausa y Frenesis.
- Opacidad del HUD: vida, EXP, oleada, enemigos, jefe, objetivos y avisos.

Las opacidades no cambian las zonas táctiles. Solo afectan a la partida y su representación en la vista previa; no a los paneles del editor, menú principal, ajustes, pausa, carga, resultados ni selecciones de recompensas.

Los cambios permanecen exclusivamente en el estado local del editor. **Solo Guardar** escribe el perfil con el AsyncStorage existente, bajo `@dystopia/controls/v1`. El perfil de la partida se actualiza únicamente cuando la escritura termina correctamente. Volver y el botón Atrás del dispositivo descartan el borrador. Restablecer por defecto confirma y cambia solo el borrador: también requiere Guardar. Mientras se guarda se bloquean nuevas ediciones y pulsaciones repetidas; un error conserva el perfil anterior y permite reintentar sin perder el borrador.

El arrastre se dibuja con valores compartidos y se incorpora al borrador al soltar, sin reconstruir el árbol React por cada movimiento. Los valores del deslizador se reflejan inmediatamente en la vista previa. No se llama a `updateControls` ni `resetControls` desde el editor. Los datos ausentes o inválidos reciben valores seguros.

## Archivos principales

- `ControlSettingsPanel.tsx`: selección, lista, arrastre, deslizadores, confirmación y restauración.
- `controlSettings.ts`, `controlLayout.ts`, `ControlPreferences.ts`: datos, geometría, migración y almacenamiento.
- `controlEditorPreview.ts`: encaje proporcional de la vista previa y preparación del borrador para Guardar.
- `GameplayElement.tsx`, `GameHudVisuals.tsx`, `ControlElementPreview.tsx`: posiciones y visuales compartidos.
- `TouchControls`, `FrenesisHUD`, `SurvivalHUD`, `WorldEventEffects`, `OptionalEventEffects`, `MissionBridge`, `BossOffscreenIndicators`: integración con la interfaz real.

No se cambian versiones ni assets originales. Se reutilizan los PNG de ataque/dash, los iconos de mejoras, los marcos, la tipografía pixel art y el escenario existentes.

## Verificación del cuadro y guardado manual

TypeScript y lint pasan. Pasan `check-control-layout.cjs`, `check-control-settings.cjs` y `check-menus.cjs`. Se comprueban encaje proporcional con/sin panel en cuatro resoluciones, inmutabilidad al preparar el guardado, confirmación de superposiciones y almacenamiento atómico: una escritura fallida o pendiente no sustituye el perfil aplicado; reintentar y guardar valores predeterminados funciona.

Se ejecutó la app web real a 844×390 y 568×320: cuadro con márgenes, panel y acciones exteriores, proporción exacta, arrastre reducido que produce las coordenadas lógicas correctas, edición sin escrituras, Volver descarta, Guardar persiste, restablecer sin guardar conserva el perfil anterior, confirmación de superposiciones al guardar y reapertura en frío. Se revisaron capturas. No se probó en un celular físico ni se midió rendimiento nativo.


## Respuesta de los deslizadores

`ControlSlider.tsx` mueve el cursor y el relleno directamente con valores compartidos en el hilo UI, sin animaciones de interpolación ni esperar a React. El arrastre conserva la precisión visual continua. La vista previa y el porcentaje reciben como máximo una actualización pendiente y siempre leen el valor más reciente; se agrupan las muestras a 32 ms durante el movimiento y se entrega el valor final al soltar. Un render atrasado no puede devolver la barra a un valor anterior. Los botones +/- conservan su paso y los cambios externos/restablecimiento se sincronizan. Se mantienen el diseño y el guardado manual.

La escena estática, los visuales y los controles no modificados se memorizan para evitar reconstruirlos con cada porcentaje. `check-control-slider.cjs` simula 600 movimientos con JS retrasado: la barra sigue el puntero, existe como máximo una entrega pendiente y se aplica solo el valor final reciente. Se comprueban también valores externos, pasos +/-, callbacks tras desmontar y transformación nativa del cálculo. La app web se probó a 844×390 y 568×320 con 88 muestras de cambios de dirección y extremos en las cuatro barras, sin progresión escalonada después de soltar ni escrituras antes de Guardar. No es una medición de latencia en celular físico.


## Alineación y panel unificado

Oleada/encuentro y enemigos usan un solo `WaveReadout` con un marco. `wave` sigue
siendo la clave persistente y mantiene la configuración guardada. La antigua clave
independiente `enemies` se ignora al leerla, sin restablecer los demás elementos.
El editor muestra una única entrada «Oleada y enemigos» que mueve, escala y ajusta
la opacidad del conjunto. En Purgatorio el mismo panel incluye el progreso de cadena.

Frenesis recibe el mismo viewport medido que vida/EXP. La vida reserva una altura
visual mínima de 68 px, igual a la ultimate, tanto con armadura como sin ella: el
preview con armadura ya no muestra una alineación distinta a una partida sin armadura.
Se conservan los centros normalizados, tamaños y opacidades personalizados.

Verificación de alineación: comparación de rectángulos reales de editor y partida
con vistas 844×390 y 568×320, incluyendo cambio de armadura. Coinciden posición y
tamaño; existe un solo panel de oleada/enemigos. TypeScript, lint, 65 verificaciones
y exportación Android/Hermes correctos. Revisión web; sin prueba en celular físico.
