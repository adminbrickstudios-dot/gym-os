# Gym OS — Schema

> Pendiente de cruzar con `LECCIONES` y `CONVENCIONES` (no estaban
> adjuntos cuando se escribió).

## Estado (29/10/2026)

**Construido y probado contra Postgres 16** (migraciones 0001–0007, base
local con la simulación de Supabase, 80 pruebas): acceso, habilitaciones,
períodos y precios, cobro de cuotas y administración de la membresía.
Lo demás sigue siendo propuesta (§4).

| Migración | Qué tiene |
|---|---|
| 0001 base | gimnasios, sedes, dominios, configuración, admins de plataforma, equipo, equipo_pines (cerrada), helpers de RLS |
| 0002 socios y planes | socios, planes, plan_sedes, precios_plan |
| 0003 plata | cajas, turnos_caja, movimientos_caja, ventas, venta_items, pagos |
| 0004 habilitaciones | suscripciones, cierres, congelamientos, coberturas, suspensiones, pases_diarios, packs, consumos_pack |
| 0005 períodos y precios | `precio_para`, `proximo_periodo`, `cuotas_para_cubrir`, meses con ancla |
| 0006 acceso | dispositivos, dispositivos_tokens (cerrada), ingresos, compensación de días, `calcular_acceso` y sus vías, RPC de ingreso, congelamiento y cierre |
| 0007 cobro | `confirmar_venta`, `cobrar_cuota`, `anular_venta`, `asignar_plan`, `cambiar_plan`, `dar_de_baja` |

**Cambios respecto de la propuesta original**

1. **Sedes desde el día 1.** Cada gimnasio nace con una (trigger). Lo que
   pasa en un lugar lleva `sede_id`. Un plan dice en qué sedes vale
   (`todas_las_sedes` + `plan_sedes`), para membresías y packs. Una
   persona del equipo asignada a una sede solo opera en esa sede.
2. **El teléfono del socio no es único** (familias que comparten número).
   El DNI sí, por gimnasio. `tutor_socio_id` para menores. Solo el dueño
   o el servidor vinculan un login a un socio (trigger).
3. **Precios por lista.** Las filas con el mismo `vigente_desde` son una
   lista; rige la última. Dentro de la lista, si hay filas de la sede,
   mandan esas, y el socio paga el **menor** monto entre las que le
   aplican (medio de pago, día del mes). La deuda usa el precio base.
4. **Renovación con ancla.** Cada cobertura pagada guarda `ancla_dia`:
   31/01 → 28/02 → 31/03 → 30/04. Día fijo alinea desde la primera cuota.
   La deuda que ve la recepción sale de la misma secuencia de períodos
   que genera el cobro.
5. **Compensación calculada, no cargada.** Los días cubiertos que caen en
   un congelamiento o un cierre se devuelven en los primeros días libres
   siguientes. `privado.recalcular_compensacion` la rehace entera por
   trigger cada vez que cambia una cobertura, un congelamiento, un
   cierre o un ingreso en un día en pausa. No importa el orden (pagar
   antes o después de congelar da lo mismo), congelamiento y cierre el
   mismo día cuentan una vez, un día en que el socio igual entró no se
   devuelve, y anular un pago se lleva sus días devueltos.
6. **Escritura solo por RPC** en lo que decide el acceso: suscripciones,
   coberturas, congelamientos, cierres, pases, packs, consumos. Todas
   inmutables por trigger salvo sus columnas de anulación o cierre.
7. **Congelamiento con categoría cerrada** (viaje, personal, económico,
   otro). La recepción solo congela desde hoy; con fecha pasada, el
   dueño o el encargado. `descongelar` = volvió antes.
8. **Baja del socio**: sin vía membresía aunque la suscripción haya
   quedado abierta. `dar_de_baja` cierra las dos cosas.
9. **Modo aviso** deja pasar todo salvo a un suspendido. Lo prende solo
   el dueño (la configuración es del dueño).
10. **Ingresos**: el momento se toma después del lock
    (`clock_timestamp`), así dos lecturas casi simultáneas no se
    descuentan dos veces (probado con dos conexiones reales).
11. **Tablas cerradas** (RLS sin políticas): `equipo_pines`,
    `dispositivos_tokens`. Ni anon ni authenticated tienen TRUNCATE,
    REFERENCES ni TRIGGER.
12. **Funciones en dos esquemas**: `privado` (no expuesto) para el
    cálculo; `public` solo para RPC que chequean rol y llaman a `privado`.

**Medido con 3.000 socios y 80.000 ingresos:** `registrar_ingreso` ~9 ms;
búsqueda por nombre con índice trigram (<2 ms); un cierre que recalcula
la compensación de todo el gimnasio ~0,5 s; el estado de los 3.000 de
una vez ~2,6 s (las listas de retención necesitan una versión por lotes).

## 0 · El principio que ordena todo

**Se guardan hechos. Se calcula el estado.**

| Es un hecho (se guarda) | Es un estado (se calcula) |
|---|---|
| "Este pago cubre del 14/10 al 14/11" | "Está al día" |
| "Se congeló del 05/11 al 20/11" | "Está congelada" |
| "Compró un pack de 10 el 01/10" | "Le quedan 3 clases" |
| "Entró el 26/10 a las 19:02" | "No viene hace 20 días" |
| "El dueño lo suspendió por conducta" | "No puede entrar" |
| "Se dio de baja el 30/09" | "Se fue" |

La regla "nunca se guarda" se cumple **si y solo si** cada fila de la
izquierda es inmutable o tiene historia. Un hecho se corrige con otro
hecho (anulación), no pisando la fila.

**Corolario:** nada que decida si alguien entra depende de un cron.
Esto aplica a tres lugares, no a uno:

1. El estado del socio → función, no columna.
2. Los cargos mensuales → no se generan por cron; la deuda se calcula.
3. Las instancias de clase → se crean a demanda, no por cron.

---

## 1 · Mapa de módulos

```
PLATAFORMA (BRIK)                     GIMNASIO (tenant)
─────────────────                     ─────────────────
administradores_plataforma            gimnasios ── dominios_gimnasio
plataforma_planes                        │         configuracion_gimnasio
plataforma_suscripciones ────────────────┤
plataforma_pagos                         │
documentos_legales ── aceptaciones ──────┤
eventos_webhook                          │
                                         ├── equipo (dueño/recepción/profe)
                                         │
   PERSONAS ─────────────────────────────┤
   socios ── credenciales_socio          │
                                         │
   QUÉ SE VENDE ─────────────────────────┤
   planes ── precios_plan                │
   productos ── movimientos_stock        │
                                         │
   LO QUE HABILITA (hechos) ─────────────┤
   suscripciones ── coberturas           │
                └── congelamientos       │
   pases_diarios                         │
   packs ── consumos_pack                │
   suspensiones                          │
                                         │
   PLATA ────────────────────────────────┤
   ventas ── venta_items                 │
         └── pagos ── turnos_caja ── cajas
   movimientos_caja · gastos             │
   mp_cuentas_gimnasio                   │
                                         │
   ACCESO ───────────────────────────────┤
   ingresos · dispositivos               │
                                         │
   CLASES ───────────────────────────────┤
   actividades ── horarios_clase ── clases
   reservas · asistencias · plan_actividades
                                         │
   RUTINAS ──────────────────────────────┤
   ejercicios ── rutinas ── rutina_ejercicios
   registros_carga                       │
                                         │
   COMUNICACIÓN ─────────────────────────┤
   plantillas_mensaje · automatizaciones │
   envios · contactos_retencion          │
                                         │
   OPERACIÓN ────────────────────────────┘
   importaciones · exportaciones · auditoria
   accesos_rapidos · solicitudes_codigo
```

---

## 2 · Convenciones de todas las tablas

```sql
id            uuid primary key default gen_random_uuid()
gimnasio_id   uuid not null references gimnasios(id)
creado_en     timestamptz not null default now()
creado_por    uuid null references auth.users(id)   -- donde aplica
unique (gimnasio_id, id)                             -- habilita la FK compuesta
```

**FK compuesta siempre.** Un hijo no apunta a `socios(id)`, apunta a
`socios(gimnasio_id, id)`:

```sql
foreign key (gimnasio_id, socio_id) references socios (gimnasio_id, id)
```

Así es **imposible a nivel base** que una cobertura del gimnasio A
apunte a un socio del gimnasio B. El `gimnasio_id` denormalizado sin
esto es una promesa del código; con esto es una garantía de Postgres.

**Plata:** `numeric(12,2)`. **Fechas:** `timestamptz`. **Días
calendario:** intervalo semiabierto `[desde, hasta)` donde ambos
límites son la medianoche local del gimnasio, calculados con
`medianoche_local(gimnasio_id, fecha)`. "Vence el 14/11" se guarda como
`hasta = 15/11 00:00 -03`. El socio que entra el 14 a las 23:50 está
cubierto, esté donde esté el servidor.

**Excepciones a `gimnasio_id`** (lista cerrada, la usa `npm run chequeos`):
`gimnasios`, `administradores_plataforma`, `plataforma_planes`,
`documentos_legales` (puede ser null: los de BRIK son globales),
`eventos_webhook` (el gimnasio se resuelve después de recibir).

**Excepciones a "unique por gimnasio"** (lista cerrada):
`gimnasios.slug`, `dominios_gimnasio.host`, `dispositivos_tokens.token_hash`,
`mp_cuentas_gimnasio.mp_user_id`,
`eventos_webhook (origen, tipo, id_externo)`,
`plataforma_pagos.mp_pago_id`.

---

## 3 · Las tres vías — cómo se modela sin que se vuelva ilegible

### 3.1 Los hechos de cada vía

**Membresía** = una `suscripcion` (el socio está anotado en un plan
mensual) + sus `coberturas` (cada una dice qué período quedó cubierto y
por qué) + sus `congelamientos`.

```
suscripcion: Juan en "Plan Full", desde 01/03, sin baja
coberturas:
  [14/09 → 14/10)  origen: pago        venta_item 8812
  [14/10 → 14/11)  origen: pago        venta_item 9120
  [20/11 → 29/11)  origen: congelamiento  congelamiento 31   ← los 9 días que tenía al congelar
congelamientos:
  [05/11 → 20/11)  motivo: viaje
```

La cobertura tiene `origen`: `pago`, `congelamiento`, `cortesia`
(regalo del dueño, con motivo), `importacion` (vino de la planilla, con
`importacion_id`). Que el congelamiento **genere una cobertura** es
deliberado: los días que se corren no son un estado, son una decisión
del gimnasio ("te devuelvo los 9 días"). Queda auditable y el cálculo
sigue siendo "¿hay una cobertura que contenga este momento?".

**Pase diario** = una fila en `pases_diarios` con su día
`[desde, hasta)` y `usado_en_ingreso_id` (null hasta que entra).

**Pack** = una fila en `packs` (cantidad, vence_en) + filas en
`consumos_pack`. Restantes = `cantidad − count(consumos no anulados)`.
Nunca una columna `restantes`.

**Bloqueo de persona** = una fila en `suspensiones` (decisión del
gimnasio, con motivo). Bloquea **todas** las vías.

> Ojo con la diferencia: **congelado bloquea la vía membresía, no a la
> persona.** Una socia congelada que compra un pase diario entra.
> Suspendido sí bloquea a la persona.

### 3.2 La función, por partes

Un tipo compuesto común y una función chica por vía. Cada una devuelve
el mismo tipo; la función principal solo combina.

```sql
create type veredicto_acceso as (
  puede            boolean,
  color            text,      -- verde | amarillo | naranja | rojo | gris
  via              text,      -- membresia | pase | pack | ninguna
  motivo           text,      -- código estable: al_dia, por_vencer, en_tolerancia,
                              -- vencida, congelada, suspendido, fuera_de_franja,
                              -- tope_semanal, pack_agotado, no_es_socio ...
  texto            text,      -- "Venció el 20/10 · dentro de tolerancia (2 de 5 días)"
  vence_en         timestamptz,
  tolerancia_usada int,
  tolerancia_total int,
  para_regularizar numeric(12,2),  -- lo que tiene que pagar hoy para quedar al día
  pack_restantes   int,
  consume          text,      -- nada | pase | pack
  consume_id       uuid,      -- qué pase o pack se descontaría
  avisos           text[],    -- líneas secundarias: "la cuota venció, entra con el pack"
  modo_aviso       boolean    -- el gimnasio está en "avisar sin bloquear"
);

_bloqueo_persona (socio, momento) → veredicto | null
_via_membresia   (socio, momento) → veredicto | null
_via_pase        (socio, momento) → veredicto | null
_via_pack        (socio, momento) → veredicto | null

estado_acceso    (socio, momento) → veredicto          -- STABLE, solo lee
registrar_ingreso(socio, via_acceso, dispositivo, forzar_motivo) → ingreso  -- escribe
estado_acceso_gimnasio(gimnasio, momento) → setof (socio_id, veredicto)  -- para listas
```

**La combinación, en orden fijo:**

```
1. ¿Existe el socio y está activo?          no → GRIS  "No es socio" [Vender pase]
2. _bloqueo_persona                          sí → ROJO  y termina
3. Evaluar las tres vías
4. Elegir la PRIMERA que deja entrar, en este orden:
     a. membresía  (verde / amarillo / naranja)   → no consume nada
     b. pase de hoy                               → consume el pase
     c. pack                                      → consume 1 (o 0 si ya consumió hoy)
5. Si ninguna deja entrar → devolver el motivo MÁS ÚTIL:
     tiene/tuvo membresía → el de la membresía (vencida / congelada / franja)
     si no, tiene pack    → pack agotado / vencido
     si no                → GRIS
6. Lo que dijeron las otras vías va a `avisos`
7. Si el gimnasio está en modo "avisar sin bloquear" y puede = false:
     puede = true, modo_aviso = true, color y motivo SE MANTIENEN
```

Por qué este orden: la membresía nunca le cuesta nada al socio; el pase
se compró para hoy; el pack es plata del socio y se toca último. Y la
tolerancia (naranja) gana sobre el pack: si está en sus 5 días de
gracia, no le comemos una clase.

**Ejemplo de lo que ve recepción con dos vías:**
```
✅ Entra con el pack · le quedan 3
   La cuota venció el 02/10 · debe $18.000
```

### 3.3 `_via_membresia`, desarmada

```
sin suscripción activa                    → null (la vía no aplica)
congelamiento que contiene el momento     → ROJO congelada · "Congelada hasta el 20/11"
fuera de la franja horaria del plan       → ROJO fuera_de_franja · "Su plan es hasta las 16:00"
ya usó sus N ingresos de la semana        → ROJO tope_semanal · "Ya vino 3 veces esta semana"
cobertura contiene el momento:
   faltan > dias_aviso                    → VERDE al_dia
   faltan ≤ dias_aviso                    → AMARILLO por_vencer · "avisale"
sin cobertura, último hasta + tolerancia > momento
                                          → NARANJA en_tolerancia · "2 de 5 días"
sin cobertura, fuera de tolerancia        → ROJO vencida · "Venció el 02/10 · debe $18.000"
```

Franja horaria y tope semanal ("pase libre" vs "3 veces por semana")
no estaban en el brief y en Argentina son muy comunes. Van como
columnas opcionales del plan; si están en null, no se evalúan.

### 3.4 `registrar_ingreso` — lo que escribe

1. Toma un lock por socio (`pg_advisory_xact_lock`) → un doble toque o
   dos lectores de QR al mismo tiempo no descuentan dos clases.
2. Si ya hay un ingreso del socio en los últimos 60 segundos, devuelve
   **ese** ingreso (idempotente).
3. Llama `estado_acceso` dentro de la misma transacción.
4. Inserta en `ingresos` con la foto de la decisión (`resultado`,
   `via_habilitante`, `motivo`, `texto`) — la foto es un hecho histórico,
   no un estado.
5. Si consume: marca el pase o inserta en `consumos_pack`.
6. Si `forzar_motivo` viene con texto → `resultado = 'forzado'`. Sin
   texto, falla (check en la tabla).
7. Verifica filas afectadas. Si no insertó, `raise exception`.

Los rechazos **también** se registran (`resultado = 'rechazado'`): "le
dijimos que no a 12 personas esta semana" es un dato del negocio.

### 3.5 Por qué no se vuelve ilegible

- Cada vía es una función de ~30 líneas que se testea sola.
- La combinación es una lista con orden fijo, no un árbol de `if`.
- Los casos testigo del seed (un socio por cada fila de las tablas de
  arriba) son a la vez el test de aceptación: se llama
  `estado_acceso(socio, '2026-11-14 23:50-03')` y se compara color y
  motivo.

---

## 4 · Tablas por módulo

### Plataforma

| Tabla | Columnas clave | Notas |
|---|---|---|
| `gimnasios` | slug (unique global), nombre, zona_horaria (default `America/Argentina/Buenos_Aires`), moneda `ARS`, es_demo, suspension_manual_motivo | El estado de la suscripción a BRIK **se calcula** igual que el del socio: `estado_plataforma(gimnasio)` |
| `dominios_gimnasio` | host (unique global), tipo `subdominio`/`propio`, verificado_en, vercel_dominio_id | El middleware resuelve host → gimnasio acá. No resuelve → `/gimnasio-no-encontrado` |
| `configuracion_gimnasio` | 1:1. cobra_membresia, cobra_pase, cobra_pack, modo_clases (`reserva`/`sin_reserva`/`ninguno`), accesos_activos text[], tolerancia_dias, dias_aviso, avisar_sin_bloquear_hasta timestamptz, permite_reingreso_mismo_dia, logo_path, favicon_path, color_acento, color_fondo, secciones_apagadas text[], onboarding_salteado_en | Separada de `gimnasios` para que el dueño edite su config sin poder tocar campos de plataforma |
| `administradores_plataforma` | usuario_id | Vos. Sin `gimnasio_id` |
| `plataforma_planes` | nombre, precio, activo | Lo que BRIK cobra |
| `plataforma_suscripciones` | gimnasio_id, plan_id, inicio, mp_preapproval_id | **Prefijo `plataforma_`** = flujo BRIK → gimnasio, credenciales tuyas |
| `plataforma_pagos` | gimnasio_id, monto, cubre_desde, cubre_hasta, mp_pago_id (unique) | Mismo patrón cobertura que los socios |
| `documentos_legales` | gimnasio_id null (null = de BRIK), tipo (`terminos`/`privacidad`/`encargado_tratamiento`), version, vigente_desde, hash_contenido, ruta | Inmutables. Versión nueva = fila nueva |
| `aceptaciones_legales` | documento_id, gimnasio_id, usuario_id null, socio_id null, aceptado_en, ip, user_agent | Lo que pide el punto 6.6 |
| `eventos_webhook` | origen (`mp_cobros`/`mp_plataforma`), tipo, id_externo, gimnasio_id null, payload jsonb, recibido_en, procesado_en, intentos, error | unique (origen, tipo, id_externo) = idempotencia |

### Equipo y personas

| Tabla | Columnas clave | Notas |
|---|---|---|
| `equipo` | usuario_id **null**, nombre, rol (`dueno`/`recepcion`/`profe`), activo | usuario_id null = profe que figura en la grilla pero no tiene cuenta. Pasa mucho |
| `socios` | numero (unique por gimnasio), nombre, apellido, dni (unique por gimnasio, null), telefono E.164 (unique por gimnasio, null), email, fecha_nacimiento, usuario_id null, origen (`manual`/`importacion`/`alta_web`), importacion_id, dado_de_baja_en | Un visitante de pase diario también es un socio (con datos mínimos). Así "vino 3 veces con pase → ofrecele plan" sale solo |
| `credenciales_socio` | socio_id, tipo (`qr`/`pin`/`nfc`), qr_version int, pin_hash, nfc_codigo (unique por gimnasio), revocado_en | **Sin políticas de RLS para clientes.** Solo el servidor la lee |

### Qué se vende

| Tabla | Columnas clave | Notas |
|---|---|---|
| `planes` | tipo (`membresia`/`pase_diario`/`pack`), nombre, activo. Membresía: duracion_meses, renovacion (`continua`/`desde_pago`/`dia_fijo`), dia_fijo, reinicio_tras_dias, tolerancia_dias (override), max_ingresos_semana, hora_desde, hora_hasta. Pack: cantidad, validez_dias, consume_en (`ingreso`/`asistencia`) | Una tabla con `check` por tipo, no tres tablas. La pantalla "Planes" es una sola |
| `precios_plan` | plan_id, monto, vigente_desde | Los aumentos se programan: "a partir del 1/11 sale $20.000". Precio actual = el último con vigente_desde ≤ ahora |
| `plan_actividades` | plan_id, actividad_id | Qué clases puede reservar cada plan |
| `productos` | nombre, precio, controla_stock, activo | Agua, shakes, remeras |
| `movimientos_stock` | producto_id, cantidad (±), motivo, venta_item_id | Stock = suma. Mismo principio |

### Lo que habilita (hechos)

| Tabla | Columnas clave | Notas |
|---|---|---|
| `suscripciones` | socio_id, plan_id, inicio, baja_en, motivo_baja | "Está anotado en el Plan Full". La baja es una decisión, se guarda |
| `coberturas` | suscripcion_id, socio_id, desde, hasta, origen, venta_item_id, congelamiento_id, importacion_id, motivo, anulada_en, anulada_por | El corazón. `check (hasta > desde)`. Anular ≠ borrar |
| `congelamientos` | suscripcion_id, desde, hasta_prevista, hasta_real, motivo | Al crearlo se crea la cobertura de compensación; si vuelve antes, se ajusta |
| `suspensiones` | socio_id, desde, hasta null, motivo, levantada_en, levantada_por | Bloquea a la persona |
| `pases_diarios` | socio_id, desde, hasta, venta_item_id, usado_en_ingreso_id | |
| `packs` | socio_id, plan_id, cantidad, desde, vence_en, venta_item_id | |
| `consumos_pack` | pack_id, ingreso_id null, asistencia_id null, anulado_en | `check` de que tenga uno de los dos |

### Plata (gimnasio → socio)

| Tabla | Columnas clave | Notas |
|---|---|---|
| `ventas` | socio_id null, estado (`pendiente`/`confirmada`/`anulada`), origen (`recepcion`/`app`/`debito`), creado_por | Total = suma de items. Pendiente = checkout de MP esperando webhook |
| `venta_items` | venta_id, tipo (`cuota`/`pase`/`pack`/`producto`/`matricula`/`otro`), plan_id, producto_id, cantidad, precio_unitario, descuento | Lo que genera (cobertura, pase, pack) apunta acá |
| `pagos` | venta_id, medio (`efectivo`/`transferencia`/`mercadopago`/`tarjeta`/`debito_automatico`), monto, estado (`aprobado`/`pendiente`/`rechazado`/`anulado`), mp_pago_id (unique por gimnasio), turno_caja_id | Una venta se puede pagar con dos medios |
| `cajas` | nombre ("Recepción") | |
| `turnos_caja` | caja_id, abierto_por, abierto_en, monto_inicial, cerrado_en, cerrado_por, monto_contado, nota | Esperado = inicial + efectivo − retiros. **Se calcula.** Diferencia = contado − esperado |
| `movimientos_caja` | turno_caja_id, tipo (`retiro`/`ingreso`/`gasto`), monto, motivo, gasto_id | |
| `gastos` | categoria, monto, fecha, medio, comprobante_ruta, nota | Para "Resultado" |
| `mp_cuentas_gimnasio` | mp_user_id (unique global), access_token_secreto_id (Vault), refresh_token_secreto_id, expira_en, vinculado_en, desvinculado_en | **Sin RLS para clientes.** OAuth de MP, no token pegado |
| `debitos_automaticos` | socio_id, suscripcion_id, mp_preapproval_id, alta_en, baja_en | Fase posterior |

**Cuándo nace una cobertura:** cuando la venta se confirma con pago en
efectivo/transferencia, o cuando el webhook aprueba el pago de MP.
Nunca cuando el navegador vuelve del checkout.

**La deuda se calcula:** saldo de ventas confirmadas sin pagar (si el
gimnasio fía) + períodos no cubiertos según `planes.renovacion`. No hay
tabla de cargos generados por cron.

### Acceso

| Tabla | Columnas clave | Notas |
|---|---|---|
| `ingresos` | socio_id null, momento, via_acceso (`recepcion`/`qr_socio`/`qr_pared`/`kiosco`/`nfc`/`molinete`), resultado (`entro`/`rechazado`/`entro_modo_aviso`/`forzado`), via_habilitante, motivo, texto, forzado_motivo, registrado_por, dispositivo_id | `check (resultado <> 'forzado' or forzado_motivo is not null)` |
| `dispositivos` | nombre, tipo (`kiosco`/`lector`), token_hash, ultimo_uso, revocado_en | La tablet no usa la sesión de una persona: usa un token del dispositivo, revocable |

### Clases

| Tabla | Columnas clave | Notas |
|---|---|---|
| `actividades` | nombre, color, emoji | Spinning, Funcional |
| `horarios_clase` | actividad_id, dia_semana, hora_inicio (`time`), duracion_min, cupo, profe_id, vigente_desde, vigente_hasta | La plantilla semanal. `time` es hora de pared en la zona del gimnasio |
| `clases` | horario_id null, actividad_id, inicio, fin, cupo, profe_id, cancelada_en, motivo_cancelacion | **Se crean a demanda** (upsert por `horario_id + inicio`) la primera vez que alguien las mira o reserva. Sin cron |
| `reservas` | clase_id, socio_id, estado (`confirmada`/`espera`/`cancelada`), creado_en, cancelada_en, avisado_en | La posición en espera sale de `creado_en`. Reservar pasa por `reservar(clase)`, que bloquea la fila de la clase (`for update`): dos personas no se quedan con el último lugar |
| `asistencias` | clase_id, socio_id, reserva_id null, registrado_por | Sirve para los dos modos: con reserva y sin reserva |

### Rutinas

| Tabla | Columnas clave | Notas |
|---|---|---|
| `ejercicios` | nombre, grupo, video_url | Catálogo del gimnasio (se siembra uno base) |
| `rutinas` | socio_id null (null = plantilla), profe_id, nombre, activa | |
| `rutina_ejercicios` | rutina_id, dia, orden, ejercicio_id, series, repeticiones, descanso_seg, nota | `nota` es técnica ("codos pegados"), nunca médica |
| `registros_carga` | socio_id, rutina_ejercicio_id, fecha, peso, repeticiones | Peso sí. Salud no |

### Comunicación

| Tabla | Columnas clave | Notas |
|---|---|---|
| `plantillas_mensaje` | clave (`no_viene`/`por_vencer`/`vencido`/`se_fue`/`bienvenida`…), texto con `{nombre}`, `{vence}` | Editables por gimnasio |
| `automatizaciones` | tipo, activa, config jsonb | |
| `envios` | automatizacion_id null, socio_id, canal, plantilla_clave, clave_unica, estado, id_externo, enviado_en | unique (gimnasio_id, clave_unica) → un cron que corre dos veces no manda dos mensajes |
| `contactos_retencion` | socio_id, canal, nota, creado_por | "Le escribí hace 2 días". El panel de retención lo muestra para que no le escriban tres personas |

### Operación

| Tabla | Columnas clave | Notas |
|---|---|---|
| `importaciones` | archivo_ruta, filas_total, filas_ok, errores jsonb, aplicada_en, revertida_en | Todo lo importado lleva `importacion_id` → se revierte entera |
| `exportaciones` | pedida_por, estado, archivo_ruta, expira_en | Disponible **aun con el gimnasio suspendido** |
| `auditoria` | usuario_id, accion, tabla, fila_id, antes jsonb, despues jsonb | Trigger en tablas de plata y acceso |
| `accesos_rapidos` | usuario_id, panel, orden, accion | La grilla editable. Sin filas = la default de la config |
| `solicitudes_codigo` | telefono_hash, ip_hash, creado_en | Rate limit del login por teléfono |

**El onboarding se calcula:** "¿tiene planes? ¿tiene horarios? ¿tiene
un socio?". Solo se guarda `onboarding_salteado_en`.

---

## 5 · RLS

**Helpers** (`security definer`, `stable`, `search_path = ''`):

```sql
mis_gimnasios(roles text[]) → setof uuid   -- gimnasios donde soy equipo con alguno de esos roles
mis_socios()                → setof uuid   -- socios vinculados a mi usuario
soy_admin_plataforma()      → boolean
```

**Tres patrones:**

| Patrón | Tablas | Regla |
|---|---|---|
| Operativo | socios, planes, ventas, clases, ingresos… | Select: equipo del gimnasio. Insert/update: según rol. Delete: casi nadie (se anula) |
| Del socio | socios (la propia), coberturas, packs, reservas, rutinas, registros_carga, ingresos | Select donde `socio_id in (select mis_socios())`. Escritura solo vía RPC |
| Cerrado | credenciales_socio, mp_cuentas_gimnasio, solicitudes_codigo, eventos_webhook, dispositivos.token_hash | RLS activa **sin políticas** → solo el servidor con service role |

**Matriz por rol (borrador):**

| | Dueño | Recepción | Profe | Socio |
|---|---|---|---|---|
| Socios: ver / crear / editar | ✅ | ✅ | solo sus alumnos, solo nombre y asistencia | el propio |
| Vender / cobrar | ✅ | ✅ | ❌ | pagar lo suyo |
| Anular venta o pago | ✅ | ❌ (pide al dueño) | ❌ | ❌ |
| Dejar pasar (forzar) | ✅ | ✅ con motivo | ❌ | ❌ |
| Planes, precios, config, equipo | ✅ | ❌ | ❌ | ❌ |
| Resultado, gastos | ✅ | ❌ | ❌ | ❌ |
| Clases | ✅ | ver y tomar asistencia | las suyas | reservar |
| Rutinas | ✅ | ❌ | ✅ | la propia + cargar peso |

Lo que toca plata y acceso se escribe **por RPC**, que chequea el rol y
hace `raise exception` si no corresponde. Nunca devuelve vacío.

**Lo que RLS no puede saber:** el host. Si un usuario es equipo de dos
gimnasios, la base le deja leer los dos; el filtro por host es de la
app. RLS garantiza que nadie vea un gimnasio **ajeno**; el host elige
**cuál de los suyos**.

---

## 6 · Índices que importan desde el día 1

```sql
-- Entrada: buscar por nombre en < 50 ms con 3.000 socios, con o sin tilde
create extension if not exists pg_trgm;
create extension if not exists unaccent;
-- sin_acentos(text) es un wrapper IMMUTABLE de unaccent (unaccent no lo es)
create index on socios using gin (gimnasio_id, sin_acentos(nombre || ' ' || apellido) gin_trgm_ops);  -- btree_gin para gimnasio_id
create index on socios (gimnasio_id, dni);
create index on socios (gimnasio_id, telefono);

create index on coberturas (gimnasio_id, socio_id, hasta desc) where anulada_en is null;
create index on ingresos   (gimnasio_id, socio_id, momento desc);   -- "no viene hace N días"
create index on ingresos   (gimnasio_id, momento);                  -- entradas de hoy, horarios pico
create index on clases     (gimnasio_id, inicio);
create index on reservas   (clase_id, estado);
```

---

## 7 · Lo que queda abierto

**Para la media hora con el dueño de gimnasio** (decide el modelo de
`planes.renovacion`, no se puede cerrar sin esto):

1. Si un socio paga 10 días tarde, ¿el mes nuevo arranca cuando pagó o
   cuando le vencía? ¿Pierde esos días?
2. ¿Todos pagan del 1 al 10 (día fijo) o cada uno según cuándo se
   anotó?
3. Si alguien no viene dos meses y vuelve, ¿debe los dos meses o paga
   el actual y listo? ¿Cobran matrícula de nuevo?
4. ¿Cuántos días de tolerancia dan? ¿Lo cumplen o depende de quién
   atiende?
5. ¿Fían? ("Te lo anoto y pagás el viernes")
6. ¿Congelan? ¿Con qué límite (días por año, mínimo)? ¿Lo cobran?
7. ¿Tienen planes por frecuencia ("3 veces por semana") o por horario
   ("solo mañana")?
8. En clases con reserva: ¿el que reserva y no viene pierde la clase
   del pack?
9. ¿Piden apto médico? ¿Lo controlan en la entrada?
10. ¿Qué hace la recepción hoy cuando se corta internet?

**Para vos:**

- Qué se corta cuando un gimnasio no te paga (recomendación abajo).
- El apto médico: si se exige, propongo guardar **solo** "presentó apto,
  vence el X" — sin el documento ni nada de su contenido. Choca con la
  regla de salud tal como está escrita; la decisión es tuya.
- Si se habilitan planes familiares (uno paga, entran varios). No está
  modelado.

**Recomendación sobre la suspensión por falta de pago:** la Entrada de
recepción **nunca se corta en seco**. El que sufre el corte no es el
dueño que no pagó: son 200 socios en la puerta, y eso se cuenta en el
barrio. Propuesta: aviso 7 días antes → período de gracia con cartel en
todos los paneles → suspensión que bloquea el panel del dueño (salvo
"Pagar" y "Exportar"), las altas y las automatizaciones, pero deja
Entrada y Cobrar funcionando con un cartel visible para el socio
durante X días más. Al pagar, se reactiva solo (el estado se calcula
de `plataforma_pagos`, no hay nada que "reactivar").
