# ESTADO GENERAL de Base (R1, revisión de todo lo pedido, al 12/11)

**Qué es.** La lista única de todas las funciones que pidió Mateo, con su rol o pantalla, la prueba que la cubre y su estado, en tres listas: **1. hecho y publicado**, **2. hecho sin publicar**, **3. falta**. Todo lo de la lista 3 tiene su ítem en `RECTA-FINAL.md` (columna "Ítem"); lo que no lo tenía recibió uno nuevo en la fase Q.

**De dónde sale.** `PEDIDO-ORIGINAL.md` (los 70 detalles, los P0, los P1 y los P2), `AJUSTES-0911-NOCHE.md` (URG, PLAT, EDIT, WEB, ESC, SEG, CAL), `docs/v2/` (todos), `DETALLES-70.md`, `FALTANTES.md`, `SUPER-ADMIN.md`, `PLATAFORMA.md` y la COLA de `docs/HOJA-DE-RUTA.md`. La tabla "Cobertura de las fuentes" del final dice dónde quedó cada una. El detalle por zona de la revisión del 11/11 sigue en `docs/base/estado/` (mostrador, dueño y super admin, socio, profe y público); **donde difiera de este archivo, manda este** (esos tres se escribieron antes del PR #16 y de los cierres de F4/F5/Z).

**Publicado = está en `main`** (`git log origin/main`: PR #14 del 11/11, PR #15 del 11/11 y PR #16 del 12/11, merge `164d21e`), con las migraciones aplicadas en producción según `PROGRESO.md` ("PUBLICADO EL 12/11"). Al 12/11 el código de `main` y el de `base/2026-11-07` son el mismo salvo `scripts/datos/estado-base.mjs`, `humo-pasado-produccion.mjs`, el workflow `base-de-datos.yml` y documentos.

**Estados.** ✅ hecho y probado · 🟡 existe pero incompleto, apagado por defecto o sin prueba de punta a punta (dice qué falta) · ⛔ trabado (dice por qué y quién) · ❌ no existe.
**Marca † en la columna Prueba:** el e2e o la prueba existe (verificado con `ls`) pero **no corrió en la revisión del 11/11**; vale lo que dijo su última corrida (ver `RECTA-FINAL.md` y `PROGRESO.md`). Sin † = corrió en verde en Actions o en la base local en esa revisión o en un cierre posterior que lo registra. Datos: solo el gimnasio demo; Temple Gym no se tocó.

## Resumen

| Lista | Filas | Detalle |
|---|---|---|
| 1. Hecho y publicado | 126 | Mostrador 39, dueño 23, super admin y plataforma 22, socio, profe, kiosco, TV y página 28, transversales 14. De esas, 17 quedan en 🟡 (existen, con algo a medias o apagadas) y además figuran en la lista 3 |
| 2. Hecho sin publicar | 4 | Solo herramientas de diagnóstico y documentos de la rama `base/2026-11-07` (ningún código de producto) |
| 3. Falta | 57 | Cada una con su ítem de `RECTA-FINAL.md` (25 entran por los ítems nuevos Q1 a Q5; el resto por ítems que ya existían). Las 6 filas de 3.5 agrupan 65 ítems de la COLA (los de 🔌 o "decide Mateo" van en 3.1 y 3.4) |

Los 70 detalles de `DETALLES-70.md` se cuentan dentro de las filas de la lista 1 (cada fila nombra los números que cubre): **60 en ✅ y 10 en 🟡** (13, 21, 24, 25, 26, 33, 43, 58, 64, 69), que figuran uno por uno en la lista 3.

---

## 1. Hecho y publicado (en `main` y en producción)

### 1.1 Mostrador: recepción, encargado y dueño en el mostrador

| Función | Rol · pantalla | Prueba | Estado |
|---|---|---|---|
| Buscar por DNI, número, nombre o teléfono, sin tildes ni errores chicos; veredicto a pantalla completa con sonido y Enter/Esc (detalles 1, 9, 10) | los tres · Entrada | `ent-1`, `panel-entrada`, `vd-2`, `busqueda-tolerante.test.mjs` | ✅ |
| Anotar entrada, deshacer, anular desde Hoy con motivo, reingreso; un ingreso repetido en pocos minutos no cuenta doble (10, 11, 12, 17) | los tres · Entrada, Hoy | `panel-entrada`, `vd-3`, `ent-8`, `reingreso-visita.test.mjs` | ✅ |
| Dejar pasar con motivo obligatorio, topes, 3 modos, y "prometieron pagar" (8) | los tres (a un suspendido, dueño o encargado) | `ent-4`, `vd-8`, `dejar-pasar-modos.test.mjs`, `prometieron-pagar.test.mjs` | ✅ |
| Cobrar desde la Entrada con monto sugerido (7), hoja flotante | los tres · Entrada | `ent-9`, `vd-5`, `vd-6` | ✅ |
| Aviso flotante abajo a la derecha (verde, rojo, ámbar, azul), apilado, se va solo, sonido desactivable, y panel lateral con la ficha del socio (4, 5, 6 y 4.3) | los tres · todas las pantallas | `vd-1`, `vd-4`, `base-ingresos` (20 ingresos, mediana 199 ms) | 🟡 falta el e2e de los 4 colores y del atajo `/` (lista 3, F1.1) |
| Ventana F2 en todas las pantallas, barra fija, número que abre la ficha, lector de QR o tarjeta en el mismo campo (2, 3) | los tres | `vd-1`, `vd-1b`, `vd-29` | ✅ |
| Lector USB, cambiar de persona con PIN ("Atiende: Ana"), cierre por inactividad (C5, C6) | recepción | `recepcion-lector`, `caj-3`, `pin-equipo.test.mjs` | ✅ |
| QR del socio (app), tablet en la puerta con QR y aviso en vivo, kiosco | socio, recepción, dueño | `ent-2`, `ent-3`, `ent-6`, `vd-4`, `qr-socio.test.mjs` | ✅ |
| Llavero o tarjeta | dueño, recepción | `ent-7`, `llavero.test.mjs` | ✅ † |
| Invitados y pase de invitado (P2) | recepción | `inv-1`, `invitados.test.mjs` | ✅ † |
| Salida opcional (DNI + S) y "adentro ahora" (12) | recepción | `vd-48`, `salida-opcional.test.mjs` | ✅ |
| Modo emergencia de la puerta | dueño | `vd-46m`, `emergencia-puerta.test.mjs` | ✅ † |
| Prueba gratis con fecha de fin y botón para pasarla a socio (27) | recepción, dueño | `vd-51`, `prueba-gratis.test.mjs` | ✅ † |
| Alta rápida en la ventana en menos de 30 segundos: datos, plan, cobro, entra (14) | los tres | `vd-6`, `alta-rapida.test.mjs` | ✅ |
| Alta completa en 4 pasos, Interesado ofrecido, cobro embebido | los tres · Socios | `soc-13`, `vd-6` | ✅ |
| Ficha en pestañas: pagos, asistencia, notas y etiquetas visibles al validar, foto desde la cámara, apto físico, menores con adulto, familia (15, 17, 20, 21) | los tres · Socios | `soc-2` a `soc-14`, `notas-etiquetas.test.mjs`, `apto-fisico.test.mjs`, `grupo-familiar.test.mjs` | ✅ † |
| Pausas (congelar con tope de días que corre el vencimiento) (28) | recepción pide, dueño o encargado aprueba | `soc-9`, `vd-46w`, `pausas.test.mjs` | ✅ † |
| Baja con constancia, devolución por cuota adelantada, suspender o expulsar | dueño, encargado | `vd-46e`, `vd-46j`, `vd-46b` | ✅ † |
| Importar socios de Excel o CSV: vista previa, errores por fila, 300 filas, "pagó hasta" como cobertura (C2, 38) | dueño, encargado | `soc-1`, `importar-300`, `importar-socios.test.mjs`, `importar-paso-hasta.test.mjs` | ✅ |
| Cargar socios y pagos en el pasado, de a uno y por Excel, sin tocar la caja de hoy (C10, H2) | dueño, encargado | `cargar-pasado` (16 pasos), `cargar-pasado.test.mjs` 9/9 | ✅ |
| Exportar con filtros, filtros con memoria, duplicados, lista de Socios | dueño, encargado | `exportar-filtros`, `soc-4`, `soc-8`, `soc-12`, `vd-15`, `panel-socios` | ✅ |
| Listas de Socios rápidas: `filtros_socios` en lote, 52,6 ms con 5.000 socios (F1.6) | los tres | `filtros-en-lote.test.mjs` (7.440 veredictos iguales), `escala-5000.test.mjs` | ✅ |
| Selección múltiple en Socios y columnas a elección (FA-9) | dueño, encargado | `f45-faltantes` (el envío en tanda no se ejecutó) | 🟡 falta probar el envío en tanda (Q3) |
| Interesados dentro de Socios, con DNI, origen de cada alta y el invitado que queda como interesado (FA-24, N4) | los tres | `vd-15`, `vd-6`, `interesados-dni.test.mjs`, `invitado-interesado.test.mjs`, `origen-socio.test.mjs` | ✅ |
| Turno de caja: abrir, retiro con foto y alerta, cerrar con arqueo ciego, caja olvidada, discriminada por método (36, 37) | recepción, dueño | `caj-1`, `caj-4`, `caj-5`, `vd-9`, `caja.test.mjs`, `caja-olvidada.test.mjs` | ✅ |
| Caja por medio (efectivo, transferencia, tarjeta, MercadoPago) en turno, cierre, X y Z; Transferencias en dos pestañas con "ya la vi en el banco" (H1) | recepción, encargado, dueño | `caja-medios` (49 pasos), `caja-medios.test.mjs` | ✅ |
| "Caja del turno" como número de la recepción, sin plata (arqueo ciego) y botones Cobrar, Alta y Pase diario en Inicio (BASE-4) | recepción, encargado, dueño · Inicio | `caja-del-turno-numero.test.mjs`, `velocidad-a` | 🟡 el e2e `velocidad-a` no corrió (lista 3, F1.3) |
| Efectivo sin turno abierto: abre el turno en la misma hoja (D32) | recepción | `vd-49`, `efectivo-sin-caja.test.mjs` | ✅ † |
| Vender: carrito, productos con stock, cuenta corriente, convenios, cupones, anular, comprobante por WhatsApp (13, 32, 35) | los tres · Vender | `panel-vender`, `ven-1`, `ven-3` a `ven-6`, `com-9`, `vd-18` | ✅ † |
| Doble cobro, descuentos y cortesías con motivo y tope (31) | los tres | `vd-34`, `vd-50`, `vd-46c`, `vd-46t`, `vd-46u`, `doble-cobro.test.mjs` | ✅ † |
| Comprobante de transferencia del socio y "pagué ayer" | recepción, dueño | `vd-46f`, `rev-3`, `chip-transferencia.test.mjs` | ✅ † |
| Vuelto en efectivo y billetes rápidos en Cobrar, con un interruptor único | recepción | `vuelto-cobrar`, `vuelto.test.ts`, `vuelto-y-eventos-apagable.test.mjs` | 🟡 hecho y **apagado por defecto** (toca plata: se prende por gimnasio, Q1) |
| Vencen hoy con pestañas y totales, Vencidos, Por vencer, Prometieron pagar, cobrar desde ahí (18) | los tres | `vd-14`, `vd-13`, `panel-vencen`, `vencen-pestanas.test.mjs` | ✅ |
| Retención: dejaron de venir, por vencer, vencidos y se fueron, con wa.me armado; en riesgo, primer mes, ex socios, plata en riesgo (66, 67) | dueño, encargado | `com-1`, `com-2`, `com-5`, `vd-16`, `vd-46o`, `panel-retencion`, `retencion.test.mjs` | ✅ † |
| Clases en recepción: cancelar avisando, avisar a anotados, lista de espera, grilla y TV, reemplazar profe | recepción, dueño | `cla-3`, `com-3`, `vd-24`, `vd-60`, `vd-46k`, `panel-clases` | ✅ † |
| Mensajes de los socios con contador en el menú, pendientes y campana | recepción, dueño | `vd-38`, `vd-38b`, `vd-37` | ✅ † |
| Cumpleaños de hoy (19) | recepción · Inicio | `cumpleanos.test.mjs`, `cfg-5` | ✅ † |
| Sin internet: mensaje claro, reintento y ningún ingreso perdido (16) | recepción | `sin-internet.test.mjs`, `src/lib/sin-internet.test.ts`, `pulido-roto` | ✅ |
| Para hacer hoy y pendientes del menú (puntito rojo), en menos de 50 ms | los tres | `para-hacer-hoy.test.mjs`, `pendientes-panel.test.mjs`, `pendientes-vieja-vs-nueva.test.mjs` | ✅ |
| Lo roto de PULIDO que pegaba en Temple Gym (H7): lector del kiosco, QR sin señal, avisos que tapaban, Cobrar que no se cierra solo, Abrir caja sin perder el carrito, rol con confirmación, Salir del socio, tema | todos | `pulido-roto` (18), `pulido-roto-2`, `panel-equipo` | ✅ (salida del socio y Dejar pasar/Volvió antes sin prueba: Q3) |

### 1.2 Dueño y encargado

| Función | Rol · pantalla | Prueba | Estado |
|---|---|---|---|
| Inicio: saludo, números del día, accesos elegibles, Para hacer hoy, Primeros pasos, novedades de BRIK, cobrado hoy, plata en riesgo (65, 4.4) | dueño · Inicio | `panel-inicio`, `onb-1`, `adm-6`, `inicio-numeros.test.mjs` | ✅ |
| Resultado del mes: cobrado contra el mes anterior, por concepto, por medio, día por día, horas pico reales (24 horas), deuda, por sede, tasa de cobro (68, 69) | dueño, encargado (la recepción no lo ve) | `res-1`, `rev-dueno-1`, `resultado.test.mjs`, `resultado-por-sede.test.mjs` | ✅ |
| Exportar el mes para el contador (Ventas, Pagos, Caja en CSV) | dueño | `res-2` | ✅ |
| Gastos, presupuesto y ganancia | dueño | `res-3`, `vd-41`, `gastos-presupuesto.test.mjs` | ✅ |
| Control: alertas, línea de tiempo, suspensiones y expulsiones con motivo, alertas por patrón, diferencia de caja por cajero (FA-21, FA-22) | dueño | `vd-10`, `vd-46b`, `alertas-patron.test.mjs`, `alertas-caja.test.mjs` | ✅ † (sin e2e de FA-22: Q3) |
| Equipo: sumar, cambiar rol (con confirmación), sacar acceso, dar de baja, hacer dueño, qué hizo cada uno (40, 41, 44) | dueño | `panel-equipo`, `equ-3`, `vd-42`, `actividad-equipo.test.mjs` | ✅ |
| Permisos por gimnasio (la recepción vende, el encargado ve Resultado) y el profe que busca socios sin plata (51) | dueño | `equ-1`, `equ-2`, `permisos-equipo.test.mjs`, `permisos-por-rol.test.mjs` | ✅ (la matriz editable rol × acción es el detalle 43: lista 3) |
| Configuración: pestañas, buscador, logo y fotos con vista previa, medios de pago, horarios, feriados, mensajes con vista previa, reglas, avisar sin bloquear la primera semana (FA-7), historial de cambios y restaurar, apagar secciones, Eventos apagable | dueño | `panel-configuracion`, `cfg-2` a `cfg-9`, `f9-1`, `f45-faltantes`, `vuelto-y-eventos-apagable.test.mjs` | ✅ |
| Tu página: editor con vista previa al lado, mostrar y ocultar secciones y orden, compartir, Probá una clase, Google (datos estructurados, robots, sitemap), píxel (60, 63) | dueño | `pag-1` a `pag-4`, `web-p8`, `web-p8b`, `panel-pagina`, `com-11` | ✅ |
| Asistente de 9 pasos reanudable, con avance, vista previa de logo y portada y Probar conexión de MercadoPago (4.7, 70) | dueño | `base-7`, `base-7b`, `asistente-pasos.test.mjs` | ✅ (que se abra solo la primera vez, FA-5: lista 3) |
| Planes y precios: trimestral y anual, por horario y días, matrícula, aumento masivo y programado, precio por medio y día, cambio de plan con días a favor, recargo por mora, descuentos (convenios, cupones), orden, servicios (23, 30, 31) | dueño, encargado | `pla-1` a `pla-7`, `panel-planes`, `vd-17`, `recargo.test.mjs`, `aumento-precios.test.mjs` | ✅ |
| Packs de clases que se descuentan al asistir, no al reservar (29) | dueño, recepción | `faltas-pack.test.mjs`, `via-pack-sin-packs.test.mjs`, `cla-4` | ✅ |
| Rutinas y ejercicios; la rutina del socio en su app (50) | dueño, profe | `rut-1`, `rut-2`, `rutinas-completas.test.mjs` | ✅ |
| Clases del lado del dueño: faltas, turnos fijos, cancelar avisando, WOD, grilla (49) | dueño | `cla-1` a `cla-4`, `cla-9`, `panel-clases`, `espera-con-plazo.test.mjs` | ✅ |
| Lista de espera con plazo para aceptar el lugar, calculado al consultar (FA-23) y avisos en la app de la clase reservada y del evento (FA-12) | socio, profe | `espera-con-plazo.test.mjs`, `avisos-app-socio.test.mjs` | ✅ (el push a la hora exacta necesita cron: N3) |
| Foto del profe en el equipo, horas dadas y liquidación (52) | dueño, profe | `vd-44`, `vd-52`, `liquidacion-profes.test.mjs` | ✅ |
| Eventos: crear, anotarse con lugares, check-in | dueño | `com-8`, `vd-19`, `eventos-completos.test.mjs` | ✅ † |
| Lockers, máquinas, grados, documentos para firmar | dueño | `com-4`, `com-6`, `com-13`, `lockers.test.mjs`, `documentos.test.mjs` | ✅ † |
| Ayuda y guías: globos de primera vez, Ctrl+K con preguntas, guías por rol con capturas, carteles para imprimir (C3, C4, C7) | todos | `vd-31`, `vd-63`, `guias-capturas`, `guias-carteles` (57 pasos), `ayuda-brik` | ✅ |
| Botón "¿Necesitás ayuda?" y "Qué hay de nuevo" para el dueño (H6, N6) | dueño, recepción | `ayuda-brik`, `n-nuevas` | 🟡 (N6 con interruptor; ver 1.6) |
| Segunda pasada: una semana entera como dueño y un gimnasio de cada tipo dado de alta | dueño, super admin | `rev-1`, `rev-2`, `rev-5`, `rev-6` | ✅ |
| Lo que se edita se ve al toque en la página y en la app (orden de planes, horarios, clases canceladas, lo del super admin) | dueño | `lo-publico.test.ts` (33 casos), `rev-dueno-1`, `cache-prohibido.test.ts` | ✅ |
| Tipos de gimnasio (CrossFit, funcional, solo máquinas) dados de alta con plantilla (v2/18) | super admin | `rev-5`, `plantillas-gimnasio.test.mjs` | ✅ |
| Resumen del día y del mes para el dueño, con el origen de las altas | dueño | `resumen-dueno.test.mjs`, `origen-socio.test.mjs` | ✅ |

### 1.3 Super admin y plataforma

| Función | Rol · pantalla | Prueba | Estado |
|---|---|---|---|
| Crear gimnasio y dueño con la contraseña que pone el super admin, sin mails, en 3 pasos con plantilla por tipo, accesos listos para WhatsApp y "Probar acceso" (39, EDIT-S01 a S03, URG-01, URG-02) | super admin | `super-p`, `fase-u0-login`, `fase-u1-u2`, `adm-1`, `vd-40`, `login-dueno-nuevo.test.mjs` | ✅ (en producción falta confirmar con la clave de servicio: lista 3, U1 y U0.1) |
| Login universal con la marca del gimnasio, errores honestos con su texto, nunca cae al demo, links por rol `/dueno`, `/recepcion`, `/profe`, `/socio`, `/super` (46, PLAT-02, 03, 07, 08) | todos | `fase-u0-login`, `fase-u02`, `panel-acceso`, `host.test.ts` | ✅ |
| Cada cuenta entra solo a su gimnasio (U3, SEG) | todos | `fase-u3`, `base-aislamiento`, `aislamiento-gimnasios.test.mjs` | ✅ |
| Tablero: números de hoy, "necesitan atención" con su motivo, actividad, errores (SA-1) | super admin | `super-f2`, `vd-40` | ✅ |
| Portada del super admin en secciones | super admin | `super-f2`, `z-diseno` | ✅ |
| Lista de gimnasios: búsqueda, filtros, favoritos, exportar; rápida con 1.000 gimnasios (SA-2, ESC-04) | super admin | `super-f2`, `super-admin`, `f9-admin-escala.test.mjs` | ✅ (paginar: lista 3) |
| Ficha del gimnasio: datos, links por rol, equipo y claves, módulos y límites, abono, integraciones y Reprocesar, dominio, errores, registro, notas (SA-3) | super admin | `super-f2`, `super-f10`, `super-p` | ✅ |
| Resetear contraseña, desactivar, cambiar rol, mover de gimnasio (42, EDIT-S04) | super admin | `super-p`, `super-f2` | ✅ |
| Entrar como soporte con rol, motivo, 60 minutos, aviso al dueño y plata bloqueada; ver la app como un socio (45, SA-4, EDIT-S05) | super admin | `super-f2`, `super-admin`, `soporte-plata-ver-socio.test.mjs` | ✅ |
| Buscar a cualquiera en todos los gimnasios (con motivo) y Ctrl+K (SA-5) | super admin | `super-f2` | ✅ |
| Alta, lista de lanzamiento, pausa, baja con exportación, papelera, borrado definitivo, demos con vencimiento (SA-6, EDIT-S08) | super admin | `super-f2`, `super-f10` | ✅ |
| Plantillas de la plataforma (landing, textos, mensajes) con Restaurar por defecto (EDIT-S07) | super admin | `super-f9`, `plantillas-globales.test.mjs` | ✅ |
| Abono a BRIK: planes, pagos, descuentos, suspensión gradual; novedades a dueños (SA-7, SA-8) | super admin | `adm-3`, `adm-6`, `abono-brik.test.mjs` | ✅ |
| Estado de la plataforma: variables por entorno, base, copias, errores, mantenimiento programado (SA-9, PLAT-06) | super admin | `super-plat`, `super-f11`, `super-f10` | 🟡 falta que Mateo cargue `SUPABASE_REF_ESPERADO` (lista 3, P3) |
| Segundo factor y roles de BRIK, registro de lo que hace cada uno (SA-10, EDIT-S12) | super admin | `super-f2`, `mi-seguridad.test.mjs` | 🟡 escrito y probado; lo activa Mateo en su cuenta (Q5) |
| Datos personales: exportar y borrar los de un socio (SA-11, Ley 25.326) | super admin | `super-f2`, `seg-6`, `topes-y-datos-personales.test.mjs` | ✅ |
| Detalles chicos del super admin (SA-12) | super admin | `super-f2`, `super-f10` | ✅ |
| Dominios desde el super admin por la API de Vercel (PLAT-05) | super admin | `super-plat` con un Vercel simulado, `vercel-dominios.test.ts` | ⛔ en producción espera `VERCEL_TOKEN` y el dominio (lista 3) |
| El mapa de direcciones en el código, listo para el dominio, y las direcciones viejas siguen andando (PLAT-01, PLAT-04, U5) | plataforma | `urls.test.ts`, `host.test.ts`, `urls-sin-hardcode.test.ts` | 🟡 el resto de las direcciones escritas a mano está en EXCEPCIONES (P2) |
| La página del gimnasio es siempre su landing, con lo que tenga (U4, WEB-01 a 05, 59, 61, 62) | visitante | `fase-u4`, `web-p8`, `web-p8b`, `pagina-siempre-landing.test.mjs`, `landing-defaults.test.ts` | ✅ |
| Términos y privacidad por gimnasio desde una plantilla editable, con aceptación y versión (WEB-06, FA-19) | dueño, visitante | `f9-terminos-restaurar.test.mjs`, `vd-62` | 🟡 hecho y apagado por defecto; el texto lo revisa un abogado (Q5) |
| Restaurar un cambio desde el historial de Configuración (EDIT-D04) | dueño | `f9-1`, `f9-terminos-restaurar.test.mjs` | 🟡 no restaura lo que toca plata ni la puerta (decidido por defecto, F9.2) |
| Pool de conexiones, RLS con `(select auth.uid())`, EXPLAIN de 30 funciones con 1.002 gimnasios, 500 usuarios (ESC-01 a 04) | plataforma | `escala-5000.test.mjs`, `escala-limites-monitoreo.test.mjs`, `super-admin-escala.test.mjs` | 🟡 el proxy en caché sin auth no se aplicó (F9.4) |

### 1.4 Socio, profe, kiosco, TV y página pública

| Función | Rol · pantalla | Prueba | Estado |
|---|---|---|---|
| App del socio en 4 pestañas (Inicio, Clases, Rutina, Yo), instalable como PWA (53, 58) | socio | `vd-36`, `dis-12`, `panel-app`, `push-1` | 🟡 instalarla en un celular real es manual (58, lista 3) |
| Estado en grande (semáforo, días, motivo), deuda y fecha de pago, y racha (54) | socio | `panel-app`, `app-7`, `vd-23`, `racha.test.mjs` | ✅ |
| QR que cambia cada 30 s y escanear el QR de la tablet (55) | socio | `ent-2`, `vd-4`, `qr-socio.test.mjs` | ✅ |
| Mi plan: cambiar de plan y comprar pases con días a favor (26, parte) | socio | `vd-39`, `cambio-plan.test.mjs` | ✅ |
| Pagar: transferencia con comprobante, pago online (MercadoPago simulado), "pagué ayer" (57) | socio | `rev-3`, `pay-1`, `vd-46f`, `pagos-online.test.mjs` | ✅ (probado con simulador; con credenciales reales: MP-1 a 3 ⛔) |
| Lo cobrado en el mostrador aparece en la app (historial de pagos y recibo); el historial dice Aprobado, En revisión, Rechazado | socio, recepción | `app-3`, `rev-3`, `vd-56`, `rev-socio`, `recibo-pago.test.mjs` | ✅ |
| Reservar, cancelar, lista de espera, motivo de "no podés reservar", turnos fijos, WOD, lugar numerado, faltas (49, 56) | socio | `vd-24`, `cla-1`, `cla-2`, `cla-4`, `cla-9`, `com-12` | ✅ |
| Clase cancelada avisa al anotado (campana de la app y WhatsApp armado) | recepción, socio | `cla-3`, `avi-5` | ✅ |
| Rutina: anotar kilos, mis marcas, marcar cada serie (FA-15) | socio, profe | `rut-2`, `rev-socio`, `series-hechas.test.mjs` | ✅ |
| Mensajes al gimnasio con foto y respuesta | socio, dueño | `vd-38`, `vd-38b` | ✅ † |
| Pedir pausa y baja con código de constancia (congelar solo, P2) | socio | `app-8`, `vd-46e`, `rev-socio` | ✅ |
| Ocupación en vivo para el socio (P2) | socio | `super-f11`, `ocupacion.test.mjs` | ✅ |
| Clave nueva dada por la recepción y aviso al socio; "Olvidé mi contraseña" sin mails (C1, 53) | recepción, socio | `clave-nueva`, `aviso-clave`, `olvide-socio`, `limite-codigos.test.mjs` | ✅ |
| Hacete socio: `/g/<slug>/hacete-socio` con DNI, el socio cargado reclama su ficha, menores con adulto, QR para anotarse solo y cartel "Anotate acá" (H3, H3b, C9, 61) | visitante, recepción | `hacete-socio-directo`, `socio-flujo`, `socio-flujo-2`, `reg-1`, `qr-alta`, `alta-online.test.mjs` | ✅ (el registro por QR de Temple Gym está apagado: Q5) |
| Notificaciones push: activar, prueba, service worker, manifest con la marca | socio | `push-1`, `push.test.mjs` | ✅ |
| Encuesta, reseña, invitar y referir, eventos, documentos, grados, novedades | socio | `com-10`, `ref-1`, `inv-1`, `com-8`, `com-6`, `com-13`, `app-6` | ✅ † |
| Insignias, resumen del año y recomendación ("hace 10 días que no venís") (FA-14), foto propia con permiso por gimnasio (FA-16), transiciones que respetan `prefers-reduced-motion` (FA-18) | socio | `f45-faltantes`, `f45-foto-socio`, `resumen-app-socio.test.mjs`, `foto-socio.test.mjs` | 🟡 la recomendación no se ejecutó con ese caso (Q3) |
| Mis datos (descargar) y pedir corrección o borrado (Ley 25.326) | socio | `seg-6` | ✅ |
| Panel del profe: sus clases del día, anotados, asistencia en un toque, avisar a anotados, reemplazo (47, 48) | profe | `rev-4`, `panel-clases`, `vd-46k` | ✅ |
| El profe no ve plata ni otros gimnasios; busca socios sin teléfono (51) | profe | `base-aislamiento`, `equ-2`, `profe-busca-socios.test.mjs` | ✅ |
| Fichar entrada y salida con PIN, horas del mes y liquidación (52) | profe | `vd-53`, `vd-52`, `fichaje-equipo.test.mjs` | ✅ |
| Kiosco: tablet autorizada por link, DNI, QR de pared y habituales (P2) | kiosco | `ent-3`, `ent-6`, `com-7`, `kiosco.test.mjs` | ✅ |
| TV de la sala (clase de ahora con anotados y WOD) y TV de entradas (P2) | TV | `com-14`, `vd-60`, `super-f11`, `tv-sala.test.mjs` | 🟡 consulta cada 15 s; el en vivo por Realtime falta (F3.2) |
| Horarios de la landing y eventos con lugares; grilla de clases; reseñas | visitante | `fase-u4`, `com-8`, `vd-25`, `landing.test.mjs` | ✅ |
| Probá una clase (prueba gratis, una vez por DNI) | visitante | `pag-3`, `vd-51` | ✅ |
| Política de privacidad por gimnasio, páginas de error y esqueletos propios | visitante | `vd-62` | ✅ |
| `/estado` público: si la base responde, sin datos de nadie (FA-20) | visitante | `f45-faltantes` | ✅ |
| Mensajes por wa.me (comprobante, cierre de caja, retención, avisar a anotados, compartir página) | recepción, dueño | `ven-1`, `veh-1`, `avi-1`, `pag-2`, `whatsapp.test.ts` | ✅ |

### 1.5 Transversales: velocidad, seguridad, diseño y fluidez

| Función | Rol · pantalla | Prueba | Estado |
|---|---|---|---|
| El estado de acceso se calcula en una sola función; `cubierto_hasta` guardado y verificado (BASE-1, BASE-5) | plataforma | `acceso.test.mjs`, `cubierto-hasta.test.mjs`, `retencion-cubierto.test.mjs` | ✅ |
| Un solo viaje para el contexto de cada pantalla (`contexto_pantalla`) y menú después de pintar en menos de 50 ms (F0.2, F0.3) | todos | `contexto-pantalla.test.mjs`, `pendientes-panel.test.mjs` | 🟡 faltan caché por gimnasio (decidido que no) y verlo en producción (F0.2) |
| Registrar un ingreso con 5.000 socios en menos de 1 segundo (mediana 199 ms) | recepción | `base-ingresos`, `escala-5000.test.mjs` | ✅ (la simulación completa con tope de 1 s es F8.1) |
| Seguridad: RLS por rol, topes en "Olvidé" y formularios públicos, anti-robot, cabeceras, Ley 25.326, contraseñas demo no débiles (4.8, BASE-8, SEG-01 a 07) | todos | `base-8`, `seg-1`, `seg-2`, `seg-5`, `seg-6`, `topes-y-datos-personales.test.mjs`, `envio-publico.test.ts` | ✅ |
| Auditoría: quién cobró, anuló, dejó pasar, creó o desactivó (44) | dueño | `actividad-equipo.test.mjs`, `vd-10`, `vd-42` | ✅ |
| Webhook de MercadoPago idempotente, con firma verificada, fuera del proxy, con conciliación (34) | plataforma | `mp-procesar.test.ts`, `pagos-online.test.mjs`, `mercadopago-devoluciones.test.mjs` | ✅ (simulador; con credenciales reales: MP-1 a 3 ⛔) |
| Diseño: íconos de línea (`Icono`), Barlow, tokens claro/oscuro, tema por usuario, menú en 4 secciones, títulos de 28 px, contraste (BASE-6, Z2, Z5) | todos | `barrido-tema`, `z-diseno`, `vd-11`, `dis-3`, `iconos-en-pantallas.test.ts`, `Icono.test.ts` | 🟡 faltan emojis y colores de otros carriles y los modales (F1.4) |
| Fluidez: Esc y atrás, cambios sin guardar frenan el menú, aviso a los 10 s, borrador en plan, rutina y evento, error junto al campo, red lenta (Z3, F3.2) | todos | `fluidez-reglas` (93 pasos), `fluidez-pantallas.test.ts`, `borrador.test.ts` | 🟡 lo que falta de las 21 reglas (F3.2) |
| Cada botón de cada pantalla por rol, compu y celular: 0 hallazgos graves (F3.1) | los 6 roles | `botones.mjs`, `barrido` | ✅ |
| Next 16.4 y React 19.3: sin acciones colgadas en "Guardando…" (VD-64) | todos | `scripts/diag/accion-colgada.mjs`, `package.json` | ✅ |

---

## 2. Hecho sin publicar (en `base/2026-11-07`, no en `main`)

Ningún código de producto: lo de producto entró todo con el PR #16. Queda en la rama esto, que se publica solo con el próximo PR:

| Función | Rol | Prueba | Falta publicar |
|---|---|---|---|
| Estado de la base: diagnóstico de por qué el alta de Temple Gym no abría y qué funciones nuevas están prendidas en gimnasios reales (solo booleanos y claves) | Mateo, agente (Actions) | `scripts/datos/estado-base.mjs`, corrida 43297648610 | `scripts/` y `base-de-datos.yml`, sin migración |
| Acción `humo-pasado`: alta con fecha y pago pasados y caja por medio en el demo, dentro de una transacción que revierte | agente (Actions) | corrida 43300000883 (1 pago, 1 cobertura, caja del turno sin moverse, nada queda) | `scripts/datos/humo-pasado-produccion.mjs` |
| `PREVENCION.md` (qué se puede romper y no publicar en hora pico) y la fase D de dominios en `RECTA-FINAL.md` | agente | revisión de lectura | Solo documentos |
| Esta revisión R1 y R2: `ESTADO-GENERAL.md`, fase Q en `RECTA-FINAL.md` y las marcas "Reemplazado por" en los MD viejos | agente | `ls` de cada prueba citada | Solo documentos |

---

## 3. Falta

Cada fila dice su ítem en `RECTA-FINAL.md`. Los ítems **Q1 a Q5 son nuevos** (agregados por esta revisión, con su LISTO SI); el resto ya existía.

### 3.1 Plata y permisos que esperan a Mateo (ítem Q1, ⛔ decide Mateo)

Todas están en `PREGUNTAS.md` con la opción más segura, y **no se cambiaron** (regla de `CLAUDE.md`: lo que toca permisos o plata no se arregla solo).

| Función | Rol | Estado | Ítem |
|---|---|---|---|
| Pase diario en dos toques, también para quien no es socio (detalle 13) | recepción | ⛔ cobro nuevo | Q1 |
| Estado de cuenta único con cargos, pagos y saldo en la ficha (21) | recepción, dueño | ⛔ hay que definir qué es el saldo | Q1 |
| Pagos parciales de una cuota (24) | recepción | ⛔ cambia cómo se cobra | Q1 |
| Renovar en un toque (25): hoy son dos pasos porque confirmar muestra el total | recepción | ⛔ plata | Q1 |
| Cambio de plan "desde el próximo período o prorrateado", configurable (26) | dueño | ⛔ cambia cómo se cobra | Q1 |
| Link de MercadoPago por socio con monto exacto y vencimiento desde el panel (33) | recepción, dueño | ⛔ plata y credenciales (🔌) | Q1 |
| Matriz de permisos editable rol × acción (43) | dueño | ⛔ permisos | Q1 |
| Aprobar transferencia comparando con lo que debía y deshacer 5 s; cerrar caja con confirmación del monto contado | encargado, dueño, recepción | ⛔ plata | Q1 |
| Crear un plan valida la matrícula antes; quitar un gasto con Deshacer | dueño | ⛔ plata | Q1 |
| El panel reconoce al soporte por `equipo.es_soporte` y no por el nombre; "Entrar como soporte" con rol Encargado; el profe ve una clase como ajena por `profe_id` y no por el nombre | super admin, profe | ⛔ permisos (cada una pide una migración que reemplaza una función con permisos) | Q1 |
| Prender el vuelto en efectivo, billetes rápidos y el cupón en el alta online | recepción | ⛔ decide Mateo cuándo, por gimnasio | Q1 |
| Decisiones de la COLA marcadas "decide Mateo": REF-2 (premio del referido), REV-1d (la recepción carga mercadería), COM-6b ("falta firmar" frena la entrada), COM-8b (Vender frena un evento lleno), COM-9b (cupón sobre el tope) | dueño | ⛔ permisos y plata | Q1 |

### 3.2 Funciones del dueño y del mostrador que no existen o están a medias

| Función | Rol | Estado | Ítem |
|---|---|---|---|
| Retención: "Avisar a todos" con tope y registro de contacto, exportar, y que Altas, Bajas, En riesgo y Socios al día lleven a su lista | dueño | ❌ | Q2 |
| Tareas: editar, borrar y cortar una tarea que se repite todos los días | dueño | ❌ (`tareas/acciones.ts` solo crea y tilda) | Q2 |
| Mensajes: "ver más" después de los 100 | dueño | ❌ | Q2 |
| Reporte mensual para compartir (69), comparación con el año pasado, metas, vistas guardadas | dueño | ❌ | Z6 |
| Super admin: ingreso mensual de BRIK y cohortes, notas por gimnasio en la lista, "ver como el dueño" de solo lectura | super admin | ❌ | Z6 |
| Mostrador: lista Hoy que avisa que corta en 40 y Anular con confirmación, foto en "Entró" por QR o llavero, ticket en impresora térmica, alias y CBU al elegir Transferencia, cuenta regresiva de "se cierra sola", transferencias con miniatura | recepción | ❌ | Z6 |
| Panel lateral del socio con foto, Reintentar si falla y "Ver la ficha completa" sin recargar | recepción | ❌ | Z6 |
| Paginar Retención y `/admin/gimnasios` (y "← Gimnasios" que vuelve a la lista con sus filtros) | dueño, super admin | ❌ | Z6 y F9.6 |
| Panel lateral "cuándo le toca pagar, desde cuándo debe, qué plan pagaría" (FA-1) | recepción | 🟡 hecho y apagado por defecto (función nueva "Más datos en el panel del socio") | F5.1 y N5 |
| La fila de las últimas entradas abre el panel lateral y no la ficha (FA-2) | recepción | 🟡 | F5.1 |
| El asistente de 9 pasos se abre solo la primera vez (FA-5) y tiene el paso de "avisar sin bloquear" (FA-7) | dueño | ❌ | F5.1 |
| Listas virtualizadas en Socios, Vencen y Control (FA-6) | los tres | ❌ | F5.1 |
| Interesado sin contactar en 24 h en Para hacer hoy y la campana (FA-13) | recepción, dueño | ❌ (hay que reemplazar `privado.para_hacer_hoy_con` partiendo de la definición vigente) | F5.1 |
| Tasa de cobro también en Inicio (FA-10) y diferencia por cajero también en Control (FA-21) | dueño | 🟡 | F5.1 |
| Borrador del alta de socio prendido (hoy apagado) y borrador en la configuración de la página (FA-17) | recepción, dueño | 🟡 | F3.2 y F5.1 |
| Vidrio, sombras grandes, degradé y esquinas de 16 px fuera (FA-4) | todos | ⛔ del pulido | Z5 |
| Detalles de `PULIDO.md` sin hacer: [ROTO], [FLUIDEZ], [TEXTO] y [DISEÑO] restantes y lo transversal (formatos y avisos pantalla por pantalla, aviso de versión nueva) | todos | 🟡 | Z1, Z3, Z4, Z5, Z7 |
| Tema claro u oscuro guardado en la base pero el panel solo lee la cookie; emojis y colores sueltos de otros carriles | todos | 🟡 | F1.4 |

### 3.3 Lo que existe sin prueba de punta a punta o sin correr

| Función | Rol | Estado | Ítem |
|---|---|---|---|
| E2e de los 4 colores del aviso y del atajo `/` (F1.1); `velocidad-a` escrito sin correr (F0.4, F1.3) | recepción | 🟡 | F1.1, F0.4 y F1.3 |
| Selección múltiple con envío en tanda (FA-9), lista de anotados con foto (FA-11), recomendación del Inicio (FA-14), alertas por patrón (FA-22), invitado como interesado (FA-24), salida del socio, Dejar pasar y Volvió antes: sin e2e propio | varios | 🟡 | Q3 |
| Las pruebas marcadas † de las listas 1.1 a 1.4: existen y su última corrida es de antes de la revisión del 11/11 | varios | 🟡 | R3 |
| `n-nuevas`: `RECTA-FINAL.md` lo da verde (corridas 43137752579 y 43138182427) y `PROGRESO.md` del 12/11 dice que no pasaba al publicar; por eso la fase N está apagada para Temple Gym | dueño | 🟡 | N5 |
| Celular: la ficha del socio desborda 2 px (392 > 390) en 1 de 4 corridas de `vd-15`; 12 saltos de diseño (CLS) en celular | recepción, dueño | 🟡 intermitente | R3 y H4 |
| Realtime entre compus: campana, TV de entradas y de la sala, lo que cambia en una compu aparece en las otras | todos | ❌ | F3.2 y R3 |
| Reglas 4, 10, 12 y 13 de `FLUIDEZ.md` sin revisar pantalla por pantalla; regla 18 sin probar en un teléfono real | todos | 🟡 | F3.2 |
| Botones en producción en modo mirar con la configuración real de Temple Gym | todos | 🟡 | H4 |
| La simulación completa con 5.000 socios y tope de 1 s, la cadena e2e completa y el barrido, el humo en producción por rol, `PRUEBA-DUENO.md` y "LISTO PARA TU PASADA" | todos | ❌ | F8.1 a F8.5 y R3 |
| Prueba de las direcciones de los QR y links ya compartidos después de cada publicación; lo de `PREVENCION.md` que es del agente | plataforma | ❌ | D3 y D4 |
| Medir en producción (`Server-Timing`, `medir-produccion.yml`) y la meta de velocidad (LCP menor a 1,5 s, Lighthouse 95) | plataforma | ❌ (script escrito, ⛔ faltan secretos) | F0.1 y F0.5 |

### 3.4 Lo que depende de cuentas, secretos y decisiones de Mateo (ítem Q5, y los ítems ⛔ que ya existían)

| Función | Rol | Estado | Ítem |
|---|---|---|---|
| Secretos de GitHub: `COPIA_CLAVE` (copia cifrada antes de cada `aplicar`), `BRIK_ADMIN_MAIL` y `BRIK_ADMIN_CLAVE` (humo en producción), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_CONTRASENA` | plataforma | ⛔ Mateo | H5, C8, U0.3, F0.1 |
| `SUPABASE_SERVICE_ROLE_KEY` correcta en Vercel y confirmar en producción que crear un gimnasio y entrar por las 3 puertas anda | super admin | ⛔ Mateo | U1 y U0.1 |
| `SUPABASE_REF_ESPERADO` y las claves asimétricas de Supabase | plataforma | ⛔ Mateo | P3 y F0.6 |
| Dominio (`VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, DNS) y dominio propio de Temple Gym (64) | plataforma | ⛔ Mateo | P9, D1, D2 |
| Segundo proyecto de Supabase "ensayo" | plataforma | ⛔ Mateo | N0 |
| Supabase Pro para restaurar copias y mirar los asesores | plataforma | ⛔ Mateo | F9.7 y F9.4 |
| Factura electrónica ARCA, molinete o cerradura, Wellhub y TotalPass | dueño | ⛔ hardware o cuenta (🔌) | N7, N8, COM-16, COM-17, ENT-5 |
| Débito automático y pago de la cuota con credenciales reales de MercadoPago, MP-1 a MP-3, devoluciones y contracargos | dueño, socio | ⛔ credenciales del gimnasio (🔌) | N1 y Q5 |
| Mails automáticos, resumen diario por mail, WhatsApp oficial, Google para el ingreso, reseñas de Google, Sentry, Turnstile | todos | ⛔ cuentas externas (🔌: AVI-2, AVI-3, AVI-4, VD-22B, VD-25C, VD-45, VD-45B, VD-45C) | F9.6 y Q5 |
| Push de las 22 h con el resumen de la noche (necesita un disparador por hora) | dueño | ⛔ sin cron | N3 |
| Activar el segundo factor de su cuenta de super admin; prender `altas_online` en Temple Gym (hoy el QR impreso dice "Hoy no te podés anotar desde acá"); prender las funciones nuevas en Temple Gym después del ensayo; revisar con un abogado el texto de términos; instalar la PWA en un celular real | Mateo | ⛔ decisión o acción suya | Q5 |

### 3.5 Cola residual de `HOJA-DE-RUTA.md` (ítem Q4)

La COLA tiene unos 100 ítems todavía sin tildar (65 en esta tabla, el resto de 🔌 o "decide Mateo" en 3.1 y 3.4). **No se verificó cada uno contra el código** (lo dice la marca de la COLA, que puede estar vieja: varios ya se hicieron en la fase U a F9, como el segundo factor VD-33D y VD-42B/C en SA-10, VD-40B en la lista de super admin, VD-30B en F0.3, VD-64 con Next 16.4, VD-62 y VD-63 en el cierre de la página). El ítem Q4 los reconcilia: cada uno se verifica, se tilda con su prueba o queda ⛔ con el motivo.

| Grupo | Ítems de la COLA | Estado | Ítem |
|---|---|---|---|
| Caja y cobro: pruebas y detalles | VD-5C, VD-6C, VD-7B, VD-7C, VD-7D, VD-8B, VD-9B, VD-9C, VD-9D, VD-9E, VD-3B, VD-4B, VD-29B, VD-29C, VD-29D | ❌ | Q4 |
| Dueño: Control, Retención, Resultado, Configuración | VD-10B, VD-16C, VD-18B, VD-41B, VD-41C, VD-41D, VD-42D, VD-21B, VD-21C, VD-43B, VD-43C, VD-28B, VD-28C, VD-28D, VD-31B, VD-15B | ❌ | Q4 |
| Avisos y app del socio | VD-13B, VD-13C, VD-13D, VD-37B, VD-37C, VD-37D, VD-38C, VD-39B, VD-22C, VD-22D, VD-44B, VD-44C, VD-20B, VD-46N2, VD-46O2 | ❌ | Q4 |
| Clases, eventos y página | VD-24B, VD-25B, VD-25D, VD-19B, VD-26B, VD-TRI1 | ❌ | Q4 |
| Plan familiar, MercadoPago y seguridad | VD-46G2, VD-46G3, VD-46G4, VD-46S, VD-46V, VD-46W2, VD-46X, VD-46Y, VD-46Z, VD-33E, VD-33F | ❌ | Q4 |
| Revisiones abiertas | VD-32 (segunda pasada v2), VD-59 (las 40 consultas de `CHE-ME-PASO.md`) | ❌ | Q4 |

---

## Cobertura de las fuentes

| Fuente | Dónde quedó |
|---|---|
| `PEDIDO-ORIGINAL.md` §4.1 a 4.9 (velocidad, usuarios, ingreso rápido, lo que se ve siempre, landing, panel del socio, asistente, seguridad) | 1.1, 1.2, 1.3, 1.4 y 1.5 (cada fila nombra su apartado) |
| `PEDIDO-ORIGINAL.md` §5 (diseño) y §8 (simulación completa) | 1.5 y 3.3 (F8.1) |
| `PEDIDO-ORIGINAL.md` §6, los 70 detalles | `DETALLES-70.md` fila por fila; en este archivo, los números entre paréntesis de las listas 1.1 a 1.4; los 10 en 🟡 en 3.1, 3.4 y 3.2 |
| `PEDIDO-ORIGINAL.md` §7 (P2: TV, invitado, ocupación, congelar solo, modo "tengo que cobrar", kiosco) | 1.1 (Invitados, Vencen hoy), 1.4 (Ocupación, Pedir pausa, Kiosco, TV) |
| `AJUSTES-0911-NOCHE.md`: URG-01 a 04, PLAT-01 a 08, EDIT-S01 a S12, EDIT-D01 a D06, WEB-01 a 06, ESC-01 a 08, SEG-01 a 07, CAL-01 a 08 | 1.3 y 1.5; lo pendiente (PLAT-05, ESC-07, CAL-07 humo en producción) en 3.4 |
| `docs/v2/00` a `21`: entrada, cobros y caja, dueño, recepción, socio, página, diseño, plan, inspiración, super admin, ingreso, notificaciones, confiabilidad, situaciones (VD-46), rapidez, sección por sección, dominio y negocios, semana de prueba, lo que falta (VD-48, VD-49), pedidos del 07/11 (VD-61 a VD-63) | 1.1 a 1.5; `14-SITUACIONES` y `17-SECCION-POR-SECCION` en 3.5 (VD-46, VD-59) |
| `DETALLES-70.md` | 60 en ✅ en 1.x, 10 en 🟡 en 3.x |
| `FALTANTES.md` (FA-1 a FA-24) | hechos: FA-3, 8, 9, 12, 14, 15, 16, 18, 20, 23, 24 en 1.x; a medias o grandes: FA-1, 2, 4, 5, 6, 7, 10, 13, 17, 19, 21, 22 en 3.2 y 3.4; FA-11 en 3.3 |
| `SUPER-ADMIN.md` (SA-1 a SA-12) y `PLATAFORMA.md` (PLAT-01 a 08) | 1.3 |
| COLA de `docs/HOJA-DE-RUTA.md` (los `[x]` en 1.x; los `[ ]` en 3.5 y 3.1) | 1.x, 3.1 y 3.5 |

## Lo que no se pudo verificar

- **Ninguna prueba se volvió a correr para este archivo.** Se verificó con `ls` que cada archivo de prueba citado existe en `scripts/e2e/`, `supabase/pruebas/` o `src/`; el verde de cada una es el que registran `RECTA-FINAL.md`, `PROGRESO.md` y los tres archivos de `docs/base/estado/`.
- **La COLA de la HOJA-DE-RUTA no se reconcilió ítem por ítem**: es el trabajo del ítem Q4.
- **Producción:** lo de "en producción" es lo que dice `PROGRESO.md` del 12/11 (migraciones aplicadas con la corrida 43295889879, funciones nuevas apagadas en Temple Gym, corrida 43297648610); no se consultó la base real desde esta revisión.
- Las capturas de compu y celular de lo nuevo no se miraron en esta revisión.
