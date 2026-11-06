# 07 · Diseño, velocidad y navegación

## Diseño v2

**Un pase de diseño por cada panel, en este orden**: ingreso (`11`), Inicio
y Entrada, Cobrar, Socios y ficha, Vencen, Caja, app del socio, super
admin (`10`), Configuración, el resto. Afinar, no reinventar: lo que
funciona se queda.

Base: el tema oscuro "modo gym" que decidió Mateo (grafito + verde,
`globals.css`, `docs/DISENO.md`). Se mantiene el esqueleto (saludo, accesos
grandes, 4 números, "ahora y lo que sigue", menú agrupado). Se sube el
nivel:

- **Vidrio** (efecto iPhone) para todo lo que flota: la ventana de Entrada,
  Cobrar, los avisos en vivo, Ctrl+K, menús. `backdrop-filter: blur(20px)
  saturate(1.4)`, fondo semitransparente, borde de 1 px claro, sombra
  grande y suave. Con fallback sólido si el navegador no lo soporta y con
  `prefers-reduced-transparency`.
- **Movimiento con intención** (CSS, sin librerías pesadas). Duraciones:
  150-200 ms en compu, ~225 ms al entrar y ~195 ms al salir en celular; más
  de 400 ms se siente lento.
  - Sí: entrar/salir de lo flotante, tilde que se dibuja al confirmar, filas
    que entran o salen de una lista, el semáforo que aparece al instante con
    un pulso, press state `:active` (escala 0,97) en todo botón,
    respuesta optimista con vuelta atrás donde fallar es raro (tildar
    tarea, reservar, marcar presente).
  - No: animaciones de página completa en cada clic, contadores que suben
    de a poco en los números de Inicio, rebotes en tablas, confetti
    repetido (solo en hitos del socio).
  - **View Transitions de Next**: siguen experimentales ("not recommended
    for production"): **no** activar `experimental.viewTransition`. Solo la
    API nativa de CSS en la app del socio, con fallback.
  - Todo respeta `prefers-reduced-motion` (solo opacidad o nada).
- **Deshacer en vez de "¿Estás seguro?"** en lo que se revierte (cancelar
  reserva, archivar, tildar): aviso con "Deshacer" 6 s. En plata (cobrar,
  anular), confirmación explícita.
- **Jerarquía**: más aire, anchos máximos por tipo de pantalla (listas 1100
  px, formularios 640 px, Inicio 1200 px), tablas que en el celular pasan a
  tarjetas.
- **Gráficos chicos** (sparklines y barras) hechos con SVG propio, sin
  librerías grandes.
- **Componentes únicos**: un solo Botón, Tarjeta, Hoja flotante, Toast,
  Lista, Vacío, Esqueleto. Revisar todas las pantallas para que los usen.
- **Onboarding y ayuda**: la primera vez que cada rol abre una pantalla, un
  globo corto ("Esto es Vencen hoy: los que hay que cobrar") que se cierra y
  no vuelve (guardado por usuario en la base, no en el navegador). "¿Qué es
  esto?" en cada número y opción.

## Velocidad

Meta: **< 100 ms** del toque al primer cambio, **< 1 s** para ver datos en
una pantalla común, con 3.000 socios por gimnasio y 200 gimnasios.

- Medir primero: un script que abre las pantallas clave con el demo grande
  (3.000 socios) y anota tiempos (servidor y navegador); el resultado va al
  LOG y se compara después de cada cambio.
- Base: revisar con `explain analyze` las funciones de las pantallas
  principales (Inicio, Entrada, Socios, Vencen hoy, Retención, Caja) con
  3.000 socios; índices que falten; paginación en listas largas (nunca traer
  todos).
- Servidor: pedidos en paralelo (`Promise.all`), nada en cascada; datos que
  cambian poco (marca, configuración, planes, secciones) con caché por
  gimnasio y revalidación al guardar.
- Navegador: `<Link>` con prefetch, respuesta optimista donde es seguro
  (tildar tarea, marcar contactado), `useTransition` para no congelar, lo
  pesado (cámara, gráficos) cargado solo cuando se abre.
- Vercel en la misma región que Supabase (`gru1` si Supabase está en São
  Paulo) — verificar y anotar en QUÉ CONFIGURÁS VOS si no.
- **Que no se caiga**: `error.tsx` en cada sección con "Reintentar" y el
  texto de la base; ningún error deja la pantalla en blanco; límites de
  tamaño en todas las listas; los avisos en vivo se pausan con la pestaña
  oculta.

## Navegación con memoria

- **Volver** siempre visible arriba a la izquierda en pantallas internas;
  lleva **al lugar de origen** (no a una ruta fija): se pasa `?desde=` o se
  usa el historial si existe.
- Filtros, búsqueda, pestaña y página en la URL (así Volver y compartir
  funcionan); el scroll de las listas se recuerda al volver.
- Después de una acción (cobrar, dar de alta, aprobar), se vuelve al origen
  con un aviso de lo que pasó.
- Cada pantalla tiene salida: nada de pantallas sin Volver o sin menú.
- **Ctrl+K** hace también acciones: "cobrar a Juan", "nuevo socio", "abrir
  turno", "vencen hoy", "ir a configuración de reingreso".
- La ventana de Entrada, Cobrar y Ctrl+K funcionan encima de cualquier
  pantalla y al cerrarse dejan todo como estaba (foco incluido).
