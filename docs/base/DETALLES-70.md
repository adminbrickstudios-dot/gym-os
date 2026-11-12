# Los 70 detalles

Los 70 del pedido (§6), cruzados con lo que ya existe. **El estado inicial es lo
que se cree por los documentos, no está verificado ejecutando**: cada fila se
abre con sesión real y la app compilada antes de pasarla a ✅.

- ✅? existe según la hoja de ruta: verificar y anotar la prueba que lo cubre.
- 🟡 existe una parte: dice qué falta.
- ❌ no existe.

Al verificar, la columna Estado pasa a ✅ / 🟡 / ❌ / ⛔ y la columna Prueba dice
qué e2e o prueba de base lo cubre. Lo que es P0 está marcado con su BASE-*.

**Cierre de F4.1 (12/11, rama `carril/f4-f5`).** Las corridas son del workflow `pruebas-completas` (pantallas, app compilada, gimnasio demo; Temple Gym no se tocó). Lo que sigue en 🟡 dice por qué: plata o permisos (queda en `PREGUNTAS.md` con la opción más segura), algo manual en un aparato real, o trabajo mediano que no entró.

## Recepción (1 a 20)

| # | Detalle | Lo que existe | Estado | Ítem | Prueba |
|---|---|---|---|---|---|
| 1 | Búsqueda que no se traba con acentos, mayúsculas ni errores de tipeo | `pg_trgm` + `unaccent`, buscador de la Entrada y Ctrl+K | ✅ | | `busqueda-tolerante.test.mjs` (base, corrida 09/11): "jose" → José, "GONZALEZ" → González, "gonzales" → González, sin traer a cualquiera. Migración 20261109040600 (similitud de palabra de pg_trgm; antes solo toleraba acentos y mayúsculas). |
| 2 | Atajo global para ingresar | Tipear un número abre la Entrada (D17); F2, Ctrl+E y la tecla `/` abren la ventana | ✅ | BASE-3 | `vd-1` 19 pasos (F2, número suelto, DNI; corrida 43131873292) y `f45-detalles` (la tecla `/` abre la ventana; corrida 43130787225). |
| 3 | Lector de QR o tarjeta en el mismo campo | VD-1 (teclado numérico y lectores) | ✅ | BASE-3 | `vd-1` (un lector con un QR abre la ventana y lo lee; corrida 43131873292) y `recepcion-lector` 15 pasos (corrida 43128173940). La Entrada acepta DNI, QR y llavero en el mismo campo. |
| 4 | Aviso flotante con color | Aviso flotante con color (verde, naranja, rojo) de las entradas de otras compus y de la tablet, arriba del botón de Entrada y a la izquierda de la barra (D56) | ✅ | BASE-3 | `vd-4` 11 pasos (corrida 43128173940). |
| 5 | Sonido | Sonido del veredicto por color, con interruptor en Configuración y en cada compu | ✅ | BASE-3 | `ent-1` 10 pasos (corrida 43130787225): cuenta los sonidos (AudioContext) sin parlantes. |
| 6 | Panel lateral con la ficha rápida | Panel lateral con la ficha rápida (estado, plan y vigencia, último pago, últimos ingresos) | ✅ | BASE-3 | `f45-detalles` 8 pasos (corrida 43131873292). Lo que se le suma (cuándo toca pagar, notas) es la función nueva "Más datos en el panel del socio", apagada por defecto. |
| 7 | Cobrar ahora desde el aviso | Hoja Cobrar única (VD-5) | ✅ | BASE-3 | `f45-detalles` (corrida 43131873292): COBRAR AHORA, en el panel lateral, abre la hoja Cobrar sin salir de la pantalla y cierra el panel. |
| 8 | Dejar pasar con motivo | VD-8 (tres modos, registro) | ✅ | BASE-3 | `dejar-pasar.test.mjs`, `dejar-pasar-modos.test.mjs` (base, corridas 09/11). |
| 9 | El motivo del rechazo siempre escrito | VD-2 (`guia_entrada`: texto, qué decirle, botón) | ✅ | | `guia-entrada.test.mjs` (base, corrida 09/11): texto, qué decirle y botón por situación. |
| 10 | No cuenta doble | VD-3 (visita de 5 h) | ✅ | | `reingreso-visita.test.mjs` (base, corrida 09/11): la visita de 5 h no cuenta doble. |
| 11 | "Entraron hoy" en vivo | VD-12B, VD-4 | ✅ | BASE-4 | `entradas-en-vivo.test.mjs` (base, corrida 09/11). |
| 12 | Adentro ahora | VD-48 (salida opcional) | ✅ | BASE-4 | `salida-opcional.test.mjs` (base, corrida 09/11). |
| 13 | Pase diario en 2 toques | Pase diario desde la Entrada | 🟡 | BASE-4 | Botón "Pase diario" en Inicio (`velocidad-a`, sin correr): lleva a Vender y el cobro es el de siempre, más de dos toques. Hacerlo en dos es un cobro nuevo para quien no es socio: opción más segura en `PREGUNTAS.md` (12/11). |
| 14 | Alta en menos de 30 s | Alta rápida desde la Entrada (VD-6) | ✅ |  | `vd-6` 21 pasos con cronómetro (corrida 43131873292): del "No hay nadie con el DNI" a "Entró" en menos de 30 s, con el cobro en el medio; `alta-rapida.test.mjs` (base). El recorrido es intermitente en esta rama: pasó en las corridas 43128173940 (20 pasos, sin cronómetro) y 43131873292 (la segunda ejecución) y cayó en 43130787225, 43131873292 (la primera ejecución) y 43132608358, siempre antes de cobrar (el paso Plan sin tarjetas o el foco en Anotar); la causa raíz (`RefrescarAlEntrar` junta los refrescos) está arreglada en `carril/rev-mostrador`, sin integrar. |
| 15 | Foto con la cámara | Foto del socio (se achica a 800 px webp, VD-47X) | ✅ |  | `soc-7` 6 pasos (corrida 43128173940) con la cámara de mentira de Chrome; `foto-socio.test.mjs` (base). Sin probar en una tablet ni un celular reales: manual. |
| 16 | Sin internet no se pierden ingresos | VD-34 (clave de operación, nada dos veces) | ✅ |  | `sin-internet.test.mjs` (base, corrida 09/11) y `seg-5` 6 pasos (corrida 43128173940: cola local con la misma clave de operación; se anota al volver internet, sin duplicar). |
| 17 | Historial de ingresos | Ficha del socio | ✅ | | `historial-socio.test.mjs` (base, corrida 09/11). |
| 18 | Vencen hoy a la vista | VD-14 | ✅ | BASE-4 | `vencen-pestanas.test.mjs` (base, corrida 09/11). |
| 19 | Cumpleaños | Automáticas de Para hacer hoy (VD-13) | ✅ |  | `guia-entrada.test.mjs` y `cumpleanos.test.mjs` (base, corrida 43130787225): el veredicto trae el chip "Cumple años hoy"; la Entrada y la ventana dibujan los chips (`data-chip`). Sin e2e con un cumpleañero del día. |
| 20 | Notas a la vista | Notas en la ficha (con detector de salud, VD-46H) | ✅ | BASE-3 | `f45-detalles` (corrida 43131873292): la nota de la ficha se ve en el panel lateral (función "Más datos en el panel del socio", apagada por defecto); `notas-etiquetas.test.mjs` (base). |

## Socios y cobros (21 a 38)

| # | Detalle | Lo que existe | Estado | Ítem | Prueba |
|---|---|---|---|---|---|
| 21 | Estado de cuenta | Ficha, deuda de la puerta, lo que se le debe al socio (VD-46L) | 🟡 |  | `cuenta-corriente.test.mjs`, `deuda-socios.test.mjs` (base). Falta la vista única de cargos y pagos con saldo en la ficha: mediano, hay que definir qué es el saldo (`PREGUNTAS.md`, 12/11). |
| 22 | Barra de vigencia |  | ✅ | BASE-3, BASE-10 | `f45-detalles` (corridas 43130787225 y 43131873292): la ficha tiene la barra de vigencia con los días escritos. El panel lateral y la app lo dicen con palabras ("quedan N días"). |
| 23 | Medios de cobro editables | Configuración de cobro | ✅ | | `medios-de-pago.test.mjs` (base, corrida 09/11). |
| 24 | Pagos parciales | Fiado, para regularizar | 🟡 | | `cuenta-corriente.test.mjs`: hoy una deuda se paga entera en Vender o se fía hasta un tope; no hay pago de una cuota en partes. Decisión de Mateo (`PREGUNTAS.md`). |
| 25 | Renovar en 1 toque | Cobrar desde Vencen, ficha y Entrada | 🟡 |  | `vd-5` 22 pasos (corrida 43128173940): desde Cobrar la hoja abre con el foco en confirmar (C, Enter, Enter). Son dos pasos, no uno: confirmar muestra el total y es plata (`PREGUNTAS.md`, 12/11). |
| 26 | Cambio de plan: próximo período o prorrateado (configurable) | Cambio de plan desde la app con días a favor (VD-39) | 🟡 |  | `cambio-plan.test.mjs`, `registro-cambio-plan-app.test.mjs` (base). El panel ya cambia de plan con vista previa y días a favor; la opción "próximo período o prorrateado" cambia cómo se cobra (`PREGUNTAS.md`, 12/11). |
| 27 | Prueba con fecha de fin y convertir | VD-51 | ✅ |  | `vd-51` 10 pasos (corrida 43130787225): el interesado reserva desde la página, la recepción lo ve, la prueba vale solo el día elegido (otro día, rojo con el porqué) y no cuenta como socio activo; `prueba-gratis.test.mjs` (base). Convertirlo en socio es el alta desde Interesados (`soc-13`, corrida 43117762536 de la revisión del mostrador). |
| 28 | Congelamiento con tope | Pausas con pedido | ✅ | | `pausas.test.mjs` (base, corrida 09/11): el máximo por año frena. |
| 29 | Packs que se descuentan con la asistencia | Packs de clases | ✅ | | `faltas-pack.test.mjs` (base, corrida 09/11): el pack se descuenta con la asistencia y la falta. |
| 30 | Recargo por pagar tarde | Reglas de vencimiento (VD-7) | ✅ | | `recargo.test.mjs` (base, corrida 09/11): apagado por defecto, la dueña lo prende, fijo o porcentaje. |
| 31 | Descuentos | Cupones, cortesías con motivo y tope (VD-46C, VD-46T) | ✅ | | `cupones.test.mjs` y `beneficios` en la base (corridas 09/11). |
| 32 | Comprobante por wa.me | Recibo para compartir (VD-56) | ✅ | | `comprobante-pago.test.mjs` (base, corrida 09/11); el wa.me lo arma la pantalla. |
| 33 | Link de MercadoPago por socio con monto exacto y vencimiento | Pago online desde la app | 🟡 |  | `pagos-online.test.mjs` (base). Falta generar el link desde el panel con monto y vencimiento: toca plata y las credenciales de MercadoPago del gimnasio (🔌); opción más segura en `PREGUNTAS.md` (12/11). |
| 34 | Webhook idempotente y fuera del middleware | `eventos_webhook`, VD-46A | ✅ | BASE-0 | `pay-1` 6 pasos (corrida 43128173940, app compilada): el aviso firmado acredita una vez, repetido no acredita dos y con firma inválida se rechaza; `pagos-online.test.mjs`, `mercadopago-devoluciones.test.mjs` (base). |
| 35 | Anular con motivo y registro | Control (VD-10) | ✅ | | `anular-ventas.test.mjs`, `control.test.mjs` (base, corridas 09/11). |
| 36 | Caja por turno con arqueo por medio | VD-9 (reportes X y Z) | ✅ | | `caja.test.mjs`, `historial-caja.test.mjs` (base, corridas 09/11): arqueo por medio, reportes X y Z. |
| 37 | La recepción ve su caja, el dueño todas | VD-9, VD-49 | ✅ | BASE-8 | `permisos-por-rol.test.mjs` (base, corrida 09/11): la recepción no entra al historial de turnos ni a las cajas de otros; dueño y encargado sí. `caja.test.mjs`. |
| 38 | Importar Excel con vista previa |  | ✅ | BASE-7 | `importar-socios.test.mjs` (base) y `soc-1` 12 pasos (corrida 43128173940): CSV y Excel, filas malas marcadas antes de importar, deshacer. Es el paso 9 del asistente. |

## Equipo (39 a 46)

| # | Detalle | Lo que existe | Estado | Ítem | Prueba |
|---|---|---|---|---|---|
| 39 | El super admin crea al dueño con su contraseña | Alta de gimnasio en 3 pasos (VD-40) | ✅ | BASE-2 | BASE-2 (D42). `base-2` 13 pasos (corrida 43128173940). |
| 40 | El dueño crea usuarios | Equipo | ✅ | BASE-2 | BASE-2: Equipo del dueño con contraseña propia o provisoria. `base-2` 13 pasos (corrida 43128173940); `equipo-perfil.test.mjs` (base). |
| 41 | Desactivar sin borrar | VD-42 | ✅ | BASE-2 | `dos-pasos-y-baja.test.mjs` (base, corrida 09/11): dar de baja desactiva, borra el PIN y corta sesiones; el historial queda. |
| 42 | Restablecer contraseñas |  | ✅ | BASE-2 | BASE-2: "nueva contraseña" para el equipo (dueño) y para los dueños (super admin); "Olvidé mi contraseña" con tope (SEG-1, `limite-codigos.test.mjs`). `base-2` 13 pasos (corrida 43128173940); `base-8` 6 pasos (corrida 43130787225: el ingreso se frena con muchos intentos). |
| 43 | Matriz de permisos editable por el dueño | Interruptores sueltos (Equipo → Permisos, VD-41C, VD-12C) | 🟡 | | `permisos-equipo.test.mjs` (base, corrida): interruptores por rol. La matriz editable rol × acción no existe: toca permisos, queda para decisión de Mateo (`PREGUNTAS.md`). |
| 44 | Registro de quién hizo qué | Control (VD-10) | ✅ | BASE-8 | `control.test.mjs`, `control-entrada.test.mjs` (base, corridas 09/11). |
| 45 | Entrar como (con registro) | Soporte con motivo (VD-40) | ✅ | BASE-2 | `super-admin-f2.test.mjs` (base, corrida 09/11): entrar como soporte con rol, motivo y registro. |
| 46 | Links fijos por rol |  | ✅ | BASE-2 | BASE-2 (D41): `/dueno`, `/recepcion`, `/profe`, `/socio`, `/super` con título del rol. `base-2` 13 pasos (corrida 43128173940). |

## Profes (47 a 52)

| # | Detalle | Lo que existe | Estado | Ítem | Prueba |
|---|---|---|---|---|---|
| 47 | Sus clases y sus alumnos | Panel del profe | ✅ | | `clases.test.mjs`, `profe-busca-socios.test.mjs` (base, corridas 09/11). |
| 48 | Asistencia en 1 toque | Tomar asistencia | ✅ |  | `rev-4` 7 pasos (corrida 43130787225): el profe marca "Presente" con un toque por alumno y lo deshace con motivo; `clases.test.mjs` (base). |
| 49 | Cupos y lista de espera | VD-24 | ✅ | | `espera-concurrente.test.mjs`, `espera-motivo.test.mjs` (base, corridas 09/11). |
| 50 | Rutinas | VD-20 | ✅ | | `rutinas.test.mjs`, `rutina-socio.test.mjs` (base, corridas 09/11). |
| 51 | No ve plata | Permisos por rol | ✅ | BASE-8 | `permisos-por-rol.test.mjs` (base, corrida 09/11: el profe recibe error en cobros y caja) y `profe-busca-socios.test.mjs` ("sin plata ni datos de contacto"). |
| 52 | Horas para la liquidación | VD-52, fichaje con PIN (VD-53) | ✅ | | `liquidacion-profes.test.mjs`, `fichaje-equipo.test.mjs` (base, corridas 09/11). |

## Socio (53 a 58)

| # | Detalle | Lo que existe | Estado | Ítem | Prueba |
|---|---|---|---|---|---|
| 53 | Ingreso con recuperación | Ingreso del socio (D23) | ✅ | BASE-10 | `olvide-socio` 9 pasos (corrida 43128173940): mail, código, contraseña nueva y entra a su app; `mail-para-ingresar.test.mjs`, `entrar-con-mail.test.mjs` (base). |
| 54 | Vigencia, días, deuda y fecha de pago | Inicio del socio (VD-23) | ✅ | BASE-10 | `resumen-app-socio.test.mjs` (base, corrida 09/11). |
| 55 | QR que rota | `MiQR` | ✅ | BASE-10 | `qr-socio.test.mjs` (base, corrida 09/11): el código rota y uno viejo no entra. |
| 56 | Reservar | Clases en la app | ✅ | | `clases.test.mjs` (base, corrida 09/11): reservas y cancelaciones. |
| 57 | Historial | `/app/historial` | ✅ | | `asistencia-socio.test.mjs` (base, corrida 09/11). |
| 58 | Se instala (PWA) | `manifest.ts`, `Instalar` | 🟡 | BASE-10 | `push-1` 9 pasos (corrida 43128173940): manifest con la marca, service worker y accesos. Instalarla en un celular real: manual, sin hacer. |

## Página del gimnasio (59 a 64)

| # | Detalle | Lo que existe | Estado | Ítem | Prueba |
|---|---|---|---|---|---|
| 59 | Plantilla predeterminada | VD-25 | ✅ | BASE-9 | `landing.test.mjs` (base, corrida 09/11): un gimnasio sin nada cargado ve la plantilla por defecto. |
| 60 | Editable | Panel → Página | ✅ | BASE-9 | `pag-1` 17 pasos (corrida 43128173940): editar, ordenar secciones con ▲ y ▼, ocultar, guardar y ver la página pública; `panel-pagina` 16 pasos (corrida 43130787225). |
| 61 | Botones "Soy socio" y "Quiero ser socio" | `/hacete-socio` | ✅ | BASE-9 | `reg-1` 13 pasos y `socio-flujo` 26 pasos (corrida 43131873292): "Quiero ser socio" aparece con las altas online prendidas y se va al apagarlas; "Ya soy socio, entrar" y "Soy del equipo" están siempre. |
| 62 | Todo sale de los datos | | ✅ | BASE-9 | `landing.test.mjs` (base, corrida 09/11): todo sale de los datos. |
| 63 | SEO | `sitemap.ts`, `robots.ts`, `og` | ✅ | BASE-9 | `src/lib/datos-estructurados.test.ts` (vitest, corrida 09/11). El validador externo queda para BASE-9. |
| 64 | Dominio propio | `dominios_gimnasio` | 🟡 |  | `src/lib/dominios.test.ts` (vitest, corrida local 12/11). El DNS y el dominio en Vercel son 🔌. |

## Dueño (65 a 70)

| # | Detalle | Lo que existe | Estado | Ítem | Prueba |
|---|---|---|---|---|---|
| 65 | Números | Inicio (VD-12), Retención (VD-16) | ✅ | BASE-4 | `resumen-dueno.test.mjs`, `inicio-numeros.test.mjs` (base, corridas 09/11). |
| 66 | Retención con wa.me | Retención | ✅ | | `retencion.test.mjs` (base, corrida 09/11). |
| 67 | Plata en riesgo | Retención | ✅ | BASE-4 | `base4-numeros.test.mjs` (base, corrida 09/11): "plata en riesgo" = suma mensual de vencidos, por vencer, nuevos y no vienen. |
| 68 | Horarios pico | Resultado: horas pico del mes; con la función nueva "Horarios pico por día de la semana" (apagada por defecto), un cuadro día × hora de las últimas 8 semanas | ✅ |  | `funciones-nuevas.test.mjs` (base, corrida 43130787225: cuenta por día y hora, sin rechazados; solo dueño y encargado) y `f45-funciones` (corrida 43132608358). |
| 69 | Reporte mensual | Resumen, exportar el mes | 🟡 |  | `resultado.test.mjs` (base). Falta un reporte del mes que se pueda mandar: está en la lista Z6 de `PULIDO.md` (otro ayudante). |
| 70 | Asistente de 9 pasos | Primeros pasos (VD-43) | ✅ | BASE-7 | `asistente-pasos.test.mjs`, `primeros-pasos.test.mjs` (base) y `base-7b` 12 pasos (corrida 43128173940): los 9 pasos medidos, vista previa del logo, "Probar conexión" y el cierre. |
