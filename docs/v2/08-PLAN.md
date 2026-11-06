# 08 · El plan: ítems VD-* en orden

Mismo formato que la COLA de `docs/HOJA-DE-RUTA.md` (bloque 20). Cada ítem:
qué, dónde está el detalle, y **LISTO SI** (lo que se prueba ejecutando).
El detalle de cada ítem está abajo agrupado por tema (A-F); **el orden en
que se hacen son las tandas** (es el orden de la COLA). Cada tanda se
publica entera cuando da verde (D25, ver `NOCHE-WINDOWS.md`).

| Tanda | Para qué | Ítems, en orden |
|---|---|---|
| **1 · Para mañana** | Lo que el dueño ve en la presentación: lindo, rápido y que no se rompa | VD-34 (confiabilidad base) · VD-47 (rapidez) · VD-27 (diseño v2: base, movimiento de `16` §3) · VD-33 (ingreso) · VD-1 · VD-2 · VD-5 · VD-6 · VD-12 · VD-36 · VD-23 |
| **2 · Plata y control** | Que nadie se lleve nada y cada peso tenga dueño | VD-7 · VD-8 · VD-9 · VD-10 · VD-3 · VD-4 · VD-41 |
| **3 · El día del dueño** | Todo conectado y con pendientes | VD-11 · VD-37 · VD-13 · VD-14 · VD-15 · VD-38 · VD-16 · VD-17 · VD-18 · VD-44 |
| **4 · Socio y página** | La app y la página que dan ganas | VD-35 · VD-39 · VD-22 · VD-24 · VD-25 · VD-19 · VD-20 |
| **5 · BRIK y seguridad** | Manejar muchos gimnasios tranquilo | VD-40 · VD-42 · VD-43 · VD-21 |
| **6 · El día a día real** | Las situaciones de `14-SITUACIONES.md` que todavía no estén cubiertas | VD-46 … |
| **7 · Cierre** | Pulido, velocidad, memoria y segunda pasada | VD-28 · VD-29 · VD-30 · VD-31 · VD-26 · VD-32 |

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

## E · Lo que se sumó el 05/11 a la noche (pedido de Mateo)

**VD-33 · Ingreso más lindo y "primero quién, después cómo"** (`11`)
Pantalla con la marca del gimnasio (o de Gym OS), animación corta, tarjeta
de vidrio; un campo "celular o mail" que ofrece el método según la cuenta;
código de 6 dígitos con autocompletado y "reenviar en 0:59"; errores que no
revelan cuentas; "olvidé mi contraseña". No se pierde ningún método de hoy.
LISTO SI: e2e: entrar con contraseña, con código por mail (imitador) y con
código por celular desde la misma pantalla; desde `/g/demo` se ve la marca
del demo; reduced-motion sin animación; celular sin desbordes.

**VD-34 · Confiabilidad base: nada dos veces, nada se pierde, nada se traba** (`13` §1-3)
`BotonAccion` único (se deshabilita, "Guardando…", ignora el segundo envío)
en todo el panel y la app; **clave de operación** en cobros y pagos (unique
por gimnasio, reintento devuelve lo ya hecho); formularios con
`useActionState` devuelven lo escrito ante error (todos); `error.tsx` y
`not-found.tsx` con "Volver" e "Ir al inicio"; versión en ediciones
concurrentes de ficha, plan y configuración ("Sofi lo cambió hace 1 min").
LISTO SI: db: misma clave dos veces = una venta; e2e: doble clic en Cobrar
= un cobro; error en un formulario conserva todo; dos sesiones editan la
misma ficha y la segunda ve el aviso.

**VD-35 · Registro del socio (D26)** (`05` §2b, `11`)
LISTO SI: e2e: desde la página → registrarse con plan → queda "a cobrar"
con 🌐 en el panel → paga por transferencia → entra; menor no puede; con el
registro apagado no aparece.

**VD-36 · App del socio en 4 pestañas, limpia** (`05` §3b)
Inicio · Clases · Rutina · Yo; lo demás en Inicio solo cuando hay algo y en
Yo → Más; pestañas que se apagan con la sección.
LISTO SI: barrido del socio en celular: cada pantalla vieja sigue
accesible; gimnasio sin clases no muestra la pestaña.

**VD-37 · Pendientes (números y puntitos) y centro de notificaciones** (`12`)
`pendientes_panel(gimnasio)` en un pedido, menú con números calculados,
regla del rojo, punto en Novedades, campana agrupada por día con "marcar
todo leído", preferencias por tipo y canal, push pedido después de algo
que lo justifique.
LISTO SI: db: cada contador baja solo al resolverse; < 50 ms con 3.000
socios; e2e: cobrar a uno baja el número de Vencen.

**VD-38 · Mensajes de los socios (D27)** (`05` §2c)
Tabla de mensajes con RLS (el socio los suyos, el equipo los del gimnasio
según el dueño), foto opcional, respuestas rápidas, estados, aviso al
socio, historial en la ficha.
LISTO SI: db: un socio no ve los de otro, la recepción solo si el dueño lo
prende; e2e: socio escribe con foto → recepción ve el puntito y contesta →
el socio ve la respuesta.

**VD-39 · Cambio de plan y compra de pases desde la app (D28)** (`05` §2d)
Usa la regla D6 y `iniciar_pago_online`/transferencia; aprobación
opcional del dueño.
LISTO SI: db: días a favor calculados por la base; e2e: socio cambia a un
plan más caro, paga por transferencia, la recepción aprueba y el plan
cambia.

**VD-40 · Super admin v2** (`10`)
LISTO SI: e2e: alta de gimnasio en 3 pasos con vista previa; salud con
colores y orden "necesitan atención"; entrar como soporte pide motivo y el
dueño lo ve; mensaje de ayuda del dueño llega con contexto.

**VD-41 · Gastos y presupuesto del gimnasio** (`15` §7)
Gastos por categoría (alquiler, sueldos, servicios, mantenimiento,
proveedores, otros) con foto del comprobante, fijos que se repiten cada
mes, presupuesto mensual por categoría; Resultado muestra ingresos −
gastos = **ganancia** y el desvío contra el presupuesto. Solo dueño (y
encargado si se prende).
LISTO SI: db: la recepción no ve gastos; un gasto fijo aparece todos los
meses; e2e: cargar gastos y ver la ganancia del mes.

**VD-42 · Mi cuenta y seguridad** (`11`)
Cambiar contraseña (todos), mis sesiones y "cerrar las demás", 2FA TOTP
(super admin obligatorio, dueño recomendado) con políticas `aal2` en lo
sensible, "Dar de baja" a alguien del equipo en un botón, alertas de
seguridad al dueño.
LISTO SI: db: sin aal2 el dueño no exporta ni toca el equipo si tiene 2FA
activo; e2e: cambiar contraseña; dar de baja corta su sesión y su PIN.

**VD-43 · Gimnasio nuevo: onboarding calculado y datos de ejemplo** (`12`)
LISTO SI: e2e: gimnasio recién creado → cada paso se tacha solo al
cumplirse; cargar ejemplos y borrarlos.

**VD-44 · Equipo con foto, clases y horario** (`11`)
Profes y recepción con foto, qué clases da cada uno, horario de trabajo; se
ven en la página y la app (si el dueño quiere). La liquidación sigue en
COM-15 (🟡).
LISTO SI: e2e: profe con foto aparece en su clase en la app.

**VD-46… · Situaciones del día a día** (`14-SITUACIONES.md`)
Cada situación ⭐ que el sistema todavía no resuelve es un ítem VD-46,
VD-47… con su LISTO SI (los arma el agente al empezar la tanda 6, leyendo
`14-SITUACIONES.md` y el código).

**VD-47 · Rapidez de verdad** (`16` §1-2, §4)
Región igual a Supabase (o QUÉ CONFIGURÁS VOS), middleware con el gimnasio
en memoria 60 s y `getClaims`, una consulta o `Promise.all` por pantalla,
`Suspense` en los bloques lentos, `unstable_cache` por gimnasio de lo que
casi no cambia con `revalidateTag` al guardar, `next/dynamic` para lo
pesado, fotos achicadas al subir, tiempo máximo con "Reintentar",
`scripts/medir/tiempos.mjs` en las Pruebas completas.
LISTO SI: tabla de tiempos antes/después en el LOG (15 pantallas × rol,
3.000 socios): todas < 1 s hasta ver contenido en compu; el middleware hace
como mucho 1 viaje a Supabase por pedido (contado en la prueba); cambiar la
marca o un plan se ve al instante (revalidación); ningún dato de permisos o
plata en caché (prueba: dos roles ven lo suyo).
