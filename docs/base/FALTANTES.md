# Lo que faltaba (revisión del 09/11)

Cada pedido de Mateo se cruzó contra todas las listas: `docs/v2/`,
`PEDIDO-ORIGINAL.md`, el mensaje de arranque y `docs/producto/`. Esto es lo que
no estaba en ninguna. Se hace en este orden (fase 5 de `RECTA-FINAL.md`), salvo
lo marcado **(va antes)**, que entra en la fase indicada porque es parte de algo
que ya se está haciendo.

| # | Qué | De dónde sale | Estado |
|---|---|---|---|
| FA-1 | **(va antes, F1.1)** Panel lateral: "cuándo le toca pagar y cuánto", "desde cuándo debe" y "qué plan pagaría y cuánto". Hoy no los muestra | Pedido 4.3 | ❌ |
| FA-2 | **(va antes, F1.3)** La lista en vivo de ingresos abre el panel lateral, no la ficha entera. Su Cobrar abre la hoja Cobrar, no `/panel/vender?…&cuota=1` (`UltimasEntradas.tsx`) | Pedido 4.4, VD-5B | ❌ |
| FA-3 | **(va antes, F1.1)** Los avisos de abajo a la derecha no tapan el botón de Entrada ni la barra fija (D56) | Choque D40 / D17 | ❌ |
| FA-4 | **(va antes, F1.4)** Sacar el vidrio (`backdrop-filter`), las sombras grandes, el degradé y las esquinas de 16 px (`globals.css` y componentes): esquinas de 10 y 8 px, una sola sombra para lo que flota | `DISENO.md` | ❌ |
| FA-5 | **(va antes, F1.5)** El asistente de 9 pasos se abre solo la primera vez que entra el dueño | Pedido 4.7 | ❌ |
| FA-6 | **(va antes, F1.6)** Arriba de `VELOCIDAD.md`, un párrafo en palabras simples de por qué andaba lento. Y listas virtualizadas donde haya más de 200 filas (Socios, Vencen, Control) | Pedido 4.1 | ❌ |
| FA-7 | "Avisar sin bloquear" la primera semana: la base ya lo tiene (`configuracion.avisar_sin_bloquear_hasta`). Falta una pantalla en Configuración y un paso opcional en el asistente: "los primeros N días, la entrada avisa pero no frena". Es para el primer gimnasio real | Arranque §6.10 | 🟡 pantalla en Configuración y función de base (`avisar_sin_bloquear_estado`/`guardar_avisar_sin_bloquear`, probada); falta el paso opcional en el asistente y el e2e |
| FA-8 | En la configuración de MercadoPago, escrito: "La plata de tus socios va directo a tu cuenta de MercadoPago. Nunca pasa por Base ni por BRIK." | Arranque §6.1 | 🟡 texto puesto en la tarjeta de MercadoPago; sin e2e |
| FA-9 | Socios: selección múltiple (WhatsApp, etiqueta, exportar) y columnas a elección | `v2/03` §5, `v2/17` §5 | 🟡 hecho en la lista de Socios: "Elegir varios" (WhatsApp uno por uno con el mensaje listo y sin los marcados "no escribirle", etiqueta en lote, exportar a Excel) y columnas a elección recordadas en el navegador; base probada (`no_escribirles_de`); falta correrlo con sesión real y un e2e |
| FA-10 | Números: "tasa de cobro" (qué parte de lo que había que cobrar este mes se cobró), con su lista | `v2/03` §6 | 🟡 "Tasa de cobro" en Resultado con la lista de los que faltan renovar (`tasa_de_cobro`, probada en la base); falta e2e y ponerla en Inicio (carril A) |
| FA-11 | Lista de anotados de una clase con la foto de cada uno | `producto/10` | 🟡 la lista de la clase muestra la foto de cada anotado (`fotos_de_clase`, probada); falta correrla con sesión real |
| FA-12 | Avisos en la app, que solo avisan y no deciden nada: la clase reservada (1 h antes, si el socio lo quiere), el evento el día antes, y al profe y al encargado "clase sin anotados" 2 h antes o "clase llena" | `v2/03` §9, `v2/12`, `producto/07` | ⛔ no lo hice: es de la app del socio (push y avisos, carril C) y de la campana, funciones que otros carriles parchan |
| FA-13 | Interesado que nadie contactó en 24 h: aparece en Para hacer hoy y en la campana | `producto/07` | ❌ |
| FA-14 | App del socio: recomendación con regla clara ("hace 10 días que no venís, hoy hay Funcional 19:00"), insignias simples y resumen del año | `v2/05` §3 | ❌ |
| FA-15 | Rutina: marcar cada serie como hecha | `v2/05` §3 | ❌ |
| FA-16 | El socio sube su foto desde la app solo si el gimnasio lo permite. Por defecto, apagado. La recepción ve "foto nueva, subida por el socio" hasta que la confirma (D57) | `v2/05` §3 | 🟡 lado del panel hecho (interruptor en Configuración, marca "foto nueva, subida por el socio" y Confirmar en la ficha); falta correrlo con sesión real. El lado de la app es del carril C |
| FA-17 | Borrador automático en formularios largos (alta completa, plan, configuración de la página): al volver, "¿Seguimos donde dejaste?" | `v2/13` §3, `FLUIDEZ.md` regla 7 | ❌ |
| FA-18 | Transiciones entre pantallas en la app del socio (View Transitions), respetando `prefers-reduced-motion` | `v2/05` §4 | ❌ |
| FA-19 | Términos del servicio entre BRIK y el gimnasio, y contrato de encargado del tratamiento (Ley 25.326). El dueño los acepta al entrar por primera vez y se guarda la fecha y la versión. Si la versión cambia, los vuelve a aceptar. El texto lo escribe el agente como borrador, marcado "revisar con un abogado" | Arranque §6.6 | ❌ |
| FA-20 | Página pública `/estado`: si la base responde y el último deploy, sin datos de nadie | `v2/13` §4 | 🟡 página `/estado` escrita (`src/app/estado/page.tsx`); sin correr. Puede necesitar que el proxy la deje pasar en el host de la plataforma (carril A) |
| FA-21 | Diferencia de caja acumulada por cajero, en Control y en Caja | `14-SITUACIONES` #21 | 🟡 "Diferencia por cajero" arriba de Turnos de caja (`diferencia_caja_por_cajero`, probada); falta el número en Control y e2e |
| FA-22 | Alertas por patrón: el mismo socio en dos sedes con pocos minutos de diferencia, o entradas muy por encima de su promedio. Solo avisa al dueño, no frena | `14-SITUACIONES` #3 | 🟡 "Entradas para mirar" arriba de Control (`alertas_patron_entradas`: mismo socio en dos sedes en hasta 20 minutos, o 4 entradas o más en un día y el triple de su promedio); solo avisa, probada en la base; sin e2e |
| FA-23 | Lista de espera: el lugar que se libera se ofrece con un plazo para aceptar (configurable). Si no acepta, pasa al siguiente. Se calcula al consultar, sin cron | `14-SITUACIONES` #51 | ⛔ no lo hice: cambia cómo se libera y se ofrece un lugar (reservas, app del socio, carril C); no es de una pantalla del panel |
| FA-24 | El invitado de un socio (el pase ya existe, INV-1) queda como interesado, con quién lo trajo | Pedido §7 | 🟡 en Socios → Interesados, "Invitados para seguir": con su WhatsApp el invitado queda como interesado "referido" con "Invitado de …" (`invitado_a_interesado`, probada en la base); sin e2e |

**Anotado para más adelante (no se hace en esta recta):** vender el gimnasio a
otro dueño, traslado de sede y precio por sede, transferir la membresía, tienda
en la app, desafíos del mes (`v2/20`).
