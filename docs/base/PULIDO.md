# Pulido: todo lo que hay que dejar perfecto (11/11)

Tres revisores leyeron todo el código el 11/11: el mostrador, el socio y la
página, y el dueño con el super admin. Cada punto trae el archivo y la línea.
**Salió de leer el código, no de abrir las pantallas**: antes de arreglar cada
cosa, se confirma abriéndola (o con el e2e). Si no se reproduce, se anota y se
sigue.

Marcas:
- [ROTO]: no funciona o hace algo mal.
- [FLUIDEZ]: no cumple `FLUIDEZ.md`.
- [TEXTO]: cómo dice las cosas.
- [DISEÑO]: no cumple `DISENO.md`.
- [FALTA]: un detalle o una función que no está.
- **· plata** o **· permisos**: se arregla con la opción más segura y queda
  anotado en `PREGUNTAS.md`.

## Orden (fase Z de `RECTA-FINAL.md`)

1. **Z1 · Los [ROTO]**, todos, en los tres bloques. Los que pegan hoy en Temple
   Gym van primero:
   - el lector USB del kiosco,
   - el QR que queda vencido sin señal,
   - los avisos que tapan el botón y la barra,
   - Cobrar que se cierra mientras cobra,
   - cambiar un rol de un toque,
   - los íconos vacíos en el rojo y en la caja,
   - exportar sin filtros,
   - "Salir" del socio,
   - el login que no recuerda la sesión.
2. **Z2 · Los íconos de una vez**: ningún ícono vacío (`""`), ningún emoji
   crudo (ni los que vienen de la base) y ningún "✓ ✕ ＋" de texto. Un chequeo
   en `npm run chequeos` falla si aparece uno.
3. **Z3 · [FLUIDEZ]**:
   - Botones con "…ando" y aviso a los 10 s (en `BotonAccion`, una sola vez).
   - El atrás del celular cierra hojas y menús.
   - Esc no cierra mientras guarda.
   - Errores al lado del campo, y formularios que no se vacían con error.
   - Borradores y "cambios sin guardar" que también frenan los links del menú.
   - Memoria de navegación en todas las listas.
   - En vivo en caja, campana, mensajes y transferencias.
4. **Z4 · [TEXTO]**: códigos internos traducidos, errores humanos (el detalle
   va al log), un solo nombre por pantalla, y sin frases de plantilla.
5. **Z5 · [DISEÑO]**: menú en 4 secciones, títulos de 28 px, colores solo por
   token, esquinas de 10 y 8 px, botones de 44 a 48 px, y sin vidrio ni
   degradé.
6. **Z6 · [FALTA]** y los detalles premium de cada bloque, en el orden en que
   están.

## Transversal (vale para todas las pantallas)

- Números y fechas con un solo formato:
  - plata con `formatearPesos()`,
  - DNI con puntos al mostrar y sin puntos al buscar,
  - celular `+54 9 …`,
  - fechas "hoy", "ayer", "lun 12/11", siempre en la hora del gimnasio
    (nunca la de la compu).
- Todo aviso de éxito en pasado, con el dato y, si se puede, Deshacer:
  "Cobrado $25.000 a Lucía · Deshacer".
- Toda lista tiene buscador, contador ("43 socios"), exportar con los mismos
  filtros, y paginación en la base.
- Todo vacío dice qué hacer y tiene el botón.
- Accesibilidad:
  - foco visible,
  - contraste AA también con el acento del gimnasio (`--sobre-acento`),
  - `aria-label` en los botones que solo tienen ícono,
  - nada de 12 px para leer.
- La tecla "?" muestra los atajos en el panel y en `/super`.
- Sin conexión: una franja "Sin conexión" en el panel y en la app, y que nada se
  pierda.
- "Hay una versión nueva": recargar sin perder lo escrito.

## Recepción, caja y cobro (auditoría del 11/11, leyendo el código)

**Un problema que se repite:** al sacar los emojis quedaron íconos vacíos (`""`) justo en los estados más importantes: el rojo, el "no pudo entrar", la salida y los retiros de caja. Y en Inicio y en Entrada todavía hay emojis crudos que vienen de la base. Se arregla primero, en todos lados juntos.

### Entrada (pantalla, `Puerta.tsx`)
- [ROTO] Si falla Anotar, Dejar pasar, Salida o Volvió antes, el error queda debajo del veredicto, que tapa toda la pantalla (343 contra 294). → El error dentro del veredicto.
- [ROTO] Con el foco fuera del campo, tipear un nombre que empieza con "S" marca la salida del socio en pantalla (239). → Sacar el atajo S de esta pantalla o mostrarlo con su tecla.
- [ROTO] Una búsqueda vieja pisa a la nueva (84-91). → El control de VentanaEntrada.tsx:471.
- [FLUIDEZ] Con 2 letras ya dice "No encontramos… Darlo de alta" antes de buscar (311). → "Buscando…" primero.
- [ROTO] Los chips de la guía muestran emoji crudo: falta `sistema` en `<Icono>` (358).
- [DISEÑO] Rojo sin ícono (20, 348); verde y amarillo con "✓" y "!" de texto; spans vacíos en 277 y 290; "✕ Otro socio" (383). → ok, alerta, prohibido, salir y cerrar.
- [FALTA] "Darlo de alta" no lleva el DNI escrito (Puerta.tsx:313, VentanaEntrada.tsx:835/839, Carrito.tsx:218; socios/nuevo/page.tsx:13). → `?dni=` y `?volver=`.
- [TEXTO] "Ya usó su prueba gratis… Hacete socio." le habla al socio en la pantalla de la recepción (Puerta.tsx:186, VentanaEntrada.tsx:312). → "Ya usó la prueba el 3/11: ofrecele un plan o un pase."
- [FALTA] Por QR o llavero, "Entró Juan" sale sin foto: un QR prestado pasa sin que nadie vea la cara (108-113). → Foto chica.
- [FALTA] La lista "Hoy" se corta en 40 sin avisar, y Anular está escondido y no confirma nada (Hoy.tsx:115, 130, 136).

### Ventana de Entrada y avisos
- [ROTO] El botón flotante queda vacío cerrado: `{abierta ? "✕" : ""}` (VentanaEntrada.tsx:734). → Ícono de puerta y F2.
- [DISEÑO] Ese botón y el de Inicio usan el verde del semáforo, blanco fijo y sombra propia (732-733, page.tsx:62). → `--acento`, `--sobre-acento`, `--sombra-flota`.
- [FLUIDEZ] En modo aviso, dos Enter rápidos anotan dos veces y mientras espera no se ve nada (245, 799-803, 811). → Traba y "Anotando…".
- [DISEÑO] Íconos vacíos (40, 932, 994, 1017) y "✓ " de texto (881).
- [FLUIDEZ] "Deshacer" vuelve a la búsqueda en silencio (655). → "Entrada de Juan anulada".
- [FALTA] Las 5 últimas de la barra fija no se pueden tocar (758-763). → Que abran el panel lateral.
- [TEXTO] `conPuntos` pone puntos a un celular ("3.875.551.234") (83-87). → Solo hasta 8 cifras.
- [ROTO] Los avisos (`fixed bottom-4 right-4 z-50`, AvisosEntrada.tsx:157) tapan el botón flotante, la barra fija y, en celular, la barra de abajo. D56 no está hecho (globals.css:386).
- [DISEÑO] Tiempos del código: verde 6 s, amarillo y azul 12 s, rojo nunca (27-28, 96). DISENO dice 5, 8 y 12 s. → Alinear.
- [DISEÑO] Rojo y azul sin ícono en los avisos (44, 117); "✕" de texto de 32 px y Cobrar de 36 px (167-168). → 48 px.
- [FALTA] Los rechazos que llegan de la tablet o del QR no suenan (77-99).

### Panel lateral (`PanelSocioLateral.tsx`)
- [TEXTO] Códigos internos a la vista: "entro", "forzado", "rechazado", "mercadopago", "cuenta_corriente" (91, 94, 102). → Las etiquetas de Hoy.tsx:98 y Turno.tsx:12.
- [FALTA] Sin foto; "Cargando…" solo en el título; sin Reintentar si falla (62, 65).
- [FLUIDEZ] "Ver la ficha completa" es `<a>` y Cobrar hace `window.location.href`: recargan todo (52, 107). → `<Link>`.
- [FLUIDEZ] "Dejar pasar igual…" obliga a tocar Dejar pasar otra vez, y se ofrece aunque el socio esté suspendido (87).

### Cobrar (`cobrar/Cobrar.tsx`)
- [FALTA] Sin vuelto en efectivo (350-403). → "Paga con $…", el vuelto, y billetes rápidos.
- [FLUIDEZ] Esc o click afuera cierran la hoja mientras está "Cobrando…" o con cambios (Hoja.tsx:27/41, CobrarHost.tsx:25). → No cerrar mientras cobra; preguntar si hay cambios.
- [DISEÑO] Dos X (Hoja.tsx:45 y Cobrar.tsx:240).
- [TEXTO] "Faltan -$500" cuando sobra (Cobrar.tsx:373, Carrito.tsx:358). → "Sobran $500".
- [FALTA] Con dos medios, el segundo no se completa con el resto (365-372).
- [TEXTO] "Cobrado $25.000" sin el nombre (211). → "Cobrado $25.000 a Lucía".
- [DISEÑO] `icono=""` (328, 331); "＋" de ancho completo (251, 312); ok del cupón con `--acento` (320); − y + de 36 px (287, 290).
- [FLUIDEZ] El error del precio de "Otra cosa" sale lejos del campo (337 → 440).
- [FLUIDEZ] Ningún botón avisa a los 10 s "está tardando más de lo normal": BotonAccion.tsx no tiene timer. → Agregarlo, con Reintentar y la misma clave de operación.

### Vender (`vender/Carrito.tsx`)
- [ROTO] Sin turno abierto, "Abrir caja" lleva a /panel/caja y se pierde el carrito (373). → AbrirTurnoCobrar como en la hoja.
- [ROTO] La búsqueda se traga los errores y los muestra como "No está" (70); sin control de respuestas viejas.
- [FALTA] Sin pase diario para alguien que no es socio (249); "Pase diario" de Inicio abre Vender vacío (page.tsx:75). → Pase con nombre y DNI en el momento.
- [TEXTO] La bajada dice "Cuotas…" y la tarjeta dice que la cuota se cobra en Cobrar (page.tsx:33 vs Carrito.tsx:230).
- [DISEÑO] La línea con descuento se ve neta en Vender y bruta en Cobrar (298 vs Cobrar.tsx:262).
- [FALTA] Teclado: Enter no elige el primer socio, no hay flechas, Enter no cobra (208-215, 376).
- [FLUIDEZ] `Boton` declarado dentro del render (157): cada toque vuelve a montar la grilla y se pierde el foco.
- [DISEÑO] Íconos vacíos (240, 256); "Cobrar ↓" y `shadow-lg` sin token (283-285).

### Caja
- [ROTO] En "Entradas y salidas de plata" no se distingue qué entró y qué salió (caja/reporte/page.tsx:74, caja/historial/page.tsx:84). → +/− o ícono.
- [FALTA] Cerrar caja no pide confirmación (Turno.tsx:193-201). → "Vas a cerrar Caja 1 con $84.500 contados", y "ayer cerraste con $X" como referencia.
- [FLUIDEZ] "Entra plata" y "Sale plata" terminan en silencio y no se ve la lista de movimientos (177).
- [FLUIDEZ] Abrir, Anotar y Cerrar se ponen grises sin decir qué hacen (89, 189, 201).
- [ROTO] La hora del cierre que va por WhatsApp sale en la zona de la compu (Turno.tsx:126).
- [DISEÑO] "Listo" con ícono de persona (Turno.tsx:121, ParaRevisar.tsx:45); sin ícono cuando sobra plata (113).
- [FLUIDEZ] La caja no se actualiza en vivo (caja/page.tsx).
- [FALTA] "Esta sede no tiene cajas activas." sin botón (caja/page.tsx:47).
- [FLUIDEZ] Enter no envía en "Para revisar" (ParaRevisar.tsx:69, 86).
- [TEXTO] "Día siguiente →" aunque sea hoy (reporte/page.tsx:116).

### Vencen hoy
- [TEXTO] Sin vencimientos dice "Hoy es su último día cubierto…" (89).
- [TEXTO] "Prometieron pagar" y "Le prometieron pagar" (25 vs 74); el bloque se repite en la pestaña Hoy (107).

### Transferencias (`Pendiente.tsx`)
- [FALTA] "Aprobar" no tiene vuelta y no compara con lo que debía (32-38). → "Debe $25.000 (Mensual)", amarillo si no coincide.
- [TEXTO] "Aprobada · Juan" sin monto (27); "✕" de glifo (39, 43).
- [FALTA] El comprobante se abre en otra pestaña (17-24). → Miniatura.
- [FLUIDEZ] No es en vivo y los botones no dicen "Aprobando…" (38).

### Inicio (`panel/page.tsx`)
- [ROTO] "Para hacer hoy" y "Ahora y lo que sigue" muestran emojis crudos que vienen de la base (20261106005000_para_hacer_hoy.sql:35-38); falta `sistema` (177, 206, 232).
- [DISEÑO] El saludo termina con el ícono de cerrar sesión (57).
- [FLUIDEZ] "Cobrar" y "Pase diario" llevan a Vender vacío (73, 75): 3 pasos. → Directo a la hoja Cobrar.
- [FLUIDEZ] En Últimas entradas, "Cobrar" va a Vender (UltimasEntradas.tsx:49); rechazado sin ícono (41).
- [TEXTO] "Cumple 34" (385) → "Cumple 34 años"; "✓" de texto en invitados (288).

### Kiosco (`Kiosco.tsx`)
- [ROTO] El lector USB de QR no anda: cada tecla pasa por `replace(/\D/g,"")` y la "G" de "GYMOS1." se borra (165). → El detector de lector.ts.
- [ROTO] Sin internet, `mandar` no tiene try/catch y termina en la pantalla de error (83-88). → "Sin conexión: pasá por recepción", con sonido.
- [FLUIDEZ] Mientras busca no dice "Buscando…" (171).
- [TEXTO] "EMERGENCIA activa: pasá por la puerta" en mayúsculas y confuso (148).
- [DISEÑO] El error de sistema suena igual que el rojo, y el rojo se va a los 4 s igual que el verde (87, 100).

### Detalles premium que faltan en el mostrador
1. Cuenta regresiva visible de "se cierra sola", con Deshacer hasta que termina.
2. Las 3 últimas entradas debajo del campo de la ventana.
3. Imprimir el ticket en impresora térmica de 58 u 80 mm.
4. Vuelto y billetes rápidos ($10.000, $20.000, justo).
5. Al elegir Transferencia en Cobrar: alias y CBU del gimnasio con Copiar y QR.
6. Aviso amarillo "vence en 2 días" con "Renovar".
7. Foto grande en avisos y panel lateral, que se amplía al tocarla.
8. Tecla "?" con todos los atajos.
9. Deshacer de 5 s en Entra plata, Sale plata, Aprobar transferencia y Anular entrada.
10. Sonido propio para los rechazos de la tablet o del QR.
11. Tablet en reposo con reloj y logo; al entrar "¡Pasá, Juan!" con foto y días que le quedan.
12. En el panel lateral: "vino 3 veces esta semana", "última vez: martes".
13. Cierre de caja con "ayer cerraste con $X" para ver un cero de menos antes de confirmar.

## Socio y página (auditoría del 11/11, leyendo el código)

### Landing del gimnasio (`src/components/landing/Landing.tsx`, `src/app/page.tsx`)
- [ROTO] "Quiero ser socio" aparece siempre, aunque el dueño apagó las altas (475, 500, 515, 581). → Mostrarlo solo con `landing.altas_online`, como ComoEmpezar (430).
- [FALTA] La landing no mira la sesión: siempre "Soy socio" → /ingresar (477). → Con sesión: "Hola, Juan · Ir a mi perfil · Cerrar sesión" (page.tsx:66).
- [DISEÑO] Falta "Ya soy socio, entrar" grande en la portada (497-501, 511-517). → Los dos botones grandes de SOCIO-FLUJO §1.
- [DISEÑO] Mismo ícono `pesa` para "Quiero ser socio" y "Soy socio"; "Ver planes" con `fuego`; "Soy del equipo" con `campana`. → `persona`/`mas`, `llave`, `tarjeta`.
- [DISEÑO] Colores sueltos (`bg-neutral-900`, `text-white`, `white/15`, `from-black/85`, 485-500) y `shadow-lg` (556). → Tokens y `--sombra-flota`.
- [DISEÑO] Grilla de tarjetas iguales en Actividades (88-95) y en Plataforma.tsx:155. → Lista con jerarquía o foto por actividad.
- [DISEÑO] Esquinas de 16-24 px (35, 275-277). → 10 px.
- [TEXTO] Textos por defecto que suenan a plantilla (`src/lib/landing-defaults.ts`:27-41). → Frases comprobables, o no mostrar la sección.
- [TEXTO] "¿Cómo me anoto?" dice "por WhatsApp" aunque haya altas online (53); "¿Puedo ir a cualquier hora?" no contesta nada (54).
- [TEXTO] Código muerto `{whatsapp ? "" : ""}` (499, 514).

### Quiero ser socio (`src/app/hacete-socio`)
- [ROTO] Sin reglamento cargado no se puede anotar nadie: `d.abierta && d.planes?.length && d.reglamento` (page.tsx:62). → Reglamento opcional.
- [FALTA] No pide contraseña ni deja la sesión abierta; el final manda al login (FormAlta.tsx:68). → Contraseña en el alta y sesión abierta.
- [FALTA] DNI sin `pattern`, `maxLength` ni el aviso (FormAlta.tsx:103). → `\d{7,8}`, sacar puntos y el aviso en grande.
- [FALTA] El final no dice "Tu DNI para entrar" ni tiene "Ir a mi perfil" (42-69).
- [FALTA] Menores: la fecha acepta años futuros (106). → `max` = hoy y adulto responsable si es menor.
- [TEXTO] El mail no se pasa a minúsculas (acciones.ts:17). → `.toLowerCase()`.
- [TEXTO] `error.message` crudo (acciones.ts:34; landing/acciones.ts:97, 114, 140). → Texto humano; el original al log.
- [FLUIDEZ] El error aparece abajo y no al lado del campo (137); sin `aria-invalid`.
- [TEXTO] "¡Bienvenido/a…", "anotado/a" (47-48). → "¡Listo, Juan! Ya tenés tu cuenta en Temple Gym".
- [ROTO] "Ya sos socio" con el ícono `salir` y sin reclamar la ficha (36). → `persona` + reclamar con DNI y celular.
- [FALTA] Sin `openGraph` ni `icons` (page.tsx:34-44): en WhatsApp sale sin imagen.

### Ingresar y recuperar (`src/app/ingresar`)
- [ROTO] `linkAyudaBrik` usa `.replace(/D/g, "")` (acciones.ts:18): borra la letra D. → `/\D/g`.
- [ROTO] "Tu celular o tu mail" con `type="tel"` (IngresoSocio.tsx:121): el teclado no tiene "@". → `type="text"` + `inputMode="email"`.
- [ROTO] Con la sesión abierta, /ingresar y /socio muestran el login otra vez (proxy.ts:30, socio/route.ts:5). → Redirigir a `siguiente` o /app.
- [ROTO] "Salir" del socio cae en el login del equipo (salir/route.ts:13; lib/app/socio.ts:11). → Volver a la landing o `/ingresar?modo=socio`.
- [ROTO] Emojis como íconos (page.tsx:24-25, Encabezado.tsx:52, IngresoSocio.tsx:11/135, FormularioIngreso.tsx:40, Recuperar.tsx:40/52/66, error.tsx:12). → `<Icono>`.
- [DISEÑO] Degradé animado y vidrio (ingreso.css:4-22); logo `rounded-2xl` (Encabezado.tsx:45).
- [TEXTO] El socio ve "Esta compu la usa todo el equipo…" (FormularioIngreso.tsx:42-45). → Solo para el equipo.
- [TEXTO] El alta dice que entra con el celular; el login arranca por mail (FormAlta.tsx:104 vs page.tsx:29). → Un solo mensaje.
- [FLUIDEZ] "Volver a ingresar" y "¿Te olvidaste…?" pierden `modo=socio` (recuperar/page.tsx:38, FormularioIngreso.tsx:20).
- [TEXTO] `error.message` crudo (acciones.ts:105, 125, 145, 162, 221).

### App del socio: Inicio (`src/app/app`)
- [ROTO] La Bienvenida muestra el nombre del ícono como texto de 36 px ("celular") (Bienvenida.tsx:28). → `<Icono nombre={p.emoji} />`.
- [ROTO] "Hola, Juan" con el ícono de salir (page.tsx:103; mapa Icono.tsx:108).
- [DISEÑO] El QR queda abajo de unos 8 bloques, fuera de la pantalla en 390 px (141). → QR arriba, pegado al estado.
- [FALTA] Si el gimnasio no usa QR, no aparece "Tu DNI para entrar" en ningún lado.
- [TEXTO] Los días que quedan salen de `Date.now()` en TS: "te quedan 0 días" el último día (130). → Que lo diga la base ("vence hoy").
- [TEXTO] `<Instalar />` sin el nombre del gimnasio (194).
- [TEXTO] El aviso sin conexión le habla al socio como a la recepción (SinConexion.tsx:22).
- [TEXTO] Título de pestaña "Yo · Base" (layout.tsx:21). → Template con el nombre del gimnasio.
- [FLUIDEZ] "Salir" sin confirmación en todas las pantallas, al lado del logo (layout.tsx:47). → Solo en Yo.
- [DISEÑO] `backdrop-blur` y `text-white` sueltos (layout.tsx:38, NavSocio.tsx:46, page.tsx:112, ProgresoInicio.tsx:33).
- [DISEÑO] "✓" y "✕" como texto en 7 lugares, y emoji de actividad como ícono (page.tsx:205, clases/page.tsx:78).

### Mi QR y escanear (`MiQR.tsx`, `EscanearEntrada.tsx`)
- [ROTO] Si la renovación falla sin señal, queda un QR vencido para siempre sin aviso (MiQR.tsx:20-25). → try/catch, reintento y "Sin señal: decí tu DNI en la recepción".
- [ROTO] Al volver de la pantalla bloqueada se muestra un QR vencido. → Renovar en `visibilitychange`.
- [FALTA] Sin wake lock, aviso de brillo ni pantalla completa.
- [DISEÑO] QR `rounded-2xl` (33); "0 s" en vez de "Renovando…".
- [FALTA] Sin vibración al entrar (EscanearEntrada.tsx:42).

### Pagar, plan e historial
- [ROTO] `navigator.clipboard` sin try/catch (Pagar.tsx:16).
- [TEXTO] "No se pudo subir: ${error.message}" (Pagar.tsx:23).
- [FALTA] Sin vista previa del comprobante antes de mandarlo (Pagar.tsx:39-41).
- [TEXTO] Estados crudos "ok/revisando/rechazado" (historial/page.tsx:15, 37). → "Aprobado", "En revisión", "Rechazado" con color.
- [FLUIDEZ] Historial y Mi membresía vuelven a /app en vez de /app/yo.
- [DISEÑO] Los "← Volver" miden 22 px de alto (cuenta, historial, plan, clases, rutina, recibo). → 44 px, componente común.
- [FALTA] "¡Pago acreditado!" sin monto ni recibo (pago/Confirmando.tsx:22-30).
- [FLUIDEZ] "Pedir la pausa" sigue activo después del éxito (cuenta/Pedidos.tsx:47): doble pedido.
- [DISEÑO] Pastillas de 28 px como opciones tocables (Pedidos.tsx:41, ElegirLugar.tsx:21).

### Yo, clases y navegación
- [FALTA] Yo no muestra ni deja editar DNI, celular y mail (yo/page.tsx:52-56).
- [FLUIDEZ] Filas duplicadas en Yo y Cuenta (invitar, datos) (yo:93-96, cuenta:40-44).
- [TEXTO] Cambiar la contraseña está escondido en "Mi membresía" (yo/page.tsx:84).
- [FLUIDEZ] La pestaña Yo no queda marcada en /app/plan, /recibo, /locker y /pt (NavSocio.tsx:41).
- [FLUIDEZ] "cambiar_plan" en Clases manda a /app/yo (clases/page.tsx:113).
- [DISEÑO] Etiquetas de la barra de abajo de 12 px (NavSocio.tsx:56); token inexistente `--tarjeta-2` (MiFoto.tsx:39).

### PWA, SEO y OG
- [FALTA] El manifest no trae ícono de 512 ni maskable: Android puede no ofrecer "Instalar" (manifest.ts:16).
- [FALTA] theme-color fijo, no el del gimnasio (layout.tsx:16).
- [FALTA] Sin página sin conexión; el service worker se registra solo con los avisos (sw.js:1).
- [TEXTO] Push con ícono de Base y título "Gym OS" (sw.js:3, 5).
- [FALTA] Manifest sin `id`, `description` ni accesos directos ("Mi QR"); `short_name` cortado a mitad de palabra.
- [FALTA] robots no excluye /recepcion, /dueno, /profe, /kiosco, /tv, /super, /socio; el sitemap no incluye /privacidad.

### Detalles premium que faltan para el socio
1. Vibración y tilde que se dibuja al entrar.
2. QR a pantalla completa: wake lock, aviso de brillo, nombre y foto abajo.
3. QR que sirve sin señal unos minutos (token firmado guardado).
4. Carnet en Google Wallet y Apple Wallet.
5. Saludo de cumpleaños (y, si el gimnasio lo prende, entrar con un amigo gratis).
6. Racha grande, con "te falta 1 entrada para mantener tus 4 semanas".
7. Compartir el hito (10, 50, 100 entradas) como imagen para Instagram.
8. "Agregar al calendario" en cada clase y evento.
9. Recordatorio 3 días antes de vencer, con Pagar adentro.
10. `navigator.share` para el link de referido.
11. El último pago arriba en Yo, con su recibo.
12. "Mejor hora para venir hoy" con la ocupación en vivo.
13. Tema oscuro según el sistema.
14. Saludo según la hora, con la próxima clase y su profe.
15. Primera entrada celebrada, y aviso a la recepción para recibirlo por el nombre.

## Dueño, configuración y super admin (auditoría del 11/11, leyendo el código)

### Marco, menú y Ctrl+K
- [DISEÑO] El dueño ve unas 28 entradas en el menú, no 4 secciones (src/lib/panel/secciones.ts:33-73). → 4 grupos con su línea; Incidentes, Máquinas, Horas, Profes, Resumen y Eventos adentro de su sección o en "Más".
- [DISEÑO] Íconos repetidos en el menú: reloj ×3, pesa ×2, usuarios ×2, ajustes ×2 (secciones.ts:37-72). → Uno distinto por sección.
- [TEXTO] El menú y la pantalla no se llaman igual: "Planes y servicios"/"Planes y precios", "Retención y números"/"Retención", "Clases de hoy"/"Clases", "Para hacer hoy"/"Tareas" (secciones.ts:50,57,70; planes/page.tsx:38; lib/panel/origen.ts:13-14). → Un nombre por pantalla.
- [TEXTO] "Novedades" son dos cosas (campana/page.tsx:57, avisos/page.tsx:31); "Avisos de hoy" y "Vencen y cobrar" se pisan.
- [FLUIDEZ] El menú del celular no cierra con Esc ni con el atrás del teléfono, y la X es "✕" (components/panel/Navegacion.tsx:172-177).
- [FLUIDEZ] Ctrl+K y el panel lateral no escuchan el atrás del teléfono (components/ui/Hoja.tsx:27, PanelSocioLateral.tsx:37).
- [FLUIDEZ] La barra de abajo del dueño trae Entrada, Socios y Vender; de noche quiere Inicio, Resultado y Retención (secciones.ts:122). → Por rol o editable.
- [FLUIDEZ] La campana no se actualiza con la pantalla quieta (Campana.tsx:12-20). → Intervalo o Realtime.
- [DISEÑO] Número de la campana blanco sobre el acento: con un acento amarillo no se lee (Campana.tsx:27). → `--sobre-acento`.
- [DISEÑO] Títulos de 48-60 px con un ícono de 36 px arriba; DISENO pide 28 px. La campana puede pisar el título en 360 px (Marco.tsx:61, 90-91).
- [DISEÑO] Restos de los emojis: grayscale en íconos de línea (Navegacion.tsx:152) y ejemplos de Ctrl+K como texto (Buscador.tsx:162).

### Errores y permisos (todas las pantallas)
- [DISEÑO] intentar() muestra 🧩 🐢 🔒 en cada pantalla apagada o sin permiso (src/lib/panel/intentar.tsx:20-23). → Íconos.
- [FLUIDEZ] Ese aviso no tiene "Volver" ni "Ir al inicio" (Marco.tsx:100-108).
- [TEXTO] "Lo da el dueño desde Configuración" es falso: los permisos están en Gastos, Mensajes y Equipo (servidor.ts:142,144; gastos/page.tsx:84). → Todo en Equipo → Permisos.
- [TEXTO] "Tu rol no tiene acceso" no dice qué rol ni a quién pedírselo (servidor.ts:135).
- [TEXTO] El permiso "El encargado ve el Resultado" dice que incluye los gastos, que tienen su propio interruptor (equipo/Permisos.tsx:12).
- [ROTO · permisos] El panel reconoce al soporte por el nombre "Soporte BRIK": un empleado anotado con ese nombre queda afuera de su panel (app/panel/layout.tsx:84-87). → Campo `es_soporte`.
- [ROTO] El tema se guarda en la base pero el panel solo lee la cookie: no se aplica en otro dispositivo (layout.tsx:95, cuenta/Tema.tsx:13).

### Socios
- [ROTO] Exportar ignora los filtros de estado, plan y web: con "Vencidos" baja a todos (socios/page.tsx:87, exportar/route.ts:17-19).
- [FLUIDEZ] Si exportar falla, devuelve una página de texto plano con 403 (exportar/route.ts:22).
- [DISEÑO] Importar con ícono "descargar" y Exportar con "subir"; "⋯ Más" como texto (socios/page.tsx:83,87,97).
- [FALTA] "Elegir varios" alcanza solo a los 60 cargados (ListaSocios.tsx:71). → "Elegir los N del filtro".
- [FALTA] No se puede ordenar (último ingreso, vencimiento, deuda) ni hay "última vez que vino" (ListaSocios.tsx:12-13).
- [FLUIDEZ] El alta no guarda borrador y "Cancelar" no pregunta (FormSocio.tsx:238-300).
- [FLUIDEZ] Error abajo y no al lado del campo; "Solo dar de alta" no dice "Guardando…" (FormSocio.tsx:291,296).
- [TEXTO] En "Listo" sin cobro dice a la vez "todavía no se cobró" y "ya puede entrar con su DNI" (FormSocio.tsx:200,211-212).
- [DISEÑO] En la ficha, Cobrar queda abajo de unos 10 bloques (socios/[id]/page.tsx:133-194). → Acciones arriba, abajo del estado.
- [FLUIDEZ] La ficha hace 22 consultas, 13 de ellas en todas las pestañas ([id]/page.tsx:70-102). → Por pestaña, o una sola.
- [FLUIDEZ] Dar de baja corre al tocar el motivo, sin resumen, sin Deshacer y sin mensaje ([id]/Acciones.tsx:80,107-108,144).
- [DISEÑO] La pestaña Pagos se muestra a quien no la puede ver, y adentro dice que no ([id]/page.tsx:280).

### Planes
- [FLUIDEZ] Una consulta por plan para las listas de precios (planes/page.tsx:28-29). → Una sola.
- [ROTO · plata] crearPlan crea el plan y el precio, y recién después valida la matrícula: si está mal queda a medias (planes/acciones.ts:25-29). → Validar antes de crear.
- [DISEÑO] Subir y Bajar con íconos "subir" y "descargar" (planes/Editor.tsx:76-77).

### Clases y rutinas
- [ROTO] "Clase ajena" compara el nombre del profe: falla con dos profes del mismo nombre (clases/page.tsx:56). → Comparar el id.
- [FLUIDEZ] El vacío dice "revisá la grilla" sin botón (clases/page.tsx:50).
- [ROTO] `<Icono>` (svg) dentro de `<option>`: HTML inválido y error de consola (rutinas/editar/Editor.tsx:55, clases/grilla/Grilla.tsx:121, equipo/Equipo.tsx:103).
- [FLUIDEZ] El editor de rutinas no tiene borrador ni aviso de cambios sin guardar, ni deja reordenar ejercicios o sacar un día (rutinas/editar/Editor.tsx:13-28,46).

### Retención, Resultado y Gastos
- [FLUIDEZ] Retención trae todo y pagina en el navegador (retencion/page.tsx:62,84,152). → Paginar en la base.
- [FALTA] Altas, Bajas, En riesgo y Socios al día no llevan a su lista (retencion/page.tsx:106-108, resultado/page.tsx:80-90).
- [FALTA] Retención sin "Avisar a todos" ni exportar (retencion/page.tsx:151).
- [TEXTO] "No vienen" sin ícono; los contactos de "En riesgo" se anotan como "no_viene" (retencion/page.tsx:31,140).
- [FLUIDEZ] Consultas en fila después del Promise.all (resultado/page.tsx:53, control/page.tsx:62, admin/page.tsx:68-70).
- [DISEÑO] Montos de los gráficos solo en `title`: en el celular no se ven (resultado/page.tsx:101,200).
- [ROTO] Horas pico corta desde las 6: un gimnasio que abre a las 5 o 24 h pierde horas (resultado/page.tsx:199).
- [ROTO] Cargar gasto y Presupuesto vacían los campos al volver con error; el gasto cargado no confirma con monto (gastos/Formularios.tsx:19-20,140).
- [ROTO · plata] "Quitar" un gasto y "Dejar de repetir" un fijo, de un toque y sin Deshacer (gastos/Formularios.tsx:67-68,80-81).

### Equipo, Tareas y Mensajes
- [ROTO · permisos] Cambiar el rol corre al tocar el select y solo confirma para dueño: un toque pasa a la recepción a encargado, que ve plata (equipo/Equipo.tsx:31-34,47-48). → Confirmar todo cambio de rol, con lo que gana o pierde.
- [ROTO] "Sumar a alguien" borra nombre y mail si hay error (Equipo.tsx:97-101).
- [DISEÑO] Los íconos de rol quedaron vacíos (Equipo.tsx:13,40).
- [TEXTO] Dice que el encargado ve "todo menos configuración y equipo", pero los ve en su menú, con el CBU y MercadoPago a la vista (Equipo.tsx:16, secciones.ts:70-72).
- [ROTO] Una tarea hecha queda con un botón vacío; no se puede editar ni borrar una tarea, y una "todos los días" creada por error no se corta nunca (tareas/Tareas.tsx:34, tareas/acciones.ts:9-35).
- [FALTA] La bandeja de mensajes corta en 100 sin "ver más" y no se actualiza sola (mensajes/page.tsx:33).
- [TEXTO] Queda un " · " colgado en los mensajes con foto (mensajes/page.tsx:81).

### Configuración y Tu página
- [ROTO] El aviso de cambios sin guardar es solo `beforeunload`: un click en el menú los pierde (configuracion/Ajustes.tsx:281-286, pagina/Editor.tsx:149-154).
- [DISEÑO] Fondos elegidos entre 7 colores sueltos oscuros del "modo gym", y un violeta entre los acentos (Ajustes.tsx:72-73). → Claro u oscuro por token.
- [FALTA] Rutinas no está en Configuración → Secciones, y Eventos no se puede apagar (Ajustes.tsx:75-104, secciones.ts:51-52).
- [FLUIDEZ] Sin loading.tsx (cae en el esqueleto de Inicio) y 19 consultas para todas las pestañas (configuracion/page.tsx:25-45); tampoco hay loading en asistente/ ni hoy/.

### Control y navegación
- [FLUIDEZ] Control, Resultado, Mensajes, Avisos, Gastos e Interesados no tienen memoria: "Volver" desde una ficha va a Socios y pierde los filtros (lib/panel/origen.ts:6-17).
- [DISEÑO] Suspensiones y cortesías ignoran los filtros, cortan en 30 y van abajo de todo (control/page.tsx:52,120-138).

### Super admin
- [DISEÑO] La portada tiene unos 16 bloques en una página, sin menú (admin/page.tsx:106-185). → 4 secciones (Gimnasios, Soporte, Plata BRIK, Plataforma) con menú.
- [FLUIDEZ] `admin_gimnasios` se pide en el layout y en cada página; la ficha de un gimnasio trae la salud, los abonos y la lista de todos (admin/layout.tsx:10, page.tsx:65, gimnasios/page.tsx:42, [id]/page.tsx:59-77).
- [FALTA] /admin/gimnasios no pagina (gimnasios/page.tsx:36).
- [FLUIDEZ] "← Gimnasios" en la ficha va a /admin, no a la lista con sus filtros ([id]/page.tsx:84).
- [TEXTO] La portada dice "suspendido", "socios" y "entradas 7 días"; la lista dice "pausado", "socios activos" y "entradas hoy" (admin/page.tsx:148,167-169; gimnasios/page.tsx:89,96-97).
- [FLUIDEZ] Ctrl+K sin botón visible: en el celular no se puede abrir (admin/Paleta.tsx:28-31).
- [DISEÑO] `window.confirm` nativo en baja, restaurar textos y quitar dominio; "Borrar definitivamente" sin estilo de peligro ([id]/FichaGestion.tsx:35,83; [id]/Formularios.tsx:41; [id]/FichaAvanzada.tsx:116).
- [ROTO] En el alta, dueño, mail, celular y plan se borran con error; el error del slug aparece en el paso 3; "Entrar como soporte" no ofrece Encargado (admin/AltaGimnasio.tsx:136,155-165; BotonEntrar.tsx:24-26).

### Detalles premium que faltan
1. Reporte del mes para compartir: PDF de una página o link de WhatsApp con cobrado, altas, bajas y retención.
2. Resumen de la noche para el dueño (N3).
3. Comparación con el año pasado y tendencia de 12 meses en Resultado.
4. Cada número lleva a su lista.
5. Acciones masivas en Retención y Vencidos: avisar a todos, etiquetar, ofrecer pausa.
6. Acciones masivas sobre todo el filtro de Socios, no solo la página.
7. Tecla "?" con los atajos (N nuevo socio, C cobrar, / buscar).
8. Actividad en vivo para el dueño: "Lucía cobró $25.000 · hace 2 min".
9. Vistas guardadas en Socios y orden por última visita.
10. Lo que pagó el socio en total, en la ficha y en la lista.
11. Meta mensual de cobro y de socios, con barra de avance.
12. Super admin: ingreso mensual de BRIK, gimnasios que se van, cohortes por mes de alta y alerta de "gimnasio que dejó de cobrar".
13. Super admin: notas y recordatorios por gimnasio en la lista.
14. Super admin: "ver como el dueño", solo lectura, para revisar sin permisos de soporte.
15. Gastos recurrentes con vencimiento ("vence el alquiler el 10") en Para hacer hoy.

## Estado de los [ROTO] de H7 (11/11, rama `carril/h7-roto`)

La prueba de pantallas es `scripts/e2e/pulido-roto.mjs` (y `panel-equipo.mjs` para el cambio de rol). ✅ = arreglado y con prueba; 🟡 = arreglado sin prueba automática, o a medias, con el motivo.

| [ROTO] | Estado |
|---|---|
| Kiosco: el lector USB borra la G de `GYMOS1.` | ✅ `src/app/kiosco/campo.test.ts` (vitest) y pulido-roto paso 1 |
| Kiosco sin internet termina en la pantalla de error | ✅ pulido-roto (modo sin conexión: "Sin conexión: pasá por recepción") |
| Mi QR vencido sin señal; al volver de la pantalla bloqueada | ✅ pulido-roto (sin señal y al volver); 🟡 el `visibilitychange` está escrito pero la prueba solo corta y devuelve la red |
| Avisos que tapan el botón flotante y la barra | ✅ contra el botón (pulido-roto); 🟡 contra la barra fija: a 1440 px la prueba no la mostró, el `xl:right-[19rem]` queda sin medir |
| Botón flotante de la Entrada vacío | ✅ pulido-roto (tiene su ícono) |
| Íconos vacíos en el rojo, la salida y la caja (Puerta, Ventana, Turno, entradas y salidas de plata) | 🟡 reemplazados por `<Icono>`; sin prueba de pantalla propia (tsc y lint limpios) |
| Emojis crudos de la base en Inicio y en los chips de la guía | 🟡 `sistema` en `<Icono>` (la migración entregada no se toca); sin prueba de pantalla propia |
| Error de Anotar, Dejar pasar, Salida o Volvió antes debajo del veredicto | 🟡 el error se muestra dentro del veredicto (Puerta.tsx); sin prueba: hace falta forzar un fallo de la base |
| Atajo "S" marca la salida al tipear un nombre | ✅ pulido-roto (la S va al buscador) |
| Búsqueda vieja pisa a la nueva (Entrada y Vender); Vender mostraba el error como "No está" | 🟡 control de vigencia en las dos; sin prueba: hace falta una respuesta tardía |
| Cobrar se cierra mientras cobra | 🟡 no cierra (Esc, X ni afuera) mientras "Cobrando…"; sin prueba automática |
| "Abrir caja" en Vender pierde el carrito | 🟡 abre el turno en el mismo carrito (`AbrirTurnoCobrar`); sin prueba: depende de una caja cerrada |
| Cambiar un rol de un toque | ✅ `panel-equipo.mjs` (confirmación con lo que gana o pierde) |
| Exportar ignora los filtros | 🟡 el botón dice "Exportar todos los socios" si hay un filtro; el filtro real necesita migración (ver `PREGUNTAS.md`) |
| "Salir" del socio cae en el login del equipo | ✅ pulido-roto |
| Con la sesión abierta, /ingresar y /socio piden la contraseña | ✅ pulido-roto (en la página; `proxy.ts` lo sigue otro ayudante) |
| `linkAyudaBrik` borra la letra D | ✅ `destino.test.ts` (vitest) |
| "Tu celular o tu mail" con `type=tel` | ✅ pulido-roto |
| El tema por usuario solo lee la cookie | ✅ pulido-roto (dispositivo nuevo sin cookie) |
| La hora del cierre por WhatsApp sale en la zona de la compu | 🟡 usa la zona del gimnasio; sin prueba automática (depende de la zona de la compu que corre la prueba) |
| Soporte reconocido por el nombre "Soporte BRIK" | 🟡 permisos: no se arregló, queda en `PREGUNTAS.md` con la opción más segura |

## Estado de Z5, Z6 y Z7 (11/11, rama `carril/z-diseno-falta`)

La prueba de pantallas es `scripts/e2e/z-diseno.mjs` (dueña, recepción, celular y super admin) y vitest para lo que es una cuenta (`formato.test.ts`, `menu-vd11.test.ts`, `alta-url.test.ts`, `vuelto.test.ts`). ✅ = hecho y con prueba; 🟡 = hecho sin prueba automática, a medias o sin hacer, con el motivo. Todo se confirmó primero en el código actual: lo que ya estaba hecho por H7, H3b y las revisiones se anota como "ya estaba".

### Z5 · [DISEÑO]
| Punto | Estado |
|---|---|
| Menú en 4 secciones (Hoy, Socios, Plata, Gimnasio) con su línea; Incidentes, Máquinas, Eventos, Lockers, Profes, Horas y Resumen en «Más» de su sección (se abre solo si estás en una de esas pantallas); Rutinas pasó a Gimnasio | ✅ `z-diseno` (menú) + `menu-vd11.test.ts` |
| Un ícono distinto por pantalla del menú | ✅ `menu-vd11.test.ts` |
| Títulos de pantalla de 28 px (panel, super admin, app del socio) y el ícono al lado, no de 36 px arriba; la campana ya no pisa el título | ✅ `z-diseno` (mide 28 px en Socios) |
| Número de la campana con `--sobre-acento` | 🟡 hecho; sin prueba (necesita un acento claro) |
| Sin `grayscale` en los íconos del menú de abajo; ítem activo del menú con ícono en `--acento` | 🟡 hecho; sin prueba |
| Esquinas: todo `rounded-xl/2xl/3xl` pasó a 10 px (`--radio`) en toda la app | 🟡 hecho con `sed` en todo `src`; sin prueba de pantalla (tsc y lint) |
| Sin vidrio ni degradé: el ingreso (fondo y tarjeta lisos), la portada del gimnasio (barra de arriba y de abajo lisas, velo plano sobre la foto), barra del socio | ✅ `z-diseno` (portada e ingreso); 🟡 el velo negro sobre la foto de portada y los botones `white/15` encima se dejaron: es lo que hace legible el texto sobre una foto |
| Botón flotante de la Entrada y botón grande de Inicio: `--acento`, `--sobre-acento`, `--sombra-flota` (no el verde del semáforo) | 🟡 hecho; sin prueba (pulido-roto sigue midiendo que no tape) |
| Avisos de la puerta: 5 s verde, 8 s amarillo y azul, 12 s rojo; ✕ y Cobrar de 48 px | 🟡 hecho; sin prueba (hace falta esperar 5 a 12 s con una entrada de otra puerta). El rojo ya no queda para siempre: ver `PREGUNTAS.md` |
| Cobrar y Vender: − y + de 48 px; ok del cupón con el color del semáforo; Vender sin `shadow-lg`; Hoja con X de 48 px | 🟡 hecho; sin prueba |
| Landing: Actividades y «Pensado para cada gimnasio» (Base) pasaron de grilla de tarjetas iguales a lista con jerarquía; esquinas de 10 px; sin código muerto | 🟡 hecho; sin prueba de pantalla |
| App del socio: «← Volver» de 44 px, pastillas de pedidos de 44 px, etiquetas de 13 px (no 12), `--tarjeta-alta` en lugar de `--tarjeta-2`, QR con 10 px | 🟡 hecho; sin prueba |
| Importar con «subir» y Exportar con «descargar»; «⋯ Más» con ícono; Subir y Bajar con flechas (planes) | 🟡 hecho; `dis-3` sigue cubriendo el «Más» |
| Ficha del socio: Cobrar, Vender, WhatsApp, Editar y Dar de baja abajo del estado (antes, después de unos diez bloques) | ✅ `z-diseno` (acciones a menos de 650 px) |
| Pestaña Pagos mostrada a quien no la puede ver | ya estaba (se filtra por `f.pagos`) |
| Configuración → Marca: fondos reducidos a los claros y el oscuro del sistema | 🟡 hecho a medias: se sacaron los cuatro oscuros sueltos; el violeta queda entre los acentos (el dueño lo puede querer y `cfg-9` lo usa) |
| Control: Suspensiones y cortesías ignoran los filtros y cortan en 30 | 🟡 se dice escrito arriba de la lista; seguir los filtros es cambiar la función de la base (ver `PREGUNTAS.md`) |
| Montos de los gráficos solo en `title` | ✅ `z-diseno`: «Mejor día» y «Ver los montos de cada día» |
| `window.confirm` nativo en super admin (baja, restaurar textos, quitar dominio, borrar datos) y «Borrar definitivamente» sin estilo de peligro | ✅ `super-admin` y `super-f2` (usan la hoja `useConfirmar`) |
| Super admin: la portada en 4 secciones con menú | 🟡 sin hacer: es rehacer `admin/page.tsx` (unos 16 bloques) con rutas nuevas. Estimación: medio día |
| Fondos/íconos/emojis vacíos, «✓ ✕ ＋» de texto, íconos repetidos fuera del menú | no es de este carril: es Z2 |

### Z6 · [FALTA] y detalles premium
| Punto | Estado |
|---|---|
| «Darlo de alta» lleva el DNI o el nombre escrito (Entrada, ventana, Vender) | ✅ `alta-url.test.ts` + `z-diseno` (Entrada) |
| `conPuntos` ya no le pone puntos a un celular (solo 7 u 8 cifras) | 🟡 hecho; sin prueba |
| La lista «Hoy» y la bandeja de Mensajes avisan cuando se cortan (40 y 100) | 🟡 hecho; sin prueba |
| Resultado: Horas pico ya no pierde las horas antes de las 6 ni después de las 22 | 🟡 hecho; sin prueba |
| Super admin: el botón de búsqueda visible (en el celular no hay Ctrl+K) y «← Gimnasios» vuelve a la lista | ✅ `z-diseno` (botón en 390 px); el link 🟡 |
| `aria-label` en el botón de video de la rutina | 🟡 hecho; sin prueba |
| Rutinas en Configuración → Secciones | 🟡 hecho; sin prueba. Eventos no se puede apagar todavía (ver `PREGUNTAS.md`) |
| Landing (sesión, «Ya soy socio», sin «Quiero ser socio» sin altas), alta online (DNI, menores, mail en minúsculas, reglamento opcional), robots, sitemap, manifest con 512/maskable/atajos | ya estaba |
| «Quiero ser socio»: `openGraph`, `twitter` e ícono (en WhatsApp sale con imagen) | 🟡 hecho; sin prueba de la vista previa |
| Vuelto en efectivo y billetes rápidos | 🟡 pieza hecha y probada con vitest, **sin conectar** a Cobrar: función nueva, arranca apagada (ver `PREGUNTAS.md`) |
| Sin hacer, con estimación: reglamento y contraseña en el alta, vuelto con interruptor (1 h), transferencias con monto y comprobante en miniatura (3 h), pase diario sin socio (media jornada, cobro nuevo), foto en avisos y panel lateral (3 h), Wallet, racha y hitos para compartir (1 día), QR sin señal con token firmado (media jornada), reporte del mes en PDF (1 día), metas, vistas guardadas y acciones masivas sobre todo el filtro (1 día cada una), paginar Retención y `/admin/gimnasios` en la base (media jornada cada una), editar y borrar tareas (media jornada, necesita migración) | 🟡 grandes |

### Z7 · Lo transversal
| Punto | Estado |
|---|---|
| Fechas «hoy», «ayer», «lun 12/11» y celular `+54 9 …` en la hora del gimnasio: `fechaHumana`, `fechaHoraHumana` y `formatearCelular` | ✅ `formato.test.ts`. En uso: el panel lateral de la Entrada. Falta aplicarlos pantalla por pantalla (🟡 media jornada) |
| Plata con `formatearPesos()` | ya estaba (solo quedan los CSV, que van sin símbolo a propósito) |
| La tecla «?» con los atajos, en el panel y en `/admin` (solo los que existen) | ✅ `z-diseno` |
| Todo vacío con botón: Clases (abre la grilla) y Caja sin cajas activas (dice qué hacer) | 🟡 hecho; sin botón en Caja (no hay una pantalla para activar cajas) |
| `loading.tsx` con la forma real en todas las rutas | ya estaba (solo faltan `/estado` y `/gimnasio-no-encontrado`, que son estáticas) |
| Franja «Sin conexión» en panel y app | ya estaba |
| «Hay una versión nueva: recargar sin perder lo escrito» | 🟡 sin hacer: necesita detectar la versión desplegada. Estimación: 1 día |
| Errores con «Volver» e «Ir al inicio» en `intentar()` | 🟡 sin hacer, para no pisar a Z2 (que cambia los emojis de las mismas líneas) |
