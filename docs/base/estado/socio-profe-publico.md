# Estado: socio, profe, kiosco, TV y página pública (revisión del 11/11, carril rev-socio)

Zona: app del socio, panel del profe, kiosco, TV de entradas y de la sala, landing, horarios, prueba gratis, privacidad, notificaciones y mensajes por wa.me. No incluye lo que rehace el carril `carril/h3-socio` (Quiero ser socio, DNI, `/hacete-socio`, `proxy.ts`, el alta online ni el inicio de la app del socio) ni lo que arregla `carril/h7-roto` (lector USB del kiosco, QR sin señal, Salir del socio, ingreso): ahí solo se anota lo que se vio.

**Cómo se verificó.** Corridas de `Pruebas completas` en Actions sobre `carril/rev-socio` (modo producción, gimnasio demo; nada se tocó en Temple Gym):
- 43114935671: 27 de 28 recorridos del socio en verde (cayó `vd-58`, por un emoji que ya no es texto).
- 43116522402: 46 de 51 recorridos del profe, kiosco, TV, página y socio en verde (cayeron `rut-1`, `ent-2`, `ent-6`, `panel-clases`, `vd-55`: los cinco eran pruebas viejas que esperaban un emoji o un solo `svg`, no la pantalla).
- 43119348925: los cinco arreglados más `rev-socio` (nuevo) en verde; solo `vd-4` cayó (ver "Falta").
- Pruebas de unidad con vitest: `whatsapp.test.ts`, `nombre-corto.test.ts`, `landing-defaults.test.ts`. Lint de los archivos tocados limpio; `tsc --noEmit` pasó antes de la última tanda de cambios, no se repitió después.

Regla de lectura: "Publicado" = está en `base/2026-11-07`; lo de esta rama queda "sin publicar" hasta que el principal la integre. No hay migraciones nuevas.

## 1. Hecho y publicado (anda de punta a punta, con prueba)

| Función | Rol | Prueba | Estado |
|---|---|---|---|
| App del socio en 4 pestañas (Inicio, Clases, Rutina, Yo), según lo que el gimnasio tiene prendido | socio | `vd-36`, `dis-12`, `panel-app` (celular) | OK |
| Estado en grande (semáforo, días, motivo) y racha | socio | `panel-app`, `app-7`, `vd-23` | OK |
| QR del socio que cambia cada 30 s y escanear el QR de la tablet | socio | `ent-2` (arreglada), `vd-4` | OK, el QR sin señal lo hace h7 |
| Mi plan: cambiar de plan y comprar pases con días a favor | socio | `vd-39` | OK |
| Pagar: transferencia con comprobante, pago online (MercadoPago simulado) y "pagué ayer" | socio | `rev-3`, `pay-1`, `vd-46f` | OK |
| Lo que se cobra en el mostrador aparece en la app (historial de pagos y recibo) | socio / recepción | `app-3`, `rev-3`, `vd-56` | OK |
| Reservar, cancelar, lista de espera, motivo de "no podés reservar", turnos fijos, WOD, lugar numerado, faltas | socio | `vd-24`, `cla-1`, `cla-2`, `cla-4`, `cla-9`, `com-12` | OK |
| Clase cancelada avisa al anotado (campana de la app y WhatsApp armado) | recepción / socio | `cla-3`, `avi-5` | OK |
| Rutina del socio: anotar kilos, mis marcas, marcar cada serie (FA-15) | socio / profe | `rut-2`, `rev-socio` (nuevo) | OK |
| Mensajes al gimnasio con foto y respuesta | socio / dueño | `vd-38`, `vd-38b` | OK |
| Pedir pausa y baja con código de constancia; no se pide dos veces | socio | `app-8`, `vd-46e`, `rev-socio` | OK |
| Clave nueva dada por la recepción y aviso "te dieron una clave nueva" | recepción / socio | `clave-nueva`, `aviso-clave`, `olvide-socio` | OK |
| Notificaciones push: activar, prueba, service worker, manifest con la marca | socio | `push-1` (con pasos nuevos) | OK |
| Encuesta, reseña, invitar y referir, eventos, documentos para firmar, grados, novedades | socio | `com-10`, `ref-1`, `inv-1`, `com-8`, `com-6`, `com-13`, `app-6` | OK |
| Mis datos (descargar) y pedir corrección o borrado (Ley 25.326) | socio | `seg-6` | OK |
| Panel del profe: sus clases, lista de anotados, asistencia, avisar a los anotados, reemplazo en una clase | profe | `rev-4`, `panel-clases` (arreglada), `vd-46k` | OK |
| El profe no ve plata ni otros gimnasios; busca socios sin teléfono | profe | `base-aislamiento`, `equ-2` | OK |
| Rutinas y ejercicios: biblioteca, armar, asignar, progreso del socio | profe | `rut-1` (arreglada), `rut-2`, `vd-20` | OK |
| Fichar entrada y salida con PIN, horas del mes y liquidación | profe | `vd-53`, `vd-52` | OK |
| Equipo con foto, clases y horario | dueño / profe | `vd-44` | OK |
| Kiosco: tablet autorizada por link, DNI, QR de pared y habituales | kiosco | `ent-3`, `ent-6` (arreglada), `com-7` | OK |
| TV de la sala: clase de ahora con anotados y WOD, y modo entradas | TV | `com-14`, `vd-60` | OK. Consulta cada 15 s, no Realtime |
| Landing siempre con marca y sin secciones vacías; "armando" nunca aparece | página | `fase-u4`, `web-p8`, `vd-62` | OK |
| Editor de la página, ocultar, compartir por WhatsApp, Google (SEO) y píxel | dueño / visitante | `web-p8b`, `pag-1`, `pag-2`, `pag-3`, `pag-4`, `com-11`, `panel-pagina` | OK |
| Probá una clase (prueba gratis, una vez por DNI) | visitante | `pag-3`, `vd-51` | OK |
| Horarios en la landing y eventos con lugares | visitante | `fase-u4`, `com-8`, `vd-25` | OK |
| QR y link para anotarse solo | visitante | `qr-alta` | OK (el camino lo rehace h3) |
| Política de privacidad por gimnasio con error y esqueleto propios | visitante | `vd-62` (recorre las páginas públicas) | OK |
| Mensajes por wa.me (comprobante, cierre de caja, retención, avisar a anotados, compartir página) | recepción / dueño | `ven-1`, `veh-1`, `avi-1`, `pag-2` | OK |

## 2. Hecho sin publicar (en `carril/rev-socio`, probado)

| Función | Rol | Prueba | Falta |
|---|---|---|---|
| "Volver" de Historial y de Mi membresía lleva a Yo (de donde se abren); la pestaña Yo queda marcada en Mi plan, Recibo, Locker y PT | socio | `rev-socio`, `panel-app` (ajustada) | Integrar la rama |
| El historial dice "Aprobado", "En revisión", "Rechazado", "Devuelto" en vez de `ok` y `revisando` | socio | `rev-socio` | Integrar |
| "Pago acreditado" dice el monto y el concepto y lleva al historial | socio | `pay-1` (sigue en verde) | Integrar. El recibo puntual lo abre el historial |
| Copiar alias o CBU y subir el comprobante no se rompen sin permiso del portapapeles ni con un error de subida (texto humano, el detalle al log) | socio | código; el e2e no fuerza el error | Integrar |
| Pedir la pausa: el botón queda en "Pausa pedida" y apagado | socio | `rev-socio` | Integrar |
| Editor de rutinas avisa antes de cerrar con cambios sin guardar; sin `Icono` dentro de `<option>` (HTML inválido); la X de quitar ejercicio es `Icono` | profe | `rut-1` | Integrar. Falta borrador guardado (regla 7) |
| Tilde y cruz de texto pasan a `Icono` en series, días de la rutina, "Copiado" y lugar roto | socio | `rev-socio`, `rut-2`, `com-12` | Quedan los de Inicio (`Entraste`, `ProgresoInicio`, `AvisosSocio`): los toca h3 |
| Manifest: `id`, descripción, accesos directos (Mi QR, Mis pagos), nombre corto sin cortar palabras e ícono de 512 y maskable; el ícono sin logo sale en 512 | socio | `push-1`, `nombre-corto.test.ts` | Integrar |
| `robots` no deja indexar `/recepcion`, `/dueno`, `/profe`, `/kiosco`, `/tv`, `/super`, `/socio`, `/estado`; el sitemap suma `/privacidad`; las notificaciones sin título dicen "Aviso de tu gimnasio" (no "Gym OS") | visitante | `push-1`, `rev-socio` | Integrar |
| Textos por defecto de la landing: "¿Cómo me anoto?" manda a "Quiero ser socio" si hay altas online y a WhatsApp si no; "¿Puedo ir a cualquier hora?" contesta algo | visitante | `landing-defaults.test.ts` | Integrar |
| Link de WhatsApp con la clave del socio nuevo (alta con mail): la expresión era `/D/` (la letra) y dejaba el `+` y los espacios; ahora usa `linkWhatsappSocio` | recepción | `whatsapp.test.ts` | Integrar. Falta un e2e con teléfono cargado en el alta |
| Pruebas viejas arregladas (el ícono ya no es emoji ni hay un solo `svg`): `vd-58`, `vd-55`, `rut-1`, `panel-clases`, `ent-2`, `ent-6` | pruebas | corridas 43119348925 | Integrar |

## 3. Falta

| Función | Rol | Por qué falta / qué hay |
|---|---|---|
| Términos del servicio y contrato de encargado (FA-19, WEB-06) | dueño / visitante | Solo existe `/privacidad`. Texto legal: va a `PREGUNTAS.md`, no se publica nada inventado |
| Avisos por hora (FA-12): clase reservada 1 h antes, "te quedan 3 días", "clase sin anotados" al profe | socio / profe | Sin cron no hay quién los dispare; decisión de Mateo en `PREGUNTAS.md`. Los que salen de un hecho (cobro, cancelación, lugar liberado, mensaje) sí andan |
| Lista de espera con plazo para aceptar el lugar (FA-23) | socio | Hoy el lugar liberado se asigna solo; el plazo es un cambio de reglas de reserva |
| "Clase ajena" del profe se decide por el nombre, no por el id | profe | Pide que `clases_del_dia` devuelva `profe_id` (permisos): `PREGUNTAS.md` |
| Borrador guardado en formularios largos (FA-17): hoy solo el alta de `/hacete-socio`; faltan el editor de rutinas, el alta completa, planes y la página | profe / dueño | El editor de rutinas ya avisa al cerrar; el borrador lo hace otro paso |
| TV en vivo por Realtime (regla 14) | TV | Hoy consulta cada 15 s y dice "Sin conexión" si falla; alcanza para una sala, pero no es en vivo |
| Insignias y resumen del año en la app (FA-14) | socio | Está la pantalla `resumen` y la recomendación; no hay prueba de ninguna de las dos (no se probó, se leyó el código) |
| Foto propia del socio (FA-16), lado de la app | socio | Existe `Mi foto` y el permiso por gimnasio; sin e2e |
| `vd-4` (aviso rojo de la tablet en la recepción) cayó en la corrida 43119348925 | recepción / kiosco | Falló dos veces seguidas en la 43120402709. Hay que correrlo sobre `base/2026-11-07` para saber si es de antes; es Realtime entre la tablet y la recepción (regla 20) |
| Lector USB, QR sin señal y "Salir" del socio | kiosco / socio | Lo arregla `carril/h7-roto` (aún sin integrar al terminar esta revisión) |
| Inicio de la app del socio: Bienvenida con nombre de ícono, QR bajo 8 bloques, "te quedan 0 días", "Tu DNI para entrar" | socio | Lo rehace `carril/h3-socio`; no se tocó |
| `FALTANTES.md` tiene FA-14, FA-15, FA-16 y FA-18 en ❌ aunque el código existe | docs | Lo consolida quien integre; este archivo manda sobre esas filas |
