# 03 · El dueño

El dueño tiene todo el poder: ve la plata, configura, aprueba. Usa el panel
desde el celular tanto como desde la compu.

## 1. Menú (4 principales + lateral)

Se mantiene el esqueleto (4 principales abajo en el celular, lateral
agrupado en compu, Ctrl+K arriba). Se reordena:

```
🔍 Buscar o hacer…   Ctrl K       ← busca socios Y acciones ("cobrar a Juan", "nuevo socio")
🏠 Inicio

HOY
🚪 Entrada            ← además de la ventana flotante
✅ Para hacer hoy     ← tareas inteligentes + avisos (antes: Tareas y Avisos de hoy)
⏰ Vencen y cobrar    ← antes: Vencen hoy
🗓️ Clases de hoy      (solo si el gimnasio tiene clases)

SOCIOS
👥 Socios             ← pestañas: Activos · Interesados (ex-Prospectos) · Todos
📉 Retención y números
💪 Rutinas
🎟️ Eventos

PLATA
💵 Caja
🛒 Productos y stock  ← antes: Vender (D21)
🏦 Transferencias
📈 Resultado
🛡️ Control            ← auditoría (02 §5), solo dueño (y encargado si se prende)

GIMNASIO
🏷️ Planes y servicios
🌐 Tu página
🧑‍🤝‍🧑 Equipo
⚙️ Configuración
```

Las rutas viejas redirigen a las nuevas (nada se rompe: links guardados,
e2e, accesos rápidos elegidos por el dueño). Cada ítem lleva su línea "qué
es esto" en el menú expandido y en el estado vacío.

## 2. Inicio del dueño

```
Hola Mateo 👋                       Jueves 5 de noviembre · Gimnasio Olympo
[ 🚪 ENTRADA  (grande, verde, con "o tipeá un DNI") ]
[ ➕ Nuevo socio ] [ 💵 Cobrar ] [ ⏰ Vencen hoy (12) ] [ … accesos editables ]

  23            41             $486.500          8
  adentro       entraron hoy   cobrado hoy       a cobrar hoy
  (aprox.)      ▁▃▅▇ vs ayer   ▁▃▅▇              → lista

Para hacer hoy (5)                         Ahora y lo que sigue
• Cobrarle a 8 que vencen hoy   [Ver]      19:00 Spinning · 14/20
• 2 prometieron pagar hoy       [Ver]      19:30 Funcional · 9/15
• Aprobar 3 transferencias      [Ver]      20:00 cierra la caja de Sofi
• Revisar caja sin contar (ayer)[Ver]
• 4 no vienen hace 14 días      [Ver]

Últimas entradas (en vivo)                 Alertas
✅ Juan Pérez 19:04 · QR                   ⚠️ Descuento 40 % (Sofi)
⛔ Ana Gómez 19:02 · vencida  [Cobrar]     ⚠️ Caja de ayer sin contar
```

- Cada número **lleva a la lista que lo forma** (memoria: volver deja en
  Inicio).
- Los 4 números son configurables (elegir entre: adentro, entraron hoy,
  cobrado hoy, a cobrar hoy, socios activos, altas del mes, bajas del mes,
  ocupación de clases de hoy).
- "Primeros pasos" (onboarding) sigue arriba hasta completarse.
- Bloques que solo aparecen si hay algo (los de hoy se mantienen).

## 3. Para hacer hoy (tareas inteligentes)

Junta lo que hoy está en **Tareas** y **Avisos de hoy**. Son de dos clases:

**Automáticas** (se calculan, no se guardan; desaparecen solas cuando se
resuelven):
| Tarea | Para quién | Botón |
|---|---|---|
| Cobrarle a los que vencen hoy / están en gracia | recepción | Cobrar (uno por uno o en tanda por WhatsApp) |
| Prometieron pagar hoy | recepción | Cobrar · WhatsApp |
| Aprobar transferencias | dueño, encargado, recepción | Ver comprobante |
| Abrir / cerrar el turno de caja | recepción | Abrir · Cerrar |
| Revisar caja sin contar | dueño | Contar |
| Avisar a los que vencen en N días | recepción | WhatsApp ya escrito |
| No vienen hace N días (7/14/30, configurable) | recepción | WhatsApp · "dice que vuelve" |
| Nuevos: primera semana sin venir | recepción | WhatsApp |
| Cumpleaños de hoy | recepción | WhatsApp |
| Hitos (10, 50, 100 entradas) para felicitar en persona | recepción | Hecho |
| Reponer stock (por debajo del mínimo) | dueño, encargado | Cargar mercadería |
| Firmas pendientes | recepción | Ver |
| Pedidos de pausa / baja | dueño, encargado | Aprobar |
| Clase con lista de espera / clase cancelada | recepción | Avisar |
| Pedir reseña a los contentos | recepción | WhatsApp |

**Manuales**: las que ya existen (qué, socio, para quién, día), más
repetir (todos los lunes, todos los días) y checklist de apertura/cierre del
gimnasio configurable ("prender aires", "revisar baños").

Cada gimnasio prende/apaga cada automática y elige para quién es
(Configuración → Para hacer hoy). Tildar "hecho" registra quién y cuándo.

**Avisos al socio**: cada aviso que hoy va por WhatsApp a mano puede además
ir **a la app del socio** (notificación dentro de la app y push si lo
aceptó), gratis y automático, según Configuración → Mensajes ("vence en 3
días": WhatsApp a mano · app automática · las dos). El número de personas a
avisar está arriba de cada grupo.

## 4. Vencen y cobrar

La lista de hoy (ya existe) más pestañas: **Hoy · Esta semana · En gracia ·
Vencidos · Prometieron pagar**. Muestra el modo de cobro del gimnasio (día
fijo: "período de pago, día 4 de 10"). Botones: Cobrar (flujo único),
WhatsApp, "prometió pagar el…", tanda por WhatsApp. Totales arriba: "$X a
cobrar hoy · $Y vencido".

## 5. Socios

- **Lista**: buscar, filtros (estado, plan, etiqueta, sede, "nuevos por la
  web", "deben"), orden, columnas elegibles, selección múltiple (WhatsApp,
  etiqueta, exportar). Recuerda filtros y scroll al volver.
- **Interesados** (ex-Prospectos, D22): los que preguntaron por la página,
  WhatsApp o en persona; estados de hoy; "Darlo de alta" lleva todo al alta.
- **Autoalta**: los que se registran solos aparecen con la marca "🌐 se
  anotó por la web" y quedan en "a cobrar".
- **Importar / exportar**: ya existen; el botón visible arriba de la lista.
- **Alta de socio — completa y en un solo lugar** (hoy: form + "Guardar y
  cobrar" que lleva a Vender):
  1. **Datos**: DNI primero (si existe, avisa y ofrece la ficha), nombre,
     apellido, celular, mail, nacimiento (si es menor: responsable),
     emergencia, cómo nos conoció, foto (cámara), etiquetas, notas.
  2. **Plan**: tarjetas con todos los planes (precio, qué incluye, horario);
     turno fijo o clases si corresponde; convenio; fecha de inicio (hoy por
     defecto); el cálculo del primer pago (proporcional si día fijo).
  3. **Cobro**: el flujo único de Cobrar, embebido.
  4. **Listo**: bienvenida por WhatsApp con el link a la app y la contraseña
     o cómo entrar; firmar el reglamento (en pantalla o en la app);
     "Anotar su primera entrada".
  Se puede guardar sin cobrar ("cobrar después" → queda en a cobrar). Un
  error nunca borra lo escrito.
- **Ficha**: lo de hoy, con un encabezado fijo con acciones (Cobrar,
  Entrada, WhatsApp, Editar, Más) y una línea de tiempo única (entradas,
  pagos, contactos, cambios de plan, pausas, firmas).

## 6. Retención y números

Hoy: tablero de 12 semanas, altas/bajas, plata en riesgo, cohorte a 90 días,
listas. Se suma (pestaña **Números**):
- Socios activos en el tiempo, altas − bajas por mes, churn % (general y de
  los primeros 90 días, separado), ingreso por socio, tasa de cobro.
- Asistencia: por día de semana y hora (mapa de calor), visitas promedio por
  socio, el dato "1 vez por semana o menos = riesgo".
- Clases: ocupación por clase y franja; ausentes (reservaron y no vinieron).
- Plata: cobrado por mes y por medio, deuda total, proyección del mes.
- Período elegible (este mes, mes pasado, 3/6/12 meses), exportar a Excel.
- Cada número con su "¿qué es esto?" y link a la lista que lo forma.
- Lista de riesgo con: días sin venir, visitas en 90 días, último contacto,
  "posponer hasta…" (vacaciones), WhatsApp.

## 7. Planes y servicios

El editor actual + lo que la base ya tiene sin pantalla: **modo de
renovación del plan** (pisa el del gimnasio), día fijo, tolerancia,
`consume_en` del pack, sedes del plan. Más:
- **Servicios adicionales** (locker, toalla, nutrición, personalizado) que
  se suman a la cuota de un socio todos los meses (un producto recurrente
  asignado al socio) — se cobran en el mismo Cobrar.
- Vista previa de "cómo lo ve el socio" (tarjeta de la página/app).
- Orden de los planes (el que aparece primero en el alta y la página).
- Plan visible en la página sí/no, plan solo para alta en recepción.

## 8. Productos y stock (D21, ex-Vender)

Productos con foto, precio, costo, stock, mínimo ("queda poco"), categoría;
entrada de mercadería (con foto del remito); venta rápida en el mostrador
(grilla de productos con foto, + / −, cobrar) — al socio o a "consumidor
final". Margen por producto en Resultado. "Otra cosa" (monto libre con
motivo) se mantiene para dueño/encargado. Las cuotas y pases **no** se
cobran desde acá: el botón lleva al flujo de Cobrar con el socio.

## 9. Eventos (completo)

Hoy: nombre, fecha y hora, cupo, precio, descripción, para quién. Se suma:
- Foto o flyer, lugar (sede o dirección), profe/responsable, duración o
  fecha de fin, varias fechas (ciclo), precio socio / no socio, seña.
- Inscripción desde la app y la página (con pago online o "pagás en
  recepción"), lista de espera, cupo en vivo.
- Lista de anotados con pagó/no pagó, check-in el día del evento (con la
  ventana de Entrada), exportar, WhatsApp a todos, recordatorio el día antes
  (aviso en la app).
- Estados: borrador · publicado · lleno · terminado · cancelado (avisa).

## 10. Rutinas

Hoy: ejercicios con video, rutinas por día, asignar a un socio, el socio
anota pesos. Se suma: biblioteca con buscador y filtros (grupo muscular,
equipo), plantillas para copiar, asignar a varios a la vez, fecha de
cambio, el socio ve la de hoy primero, progreso con gráfico, el profe ve
quién la hizo.

## 11. Configuración — todo configurable

Las 11 pestañas de hoy + lo nuevo de v2 (Entrada, Cobros, Caja, Para hacer
hoy, Mensajes a la app). Se suma:
- **Buscador dentro de Configuración** ("reingreso" → lleva a la opción).
- Cada opción: título, una línea de qué hace, el valor por defecto, y
  "Restablecer".
- Vista previa en vivo donde aplica (marca, página, mensajes).
- Historial de cambios (ya existe) visible desde cada opción.
