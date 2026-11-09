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
| FA-7 | "Avisar sin bloquear" la primera semana: la base ya lo tiene (`configuracion.avisar_sin_bloquear_hasta`). Falta una pantalla en Configuración y un paso opcional en el asistente: "los primeros N días, la entrada avisa pero no frena". Es para el primer gimnasio real | Arranque §6.10 | ❌ |
| FA-8 | En la configuración de MercadoPago, escrito: "La plata de tus socios va directo a tu cuenta de MercadoPago. Nunca pasa por Base ni por BRIK." | Arranque §6.1 | ❌ |
| FA-9 | Socios: selección múltiple (WhatsApp, etiqueta, exportar) y columnas a elección | `v2/03` §5, `v2/17` §5 | ❌ |
| FA-10 | Números: "tasa de cobro" (qué parte de lo que había que cobrar este mes se cobró), con su lista | `v2/03` §6 | ❌ |
| FA-11 | Lista de anotados de una clase con la foto de cada uno | `producto/10` | ❌ |
| FA-12 | Avisos en la app, que solo avisan y no deciden nada: la clase reservada (1 h antes, si el socio lo quiere), el evento el día antes, y al profe y al encargado "clase sin anotados" 2 h antes o "clase llena" | `v2/03` §9, `v2/12`, `producto/07` | ❌ |
| FA-13 | Interesado que nadie contactó en 24 h: aparece en Para hacer hoy y en la campana | `producto/07` | ❌ |
| FA-14 | App del socio: recomendación con regla clara ("hace 10 días que no venís, hoy hay Funcional 19:00"), insignias simples y resumen del año | `v2/05` §3 | ❌ |
| FA-15 | Rutina: marcar cada serie como hecha | `v2/05` §3 | ❌ |
| FA-16 | El socio sube su foto desde la app solo si el gimnasio lo permite. Por defecto, apagado. La recepción ve "foto nueva, subida por el socio" hasta que la confirma (D57) | `v2/05` §3 | ❌ |
| FA-17 | Borrador automático en formularios largos (alta completa, plan, configuración de la página): al volver, "¿Seguimos donde dejaste?" | `v2/13` §3, `FLUIDEZ.md` regla 7 | ❌ |
| FA-18 | Transiciones entre pantallas en la app del socio (View Transitions), respetando `prefers-reduced-motion` | `v2/05` §4 | ❌ |
| FA-19 | Términos del servicio entre BRIK y el gimnasio, y contrato de encargado del tratamiento (Ley 25.326). El dueño los acepta al entrar por primera vez y se guarda la fecha y la versión. Si la versión cambia, los vuelve a aceptar. El texto lo escribe el agente como borrador, marcado "revisar con un abogado" | Arranque §6.6 | ❌ |
| FA-20 | Página pública `/estado`: si la base responde y el último deploy, sin datos de nadie | `v2/13` §4 | ❌ |
| FA-21 | Diferencia de caja acumulada por cajero, en Control y en Caja | `14-SITUACIONES` #21 | ❌ |
| FA-22 | Alertas por patrón: el mismo socio en dos sedes con pocos minutos de diferencia, o entradas muy por encima de su promedio. Solo avisa al dueño, no frena | `14-SITUACIONES` #3 | ❌ |
| FA-23 | Lista de espera: el lugar que se libera se ofrece con un plazo para aceptar (configurable). Si no acepta, pasa al siguiente. Se calcula al consultar, sin cron | `14-SITUACIONES` #51 | ❌ |
| FA-24 | El invitado de un socio (el pase ya existe, INV-1) queda como interesado, con quién lo trajo | Pedido §7 | ❌ |

**Anotado para más adelante (no se hace en esta recta):** vender el gimnasio a
otro dueño, traslado de sede y precio por sede, transferir la membresía, tienda
en la app, desafíos del mes (`v2/20`).
