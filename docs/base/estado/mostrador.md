# Estado de la zona Mostrador (revisión del 11/11, rama `carril/rev-mostrador`)

> **12/11:** las tres listas vigentes (publicado, sin publicar, falta) están en `docs/base/ESTADO-GENERAL.md`; este archivo es el detalle de la revisión del 11/11 y, donde difiera, manda `ESTADO-GENERAL.md` (se escribió antes del PR #16 y de los cierres de F4, F5 y Z).

Zona: Entrada, Caja (turno, cierre, X/Z, ventas, transferencias), Vender, Socios (alta, ficha, pagos, pausas, bajas, importar, Interesados), clases en recepción, Retención, Vencen hoy y Mensajes. Roles: recepción, encargado y dueño en el mostrador.

Cómo se leyó: cada función contra `FLUIDEZ.md` (21 reglas), `DISENO.md` y `PULIDO.md` (bloque mostrador), mirando el código y la prueba que la cubre. **Una prueba solo cuenta como verde si corrió en Actions sobre esta rama** (ids abajo); las demás dicen "e2e escrito" y valen lo que dijo su última corrida en `RECTA-FINAL.md`. Datos: solo el gimnasio demo (Temple Gym no se tocó).

Corridas de esta revisión (workflow `pruebas-completas`, pantallas, app en producción): `43114662694` (línea base: ent-1, ent-2 y vd-6 rojos), `43116320230` (ent-2 y vd-6 x3 en verde), `43117762536`, `43119310633`, `43120361066`, `43121165535` (ver "Resultado de las corridas").

## Arreglado en esta revisión

| Qué | Causa | Cómo se verificó |
|---|---|---|
| `ent-2` "no hay QR en la app" | La prueba contaba los `svg` dentro del bloque del QR; desde que el título lleva un ícono (`<Icono>` es un svg) eran 2. La app mostraba el QR bien | `ent-2` 8 pasos en verde, corrida 43116320230 |
| `ent-1` elegía un homónimo al día en vez del rojo | La prueba buscaba por nombre y Enter elige el primero: "Agustina Ejemplo" hay varias (unas al día, otras vencidas). El demo no tiene DNI, así que identifica por **número de socio** (único, la búsqueda de la Entrada lo entiende) y elige con Enter solo si es el primero, si no con un clic en su fila | `ent-1` 10 pasos en verde, corrida 43117762536 |
| `vd-6` intermitente (el paso Plan sin tarjetas, o el segundo F2 que no encontraba a nadie) | Causa raíz: Next **aborta el pedido de servidor que está en vuelo** si en ese momento se refresca la pantalla. Lo refrescaba `RefrescarAlEntrar` (cada evento de entrada en vivo hacía un `router.refresh()` sin juntarlos) y el cierre de la hoja de cobro. Una búsqueda o `planesParaAlta` caía justo ahí y quedaba sin respuesta. El reintento anterior tapaba el síntoma solo para los planes | (a) `leerConReintento` (`src/lib/panel/lectura.ts`, con prueba) repite las lecturas abortadas: buscar socio y planes del alta, en la ventana y en la pantalla Entrada; si fallan las 3 veces lo dicen en pantalla; (b) los refrescos por entrada en vivo se juntan en uno (700 ms). `vd-6` 20/20 pasos tres veces seguidas en la corrida 43116320230 (antes fallaba 3 de 5) |
| Rojo sin ícono en el veredicto, la ventana y los avisos; botón flotante vacío; "✕" y "✓" de texto | Al sacar los emojis quedaron íconos `""`. Ahora ok / alerta / prohibido / ayuda / puerta / cerrar | Corridas 43117762536: vd-1, panel-entrada, vd-4 (los pasos del aviso verde) |
| Los avisos de abajo a la derecha tapaban el botón de Entrada y la barra fija (D56) | Posición fija `bottom-4 right-4` | Ahora arriba del botón y a la izquierda de la barra (como dice `DISENO.md`); verificado en vd-1 (el botón se usa), sin captura revisada a mano |
| Tipear un nombre con "S" con el veredicto abierto marcaba la salida | Atajo S de `Puerta.tsx` | Sacado (queda el botón Salida y DNI + S en el campo, `vd-48` verde) |
| "No encontramos… Darlo de alta" aparecía antes de buscar; una búsqueda vieja pisaba a la nueva; el error de un botón quedaba escondido detrás del veredicto | `Puerta.tsx` | "Buscando…" mientras llega la respuesta, respuestas viejas descartadas, el error se ve dentro del veredicto. Corrida 43117762536: panel-entrada y vd-1 en verde |
| "Darlo de alta" no llevaba lo escrito | Faltaba `?dni=` y `?nombre=` | La pantalla Entrada y la lista de Socios lo mandan y `/panel/socios/nuevo` lo pone en el formulario. Sin e2e propio (solo lo cubre vd-6 por la ventana) |
| Entradas y salidas de plata sin signo; "Día siguiente" en el futuro | Los signos quedaron `""` | Ícono más/menos y la palabra para lector de pantalla; el botón ya no sale si el día es hoy |
| Textos: "Hoy es su último día cubierto" sin vencimientos; "Le prometieron pagar" vs "Prometieron pagar"; "Hacete socio" en la pantalla de la recepción; códigos `entro`, `forzado`, `mercadopago` en el panel lateral | | Etiquetas de Hoy y de Turno; vd-8 en verde |
| Últimas entradas de Inicio: Cobrar llevaba a Vender (FA-2) y el rechazado sin ícono | | Abre la hoja Cobrar (el mismo botón que usa la Entrada, sin cambiar nada del cobro); `vd-12b` actualizado |
| `caj-1`, `vd-14`, `vd-4`, `vd-12` y `vd-12b` rojos por pruebas viejas, no por la pantalla | caj-1 esperaba el mensaje de WhatsApp sin el emoji inicial; vd-14 esperaba 4 pestañas (hay 5) y un solo Guardar; vd-4 daba el DNI a "Testigo Pack Vencido" (salía primero al buscar "Testigo Vencida") y esperaba un rechazo de otro socio; vd-12 esperaba el globito del menú (cerrado en celular); vd-12b esperaba que Cobrar fuera a Vender | Pruebas al día con la pantalla: caj-1, vd-14 (corrida 43119310633), vd-4 (11 pasos), vd-12 (16 pasos), vd-12b (10 pasos) y vd-15 (corridas 43120361066 y 43121165535) |

## 1. Hecho y publicado (en `main`)

"Prueba" = e2e (`scripts/e2e/`) o prueba de base (`supabase/pruebas/`). Estado: **verde hoy** = corrió en esta revisión; **e2e escrito** = existe y se corrió antes, no en esta revisión.

| Función | Rol | Prueba | Estado |
|---|---|---|---|
| Buscar por DNI, número, nombre; veredicto a pantalla completa con sonido y Enter/Esc | recepción, encargado, dueño | `ent-1`, `panel-entrada`, `vd-2` | ent-1 y panel-entrada verde hoy |
| Anotar entrada, deshacer, anular desde Hoy con motivo, reingreso | los tres | `panel-entrada`, `vd-3`, `ent-8` | panel-entrada verde hoy |
| Dejar pasar (motivos, topes, 3 modos) y "prometieron pagar" | los tres (a un suspendido solo dueño/encargado) | `ent-4`, `vd-8`, `dejar-pasar-modos.test.mjs` | vd-8 verde hoy |
| Cobrar desde la Entrada (hoja flotante) | los tres | `ent-9`, `vd-5`, `vd-6` | vd-6 verde hoy |
| Ventana F2 en todas las pantallas, barra fija, número que abre, lector | los tres | `vd-1`, `vd-1b`, `vd-29` | vd-1 verde hoy |
| QR del socio (app) + lector USB + cámara | socio, recepción | `ent-2`, `qr-alta` | ent-2 verde hoy |
| Tablet en la puerta, QR de la tablet, aviso en vivo | dueño, recepción | `ent-3`, `ent-6`, `vd-4` | vd-4 verde hoy |
| Llavero o tarjeta | dueño, recepción | `ent-7` | e2e escrito |
| Invitados y pase de invitado | recepción | `inv-1` | e2e escrito |
| Salida opcional (DNI + S) | recepción | `vd-48` | verde hoy |
| Modo emergencia de la puerta | dueño | `vd-46m`, `emergencia-puerta.test.mjs` | e2e escrito |
| Prueba gratis | recepción, dueño | `vd-51` | e2e escrito |
| Alta rápida en la ventana (datos, plan, cobro, entra) | los tres | `vd-6`, `alta-rapida.test.mjs` | verde hoy (3 corridas) |
| Alta completa en 4 pasos, Interesado ofrecido, cobro embebido | los tres | `soc-13`, `vd-6` | verde hoy |
| Ficha en pestañas, pagos, asistencia, notas y etiquetas, foto, apto, menores, familia | los tres | `soc-2` a `soc-14` | e2e escrito |
| Pausas (congelar) con motivo | recepción pide, dueño/encargado aprueba | `soc-9`, `vd-46w` | e2e escrito |
| Baja con constancia, devolución por cuota adelantada, suspender o expulsar | dueño, encargado | `vd-46e`, `vd-46j`, `vd-46b` | e2e escrito |
| Importar socios (CSV con errores por fila, 300 filas) | dueño, encargado | `soc-1`, `importar-300` | soc-1 verde hoy |
| Exportar, filtros con memoria, duplicados, lista de Socios | dueño, encargado | `soc-4`, `soc-12`, `vd-15`, `soc-8`, `panel-socios` | vd-15 verde hoy (ver nota del desborde) |
| Interesados dentro de Socios, con DNI | los tres | `vd-15`, `vd-6` | vd-6 y vd-15 verde hoy |
| Turno de caja: abrir, retiro con foto y alerta, cerrar con arqueo ciego, caja olvidada | recepción, dueño | `caj-1`, `caj-4`, `caj-5`, `vd-9`, `caja.test.mjs`, `caja-olvidada.test.mjs` | caj-1, caj-5, vd-9 verde hoy |
| PIN del equipo y cambio de cajero | recepción, encargado | `caj-3` | e2e escrito |
| Efectivo sin turno abierto: abre el turno en la misma hoja | recepción | `vd-49` | e2e escrito |
| Vender (carrito, productos con stock, cuenta corriente, convenios, cupones, anular, comprobante por WhatsApp) | los tres | `panel-vender`, `ven-1`, `ven-3` a `ven-6`, `com-9`, `vd-18` | panel-vender verde hoy; el resto e2e escrito |
| Doble cobro, descuentos y cortesías con motivo y tope | los tres | `vd-34`, `vd-50`, `vd-46c`, `vd-46t`, `vd-46u`, `doble-cobro*.test.mjs` | e2e escrito |
| Comprobante de transferencia del socio y "pagué ayer" | recepción, dueño | `vd-46f`, `rev-3`, `chip-transferencia.test.mjs` | e2e escrito |
| Vencen hoy con pestañas y totales, Vencidos, Por vencer, Prometieron pagar, cobrar desde ahí | los tres | `vd-14`, `vd-13`, `panel-vencen` | vd-14 verde hoy |
| Retención: en riesgo, números, primer mes, ex socios | dueño, encargado | `com-1`, `com-2`, `com-5`, `vd-16`, `vd-46o`, `panel-retencion` | e2e escrito |
| Clases en recepción: cancelar avisando, avisar a anotados, lista de espera, grilla y TV, reemplazar profe | recepción, dueño | `cla-3`, `com-3`, `vd-24`, `vd-60`, `vd-46k`, `panel-clases` | e2e escrito |
| Mensajes de los socios (contador en el menú), pendientes y campana | recepción, dueño | `vd-38`, `vd-38b`, `vd-37` | e2e escrito |

## 2. Hecho sin publicar (en `base/2026-11-07`, no en `main`, o solo en esta rama)

| Función | Rol | Prueba | Falta publicar |
|---|---|---|---|
| Caja por medio (efectivo, transferencia, tarjeta, MercadoPago) en turno, cierre, X y Z; Transferencias en dos pestañas con "ya la vi en el banco" (H1) | recepción, encargado, dueño | `caja-medios` (49 pasos verde hoy, y 43112368221), `caja-medios.test.mjs` | Migración `20261111162300_caja_cobros_por_medio.sql` y código |
| Cargar socios y pagos en el pasado, alta de a uno y Excel (C10), sin tocar la caja de hoy | dueño, encargado | `cargar-pasado`, `cargar-pasado.test.mjs` | Migración `20261111150100_cargar_pasado.sql` y código |
| Lector USB en la Entrada, cambiar de persona con PIN, cierre por inactividad (C5, C6) | recepción | `recepcion-lector` | Migración `20261111120000_recepcion_inactividad.sql` y código |
| QR para anotarse solo (C9) | recepción, socio | `qr-alta` (18 pasos) | Migración `20261111150900_qr_alta_plan_sugerido.sql` y código |
| Listas de Socios rápidas (`filtros_socios` en lote, 52 ms) | los tres | prueba viejo-vs-nuevo (7.440 veredictos iguales) | Migraciones `20261111140000` y `20261111140100` |
| Entrada: el aviso "Entró" sale de inmediato; si se corta la red a mitad de anotar vuelve atrás con aviso | recepción | `base-ingresos`, `velocidad-a` | Código |
| **Esta revisión**: lecturas con reintento, refresco junto, íconos del veredicto, avisos sin tapar, Buscando…, Darlo de alta con lo escrito, signos de caja, etiquetas del panel lateral, Cobrar de Últimas entradas | recepción, encargado, dueño | `ent-1`, `ent-2`, `vd-6`, `lectura.test.ts` (vitest) | Código (sin migración); entra con el merge de `carril/rev-mostrador` |

## 3. Falta

Lo que toca plata o permisos está en `PREGUNTAS.md` ("Revisión del mostrador") con la opción más segura y **no se cambió**.

| Función | Rol | Por qué falta / qué hay |
|---|---|---|
| Cobrar no se cierra con Esc o clic afuera mientras dice "Cobrando…"; pregunta si hay cambios | recepción, encargado, dueño | Hoja de cobro (plata): PREGUNTAS |
| Cerrar caja pide confirmar con el monto contado y "ayer cerraste con $X" | recepción, encargado | Cierre de caja (plata): PREGUNTAS |
| Aprobar transferencia compara con lo que debía y se puede deshacer 5 s | encargado, dueño | Mueve la cobertura (plata): PREGUNTAS |
| Vuelto en efectivo y billetes rápidos en Cobrar | recepción | Hoja de cobro (plata): PREGUNTAS |
| Pase diario para quien no es socio | recepción | Cobro nuevo (plata): PREGUNTAS |
| "Abrir caja" en Vender conserva el carrito | recepción | Abre una caja (plata): PREGUNTAS |
| Hora del cierre por WhatsApp en la zona del gimnasio | recepción | Texto del cierre de caja (plata): PREGUNTAS |
| Panel lateral: cuándo le toca pagar, desde cuándo debe, qué plan pagaría (FA-1) | recepción | Hoy muestra "Debe $X" y vigencia; faltan esos tres datos. Grande: pide funciones de base |
| Panel lateral con foto, Reintentar si falla y "Ver la ficha completa" sin recargar | recepción | Chico pero toca el panel que abre sobre otras pantallas; sin e2e que lo proteja |
| Botones que avisan a los 10 s "está tardando más de lo normal" (regla 2) | todos | Es transversal (`BotonAccion`, componente compartido): lo hace quien tenga `components/ui` |
| Lista "Hoy" de Entrada: avisar que se corta en 40 y Anular con confirmación | recepción | Chico, sin hacer en esta pasada |
| Foto en "Entró" por QR o llavero | recepción | FA de PULIDO; necesita la foto en el aviso |
| Interesado sin contactar en 24 h en Para hacer hoy y la campana (FA-13) | recepción, dueño | Grande: tarea automática nueva en base |
| Borrador automático del alta completa (FA-17, regla 7) | recepción, dueño | Mediano: el hook existe (`BorradorAutomatico.tsx`), falta usarlo en el alta |
| Selección múltiple en Socios (FA-9) | dueño, encargado | Hecho; falta correrlo con sesión real (sin e2e) |
| Invitado queda como interesado (FA-24) | recepción | Hecho en base; sin e2e |
| Ticket en impresora térmica 58/80 mm, alias y CBU al elegir Transferencia, cuenta regresiva de "se cierra sola" | recepción | Detalles premium de PULIDO, sin hacer |
| Chequeo de `npm run chequeos` que falle con íconos vacíos o glifos de texto (Z2) | todos | Es de `scripts/chequeos.mjs`; sin hacer |
| Celular: la ficha del socio desborda 2 px (392 > 390) a veces (1 de 4 corridas de `vd-15`) | recepción, dueño | Intermitente; la prueba ya dice qué elemento se pasa, no se pudo ver cuál. Sin arreglar |

## Resultado de las corridas

Todas sobre esta rama, app en producción, gimnasio demo:

| Corrida | Recorridos | Resultado |
|---|---|---|
| 43114662694 | ent-1, ent-2, vd-6 | Los tres rojos (línea base) |
| 43116320230 | ent-1, ent-2, vd-6 x3, vd-4, vd-1 | ent-2 verde; vd-6 20/20 tres veces; vd-1 verde; ent-1 y vd-4 rojos (ver arriba) |
| 43117762536 | ent-1, vd-4, vd-1, panel-entrada, caja-medios, caj-1, vd-14, vd-8, vd-48, soc-13 | Verdes: ent-1, vd-1, panel-entrada, caja-medios (49), vd-8, vd-48, soc-13. Rojos: vd-4, caj-1, vd-14 (pruebas viejas) |
| 43119310633 | vd-4, caj-1, vd-14, ent-1, ent-2, vd-6, panel-entrada, vd-1, caj-5, vd-9, soc-1, panel-socios, panel-vender, vd-15 | Todos verdes salvo vd-4 (DNI al socio equivocado) y vd-15 (celular 392 > 390 en la ficha, intermitente) |
| 43120361066 | vd-4, vd-15, vd-12b, vd-12 | vd-15 y vd-12b verdes; vd-4 y vd-12 rojos por pruebas viejas |
| 43121165535 | vd-4, vd-12, vd-15 x2 | Todos verdes |

Base (migraciones, `db:pruebas`, `chequeos`): verde en 43117762536. Sin migraciones nuevas en esta rama. `typecheck` limpio, `vitest` (`lectura.test.ts` y Entrada) y `eslint` de los archivos tocados sin errores nuevos (el único error, un ref leído al renderizar en `Puerta.tsx`, se arregló).

**Sin ejecutar:** el aspecto de los avisos nuevos (arriba del botón, a la izquierda de la barra) no se miró en una captura; los chequeos de `vd-1` y `vd-4` solo prueban que se ven, se tocan y se van. `npm run build` no se corrió en esta compu (lo hace Actions al levantar la app en producción).

