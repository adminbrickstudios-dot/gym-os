# 08 · El plan: ítems VD-* en orden

Mismo formato que la COLA de `docs/HOJA-DE-RUTA.md` (bloque 20). Cada ítem:
qué, dónde está el detalle, y **LISTO SI** (lo que se prueba ejecutando).
Orden: primero lo que más usa la gente todos los días (entrada y cobro),
después el dueño, el socio, la página y el pulido.

**Para todos:** no sacar ninguna función; rutas viejas redirigen; cada
pantalla tocada: celular 390 px sin desbordes, esqueleto con la forma real,
`error.tsx`, estado vacío que invita a actuar; e2e del recorrido nuevo;
capturas de compu y celular mirándolas.

## A · Entrada y cobro (lo de todos los días)

**VD-1 · Ventana de Entrada flotante, en todas las pantallas** (`01` §1-2, §6)
Componente global en el layout del panel: se abre al tipear un número
(fuera de campos de texto), con el botón (grande en Inicio, flotante en el
resto, centro de la barra en el celular), F2/Ctrl+E, y barra fija opcional.
Teclado numérico y lectores USB. Esc vuelve a donde estabas. Usa
`calcular_acceso`/`registrar_ingreso` de siempre. Configuración → Entrada
(por gimnasio + "en esta compu").
LISTO SI: e2e: desde Socios, tipear un DNI de verde → Enter → Enter → entra
y vuelve a Socios con el foco donde estaba; desde Caja con la barra fija;
en celular con el botón; un campo de texto con foco no abre la ventana;
"lector" (tipeo < 30 ms + Enter) con un QR de `mi_qr` entra por QR.

**VD-2 · Todas las situaciones del veredicto con su texto y su botón** (`01` §3)
Recorrer la tabla, prueba de base por cada situación con momento fijo
(usar los casos testigo), sumar los chips nuevos (primer día, menor sin
responsable), "lo que hay que decirle" en una línea.
LISTO SI: db: una prueba por fila de la tabla; e2e: tres colores con sus
botones.

**VD-3 · Reingreso: una visita dura N horas (D24) y anti-préstamo** (`01` §4)
Migración: configuración `visita_horas` (5) y `antiprestamo_minutos` (60);
`registrar_ingreso` devuelve repetido dentro de la visita sin consumir ni
contar; otra vía/dispositivo antes de N min → amarillo con alerta para el
dueño. Reemplaza los 60 s fijos.
LISTO SI: db con momentos fijos: 4 h 59 m repetido (pack no se descuenta),
5 h 01 m nueva; QR dos veces "ya entraste"; otra vía a los 4 min alerta;
0 = apagado; e2e: DNI dos veces → "ya entró a las …".

**VD-4 · Entradas en vivo en todas las pantallas** (`01` §5)
`entradas_desde(g, sede, desde)` + polling 4 s con pestaña visible; toasts
de vidrio (verde se va solo, rojo queda con Cobrar); "Hoy" y la barra fija
se actualizan solas.
LISTO SI: e2e con dos navegadores: el socio entra por QR de pared y a la
recepción (en Socios) le aparece el aviso en < 6 s; un rechazo queda con
Cobrar.

**VD-5 · Cobrar: un solo flujo en todos lados** (`02` §2)
Componente `Cobrar` en hoja flotante: desde Entrada (C), ficha, Vencen,
Retención, alta, Ctrl+K. Qué debe y qué cubre (de la base), medios en
botones, descuento/recargo/cupón/convenio como líneas, comprobante, "cobré
otro día" (dueño/encargado con motivo), PIN, recibo por WhatsApp, vuelve al
origen. Medio por defecto configurable. Aviso de doble cobro (sin frenar,
REV-6a sigue 🟡).
LISTO SI: e2e: vencido en la Entrada → C → Enter → Enter → verde y entró;
desde la ficha con transferencia y comprobante; recepción no puede "otro
día"; el total coincide con lo que guarda la base.

**VD-6 · Alta rápida desde la Entrada y alta completa** (`01` §2, `03` §5)
DNI inexistente → alta en la misma ventana (datos → plan → cobro → entra).
Alta completa en Socios en 4 pasos en una pantalla (datos, plan con
tarjetas y cálculo del primer pago, cobro embebido, listo con bienvenida).
Interesado con ese DNI/celular se ofrece. Un error no borra nada.
LISTO SI: e2e: DNI nuevo en la Entrada → alta → cobro → entró, sin salir de
la pantalla de origen; alta completa con plan de día fijo muestra el
proporcional.

**VD-7 · Cómo vencen las cuotas, con pantalla (D18)** (`02` §1)
Configuración → Cobros (por gimnasio) + override por plan; proporcional /
mes entero / gratis hasta el día fijo; ventana de pago; el cálculo visible
antes de cobrar.
LISTO SI: db: proporcional exacto (30 y 31 días, febrero), cambio de modo
no toca lo cobrado; e2e: plan día fijo, alta el 20 → cobra proporcional y
vence el día fijo.

**VD-8 · Fiado en tres modos (D19)** (`02` §3)
Configuración → Cobros → "Dejar pasar sin pagar": hasta N días / siempre
PIN / libre con registro; "promete pagar el …"; aparece en Inicio, Vencen y
la Entrada del día prometido.
LISTO SI: db: cada modo con recepción y con dueño (PIN válido, inválido,
pasado el tope); e2e: modo 1, 5 días pide PIN.

**VD-9 · Caja por turno que se cierra sola (D20)** (`02` §4)
Abrir/cerrar mi turno desde Inicio y la Entrada; caja de un día anterior =
`sin_contar` al primer acceso (sin cron); "Para revisar" para el dueño;
reporte X y Z con SOBRA/FALTA; calculadora de billetes opcional; modo "una
caja por día".
LISTO SI: db: caja abierta ayer → hoy figura sin contar con el esperado,
nadie puede cobrar en ella, el dueño la cuenta después; e2e: abrir turno,
cobrar, cerrar con faltante → reporte.

**VD-10 · Control: todo queda escrito** (`02` §5)
Línea de tiempo filtrable para el dueño (cobros, anulaciones, descuentos,
cobros con fecha atrasada, dejados pasar, cajas, precios, configuración,
entradas anuladas, invitados, anti-préstamo), alertas a la campana,
exportar.
LISTO SI: db: la recepción no la ve; cada tipo aparece; e2e: anulación y
descuento grande llegan como alerta.

## B · El dueño

**VD-11 · Menú nuevo y redirecciones** (`03` §1)
Reordenar `secciones.ts`, nombres nuevos, "Para hacer hoy", "Vencen y
cobrar", "Productos y stock", "Control", Interesados dentro de Socios;
rutas viejas redirigen; accesos rápidos guardados siguen andando.
LISTO SI: barrido: cada rol ve su menú; e2e: cada ruta vieja redirige.

**VD-12 · Inicio del dueño y de la recepción** (`03` §2, `04`)
Botón Entrada grande, 4 números configurables con mini gráfico y link a su
lista, Para hacer hoy, en vivo, alertas, ahora y lo que sigue; Inicio de
recepción con su turno.
LISTO SI: e2e: dueño y recepción ven lo suyo; cada número lleva a su
lista y Volver regresa a Inicio.

**VD-13 · Para hacer hoy: tareas inteligentes** (`03` §3)
Automáticas calculadas (tabla), manuales con repetición, checklist de
apertura/cierre, cada automática prendible y asignable; avisos que también
van a la app del socio.
LISTO SI: db: cada automática aparece con su dato y desaparece al
resolverse; e2e: cobrar desde la tarea la saca de la lista.

**VD-14 · Vencen y cobrar con pestañas** (`03` §4)
LISTO SI: e2e: pestañas con totales; día fijo muestra "día 4 de 10".

**VD-15 · Socios: lista, Interesados, autoalta, ficha con acciones** (`03` §5)
LISTO SI: e2e: filtros se recuerdan al volver; Interesado → alta con sus
datos; ficha: Cobrar y Entrada desde el encabezado.

**VD-16 · Retención y números** (`03` §6)
LISTO SI: db: cada número con datos fijos (churn general y 90 días,
ingreso por socio, mapa de calor) < 300 ms con 3.000 socios; e2e: período y
exportar.

**VD-17 · Planes y servicios** (`03` §7)
Renovación por plan, consume_en, sedes, servicios adicionales recurrentes
que se suman en Cobrar, orden, visibilidad.
LISTO SI: db: servicio adicional se suma a la cuota; e2e: editar todo.

**VD-18 · Productos y stock (D21)** (`03` §8)
LISTO SI: e2e: venta rápida con stock que baja y "queda poco"; cuotas
llevan a Cobrar.

**VD-19 · Eventos completos** (`03` §9)
LISTO SI: db: lista de espera y cupo; e2e: crear con flyer, anotarse desde
la app, check-in con la Entrada.

**VD-20 · Rutinas** (`03` §10)
LISTO SI: e2e: plantilla → asignar a 3 → el socio ve la de hoy.

**VD-21 · Configuración con buscador y todo lo nuevo** (`03` §11)
LISTO SI: e2e: buscar "reingreso" lleva a la opción; restablecer.

## C · El socio y la página

**VD-22 · Entrar con Google y sesión recordada (D23)** (`05` §1)
🔌 para las credenciales de Google; todo lo demás listo (botón, vínculo
seguro por DNI + código, paso a paso para Mateo en QUÉ CONFIGURÁS VOS).
LISTO SI: e2e con el imitador: Google simulado vincula al socio correcto y
no vincula por nombre; la sesión sigue después de cerrar el navegador.

**VD-23 · Inicio del socio, progreso y bienvenida** (`05` §2-3)
LISTO SI: e2e: primera vez → bienvenida; entrar por QR → "Entraste" con la
cuenta del mes; vencido → Pagar arriba.

**VD-24 · Lista de espera automática y motivo de "no podés reservar"** (`05` §3)
LISTO SI: db: se libera lugar → el primero de la espera queda confirmado y
avisado.

**VD-25 · Página del gimnasio rediseñada** (`06`)
LISTO SI: e2e: todas las secciones, probar → Interesado; Lighthouse
celular ≥ 90 en rendimiento (o anotar por qué no).

**VD-26 · Página de Gym OS para vender** (`06`)
LISTO SI: la plataforma muestra la landing; "Ingresar" sigue andando.

## D · Diseño, velocidad, navegación, cierre

**VD-27 · Diseño v2: vidrio, movimiento, componentes únicos** (`07`)
LISTO SI: barrido con capturas mirándolas; reduced-motion apaga
animaciones.

**VD-28 · Navegación con memoria y Volver al origen** (`07`)
LISTO SI: e2e: Socios filtrado → ficha → Cobrar → vuelve a Socios con el
filtro y el scroll.

**VD-29 · Ctrl+K con acciones** (`07`)
LISTO SI: e2e: "cobrar juan" abre Cobrar con Juan.

**VD-30 · Velocidad medida y escala** (`07`)
Script de tiempos con el demo de 3.000; `explain analyze` de las funciones
clave; índices; paginación; caché de lo que cambia poco.
LISTO SI: tabla de tiempos antes/después en el LOG; ninguna pantalla clave
> 1 s de servidor con 3.000 socios.

**VD-31 · Ayuda y onboarding por pantalla** (`07`)
LISTO SI: e2e: primera vez se ve el globo, la segunda no (guardado en la
base por usuario).

**VD-32 · Segunda pasada v2: dueño, recepción y socio de punta a punta**
Hacer los tres días completos (`04` "Su día", un día del dueño, un mes del
socio) con capturas; todo lo que falte se arregla o se suma como VD-32X.
LISTO SI: e2e rev-v2-dueno, rev-v2-recepcion, rev-v2-socio en verde.
