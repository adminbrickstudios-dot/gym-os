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
| 1 | Búsqueda que no se traba con acentos, mayúsculas ni errores de tipeo | `pg_trgm` + `unaccent`, buscador de la Entrada y Ctrl+K | ✅ | | `busqueda-tolerante.test.mjs` (base, corrida 09/11): "jose" → José, "GONZALEZ" → González, "gonzales" → González, sin traer a cualquiera. Migración 20261109040600 (similitud de palabra de pg_trgm; antes solo toleraba acentos y mayúsculas). |
| 2 | Atajo global para ingresar | Tipear un número abre la Entrada (D17) | 🟡 falta F2 y `/` | BASE-3 | |
| 3 | Lector de QR o tarjeta en el mismo campo | VD-1 (teclado numérico y lectores) | 🟡 | BASE-3 | Base: la Entrada acepta DNI, QR y llavero. Falta correr `e2e/vd-1.mjs` (lectores en el mismo campo). |
| 4 | Aviso flotante con color | VD-4 (avisos de entradas de otros equipos) | ❌ el aviso del ingreso propio abajo a la derecha | BASE-3 | |
| 5 | Sonido | | ❌ | BASE-3 | |
| 6 | Panel lateral con la ficha rápida | Ficha completa con tecla F (VD-1B) | 🟡 falta el panel lateral | BASE-3 | |
| 7 | Cobrar ahora desde el aviso | Hoja Cobrar única (VD-5) | 🟡 falta abrirla desde el panel | BASE-3 | |
| 8 | Dejar pasar con motivo | VD-8 (tres modos, registro) | ✅ | BASE-3 | `dejar-pasar.test.mjs`, `dejar-pasar-modos.test.mjs` (base, corridas 09/11). |
| 9 | El motivo del rechazo siempre escrito | VD-2 (`guia_entrada`: texto, qué decirle, botón) | ✅ | | `guia-entrada.test.mjs` (base, corrida 09/11): texto, qué decirle y botón por situación. |
| 10 | No cuenta doble | VD-3 (visita de 5 h) | ✅ | | `reingreso-visita.test.mjs` (base, corrida 09/11): la visita de 5 h no cuenta doble. |
| 11 | "Entraron hoy" en vivo | VD-12B, VD-4 | ✅ | BASE-4 | `entradas-en-vivo.test.mjs` (base, corrida 09/11). |
| 12 | Adentro ahora | VD-48 (salida opcional) | ✅ | BASE-4 | `salida-opcional.test.mjs` (base, corrida 09/11). |
| 13 | Pase diario en 2 toques | Pase diario desde la Entrada | 🟡 contar los toques; botón rápido | BASE-4 | |
| 14 | Alta en menos de 30 s | Alta rápida desde la Entrada (VD-6) | 🟡 | | `alta-rapida.test.mjs` (base, corrida). Falta medir los 30 s con cronómetro: `e2e/vd-6.mjs` (sin correr). |
| 15 | Foto con la cámara | Foto del socio (se achica a 800 px webp, VD-47X) | 🟡 | | `foto-socio.test.mjs` (base, corrida) y `e2e/soc-7.mjs`. Falta probar en una tablet y un celular reales que se abre la cámara. |
| 16 | Sin internet no se pierden ingresos | VD-34 (clave de operación, nada dos veces) | ✅ | | `sin-internet.test.mjs` (base, corrida 09/11: 866/867 con la suite) y `e2e/seg-5.mjs` (SEG-5, cola local con la misma clave de operación: se anota al volver internet, sin duplicar). Estaba mal marcado ❌: existe desde SEG-5. |
| 17 | Historial de ingresos | Ficha del socio | ✅ | | `historial-socio.test.mjs` (base, corrida 09/11). |
| 18 | Vencen hoy a la vista | VD-14 | ✅ | BASE-4 | `vencen-pestanas.test.mjs` (base, corrida 09/11). |
| 19 | Cumpleaños | Automáticas de Para hacer hoy (VD-13) | 🟡 | | `cumpleanos.test.mjs` (base, corrida). Falta que se vea en el aviso de la Entrada (carril A). |
| 20 | Notas a la vista | Notas en la ficha (con detector de salud, VD-46H) | 🟡 | BASE-3 | `notas-etiquetas.test.mjs` (base, corrida). Falta mostrarlas en el aviso y el panel lateral (carril A). |

## Socios y cobros (21 a 38)

| # | Detalle | Lo que existe | Estado | Ítem | Prueba |
|---|---|---|---|---|---|
| 21 | Estado de cuenta | Ficha, deuda de la puerta, lo que se le debe al socio (VD-46L) | 🟡 | | `cuenta-corriente.test.mjs`, `deuda-socios.test.mjs` (base, corridas). Falta la vista única de cargos y pagos con saldo en la ficha. |
| 22 | Barra de vigencia | | 🟡 | BASE-3, BASE-10 | Barra de vigencia hecha en la ficha del socio (`components/panel/BarraVigencia.tsx`, con los días escritos); sin correr con sesión real. Faltan el panel lateral (carril A) y la app (carril C). |
| 23 | Medios de cobro editables | Configuración de cobro | ✅ | | `medios-de-pago.test.mjs` (base, corrida 09/11). |
| 24 | Pagos parciales | Fiado, para regularizar | 🟡 | | `cuenta-corriente.test.mjs`: hoy una deuda se paga entera en Vender o se fía hasta un tope; no hay pago de una cuota en partes. Decisión de Mateo (`PREGUNTAS.md`). |
| 25 | Renovar en 1 toque | Cobrar desde Vencen, ficha y Entrada | 🟡 | | `cobrar-flujo.test.mjs` (base, corrida). Falta contar los toques: `e2e/vd-5.mjs` (sin correr). |
| 26 | Cambio de plan: próximo período o prorrateado (configurable) | Cambio de plan desde la app con días a favor (VD-39) | 🟡 | | `cambio-plan.test.mjs`, `registro-cambio-plan-app.test.mjs` (base, corridas). El panel ya cambia de plan con vista previa; falta la opción "próximo período o prorrateado" en Configuración. |
| 27 | Prueba con fecha de fin y convertir | VD-51 | 🟡 | | `prueba-gratis.test.mjs` (base, corrida: una vez por DNI, 1 día o 1 clase). Falta verificar "convertir en socio": `e2e/vd-51.mjs` (sin correr). |
| 28 | Congelamiento con tope | Pausas con pedido | ✅ | | `pausas.test.mjs` (base, corrida 09/11): el máximo por año frena. |
| 29 | Packs que se descuentan con la asistencia | Packs de clases | ✅ | | `faltas-pack.test.mjs` (base, corrida 09/11): el pack se descuenta con la asistencia y la falta. |
| 30 | Recargo por pagar tarde | Reglas de vencimiento (VD-7) | ✅ | | `recargo.test.mjs` (base, corrida 09/11): apagado por defecto, la dueña lo prende, fijo o porcentaje. |
| 31 | Descuentos | Cupones, cortesías con motivo y tope (VD-46C, VD-46T) | ✅ | | `cupones.test.mjs` y `beneficios` en la base (corridas 09/11). |
| 32 | Comprobante por wa.me | Recibo para compartir (VD-56) | ✅ | | `comprobante-pago.test.mjs` (base, corrida 09/11); el wa.me lo arma la pantalla. |
| 33 | Link de MercadoPago por socio con monto exacto y vencimiento | Pago online desde la app | 🟡 | | `pagos-online.test.mjs` (base, corrida). Falta generar el link desde el panel con monto y vencimiento. Las credenciales de MercadoPago del gimnasio son 🔌. |
| 34 | Webhook idempotente y fuera del middleware | `eventos_webhook`, VD-46A | 🟡 | BASE-0 | `pagos-online.test.mjs`, `mercadopago-devoluciones.test.mjs` (base, corridas: idempotente por id externo). Falta verificar el matcher del proxy con Next 16: `e2e/pay-1.mjs` y `e2e/base-8.mjs` (sin correr). |
| 35 | Anular con motivo y registro | Control (VD-10) | ✅ | | `anular-ventas.test.mjs`, `control.test.mjs` (base, corridas 09/11). |
| 36 | Caja por turno con arqueo por medio | VD-9 (reportes X y Z) | ✅ | | `caja.test.mjs`, `historial-caja.test.mjs` (base, corridas 09/11): arqueo por medio, reportes X y Z. |
| 37 | La recepción ve su caja, el dueño todas | VD-9, VD-49 | ✅ | BASE-8 | `permisos-por-rol.test.mjs` (base, corrida 09/11): la recepción no entra al historial de turnos ni a las cajas de otros; dueño y encargado sí. `caja.test.mjs`. |
| 38 | Importar Excel con vista previa | | ✅ | BASE-7 | `importar-socios.test.mjs` (base, corrida) y `e2e/soc-1.mjs` (CSV y Excel: filas malas marcadas antes de importar, deshacer). Es el paso 9 del asistente. |

## Equipo (39 a 46)

| # | Detalle | Lo que existe | Estado | Ítem | Prueba |
|---|---|---|---|---|---|
| 39 | El super admin crea al dueño con su contraseña | Alta de gimnasio en 3 pasos (VD-40) | ✅ | BASE-2 | BASE-2: el super admin escribe la contraseña del dueño al crear el gimnasio (D42). `e2e/base-2.mjs` (13 pasos, verificado el 08/11 por el principal). |
| 40 | El dueño crea usuarios | Equipo | ✅ | BASE-2 | BASE-2: Equipo del dueño con contraseña propia o provisoria. `e2e/base-2.mjs`; `equipo-perfil.test.mjs` (base, corrida). |
| 41 | Desactivar sin borrar | VD-42 | ✅ | BASE-2 | `dos-pasos-y-baja.test.mjs` (base, corrida 09/11): dar de baja desactiva, borra el PIN y corta sesiones; el historial queda. |
| 42 | Restablecer contraseñas | | ✅ | BASE-2 | BASE-2: "nueva contraseña" para el equipo (dueño) y para los dueños (super admin); "Olvidé mi contraseña" con tope (SEG-1, `limite-codigos.test.mjs`). `e2e/base-2.mjs`. |
| 43 | Matriz de permisos editable por el dueño | Interruptores sueltos (Equipo → Permisos, VD-41C, VD-12C) | 🟡 | | `permisos-equipo.test.mjs` (base, corrida): interruptores por rol. La matriz editable rol × acción no existe: toca permisos, queda para decisión de Mateo (`PREGUNTAS.md`). |
| 44 | Registro de quién hizo qué | Control (VD-10) | ✅ | BASE-8 | `control.test.mjs`, `control-entrada.test.mjs` (base, corridas 09/11). |
| 45 | Entrar como (con registro) | Soporte con motivo (VD-40) | ✅ | BASE-2 | `super-admin-f2.test.mjs` (base, corrida 09/11): entrar como soporte con rol, motivo y registro. |
| 46 | Links fijos por rol | | ✅ | BASE-2 | BASE-2 (D41): `/dueno`, `/recepcion`, `/profe`, `/socio`, `/super` con título del rol. `e2e/base-2.mjs`. |

## Profes (47 a 52)

| # | Detalle | Lo que existe | Estado | Ítem | Prueba |
|---|---|---|---|---|---|
| 47 | Sus clases y sus alumnos | Panel del profe | ✅ | | `clases.test.mjs`, `profe-busca-socios.test.mjs` (base, corridas 09/11). |
| 48 | Asistencia en 1 toque | Tomar asistencia | 🟡 | | `clases.test.mjs` (base, corrida: asistencia). Falta contar los toques: `e2e/cla-2.mjs` (sin correr). |
| 49 | Cupos y lista de espera | VD-24 | ✅ | | `espera-concurrente.test.mjs`, `espera-motivo.test.mjs` (base, corridas 09/11). |
| 50 | Rutinas | VD-20 | ✅ | | `rutinas.test.mjs`, `rutina-socio.test.mjs` (base, corridas 09/11). |
| 51 | No ve plata | Permisos por rol | ✅ | BASE-8 | `permisos-por-rol.test.mjs` (base, corrida 09/11: el profe recibe error en cobros y caja) y `profe-busca-socios.test.mjs` ("sin plata ni datos de contacto"). |
| 52 | Horas para la liquidación | VD-52, fichaje con PIN (VD-53) | ✅ | | `liquidacion-profes.test.mjs`, `fichaje-equipo.test.mjs` (base, corridas 09/11). |

## Socio (53 a 58)

| # | Detalle | Lo que existe | Estado | Ítem | Prueba |
|---|---|---|---|---|---|
| 53 | Ingreso con recuperación | Ingreso del socio (D23) | 🟡 | BASE-10 | `mail-para-ingresar.test.mjs`, `entrar-con-mail.test.mjs` (base, corridas). Falta correr `e2e/olvide-socio.mjs` (carril C). |
| 54 | Vigencia, días, deuda y fecha de pago | Inicio del socio (VD-23) | ✅ | BASE-10 | `resumen-app-socio.test.mjs` (base, corrida 09/11). |
| 55 | QR que rota | `MiQR` | ✅ | BASE-10 | `qr-socio.test.mjs` (base, corrida 09/11): el código rota y uno viejo no entra. |
| 56 | Reservar | Clases en la app | ✅ | | `clases.test.mjs` (base, corrida 09/11): reservas y cancelaciones. |
| 57 | Historial | `/app/historial` | ✅ | | `asistencia-socio.test.mjs` (base, corrida 09/11). |
| 58 | Se instala (PWA) | `manifest.ts`, `Instalar` | 🟡 | BASE-10 | `manifest.ts` y `Instalar` existen. Falta probarlo en un celular real (manual). |

## Página del gimnasio (59 a 64)

| # | Detalle | Lo que existe | Estado | Ítem | Prueba |
|---|---|---|---|---|---|
| 59 | Plantilla predeterminada | VD-25 | ✅ | BASE-9 | `landing.test.mjs` (base, corrida 09/11): un gimnasio sin nada cargado ve la plantilla por defecto. |
| 60 | Editable | Panel → Página | 🟡 | BASE-9 | `editor-pagina.test.mjs` (base, corrida). Falta el orden de secciones (carril C). |
| 61 | Botones "Soy socio" y "Quiero ser socio" | `/hacete-socio` | 🟡 | BASE-9 | Verificar los dos botones en la portada: `e2e/pag-1.mjs` (sin correr; carril C). |
| 62 | Todo sale de los datos | | ✅ | BASE-9 | `landing.test.mjs` (base, corrida 09/11): todo sale de los datos. |
| 63 | SEO | `sitemap.ts`, `robots.ts`, `og` | ✅ | BASE-9 | `src/lib/datos-estructurados.test.ts` (vitest, corrida 09/11). El validador externo queda para BASE-9. |
| 64 | Dominio propio | `dominios_gimnasio` | 🟡 | | `src/lib/dominios.test.ts` (vitest, corrida). El DNS es 🔌. |

## Dueño (65 a 70)

| # | Detalle | Lo que existe | Estado | Ítem | Prueba |
|---|---|---|---|---|---|
| 65 | Números | Inicio (VD-12), Retención (VD-16) | ✅ | BASE-4 | `resumen-dueno.test.mjs`, `inicio-numeros.test.mjs` (base, corridas 09/11). |
| 66 | Retención con wa.me | Retención | ✅ | | `retencion.test.mjs` (base, corrida 09/11). |
| 67 | Plata en riesgo | Retención | ✅ | BASE-4 | `base4-numeros.test.mjs` (base, corrida 09/11): "plata en riesgo" = suma mensual de vencidos, por vencer, nuevos y no vienen. |
| 68 | Horarios pico | Asistencia (VD-16) | 🟡 | | `ocupacion.test.mjs` (base, corrida). Resultado muestra las horas de más cobro; falta el gráfico por hora y día de la semana de asistencia. |
| 69 | Reporte mensual | Resumen, exportar el mes | 🟡 | | `resultado.test.mjs` (base, corrida: resultado del mes y exportar para el contador). Falta un reporte del mes que se pueda mandar. |
| 70 | Asistente de 9 pasos | Primeros pasos (VD-43) | 🟡 | BASE-7 | `asistente-pasos.test.mjs`, `primeros-pasos.test.mjs` (base, corridas: los 9 pasos medidos). Falta correr `e2e/base-7b.mjs` (escrito, sin correr). |
