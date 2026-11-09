# Los 70 detalles

Los 70 del pedido (§6), cruzados con lo que ya existe. **El estado inicial es lo
que se cree por los documentos, no está verificado ejecutando**: cada fila se
abre con sesión real y la app compilada antes de pasarla a ✅.

- ✅? existe según la hoja de ruta: verificar y anotar la prueba que lo cubre.
- 🟡 existe una parte: dice qué falta.
- ❌ no existe.

Al verificar, la columna Estado pasa a ✅ / 🟡 / ❌ / ⛔ y la columna Prueba dice
qué e2e o prueba de base lo cubre. Lo que es P0 está marcado con su BASE-*.

## Recepción (1 a 20)

| # | Detalle | Lo que existe | Estado | Ítem | Prueba |
|---|---|---|---|---|---|
| 1 | Búsqueda que no se traba con acentos, mayúsculas ni errores de tipeo | `pg_trgm` + `unaccent`, buscador de la Entrada y Ctrl+K | ✅? probar "jose" → José, "gonzales" → González | | |
| 2 | Atajo global para ingresar | Tipear un número abre la Entrada (D17) | 🟡 falta F2 y `/` | BASE-3 | |
| 3 | Lector de QR o tarjeta en el mismo campo | VD-1 (teclado numérico y lectores) | ✅? | BASE-3 | |
| 4 | Aviso flotante con color | VD-4 (avisos de entradas de otros equipos) | ❌ el aviso del ingreso propio abajo a la derecha | BASE-3 | |
| 5 | Sonido | | ❌ | BASE-3 | |
| 6 | Panel lateral con la ficha rápida | Ficha completa con tecla F (VD-1B) | 🟡 falta el panel lateral | BASE-3 | |
| 7 | Cobrar ahora desde el aviso | Hoja Cobrar única (VD-5) | 🟡 falta abrirla desde el panel | BASE-3 | |
| 8 | Dejar pasar con motivo | VD-8 (tres modos, registro) | ✅? | BASE-3 | |
| 9 | El motivo del rechazo siempre escrito | VD-2 (`guia_entrada`: texto, qué decirle, botón) | ✅? | | |
| 10 | No cuenta doble | VD-3 (visita de 5 h) | ✅? | | |
| 11 | "Entraron hoy" en vivo | VD-12B, VD-4 | ✅? | BASE-4 | |
| 12 | Adentro ahora | VD-48 (salida opcional) | ✅? | BASE-4 | |
| 13 | Pase diario en 2 toques | Pase diario desde la Entrada | 🟡 contar los toques; botón rápido | BASE-4 | |
| 14 | Alta en menos de 30 s | Alta rápida desde la Entrada (VD-6) | ✅? medir con cronómetro en el e2e | | |
| 15 | Foto con la cámara | Foto del socio (se achica a 800 px webp, VD-47X) | 🟡 verificar que en tablet y celular abre la cámara | | |
| 16 | Sin internet no se pierden ingresos | VD-34 (clave de operación, nada dos veces) | ✅ | | `sin-internet.test.mjs` (base, corrida 09/11: 866/867 con la suite) y `e2e/seg-5.mjs` (SEG-5, cola local con la misma clave de operación: se anota al volver internet, sin duplicar). Estaba mal marcado ❌: existe desde SEG-5. |
| 17 | Historial de ingresos | Ficha del socio | ✅? | | |
| 18 | Vencen hoy a la vista | VD-14 | ✅? | BASE-4 | |
| 19 | Cumpleaños | Automáticas de Para hacer hoy (VD-13) | 🟡 verificar que esté, y que se vea en el aviso | | |
| 20 | Notas a la vista | Notas en la ficha (con detector de salud, VD-46H) | 🟡 mostrarlas en el aviso y el panel | BASE-3 | |

## Socios y cobros (21 a 38)

| # | Detalle | Lo que existe | Estado | Ítem | Prueba |
|---|---|---|---|---|---|
| 21 | Estado de cuenta | Ficha, deuda de la puerta, lo que se le debe al socio (VD-46L) | 🟡 una vista única de cargos y pagos con saldo | | |
| 22 | Barra de vigencia | | ❌ en el panel lateral, la ficha y la app | BASE-3, BASE-10 | |
| 23 | Medios de cobro editables | Configuración de cobro | ✅? | | |
| 24 | Pagos parciales | Fiado, para regularizar | 🟡 verificar si una cuota se puede pagar en partes y qué cubre cada parte | | |
| 25 | Renovar en 1 toque | Cobrar desde Vencen, ficha y Entrada | ✅? contar los toques | | |
| 26 | Cambio de plan: próximo período o prorrateado (configurable) | Cambio de plan desde la app con días a favor (VD-39) | 🟡 desde el panel, con la opción en Configuración | | |
| 27 | Prueba con fecha de fin y convertir | VD-51 | ✅? verificar "convertir en socio" | | |
| 28 | Congelamiento con tope | Pausas con pedido | ✅? verificar el tope | | |
| 29 | Packs que se descuentan con la asistencia | Packs de clases | ✅? | | |
| 30 | Recargo por pagar tarde | Reglas de vencimiento (VD-7) | 🟡 verificar si hay recargo; si no, regla configurable | | |
| 31 | Descuentos | Cupones, cortesías con motivo y tope (VD-46C, VD-46T) | ✅ | | `cupones.test.mjs` y `beneficios` en la base (corridas 09/11). |
| 32 | Comprobante por wa.me | Recibo para compartir (VD-56) | ✅ | | `comprobante-pago.test.mjs` (base, corrida 09/11); el wa.me lo arma la pantalla. |
| 33 | Link de MercadoPago por socio con monto exacto y vencimiento | Pago online desde la app | 🟡 generarlo desde el panel; las credenciales de MP del gimnasio son 🔌 | | |
| 34 | Webhook idempotente y fuera del middleware | `eventos_webhook`, VD-46A | ✅? verificar el matcher del proxy después de Next 16 | BASE-0 | |
| 35 | Anular con motivo y registro | Control (VD-10) | ✅ | | `anular-ventas.test.mjs`, `control.test.mjs` (base, corridas 09/11). |
| 36 | Caja por turno con arqueo por medio | VD-9 (reportes X y Z) | ✅ | | `caja.test.mjs`, `historial-caja.test.mjs` (base, corridas 09/11): arqueo por medio, reportes X y Z. |
| 37 | La recepción ve su caja, el dueño todas | VD-9, VD-49 | ✅? | BASE-8 | |
| 38 | Importar Excel con vista previa | | ✅ | BASE-7 | `importar-socios.test.mjs` (base, corrida) y `e2e/soc-1.mjs` (CSV y Excel: filas malas marcadas antes de importar, deshacer). Es el paso 9 del asistente. |

## Equipo (39 a 46)

| # | Detalle | Lo que existe | Estado | Ítem | Prueba |
|---|---|---|---|---|---|
| 39 | El super admin crea al dueño con su contraseña | Alta de gimnasio en 3 pasos (VD-40) | ✅ | BASE-2 | BASE-2: el super admin escribe la contraseña del dueño al crear el gimnasio (D42). `e2e/base-2.mjs` (13 pasos, verificado el 08/11 por el principal). |
| 40 | El dueño crea usuarios | Equipo | ✅ | BASE-2 | BASE-2: Equipo del dueño con contraseña propia o provisoria. `e2e/base-2.mjs`; `equipo-perfil.test.mjs` (base, corrida). |
| 41 | Desactivar sin borrar | VD-42 | ✅? | BASE-2 | |
| 42 | Restablecer contraseñas | | ✅ | BASE-2 | BASE-2: "nueva contraseña" para el equipo (dueño) y para los dueños (super admin); "Olvidé mi contraseña" con tope (SEG-1, `limite-codigos.test.mjs`). `e2e/base-2.mjs`. |
| 43 | Matriz de permisos editable por el dueño | Interruptores sueltos (Equipo → Permisos, VD-41C, VD-12C) | 🟡 una matriz rol × acción. **Toca permisos**: valores por defecto los de hoy, un rol nunca puede ganar algo que la base no le permite, prueba por rol | | |
| 44 | Registro de quién hizo qué | Control (VD-10) | ✅ | BASE-8 | `control.test.mjs`, `control-entrada.test.mjs` (base, corridas 09/11). |
| 45 | Entrar como (con registro) | Soporte con motivo (VD-40) | ✅? | BASE-2 | |
| 46 | Links fijos por rol | | ✅ | BASE-2 | BASE-2 (D41): `/dueno`, `/recepcion`, `/profe`, `/socio`, `/super` con título del rol. `e2e/base-2.mjs`. |

## Profes (47 a 52)

| # | Detalle | Lo que existe | Estado | Ítem | Prueba |
|---|---|---|---|---|---|
| 47 | Sus clases y sus alumnos | Panel del profe | ✅? | | |
| 48 | Asistencia en 1 toque | Tomar asistencia | ✅? contar los toques | | |
| 49 | Cupos y lista de espera | VD-24 | ✅? | | |
| 50 | Rutinas | VD-20 | ✅? | | |
| 51 | No ve plata | Permisos por rol | ✅? probar en la base y en pantalla | BASE-8 | |
| 52 | Horas para la liquidación | VD-52, fichaje con PIN (VD-53) | ✅? | | |

## Socio (53 a 58)

| # | Detalle | Lo que existe | Estado | Ítem | Prueba |
|---|---|---|---|---|---|
| 53 | Ingreso con recuperación | Ingreso del socio (D23) | 🟡 mail y contraseña como principal (D43) | BASE-10 | |
| 54 | Vigencia, días, deuda y fecha de pago | Inicio del socio (VD-23) | ✅? | BASE-10 | |
| 55 | QR que rota | `MiQR` | ✅? probar una captura vieja | BASE-10 | |
| 56 | Reservar | Clases en la app | ✅? | | |
| 57 | Historial | `/app/historial` | ✅? | | |
| 58 | Se instala (PWA) | `manifest.ts`, `Instalar` | ✅? probar en celular | BASE-10 | |

## Página del gimnasio (59 a 64)

| # | Detalle | Lo que existe | Estado | Ítem | Prueba |
|---|---|---|---|---|---|
| 59 | Plantilla predeterminada | VD-25 | ✅? probar con un gimnasio sin nada cargado | BASE-9 | |
| 60 | Editable | Panel → Página | ✅? falta orden de secciones | BASE-9 | |
| 61 | Botones "Soy socio" y "Quiero ser socio" | `/hacete-socio` | 🟡 verificar los dos en la portada | BASE-9 | |
| 62 | Todo sale de los datos | | ✅? | BASE-9 | |
| 63 | SEO | `sitemap.ts`, `robots.ts`, `og` | 🟡 datos estructurados | BASE-9 | |
| 64 | Dominio propio | `dominios_gimnasio` | ✅? el DNS es 🔌 | | |

## Dueño (65 a 70)

| # | Detalle | Lo que existe | Estado | Ítem | Prueba |
|---|---|---|---|---|---|
| 65 | Números | Inicio (VD-12), Retención (VD-16) | ✅? | BASE-4 | |
| 66 | Retención con wa.me | Retención | ✅? | | |
| 67 | Plata en riesgo | Retención | ✅ | BASE-4 | `base4-numeros.test.mjs` (base, corrida 09/11): "plata en riesgo" = suma mensual de vencidos, por vencer, nuevos y no vienen. |
| 68 | Horarios pico | Asistencia (VD-16) | 🟡 gráfico por hora y día de la semana | | |
| 69 | Reporte mensual | Resumen, exportar el mes | 🟡 un reporte del mes que se pueda mandar | | |
| 70 | Asistente de 9 pasos | Primeros pasos (VD-43) | 🟡 | BASE-7 | |
