# El día a día y los casos raros (lo que nadie se acuerda de pedir)

Cada fila es algo que **va a pasar** en un gimnasio real. La columna "Gym OS"
dice qué hace el sistema. Si una fila no tiene ítem en la hoja de ruta, la
auditoría del panel la suma. Las auditorías recorren esta lista entera.

## Un día, minuto a minuto

| Hora | Qué pasa | Gym OS |
|---|---|---|
| 6:55 | La recepción llega y prende la compu | Entra con su PIN; la pantalla le pide abrir caja con el fondo; si ayer quedó una caja abierta, primero la cierra |
| 7:00 | Primeros socios | Entrada en una pantalla, con foco en el buscador (lector de QR/llavero listo) |
| 7:10 | Un socio vencido quiere entrar "y paga a la tarde" | Rojo con motivo → Dejar pasar con motivo "paga a la tarde" (cuenta para el tope) → queda en la bandeja de la tarde como "le prometió pagar" |
| 8:00 | Clase de spinning llena, uno sin reserva | Clase muestra cupo; la recepción lo anota en la espera |
| 9:30 | Viene alguien a preguntar precios | Prospecto en 10 segundos (nombre y celular) + le manda el link de la página por WhatsApp |
| 10:00 | Alguien quiere probar una clase | Pase de prueba gratis (una vez por DNI) |
| 12:00 | La dueña mira el celular | Inicio: entraron 64, cobrado $380.000, vencen hoy 7, una transferencia por aprobar |
| 14:00 | Cambio de turno | La de la mañana cierra con arqueo ciego; la de la tarde abre la suya; la dueña recibe "Caja de Ana: diferencia $0 ✓" |
| 15:00 | Llega el proveedor de agua | Retiro de caja con motivo "Proveedor agua" y foto del ticket; stock sube |
| 17:30 | Hora pico | Entrada por QR sin buscar; el kiosco toma a los que tienen app |
| 18:00 | El profe de las 19 avisa que no viene | Cancelar clase con motivo → los anotados reciben aviso → no se descuentan packs |
| 19:00 | Un socio pagó por transferencia desde su casa | Aprobación en un toque desde Transferencias o desde el aviso |
| 21:00 | Un socio pide la baja | Antes de confirmar: motivo + ofrecer pausa |
| 22:00 | Cierre | Última caja cerrada → resumen diario a la dueña |

## Socios: lo raro que pasa

| Caso | Gym OS |
|---|---|
| Cambió de celular / de número | Entra con su mail o la recepción le actualiza el número; el QR es de la cuenta, no del teléfono |
| Perdió el llavero | Se le asigna otro; el viejo queda anulado |
| Dos socios con el mismo nombre | Se distinguen por foto y DNI; búsqueda muestra DNI parcial |
| Se cargó dos veces | Unir duplicados (SOC-8) |
| Pagó dos veces por error | Anular una venta (encargado/dueño) o dejarla como crédito de días |
| Pagó el mes y se lesionó / viaja | Pausa (D7): los días se corren solos |
| Viene con un amigo | Pase de invitado con DNI y límite (INV-1) |
| Es menor | Adulto responsable (D10) |
| Quiere cambiar de plan | D6: días a favor |
| Debe y quiere pagar una parte | D5 (si el gimnasio fía) |
| Pagó por transferencia sin avisar | Lo ve en su banco el dueño → "Cobrar" con medio transferencia y referencia |
| Le rechazaron la transferencia | Aviso con el motivo y botón para subir otro comprobante |
| Se registró online y nunca vino | Prospecto "se registró, no pagó" en la bandeja |
| Se dio de baja y vuelve | Reactivar con su historia (no se crea de nuevo) |
| Pide sus datos o borrarlos | Exportar sus datos; baja con anonimización (ley de datos personales) |
| El gimnasio aumenta | Aviso 15 días antes; el que pagó adelantado mantiene su precio |
| Pagó 3 meses y el gimnasio cierra por vacaciones | Cierre compensa días solo |

## Recepción y plata

| Caso | Gym OS |
|---|---|
| Se olvidó de abrir la caja y cobró | No puede cobrar efectivo sin caja: le pide abrirla en el momento |
| Cobró de más | Anulación pedida a la encargada → nueva venta correcta |
| Le dieron un billete falso | Retiro con motivo "billete falso" |
| No tiene cambio | Ingreso de cambio con motivo |
| Se fue sin cerrar | Aviso a la noche; al otro día no se abre otra caja sin cerrar esa (lo hace la encargada con conteo) |
| Se cortó la luz / internet | La pantalla dice "Sin conexión", la recepción anota en papel; al volver, carga con la hora real (SEG-5 lo automatiza) |
| La posnet no anda | Cambia el medio de pago en el momento; precio se recalcula |
| Cobró con MercadoPago del celular del gimnasio | Medio "MercadoPago (QR del local)" en Vender, sin integración |

## Dueño

| Caso | Gym OS |
|---|---|
| Quiere saber si le roban | Resumen diario + cruces + auditoría (06-CAJA-Y-CONTROL) |
| Se va de vacaciones | Encargado con permisos ampliados; él mira todo desde el celular |
| Contrata a alguien | Equipo → sumar con mail → contraseña provisoria por WhatsApp |
| Echa a alguien | Sacar acceso en un toque; su historia queda |
| Abre otra sede | Sedes: cada una con su caja, entrada y grilla |
| Cambia los precios | Aumento programado con aviso |
| El contador le pide los números | Exportar el mes |
| Quiere mandar un aviso a todos | Novedades en la app (APP-6) + WhatsApp en tanda |
| Le pregunta al sistema "¿cómo vengo este mes?" | Resultado con comparación contra el mes anterior |

## Profe

| Caso | Gym OS |
|---|---|
| Llega y no sabe quién viene | Lista de anotados con foto |
| Viene alguien sin reserva | "Sumar a la clase" (si hay cupo) |
| Quiere cargar el WOD | En la clase, un toque |
| Da clase en dos gimnasios | Elige gimnasio al entrar |

## Lo que puede salir mal en el sistema (y tiene que estar cubierto)

- Dos recepciones cobran al mismo socio a la vez → la base serializa; el segundo ve "ya se cobró hace 10 s".
- Dos personas reservan el último lugar → uno entra, el otro va a la espera (✅ probado).
- El socio vuelve de MercadoPago antes del webhook → "Confirmando tu pago…" y se actualiza solo.
- El webhook llega dos veces → idempotente por ID.
- Un gimnasio apaga Clases con reservas futuras → avisa cuántas hay y qué pasa con ellas antes de apagar.
- El dueño borra un plan con socios → no se borra: se "archiva" (no se vende más, los que lo tienen siguen).
- Cambia la zona horaria o el horario de verano → todo en `timestamptz` y medianoche local del gimnasio.
- Un socio con la app abierta cuando vence a la medianoche → al volver a la app, se recalcula.
