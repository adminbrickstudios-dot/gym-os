# Gy
## 2026-11-06 · Noche · VD-40 · Super admin v2

**QUÉ HICE**
- Migración 6300: alta de gimnasio en 3 pasos (tipo, datos y marca con vista previa del nombre y los colores, dueño) que termina con mensaje de bienvenida (mail, contraseña y link de WhatsApp si hay celular); salud de cada gimnasio en rojo, amarillo o verde con el motivo escrito, ordenada de "necesitan atención" a "no", demo al final, con filtros y búsqueda (se calcula en el momento, no se guarda ningún estado); entrar como soporte pide motivo obligatorio y guarda quién, por qué y cuándo, vence a los 60 minutos (se cierra cuando alguien mira, sin cron), muestra marco y cartel con el motivo y el botón Salir, y el dueño lo ve en su Control ("Cuando BRIK entró a ayudarte"); el botón "¿Necesitás ayuda?" (dueño y encargado) manda gimnasio, quién, pantalla y último error al tablero de BRIK con tope de 5 por hora por persona; métricas de la plataforma (entradas por día, abonos por mes); ficha del gimnasio con uso de 4 semanas, registro de soporte y notas internas.
- `admin_entrar_gimnasio` pasa a llevar el motivo (la firma sin motivo se borra en la misma migración) y se actualizaron las llamadas en `super-admin.test.mjs`; los e2e que dan de alta o entran como soporte (adm-1, adm-3, cliente, rev-5, super-admin) pasan por el helper `alta-gimnasio.mjs`. Un soporte que ya estaba adentro antes de la migración debe entrar de nuevo escribiendo el motivo.
- Verificado: lint, typecheck, pruebas, build y base/chequeos/demo en verde en GitHub (`super-admin-v2`).

**SIN ARREGLAR**: VD-40b (avisos por segmento, campana del dueño para "BRIK entró", módulos por gimnasio, logo en el alta, errores de 24 h y migraciones en la ficha). El 2FA del super admin es VD-42.
**LO QUE NO PUDE VERIFICAR**: e2e `vd-40` y los viejos reescritos con el helper (no se confirmó que ninguno se haya roto): escritos según la documentación, pero no ejecutados.

## 2026-11-06 · Noche · VD-22 · Entrar con Google y sesión recordada (D23)

**QUÉ HICE**
- Migración 6200: botón "Continuar con Google" en el ingreso del socio (`/auth/google`, `signInWithOAuth` PKCE), visible solo con `ENTRAR_CON_GOOGLE=1`: sin la variable no se dibuja y nada cambia. `/auth/callback` cambia el código por la sesión: un Google ya vinculado entra directo a `/app`, si no va a `/auth/vincular`, y una cuenta del equipo se cierra con aviso. Vínculo seguro la primera vez: DNI + código al celular o mail que el gimnasio ya tiene cargado (misma respuesta exista o no el DNI; a un menor, al adulto responsable); nunca por nombre ni mail suelto; si el Google ya sostiene a otra persona o el socio ya tenía otro Google, pide confirmar. Tabla `vinculos_google` (FK compuesta, RLS, un Google activo por socio), `socio_para_vincular_google`, `vincular_google`, `entrar_con_google`. Sesión recordada: la cookie de Supabase dura 400 días y `/salir` la corta.
- **Toca ingresos existentes (revisar)**: se redefinieron `vincular_socios_por_telefono` y `vincular_socios_por_email` (copiando las versiones vigentes) para que el código de celular o mail recupere al socio que hoy sostiene un Google; sin eso, quien vinculó Google quedaba sin poder entrar por celular.
- Imitador local: `/auth/v1/authorize` y `token?grant_type=pkce` con un Google falso (`.local/google-falso.json`); `levantar.sh` prende `ENTRAR_CON_GOOGLE=1`. Middleware: las rutas `/auth/*` se resuelven al gimnasio elegido también desde la dirección de la plataforma.
- Verificado: lint, typecheck, pruebas, build y base/chequeos/demo en verde en GitHub (`entrar-con-google`).

**QUÉ CONFIGURÁS VOS 🔌 (VD-22B)**
1. Google Cloud Console → crear o elegir un proyecto → APIs y servicios → Pantalla de consentimiento OAuth: Externa, con nombre de la app y alcances `email`, `profile`, `openid`.
2. Credenciales → Crear credenciales → ID de cliente OAuth → Aplicación web.
3. URI de redirección autorizados: `https://<ref-del-proyecto>.supabase.co/auth/v1/callback` (el callback de Supabase, no el de Gym OS).
4. Copiar Client ID y Client Secret.
5. Supabase → Authentication → Providers → Google: activar y pegarlos.
6. Supabase → Authentication → URL Configuration → Redirect URLs: `https://*.<dominio-base>/auth/callback` y `https://<dominio-plataforma>/auth/callback` (y el dominio propio de cada gimnasio si lo tienen).
7. Vercel: variable `ENTRAR_CON_GOOGLE=1` (solo servidor); recién ahí aparece el botón.
8. Si la pantalla de consentimiento queda en "Prueba", solo entran los mails cargados como usuarios de prueba; para abrirla a todos hay que publicarla.

**SIN ARREGLAR**: VD-22c ("Sumar a otra persona" en /app y desvincular desde la ficha), VD-22d (un solo usuario por socio con varias identidades: hoy, si alguien usa Google y celular en dos dispositivos, cada ingreso le saca el socio al otro).
**LO QUE NO PUDE VERIFICAR**: un Google real (el imitador no valida credenciales ni redirecciones), que las cookies de `/auth/callback` lleguen con sesión persistente y el e2e `vd-22`: escritos según la documentación, pero no ejecutados.

## 2026-11-06 · Noche · VD-19 y VD-20 · Eventos completos y rutinas

**QUÉ HICE**
- VD-19 (migración 5900): evento con flyer, lugar, responsable, fin, varias fechas, precio general y de socio, borrador/publicar; anotarse desde la app y desde la página (la reserva se paga en recepción en Vender y la venta reemplaza a la reserva sin contar doble); lista de espera calculada (si alguien se baja, sube la siguiente) con tope y campo trampa contra spam desde la página; check-in: la ventana de Entrada muestra "Hoy: evento" al reconocer al socio y marca presencia con un toque; cierre con "Asistieron X de Y"; si se cancela, la app avisa al anotado 7 días. Panel: CSV, WhatsApp por persona, si pagó o falta. `crear_evento` suma parámetros (firma vieja borrada; las llamadas anteriores siguen andando).
- VD-20 (migración 6000): biblioteca de ejercicios con equipo, buscador y filtros; plantillas que se copian sin tocar la original; asignar a varios con tildes y fecha de cambio salteando a los dados de baja; la rutina de hoy en la app (el día que sigue al último que hizo el socio, "Hice el Día N" guarda un hecho por día); sección para el profe "Quién la hizo" (veces en 30 días y "Toca cambiarla"). Solo pesos y repeticiones: ningún dato de salud. `guardar_ejercicio` suma parámetros (firma vieja borrada).
- **Decisiones de plata y permisos**: Vender cobra el precio general del producto (el de socio queda acordado en la reserva y la recepción lo aplica con el descuento); una reserva no bloquea Vender (podrían venderse más lugares que el cupo si hay reservas sin pagar); cierra o publica un evento el dueño o el encargado y la recepción marca presencias; los teléfonos de la página se normalizan a +54.
- Se ajustó el selector de `rut-1.mjs` (el formulario tiene más selects).
- Verificado: lint, typecheck, 113 pruebas, build y base/chequeos/demo en verde en GitHub (`eventos-completos`, `rutinas-completas`).

**SIN ARREGLAR**: VD-19b (editar un evento ya creado, check-in por DNI para no socios, aviso al subir de la espera), VD-19c (🔌 pago online del evento), VD-20b (aviso de rutina vencida y gráfico de progreso).
**LO QUE NO PUDE VERIFICAR**: e2e `vd-19`/`vd-20` y los viejos de eventos y rutinas: escritos según la documentación, pero no ejecutados.

## 2026-11-06 · Noche · VD-25 · Página del gimnasio rediseñada

**QUÉ HICE**
- Migración 6100: portada con una fila de confianza (píldora "abierto ahora", "★ 4,8 · 120 reseñas en Google" que lleva al link de reseñas de Configuración, "+N socios" calculado por la base con los socios sin baja redondeado hacia abajo y oculto por debajo de 20; cada dato solo si el dueño lo prendió), "¿Primera vez? Empezá acá" en tres pasos armados con lo que la página tiene prendido, WhatsApp flotante en compu, "Dejanos tu reseña" en el pie, fotos con `next/image` en producción (con tamaño reservado). Tarjeta "Confianza en la portada" en Tu página (`prueba_social_panel` / `guardar_prueba_social`; la base rechaza un puntaje de 9). `landing_completa` copiada de la versión más nueva (0032) más la clave `prueba_social`; no cambiaron las firmas de `landing_publica`, `agenda_publica` ni `pagina_panel`. Todo lo que el dueño ya editaba sigue igual.
- Verificado: lint, typecheck, 113 pruebas, build y base/chequeos/demo en verde en GitHub (`prueba-social`).

**QUÉ CONFIGURÁS VOS**: el dueño carga puntaje y cantidad de reseñas en Tu página y pega el link de Google en Configuración → Mensajes.
**SIN ARREGLAR**: VD-25b (grilla de clases con cupo en la página pública), VD-25c (🔌 reseñas desde la API de Google), VD-25d (medir Lighthouse en el despliegue).
**LO QUE NO PUDE VERIFICAR**: Lighthouse celular ≥ 90 no se midió acá (apoyado en prioridad de la portada, tamaño reservado, server components y un solo JS de cliente); e2e `vd-25` y los viejos (pag-1…pag-4, panel-pagina, landing, cliente): escritos según la documentación, pero no ejecutados.

## 2026-11-06 · Noche · VD-24 y VD-38b · Lista de espera automática, motivo de "no podés reservar" y mensajes en el menú

**QUÉ HICE**
- VD-24 (migración 5700): `cancelar_reserva` (privada y pública, con la firma vieja borrada) ahora devuelve quién subió de la espera; push de "lugar liberado" una sola vez por reserva (`destinos_push_clases`); `motivo_reserva`/`motivos_reserva` devuelven si puede, el código, la frase y el botón (reservar, espera, pagar, cambiar de plan) para cupo lleno, plan que no incluye la clase, vencido, pack sin clases, límite semanal, clase cerrada o cancelada, fuera de plazo, congelada y suspendido; `avisos_lugar_socio` trae los avisos de los últimos 2 días. La pantalla de clases del socio muestra los avisos arriba, la frase y el botón; el estado vacío ofrece ver el día siguiente. Dos cancelaciones simultáneas no confirman a la misma persona dos veces (prueba con dos conexiones reales).
- VD-38b (migración 5800): `pendientes_panel` suma `mensajes_sin_responder` (la recepción sin permiso sigue viendo 0) y el menú muestra el contador de Mensajes (neutro, no rojo); contestar refresca el número.
- Verificado: lint, typecheck, 113 pruebas, mapa y base/chequeos/demo en verde en GitHub (`espera-motivo`, `espera-concurrente`, `pendientes-panel`).

**SIN ARREGLAR**: VD-24b (la recepción no puede cancelar una reserva suelta desde el panel; subir el cupo de una clase no promueve a nadie de la espera). No hay motivo propio de "fuera de franja": cae en "el plan no incluye".
**LO QUE NO PUDE VERIFICAR**: e2e `vd-24` y `vd-38b` y la pantalla del socio: escritos según la documentación, pero no ejecutados; `npm run db:types` no se corrió.

## 2026-11-06 · Noche · VD-35 y VD-39 · Registro del socio y cambio de plan desde la app (D26, D28)

**QUÉ HICE**
- VD-35 (migración 5500): `alta_online` exige fecha de nacimiento (sin ella la base no sabe si es menor, D10); interruptor "Registro abierto" (`registro_socios_panel` / `guardar_registro_socios`, solo el dueño, sin tocar `guardar_configuracion`; usa `altas_online` y no deja abrir sin reglamento) en Configuración → Página → "Lo que hacen los socios solos"; "Soy nuevo, quiero anotarme" en el ingreso del socio solo si está abierto; en Socios el que se anotó solo y no pagó muestra "🌐 A cobrar"; los pagos de la app (`informar_transferencia`, `iniciar_pago_online`, firmas viejas borradas) llevan clave de operación: el mismo envío dos veces devuelve el mismo pago.
- VD-39 (migración 5600): `/app/plan` ("Cambiar de plan o comprar un pase", solo si el dueño lo dejó prendido y hay algo para elegir) con los días a favor (regla D6) calculados por la base (`vista_compra_app`); paga con MercadoPago o transferencia (con clave de operación); el plan cambia al acreditarse el pago, por un trigger sobre `pagos` (sirve para aprobación del equipo y para MercadoPago; si se rechaza, el plan queda igual); pases y packs son una venta común. Tablas `ajustes_autoservicio` y `cambios_plan_app`.
- **Decisiones de plata y permisos (revisar)**: se cambió un check de `pagos` (rechazado o anulado sin `mp_pago_id` ahora es válido; aprobado sigue exigiéndolo) porque `rechazar_pendientes_de_suscripcion` fallaba con un pago de MercadoPago abierto y no terminado, y con él también el cambio de plan de la recepción; la transferencia siempre pasa por aprobación del equipo y MercadoPago acredita solo; el cambio de plan cobra la cuota del plan nuevo sin matrícula; solo compra el socio dueño de la cuenta.
- Verificado: lint, typecheck, 110 pruebas y base/chequeos/demo en verde en GitHub (`registro-cambio-plan-app`, y `alta-online` actualizada para pasar fecha); se actualizaron reg-1 y rev-3 por la fecha obligatoria.

**SIN ARREGLAR**: VD-39b (aprobación previa del dueño para cambios por MercadoPago, deshacer un cambio de plan, mensaje de /app/pago que nombre lo comprado).
**LO QUE NO PUDE VERIFICAR**: e2e `vd-35`/`vd-39` y los viejos (reg-1, rev-3, pay-1…): escritos según la documentación, pero no ejecutados; el build local no corrió con el disco lleno (lo cubre la corrida del merge); `npm run db:types` no se corrió.

## 2026-11-06 · Noche · VD-38 · Mensajes de los socios al gimnasio (D27)

**QUÉ HICE**
- Migración 5300: en la app, Yo → Más → "Escribile al gimnasio" (`/app/mensajes`, formulario con motivo —consulta, queja, objeto perdido, otro—, foto opcional achicada en el celular y el aviso de no contar diagnósticos). Al contestarle, push y "N respuestas nuevas" en Yo y en Novedades. Panel: `/panel/mensajes` (bandeja con filtros por estado, detalle, foto, respuestas rápidas, marcar resuelto) e historial en la ficha del socio. Un socio ve solo los suyos; dueño y encargado siempre; la recepción solo si el dueño lo prende (interruptor en la bandeja); el profe nunca; sin permiso, error y no bandeja vacía (y `ver_mensajes_equipo` saca "Mensajes" del menú sin tocar `panel_gimnasio`). Sección `mensajes` apagable por gimnasio (suma a la lista vigente de `secciones_validas()`). Bucket privado `mensajes_fotos`.
- Decisiones: fotos hasta 2,5 MB (límite de las acciones del servidor 3 MB); el push usa su propia función y se avisa una sola vez por mensaje; tres respuestas rápidas de ejemplo en los gimnasios existentes.
- Verificado: lint, typecheck, 110 pruebas, build y base/chequeos/demo en verde en GitHub (`mensajes-socios`).

**QUÉ CONFIGURÁS VOS**: si querés que la recepción vea los mensajes, prender el interruptor en `/panel/mensajes`; el push necesita las claves VAPID.
**SIN ARREGLAR**: VD-38b (`pendientes_panel` sigue contando mensajes en 0: falta llamar a `mensajes_sin_responder`) y VD-38c (respuestas de ejemplo para gimnasios nuevos, foto en las respuestas del equipo).
**LO QUE NO PUDE VERIFICAR**: e2e `vd-38`, capturas y el push real: escritos según la documentación, pero no ejecutados.

## 2026-11-06 · Noche · VD-37 · Pendientes (números y puntitos) y centro de notificaciones

**QUÉ HICE**
- Migración 5200: `pendientes_panel(gimnasio)` devuelve todos los contadores del menú en un pedido y por rol (la recepción no ve control, pedidos de socios ni plata; quien no es del equipo recibe error, no vacío); `mensajes` en 0 hasta VD-38; llama a `para_hacer_hoy` sin copiarla. `campana_panel` une la campana de siempre con la del Control, suma el tipo a cada aviso y saca los tipos apagados; tabla `preferencias_aviso` (RLS, canal `app`) con `preferencias_aviso_panel` y `guardar_preferencia_aviso`.
- Menú con números ("9+" desde 10, punto en el botón Menú del celular; rojo solo en Vencen y cobrar, Transferencias y Caja; Inicio nunca lleva número), que se renuevan al cargar, al cambiar de pantalla, al cobrar o aprobar/rechazar, al volver a la pestaña y cada 60 s. Campana `/panel/campana` agrupada por día con "Para atender ahora" y "Marcar todo como leído", preferencias por tipo en una sección plegable, push ofrecido solo ante un aviso de comprobantes, caja o pedidos.
- Decisiones: Vencen cuenta solo los que vencen hoy (doc 12); "Para hacer hoy" suma `para_hacer_hoy` (que no incluye tareas manuales: verificado, sin doble conteo) más mis tareas de hoy o atrasadas; la recepción no ve el número de pedidos de pausa y baja.
- Verificado: lint, typecheck, 110 pruebas, build y base/chequeos/demo en verde en GitHub (`pendientes-panel`).

**QUÉ CONFIGURÁS VOS**: para que llegue el push siguen haciendo falta las claves VAPID.
**SIN ARREGLAR**: VD-37b (solo lo urgente por defecto), VD-37c (canales mail y WhatsApp), VD-37d (punto en Yo y Clases de la app, depende de VD-38).
**LO QUE NO PUDE VERIFICAR**: e2e `vd-37` ("Marcar todo" no se prueba si nadie tiene avisos), los 50 ms con 3.000 socios (`pendientes_panel` llama dos veces a `privado.retencion`: la parte a mirar) y 390 px: escritos según la documentación, pero no ejecutados.

## 2026-11-06 · Noche · VD-13 · Para hacer hoy: tareas inteligentes

**QUÉ HICE**
- Migración 5000: `/panel/tareas` pasó a ser "Para hacer hoy" sin sacar nada (`/panel/hoy` redirige). Tres bloques: 13 automáticas calculadas, cada una con su dato y sus nombres (las 5 de antes — vencen hoy, prometieron pagar, transferencias por aprobar, caja abierta, no vienen — más caja sin contar, vencen en N días, nuevos sin venir, cumpleaños, stock bajo, pausas, bajas y clases con lista de espera); checklist de apertura y cierre (lo arman dueño y encargado, se tilda por día); tareas manuales con repetición diaria, semanal o mensual (al tildar una repetida nace la siguiente, una sola vez). En "vencen hoy" y "prometieron pagar" hay 💵 Cobrar por persona que abre la hoja de VD-5 y la saca de la lista.
- Configuración "Qué se avisa y a quién" (dueño y encargado): prender o apagar cada automática, asignarla a un rol, una persona o "lo de siempre" y elegir los días de las que llevan N. Tablas `tareas_auto`, `tareas_checklist`, `tareas_checklist_hechas`; `para_hacer_hoy` reescrita con la misma firma sobre la versión vigente; `crear_tarea` suma un parámetro y la firma vieja se borra.
- Decisiones: "no vienen" sigue solo para dueño y encargado (el dueño puede asignarla a la recepción); las tarjetas muestran cantidades y nombres, nunca montos; caja sin contar, stock, pausas y bajas son de gestión y no se asignan a la recepción; el profe no ve ninguna.
- Verificado: lint, typecheck, 104 pruebas, build y base/chequeos/demo en verde en GitHub (`para-hacer-hoy`, `inicio-en-vivo`).

**SIN ARREGLAR**: VD-13b (avisos automáticos en la app del socio: la base no tiene bandeja de avisos para el socio), VD-13c (firmas pendientes, hitos de entradas, pedir reseña), VD-13d (Para hacer hoy como bloque principal del Inicio). Vencen hoy, prometieron y transferencias solo se prueban con el e2e.
**LO QUE NO PUDE VERIFICAR**: e2e `vd-13` (depende de que el demo tenga a quien venza hoy) y las pantallas con sesión real: escritos según la documentación, pero no ejecutados.

## 2026-11-06 · Noche · VD-15 y VD-6b · Socios con memoria, Interesados y ficha con acciones (D22)

**QUÉ HICE**
- Socios recuerda búsqueda, filtros y scroll en `sessionStorage` (al volver de una ficha los restaura; "Todos" o sacar un filtro no los vuelve a poner). Pestañas Socios · Interesados (`/panel/socios?vista=interesados`) con todas las funciones de Prospectos (seguimiento, "Ya le escribí", "Hacerlo socio", WhatsApp armado); `/panel/prospectos` redirige (si Socios está apagado se sigue mostrando la pantalla vieja). 🌐 en la lista y píldora "Se anotaron por la web" para los de autoalta. La ficha tiene en el encabezado "🚪 Entrada" (abre la ventana de VD-1 con ese socio) y "💵 Cobrar" (hoja de VD-5).
- VD-6b (migración 5100): `prospectos.dni` (opcional, único por gimnasio, 6 a 12 números); `crear_prospecto` con `p_dni` (firma vieja borrada); el alta ofrece al Interesado por DNI aunque el celular sea otro y "Hacerlo socio" trae nombre, celular y DNI; `buscar_socios` devuelve `autoalta` y acepta `p_origen='web'` (firma vieja borrada).
- Verificado: lint, typecheck, 105 pruebas y base/chequeos/demo en verde en GitHub (`interesados-dni`).

**SIN ARREGLAR**: VD-15b (la píldora 🌐 no distingue si ya pagó, encabezado fijo al scrollear, línea de tiempo única en la ficha).
**LO QUE NO PUDE VERIFICAR**: e2e `vd-15` y los viejos (panel-socios, soc-*, pro-*, reg-1, pag-3, rev-1, vd-6): escritos según la documentación, pero no ejecutados; el tramo de autoalta 🌐 del e2e es condicional y solo está probado en la base.

## 2026-11-06 · Noche · VD-11 · Menú nuevo y redirecciones

**QUÉ HICE**
- Menú en el orden del doc 03 §1: Hoy (Entrada, Para hacer hoy, Avisos de hoy, Vencen y cobrar, Clases de hoy), Socios (Socios, Interesados, Retención y números, Rutinas, Eventos), Plata (Caja, Productos y stock, Transferencias, Resultado, Gastos, Control, Resumen) y Gimnasio (Planes y servicios, Tu página, Equipo, Configuración). Las claves de las secciones no cambiaron: los accesos rápidos guardados siguen andando y ninguna ruta se sacó ni necesitó redirección. Mapa central `src/lib/panel/rutas.ts` (`DESTINO`, rutas viejas, `REDIRECCIONES` vacío): VD-13/15/18 solo cambian el destino ahí. Ctrl+K encuentra por el nombre viejo y por el nuevo.
- Migración 4900: `panel_gimnasio` (redefinida entera, misma firma) apaga "gastos" para el encargado sin `encargado_ve_gastos` y manda ese permiso (VD-41b). Control ya lo apagaba `contextoPanel`.
- Decisiones: "Productos y stock" apunta a `/panel/vender` para que la recepción conserve su pantalla de venta (los productos siguen en Planes y servicios); "Avisos de hoy" queda aparte hasta que VD-13 lo junte.
- Verificado: lint, typecheck, 109 pruebas, build y base/chequeos/demo en verde en GitHub (`menu-gastos`).

**SIN ARREGLAR**: cuando VD-13/15/18 creen sus rutas nuevas hay que cargarlas en `REDIRECCIONES`.
**LO QUE NO PUDE VERIFICAR**: e2e `vd-11` (nombres y orden, 16 rutas viejas, accesos rápidos, Ctrl+K, menús por rol y 390 px) y el barrido: escritos según la documentación, pero no ejecutados.

## 2026-11-06 · Noche · VD-17 y VD-18 · Planes y servicios; productos y stock (D21)

**QUÉ HICE**
- VD-17 (migración 4700): "Ajustes" por plan: cómo vence (el del gimnasio, continua, desde el pago o día fijo; solo el dueño la cambia), días de tolerancia, cuándo el pack descuenta, visible en la página y el alta online (apagado = solo lo vende la recepción), sedes donde vale; orden con subir/bajar y "Cómo lo ve el socio". Servicios adicionales recurrentes (locker, toalla) como productos asignados al socio: `precios_venta` los trae y la cuota los suma sola en Cobrar y en Vender por los mismos meses; la base rechaza servicios sin cuota, no contratados o con otros meses.
- VD-18 (migración 4800): producto con foto (achicada al subir), costo, margen y categoría; entrada de mercadería con foto del remito e historial; "Queda poco" y lista "Para reponer"; botones de Vender con foto y "Quedan N", bloqueados en cero; `vender` rechaza si el stock no alcanza salvo que el producto lo permita (apagado de origen); en Vender, con un socio elegido, "Cobrar a …" abre la hoja Cobrar (los botones viejos de cuota siguen). Buckets `fotos_productos` (público) y `remitos_stock` (privado, también en supabase-local).
- `privado.vender` y `precios_venta` se copiaron en cadena 4000 → 4700 → 4800 (verificado: cada una arrastra lo anterior).
- Verificado: lint, typecheck, 99 pruebas, build y base/chequeos/demo en verde en GitHub (`planes-servicios`, `productos-stock`).

**SIN ARREGLAR**: VD-18b (margen por producto en Resultado, servicios contratados en la ficha del socio, costo unitario en cada entrada). La hoja Cobrar no controla stock por pantalla (solo la frena la base).
**LO QUE NO PUDE VERIFICAR**: e2e `vd-17`/`vd-18` y los viejos (panel-planes, pla-*, ven-*, panel-vender), y subir foto o remito contra el storage: escritos según la documentación, pero no ejecutados.

## 2026-11-06 · Noche · VD-14 y VD-16 · Vencen y cobrar con pestañas; Retención y números

**QUÉ HICE**
- VD-14 (migración 4400, `vencen_pestanas`): `/panel/vencen-hoy` con pestañas Vencen hoy · Vencidos · Por vencer · Prometieron pagar, cada una con su cuenta; arriba "$X a cobrar hoy · $Y vencido · $Z por vencer"; con día fijo "Período de pago, día 4 de 10". Cobrar abre la hoja de VD-5. La recepción ve cantidades y lo que debe cada vencido, no lo que paga cada socio por mes (decisión prudente). El bloque Prometieron pagar sigue en la pestaña de hoy para que `rev-1` y `vd-8` sigan pasando.
- VD-16 (migración 1600, `retencion_periodo`): churn general y de 90 días, ingreso por socio, visitas por socio, los de una vez por semana o menos, mapa de calor, ocupación de clases y ausentes, por período (este mes, mes pasado, 3, 6, 12 meses) con "¿Qué es esto?" y link a la lista que lo forma; "Exportar a Excel" (CSV); solo dueño y encargado; índices para que responda rápido. Prueba de exactitud con datos y momento fijos.
- Verificado: lint, typecheck, 98 pruebas, build y base/chequeos/demo en verde en GitHub.

**SIN ARREGLAR**: VD-16b (sembrador con cantidad y medir los 300 ms con 3.000 socios) y VD-16c (posponer una fila de riesgo, gráficos mes a mes, cobrado por mes y por medio).
**LO QUE NO PUDE VERIFICAR**: el tiempo < 300 ms con 3.000 socios no se midió; pantallas y e2e `vd-14`/`vd-16` y los viejos (panel-vencen, veh-1, avi-*, panel-retencion, ret-*): escritos según la documentación, pero no ejecutados.

## 2026-11-06 · Noche · VD-10 · Control: todo queda escrito, con alertas al dueño

**QUÉ HICE**
- Migración 4300: `linea_de_control(gimnasio, desde, hasta, tipos[], quien, limite, cursor)`, paginada por cursor con índices por gimnasio y fecha, con 11 tipos: cobros, anulaciones (quién la pidió y quién la aprobó), descuentos, "cobré otro día", dejados pasar (con la promesa), cajas (abrió, cerró, sin contar), precios, configuración, entradas anuladas, invitados y anti-préstamo. La ve el dueño, y el encargado solo si tiene `encargado_ve_resultado` (decisión prudente: no se creó un permiso aparte); recepción y profe reciben error.
- Alertas a la campana (`campana_control`): cobro con fecha atrasada y posible préstamo de entrada; anulación y descuento grande ya llegaban por `alertas_caja` (no se duplicaron). Llega una sola vez (clave = id del hecho). El cambio de precio de un producto ahora deja historial (trigger).
- `/panel/control`: filtros por tipo, persona y fechas (se recuerdan), lista por día con "Más viejos", CSV con tope de 5.000 filas (avisa si corta), enlaces desde Control de la puerta, "Qué hizo cada uno" y Equipo. Sección apagable por gimnasio (`control` suma a `secciones_validas()` leyendo la lista vigente, que ya incluye `gastos`).
- Barrido: `/panel/control` y `/panel/gastos` sumados a RUTAS y prohibidos para recepción y profe (gastos también para el encargado sin permiso).
- Verificado: lint, typecheck, pruebas, build y base/chequeos/demo en verde en GitHub (`control`).

**SIN ARREGLAR**: VD-10b (filtro por socio, e2e del cobro atrasado en la campana, conteo en el resumen del día).
**LO QUE NO PUDE VERIFICAR**: e2e `vd-10` (selectores de Descuento/Anular copiados de e2e viejos), el filtro recordado en localStorage, la descarga del CSV, 390 px y una consulta con miles de filas: escritos según la documentación, pero no ejecutados.

## 2026-11-06 · Noche · VD-41 · Gastos y presupuesto: la ganancia del mes

**QUÉ HICE**
- Migración 4150: seis categorías de gasto (alquiler, sueldos, servicios, mantenimiento, proveedores, otros) con día calendario y comprobante opcional (bucket privado `comprobantes_gastos`); `gastos_fijos` que valen desde el mes en que se cargan hasta que se dejan de repetir (se calculan al consultar, sin cron); `presupuestos_gasto` mensual por categoría; `ganancia_mes` (ingresos − gastos − fijos y el desvío contra el presupuesto), que ahora usa Resultado. Tablas con `gimnasio_id`, FK compuesta y RLS; `gastos` suma a `secciones_validas()` (se apaga por gimnasio).
- Pantalla `/panel/gastos` (cargar, lista con comprobante, fijos, presupuesto, mes a mes, CSV, esqueleto, estado vacío), en el menú de PLATA. Resultado muestra ganancia, desvío y carga rápida con link a Gastos; `res-3` sigue válido.
- **Decisión de permisos**: el encargado ve y carga gastos solo si el dueño prende `encargado_ve_gastos` (apagado de origen: no se reutilizó `encargado_ve_resultado` porque abriría los sueldos por defecto); con permiso no ve la lista de fijos (solo el total). Fijos, presupuesto y el interruptor son del dueño. Recepción y profe: error.
- Verificado: lint, typecheck, pruebas, build y base/chequeos/demo en verde en GitHub (`gastos-presupuesto`).

**QUÉ CORRÉS VOS**: después de aplicar, `npm run db:types`. El bucket se crea con la migración.
**SIN ARREGLAR**: VD-41b (el menú muestra Gastos al encargado sin permiso y recibe el error al abrirla; se arregla en VD-11), VD-41c (interruptor también en Equipo → Permisos), VD-41d (presupuesto por mes y aviso).
**LO QUE NO PUDE VERIFICAR**: e2e `vd-41`, la subida del comprobante contra Storage real y 390 px: escritos según la documentación, pero no ejecutados.

## 2026-11-06 · Noche · VD-9 · Caja por turno que se cierra sola, sin cron (D20)

**QUÉ HICE**
- Migraciones 4100 y 4101: una caja abierta de otro día, o con más de N horas (14 por defecto, hora de corte 00:00 por defecto), cuenta como "sin contar"; al primer acceso queda registrada cerrada sin contar con el esperado y sin responsable. Un trigger `before insert` sobre `pagos`, `ventas` y `movimientos_caja` impide cobrar en ella (`vender` no se tocó). "Para revisar" en Caja para dueño y encargado: "conté $X" o dejarla con motivo, siempre con quién y cuándo.
- Mi turno desde la Entrada (abrir con fondo sugerido sin ponerlo solo, cerrar, aviso si quedó vencido). Reporte X (turno abierto, solo dueño/encargado: arqueo ciego) y de cierre; Z del día con SOBRAN/FALTAN grande y lo sin contar aparte; por WhatsApp. Calculadora de billetes opcional (la base re-suma). Configuración → Cobros → Caja: por turno o una caja por día, pedir billetes, fondo fijo, hora de corte, horas máximas (solo dueño; queda en el historial).
- Decisiones: `abrir_caja` registra como sin contar toda caja vencida antes de abrir (reemplaza la regla CAJ-5 "cerrala antes de abrir otra"; sigue sin permitir dos turnos abiertos); si la recepción cierra su propia caja vencida antes de que se registre, cuenta, pero queda anotado que se cerró sola; la recepción ve solo reportes de turnos que abrió o cerró. Se actualizó `caja-olvidada` para esa regla nueva.
- Verificado: lint, typecheck, pruebas, build y base/chequeos/demo en verde en GitHub (`caja-sin-contar`, `caja-olvidada`).

**SIN ARREGLAR**: VD-9b (alerta al dueño en la campana), VD-9c (abrir turno en Inicio para dueño/encargado), VD-9d (etiquetas de `caja.*` en el historial), VD-9e (fondo que no coincide con el turno anterior).
**LO QUE NO PUDE VERIFICAR**: e2e `vd-9` y los viejos caj-1, caj-3, caj-4, caj-5 (no modificados): escritos según la documentación, pero no ejecutados; `npm run db:types` no se corrió.

## 2026-11-06 · Noche · VD-7 y VD-8 · Cómo vencen las cuotas y dejar pasar sin pagar (D18, D19)

**QUÉ HICE**
- VD-7 (migración 4000): regla de vencimiento por gimnasio y por plan: con día fijo, quien se anota a mitad de mes paga proporcional a los días hasta el día fijo (redondeo a $100 configurable), mes entero, gratis hasta el día fijo, o "como hasta ahora". La cuenta está en la base (11 de 30 = $11.000; 21 de 31 = $20.300; 14 de 28 = $15.000); la hoja Cobrar muestra "N días de M" y a qué día cubre; Configuración → Cobros con simulador "¿y si se anota el…?" y la regla de cada plan; cada cambio queda en `cambios_cobro`; cambiar de modo no toca lo ya cobrado. Un gimnasio sin configurar queda como antes (ningún cobro cambia solo). Copia `privado.vender` y `precios_venta` de la definición más nueva (6700).
- VD-8 (migración 4001): tres modos de "dejar pasar" por deuda: la recepción hasta N días (3 por defecto), siempre con PIN del dueño o encargado, o libre con registro; solo el dueño lo cambia. El PIN se canjea por un token de esa sola entrada. Cada caso queda en `promesas_pago` (quién pidió, quién autorizó, regla vigente, día prometido). Aparece en Inicio, Vencen hoy ("Le prometieron pagar"), Para hacer hoy y como chip "Ayer dijo que pagaba hoy" en la Entrada del día. Componente compartido `FormDejarPasar`. La firma de `registrar_ingreso` suma `p_promete_pagar_el` y la vieja se borra ahí mismo.
- Verificado: lint, typecheck, 94 pruebas, build y base/chequeos/demo en verde en GitHub (`vencimiento-cuotas`, `dejar-pasar-modos`).

**QUÉ CONFIGURÁS VOS**: elegir en Configuración → Cobros la regla de vencimiento y el modo de dejar pasar (hasta entonces todo sigue como estaba) y cargar el PIN en Mi cuenta (dueño y encargado).
**SIN ARREGLAR**: sumados VD-7b (la deuda de la puerta usa el precio entero para quien nunca pagó con día fijo), VD-7c (ventana de pago en Vencen), VD-7d (default de gimnasio nuevo), VD-8b (promesas incumplidas).
**LO QUE NO PUDE VERIFICAR**: e2e `vd-7` y `vd-8`, la hoja Cobrar con primera cuota gratis ($0) en pantalla y 390 px: escritos según la documentación, pero no ejecutados.

## 2026-11-06 · Noche · VD-3 y VD-4 · Reingreso por visita, anti-préstamo y entradas en vivo

**QUÉ HICE**
- VD-3 (migración 4200): `registrar_ingreso` reemplaza los 60 s fijos por una visita de N horas (5 por defecto, `configuracion_visita`): dentro de ella devuelve "Ya entró/entraste a las HH:MM" sin crear entrada, sin contar ni descontar pack o pase y con el mismo color. Otra vía o dispositivo antes de N minutos (60) → amarillo "¿es la misma persona?" y alerta en `alertas_prestamo` para dueño y encargado (Control de la puerta). `antiprestamo_minutos = 0` lo apaga; `visita_horas = 0` deja solo el doble toque de 60 s. Configuración → Entrada. No se tocó `calcular_acceso` ni `guardar_configuracion`. Prueba con momentos fijos (4 h 59 m, 5 h 01 m, QR dos veces, otra vía a los 4 y a los 61 min, 0). Se ajustó el test viejo "reingreso el mismo día" de `acceso` apagando la visita larga para seguir probando ese cálculo.
- VD-4 (migración 4201): `entradas_desde` + un solo polling de 4 s con la pestaña visible; toasts de vidrio (verde 6 s, amarillo 12 s, rojo queda con Cobrar que abre la hoja); la barra fija de la ventana usa el mismo polling; "Hoy" se actualiza sola; no avisa las entradas hechas por la misma recepción. Interruptor en Configuración → Entrada (prendido por defecto).
- Verificado: lint, typecheck, pruebas, build y base/chequeos/demo en verde en GitHub (`reingreso-visita`, `entradas-en-vivo`, y las viejas de acceso, kiosco y QR).

**SIN ARREGLAR**: VD-3b (foto en el amarillo, chip en Inicio, mismo polling en UltimasEntradas) y VD-4b (nombre de sede en el aviso del dueño con varias sedes).
**LO QUE NO PUDE VERIFICAR**: e2e `vd-3` y `vd-4` (el segundo supone `ffmpeg` y a `socio@ejemplo.invalid` como "Testigo Al Día") y los e2e viejos de entrada, kiosco y TV: escritos según la documentación, pero no ejecutados; el aviso en 390 px no se vio.

## 2026-11-06 · Noche · VD-6, VD-5b, VD-1b y VD-2b · Alta rápida y ventana de Entrada completa

**QUÉ HICE**
- VD-6 (migración 3800): en la ventana de Entrada, un DNI inexistente ofrece "Darlo de alta" (tecla A): datos → plan con tarjetas y primer pago → "Guardar y cobrar" abre la hoja Cobrar → vuelve en verde para anotar. Alta completa en Socios en 4 pasos en una pantalla (datos, plan con tarjetas y primer pago, hoja Cobrar sobre el alta, Listo con bienvenida). Un Interesado con ese celular se ofrece. Un error o celular a medio escribir no borra nada. `planes_para_alta` calcula cuota, matrícula y totales en la base; `prospecto_por_telefono` busca al Interesado. "Dar de alta" sin plan sigue yendo a la ficha.
- VD-5b: "Dar de alta y cobrar" y el Cobrar de `Puerta.tsx` abren la hoja Cobrar (si no está montada, respaldo a Vender); `Puerta` recalcula el veredicto al cobrar. Actualicé ent-9, pla-3, pla-6, soc-13, vd-1, vd-34, ven-5 y ven-6, y los 12 e2e que usaban el select de plan usan el helper `scripts/e2e/alta.mjs` (el plan pasó a tarjetas).
- VD-1b: F abre la ficha con `?desde=entrada` y su Volver reabre la ventana con el mismo socio; el dueño con varias sedes elige sede en la ventana (queda en esa compu).
- VD-2b (migración 3802): chips "Tiene clase hoy a las HH:MM" y "En prueba" en `guia_entrada`.
- Verificado: lint, typecheck, pruebas, build y base/chequeos/demo en verde en GitHub (`alta-rapida`, `guia-clase-hoy`).

**Decisiones del agente**: "En prueba" es provisoria (primera vez con pase o pack), solo informativa y sin cambiar quién entra: queda atada a CLA-6/REV-1c (VD-2c, 🟡).
**SIN ARREGLAR**: VD-6b (el Interesado no guarda DNI: solo se cruza por celular), VD-6c (proporcional del día fijo depende de VD-7); al cambiar de pestaña en la ficha se pierde `desde=entrada`.
**LO QUE NO PUDE VERIFICAR**: todo lo de pantallas y los e2e nuevos y actualizados: escritos según la documentación, pero no ejecutados; corren en la corrida `[pantallas]`.

## 2026-11-06 · Noche · VD-33b, VD-33c y VD-12e · Mi cuenta, anti-robot e Inicio sin repetir

**QUÉ HICE**
- VD-33b (migración 3301, `mi_seguridad`): cambiar contraseña pide la actual si ya hay una (cliente aparte, no abre sesión nueva); una cuenta sin contraseña pone la primera sin pedirla; "Mi cuenta" muestra dónde está abierta (dispositivo, última actividad, "Este dispositivo") y "Cerrar las otras" (`signOut scope others`); el cliente de servidor reenvía el User-Agent. En panel y en la app del socio.
- VD-33c: desafío Turnstile antes de mandar códigos (SMS, mail del socio, recuperar contraseña) solo si están `NEXT_PUBLIC_TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY`; sin ellas todo sigue igual; si Cloudflare no responde no sale el código; cookie firmada de 10 min por destino para reenviar.
- VD-12e: "Ahora y lo que sigue" ya no repite lo que está en "Para hacer hoy".
- Verificado: lint, typecheck, 91 pruebas, base/chequeos/demo en verde en GitHub (`mi-seguridad`).

**QUÉ CONFIGURÁS VOS 🔌**: crear el widget Turnstile en Cloudflare y cargar las dos variables en Vercel (con ambas vacías no cambia nada).
**SIN ARREGLAR**: sumados VD-33d (2FA), VD-33e (cerrar sesiones al cambiar contraseña), VD-33f (aviso de dispositivo nuevo).
**LO QUE NO PUDE VERIFICAR**: `vd-33b` y `vd-12e`, el widget real contra Cloudflare, `signOut others` y el User-Agent contra Supabase real: escritos según la documentación, pero no ejecutados.

## 2026-11-06 · Noche · VD-5 · Cobrar: un solo flujo en todos lados

**QUÉ HICE**
- Hoja flotante `Cobrar` única, abierta desde la ventana de Entrada (tecla C), la ficha, Vencen hoy, Retención y Ctrl+K (botón por socio o "cobrar Juan" + Enter). Muestra la cuota de su plan con su período y las líneas de matrícula, recargo, convenio y cupón; medios en botones, dos medios, comprobante de transferencia (hasta 2,5 MB), descuento con motivo, agregar producto/pase/pack/deuda/otra cosa, "atiende X" (PIN), recibo por WhatsApp y aviso de doble cobro que nunca frena. Medio por defecto configurable desde la hoja (dueño/encargado). Desde la Entrada, al cobrar la hoja se cierra y el veredicto se recalcula (C → Enter → Enter deja al vencido adentro); desde las demás, "Cobrado" con Anular y Volver.
- "Cobré otro día": solo dueño/encargado, con motivo, hasta 90 días atrás, nunca en efectivo ni a cuenta (decisión prudente para no mezclar la caja de hoy); lo exige la base. La venta guarda motivo, quién la cargó y cuándo.
- Comparte con `/panel/vender` las acciones y las cuentas (`compartido.tsx`, `tipos.ts`); `/panel/vender` sigue igual. Migración 3450 (`vender` con fecha de cobro, motivo y comprobante opcionales y la firma vieja borrada; `contexto_cobro`; medio por defecto). Número 3450 y no 0500: depende de `vender` de VD-34.
- Verificado: lint, typecheck, pruebas, build y base/chequeos/demo en verde en GitHub (`cobrar-flujo`).

**SIN ARREGLAR**: VD-5b (el alta y `Puerta.tsx` todavía redirigen a `/panel/vender?…&cuota=1`; hay e2e viejos que esperan esa URL) y VD-5c (prueba de que Transferencias no mezcla comprobantes).
**LO QUE NO PUDE VERIFICAR**: la hoja, el foco/Enter entre la hoja y la Entrada, la subida del comprobante contra el storage local y `vd-5.mjs` (y el `panel-vencen.mjs` actualizado): escritos según la documentación, pero no ejecutados; corren en la corrida `[pantallas]`.

## 2026-11-06 · Noche · VD-47X, VD-12b/c/d y VD-23b/c · Rapidez restante e Inicio en vivo

**QUÉ HICE**
- VD-47X (migración 4701): filtros y buscador de Socios y listas de Retención con la lista anterior atenuada mientras llega la nueva (nunca en blanco); `useOptimistic` en marcar contactado y en tareas con vuelta atrás; fotos de logo/Configuración/ticket de Caja achicadas a 800 px webp al subir (si falla, sube la original); 7 índices que empiezan por `gimnasio_id` (sacados de leer las funciones, no de `explain` real); pruebas de que dos gimnasios no se ven, que pedir otro gimnasio da error y que la recepción no ve `plata_en_riesgo`; test que prohíbe `unstable_cache` fuera de lo público; `scripts/medir/explain.mjs`.
- VD-12b/c/d y VD-23b/c (migración 3700, renumerada para correr después de la 2300): Inicio con "Últimas entradas en vivo" (hora, vía, ⛔ y Cobrar, se renueva cada 20 s) y "Para hacer hoy" con [Ver] (el profe no los ve); `numeros_inicio` respeta el interruptor existente "la recepción ve lo cobrado" (apagado por defecto); mini gráfico de 7 días en los 8 números; editor de la meta de visitas del mes en Configuración → Reglas (dueño; encargado lo ve); socio demo vencido `socio-vencido@ejemplo.invalid`.
- Verificado: lint, typecheck, pruebas, build y base/chequeos/demo en verde en GitHub (`rapidez-cache`, `inicio-en-vivo`).

**SIN ARREGLAR**: sumados VD-47Y (correr `explain.mjs` con 3.000 socios y la tabla antes/después) y VD-12e (Inicio repite filas). No se usó `next/image` en listas de socios (las fotos pasan por una ruta con sesión). "Escribile al gimnasio" espera a VD-38.
**QUÉ CONFIGURÁS VOS**: nada. Para ver el socio vencido en el demo hay que correr `usuarios-demo`.
**LO QUE NO PUDE VERIFICAR**: pantallas y e2e `vd-47x`, `vd-12b`, `vd-23c`, e `explain.mjs`: escritos según la documentación, pero no ejecutados; corren en la corrida `[pantallas]`. No hay tabla de tiempos todavía.

## 2026-11-06 · Noche · VD-1 y VD-2 · Ventana de Entrada en todas las pantallas y guía del veredicto

**QUÉ HICE**
- VD-1 (migración 0100): la ventana de Entrada vive en el layout del panel y se abre tipeando un número fuera de un campo (teclado numérico incluido), con el botón (centrado sobre la barra en el celular), con F2/Ctrl+E y con un lector USB (teclas < 30 ms: reconoce QR `GYMOS1.` y llavero). Escribir (DNI con puntos, hasta 3 coincidencias) → veredicto → anotado; se cierra sola a los N segundos; Esc devuelve el foco. Barra fija opcional a la derecha (≥ 1280 px) con las últimas 5 entradas. Usa solo las funciones de la base de siempre. `/panel/entrada` queda igual (la ventana se desactiva ahí). El botón grande de Inicio abre la ventana. Configuración → Entrada (por gimnasio, tabla `configuracion_entrada`, y "en esta compu" en el navegador, que le gana).
- VD-2 (migración 0200): `guia_entrada` devuelve por situación el botón principal y el segundo, "lo que hay que decirle", cuánto le falta y los chips (primer día, entrada 100, cumple, debe, falta firmar, menor con o sin responsable, lo dejaron pasar, cerrado). La ventana y /panel/entrada solo dibujan lo que dice la base. Una prueba de base por cada fila de la tabla con casos testigo y momento fijo.
- Verificado: lint, typecheck, 79 pruebas, base/chequeos/demo en verde en GitHub (`config-entrada`, `guia-entrada`).

**Decisiones del agente**: con "anotar solo en verde" Enter anota solo si está en verde; la ventana usa la sede principal; "Fuera del horario" ofrece Dejar pasar y Cobrar (no existe "cobrar la diferencia").
**QUÉ CORRÉS VOS**: nada; ojo, la migración 0200 debe estar aplicada antes que el código (`veredicto()` llama a `guia_entrada`): la publicación por tanda lo hace en ese orden.
**SIN ARREGLAR**: VD-1b (F abre la ficha y vuelve; sede), VD-2b (chip "tiene clase hoy", "En prueba"); alta rápida dentro de la ventana es VD-6; Cobrar en la ventana es un link a Vender hasta VD-5.
**LO QUE NO PUDE VERIFICAR**: la ventana y los e2e `vd-1`/`vd-2` (y que los e2e viejos de Entrada sigan pasando): escritos según la documentación, pero no ejecutados; corren en la corrida `[pantallas]`.

## 2026-11-06 · Noche · VD-36 y VD-23 · App del socio en 4 pestañas, progreso y bienvenida

**QUÉ HICE**
- VD-36 (migración 3600, `pestanas_app`): barra Inicio · Clases · Rutina · Yo; Clases y Rutina salen de la base (sin clases o con la sección apagada no aparecen; si la base falla quedan Inicio y Yo). `/app/yo`: mi plan, packs, pagos y asistencia, novedades, membresía y Más (invitar, referir, descargar datos, salir). Las pantallas viejas siguen accesibles; Inicio conserva Invitar, Referir e Instalar. Editados app-3, app-8 y panel-app para entrar por Yo.
- VD-23 (migración 2300, `progreso_inicio`, `marcar_bienvenida`): semana, semanas seguidas, meta del mes (dato por gimnasio, 12 por defecto), hitos 10/50/100/250/500/1000 con felicitación, "Entraste 19:04 ✓ · llevás N este mes", bienvenida de 3 pasos (tarjeta; los socios existentes no la ven), Pagar pegado al semáforo si debe o está por vencer. Nada recalculado en TypeScript.
- Verificado: lint, typecheck, 79 pruebas, build y base en verde en GitHub (incluye `app-pestanas` e `inicio-progreso`).

**SIN ARREGLAR**: sumados VD-23b (editor de la meta y "Escribile al gimnasio") y VD-23c (socio demo vencido y su e2e). Una corrida intermedia (42148233313) quedó colgada en GitHub "in_progress"; se puede ignorar.
**LO QUE NO PUDE VERIFICAR**: pantallas y e2e vd-36, vd-23, app-3, app-8, panel-app: escritos según la documentación, pero no ejecutados; corren en la corrida `[pantallas]` de la tanda.

## 2026-11-06 · Noche · VD-33 · Ingreso más lindo y "primero quién, después cómo"

**QUÉ HICE**
- Pantalla de ingreso con la marca del gimnasio (o de Gym OS en la plataforma), degradé lento, logo y tarjeta de vidrio; sin animación con reduced-motion. Socio: un solo campo "celular o mail" (con `@` pasa a mail) y debajo los tres métodos de siempre. Código de 6 dígitos que se completa solo, acepta pegado, verifica al sexto y "Reenviar en 0:59". "Olvidé mi contraseña" (`/ingresar/recuperar`) por código al mail. Errores iguales exista o no la cuenta. Sin migración; la lógica de destino pasó a `destino.ts` sin cambiar comportamiento; los selectores de los e2e viejos se mantienen.
- Verificado: lint, typecheck, 79 pruebas, build y base en verde en GitHub.

**QUÉ CONFIGURÁS VOS**: SMTP propio (Resend/Postmark) en Supabase Auth: sin eso Supabase manda 2 mails por hora y el código por mail / olvidé mi contraseña no sirven en producción (VD-45).
**SIN ARREGLAR**: sumados VD-33b (mi cuenta: contraseña y sesiones) y VD-33c (Turnstile). El límite de 5 pedidos de código por destino por hora cuenta también los reenvíos.
**LO QUE NO PUDE VERIFICAR**: `vd-33` y los e2e viejos que entran por /ingresar (app-9, panel-acceso, entrarSocio) no corrieron: escritos según la documentación, pero no ejecutados; corren en la corrida `[pantallas]` de la tanda.

## 2026-11-06 · Noche · VD-12 · Inicio del dueño y de la recepción

**QUÉ HICE**
- Botón Entrada grande (dueño, encargado, recepción) hacia `/panel/entrada` (VD-1 lo cambia por la ventana). 4 números configurables por gimnasio de 8 posibles, traídos por `numeros_inicio` en un viaje (migración 1200, sólo el dueño los guarda, la base valida claves); mini gráfico de 7 días en "Entraron hoy" y "Cobrado hoy"; cada número es un link a su lista. Recepción: barra de su turno de caja y sin "Cobrado hoy" (prudente: el interruptor no existe aún). Se conservan todos los bloques anteriores y el streaming de VD-47.
- Verificado: lint, typecheck, 79 pruebas, base/chequeos/demo en verde en GitHub (incluye `inicio-numeros.test.mjs`).

**SIN ARREGLAR**: sumados VD-12b (últimas entradas en vivo), VD-12c (interruptor de lo cobrado para la recepción), VD-12d (gráficos en los demás números).
**LO QUE NO PUDE VERIFICAR**: pantallas, e2e `vd-12` y celular 390 px: escritos según la documentación, pero no ejecutados; el build local en Windows no se pudo leer (lo cubre Verificar en GitHub).

## 2026-11-06 · Noche · VD-27 · Diseño v2: vidrio, movimiento, componentes únicos

**QUÉ HICE**
- `globals.css`: variables de movimiento y clases `.aparecer .hoja .lista-entra .tilde .pulso .brillo .esqueleto`, `:active` 0,97, tarjetas de vidrio sutil con los tokens del gimnasio, foco y selección con su acento, `prefers-reduced-motion` sin animaciones.
- Componentes nuevos `Hoja` (Esc, foco atrapado, sube desde abajo en celular), `Tilde`, `Brillo`; aplicados en Mensaje, Ctrl+K, menú móvil, avisos/tareas, cobro, entrada (el veredicto aparece al instante, el pulso solo acompaña) y los 54 `loading.tsx`. Documentado en `docs/DISENO.md`.
- Verificado: lint, typecheck, 79 pruebas, build y base en verde en GitHub.

**SIN ARREGLAR**: `.lista-entra` anima la entrada pero no el achicarse al salir.
**LO QUE NO PUDE VERIFICAR**: el aspecto (vidrio, blur, esqueleto) y el e2e `vd-27` (reduced-motion, hoja, foco, 390 px) están escritos según la documentación, pero no ejecutados; corren en la corrida `[pantallas]`. El ✅ de Puerta y Carrito pasó a un svg: ningún e2e dependía del emoji, sin correrlos.

## 2026-11-06 · Noche · VD-47 · Rapidez de verdad (parte central)

**QUÉ HICE**
- Middleware: el gimnasio por dirección en memoria 60 s (los "no existe" no se recuerdan); sesión con `getClaims` (con clave simétrica cae solo a `getUser`); matcher sin estáticos.
- `rpc()` corta a 10 s con "La base está tardando — Reintentar"; `rpcLectura` reintenta una vez (las escrituras nunca). Inicio muestra primero saludo y accesos y los números entran con Suspense y esqueleto.
- Caché 60 s con etiqueta `landing` de lo público (landing y medición), invalidada por cualquier `guardar_/publicar_/…`. Permisos, plata y socios no se cachean. Lector QR bajo demanda (`next/dynamic`).
- `scripts/medir/tiempos.mjs` (14 pantallas × 4 roles + app del socio) y paso en Pruebas completas que avisa sin cortar.
- Verificado: base, chequeos y demo en verde en GitHub; lint, typecheck, 79 pruebas unitarias y build.

**QUÉ CONFIGURÁS VOS**
- Confirmar la región de Supabase (Settings → General) y ponerla en Vercel → Settings → Functions → Region (São Paulo = `gru1`): es lo que más se nota.
- Supabase → JWT Signing Keys: migrar a claves asimétricas; sin eso `getClaims` cae a `getUser`.

**SIN ARREGLAR**
- Se sumó VD-47X: useTransition/useOptimistic, fotos a 800 px, next/image, índices por `explain analyze`, prueba de dos roles con caché y la tabla antes/después.

**LO QUE NO PUDE VERIFICAR**
- El código del middleware, `getClaims`, el timeout, la caché y el esqueleto de Inicio está escrito según la documentación, pero no está ejecutado (las pantallas corren en la corrida `[pantallas]` de la tanda). `tiempos.mjs` no se corrió: no hay tabla de tiempos todavía.

## 2026-11-06 · Noche · VD-34 · Confiabilidad base: nada dos veces, nada se pisa en silencio

**QUÉ HICE**
- **Clave de operación en los cobros** (migración 3400): `ventas.clave_operacion` con unique por gimnasio; `vender(…, p_clave_operacion)` toma un lock por clave y, si la operación ya existe, devuelve la venta hecha (`repetida: true`) sin cobrar de nuevo. Cobrar genera el uuid al primer intento y lo conserva hasta que se cobra. La firma vieja se borra en la misma migración. Probado en la base: misma clave dos veces = una venta, claves distintas = ventas distintas, dos envíos simultáneos = una venta.
- **Versión en lo que se edita** (socios, planes, configuración): `actualizado_en` / `actualizado_por` con trigger (`clock_timestamp`), `version_registro` y `verificar_version`. Si otra persona guardó mientras el formulario estaba abierto, aparece "Beto lo cambió hace 1 min. Recargá… o tocá Guardar otra vez para guardar igual" y no se borra lo escrito; el segundo Guardar sí guarda. Probado en la base (quién, cuándo, y que la recepción no ve la versión de configuración).
- El historial de configuración no cuenta `actualizado_por` como un cambio (una prueba vieja lo detectó).
- `BotonAccion` (un solo componente: se deshabilita, "Guardando…", ignora el segundo toque) en el alta/edición de socio y en el flujo de cobro; el resto de los botones ya se deshabilitaban mientras trabajan.
- `error.tsx` en la raíz, `/panel`, `/app` y `/admin` y `not-found.tsx`, todos con Reintentar · Volver · Ir al inicio (`PantallaError`).
- Verificado ejecutando: corrida de base en GitHub en verde (migraciones, pruebas de la base, chequeos, demo); lint, typecheck y 75 pruebas unitarias en verde.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Todos los formularios con `useActionState` ya devuelven lo escrito ante un error salvo los listados abajo en SIN ARREGLAR; los botones de escritura ya se deshabilitaban (los cambios de este ítem son la red de seguridad: la clave de operación cubre el reintento por red, que un botón deshabilitado no cubre).

**QUÉ CORRÉS VOS**
- Nada: se publica por tanda (prevuelo → aplicar de la migración 3400 con el resto de la tanda 1).

**SIN ARREGLAR**
- Los pagos de la app del socio (transferencia, online) todavía no llevan clave de operación: se suma cuando se toque VD-39 (cambio de plan y compra de pases).
- `npm run db:types` no se pudo correr (no hay Postgres en esta compu).

**LO QUE NO PUDE VERIFICAR**
- El e2e `scripts/e2e/vd-34.mjs` (doble clic en Cobrar, dos sesiones sobre la misma ficha, pantalla inexistente con salida): el código está escrito según la documentación, pero no está ejecutado; corre en la corrida `[pantallas]` de la tanda.

m OS — Registro

Una entrada por capa cerrada, la más nueva arriba. Siempre con esta
estructura. `docs/ESTADO.md` es una copia local de este archivo y no se
commitea.

```
QUÉ HICE                        por punto, y cómo lo verifiqué
LO QUE ENCONTRÉ SIN PEDIRTELO   lo que apareció solo
QUÉ CORRÉS VOS                  comandos exactos, en orden
QUÉ CONFIGURÁS VOS              variables, paneles, DNS
SIN ARREGLAR                    lo que quedó, y por qué
LO QUE NO PUDE VERIFICAR        obligatorio, sin adornar
```

---

## 2026-11-05 · Tanda completa · AUD-16, REV-3, REV-4, REV-6 y lo que rompía

**QUÉ HICE**
- Corrí la tanda entera (base nueva, verificar, mapa, 25 e2e y el barrido de 232 pantallas) contra todo hasta la 0135. Base y mapa en verde. Lo que falló lo seguí uno por uno y lo volví a correr solo, hasta verde.
- **El historial del socio no mostraba la transferencia rechazada** (migración 0136): rechazar un comprobante anula la venta y `mi_historial` salteaba las ventas anuladas, así que el socio nunca veía "❌ rechazado: el monto no coincide". Ahora el pago rechazado aparece con su motivo; lo anulado de verdad sigue afuera. Mismos permisos. Prueba de base nueva en historial-socio.
- **Alta de socio: un error borraba todo lo escrito.** React vacía el formulario al volver la acción; con "WhatsApp: escribilo con característica" la recepción perdía nombre, apellido y DNI. Ahora el form vuelve con lo que se había escrito.
- **Firmar un documento: el "Firmado" no se llegaba a ver.** La acción volvía a pedir la página y el documento, ya firmado, desaparecía con su confirmación. Ya no la vuelve a pedir: queda "Firmado: Reglamento" y la próxima vez que se abre ya no está.
- supabase-local: el navegador ahora sube el comprobante en un multipart (versión nueva de storage-js); la imitación de Storage lo lee igual que Supabase (vale el tipo del archivo). Era lo que cortaba cliente, rev-3 y rev-6.
- Retención: las dos listas llevan `data-lista-retencion` (la prueba agarraba la lista escondida de nombres del tablero).
- Pruebas que esperaban mal: rev-3 y cliente (el aviso de "lo revisa" o la app ya re-pintada con "Informaste…"; la fila aprobada/rechazada puede irse antes de verla), rev-3/rev-4 (el `role="alert"` vacío de Next no es un error), panel-retencion (6 listas desde COM-1), com-2 (el socio nuevo sin celular no tiene WhatsApp), com-6 (la Entrada miraba al mismo socio que acababa de firmar; ahora es otro en verde).
- Verificado ejecutando: cliente 20, rev-3 8, rev-4 7, rev-6 7, com-2 4, com-3 2, com-6 5, com-13 4, panel-retencion 7 pasos en verde; db historial-socio; typecheck, lint y chequeos en verde.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Lo del formulario que se vacía con un error puede pasar en otros formularios con `useActionState` que no devuelven los valores. Arreglé el de alta de socio (el que más se usa); los demás no los revisé uno por uno.
- REV-4 sigue anotando dos faltantes del documento: fotos en la lista de la clase y sumar a alguien desde la lista.

**SIN ARREGLAR**
- REV-6a (dos personas cobran la misma cuota a la vez → 2 ventas): toca plata, decide Mateo.
- El barrido llegó a las 232 pantallas con 1 caída: el navegador se cerró por carga en "encargado · compu · /panel/socios" (la pantalla abrió bien en las otras corridas).

**LO QUE NO PUDE VERIFICAR**
- La 0136 en Supabase: el código está escrito según la documentación, pero no está ejecutado ahí; se aplica con prevuelo → aplicar.

## 2026-11-05 · SEG-5 · Entrada sin internet

**QUÉ HICE**
- Diseño (corto, porque toca la puerta): la copia la calcula la base con `calcular_acceso` (nada se reimplementa en el navegador); sin internet solo se anota "entró" a los que la copia dice que pueden; al volver, cada entrada se registra con `privado.registrar_ingreso` —la misma función de siempre— en el momento en que pasó, así que la base vuelve a decidir y descuenta el pack o el pase como siempre. Si dice que no podía, queda **rechazado** y la pantalla lo muestra con nombre y motivo: nadie entra gratis en silencio. Sin internet no se puede "dejar pasar" (el tope de la recepción no se puede controlar).
- Entrada: "📴 ¿Se te corta internet? Guardar una copia en esta compu" (se prende por compu, no por gimnasio: la copia tiene nombres y DNI y no tiene que quedar en cualquier celular). Prendido, baja la copia cada 15 minutos; vale hasta la medianoche del gimnasio. Se da cuenta sola de que no hay internet (aviso del navegador + una prueba cada 20 s) o con "Usarla ahora".
- Sin internet: buscar por nombre, número o DNI en la copia; "✅ Entró" o "⛔ sin internet no se deja pasar". Lo anotado queda guardado en la compu y se registra solo al volver; reintentar no duplica (cada entrada lleva un id de la compu, tabla `ingresos_sin_internet`).
- Migración 0135 (`ingresos_sin_internet` con RLS, `copia_entrada`, `sincronizar_sin_internet`: hora entre 3 días atrás y ahora, socio del gimnasio, hasta 500 por vez). Prueba de base sin-internet (la copia es exactamente calcular_acceso; el que no podía queda rechazado; reintentar no duplica; hora futura y socio ajeno, error), vitest de la búsqueda y la vigencia, e2e seg-5 con el navegador cortado de verdad.
- Medido en la base grande (2.639 socios activos): la copia tarda 2,4 s en la base y pesa ~430 KB sin comprimir.

**PARA QUE MIRES VOS**
- Si alguien entró sin internet y después entró de nuevo con internet antes de sincronizar, la regla de siempre de "doble toque" (60 s) puede tomar la entrada posterior como la misma: queda una sola. Raro, y nunca da acceso de más.
- La copia guarda nombre, número, DNI y estado de cada socio en el navegador de esa compu (se borra al apagarla).

**LO QUE NO PUDE VERIFICAR**
- La pantalla: el código está escrito según la documentación, pero no está ejecutado; corre en la tanda (seg-5, que corta la red del navegador con Playwright). Un corte real (router apagado) no lo probé.

---

## 2026-11-05 · COM-14 · TV de la sala

**QUÉ HICE**
- Clases → "📺 TV de la sala" (dueño y encargado): crear una TV da un link que se abre una vez en el navegador de la TV (queda en una cookie que solo lee el servidor, como la tablet); "Sacar" la deja sin acceso.
- `/tv`: sin menú y sin sesión. La clase de ahora (o la que empieza en 15 minutos) con los anotados en grande (nombre e inicial del apellido; ✅ si ya está presente, también los que vinieron sin reservar), cuántos de cuántos, el WOD al costado, y abajo la que sigue con sus anotados. La hora arriba. Pregunta cada 15 segundos; sin conexión, sigue mostrando lo último y lo avisa.
- El token de una TV solo sirve para mirar: va en otra tabla, no en la de tablets, así que no da entrada por la puerta. La tabla no se lee directo (ni el dueño): todo por funciones.
- Migración 0134 (`pantallas_tv` con RLS cerrada; `crear_tv`, `revocar_tv`, `tvs_panel`, `tv_estado` para la TV). Prueba de base tv-sala, e2e com-14 (abre la TV y ve aparecer a un anotado nuevo), barrido con /panel/clases/tv.

**PARA QUE MIRES VOS**
- El WOD de la clase que sigue no se muestra hasta que empieza (para no adelantarlo).

**LO QUE NO PUDE VERIFICAR**
- Las pantallas: el código está escrito según la documentación, pero no está ejecutado; corre en la tanda (com-14). No la probé en una TV real (el navegador de algunos Smart TV es viejo).

---

## 2026-11-05 · COM-13 · Grados y cinturones

**QUÉ HICE**
- Clases → "🥋 Grados" (para todo el equipo; no ocupa lugar en el menú de los gimnasios que no los usan). El dueño o el encargado arman los grados de cada actividad en orden, con color y lo que pide cada uno: clases y meses desde el grado anterior.
- "✅ Listos para rendir": se calcula (no se guarda) con las asistencias y el tiempo desde el grado actual, o desde su primera clase de esa actividad si todavía no tiene. El profe, el encargado o el dueño tocan "🥋 Rindió: Amarillo" y queda anotado quién lo dio y cuándo.
- Ficha del socio: su grado por actividad, lo que le falta para el próximo, el historial y "Rindió"; el dueño o el encargado lo anulan con motivo (no se borra). App del socio: "🥋 Tu grado" con lo que le falta.
- Migración 0133 (`grados`, `grados_socio` con RLS; `grados_panel`, `guardar_grado`, `archivar_grado`, `otorgar_grado`, `anular_grado_socio`, `grados_socio`). Prueba de base grados, vitest de `textoRequisitos`, e2e com-13 (deja todo como estaba), barrido con /panel/grados.

**PARA QUE MIRES VOS**
- Decisión mía: el profe puede otorgar grados (es el que toma el examen); anularlos, solo el dueño o el encargado. La recepción los ve, no los da.

**LO QUE NO PUDE VERIFICAR**
- Las pantallas: el código está escrito según la documentación, pero no está ejecutado; corre en la tanda (com-13).

---

## 2026-11-05 · COM-12 · Lugar puntual en la sala

**QUÉ HICE**
- En una clase del panel: "📍 Lugares en la sala". El dueño o el encargado la numeran (cuántos, cómo se llaman: Bici, Reformer…, y cuáles están fuera de servicio, ej "7, 12"); vale para esa actividad en esa sede. El profe y la recepción ven quién está en cada lugar.
- En la app, en cada clase con la reserva confirmada: "📍 Elegí tu lugar", con los ocupados y los rotos sin poder tocarse; después queda "📍 Bici 3 · Cambiar". Los ocupados se ven sin nombres. La recepción también puede asignarlo.
- Dos reservas confirmadas de la misma clase nunca tienen el mismo lugar: lo garantiza un índice único en la base (no un chequeo previo), así que vale aunque toquen a la vez. Cancelar la reserva libera el lugar solo. En espera no se elige.
- Migración 0132 (`lugares_sala` con RLS, columna `reservas.lugar` con índice único, `guardar_lugares`, `lugares_clase`, `elegir_lugar`). Prueba de base lugares-sala, vitest de `leerNumeros`, e2e com-12 (deja todo como estaba).

**PARA QUE MIRES VOS**
- No toqué `reservar`: el lugar se elige en un paso aparte, justo después de reservar (la pantalla lo abre sola). Si el lugar que querías se ocupó en ese segundo, la base lo dice y elegís otro; la reserva queda igual.

**LO QUE NO PUDE VERIFICAR**
- Las pantallas: el código está escrito según la documentación, pero no está ejecutado; corre en la tanda (com-12).

---

## 2026-11-05 · COM-11 · Píxel de Meta y Google Analytics

**QUÉ HICE**
- Tu página → "📊 Medir las visitas": el dueño pega el ID del píxel de Meta (solo números) y el de Google Analytics (G-…). La base rechaza cualquier otra cosa: nunca se pega código. El encargado lo ve, no lo cambia.
- La página publicada carga el píxel (PageView) y el gtag con esos IDs; la sin publicar no carga nada. Los IDs se vuelven a validar antes de escribirlos en el script.
- Migración 0131 (columnas en `landing_gimnasio` con check, `medicion_panel`, `guardar_medicion`, `medicion_publica` para la página sin sesión). Prueba de base medicion, e2e com-11 (deja todo como estaba).

**LO QUE NO PUDE VERIFICAR**
- Que Meta y Google reciban las visitas: el sandbox no llega a esos sitios. La pantalla y la página: el código está escrito según la documentación, pero no está ejecutado; corre en la tanda (com-11).

---

## 2026-11-05 · COM-10 · Reseña y encuesta

**QUÉ HICE**
- Configuración → Mensajes: "⭐ Reseñas en Google", donde el dueño pega el link (solo https). Con link, Avisos de hoy sugiere pedir la reseña al socio cuya entrada número 10 fue en los últimos 3 días (plantilla nueva "resena", editable como las otras).
- App del socio: "⭐ Una sola pregunta" (del 0 al 10) cuando lleva 10 entradas o un mes desde su primer plan, una vez cada 90 días. Con 9 o 10: botón de reseña en Google (si hay link) e "Invitar a un amigo" (lleva a Referir). Con menos: "lo vamos a tener en cuenta".
- Resultado: "⭐ ¿Nos recomiendan?": respuestas de 90 días, puntaje (los de 9-10 menos los de 0-6) y las listas de los que recomiendan y de los que dieron 6 o menos, con link a la ficha.
- Migración 0130 (`link_resena`, plantilla `resena`, tabla `encuestas` con RLS, `guardar_link_resena`, `encuesta_socio`, `responder_encuesta`, `encuestas_panel`; copias de mensajes_catalogo, marcar_avisado, bandeja_avisos y vista_previa_mensaje). Prueba de base resena-encuesta, mensajes ahora con 14 plantillas, e2e com-10.

**PARA QUE MIRES VOS**
- La encuesta no guarda comentario de texto, solo el número (menos datos y nada sensible). Si querés un "¿por qué?" para los de 6 o menos, se suma.

**LO QUE NO PUDE VERIFICAR**
- Las pantallas: el código está escrito según la documentación, pero no está ejecutado; corre en la tanda (com-10).

---

## 2026-11-05 · COM-9 · Cupones

**QUÉ HICE**
- Planes y precios → "🏷️ Cupones": el dueño crea un código (porcentaje o monto fijo), con tope de usos, fecha hasta la que vale y los planes a los que aplica (ninguno = todos). La lista dice usos y cuántos socios trajo; se desactiva en un toque.
- En Vender: "Cupón" + "🏷️ Aplicar": la base dice si vale (vencido, agotado o inexistente avisan) y el descuento se carga solo en cada cuota, pase o pack que corresponde, con motivo "Cupón X" (nunca en productos; el monto fijo, una vez). Al cobrar, la venta queda anotada como uso del cupón.
- El Resultado muestra los cupones usados con cuántos socios trajo cada uno.
- Migración 0129 (`cupones`, `cupones_usos` con RLS y funciones), prueba de base (2 casos), vitest de `aplicarCupon`, e2e com-9, barrido con /panel/cupones.

**PARA QUE MIRES VOS**
- Decisión mía: no toqué `vender`. El cupón es un descuento como cualquier otro, así que **sigue valiendo el tope de la recepción** (un cupón de 20% con tope de 10% no pasa para la recepción). Que lo saltee sería darle más permiso: COM-9b. El alta online con cupón también quedó en COM-9b.
- Si dos personas usan el último cupón al mismo tiempo, puede pasar una vez de más (el tope se mira al aplicarlo).

**LO QUE NO PUDE VERIFICAR**
- Las pantallas: el código está escrito según la documentación, pero no está ejecutado; corre en la tanda (com-9).

---

## 2026-11-05 · COM-8 · Eventos sueltos

**QUÉ HICE**
- "🎟️ Eventos" (grupo Socios): la dueña o el encargado crean uno con nombre, día y hora, cupo, precio, para quién y una línea de qué es. Se vende en Vender como un producto (con la fecha en el nombre) y la pantalla dice "N de cupo · quedan X", con la lista de anotados. "Cancelarlo" o "Terminó" lo saca de Vender; lo vendido queda.
- La página publicada muestra "Próximos eventos" (fecha, precio, lugares, "💬 Quiero anotarme"); la app, "🎟️ Próximos eventos" con "✅ Estás anotado" si ya compró.
- Migración 0128 (`eventos` con RLS; crear, panel, cerrar, públicos, socio). Prueba de base, e2e com-8, barrido con /panel/eventos.

**PARA QUE MIRES VOS**
- Decisión mía: por dentro es un producto con stock, para no tocar `vender`. Por eso el cupo lleno y "solo socios" se avisan pero no frenan la venta (igual que el stock). Si querés que frene: COM-8b.

**LO QUE NO PUDE VERIFICAR**
- Las pantallas: el código está escrito según la documentación, pero no está ejecutado; corre en la tanda (com-8). El pago online del evento desde la app no está (se anota en recepción).

---

## 2026-11-05 · COM-7 · Kiosco con los habituales

**QUÉ HICE**
- Configuración → Reglas (con la tablet prendida): "👋 Los habituales de esta hora en la tablet", apagado de fábrica. Prendido, la tablet muestra hasta 12 socios que vinieron al menos 3 días en las últimas 4 semanas a esta hora (±45 min) y todavía no entraron hoy, con nombre e inicial del apellido.
- Tocar el nombre pide **los últimos 3 números del DNI**; después es lo mismo que escribir el DNI (mismo cálculo, mismo registro, mismo freno de intentos). Con otros números: "Probá de nuevo".
- Migración 0127 (`kiosco_habituales`, `kiosco_entrar_habitual`; copia de guardar_configuracion y configuracion_panel), prueba de base, e2e com-7 (deja todo como estaba).

**PARA QUE MIRES VOS**
- Pedir los 3 números fue decisión mía (fila en "Decisiones que tomó el agente"): sin eso, cualquiera entra tocando un nombre ajeno.

**LO QUE NO PUDE VERIFICAR**
- La tablet: el código está escrito según la documentación, pero no está ejecutado; corre en la tanda (com-7).

---

## 2026-11-05 · REV-6 · Lo que encontró "intentar romperlo"

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Doble clic en "✅ Cobrar": una sola venta ✅. Sin internet: "📡 Sin conexión" aparece y se va solo ✅.
- **Dos personas cobrando la cuota del mismo socio a la vez quedan como dos ventas** (le cubre dos meses). El día a día pide que la segunda vea "ya se cobró hace 10 s". Toca plata: no lo arreglé, quedó como REV-6a para que decidas cómo.
- La prueba de datos raros buscaba el botón "Solo dar de alta", que solo aparece con plan: ahora usa el de dar de alta. Los socios que crea la prueba quedan dados de baja al final.

---

## 2026-11-05 · COM-6 · Documentos para firmar

**QUÉ HICE**
- "✍️ Documentos para firmar" (desde Configuración → Reglas): el dueño escribe el reglamento, el deslinde y la autorización del responsable para menores. Editar un texto publica una versión nueva: lo firmado queda con su versión y a todos se les vuelve a pedir. "Dejar de pedirlo" no borra lo firmado.
- El socio firma en la app ("✍️ Para firmar": lee, pone su nombre, tilda "Leí y acepto"); la recepción, en la ficha ("Firmó en recepción"). Se guarda versión, fecha, cómo y quién lo registró. El de menores solo se le pide a un menor, con el nombre del responsable.
- En la Entrada: "✍️ Falta firmar: Reglamento" en amarillo, como el apto físico. **No cambia quién entra.**
- Migración 0126 (`documentos` y `firmas_documento` con RLS y las funciones), prueba de base, e2e com-6 (deja el demo sin documentos pedidos) y el barrido con /panel/documentos.

**PARA QUE MIRES VOS**
- Que "falta firmar" frene la entrada (si el gimnasio lo elige) es meterse en el cálculo de acceso: lo dejé como COM-6b para que lo decidas.

**LO QUE NO PUDE VERIFICAR**
- Las pantallas: el código está escrito según la documentación, pero no está ejecutado; corre en la tanda (com-6).

---

## 2026-11-05 · REV-5 · BRIK da de alta un gimnasio de cada tipo

**QUÉ HICE**
- `scripts/e2e/rev-5.mjs`: el super admin crea uno de cada tipo de la plantilla (musculación, grande, box, yoga, artes, natación, personal, 24 h); en cada uno el dueño entra con su contraseña, ve los primeros pasos, los planes de la plantilla, Clases en el menú solo si el tipo las usa, las actividades en la grilla, y le pone precio al primer plan. En el celular, sin desbordes. 15 pasos en verde en la tanda.

---

## 2026-11-05 · REV-4 · Lo que encontró el día del profe

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- El profe ve en "Clases" todas las clases del día (está bien: es la grilla), pero las de otros profes eran links y al abrirlas decía "No tenés acceso a esta pantalla · Solo podés ver la lista de tus clases". Ahora las ajenas se ven atenuadas y no se abren; las suyas, igual que antes. La base ya lo frenaba: no había nada expuesto.
- rev-4 busca en la semana un día con una clase suya (el profe del demo no siempre tiene hoy).

---

## 2026-11-05 · COM-5 · Retención en números

**QUÉ HICE**
- En Retención (dueño y encargado) y en Resultado (mes en curso), tres números que se abren con la lista de nombres: el neto del mes (altas y bajas, con el motivo de cada baja), de los que se anotaron hace 3 meses cuántos siguen al día (y quiénes se fueron), y qué parte de los al día vino menos de 4 días en los últimos 30.
- Migración 0125 (`retencion_numeros`, mismas cuentas de altas y bajas que el tablero). Prueba de base; 0,1 s con 3.000 socios.

**PARA QUE MIRES VOS**
- "Pocas visitas" usa los últimos 30 días y no el mes calendario: a principio de mes, todos darían "menos de 4".

**LO QUE NO PUDE VERIFICAR**
- Las pantallas: el código está escrito según la documentación, pero no está ejecutado; corre en la tanda (com-5).

---

## 2026-11-05 · COM-4 · Tareas del equipo

**QUÉ HICE**
- "📌 Tareas" en el menú (grupo Hoy, todos los roles): qué, para quién, para qué día y, si es sobre un socio, cuál. "➕ Nueva tarea" desde la pantalla, desde la ficha ("📌 Anotar una tarea sobre este socio") y desde cada fila de Retención ("📌 Tarea").
- En el Inicio de cada uno: "📌 Tus tareas de hoy" (las de hoy y las atrasadas) con su tilde. Hechas: quedan con quién y cuándo, y se pueden reabrir.
- Cada uno ve las suyas y las que creó; dueño y encargado ven las de todo el equipo. Migración 0124 (`tareas` con RLS, `tareas_panel`, `crear_tarea`, `marcar_tarea`), prueba de base, el barrido suma /panel/tareas.

**LO QUE NO PUDE VERIFICAR**
- Las pantallas: el código está escrito según la documentación, pero no está ejecutado; corre en la tanda (com-4 y el barrido).

---

## 2026-11-05 · COM-3 · Avisar a los anotados de una clase

**QUÉ HICE**
- En la lista de una clase: "📣 Avisar a todos (N)". Se escribe el aviso (con {nombre}, {clase} y {dia}, que se completan para cada uno), "Armar N mensajes" y aparece un botón de WhatsApp por persona. El aviso queda anotado en la clase: quién, cuándo, a cuántos y qué dijo.
- Migración 0123 (`avisos_clase` con RLS, `avisar_clase`, `avisos_clase`). Pueden los mismos que ven la lista; el profe solo en sus clases y sin teléfonos si el dueño no se lo prendió (los que no tienen celular aparecen "sin celular"). Prueba de base y e2e com-3.

**LO QUE NO PUDE VERIFICAR**
- La pantalla: el código está escrito según la documentación, pero no está ejecutado; corre en la tanda (com-3). El mail queda para cuando exista AVI-2.

---

## 2026-11-05 · COM-2 · El primer mes del socio nuevo

**QUÉ HICE**
- Ficha: "🌱 Día 9 de 30 · 1 entrada (meta 8)" durante los primeros 30 días (✅ si llegó a la meta).
- Avisos de hoy: "🎉 Bienvenida" (días 1 y 2 desde que se anotó), "🌱 Primera semana" (días 7 a 9) y "🎉 Primer mes" (30 a 33), con su WhatsApp; los dos nuevos mensajes se editan en Configuración → Mensajes como los demás (13 en total).
- Retención → En riesgo: el nuevo que en su primera semana vino menos de 2 veces ("Primera semana: vino 1 vez (la meta del mes es 8)").
- La meta se cambia en Configuración → Reglas (1 a 60, por defecto 8).
- Migración 0122 (todo calculado de suscripciones e ingresos; copias de guardar_configuracion, configuracion_panel, mensajes, bandeja, marcar_avisado, vista previa y riesgo_baja). Prueba de base; e2e com-2. cfg-5 y la prueba de mensajes pasan a 13 mensajes.

**LO QUE NO PUDE VERIFICAR**
- Las pantallas: el código está escrito según la documentación, pero no está ejecutado; corre en la tanda (com-2, cfg-5).

---

## 2026-11-05 · COM-1 · Riesgo de baja

**QUÉ HICE**
- Retención abre con una lista nueva, "🎯 En riesgo": los que todavía pagan pero muestran señales de irse, cada uno con su nivel (🔴 alto / 🟡 medio), el porqué en una línea ("Venía 3 veces por semana y hace 16 días que no viene · Vence el 11/11 y no renovó") y el WhatsApp con el mensaje de "No viene". La ficha lo dice arriba.
- Reglas en SQL, sin IA, calculadas al abrir (migración 0121, `riesgo_baja`): viene la mitad o menos que su promedio de las 8 semanas anteriores; reservaba seguido y hace 2 semanas que no reserva; pidió una pausa en el último mes o pidió la baja; y, si ya hay otra señal, que vence en una semana sin renovar. Alto: pidió la baja o dos señales. Los vencidos no entran (ya están en Vencidos).
- La ven los mismos que Retención (también la recepción, D2). Con 3.000 socios: 0,13 s.

**SIN ARREGLAR**
- "No abre la app": la app no guarda cuándo se abre, así que no hay de dónde calcularlo. Sumarlo es guardar un hecho nuevo (última vez que abrió la app); lo dejo anotado acá.

**LO QUE NO PUDE VERIFICAR**
- La pantalla: el código está escrito según la documentación, pero no está ejecutado; corre en la tanda (com-1, panel-retencion).

---

## 2026-11-05 · REV-1a · "Le prometieron pagar"

**QUÉ HICE**
- Vencen hoy tiene arriba "🤝 Le prometieron pagar": los que dejaron pasar ayer u hoy sin poder entrar, con quién los dejó pasar, el motivo, lo que dice la puerta ahora, WhatsApp y Cobrar. Sale solo cuando pagan (usa el mismo cálculo de la puerta; no se guarda nada).
- Migración 0120 (`prometieron_pagar`): el dueño y el encargado ven todos; la recepción, los que dejó pasar ella (no ve más de lo que ya veía). Prueba de base.

**PARA QUE MIRES VOS**
- Que la recepción vea solo los suyos fue decisión mía, para no darle más acceso: si querés que vea todos, es un cambio de una línea.

**LO QUE NO PUDE VERIFICAR**
- La pantalla: el código está escrito según la documentación, pero no está ejecutado; corre en la tanda (rev-1).

---

## 2026-11-05 · REV-2a · Sumar una sede

**QUÉ HICE**
- Configuración → Gimnasio: "➕ Sumar una sede" (solo el dueño). Pide el nombre; la sede se crea con su caja (el trigger que ya existía) y queda abajo para completar dirección y teléfono. Lo que no se guardó de las otras sedes no se pierde.
- Migración 0119 (`sumar_sede`, solo dueño, nombre único sin importar mayúsculas) y prueba de base.
- El recorrido del cliente (AUD-16) suma una sede en su gimnasio nuevo; rev-2 solo comprueba el botón (sumar una en el demo cambiaría las demás pruebas).

**LO QUE NO PUDE VERIFICAR**
- La pantalla: el código está escrito según la documentación, pero no está ejecutado; corre en la tanda.

---

## 2026-11-05 · REV-1b · El WhatsApp al prospecto lleva la página

**QUÉ HICE**
- En Prospectos, el WhatsApp armado lleva abajo del mensaje el link de la página del gimnasio, solo si está publicada (si no, el link mostraría "Próximamente"). No toqué la plantilla ni la base: la dirección la arma el panel igual que en "Tu página".
- "📡 Sin conexión" (de REV-6) también entra en esta tanda.

**LO QUE NO PUDE VERIFICAR**
- El código está escrito según la documentación, pero no está ejecutado: lo prueba rev-1 en la tanda.

---

## 2026-11-05 · REV-2 · Segunda pasada: una semana como dueña (celular)

**QUÉ HICE**
- `scripts/e2e/rev-2.mjs` (`npm run e2e:rev-2`): la dueña, en el celular, recorre la tabla "Dueño" del día a día: Inicio con sus 4 números, el resumen de la semana, contrata a alguien, le saca el acceso, mira los permisos del encargado, prepara un aumento, publica y quita una novedad, abre la campaña, Resultado contra el mes anterior y exportar el mes; Retención y Vencen hoy. Ninguna pantalla se desborda.
- Arreglado en la misma vuelta: la contraseña provisoria (al dar acceso o generar una nueva) ahora tiene "📲 Mandar por WhatsApp" con el mail, la contraseña y dónde entrar, como pide el documento ("contraseña provisoria por WhatsApp"). El texto se arma en el navegador y sale solo si se toca.

**Fila por fila (Dueño)**
| Caso | Ahora |
|---|---|
| ¿Me roban? | ✅ Resumen del día y de la semana, cruces de caja |
| Vacaciones | ✅ permisos del encargado (EQU-2) |
| Contrata a alguien | ✅ (desde hoy con WhatsApp) |
| Echa a alguien | ✅ Sacar acceso; su historia queda |
| Abre otra sede | ❌ no se puede sumar una sede desde el panel → REV-2a |
| Cambia los precios | ✅ aumento programado |
| El contador | ✅ exportar el mes |
| Aviso a todos | ✅ novedad en la app + campaña |
| ¿Cómo vengo? | ✅ Resultado contra el mes anterior |

**LO QUE NO PUDE VERIFICAR**
- El botón de WhatsApp de la contraseña: el código está escrito, pero no está ejecutado; corre en la tanda (rev-2 y cliente).

---

## 2026-11-05 · REV-1 · Segunda pasada: un día entero como recepción

**QUÉ HICE**
- `scripts/e2e/rev-1.mjs` (`npm run e2e:rev-1`): Ana hace el día de `10-DIA-A-DIA-Y-CASOS-RAROS.md` en orden: cierra la caja que quedó abierta y abre la suya a ciegas, Entrada con foco, un vencido en rojo que deja pasar con "Paga a la tarde", anota a un curioso como prospecto con WhatsApp, saca $3.000 para el proveedor, abre Transferencias, una baja que empieza por el motivo, cierra justo con $7.000 y lo puede mandar por WhatsApp; la dueña, en el celular, ve a quién dejaron pasar y el turno. 12 pasos en verde contra la app local.

**Fila por fila**
| Hora | El documento | Ahora |
|---|---|---|
| 6:55 | PIN, abrir caja, cerrar la de ayer | ✅ (el PIN lo prueba caj-3) |
| 7:00 | Entrada con foco | ✅ |
| 7:10 | Dejar pasar con motivo → "le prometió pagar" a la tarde | ⚠️ la dueña lo ve en Inicio; nadie se lo recuerda a la tarde → REV-1a |
| 8:00 | Clase llena, anotarlo en la espera | ✅ (cla-1 / panel-clases) |
| 9:30 | Prospecto en 10 s + link de la página | ⚠️ WhatsApp sin el link → REV-1b |
| 10:00 | Pase de prueba gratis una vez por DNI | ❌ → REV-1c (da acceso sin pagar: decide Mateo) |
| 14:00 | Cambio de turno, arqueo ciego, aviso a la dueña | ✅ |
| 15:00 | Retiro con foto del ticket; stock sube | ✅ foto (CAJ-4); ⚠️ el stock en el mismo paso pide que la recepción cargue mercadería → REV-1d (decide Mateo) |
| 18:00 | Cancelar clase con aviso | ✅ (cla-3) |
| 19:00 | Aprobar transferencia | ✅ |
| 21:00 | Baja: motivo + ofrecer pausa | ✅ |
| 22:00 | Cierre → resumen a la dueña | ✅ |

---

## 2026-11-05 · SEG-8 · El estado de muchos socios juntos, más rápido

**QUÉ HICE**
- No hice una segunda versión "en lote" del cálculo de acceso: serían dos cálculos que pueden decir cosas distintas (la regla es uno solo). Medí dónde se iba el tiempo y lo saqué sin tocar el cálculo:
  - La suscripción vigente se buscaba recorriendo toda la tabla: el índice de 0114 es parcial (`baja_en is null`) y la búsqueda pide también las bajas futuras. Índice nuevo `(socio_id, inicio desc)`, y otro para el precio por plan. Calcular el acceso de 3.019 socios: 2,9 s → 1,0 s.
  - Socios con filtro de estado ("al día", "vencidos"…) calculaba a todos y después cortaba en 30. Ahora los candidatos llegan ordenados y Postgres deja de calcular apenas junta los 30: 1.716 ms → 63 ms.
  - La retención (Inicio, Avisos, Vencen hoy, Retención) llamaba una función por cada ingreso de las últimas 8 semanas para la frecuencia (58 mil llamadas): ahora es la misma cuenta escrita en la consulta. −200 ms.
- Migración 0117. Mismos resultados: la retención del demo grande da exactamente lo mismo antes y después (comparado fila por fila), y el filtro devuelve los mismos socios (salvo cuál de dos con el mismo nombre). Las 355 pruebas de la base en verde.
- Con 3.000 socios y la máquina corriendo la tanda de pantallas al mismo tiempo: Inicio 613 ms, Retención 667, Avisos 693, Vencen hoy 812, Retención (resumen) 807 (antes 1,0–1,3 s), Socios "al día" 63 (antes 2,6 s).

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- La prueba "15" de la segunda revisión usaba `caja_abierta`, que SEG-7 le sacó al equipo: ahora prueba con `cajas_sede` (lo que usa la pantalla).

**SIN ARREGLAR**
- Lo que queda de la retención es el precio de cada vencido (`privado.precio_para`, una función SQL con `search_path` fijo que Postgres no puede expandir: ~0,4 ms por llamada) y armar los mensajes. Bajarlo pide reescribir la función del precio: es plata, no lo toqué.

---

## 2026-11-05 · SEG-7 · Funciones viejas sin pantalla

**QUÉ HICE**
- `cobrar_cuota`, `precio_cuota` y `caja_abierta` (la primera versión del cobro) ya no se pueden llamar desde el equipo: Vender (`vender`, `precios_venta`, `cajas_sede`) hace todo lo que hacían y ninguna pantalla las usaba. Siguen para el servidor. `asignar_plan` queda: lo usan el alta de un socio y la ficha.
- Migración 0116 (solo `revoke`); las pruebas `cobro` (ahora cobra la cuota con Vender y la vieja da "permission denied") y `pin-equipo` (prueba el PIN con `cajas_sede`).

**PARA QUE MIRES VOS**
- Toca permisos, pero para sacar acceso (lo que pide el ítem).

---

## 2026-11-05 · SEG-6 · Datos personales

**QUÉ HICE**
- App del socio → Mi membresía → "⬇️ Descargar mis datos": un JSON con lo que el gimnasio guarda de él (sus datos, membresías, coberturas, pagos, entradas, reservas y pesos anotados).
- Ficha de un **ex socio** (dado de baja), solo el dueño: "🗑️ Borrar sus datos personales" (escribiendo BORRAR). Se borran nombre, DNI, teléfono, mail, nacimiento, foto, contacto de emergencia, responsable, llavero, notas del equipo y su prospecto; quedan los pagos y las entradas a nombre de "Socio borrado #N". No se deshace.
- Migración 0115 (`socios.anonimizado_en`, `mis_datos`, `anonimizar_socio`), caso en la prueba de base `pedidos-socio`, `e2e:seg-6`.

**SIN ARREGLAR**
- La foto en el bucket no se borra (se borra la referencia): queda para cuando se limpie Storage.

---

## 2026-11-05 · SEG-4 · Rendimiento con 3.000 socios

**QUÉ HICE**
- Base aparte con el demo de 3.019 socios, 17.896 cuotas y 80.409 entradas; `npm run medir -- URL` (`scripts/medir-rendimiento.mjs`) mide 24 funciones de pantalla como la dueña.
- Lo lento: todo lo que calcula el estado de cada socio (retención, Vencen hoy, Inicio, Avisos, el filtro "al día" de Socios). Buscaban por socio o por venta con índices que empezaban por `gimnasio_id`, o sin índice. Migración 0114: 13 índices (solo índices; no cambia ningún resultado).
- Antes → después (ms, con la máquina ocupada corriendo la tanda de pantallas al mismo tiempo): Socios filtro "al día" 16.424 → 2.579 · Inicio 6.392 → 1.248 · Retención (resumen) 5.683 → 1.347 · Vencen hoy 5.564 → 1.238 · Avisos 5.371 → 1.057 · Retención 5.097 → 1.103 · buscar texto 472 → 74. El resto ya estaba por debajo de 1 s (ficha 37, estado de acceso 6, clases del día 2).

**SIN ARREGLAR**
- Seis funciones siguen entre 1 y 2,6 s con 3.000 socios (con la máquina cargada): calculan el acceso socio por socio. Bajarlas pide calcular el estado de todos juntos (una versión "en lote" del cálculo de acceso): toca el corazón del sistema, lo anoté como SEG-8 para hacerlo con cuidado y con las pruebas de acceso al lado.
- La descarga de todos los datos tarda 2 s en armar las entradas (80 mil filas): es una descarga, queda así.

---

## 2026-11-05 · SEG-2 · Exportar todos los datos del gimnasio

**QUÉ HICE**
- Configuración → Gimnasio → "📦 Tus datos" → "Descargar todos los datos": un zip con un CSV por tabla (socios, membresías, coberturas, pausas, packs, ventas y sus ítems, pagos, entradas, caja, equipo, clases, reservas, asistencias, prospectos, productos, gastos, rutinas…), para abrir con Excel. Sin columnas internas (rutas de archivos, preferencias, `gimnasio_id`).
- Solo el dueño (lo decide la base); la recepción recibe 403 "No se pudo exportar".
- Migración 0113 (`exportar_gimnasio`, lista cerrada de tablas), caso en la prueba de base `abono-brik`, `e2e:seg-2`. Dependencia nueva: `fflate` (arma el zip; ya venía de otra dependencia).

---

## 2026-11-05 · SEG-1 · Límite de pedidos de código

**QUÉ HICE**
- Antes de mandar un código (SMS o mail), el servidor le pregunta a la base: hasta 5 por celular o mail y 20 por conexión (IP) en una hora; si no, "Pediste muchos códigos: esperá una hora y probá de nuevo". El destino se guarda como hash (no el número ni el mail) y se borra a las 24 h, en el mismo pedido (sin cron).
- Migración 0112 (`pedidos_codigo` sin acceso directo y sin `gimnasio_id` —sumada a las excepciones—; `registrar_pedido_codigo`, solo el servidor), prueba de base `limite-codigos`, `e2e:seg-1`.

**LO QUE NO PUDE VERIFICAR**
- La IP real detrás de Vercel (`x-forwarded-for`): el código está escrito según la documentación, pero no está ejecutado en Vercel.

---

## 2026-11-05 · DIS-14 · Pulido de Ingresar, Elegir y No encontrado

**QUÉ HICE**
- `e2e:dis-14`: Ingresar (gimnasio, socio, plataforma), Gimnasio no encontrado y Elegir en el celular (sin desborde, botones altos, un verde), capturas `dis14-*`. Con AUD-15 ya se sumaron el loading y los gimnasios del socio en Elegir; no hizo falta más código.

---

## 2026-11-05 · DIS-15 · Pulido del super admin

**QUÉ HICE**
- Un solo verde: en la lista, cada gimnasio tenía su "Entrar al panel" verde (más "Crear gimnasio"); ahora el verde es crear. En el detalle, "Sumar" persona y "Sumar" dirección dejan de ser verdes (queda "Entrar al panel").
- `e2e:dis-15`: lista y detalle en compu y celular (sin desborde, botones altos, un verde), capturas `dis15-*`.

---

## 2026-11-05 · ADM-3 y ADM-2 · Abono de Gym OS y suspensión gradual (D13, D11)

**QUÉ HICE**
- **ADM-3 (D13)**: Super admin → "💳 Planes de Gym OS" (nombre y precio por mes, los cargás vos; el código no inventa precios). En el detalle de cada gimnasio: su plan, "Registrar pago" (monto, hasta qué día cubre, nota) y los últimos pagos (se anulan, no se borran). La lista muestra el estado de cada uno.
  - Estado calculado: sin abono (sin plan, o el demo) · al día · por vencer (7 días antes) · vencido. Al asignar un plan, 14 días hasta el primer pago: nadie queda trabado por asignarle un plan.
- **ADM-2 (D11)**: 7 días antes el dueño ve el aviso arriba del panel. Vencido, todo el equipo ve "🔒 solo lectura" y **la base no deja** que el equipo venda ni edite (ventas del mostrador, socios, planes, precios, productos, equipo, configuración, página, gastos, caja y membresías). La puerta, la app del socio (reservar, pagar online, informar transferencia, vincular su cuenta) y el alta online siguen andando: el trigger solo frena a alguien del equipo. BRIK (el admin) puede igual.
- Migraciones 0110 (`plataforma_planes` y `plataforma_pagos` sin acceso directo; `gimnasios.plataforma_plan_id`, `plataforma_desde`; siete funciones) y 0111 (trigger `solo_lectura` en 12 tablas, security definer para que valga también en escrituras directas con RLS). Prueba de base `abono-brik`; `db:pruebas` completo en verde con los triggers puestos; `e2e:adm-3`.

**PARA QUE MIRES VOS**
- Toca permisos y plata (D11 y D13 aprobadas). Por defecto ningún gimnasio tiene plan: nada cambia hasta que le asignes uno.

---

## 2026-11-05 · ADM-6 · Novedades de Gym OS para todos los dueños

**QUÉ HICE**
- Super admin → "📣 Novedades para los dueños": título, texto y link opcional; cuántos la cerraron; Retirar.
- Cada dueño la ve arriba en su Inicio hasta tocar "Entendido" (por persona y gimnasio).
- Migración 0109 (`novedades_plataforma` —sin `gimnasio_id`: es de la plataforma, sumada a la lista de excepciones de SCHEMA y chequeos— y `novedades_plataforma_cerradas` con `gimnasio_id`; cinco funciones), caso en la prueba de base `plantillas-gimnasio`, `e2e:adm-6`.

---

## 2026-11-05 · ADM-4 · Salud de cada gimnasio en el super admin

**QUÉ HICE**
- En la lista del super admin, cada gimnasio: "🩺 El equipo entró hace N días · N ventas en 7 días ($…)" y "Dejó de usarse" en rojo si tiene más de 7 días y ninguna entrada ni venta en los últimos 7 (no en el demo). Soporte BRIK no cuenta como "el equipo entró".
- Migración 0108 (`admin_salud_gimnasios`), caso en la prueba de base `plantillas-gimnasio`, `e2e:adm-1` lo mira.

---

## 2026-11-05 · ADM-1 · Plantillas por tipo de gimnasio al crear

**QUÉ HICE**
- Super admin → Nuevo gimnasio → "Tipo de gimnasio" (los 8 de la tabla de la hoja de ruta, o sin plantilla). Prende el modo de clases, qué cobra (membresía, pase, pack) y turnos fijos; crea actividades y planes de ejemplo.
- Los planes de ejemplo van **sin precio**: no se venden hasta que el dueño los pone (Primeros pasos se lo pide). No invento precios.
- Solo el admin, y solo en un gimnasio sin planes. Si la plantilla fallara, el gimnasio queda creado y se dice.
- Migración 0107 (`privado.plantillas_gimnasio`, `admin_aplicar_plantilla`), prueba de base `plantillas-gimnasio` (las 8 se aplican), `e2e:adm-1`.

---

## 2026-11-05 · AUD-15 · Super admin, Ingresar y Elegir gimnasio

**QUÉ HICE**
- Inventario en `docs/paneles/acceso.md` y `e2e:acceso` (contraseña mala, soy socio, la dueña en /admin sin acceso, el admin al super admin, dirección inexistente).
- Arreglado: un socio que entraba desde la dirección de Gym OS veía "Tu cuenta no tiene ningún gimnasio": ahora ve sus gimnasios con link a su app. Faltaba `loading.tsx` en Ingresar y Elegir.

---

## 2026-11-05 · DIS-1 · Pulido de Inicio

**QUÉ HICE**
- Revisé Inicio en el celular con la captura de la dueña (primeros pasos, accesos, números, "Ahora y lo que sigue"): la lista de primeros pasos ya arranca cerrada, un solo verde (el primer acceso), números de a dos. No hizo falta cambiar código.
- La tanda lo encontró en la recepción: cuando una etiqueta ocupa dos renglones ("Transferencias por aprobar"), su número quedaba más arriba que el de al lado. Ahora los números de una fila arrancan a la misma altura.
- `e2e:dis-1` lo mide para los cuatro roles (sin desborde, botones de 44 px o más, un verde, números en dos filas), capturas `dis1-celu-*`.

---

## 2026-11-05 · AUD-14 · Inicio de cada rol, botón por botón

**QUÉ HICE**
- Inventario en `docs/paneles/inicio.md` y `e2e:inicio`: los cuatro roles abren Inicio (saludo, 4 números, "Ahora y lo que sigue") y cada acceso rápido abre su pantalla sin error; la dueña elige accesos.
- **Encontrado**: los socios que piden la baja desde la app (APP-8) estaban en la campana y en la ficha, pero no en Inicio (donde están las pausas para aprobar y las ventas para anular). Ahora "👋 Pidieron la baja" con el motivo, para dueño, encargado y recepción. Migración 0106 (`pedidos_baja_pendientes`), caso nuevo en `pedidos-socio`.

---

## 2026-11-05 · RUT-3 · Marcas personales y progreso

**QUÉ HICE**
- Por ejercicio, la marca (el mayor peso, con cuántas repeticiones y cuándo) y un gráfico chico de lo anotado (últimos 30). Se calcula de lo que anotó.
- El socio lo ve en "Mi rutina" → "🏆 Mis marcas". El profe (y el dueño y el encargado), desde "Asignar a un socio" → "🏆 Progreso" (`/panel/rutinas/socio`).
- Migración 0105 (`progreso_socio`), caso nuevo en la prueba de base `rutina-socio`, `e2e:rut-2` lo recorre.

---

## 2026-11-05 · RUT-2 · Asignar rutina; el socio la ve y anota sus pesos

**QUÉ HICE**
- En una rutina, "👤 Asignar a un socio": se busca por nombre (el profe con su búsqueda de nombre y semáforo) y se asigna; si tenía otra, se reemplaza (las anteriores quedan como historia).
- App del socio: "💪 Mi rutina" (aparece si tiene una), día por día, cada ejercicio con series × repeticiones, nota y video; "✍️ Anotar" kilos y repeticiones, y queda como "Última: 60 kg × 10 · 5/11". Cada registro es un hecho (no se edita; se puede anular).
- Migración 0104 (`rutinas_socio`, `registros_ejercicio` con RLS, FK compuestas y trigger de hecho inmutable; `asignar_rutina`, `quitar_rutina_socio`, `rutina_de_socio`, `anotar_ejercicio`, `anular_registro`), prueba de base `rutina-socio`, `e2e:rut-2`.

**SIN ARREGLAR**
- La ficha del socio todavía no muestra su rutina (el profe no abre fichas; se asigna desde la rutina).

---

## 2026-11-05 · RUT-1 · Ejercicios y rutinas del gimnasio

**QUÉ HICE**
- Sección nueva **💪 Rutinas** (grupo Socios; dueño, encargado y profe; se puede apagar): la biblioteca de ejercicios (nombre, grupo muscular, video por link) y las rutinas plantilla por días ("Día 1", "Día 2"…), cada día con sus ejercicios, series, repeticiones y nota.
- El profe la tiene en su menú y en sus accesos de Inicio.
- Migración 0103 (`ejercicios`, `rutinas`, `rutina_ejercicios` con RLS, FK compuestas y unique por gimnasio; seis funciones), prueba de base `rutinas`, `e2e:rut-1`, inventario `docs/paneles/rutinas.md`, el barrido suma las rutas nuevas.

---

## 2026-11-05 · DIS-11 · Pulido de Equipo y Mi cuenta

**QUÉ HICE**
- Mi cuenta tenía dos verdes (Guardar contraseña y Guardar PIN): ninguno es "la" acción de la pantalla, quedan blancos. Equipo: el verde es "Sumar al equipo".
- `e2e:dis-11`: Equipo, Qué hizo cada uno y Mi cuenta en el celular (sin desborde, botones de 44 px o más, a lo sumo un verde), capturas `dis11-*`.

---

## 2026-11-05 · EQU-3 · Qué hizo cada uno

**QUÉ HICE**
- Equipo → "📋 Qué hizo cada uno" (`/panel/equipo/actividad`, día por día): por persona, ventas y cuánto, descuentos, anulaciones, entradas (y cuántas dejó pasar sin poder) y cierres de caja con su diferencia. Abajo, "👀 Para mirar": cada descuento, anulación, dejado pasar y caja que no cerró justa, con la hora y el motivo.
- Se calcula de los hechos (nada se guarda aparte). Lo ve el dueño; el encargado si ve el Resultado (es plata: mismo interruptor de EQU-1); la recepción no.
- Migración 0102 (`actividad_equipo`), prueba de base `actividad-equipo`, `e2e:equ-3`.

---

## 2026-11-05 · EQU-2 · El profe busca socios (D3)

**QUÉ HICE**
- El profe ahora tiene el buscador (Ctrl+K / 🔍): ve nombre, foto (si tiene) y semáforo con un texto genérico ("Puede entrar" / "No puede entrar"). Sin número de socio, teléfono, DNI ni plata, y no abre la ficha. Los dados de baja no aparecen.
- Migración 0101 (`buscar_socios_profe`), prueba de base `profe-busca-socios`, `e2e:equ-2`.

**PARA QUE MIRES VOS**
- Toca permisos (le da al profe una búsqueda que no tenía). Aprobado en D3, con lo mínimo que dice D3.

---

## 2026-11-05 · EQU-1 · Interruptores de permisos por gimnasio (D4)

**QUÉ HICE**
- Equipo → "🔐 Qué puede hacer cada rol" (el dueño los cambia; el encargado los ve). Se guardan al tocar y quedan en el historial de configuración:
  - 🛎️ la recepción ve lo cobrado del día ("Cobrado hoy" en su Inicio) — apagado por defecto;
  - 🛎️ la recepción vende productos — prendido por defecto; apagado, Vender no le muestra productos y la base no la deja;
  - 💪 el profe ve el teléfono del socio en la lista de su clase (con link a WhatsApp) — apagado por defecto;
  - 🧭 el encargado ve el Resultado — prendido por defecto; apagado, no está en su menú y la base no le da ni el Resultado ni la exportación.
  - El descuento de la recepción ya tenía su tope (Configuración → Cobros): se muestra ahí con el link.
- Los valores por defecto dejan todo como estaba.
- La tanda encontró que el menú del encargado seguía mostrando Resultado con el permiso apagado (la base ya no se lo daba): el menú ahora oculta una sección que la base manda apagada aunque no sea de las que el gimnasio apaga (vitest nuevo).
- Migración 0100 (cuatro columnas en `configuracion_gimnasio`; `permisos_equipo`, `guardar_permisos_equipo`, `privado.exigir_resultado`; copias de `panel_gimnasio`, `panel_inicio`, `public.vender`, `lista_clase` —cambia lo que devuelve: se borra y se crea—, `resultado_mes`, `exportar_mes`, `etiqueta_campo`), prueba de base `permisos-equipo`, `e2e:equ-1`.

**PARA QUE MIRES VOS**
- Toca permisos. Está aprobado en D4 y por defecto no cambia nada, pero revisalo.

---

## 2026-11-05 · AUD-12 · Equipo y Mi cuenta botón por botón

**QUÉ HICE**
- Inventario en `docs/paneles/equipo.md` y `e2e:equipo` (sumar sin mail, cambiar rol, confirmar "hacer dueño", sacar y devolver acceso, el encargado sin botones, Mi cuenta en el celular).
- Arreglado: elegir "Dueño" en el selector de rol le daba todo al toque; ahora pide confirmación en pantalla. Los campos de contraseña de Mi cuenta tienen nombre (solo tenían el texto de ejemplo). Faltaba `loading.tsx` en las dos rutas.

**SIN ARREGLAR**
- No se puede editar el nombre o la sede de alguien del equipo (anotado en el inventario).

---

## 2026-11-05 · DIS-12 · Pulido de la app del socio

**QUÉ HICE**
- Un solo verde por pantalla: en el inicio, "📷 Escanear el QR" es verde solo si puede entrar sin deber (si debe, el verde es pagar); "Invitar para hoy" y "Mandar por WhatsApp" dejan de ser verdes. En Clases, cada "Reservar" deja de ser verde (eran todos). En Mi membresía, el motivo de baja elegido se marca con el borde, no en verde.
- `e2e:dis-12`: inicio, clases, novedades, historial y mi membresía en el celular (sin desborde, botones de 44 px o más, a lo sumo un verde), con capturas `dis12-*`.

---

## 2026-11-05 · REF-1 · Invitá a un amigo

**QUÉ HICE**
- App del socio → "🤝 Invitá a un amigo": su link (`/?ref=CÓDIGO#probar`) para mandar por WhatsApp o copiar, y cuántos amigos dejaron sus datos y cuántos se hicieron socios.
- El amigo abre la página, ve "🤝 Te invitó un amigo" en "Probá una clase" y deja sus datos: entra a Prospectos como "🤝 Recomendado por …". Un código que no es del gimnasio no cuenta (y no frena el pedido). Sin la página recibiendo pedidos, la tarjeta no aparece.
- Migración 0099 (`socios.codigo_referido` único por gimnasio, `prospectos.referido_por` con FK compuesta, `mi_link_referido`; copias de `quiero_probar` con `p_ref` —se borra la firma vieja— y `prospectos_panel`), prueba de base `referidos`, `e2e:ref-1`.

**SIN ARREGLAR**
- El **pase de prueba** y el **premio** (días gratis al que recomendó) no están: tocan quién entra y plata. Quedan como REF-2, esperando tu decisión (va junto con CLA-6).

---

## 2026-11-05 · APP-9 · Entrar con mail y código, o con contraseña

**QUÉ HICE**
- `/ingresar` → "💪 Soy socio": tres formas, **📱 Celular** (como antes), **✉️ Mail** (código al mail) y **🔑 Contraseña**.
- Con el mail, el servidor vincula la cuenta a los socios de ese gimnasio con ese mail verificado (los menores no: los vincula el celular del adulto). Si el socio ya entraba con el celular, lo dice en vez de "tu mail no está cargado".
- "Mi membresía" → 🔑 crear o cambiar la contraseña (si entró con mail).
- Migración 0098 (`vincular_socios_por_email`, solo el servidor), prueba de base `entrar-con-mail`, `e2e:app-9`. `supabase-local` ahora confirma el mail al verificar el código, como GoTrue.

**QUÉ CONFIGURÁS VOS**
- Supabase → Authentication → Email Templates → "Magic Link": que el mail muestre el código `{{ .Token }}` (por defecto manda un link, y la app pide el código de 6 números).
- El mail de Supabase sin SMTP propio manda pocos por hora: para usarlo de verdad hace falta SMTP (Resend, AVI-2).

**LO QUE NO PUDE VERIFICAR**
- El mail real (plantilla y envío): el código está escrito según la documentación, pero no está ejecutado contra Supabase.

---

## 2026-11-05 · APP-6 · Novedades del gimnasio en la app

**QUÉ HICE**
- 📬 Avisos de hoy → "📣 En la app de los socios": el dueño o el encargado escriben un aviso corto (hasta 280 letras) y hasta qué día se ve (máximo 60 días, hasta 3 a la vez); lo quitan cuando quieran. La recepción las ve, no publica.
- En la app, arriba del semáforo, las novedades vigentes.
- Migración 0096 (`novedades_gimnasio` con RLS y FK compuesta; `novedades_panel`, `publicar_novedad`, `quitar_novedad`, `novedades_socio`), prueba de base `novedades-gimnasio`, `e2e:app-6`.

**SIN ARREGLAR**
- La foto opcional del pedido original no está: pide subir imágenes por el servidor como las de la marca (CFG-2). Anotado en `docs/paneles/app.md`.

---

## 2026-11-05 · AUD-11 · App del socio botón por botón

**QUÉ HICE**
- Inventario en `docs/paneles/app.md` y `e2e:app` (celular: semáforo, campana, historial, mi membresía y "Volver", días de Reservar, el logo vuelve al inicio, Salir; y con clases "sin reserva").
- Arreglado:
  - con clases **sin reserva**, la app mostraba "➕ Reservar" y la reserva fallaba al tocar: ahora "🗓️ Ver horarios", "No hace falta reservar: vení directo" y la lista sin botones;
  - "← Volver" en Clases perdía el socio elegido (cuentas con varios socios);
  - el logo de arriba recargaba toda la página (`<a>`): ahora `<Link>`;
  - faltaba `loading.tsx` en el inicio de la app y en Clases.

**LO QUE NO PUDE VERIFICAR**
- `e2e:app` se corre en la tanda final (el servidor de pruebas estaba ocupado con la tanda anterior).

---

## 2026-11-05 · CLA-9 · Faltas que se descuentan del pack

**QUÉ HICE**
- Configuración → Clases → "Si reserva y no viene": tercera opción **🎟️ Se descuenta del pack** (D16).
- Una falta (reserva confirmada con pack de una clase que terminó sin presente y sin cancelar) cuenta como clase usada **de ese pack**. No se guarda nada: se calcula con `privado.faltas_pack(pack, momento)` y da lo mismo en la puerta, al reservar, en la ficha y en la app. Cuenta desde que se prende la regla; si se apaga, deja de contar.
- No es falta si tiene el presente, o si ese día entró por la puerta (no se cobra dos veces con los packs que se descuentan al entrar). El presente tarde (hasta 24 h después) no queda frenado por su propia falta.
- La app lo avisa con las reglas de reserva: "Si reservás con tu pack y no venís sin cancelar, la clase se descuenta igual."
- Migración 0095 (copias de `via_pack`, `habilitacion_clase`, `ficha_socio`, `mi_socio`, `guardar_configuracion`, `politica_reservas`), prueba de base `faltas-pack` (con momento fijo), `e2e:cla-9`.

**PARA QUE MIRES VOS**
- Toca cómo se cuentan los packs (la puerta y la reserva): está aprobado en D16, pero es plata.

---

## 2026-11-05 · CLA-8 (arreglo) · Editar un horario recién agregado

**QUÉ HICE**
- La tanda de pantallas encontró que un horario agregado hoy no se podía editar ("sacalo y agregalo de nuevo"): justo el caso de corregir un error de tipeo. Migración 0094 (copia de `editar_horario`): el horario de hoy se queda con su primer día y el nuevo arranca mañana, como al sacarlo.
- **LO QUE ENCONTRÉ SIN PEDIRTELO**: en 0086, si cambiaba la hora y una clase posterior tenía reservas, las clases sin reservas de los días intermedios se movían al horario nuevo mientras el viejo seguía vigente esos días: al volver a mirar el día, el viejo creaba otra (dos clases). Ahora esas se quedan en el viejo con su hora y toman cupo y profe.
- Prueba de base `editar-horario` (caso 0094), e2e `panel-clases` en la tanda final.
- **0097** (la tanda de pantallas lo encontró después): sacar un horario que todavía no arrancó lo dejaba un día en la grilla, y si ese día era el suyo daba la clase. Ahora un horario puede quedar vacío (`vigente_hasta = vigente_desde - 1`): sacarlo lo saca entero, y editar uno de hoy lo reemplaza entero. Copias de `cerrar_horario` y `editar_horario`; caso nuevo en `editar-horario`.

---

## 2026-11-05 · APP-8 · Pedir pausa o baja desde la app

**QUÉ HICE**
- App del socio → "⏸️ Pausar o dar de baja" (`/app/cuenta`):
  - **pausa**: fechas y motivo (viaje, trabajo, estudio, otro); entra a los pedidos de pausa que ya existían (D7: los aprueban el dueño o el encargado, en Inicio y en la ficha). Mismas reglas que desde el mostrador (máximo por año, sin salud, no en fechas pasadas ni pisadas).
  - **baja**: con el motivo (la misma lista de la ficha) y una nota. **No da de baja**: avisa. Aparece en la campana del dueño y del encargado ("… pidió la baja") y en la ficha un aviso con "💪 Se queda" o "Darle la baja" (con el motivo que dio). Lo pueden resolver dueño, encargado y recepción (los mismos que dan de baja).
- Migración 0093 (`pedidos_baja` con RLS y FK compuesta, `pedir_pausa_socio`, `pedir_baja_socio`, `pedido_baja_socio`, `resolver_pedido_baja`; copia de `campana`), prueba de base `pedidos-socio` (otro socio no puede pedir por él, no se repite, "se queda" no da de baja, "darle la baja" guarda el motivo), `e2e:app-8`.

**LO QUE NO PUDE VERIFICAR**
- `npm run db:types` necesita `SUPABASE_PROJECT_ID` (igual que en las capas anteriores).

---

## 2026-11-05 · APP-3 · Historial en la app del socio

**QUÉ HICE**
- App del socio → "🧾 Mis pagos y cuándo vine" (`/app/historial`):
  - los últimos 12 pagos, con qué pagó y si está aprobado, revisándose o rechazado (con el motivo);
  - las últimas 15 entradas y clases.
- Migración 0092 (`mi_historial`), prueba de base `historial-socio`, `e2e:app-3`.
- El comprobante con link propio de cada pago (VEN-1 lo arma para WhatsApp) no está en esta lista: queda para AUD-11.

---

## 2026-11-05 · APP-7 · Racha y entradas del mes

**QUÉ HICE**
- App del socio, debajo del semáforo, dos números:
  - cuántas veces vino este mes (y el anterior);
  - 🔥 semanas seguidas, con "vení esta semana para seguir" si todavía no vino.
- Sin entradas, no aparece.
- Migración 0091 (`racha_socio`), prueba de base `racha`, `e2e:app-7`.

---

## 2026-11-05 · APP-1 · App del socio instalable

**QUÉ HICE**
- Lo grueso ya estaba de PUSH-1: `manifest.webmanifest` con el nombre, el ícono y los colores del gimnasio (abre en `/app`, pantalla completa) y el service worker.
- En la app del socio, "📲 Tené a tu gimnasio en tu pantalla de inicio":
  - en Android/Chrome, con botón "Instalar";
  - en iPhone, con el cómo (Compartir → Agregar a inicio);
  - ya instalada no aparece; "Ahora no" la esconde en ese celular.
- `scripts/e2e/app-1.mjs`.

**LO QUE NO PUDE VERIFICAR**
- Instalarla en un celular real (Chrome o Safari de verdad).

---

## 2026-11-05 · DIS-8 · Pulido de Retención

**QUÉ HICE**
- Ya quedó en DIS-7, AUD-10 y RET-1:
  - el WhatsApp de cada fila no es verde;
  - la lista vacía tiene salida;
  - el loading tiene la forma real;
  - el tablero es de números grandes.
- `scripts/e2e/dis-8.mjs` mide tres listas en el celular para la dueña y la recepción, con capturas `dis8-*`.

**LO QUE NO PUDE VERIFICAR**
- Capturas "antes": solo "después".

---

## 2026-11-05 · RET-2 · La recepción anota contactos (D2)

**QUÉ HICE**
- Como dice D2: la recepción ve Retención (en el menú, grupo SOCIOS). Ve las listas, el WhatsApp armado y "Dice que vuelve" (también en Vencen hoy).
- No ve plata: ni la plata en riesgo ni cuánto paga cada uno (la base se lo devuelve vacío), ni el tablero de altas y bajas.
- Migración 0090 (copias de `retencion`, `retencion_resumen` y `registrar_contacto`). Prueba de base `retencion` actualizada, vitest de secciones, `e2e:retencion` y `e2e:vencen`. El barrido ya no la tiene como prohibida.

**LO QUE NO PUDE VERIFICAR**
- Nada fuera de lo de arriba. Es un cambio de permisos aprobado (D2 ✅): revisalo igual.

---

## 2026-11-05 · RET-3 · Antes de la baja, ofrecer pausa

**QUÉ HICE**
- Ficha → Dar de baja: después de elegir el motivo, si tiene plan (y no se mudó ni se va a otro gimnasio): "Antes de darlo de baja: ¿le ofreciste una pausa?" con "⏸️ Ofrecerle una pausa" (lleva a Pausas de la ficha) o "Dar de baja igual".
- Resultado: "Por qué se fueron" del mes.
- Migración 0089 (`motivos_baja_mes`), prueba en `tablero-retencion`, paso en `e2e:socios`.

---

## 2026-11-05 · RET-1 · Tablero de retención

**QUÉ HICE**
- Arriba de Retención, cuatro números:
  - 👥 Al día, con las barras de las últimas 12 semanas y la diferencia contra hace 4;
  - 🌱 Altas del mes y 👋 Bajas del mes, con el mes pasado al lado;
  - 💸 Por mes en riesgo.
- Migración 0088 (`tablero_retencion`), prueba de base `tablero-retencion`, paso en `e2e:retencion`.

---

## 2026-11-05 · AUD-10 · Auditoría de Retención

**QUÉ HICE**
- Inventario en `docs/paneles/retencion.md`.
- "💵 Cobrar" en las filas de Vencidos y Por vencer (abre Vender con la cuota).
- Lista vacía con `Vacio` y el link a la lista que sí tiene gente.
- `loading.tsx` con la forma real.
- `scripts/e2e/panel-retencion.mjs` (`e2e:retencion`).

---

## 2026-11-05 · DIS-9 · Pulido de Clases

**QUÉ HICE**
- Un solo verde: los "✅ Presente" de cada fila y de la búsqueda pasaron a botón blanco (en una clase de 20 había 20 verdes). El verde queda para "➕ Agregar" en la grilla.
- Lo demás ya quedó en AUD-9, CLA-7 y CLA-8: loading con la forma real, confirmación en pantalla, deshacer y editar en el lugar.
- `scripts/e2e/dis-9.mjs`: el día, una clase y la grilla en el celular, con capturas `dis9-*`.

**LO QUE NO PUDE VERIFICAR**
- Capturas "antes": solo "después".

---

## 2026-11-05 · CLA-8 · Editar actividades y horarios sin sacarlos

**QUÉ HICE**
- Grilla:
  - cada horario tiene "Editar" (hora, minutos, cupo, profe), en el lugar;
  - tocar una actividad deja cambiarle el nombre y el emoji, o apagarla.
- Cómo se guarda: un horario nuevo y el viejo cerrado (el horario no se edita, decisión de 0011), llevando las clases futuras.
  - Las que ya tienen reservas conservan su hora.
  - El cupo no baja de lo reservado; si sube, entra la espera.
- Migración 0086 (`editar_horario`), prueba de base `editar-horario`, paso en `e2e:clases`.
- Arreglado de paso (0087): "Sacar" un horario creado hoy lo cerraba desde mañana pero seguía en la grilla hasta el otro día; parecía que no se había sacado. La grilla muestra lo que sigue después de hoy (hora del gimnasio) y dice "hasta el …" / "desde el …" cuando corresponde.
- Las pruebas: panel-socios esperaba el nombre del plan solo y el botón ahora también muestra el precio; cla-2 tocaba un interruptor que esperaba a la base para cambiar (ahora cambia al toque y vuelve atrás si falla).
- CLA-6 (clase de prueba para prospectos) quedó sin hacer. Pide reservar sin ser socio, y hoy toda reserva es de un socio y cuenta para el cupo en varias funciones. No lo empecé a medias.

---

## 2026-11-05 · CLA-4 · WOD de la clase

**QUÉ HICE**
- En la clase (panel): "🏋️ WOD de esta clase". Lo escriben el profe (en sus clases), el encargado o el dueño, y queda quién lo escribió. La recepción lo ve, no lo edita. Vacío lo borra.
- App del socio (Reservar): debajo de cada clase que reservó, el WOD si lo hay.
- Migración 0085 (`clases.wod`, `guardar_wod`, `wods_socio`, copia de `clase_detalle`), prueba de base `wod`, `e2e:cla-4`.

---

## 2026-11-05 · CLA-3 · Cancelar una clase avisando a los anotados

**QUÉ HICE**
- La recepción ve "🚫 Cancelar esta clase" (la base ya la dejaba; la pantalla lo escondía).
- Avisos de hoy suma "❌ Clase cancelada", primero: los anotados de una clase cancelada en los últimos 2 días, con el WhatsApp y el mensaje nuevo "Clase cancelada" (Configuración → Mensajes, con {clase} {dia} {motivo}). La campana y el push ya los avisaban (AVI-5, PUSH-1).
- La vista previa de Mensajes usa ejemplos para las variables que no son del socio (antes mostraba {detalle} o {clase} sin reemplazar).
- Migración 0084 (copias del catálogo, `bandeja_avisos`, `marcar_avisado` y `vista_previa_mensaje`). Pruebas `bandeja-avisos` (caso nuevo) y `mensajes` (11), `e2e:cla-3`; cfg-5 espera 11 mensajes.

---

## 2026-11-05 · CLA-5 · Ocupación por horario

**QUÉ HICE**
- En la Grilla, "📊 Ocupación": cada horario con cuántos vinieron en promedio en las últimas 4 semanas, como % del cupo y con el fondo más intenso cuanto más lleno. Sin clases pasadas no aparece.
- Migración 0083 (`ocupacion_horarios`, dueño y encargado), prueba de base `ocupacion`, paso en `e2e:clases`.

---

## 2026-11-05 · CLA-7 · Deshacer un presente

**QUÉ HICE**
- En la lista de la clase, al lado de "✅ Presente": "↩️ Deshacer". Pide el motivo en la misma fila. Valen las reglas de la base (`anular_asistencia`): el profe y la recepción dentro del día, el profe solo en sus clases, dueño y encargado siempre. Si el presente había gastado una clase del pack, vuelve.
- Migración 0082 (`anular_presente(clase, socio, motivo)`), prueba de base `anular-presente`, paso nuevo en `e2e:clases`.

---

## 2026-11-05 · CLA-2 · Turnos fijos

**QUÉ HICE**
- Configuración → Clases: "📌 Turnos fijos" (prender o apagar, se guarda al tocar).
- App del socio (Reservar): "📌 Mis turnos fijos". Elige un horario (con los lugares fijos que quedan) → "Dejarlo fijo"; "Quitar".
- Ficha → Resumen: lo mismo desde el mostrador.
- Cada semana se reserva solo mientras pueda tomar la clase. Se hace al mirar las clases de ese día, sin cron (`materializar_dia` sincroniza los turnos). Al que dejó de estar al día se le libera el lugar y sube la espera. Si cancela una semana, se respeta.
- Migración 0081 (`turnos_fijos`, `reservas.turno_fijo_id`, `sincronizar_turnos`, copia de `materializar_dia`, `abonar_turno`, `quitar_turno`, `turnos_socio`, `horarios_para_turno`, `guardar_turnos_fijos`, `config_turnos_fijos`). Prueba de base `turnos-fijos` y e2e `e2e:cla-2`.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- En mi base local, volver a correr `simular-supabase.sql` (para sumar Vault) volvía a dar TRUNCATE por defecto a las tablas nuevas; `chequeos` lo marcó. Es solo de la base local (en una nueva el orden es el correcto). La migración igual le saca esos permisos a `turnos_fijos` explícitamente.

---

## 2026-11-05 · CLA-1 · Faltas a clases reservadas

**QUÉ HICE**
- Configuración → Clases, si se reserva: "Si reserva y no viene (sin cancelar)": 🙂 No pasa nada, o ⛔ No puede reservar por N días (la recepción lo puede anotar igual; cuenta desde que se prende).
- App del socio (Reservar): abajo, las reglas ("Podés cancelar hasta 2 h antes", "Si reservás y no venís…"). Si está bloqueado: "⛔ No podés reservar hasta el 08/11: faltaste a Spinning del 05/11 sin cancelar." La base lo frena igual si toca Reservar.
- Ficha → Asistencia: "🙈 Reservó y no vino" (últimos 60 días).
- Migración 0080 (`privado.faltas`, `privado.bloqueo_reservas`, `faltas_socio`, `politica_reservas`, copia de `public.reservar` y de la configuración). Prueba de base `faltas-clases` y e2e `e2e:cla-1`.
- "Descontar del pack" (la tercera opción de D16) quedó como CLA-9: cambia cómo se cuentan las clases del pack en la puerta.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Corrijo lo que anoté en AUD-9: la base SÍ deja a la recepción cancelar clases (`cancelar_clase` la incluye). Es la pantalla la que esconde el botón. No lo cambié (CLA-3).

---

## 2026-11-05 · AUD-9 · Auditoría de Clases

**QUÉ HICE**
- Inventario botón por botón en `docs/paneles/clases.md`.
- Arreglado: "Sacar" un horario usaba el diálogo del navegador (`confirm`). Ahora confirma en pantalla con "Sí, sacar / No" y dice qué pasa.
- `loading.tsx` con la forma real en el día, la lista y la grilla (no tenían).
- `scripts/e2e/panel-clases.mjs` (`e2e:clases`): días, presente desde la búsqueda, grilla (actividad, horario, sacar) y el profe en el celular. Si aparece un diálogo del navegador, falla.
- A la cola: CLA-8 (editar actividades y horarios sin sacarlos).

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- CLA-3 dice que la recepción también cancela clases. La pantalla no le muestra el botón (la base sí la deja, ver CLA-1). Toca permisos: no lo cambié. Queda anotado para CLA-3.

---

## 2026-11-05 · PAY-1 · Pagos online listos para MercadoPago

**QUÉ HICE**
- Configuración → Cobros → "💳 Pagos online con MercadoPago" (el dueño): pega el Access Token y la clave secreta del webhook, con los pasos de dónde sacarlos. Se guardan en **Vault** (la tabla tiene solo el id del secreto); "Desconectar" pisa los secretos.
- App del socio: "💳 Pagar ahora" (o "Pagar el próximo mes" si está al día) → la base arma la venta y el pago pendiente con el precio de MercadoPago → checkout → vuelve a "Estamos confirmando tu pago…", que se actualiza sola hasta "¡Pago acreditado!" (o "No se pudo cobrar").
- Webhook `/api/webhooks/mercadopago?g=<gimnasio>`:
  - firma `x-signature` verificada con la clave del gimnasio (inválida → 401);
  - idempotente por ID externo (`eventos_webhook`);
  - estado y monto leídos de la API de MercadoPago con el token del gimnasio;
  - acredita con `confirmar_venta` solo si el monto coincide;
  - si falla, 500 y MercadoPago reintenta.
- `scripts/local/mp-simulado.mjs`: imita MercadoPago (preferencias, checkout, pagos y el aviso firmado). `levantar.sh` lo levanta y apunta la app a él (`MP_API_URL`).
- Migración 0079, prueba de base `pagos-online`, e2e `e2e:pay-1`. Vault simulado en `supabase/local/simular-supabase.sql` (solo local).

**QUÉ CONFIGURÁS VOS**
- En Supabase, Vault tiene que estar activo (Database → Extensions → `supabase_vault`; en proyectos nuevos viene prendido). La migración 0079 lo verifica y frena si falta.
- Nada en Vercel: cada gimnasio pega sus credenciales en su panel.

**LO QUE NO PUDE VERIFICAR**
- Contra MercadoPago real: el código está escrito según la documentación de MercadoPago (Checkout Pro, `/v1/payments`, firma `x-signature`), pero no está ejecutado contra su API. Para probarlo: conectar una cuenta con credenciales de prueba y pagar con una tarjeta de prueba de MercadoPago.

---

## 2026-11-05 · RES-3 · Gastos y ganancia

**QUÉ HICE**
- En Resultado, para el dueño: "Gastos y ganancia" del mes. Muestra cobrado − gastos = ganancia (en rojo si es pérdida). Se cargan gastos (alquiler, sueldos, servicios, otros; con detalle y monto escrito como sea: "250.000", "1.234,50"). Se quitan, y en la base quedan anulados. Si el mes está vacío, hay un botón "🔁 Repetir los gastos del mes pasado".
- El encargado ve el Resultado sin gastos (hay sueldos).
- Migración 0078 (`gastos`, `gastos_mes`, `guardar_gasto`, `quitar_gasto`, `repetir_gastos`), prueba de base `gastos`, e2e `e2e:res-3`.

**LO QUE NO PUDE VERIFICAR**
- Nada fuera de lo de arriba.

---

## 2026-11-05 · RES-2 · Exportar el mes para el contador

**QUÉ HICE**
- En Resultado, "Para el contador": 🧾 Ventas, 💳 Pagos y 💵 Caja del mes que se está mirando, en CSV para Excel (punto y coma, acentos bien, montos con coma decimal, fechas en la hora del gimnasio).
- Ventas: fecha, socio, detalle, bruto, descuento, total, estado, quién cobró, sede y si se anuló. Pagos: fecha, socio, medio, monto, estado, quién. Caja: aperturas, ingresos, retiros y cierres con lo esperado y la diferencia.
- Migración 0077 (`exportar_mes`), prueba en `resultado`, e2e `e2e:res-2`.

**LO QUE NO PUDE VERIFICAR**
- Que el contador lo abra en su Excel: se verificó el archivo, no un Excel.

---

## 2026-11-05 · RES-1 · Resultado: la plata del mes

**QUÉ HICE**
- 📈 Resultado (`/panel/resultado`, grupo PLATA, dueño y encargado), con flechas para ir de mes en mes:
  - cobrado del mes y contra el anterior (si el mes está en curso, contra los mismos días);
  - socios al día, altas, bajas y el recurrente por mes estimado;
  - día por día (barras), de dónde (por plan, productos, matrícula…), cómo pagaron, horas pico.
- Migración 0076 (`privado.cobrado_entre`, `resultado_mes`), prueba de base `resultado`, e2e `e2e:res-1`.

**LO QUE NO PUDE VERIFICAR**
- Nada fuera de lo de arriba.

---

## 2026-11-05 · DIS-7 · Pulido de Vencen hoy

**QUÉ HICE**
- Un solo verde: en Vencen hoy es "📣 Avisar a todos"; el WhatsApp de cada fila pasó a botón blanco (también en Retención, que usa la misma fila).
- Lo demás ya quedó en AUD-7: cuántos vencen en la bajada, vacío con camino a Retención, `loading.tsx` con la forma real.
- `scripts/e2e/dis-7.mjs`: mide Vencen hoy, Avisos de hoy, Novedades y Resumen en el celular (recepción y dueña) y deja capturas `dis7-*`.

**LO QUE NO PUDE VERIFICAR**
- Capturas "antes": la pantalla se tocó en AUD-7 antes de este ítem; hay solo "después".

---

## 2026-11-05 · PUSH-1 · Notificaciones push

**QUÉ HICE**
- Mi cuenta (dueño, encargado, recepción) y Novedades en la app del socio: "🔔 Activar en este dispositivo", qué recibir (según el rol), "Mandarme una de prueba" y "Apagar". Sin soporte, sin claves o en un iPhone sin instalar, lo dice (en iPhone: Compartir → Agregar a inicio).
- Llegan: comprobante para revisar, pago aprobado/rechazado (socio), caja con diferencia, retiros, pedido de anular, clase cancelada (socios anotados). A quién y con qué texto lo decide la base (`destinos_push`, solo con la clave de servicio); cada hecho se manda una vez; un dispositivo dado de baja por el navegador se borra solo.
- `public/sw.js` (muestra la notificación y al tocarla abre la pantalla), `manifest.webmanifest` con el nombre y colores del gimnasio (para instalar la app).
- Migración 0075, prueba de base `push`, `src/lib/push.test.ts` (un "navegador" descifra lo que arma el servidor y se verifica la firma VAPID), e2e `e2e:push-1`. Dependencia nueva: `web-push`.

**QUÉ CONFIGURÁS VOS**
- Generar las claves una vez: `npx web-push generate-vapid-keys`.
- En Vercel (Production y Preview): `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (la pública), `VAPID_PRIVATE_KEY` (la privada), `VAPID_SUJETO=mailto:<tu mail>`. Después, redeploy. Sin ellas, la pantalla dice "todavía no están configuradas" y no se manda nada.

**LO QUE NO PUDE VERIFICAR**
- La entrega real a un navegador: desde acá no se llega al servicio de push de Chrome/Firefox/Apple. El código está escrito según la documentación de web-push, el cifrado y la firma están probados, pero la entrega no está ejecutada. Para probarla: activarlas en Mi cuenta desde Chrome y tocar "Mandarme una de prueba".

---

## 2026-11-05 · AVI-6 · Resumen del dueño, del día y de la semana

**QUÉ HICE**
- 📊 Resumen (`/panel/resumen`, grupo PLATA, dueño y encargado), con Hoy · Ayer · Esta semana · Semana pasada:
  - cobrado, entradas (y socios distintos), altas y bajas, cada uno contra el período anterior;
  - "Para mirar": diferencias de caja, retiros, descuentos (cuánto de convenios), ventas anuladas, dejados pasar, los que no pudieron entrar y lo que quedó a cuenta;
  - por medio de pago y por quién cobró;
  - la caja: cada diferencia y cada retiro, con quién y cuándo.
- En Inicio, abajo de los números, "📊 Resumen de hoy". En la campana: el del día (desde las 22 h) y el de la semana pasada (los lunes).
- Migración 0074 (`privado.resumen_periodo`, `resumen_dueno` y copia de `campana`), prueba de base `resumen-dueno`, e2e `e2e:avi-6`.

**LO QUE NO PUDE VERIFICAR**
- Nada más allá de lo de arriba: el mail queda para cuando esté conectado.

---

## 2026-11-05 · VEH-1, AVI-5 · Avisar a todos y la campana

**QUÉ HICE**
- "📣 Avisar a todos" en Vencen hoy y en cada grupo de Avisos de hoy: va de a uno ("2 de 7"), cada toque abre el WhatsApp de esa persona con su mensaje y la deja avisada; "Saltear" y "Terminar". Tocar WhatsApp en una fila de Vencen hoy también la marca en la bandeja.
- 🔔 Campana, arriba a la derecha en todo el panel y en la app del socio:
  - el número de lo nuevo (se pide después de pintar, no frena la pantalla);
  - "Novedades": lo nuevo arriba, lo visto abajo, cada cosa lleva a donde se resuelve;
  - cada rol ve lo suyo; el socio, si hoy no está al día, sus comprobantes (aprobado/rechazado) y sus clases (cancelada, entró de la lista de espera).
- Migración 0073 (`avisos_leidos`, `campana`, `campana_socio`, `leer_campana`), prueba de base `campana`, e2e `e2e:veh-1` y `e2e:avi-5`. El barrido suma `/panel/avisos` y `/panel/campana`.

**LO QUE NO PUDE VERIFICAR**
- Que WhatsApp abra uno tras otro en un celular real (se verificó que cada toque abre su link).

---

## 2026-11-05 · AUD-7, AVI-1 · Vencen hoy y la bandeja de avisos

**QUÉ HICE**
- Vencen hoy, botón por botón (`docs/paneles/vencen-hoy.md`):
  - la bajada dice cuántos vencen hoy;
  - cada fila tiene "💵 Cobrar", que abre Vender con el socio y su cuota (si el gimnasio cobra membresía y quien mira puede vender);
  - sin nadie hoy: "Hoy no vence nadie" y el camino a Retención → Vence pronto;
  - `loading.tsx` con la forma real.
- 📬 Avisos de hoy (`/panel/avisos`, grupo HOY): a quién escribirle hoy, con el mensaje de Configuración ya escrito y el WhatsApp a un toque.
  - Junta vence pronto, venció hace 1 a 3 días, no viene, cumple años y comprobante rechazado (últimos 3 días).
  - "✓ Ya le avisé" (o tocar WhatsApp) queda anotado con quién y a qué se refiere: ese aviso no vuelve otro día; uno nuevo del mismo socio sí.
  - Se calcula al abrirla: sin cron.
- Migración 0072 (`avisos_enviados`, `bandeja_avisos`, `marcar_avisado`), prueba de base `bandeja-avisos`, e2e `e2e:vencen` y `e2e:avi-1`.
- De paso: `stock.test` dependía del orden de dos filas con la misma hora; ahora no.

**LO QUE NO PUDE VERIFICAR**
- Que WhatsApp abra con el texto en un celular real (se verificó el link armado).

---

## 2026-11-05 · DIS-4, DIS-5, DIS-6 · Pulido de Vender, Caja y Transferencias

**QUÉ HICE**
- Vender en el celular: con algo en el carrito aparece abajo una barra "🛒 N · $total · Cobrar ↓" que lleva al ticket. Se esconde cuando el ticket ya está a la vista y no es verde, así hay un solo verde por pantalla.
- `loading.tsx` con la forma real en Vender, Caja, Transferencias y PIN. Antes usaban el genérico.
- Lo demás ya estaba medido en AUD-6 (`aud6-*`): sin desborde, botones altos, un solo verde.
- `scripts/e2e/dis-4.mjs` (6 pasos).

**LO QUE NO PUDE VERIFICAR**
- Nada: se abrió y se midió.

---

## 2026-11-05 · CAJ-3 · PIN del equipo en la recepción

**QUÉ HICE**
- Mi cuenta → "🔢 Mi PIN para la recepción" (4 números).
- En la compu del mostrador:
  - Vender y Caja muestran "🔢 ¿Quién atiende?" cuando alguien del equipo tiene PIN.
  - Se pone el PIN y arriba de todo aparece "👤 Atiende Martín · Cambiar".
  - Lo que se hace queda a su nombre: la venta, la caja, quién dejó pasar.
  - "Salir" vuelve a la sesión sola.
- Cómo funciona por dentro:
  - La base firma un token de 12 horas.
  - El panel lo guarda en una cookie que solo lee el servidor y lo manda como encabezado `x-gymos-operador`.
  - `privado.exigir_rol` y `privado.exigir_equipo` lo leen. Sin encabezado, todo funciona como antes.
- Migración `20261104007100_pin_equipo.sql`:
  - Tablas `privado.pines_equipo`, `privado.secretos_operador` y `privado.intentos_pin`.
  - Funciones `privado.operador`, `guardar_mi_pin`, `entrar_con_pin`, `operador_actual`.
  - Copias de `exigir_rol` (0006) y `exigir_equipo` (0013).
- `supabase-local` pasa los encabezados `x-…` en `request.headers`, como PostgREST.
- `supabase/pruebas/pin-equipo.test.mjs` (3 pruebas):
  - queda anotado quien puso el PIN;
  - el PIN de la dueña en la sesión de la recepción no da permisos de dueña, y al revés tampoco;
  - un token adulterado da error;
  - 5 errores bloquean;
  - el hash no se lee.
- `scripts/e2e/caj-3.mjs` (5 pasos: la ficha dice "cobró Martín" con la sesión de Ana). Al empezar borra los intentos de corridas anteriores en la base local.
- `npm run db:pruebas` completo: las únicas fallas son las 16 de siempre (mails que chocan con el demo).

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Si un PIN equivocado diera error de la base, se desharía el intento anotado y nunca se bloquearía. Por eso devuelve `{ error, quedan }` en vez de error.
- Si después de poner el PIN la página se redirige desde el servidor, a veces se pinta mal: una vez apareció la pantalla de ingresar, y el aviso "Atiende …" no se actualizaba. Lo resolví navegando la página entera.

**PARA QUE REVISES**
- Toca permisos: `exigir_rol` y `exigir_equipo` los usan todas las funciones. El cambio solo puede achicar permisos (intersección) y anotar a otra persona del mismo gimnasio. Las pruebas de base y de pantalla pasan. Igual conviene que lo mires antes de mergear.

**LO QUE NO PUDE VERIFICAR**
- Que PostgREST de Supabase pase el encabezado `x-gymos-operador` en `request.headers`. Según la documentación lo hace, pero no está ejecutado contra Supabase. Si no lo pasara, el PIN no anota a nadie, no rompe nada.

---

## 2026-11-05 · CAJ-5 · Caja olvidada abierta

**QUÉ HICE**
- Una caja está "olvidada" si quedó abierta de otro día, o si hoy ya pasó la hora de cierre de su sede.
- Inicio: "⏰ Caja abierta". La ven quien la abrió ("la abriste vos"), el dueño y el encargado. Lleva a Caja, que muestra el aviso.
- `abrir_caja` no deja abrir otra a quien ya tiene una abierta. Dice cuál y desde cuándo.
- Migración `20261104007000_caja_olvidada.sql`: `privado.caja_olvidada`, `cajas_olvidadas` y una copia de `abrir_caja`.
- Pruebas: `supabase/pruebas/caja-olvidada.test.mjs` (2) y `scripts/e2e/caj-5.mjs` (4 pasos). Para simular que pasó la noche, la prueba corre la apertura un día para atrás en la base local.

**LO QUE NO PUDE VERIFICAR**
- Nada: se abrió, se "olvidó" y se cerró.

---

## 2026-11-05 · CAJ-4 · Alertas de caja al dueño

**QUÉ HICE**
- Inicio del dueño y del encargado: "🔔 Caja" con lo que hizo otro en los últimos 7 días:
  - una caja que cerró con diferencia;
  - plata que salió del cajón, con "🧾 Ver ticket" si sacaron foto;
  - una venta anulada;
  - un descuento mayor al tope de la recepción.
- "➖ Sale plata" permite sacar la foto del ticket (opcional). Va al bucket privado `tickets_caja`; la sube el servidor y la base arma la ruta.
- Migración `20261104006900_alertas_caja.sql`: `movimientos_caja.ticket_path`, `preparar_ticket`, `confirmar_ticket`, `ticket_movimiento`, `alertas_caja`, bucket privado.
- `supabase/pruebas/alertas-caja.test.mjs`. `scripts/e2e/caj-4.mjs` (4 pasos: foto real subida y abierta con link firmado).

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- `supabase-local` no imitaba los links firmados de Storage. "Ver comprobante" (Transferencias) y "Ver ticket" daban error en local. Ahora los firma y los sirve, igual que Supabase. Solo afecta a la base local; en producción ya andaba.

**QUÉ CONFIGURÁS VOS**
- Nada: la migración crea el bucket `tickets_caja` (privado, 6 MB, JPG/PNG/WEBP).

**LO QUE NO PUDE VERIFICAR**
- Sacar la foto con la cámara de un celular real (`capture="environment"`). Lo probé subiendo un archivo.

---

## 2026-11-05 · CAJ-1, CAJ-2 · Historial de turnos y cierre para compartir

**QUÉ HICE**
- **CAJ-1:** Caja → "🗂️ Turnos anteriores" (dueño y encargado). Cada turno muestra:
  - quién abrió y quién cerró;
  - inicial, efectivo cobrado, ingresos menos retiros, cuánto tenía que haber y cuánto se contó;
  - Justa, Sobraron o Faltaron;
  - los otros medios;
  - cada movimiento con su motivo;
  - las ventas y las anuladas.
  - Migración `20261104006800_historial_caja.sql` (`historial_caja`). `supabase/pruebas/historial-caja.test.mjs`.
- **CAJ-2:** al cerrar, "📲 Mandar el cierre por WhatsApp" con el cierre escrito. También "📲 Compartir" en cada turno del historial. El texto lo arma `src/lib/caja.ts` (con vitest), con lo que ya calculó la base.
- La caja abierta muestra "📒 A cuenta" entre los otros medios.
- `scripts/e2e/caj-1.mjs` (7 pasos, incluye que la recepción no ve el historial).

**LO QUE NO PUDE VERIFICAR**
- Que WhatsApp lo abra en un celular. Verifiqué el link, no el teléfono.

---

## 2026-11-05 · VEN-5 · Deuda / cuenta corriente

**QUÉ HICE**
- Configuración → Cobros: "📒 Fiar (cuenta corriente)" con tope por socio. Viene apagado.
- Vender, con un socio elegido, agrega el medio "📒 A cuenta" y dice cuánto más se le puede fiar. Si el socio debe, aparece "📒 Pagar lo que debe a cuenta".
- La puerta deja entrar al que debe y lo pone en amarillo con "Debe $X a cuenta".
- Migración `20261104006700_cuenta_corriente.sql`:
  - Columnas `fiado_activo` y `fiado_tope`.
  - Medio `cuenta_corriente` y tipo de ítem `deuda`.
  - `privado.deuda_socio`.
  - Copias de `privado.calcular_acceso` (0006), `public.vender` (0023), `privado.vender` y `precios_venta` (0066), configuración (0061) y `panel_inicio` (0013, para que "Cobrado hoy" no cuente lo fiado).
- `supabase/pruebas/cuenta-corriente.test.mjs` (2 pruebas: tope, sin socio no, amarillo, pagar, no pagar deuda a cuenta, anular). `scripts/e2e/ven-5.mjs` (5 pasos; al final apaga el fiado).

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- En la base local con el gimnasio demo cargado, `acceso.test` y `clases.test` fallan porque los mails de prueba chocan con los de los usuarios demo. Ya estaba anotado; en una base limpia (la verificación completa) pasan.

**LO QUE NO PUDE VERIFICAR**
- Nada: se abrió, se fió, se vio en la puerta y se pagó.

---

## 2026-11-05 · VEN-3 · Convenios y descuentos automáticos

**QUÉ HICE**
- Planes → "🤝 Convenios": crear, editar y desactivar (% o $ fijo por cuota), con cuántos socios tiene cada uno.
- Ficha → Resumen: "🤝 Asignar convenio", con vencimiento opcional. Lo hacen el dueño y el encargado.
- Vender muestra "🤝 Convenio X −$…" debajo de la cuota. La base lo aplica igual, aunque el navegador no lo mande. Va como descuento con motivo y no cuenta para el tope de la recepción.
- De paso, el error del tope dice "10 %" y no "10.00 %" (quedó anotado en AUD-6). Actualicé `caja.test`.
- Migración `20261104006600_convenios.sql`:
  - Tablas `convenios` y `socio_convenios` (RLS, FK compuestas, uno activo por socio).
  - Funciones `convenios_gimnasio`, `guardar_convenio`, `asignar_convenio`, `quitar_convenio`, `convenio_socio`.
  - Copias de `privado.vender` y `precios_venta`.
- `supabase/pruebas/convenios.test.mjs` (3 pruebas). vitest: `descuentoConvenio` hace la misma cuenta que la base. `scripts/e2e/ven-3.mjs`: la base cobró exactamente el total que calculó la pantalla.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Desde la sesión de la recepción, en las pruebas de base, `venta_items` de una venta recién hecha devolvió 0 filas. Puede ser una política de lectura más estricta de lo que dice el schema. No lo toqué (permisos); queda para revisar en la segunda pasada.

**LO QUE NO PUDE VERIFICAR**
- Nada: se abrió y se cobró.

---

## 2026-11-05 · VEN-4 · Productos con stock

**QUÉ HICE**
- Planes → Productos → "📦 Stock":
  - Llevar stock: al prenderlo se cuenta lo que hay.
  - "➕ Entró mercadería".
  - "🔢 Conté: ajustar".
  - Avisar cuando queden N.
  - Dejar de llevar stock.
- Vender muestra "Quedan N" en cada producto, descontando lo que ya está en el carrito. "Sin stock" avisa pero no frena.
- Inicio del dueño y del encargado: "📦 Por reponer".
- Migración `20261104006500_stock.sql`:
  - Tabla `movimientos_stock` (RLS, FK compuestas).
  - `privado.stock_producto`, que calcula el stock.
  - `stock_productos`, `configurar_stock`, `entrada_stock`, `contar_stock`, `movimientos_stock_producto`.
- `supabase/pruebas/stock.test.mjs` cubre conteo inicial, entrada, venta, anulación y permisos. `scripts/e2e/ven-4.mjs` (6 pasos).

**LO QUE NO PUDE VERIFICAR**
- Nada: se abrió y se hizo clic.

---

## 2026-11-05 · VEN-1 · Comprobante de pago por WhatsApp

**QUÉ HICE**
- Después de cobrarle a un socio, Vender muestra "🧾 Mandar comprobante por WhatsApp", que abre su chat (o el del responsable, si es menor) con el texto ya escrito.
- El texto es un mensaje más en Configuración → Mensajes ("Comprobante de pago"). Usa monto, detalle, fecha y "Quedás al día hasta el …" cuando corresponde.
- Migración `20261104006400_comprobante_pago.sql` (`comprobante_venta`, copia del catálogo de mensajes). `supabase/pruebas/comprobante-pago.test.mjs`. Actualicé `mensajes.test` y `cfg-5` (10 mensajes). `scripts/e2e/ven-1.mjs`.

**LO QUE NO PUDE VERIFICAR**
- Que WhatsApp lo abra en un celular de verdad. Verifiqué el link (`wa.me` con el texto), no el teléfono.

---

## 2026-11-05 · AUD-6 · Vender, Caja y Transferencias botón por botón

**QUÉ HICE**
- Inventario en `docs/paneles/vender.md`. `npm run e2e:vender` (12 pasos): caja ciega, montos con punto y coma, tope de descuento, dos medios y cierre "Caja justa" con la cuenta exacta.
- Arreglado:
  - Montos en Vender y Caja con `leerMonto()`.
  - Sin caja abierta, Vender ya no arranca en efectivo (mostraba ese precio y no se podía cobrar).
  - "Ver comprobante" en el celular.
  - Texto del buscador más corto.
- Anular ventas (VEN-6) quedó en la entrada del bloque 5.

**SIN ARREGLAR**
- "Tu descuento máximo es 10.00 %": sale con dos decimales. Es texto de `privado.vender`; lo arreglo la próxima vez que se toque esa función.

**LO QUE NO PUDE VERIFICAR**
- Nada: todo se abrió con sesión real.

---

## 2026-11-05 · Bloque 5 (Planes y precios) y VEN-6 · AUD-5, PLA-1 a PLA-7, DIS-10, VEN-6

**QUÉ HICE**
- **AUD-5** (inventario en `docs/paneles/planes.md`, `npm run e2e:planes`, 12 pasos):
  - Arreglado: "Dejar de vender" borraba las veces por semana, el horario y la descripción. El plan quedaba libre y la puerta dejaba pasar de más. Migración `0055`: `guardar_plan` cambia solo lo que se le manda.
  - Arreglado: "1500.50" se guardaba como $150.050. `leerMonto()` en `src/lib/formato.ts` (vitest) lee "84.500", "84500,50", "1500.50" y "$ 1.500"; lo que no entiende, lo avisa.
  - Nuevo: ✏️ Editar plan (nombre, descripción, veces por semana) y producto (nombre y precio). Mensaje cuando no hay productos. Al crear un plan, el formulario se cierra.
- **PLA-5** · 💲 Precios: el general, el más barato por medio de pago y por pagar antes de un día del mes, desde una fecha. Un aumento programado se puede anular. `0056`, `e2e:pla-5` (9 pasos, incluye Vender en efectivo y por transferencia).
- **PLA-4** · 📈 Aumento de precios: varios planes, % o monto, redondeo y fecha. La vista previa es la misma cuenta que se guarda. Al terminar, el aviso queda listo para WhatsApp. `0057`, `e2e:pla-4` (7 pasos).
- **PLA-1** · Mensual, trimestral, semestral y anual, con cuánto da por mes. `e2e:pla-1`: se cobra una cuota trimestral y la Entrada dice que vence a los 3 meses. Prueba nueva en `cobro.test`.
- **PLA-2** · Horario y veces por semana, con errores que dicen qué poner. Qué clases incluye cada plan. `0058` y validación en `0055`. `e2e:pla-2`: al día pero fuera de horario no entra; con "Todo el día", entra.
- **PLA-3** · Matrícula por plan, única o anual. Vender la suma con la cuota y la cobra una sola vez. `0059` (copias de `privado.vender` y `precios_venta`). `e2e:pla-3` (6 pasos).
- **PLA-6** · Cambio de plan: antes de confirmar dice cuántos días pagos pasan y la diferencia por mes. `cambiar_plan` y `asignar_plan` explican por qué no se puede. `0060`, `e2e:pla-6`.
- **PLA-7** · Recargo por pagar tarde, en Configuración → Cobros. Viene apagado. La base lo exige junto con la cuota; no cobrarlo es un descuento con motivo, con tope. `0061` (copias de configuración, `privado.vender` y `precios_venta`). `e2e:pla-7` (lo vuelve a apagar al final).
- **DIS-10** · Medí Planes y Aumento en compu y celular (`dis10-*`): sin desborde, sin botones bajos, un solo verde. Nuevo `loading.tsx` en Planes y en Aumento.
- **VEN-6** · Anular ventas.
  - Desde la ficha (pestaña Pagos, ahora con el estado de cada venta), desde Vender recién cobrado y desde los pedidos en Inicio.
  - La recepción lo pide; anulan el dueño o el encargado.
  - Migración `0062`, `e2e:ven-6` (6 pasos).
- Pruebas de base nuevas: `editar-plan`, `lista-precios`, `aumento-precios`, `restricciones-plan`, `matricula`, `cambio-plan`, `recargo`, `anular-ventas`.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Vender leía "1.500" como $1,50 (en "Otra cosa", en el pago mixto y en el descuento). Caja leía "1500.50" como $150.050. Toca plata, pero entra en AUD-6, que es lo siguiente: los dos usan `leerMonto()`.
- "🧾 Ver comprobante" en Transferencias abría la pestaña después de esperar al servidor, y el celular la bloquea. Ahora se abre en el mismo toque.
- Posibles duplicados cortaba en 100 pares sin ordenar. Con muchos nombres parecidos, un par con el mismo celular podía no aparecer. `0063` ordena primero (mismo celular, más nuevos) y después corta.
- Habilité `npm run e2e:<nombre>` para todas las pruebas de pantalla. Los encabezados ya lo decían, pero en package.json faltaban.

**QUÉ CORRÉS VOS**
- `aplicar` en la rama, que ahora va de 0020 a 0063.

**SIN ARREGLAR**
- La matrícula y el recargo no se suman cuando el socio paga por transferencia desde la app: ahí se cobra solo la cuota. Va con PAY-1.

**LO QUE NO PUDE VERIFICAR**
- Nada de lo de arriba quedó sin abrir: cada pantalla se probó con sesión real y cada función de base con pruebas.

---

## 2026-11-05 · DIS-2 · Pulido de la Entrada

**QUÉ HICE**
- El botón "🔊 Con sonido" era un link de texto de 20px: ahora es un botón de 44px, fácil de tocar.
- `/panel/entrada/loading.tsx` con la forma real: título, buscador grande y la lista de hoy.
- Revisé lo demás y ya estaba bien: el vacío de "Hoy" dice "Todavía no entró nadie"; "no lo encuentro" ofrece darlo de alta; Esc y Enter funcionan; cada error dice qué pasó.
- Medido antes y después en compu (1440) y celular (390): sin desborde, ningún botón bajo, ningún verde de más.
- `scripts/e2e/dis-2.mjs` (5 pasos) en verde; `panel-entrada` (12 pasos) sigue en verde.

**LO QUE NO PUDE VERIFICAR**
- Nada: todo se abrió con sesión real.

---

## 2026-11-05 · ENT-8 · Control de la puerta

**QUÉ HICE**
- Entrada → "🔎 Control de la puerta" (dueño y encargado; también desde Inicio, "Ver la semana"):
  - A quién dejaron pasar: quién, motivo, por qué no podía y si después se anuló.
  - Las entradas anuladas: quién y por qué.
  - La cuenta por persona del equipo.
  - Por semana, con ◀ ▶.
- Migración `20261104005400_control_entrada.sql`: `control_entrada` (sale de `ingresos`; no guarda nada).
- `supabase/pruebas/control-entrada.test.mjs` y `scripts/e2e/ent-8.mjs` (7 pasos; la recepción no lo ve).

**QUÉ CORRÉS VOS**
- `aplicar` (0020 a 0054).

---

## 2026-11-05 · ENT-9 · Cobrar desde la Entrada, con la cuota cargada

**QUÉ HICE**
- "💵 Cobrar" en el veredicto rojo abre Vender con el socio y, si debe, la cuota de su plan ya en el carrito.
- Después de cobrar, "🚪 Volver a la entrada con …" abre la Entrada con su veredicto nuevo (`/panel/entrada?socio=`), listo para Enter.
- Sin migración. `scripts/e2e/ent-9.mjs` (4 pasos: alta con plan sin pagar → no entra → Cobrar → transferencia → vuelve verde → Enter).

**LO QUE NO PUDE VERIFICAR**
- Nada: se hizo clic de punta a punta.

---

## 2026-11-05 · ENT-6, ENT-7, INV-1 · QR en la tablet, llavero e invitados

**QUÉ HICE**
- **ENT-6, QR en la tablet** (Reglas → "🔳 QR en la tablet", aparece con la tablet prendida):
  - La tablet muestra un QR firmado que cambia cada 30 segundos.
  - El socio toca "📷 Escanear el QR de la entrada" en su app: entra (o ve por qué no), y la tablet muestra "¡Pasá, …!".
  - Migración `20261104005100_qr_pared.sql`: `kiosco_qr`, `kiosco_ultimo`, `entrar_por_qr_pared`, `usa_qr_pared`; `kiosco_estado` dice si muestra el QR.
- **ENT-7, llavero o tarjeta** (Reglas → "🔑 Llavero o tarjeta"):
  - En la ficha: "Asignar llavero" (se pasa por el lector), Cambiar, Quitar. Único por gimnasio.
  - En Entrada el lector escribe el código y Enter: entra directo ("con llavero"). En la tablet también.
  - Migración `20261104005200_llavero.sql`: `asignar_llavero`, `quitar_llavero`, `llavero_socio`, `leer_llavero`; `kiosco_entrar` acepta llaveros.
- **INV-1, invitados** (Reglas → "Invitados por socio por mes", 2 por defecto; 0 = sin invitados):
  - En Entrada, "➕ Invitado": nombre, DNI y quién invita; pasa enseguida.
  - El socio invita desde su app ("👥 Traé a un amigo") y la recepción lo ve esperando con "✅ Entró".
  - Límite por socio y por DNI. Un DNI de socio no es invitado. Solo invita quien puede entrar hoy. En Inicio del dueño, "👥 Invitados hoy".
  - Migración `20261104005300_invitados.sql`: tabla `invitados`, `registrar_invitado`, `invitar`, `confirmar_invitado`, `anular_invitado`, `invitados_de_hoy`, `mis_invitados`; `guardar_configuracion` y `configuracion_panel` copiados de 0049.
- Pruebas:
  - Base: `qr-pared`, `llavero` e `invitados` (vencido, falso, revocado, de otro socio, apagado, duplicado, topes).
  - e2e: `ent-6` (4 pasos, la cámara de prueba filma el QR de la tablet), `ent-7` (5) e `inv-1` (6).
  - Los e2e que cambian Reglas ya no se traban si el valor ya estaba (el botón Guardar queda apagado).
- Decisiones nuevas en la tabla del agente.

**QUÉ CORRÉS VOS**
- `aplicar` (0020 a 0053).

**LO QUE NO PUDE VERIFICAR**
- Un lector USB de llaveros real: se probó escribiendo el código y Enter, que es lo que hace el lector.
- Un celular de verdad escaneando una tablet de verdad.

---

## 2026-11-05 · ENT-3 · Tablet en la puerta (modo kiosco)

**QUÉ HICE**
- Configuración → Reglas → "📲 Tablet en la puerta" se puede prender. El dueño autoriza cada tablet (nombre y sede) y recibe un link con su QR que se ve una sola vez; la base guarda solo el hash del token. Se puede revocar.
- `/kiosco`: el link guarda el token en una cookie que el navegador no lee y lo saca de la dirección.
  - Pantalla sin menú: "¡Hola! Escribí tu DNI", teclado grande y "📷 Mostrar mi QR" si el gimnasio usa QR.
  - Si puede entrar: "¡Pasá, Juan!" y queda anotado como "en la tablet". Si no: "hoy no podés pasar", el porqué sin montos, y que pase por recepción.
  - Vuelve sola al inicio.
- Migración `20261104005000_kiosco.sql`:
  - `autorizar_tablet`, `revocar_tablet`, `tablets_panel`.
  - `kiosco_estado` y `kiosco_entrar`: sin sesión, el token autoriza adentro de la función; 30 intentos por minuto.
  - `privado.validar_qr`: la validación del QR, que ahora usan la recepción y la tablet.
  - Se sacó el permiso de leer la tabla de tokens.
- Pruebas:
  - `supabase/pruebas/kiosco.test.mjs`: el token no se guarda ni se lee; DNI; rojo sin plata en pantalla; DNI inexistente; token inventado; revocada; apagada.
  - `scripts/e2e/ent-3.mjs` (8 pasos, tablet 820 px).

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- La verificación completa con la app compilada (`next build` + `start`) dio fallas que con `next dev` no aparecen. Lo que encontré:
  - Las pruebas tocaban antes de que el contenido de la pantalla (que llega después que el marco) estuviera listo. Ahora cada pantalla del panel marca cuándo está lista y las pruebas lo esperan.
  - Algunas navegaciones de `<Link>` en Socios se cortaban (ERR_ABORTED) y no pasaba nada. No encontré la causa. Las píldoras de filtro de Socios pasaron a links comunes (recargan la lista) y ya andan siempre.
  - La verificación volvió a correr con `next dev`, como dice CLAUDE.md.
- Las pantallas y acciones de este turno pasan con `next dev`.

**QUÉ CORRÉS VOS**
- `aplicar` (0020 a 0050).

**QUÉ CONFIGURÁS VOS**
- Nada. En Vercel, después de mergear, conviene tocar un par de botones de Socios (filtros, pestañas de la ficha, guardar una nota) para confirmar que la app publicada responde.

**LO QUE NO PUDE VERIFICAR**
- El problema de `<Link>` con la app compilada en local: no sé si pasa en Vercel.
- Una tablet de verdad: se probó con un navegador del tamaño de una tablet.

---

## 2026-11-05 · ENT-4 · Reglas de "dejar pasar" (D1)

**QUÉ HICE**
- La base controla quién deja pasar (`public.registrar_ingreso`, misma firma):
  - La recepción tiene un tope por día y por persona; lo pone la dueña en Reglas (por defecto 5; en 0 la recepción no deja pasar).
  - A un suspendido o a un dado de baja lo deja pasar solo el dueño o el encargado. Dueño y encargado no tienen tope.
- Entrada:
  - "Dejar pasar igual" ofrece motivos frecuentes de un toque ("Paga mañana", "Clase de prueba"…) o texto libre, y dice "te quedan N de 5 hoy". En el tope se apaga.
  - Con un suspendido, la recepción ve "🔒 A este socio lo deja pasar el dueño o el encargado".
- Inicio del dueño y del encargado: "🚪 Dejados pasar hoy", con quién, el motivo y por qué no podía entrar.
- Migración `20261104004900_dejar_pasar.sql`: `privado.puede_dejar_pasar`, `cupo_dejar_pasar`, `dejados_pasar`, `configuracion.tope_dejar_pasar`; `guardar_configuracion` y `configuracion_panel` copiados de 0044.
- Pruebas:
  - `supabase/pruebas/dejar-pasar.test.mjs` (3).
  - `scripts/e2e/ent-4.mjs` (7 pasos).
  - `panel-entrada` sube el tope para la prueba y lo devuelve a 5 al final.
- Decisiones nuevas en la tabla del agente (SOC-9, SOC-10, SOC-11, ENT-2, ENT-4).

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- `acceso.test` falla en la base local con el demo sembrado ("users_email_unico"): es lo de siempre (pasa en una base limpia, que es la que usa `verificar`).

**QUÉ CORRÉS VOS**
- `aplicar` (0020 a 0049).

**LO QUE NO PUDE VERIFICAR**
- La 0049 contra la base real (probada local).

---

## 2026-11-05 · ENT-2 · QR del socio, rotativo, y lector con cámara

**QUÉ HICE**
- Configuración → Reglas → "Cómo entra la gente": "📱 QR del socio" ya se puede prender (antes decía "todavía no disponible").
- App del socio: "📱 Tu QR para entrar". El código cambia cada 30 segundos y lo firma la base (HMAC con un secreto por socio que no sale de la base), así una captura vieja no sirve. Fondo blanco siempre, para que la cámara lo lea.
- Entrada:
  - "📷 Leer QR" abre la cámara y lee con jsQR.
  - Un lector USB que escribe el código y Enter también anda.
  - Si puede entrar, se anota solo como "con QR"; si no, queda el veredicto con el porqué.
- Migración `20261104004800_qr_socio.sql`:
  - `mi_qr` (solo el socio de esa cuenta), `leer_qr` (mostrador) y `formas_de_entrada`.
  - Los secretos y los usos viven en `privado` (no se exponen; al unir socios se van con el que se va).
  - Vale la ventana actual y la anterior (un minuto como mucho), una sola vez, solo en su gimnasio.
- Pruebas:
  - `supabase/pruebas/qr-socio.test.mjs`: apagado, una vez, ventana anterior, vencido, firma falsa, otro gimnasio, el profe no, otro usuario no lo saca.
  - `scripts/e2e/ent-2.mjs` (8 pasos): la cámara de prueba de Chrome filma el QR (un .y4m hecho con ffmpeg) y la recepción lo lee de verdad.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- La verificación completa con la app compilada (`next build` + `start`, más liviana que `next dev`) mostró que las pruebas tocaban botones antes de que React los tomara: onb-1, soc-7 y soc-8 fallaban solo ahí. Ahora la página marca `html[data-hidratado]` y las pruebas lo esperan después de cada carga.
- soc-2 seguía buscando el link de notas de antes de SOC-3: lo actualicé.
- Dependencias nuevas: `qrcode` (dibuja el QR) y `jsqr` (lo lee).

**QUÉ CORRÉS VOS**
- `aplicar` (0020 a 0048). Usa `pgcrypto`, que Supabase ya tiene en `extensions`.

**LO QUE NO PUDE VERIFICAR**
- La cámara de un celular real con la luz de una recepción: se probó con la cámara de prueba de Chrome filmando el QR.

---

## 2026-11-05 · ENT-1 · Veredicto a pantalla completa, con sonido y teclado

**QUÉ HICE**
- El veredicto ocupa toda la pantalla con el color: emoji grande, foto, nombre a 8xl y el porqué, para leerlo desde lejos.
- Teclado:
  - Enter anota la entrada si puede entrar; si no puede, no hace nada (no se cobra ni se deja pasar por accidente).
  - Esc vuelve a buscar con foco.
  - Escribir con el veredicto abierto arranca otra búsqueda, así el lector de DNI o llavero sigue andando sin tocar nada.
- Sonido: agudo y corto si entra; grave y doble si no; doble medio si entra con aviso. "🔊 Con sonido / 🔇 Sin sonido" queda guardado en esa compu.
- `scripts/e2e/ent-1.mjs` (10 pasos: pantalla completa, sonidos contados sin parlantes, Enter en rojo y en verde, Esc, escribir para buscar, apagar el sonido, celular). Sigue pasando `panel-entrada`; lo hice más firme para cuando hay dos socios con el mismo nombre.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- En el demo hay socios con el mismo nombre y apellido (el sembrado los repite). Para probar está bien; Duplicados (SOC-8) los muestra.

**LO QUE NO PUDE VERIFICAR**
- Cómo suena de verdad en un parlante: se verificó qué tonos se tocan, no cómo se oyen.

---

## 2026-11-05 · AUD-4 · Auditoría botón por botón: Entrada

**QUÉ HICE**
- Inventario en `docs/paneles/entrada.md`: cada botón probado haciendo clic con `scripts/e2e/panel-entrada.mjs` (`npm run e2e:entrada`, 12 pasos, recepción en compu y celular).
- Arreglado (chico):
  - Después de anotar dice "Entró <nombre>" y tiene "↩️ Deshacer".
  - En "Hoy", cada entrada tiene "⋯ Anular" con motivo; la base decide quién puede (la recepción, los primeros 5 minutos). La función ya existía pero no tenía pantalla.
  - "Hoy" dice la forma de entrada y quién dejó pasar.
  - En pausa, el veredicto ofrecía "Cobrar". Ahora ofrece "🏃 Volvió antes", que termina la pausa y deja entrar.
  - Si el gimnasio pide apto y el socio no lo presentó o le venció, avisa en amarillo. No frena.
- A la cola: ENT-8 (control de "dejar pasar" para el dueño) y ENT-9 (cobrar desde la Entrada con la cuota en el carrito).

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Una pausa que empezó hoy no se puede terminar con "volvió antes": la base pide anularla, y eso lo hace el dueño o el encargado. El mensaje lo dice; no lo cambié (toca permisos).

**LO QUE NO PUDE VERIFICAR**
- Nada: se abrió y se hizo clic.

---

## 2026-11-05 · DIS-3 · Pulido: Socios

**QUÉ HICE**
- Medí cada pantalla de Socios (lista, filtro, ficha y sus 4 pestañas, editar, nuevo, importar, duplicados) con la dueña, en compu y en el celular: ninguna desbordaba, ningún botón bajo 44 px, como mucho un verde.
- Celular: Importar, Duplicados y Exportar pasaron a "⋯ Más". La búsqueda subió de ~400 a ~317 px. En compu siguen a la vista.
- "← Socios" / "← Ficha del socio" arriba en Nuevo, Editar, Importar y Duplicados (`Encabezado` suma `volver`).
- `loading.tsx` con la forma real en la lista, la ficha, nuevo, editar, importar, duplicados y el reglamento aceptado. Antes usaban el genérico del panel.
- Capturas en `.local/capturas/dis3-antes-*` y `dis3-despues-*`. `scripts/e2e/dis-3.mjs` (10 pasos). Pasan soc-1, soc-4 y soc-8, ahora con `:visible` porque los botones están dos veces en la página.

**SIN ARREGLAR**
- Los celulares se muestran crudos (+5490002000160). Un formato lindo necesita saber dónde termina la característica, que en Argentina varía. Queda para después.

**LO QUE NO PUDE VERIFICAR**
- Nada: se abrió y se midió.

---

## 2026-11-05 · SOC-15 · Los avisos por WhatsApp de un menor van al responsable

**QUÉ HICE**
- `privado.celular_aviso` decide a qué celular se le escribe a un socio (menor → responsable). La usan Retención (y con ella Vencen hoy) y Cumplen hoy. La ficha ya lo hacía (SOC-10).
- Migración `20261104004700_avisos_menores.sql` (copias de `retencion_con` de 0025 y `cumplen_hoy` de 0038 con ese cambio). `supabase/pruebas/avisos-menores.test.mjs`; pasan retencion, cumpleanos y mensajes. Abiertas con sesión Retención (dueña), Vencen hoy e Inicio.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- El mensaje sigue diciendo "Hola Tomi": le llega al responsable con el nombre del chico. Se entiende, pero si querés "Hola, te escribimos por Tomi" es un mensaje más para editar en Configuración.

**QUÉ CORRÉS VOS**
- `aplicar` (0020 a 0047).

**LO QUE NO PUDE VERIFICAR**
- La 0047 contra la base real (probada local).

---

## 2026-11-05 · SOC-14 · La ficha dice cómo llegó y qué reglamento aceptó

**QUÉ HICE**
- Ficha → Contacto, abajo: "📝 Lo dio de alta Ana en el mostrador el 5/11", "Se anotó solo desde la página el …" o "Vino en una importación (archivo) el …"; si antes fue prospecto, cómo llegó ("pidió una clase de prueba desde la página"). Si aceptó el reglamento: versión y fecha, y "Ver lo que aceptó" abre el texto de esa versión (aunque después haya otra), para mostrárselo al socio.
- Migración `20261104004600_origen_socio.sql`: `origen_socio` y `reglamento_aceptado`. No guarda nada nuevo: sale de `socios.origen`, importaciones, prospectos y aceptaciones.
- `supabase/pruebas/origen-socio.test.mjs` y `scripts/e2e/soc-14.mjs` (3 pasos; usa al socio que anota reg-1, va después en la cadena).

**QUÉ CORRÉS VOS**
- `aplicar` (0020 a 0046).

**LO QUE NO PUDE VERIFICAR**
- La 0046 contra la base real (probada local).

---

## 2026-11-05 · SOC-13 · Alta en un paso: datos, plan y cobrar

**QUÉ HICE**
- "Nuevo socio" suma "🏷️ Plan" (las membresías activas, con precio). Con plan elegido aparecen "✅ Dar de alta y cobrar" (va a Vender con el socio y la primera cuota ya en el carrito) y "Solo dar de alta" (queda con el plan asignado). Sin plan, el botón de siempre. Si Vender está apagado o el rol no lo ve, no aparece "cobrar".
- Si el plan no se puede asignar, el socio igual queda dado de alta y la ficha lo avisa ("asignalo con 🏷️ Asignar plan"). Funciona también desde "Hacerlo socio" de Prospectos.
- Sin migración (usa `guardar_socio` y `asignar_plan`). `scripts/e2e/soc-13.mjs` (4 pasos, celular); pasan soc-10 y pag-3.

**LO QUE NO PUDE VERIFICAR**
- Que alta y plan sean una sola transacción: son dos llamadas. Si la segunda falla, queda el socio sin plan y se avisa (no se duplica).

---

## 2026-11-05 · SOC-12 · Filtros de Socios por estado y plan

**QUÉ HICE**
- Arriba de la lista: píldoras 🟢 Al día, 🟡 Por vencer, 🔴 Vencidos, ⏸️ En pausa, ⚪ Sin plan, 🆕 Nuevos (30 días), 👋 Dados de baja, cada una con su cuenta; abajo, una por plan (si hay más de uno) y las etiquetas. Se combinan con la búsqueda; tocar la activa la saca. Las que están en 0 no se muestran. En el celular la fila se desliza.
- Migración `20261104004500_filtros_socios.sql`: `privado.grupo_estado` agrupa el color y el motivo de `calcular_acceso` (no hay otro cálculo); `buscar_socios` suma `p_estado` y `p_plan` (la firma vieja se borra); `filtros_socios` da las cuentas.
- `supabase/pruebas/filtros-socios.test.mjs` (las cuentas suman el total y coinciden con la lista; cada fila es de su grupo) y `scripts/e2e/soc-12.mjs` (8 pasos). Pasan soc-3, soc-4 y panel-socios con la lista nueva.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- "Exportar" sigue llevando la búsqueda y la etiqueta, no el estado ni el plan.
- Con miles de socios, filtrar por estado calcula el veredicto de todos (no está guardado, a propósito). Con 330 tarda menos de un segundo; si un gimnasio grande lo nota, se cachea por minuto.

**QUÉ CORRÉS VOS**
- `aplicar` (0020 a 0045).

**LO QUE NO PUDE VERIFICAR**
- La 0045 contra la base real (probada local).

---

## 2026-11-05 · SOC-11 · Apto físico, solo sí/no y vencimiento (D9)

**QUÉ HICE**
- Configuración → Reglas: "🩺 Pedir apto físico" (apagado por defecto; apagado no aparece en ningún lado).
- Prendido, la ficha muestra "🩺 Sin apto físico" (amarillo), "Apto hasta el …" (verde) o "Apto vencido el …" (rojo). La recepción lo carga con "vale hasta" y lo quita si fue un error. No frena la entrada: es un aviso.
- Migración `20261104004400_apto_fisico.sql`: tabla `aptos_fisicos` (solo socio, hasta cuándo vale, quién y cuándo lo cargó; la verificación falla si alguien le suma columnas), `apto_socio`, `cargar_apto`, `anular_apto`, `configuracion.pide_apto`; `guardar_configuracion` y `configuracion_panel` copiados de 0042 con el campo.
- `supabase/pruebas/apto-fisico.test.mjs` y `scripts/e2e/soc-11.mjs` (6 pasos).

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- No lo puse en la Entrada ni en una lista de "aptos por vencer": D9 no lo pide. Si lo querés en la puerta, es un aviso más en el veredicto (decisión tuya: ¿frena o solo avisa?).

**QUÉ CORRÉS VOS**
- `aplicar` (0020 a 0044).

**LO QUE NO PUDE VERIFICAR**
- La 0044 contra la base real (probada local).

---

## 2026-11-05 · SOC-10 · Menores con adulto responsable (D10)

**QUÉ HICE**
- Alta y edición: al poner una fecha de nacimiento de menor de 18 aparece "👨‍👧 Adulto responsable" (nombre y celular, obligatorios; la base también lo exige). Un adulto no lo pide. Menor se calcula de la fecha de nacimiento; no se guarda.
- Ficha: "· 👧 menor de edad" en la cabecera, el responsable con su celular en Contacto, y el botón de WhatsApp va al responsable.
- App: al verificar el celular, la cuenta del responsable queda vinculada al menor (elige a quién mirar, como una familia); el celular del menor no vincula nada.
- Migración `20261104004300_menores.sql`: `socios.responsable_nombre` / `responsable_telefono`, `privado.es_menor`, y `ficha_socio`, `guardar_socio`, `vincular_socios_por_telefono` (mismas firmas). Rechaza fechas de nacimiento futuras.
- `supabase/pruebas/menores.test.mjs` (2) y `scripts/e2e/soc-10.mjs` (6 pasos, celular).

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Toca permisos de la app (quién entra por quién), según D10: un menor que ya estaba vinculado a su propia cuenta antes de esta migración sigue vinculado; no lo desvinculé (lo hace el dueño si hace falta).
- Retención, Vencen hoy y Cumplen hoy le escriben al celular del menor: queda anotado como SOC-15.
- El demo podía sembrar socios de 17 años sin responsable: ahora nacen hasta 2006.

**QUÉ CORRÉS VOS**
- `aplicar` (0020 a 0043).

**LO QUE NO PUDE VERIFICAR**
- La 0043 contra la base real (probada local). El login del responsable por SMS de punta a punta en la app (probado el vínculo en la base).

---

## 2026-11-05 · SOC-9 · Pausas desde la ficha (D7)

**QUÉ HICE**
- Ficha → Resumen → "⏸️ Pausas": cuántos días usó en el año, las pausas (programada, en pausa, terminó, anulada) y el formulario (desde, vuelve el, motivo viaje/trabajo/estudio/otro, nota). Cuenta los días mientras se eligen.
- El dueño y el encargado pausan; la recepción ve "📨 Pedir una pausa" y el pedido queda esperando. En Inicio, el dueño y el encargado ven "⏸️ Pausas para aprobar" y desde la ficha aprueban o rechazan. "🏃 Volvió antes" (cualquiera del mostrador) y "Anular" con motivo (dueño/encargado).
- Configuración → Reglas: "Pausa: máximo de días por año" (por socio, por defecto 30; en 0 no se dan). Una pausa que cruza el año se cuenta en cada uno.
- Migración `20261104004200_pausas.sql`: `pedidos_pausa`, `pedir_pausa`, `resolver_pedido_pausa`, `pausas_socio`, `pedidos_pausa_pendientes`, `privado.validar_pausa` y `dias_de_pausa`; `congelar` (misma firma) ahora valida motivo y máximo; `guardar_configuracion` y `configuracion_panel` copiados de 0023 con el campo nuevo.
- `supabase/pruebas/pausas.test.mjs` (3) y `scripts/e2e/soc-9.mjs` (9 pasos: recepción en el celular pide, encargado aprueba desde Inicio, dueña anula).

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Toca permisos, y es lo que dice D7: **la recepción ya no puede congelar** (antes podía, con fecha de hoy en adelante). Ahora la pide. La prueba A5 de `revision.test.mjs` se actualizó para eso.
- Los motivos viejos ("personal", "económico") siguen valiendo para lo ya cargado; los nuevos se eligen entre los cuatro de D7.

**QUÉ CORRÉS VOS**
- `aplicar` (0020 a 0042).

**LO QUE NO PUDE VERIFICAR**
- La 0042 contra la base real (probada local). `npm run db:types` necesita el proyecto de Supabase: no corrió acá.

---

## 2026-11-04 · SOC-5 · Grupo familiar

**QUÉ HICE**
- En la ficha (Resumen) aparece "👨‍👩‍👧 Familia": se suma a otro socio buscándolo por nombre o DNI; cada familiar con su punto de estado, link a su ficha y "Sacar". Sin descuento automático (eso es D14).
- Migración `20261104004100_grupo_familiar.sql`: tabla `grupos_familiares`, `socios.grupo_familiar_id` (FK compuesta), `familia_socio`, `vincular_familia` (si los dos ya tenían familia, se juntan), `sacar_de_familia` (una familia de uno se deshace). Mostrador para arriba; el profe no.
- `supabase/pruebas/grupo-familiar.test.mjs` y `scripts/e2e/soc-5.mjs` (4 pasos, celular).

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- En el celular la fila de pestañas de la ficha empujaba la página 24 px a la derecha cuando una tarjeta del Resumen era ancha: `.pestanas` ahora tiene `min-width: 0; max-width: 100%` (arreglo trivial, al lado).

**QUÉ CORRÉS VOS**
- `aplicar` (0020 a 0041).

**LO QUE NO PUDE VERIFICAR**
- La 0041 contra la base real (probada local).

---

## 2026-11-04 · SOC-8 · Encontrar y unir socios duplicados

**QUÉ HICE**
- Socios → "🔎 Duplicados" (dueño y encargado): pares con el mismo celular o con nombre casi igual (sin acentos; con DNI distinto no se proponen). Cada par lado a lado; el dueño elige "Quedarse con #N", confirma ("no se puede deshacer") y listo.
- Migración `20261104004000_unir_socios.sql`: `posibles_duplicados`, `unir_socios` (solo dueño), tabla `uniones_socios`. Mueve todo lo que tiene `socio_id` (se descubre solo: pagos, ventas, cuotas, entradas, reservas, asistencias, packs, notas, etiquetas sin repetir, prospectos…), completa los datos que le faltan al que queda y borra al otro. Las dos claves (cuota/congelamiento → suscripción) pasan a revisarse al final de la transacción; `hecho_inmutable` deja cambiar solo el `socio_id` del que se va al que queda durante la unión.
- `supabase/pruebas/unir-socios.test.mjs` (la cuota del duplicado queda en el que queda y entra verde) y `scripts/e2e/soc-8.mjs` (7 pasos).

**QUÉ CORRÉS VOS**
- `aplicar` (0020 a 0040).

**LO QUE NO PUDE VERIFICAR**
- La 0040 contra la base real (probada local): recrea dos claves foráneas (coberturas y congelamientos → suscripciones) como diferibles; con muchos datos tarda lo que tarda revisarlas una vez.

---

## 2026-11-04 · SOC-7 · Foto del socio con la cámara

**QUÉ HICE**
- Ficha: tocar el cuadrado con las iniciales abre "📷 Foto del socio": cámara (compu o celular) con "📸 Sacar foto", o "🖼️ Elegir una imagen"; "Quitar la foto". Se recorta cuadrada a 480 px en el navegador.
- Entrada: al elegir al socio se ve su foto junto al veredicto.
- Migración `20261104003900_foto_socio.sql`: `preparar_foto_socio` (la ruta la arma la base), `confirmar_foto_socio` (solo esa ruta; devuelve la anterior para borrarla), `foto_socio` (equipo, también profe); bucket privado `fotos_socios` (512 KB, JPG). La sube el servidor con la clave de servicio; `/panel/socios/<id>/foto` la sirve después de preguntar a la base.
- `supabase-local` baja objetos privados con la clave de servicio (como Supabase) y conoce el bucket nuevo. Las pruebas e2e pueden usar la cámara de prueba de Chrome (`navegador({ camara: true })`).
- `supabase/pruebas/foto-socio.test.mjs` y `scripts/e2e/soc-7.mjs` (6 pasos).

**QUÉ CORRÉS VOS**
- `aplicar` (0020 a 0039). El bucket `fotos_socios` lo crea la migración en Supabase.

**LO QUE NO PUDE VERIFICAR**
- Con una cámara real y en Supabase de verdad (probado con la cámara de prueba de Chrome y el storage local).

---

## 2026-11-04 · SOC-6 · Cumpleaños

**QUÉ HICE**
- Inicio (dueño, encargado, recepción): "🎂 Cumplen hoy" con el nombre (a la ficha), cuántos cumple y "💬 Saludar" con el mensaje "Cumpleaños" de Configuración → Mensajes. Sin cumpleaños, no aparece nada.
- Migración `20261104003800_cumpleanos.sql` (`cumplen_hoy(gimnasio, momento)`: fecha del gimnasio, el 29/2 se festeja el 28/2 en años no bisiestos, sin dados de baja).
- `supabase/pruebas/cumpleanos.test.mjs` y `scripts/e2e/soc-6.mjs`.

**SIN ARREGLAR**
- La bandeja de avisos (AVI-1) todavía no existe: cuando esté, los cumpleaños van ahí también.

**QUÉ CORRÉS VOS**
- `aplicar` (0020 a 0038).

**LO QUE NO PUDE VERIFICAR**
- La 0038 contra la base real (probada local).

---

## 2026-11-04 · SOC-4 · Exportar la lista de socios

**QUÉ HICE**
- Socios → "📤 Exportar" (dueño y encargado): descarga un CSV que abre bien en Excel (punto y coma, acentos) con número, nombre, apellido, DNI, celular, mail, nacimiento, plan, estado, cubierto hasta, alta, baja y etiquetas. Usa el mismo filtro que la lista (búsqueda y etiqueta).
- Migración `20261104003700_exportar_socios.sql` (`exportar_socios`, solo dueño y encargado; el estado sale de la misma cuenta que la Entrada). `src/lib/csv.ts` con pruebas: una celda que empieza con "=" no se vuelve fórmula al abrirla.
- Recepción: no ve el botón; si abre la dirección, "Sin permiso" (403), nunca un archivo vacío.
- `scripts/e2e/soc-4.mjs` (5 pasos).

**QUÉ CORRÉS VOS**
- `aplicar` (0020 a 0037).

**LO QUE NO PUDE VERIFICAR**
- La 0037 contra la base real (probada local).

---

## 2026-11-04 · SOC-3 · Notas y etiquetas, con filtros

**QUÉ HICE**
- Ficha: etiquetas debajo del estado ("+ etiqueta" con las que ya existen para elegir; ✕ para sacarla). Pestaña Notas: escribir una nota (recordatorio de no anotar salud), lista con autor y fecha, "Borrar" para quien la escribió y para dueño/encargado. La nota vieja de la ficha sigue a la vista.
- Socios y Retención: filtro por etiqueta en píldoras (con su cuenta en Socios).
- Migración `20261104003600_notas_y_etiquetas.sql`: tablas `notas_socio`, `etiquetas`, `socio_etiquetas` (RLS, sin escritura directa), `notas_y_etiquetas`, `agregar_nota`, `borrar_nota`, `poner_etiqueta`, `sacar_etiqueta`, `etiquetas_gimnasio`, `socios_con_etiqueta`; `buscar_socios` suma `p_etiqueta` (la firma vieja se borra en la misma migración).
- `supabase/pruebas/notas-etiquetas.test.mjs` y `scripts/e2e/soc-3.mjs` (6 pasos).

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Con la base local, `supabase-local` guarda la lista de funciones al arrancar: después de cambiar la firma de una función hay que reiniciarlo (`scripts/local/levantar.sh`). En Supabase se recarga solo.

**QUÉ CORRÉS VOS**
- Actions → Base de datos → rama `noche/2026-11-04` → `prevuelo`, después `aplicar` (0020 a 0036). Ojo: esta cambia la firma de `buscar_socios`: aplicá antes de mergear (como siempre).

**QUÉ CONFIGURÁS VOS** / **SIN ARREGLAR**
- Nada.

**LO QUE NO PUDE VERIFICAR**
- La 0036 contra la base real (probada local).

---

## 2026-11-04 · SOC-2 · Ficha del socio en pestañas

**QUÉ HICE**
- La ficha tiene pestañas (con link propio, `?pestana=`): 👤 Resumen (plan, contacto, últimas entradas), 💵 Pagos (dueño y encargado), 📅 Asistencia y 📝 Notas. Arriba siguen el semáforo y los botones grandes (Cobrar, WhatsApp, Editar, plan, baja).
- Asistencia: veces en el mes, el mes anterior y semanas seguidas viniendo, con el calendario del mes (días que vino marcados, ◀ ▶ entre meses). Migración `20261104003500_asistencia_socio.sql` (`asistencia_socio`, sale de los ingresos; hora del gimnasio; los rechazos no cuentan).
- `supabase/pruebas/asistencia-socio.test.mjs` y `scripts/e2e/soc-2.mjs` (8 pasos).

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Nada.

**QUÉ CORRÉS VOS**
- Actions → Base de datos → rama `noche/2026-11-04` → `prevuelo`, después `aplicar` (0020 a 0035).

**QUÉ CONFIGURÁS VOS** / **SIN ARREGLAR**
- Nada. Notas con autor y fecha, y etiquetas: SOC-3.

**LO QUE NO PUDE VERIFICAR**
- La 0035 contra la base real (probada local).

---

## 2026-11-04 · SOC-1 · Importar socios desde Excel o CSV

**QUÉ HICE**
- Socios → "📥 Importar" (dueño y encargado): subir .xlsx o .csv → adivina qué columna es qué por el título (se puede cambiar; muestra un ejemplo de cada una) → "Revisar": cuántos entran y, por fila, qué hay que corregir (DNI inválido o ya socio, repetido en el archivo, celular que no se entiende, mail, fechas, plan que no existe) → "Importar N socios" → resumen y "Ver socios". Abajo, las importaciones con "Deshacer" (24 h).
- Migración `20261104003400_importar_socios.sql`: tabla `importaciones`, `revisar_importacion`, `importar_socios`, `importaciones_panel`, `deshacer_importacion`; fechas como día/mes/año (o del Excel); "nombre y apellido" en una columna se separa; "vence el" como cobertura de origen importación. `hecho_inmutable` deja borrar solo las filas de la importación que se está deshaciendo.
- `src/lib/importar.ts` (CSV con coma/punto y coma/tab y comillas, adivinar columnas) con pruebas en vitest; Excel con `read-excel-file` (dependencia nueva, solo en el navegador y solo al elegir un .xlsx).
- Pruebas: `supabase/pruebas/importar-socios.test.mjs` (3.000 socios en 8,9 s) y `scripts/e2e/soc-1.mjs` (12 pasos, con un Excel de ejemplo en `scripts/e2e/archivos/`).

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Algunos programas guardan celdas vacías del Excel de una forma que el lector no entiende: la pantalla lo dice y propone guardarlo como CSV.

**QUÉ CORRÉS VOS**
- Actions → Base de datos → rama `noche/2026-11-04` → `prevuelo`, después `aplicar` (0020 a 0034).

**QUÉ CONFIGURÁS VOS**
- Nada.

**SIN ARREGLAR**
- Packs y pases en la planilla (clases que le quedan): solo se importan membresías.

**LO QUE NO PUDE VERIFICAR**
- La 0034 contra la base real (probada local). Excel de otros sistemas reales: probé uno armado a mano.

---

## 2026-11-04 · AUD-3 · Auditoría botón por botón: Socios

**QUÉ HICE**
- Inventario en `docs/paneles/socios.md` (lista, alta, edición, ficha).
- `scripts/e2e/panel-socios.mjs` (16 pasos): buscar por nombre y número, sin resultados, alta, DNI repetido, Cobrar, WhatsApp, Editar, Asignar plan, Dar de baja, Volver a darlo de alta; recepción en celular.
- Migración `20261104003300_volver_a_dar_de_alta.sql`: `volver_a_dar_de_alta` + tabla `historial_bajas`; `telefono_normalizado` entiende el 15 del celular, el 0 de la característica, 0054 y 54 sin 9; `guardar_socio` la usa para el WhatsApp y el de emergencia. Pruebas: `volver-a-dar-de-alta.test.mjs` y `paneles.test.mjs` actualizada (antes exigía "+54 9", ahora acepta "387 15 555-1239").

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Un socio dado de baja que vuelve no tenía cómo volver: arreglado.
- El alta de socios armaba mal algunos teléfonos (le sacaba un 0 de más) y nadie entendía "387 15 …": arreglado en la base para todo el sistema.
- Cola: SOC-12 (filtros), SOC-13 (alta con plan y cobro), SOC-14 (cómo llegó y reglamento aceptado).

**QUÉ CORRÉS VOS**
- Actions → Base de datos → rama `noche/2026-11-04` → `prevuelo`, después `aplicar` (0020 a 0033).

**QUÉ CONFIGURÁS VOS**
- Nada.

**SIN ARREGLAR**
- Lo de la COLA.

**LO QUE NO PUDE VERIFICAR**
- La 0033 contra la base real: probada en la base local. `npm run db:types` necesita el proyecto real.

---

## 2026-11-04 · PAG-4 · Aparecer en Google

**QUÉ HICE**
- La página publicada lleva los datos del gimnasio para Google (schema.org `ExerciseGym`, una entrada por sede): nombre, frase, logo, teléfono, mail, dirección, mapa, Instagram y horarios de apertura por día. Sale de `src/lib/datos-estructurados.ts` (pruebas en vitest) con los mismos datos que se ven.
- `robots.txt` y `sitemap.xml` por dirección: la página publicada se indexa (y Hacete socio si hay altas); panel, app, admin e ingreso no. Sin publicar: robots dice que no y la página lleva `noindex`. Panel y app llevan `noindex` siempre. Dirección canónica en la página.
- `scripts/e2e/pag-4.mjs` (9 pasos). El barrido con Tu página y Prospectos dio 136 pasos en verde.

**LO QUE ENCONTRÉ SIN PEDIRTELO** / **QUÉ CORRÉS VOS** / **QUÉ CONFIGURÁS VOS**
- Nada. (Cuando el gimnasio tenga dominio propio, conviene darlo de alta en Google Search Console: es del dueño.)

**SIN ARREGLAR**
- Nada de este ítem.

**LO QUE NO PUDE VERIFICAR**
- Cómo lo lee Google de verdad (la prueba de resultados enriquecidos necesita la dirección pública).

---

## 2026-11-04 · DIS-13 · Pulido: Página del gimnasio

**QUÉ HICE**
- Un solo verde por pantalla: "Hacete socio" de arriba y "Elegir este" de cada plan pasaron a botón normal (el verde queda para el botón principal de la portada).
- Hacete socio: al elegir plan o forma de pago con el teclado se ve dónde está el foco.
- `loading.tsx` con la forma real en Hacete socio, Tu página y Prospectos.
- Capturas antes y después en `.local/capturas/dis13-*` (página y alta, compu y celular). Ningún botón queda bajo 52 px.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Nada nuevo.

**QUÉ CORRÉS VOS** / **QUÉ CONFIGURÁS VOS**
- Nada.

**SIN ARREGLAR**
- La portada en compu con texto y sin foto deja la mitad derecha vacía: con foto de portada (PAG-1) se llena. No lo toqué.

**LO QUE NO PUDE VERIFICAR**
- Nada: se abrió y se midió.

---

## 2026-11-04 · REG-1 · Hacete socio online desde la página

**QUÉ HICE**
- Tu página → "💪 Hacerse socio desde la página": interruptor y reglamento (cada cambio es una versión nueva; lo aceptado no cambia). Solo el dueño; no se prende sin reglamento.
- Con las altas prendidas, la página muestra "💪 Hacete socio" (arriba y en la portada) y en cada plan "💪 Elegir este". `/hacete-socio`: plan (con precio y variantes), datos (nombre, apellido, DNI, celular, mail y nacimiento opcionales), reglamento con "Leí y acepto", cómo paga (transferencia si el gimnasio la recibe, o en el gimnasio). Al terminar: "¡Bienvenido/a a …!" con el alias/CBU para copiar y "Entrar a la app con mi celular", o "Pasá por recepción". El mismo DNI o celular: "¡Ya sos socio!". Apagadas: "Consultanos por WhatsApp".
- Migración `20261104003200_alta_online.sql`: `altas_online` (apagado), tablas `reglamentos` y `aceptaciones_reglamento` (RLS, solo lectura del equipo, anon no las ve), `alta_publica`, `alta_online` (sin sesión; valida todo; socio con plan y sin cobertura; aceptación; aviso en Prospectos; hasta 20 por hora), `altas_panel`, `guardar_altas`; la página trae el id de cada plan y si hay altas.
- Entrada: el que se anotó online sale "⛔ Todavía no pagó Plan Full · son $25.000" con Cobrar, la misma cuenta de siempre.
- `supabase/pruebas/alta-online.test.mjs` (4) y `scripts/e2e/reg-1.mjs` (13 pasos). Barrido con Tu página y Prospectos por rol.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Un pase o un pack no puede ser suscripción: el alta online los anota sin plan asignado (decisión en la hoja de ruta).

**QUÉ CORRÉS VOS**
- Actions → Base de datos → rama `noche/2026-11-04` → `prevuelo`, después `aplicar` (0020 a 0032).

**QUÉ CONFIGURÁS VOS**
- Nada. Pagar con MercadoPago en el alta espera MP-1/MP-2 (tu app de MercadoPago).

**SIN ARREGLAR**
- La cuenta del socio: entra con el código a su celular (como hoy). En producción ese código necesita el proveedor de SMS o el mail (P1).
- Datos del adulto responsable para menores (D10): por ahora el alta online los manda al gimnasio.

**LO QUE NO PUDE VERIFICAR**
- La 0032 contra la base real: probada en la base local (y `verificar` en base limpia en verde). `npm run db:types` necesita el proyecto real.

---

## 2026-11-04 · PAG-3 · "Probá una clase": prospectos desde la página

**QUÉ HICE**
- Página: sección nueva "🙋 Probá una clase" (se edita, oculta y ordena en Tu página) con un formulario de nombre, WhatsApp y qué le interesa; botón "🙋 Probá una clase" en la portada. Al enviar: "¡Listo, Lucía! Te escribimos por WhatsApp…". Los errores no borran lo escrito.
- Panel: "🌱 Prospectos" (grupo Socios; dueño, encargado y recepción). Filtros Nuevos / Contactados / Vinieron / Se hicieron socios / No les interesó con su cuenta; "💬 Escribirle" con el mensaje armado (lo pasa a Contactados), "Vino a probar", "Hacerlo socio" (abre el alta con nombre, apellido y WhatsApp; al guardar queda atado a la ficha), "No le interesó", "Anotar uno que preguntó" en el mostrador.
- Mensaje nuevo editable "🌱 Quiere probar" en Configuración → Mensajes.
- Migración `20261104003100_prospectos.sql`: tabla `prospectos` (RLS, FK compuesta al socio, sin escritura directa, un visitante sin sesión no la ve), `quiero_probar` (sin sesión: solo página publicada con la sección visible; mismo celular no se duplica; hasta 30 por hora), `prospectos_panel`, `crear_prospecto`, `actualizar_prospecto`, `prospecto_es_socio`; la sección "probar" en todas las páginas y en las nuevas.
- El demo trae 5 prospectos en distintos estados.
- `supabase/pruebas/prospectos.test.mjs` (4) y `scripts/e2e/pag-3.mjs` (16 pasos): el recorrido completo de PAG-1 a PAG-3.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Un WhatsApp escrito "000 148 1439" (o cualquier celular que empiece con 00) se guardaba como "+01481439", un número que no existe, y el mismo celular escrito con +54 quedaba duplicado. Arreglado en la 0031: diez números son siempre un celular argentino y ningún número puede empezar con +0. Lo usan todos los teléfonos del sistema (gimnasio, sedes, prospectos).
- "Hacerlo socio" volvía a dibujar el alta después de guardar y daba error (el prospecto ya era socio): ahora va a la ficha desde el servidor.

**QUÉ CORRÉS VOS**
- Actions → Base de datos → rama `noche/2026-11-04` → `prevuelo`, después `aplicar` (0020 a 0031).

**QUÉ CONFIGURÁS VOS**
- Nada.

**SIN ARREGLAR**
- Inicio no muestra todavía "N prospectos nuevos" (va con el ítem de Inicio).
- Prospecto sin contestar en 24 h a la bandeja de avisos: va con AVI-1.

**LO QUE NO PUDE VERIFICAR**
- La 0031 contra la base real: probada en la base local. `npm run db:types` necesita el proyecto real.
- `npm run db:pruebas` con el demo cargado en la misma base da choques de mails de usuarios de prueba (pasa en base limpia; lo corre `verificar`).

---

## 2026-11-04 · PAG-2 · Publicar, pasar a borrador y compartir la página

**QUÉ HICE**
- Arriba de "Tu página": estado (🟢 Publicada / 📝 Borrador), la dirección, Publicar / Pasar a borrador (dueño), Ver, Copiar link y Compartir por WhatsApp (dueño y encargado).
- Al compartir el link: título, descripción (la frase de portada, o una armada con el título), imagen y tarjeta grande para WhatsApp, Instagram, Facebook y X. La imagen es la foto de portada; sin foto, `/og` dibuja una con el nombre, la frase y los colores del gimnasio. En borrador, la descripción dice que se está armando.
- `direccionPagina` pasó a `src/lib/panel/direccion-pagina.ts` (la usan Configuración y Tu página).
- `scripts/e2e/pag-2.mjs` (10 pasos).

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Nada.

**QUÉ CORRÉS VOS**
- Nada nuevo (sin migración).

**QUÉ CONFIGURÁS VOS**
- Nada.

**SIN ARREGLAR**
- La imagen de `/og` usa la letra por defecto (no la del sistema): para usar la misma hay que sumar el archivo de la letra al repositorio.
- En la dirección de Gym OS (`/g/<slug>`), la imagen para compartir sale de la dirección propia del gimnasio si tiene; si no, es la de Gym OS.

**LO QUE NO PUDE VERIFICAR**
- Cómo la muestra WhatsApp de verdad: necesita la dirección pública (localhost no la ve nadie). Lo que se probó son las etiquetas y que la imagen se abre.

---

## 2026-11-04 · PAG-1 · Editor de la página del gimnasio con vista previa

**QUÉ HICE**
- "🌐 Tu página" en el menú (grupo Gimnasio, dueño y encargado) y desde Configuración → Página. Portada (título, frase, texto del botón, mensaje de WhatsApp, foto elegida de la galería, mostrar precios) y las 8 secciones: título, mostrar u ocultar, ▲▼ para ordenar, y el contenido de Quiénes somos, Qué podés hacer, Profes y Preguntas (agregar, ordenar, quitar). Las que salen de otras pantallas (planes, horarios, fotos, sedes) dicen dónde se cambian.
- Vista previa en vivo: en compu, la página entera achicada al costado; en el celular, "👀 Ver cómo queda" a pantalla completa. Cambios sin guardar avisan; "Deshacer".
- Migración `20261104003000_editor_pagina.sql`: `pagina_panel` (dueño y encargado), `guardar_pagina` (solo dueño, todo junto, errores que dicen sección y campo: "Sección "Preguntas", respuesta 2: no puede quedar vacío"), trigger que suelta la foto de portada si se quita de la galería, y `privado.landing_completa`: el armado de la página vive en un solo lugar (lo usan la página pública y la vista previa). Verificado: `supabase/pruebas/editor-pagina.test.mjs` (4) y las de landing siguen en verde.
- `scripts/e2e/pag-1.mjs` (17 pasos).

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Dos preguntas o actividades con el mismo texto rompían las claves de la lista en la página (aviso de React): ahora usan la posición.
- `Landing.tsx` importaba de un archivo solo-servidor: no se podía usar en una vista previa. Arreglado (tipos e `urlMarca` aparte).

**QUÉ CORRÉS VOS**
- Actions → Base de datos → rama `noche/2026-11-04` → `prevuelo`, después `aplicar` (0020 a 0030).

**QUÉ CONFIGURÁS VOS**
- Nada.

**SIN ARREGLAR**
- Foto de cada profe (la sección muestra iniciales). Va con DIS-13.

**LO QUE NO PUDE VERIFICAR**
- La 0030 contra la base real: probada en la base local. `npm run db:types` necesita el proyecto real.

---

## 2026-11-04 · AUD-2 · Auditoría botón por botón: Página del gimnasio

**QUÉ HICE**
- Inventario en `docs/paneles/pagina.md`: cada link y bloque de la página, publicada y sin publicar.
- `scripts/e2e/panel-pagina.mjs` (16 pasos): abre cada link interno, valida WhatsApp (número + mensaje, otra pestaña), Instagram, mail, mapa y teléfono, "Lo quiero" de cada plan con su nombre, "Ver planes", título y og:title, celular sin desborde con el botón fijo; la dueña pasa a borrador → el visitante ve "Próximamente" → la vuelve a publicar; un gimnasio recién creado.
- Migración `20261104002900_proximamente_whatsapp.sql`: la página sin publicar devuelve el WhatsApp (copia de `landing_publica` de 0008 con ese único cambio). Pre-vuelo y aplicada en la base local.
- "🛎️ Soy del equipo" en el pie de la página publicada.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- La página sin publicar no tenía cómo contactar al gimnasio (la especificación lo marcaba como hecho). Arreglado.
- Cola: PAG-4 (aparecer en Google con datos del gimnasio).

**QUÉ CORRÉS VOS**
- Actions → Base de datos → rama `noche/2026-11-04` → `prevuelo`, después `aplicar` (0020 a 0029).

**QUÉ CONFIGURÁS VOS**
- Nada.

**SIN ARREGLAR**
- Nada de este ítem; lo grande está en PAG-1 a PAG-4 y REG-1.

**LO QUE NO PUDE VERIFICAR**
- La 0029 contra la base real: probada en la base local. `npm run db:types` necesita el proyecto real.

---

## 2026-11-04 · CFG-9 · Aviso de contraste al elegir colores

**QUÉ HICE**
- `contraste()` y `seLeePoco()` en `src/lib/marca.ts` (WCAG; avisa por debajo de 3 a 1, lo mínimo para bordes, links y texto grande). Pruebas unitarias en `marca.test.ts`.
- Configuración → Marca: con un color principal que casi no se ve sobre el fondo, aparece en el bloque "⚠️ Este color se ve poco sobre este fondo (contraste 1,5 a 1; conviene 3 o más)…". No prohíbe guardar. Pasa también con las muestras (el amarillo sobre el fondo crema).
- `scripts/e2e/cfg-9.mjs` (6 pasos, compu y celular).

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Dos muestras que ofrece la pantalla (amarillo y crema) juntas dan contraste 1,5: ahora avisa.

**A PARTIR DE ACÁ (pedido de Mateo, 22:17)**
- Pruebo a fondo lo esencial (permisos, plata, acceso). El resto lleva su prueba básica y la verificación completa (`npm run e2e` + `verificar`) corre en tandas cada varios ítems.

**QUÉ CORRÉS VOS**
- Nada nuevo (no hay migración en este ítem).

**QUÉ CONFIGURÁS VOS**
- Nada.

**SIN ARREGLAR**
- Nada de este ítem.

**LO QUE NO PUDE VERIFICAR**
- Nada: la pantalla se probó con sesión real.

---

## 2026-11-04 · CFG-8 · Historial de cambios de configuración

**QUÉ HICE**
- Migración `20261104002800_historial_configuracion.sql`: tabla `historial_configuracion` (gimnasio, campo, antes, después, quién, cuándo) con FK compuesta y RLS (leen dueño y encargado; sin políticas de escritura). La escriben triggers en `configuracion_gimnasio`, `gimnasios` (nombre), `landing_gimnasio` (publicada, WhatsApp, Instagram, mail), `sedes` y `plantillas_mensaje`: una fila por campo que de verdad cambió. `historial_configuracion(gimnasio, límite)` lo devuelve en palabras ("Avisar que vence (días antes)", "Sí/No", "QR del socio", la hora en la zona del gimnasio) para dueño, encargado y BRIK; recepción y profe reciben error. Verificado: `supabase/pruebas/historial-configuracion.test.mjs` (2 pruebas: una fila por campo cambiado y no por campo enviado, quién, valores en palabras; recepción con error, nadie inserta ni borra desde el cliente, BRIK lee).
- Configuración → pestaña "🕓 Cambios": qué, de qué a qué, quién y cuándo, lo más nuevo arriba. El super admin ve los últimos 20 en el detalle del gimnasio.
- `scripts/e2e/cfg-8.mjs` (11 pasos): la dueña cambia "Avisar que vence" y aparece la fila con su nombre y la hora; guardar un WhatsApp escrito de otra forma que da el mismo número no suma filas; el encargado lo lee; el super admin lo ve; celular sin desborde.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- En el celular, la fila deslizable de pestañas no mostraba la pestaña abierta cuando se entraba por un link (`?pestana=cambios` abría con "Gimnasio, Marca, Página" a la vista). Ahora la pestaña activa queda a la vista (`Pestanas`, sirve para todas las pantallas con pestañas). Lo prueba cfg-8.
- El WhatsApp escrito "00 0011-1222" se guarda como "+00111222" (un número que no existe) sin avisar: la normalización de `guardar_datos_gimnasio` (0021) toma el "00" como prefijo internacional. No lo toqué (es otra migración ya entregada); va abajo en SIN ARREGLAR.

**QUÉ CORRÉS VOS**
- Actions → Base de datos → rama `noche/2026-11-04` → `prevuelo`, después `aplicar` (0020 a 0028).

**QUÉ CONFIGURÁS VOS**
- Nada.

**SIN ARREGLAR**
- WhatsApp con "00" adelante se guardaba mal (ver arriba). Arreglado después, en la 0031 (PAG-3).

**LO QUE NO PUDE VERIFICAR**
- La migración 0028 contra la base real: probada en la base local.
- `npm run db:types`: necesita el proyecto real.

---

## 2026-11-04 · CFG-7 · Apagar una sección avisa qué deja de andar en las otras

**QUÉ HICE**
- Configuración → Secciones: al apagar una sección, su interruptor dice al instante qué deja de andar y qué sigue ("⚠️ Apagada: …"), antes de guardar.
- `LinkPanel` + `rutaDisponible`: los links y botones que llevan a otra pantalla aparecen solo si esa pantalla está prendida para el gimnasio y el rol. Se usó en Entrada (Cobrar, Ver ficha, Darlo de alta, últimas entradas), Vender (Ver ficha, Ir a la entrada, Darlo de alta), la ficha (Cobrar/Vender), Retención/Vencen hoy (nombre) y Transferencias (nombre). Inicio no muestra avisos que llevan a una pantalla apagada. La ficha y Editar socio exigen la sección Socios (antes se abrían por la dirección con Socios apagada).
- Migración `20261104002700_transferencias_apagada.sql`: con Transferencias apagada, la app no pide comprobantes y la base no los acepta (antes el socio pagaba y su comprobante quedaba sin nadie que lo aprobara). El mostrador sigue cobrando por transferencia. Verificado: `supabase/pruebas/secciones-cfg7.test.mjs` (2 pruebas).
- Tabla de dependencias en `docs/paneles/configuracion.md`.
- `scripts/e2e/cfg-7.mjs` (18 pasos): cada una de las 8 secciones se apaga desde la pantalla, se abren 14 pantallas (con una ficha) buscando links a ella, se prueba la app con Transferencias apagada y la Entrada sin Socios, y se vuelve a prender. Pruebas unitarias de `rutaDisponible`.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Con Socios apagada, la ficha de un socio se seguía abriendo escribiendo la dirección: ahora dice que la sección está apagada.
- Con Transferencias apagada, la app seguía pidiendo comprobantes que nadie podía aprobar: plata del socio sin acreditar. Lo corregí en la base (es restringir, no dar más acceso) y lo anoté en "Decisiones que tomó el agente".

**QUÉ CORRÉS VOS**
- Actions → Base de datos → rama `noche/2026-11-04` → `prevuelo`, después `aplicar` (0020 a 0027).

**QUÉ CONFIGURÁS VOS**
- Nada.

**SIN ARREGLAR**
- Nada de este ítem.

**LO QUE NO PUDE VERIFICAR**
- La migración 0027 contra la base real: probada en la base local. Reescribe `informar_transferencia` y `mi_socio` copiadas de 0023 con un solo cambio.
- `npm run db:types`: necesita el proyecto real.

---

## 2026-11-04 · CFG-6 · Formas de entrada, reingreso y días de retención en Configuración

**QUÉ HICE**
- Configuración → Reglas: 🔁 "Volver a entrar el mismo día gasta otra entrada" con un ejemplo que cambia según esté prendido o apagado (pack a las 8 y a las 19; pase diario); 📉 Retención con los cuatro días ("No viene", socio nuevo, vencido → se fue, cuánto se muestran los que se fueron), cada uno con qué lista mueve; 🚪 Cómo entra la gente: Recepción prendida siempre, y QR del socio, tablet y llavero como "todavía no disponible".
- Sin migración: la base ya guardaba y validaba estos campos (0020).
- Verificado: `supabase/pruebas/reglas-cfg6.test.mjs` (guardado con la función de la pantalla y probado contra `calcular_acceso` y la retención con momentos fijos: con reingreso prendido el pase de hoy ya no deja entrar; con 1 día de límite, la testigo vencida pasa a "se fue"). `scripts/e2e/cfg-6.mjs` (9 pasos): con 1 día, en el demo los vencidos pasan de 58 a 11 y "se fue" de 31 a 78; todo vuelve al valor de antes.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Nada nuevo.

**QUÉ CORRÉS VOS**
- Nada nuevo (sin migraciones).

**QUÉ CONFIGURÁS VOS**
- Nada.

**SIN ARREGLAR**
- Los interruptores de QR, tablet y llavero se prenden cuando existan (ENT-2, ENT-3/6, ENT-7).

**LO QUE NO PUDE VERIFICAR**
- Nada pendiente de esta vuelta más allá de lo general (`db:types` necesita el proyecto real).

---

## 2026-11-04 · ONB-1 · "Primeros pasos" del dueño en Inicio

**QUÉ HICE**
- Inicio del dueño: tarjeta 🚀 Primeros pasos con barra de progreso ("4 de 8 listos"), el próximo paso como botón que lleva a la pantalla que lo resuelve, la lista completa (✅ los hechos), "No mostrar más" y, si está oculta, "Ver los primeros pasos" para traerla de vuelta. Desaparece sola cuando está todo. Los otros roles no la ven ni la piden.
- Migración `20261104002600_primeros_pasos.sql`: `privado.primeros_pasos` calcula cada paso de los datos (nunca se guarda un "hecho"); `primeros_pasos`, `ocultar_primeros_pasos` (usa `onboarding_salteado_en`, que ya existía) y `publicar_pagina`, solo el dueño. Verificado: `supabase/pruebas/primeros-pasos.test.mjs` (3 pruebas: cada dato marca su paso, cobros con y sin transferencias, ocultar/publicar y permisos).
- Configuración → Página: 🚀 Publicar mi página / 📝 Pasar a borrador.
- `scripts/e2e/onb-1.mjs` (12 pasos, con el gimnasio casi vacío Box Norte Demo): las 8 pantallas de los pasos abren; subir el logo marca su paso solo (3 → 4); borrador muestra "Estamos armando nuestra página" y publicar la muestra completa; el botón lleva al próximo paso; ocultar queda guardado; el encargado no lo ve. Se puede correr dos veces seguidas.
- Verificado también: `npm run e2e` completo en verde (17 + 14 + 40 + 24 + 13 + 18 + 16 + 12 + 120), db:pruebas 196, `npm run verificar` en verde sobre base limpia, `npm run mapa` (84 funciones usadas, ninguna faltante), capturas de compu y celular revisadas.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Nadie podía publicar la página de un gimnasio nuevo desde el panel (solo el seed del demo la publicaba). Sumé el botón: es lo único que hacía falta para que el paso tenga salida.
- En Inicio quedaban dos botones con el color principal (el paso y Entrada): el del paso pasó a botón común con borde de color.

**QUÉ CORRÉS VOS**
- Actions → Base de datos → rama `noche/2026-11-04` → `prevuelo`, después `aplicar` (0020 a 0026).

**QUÉ CONFIGURÁS VOS**
- Nada.

**SIN ARREGLAR**
- Importar socios desde Excel: no existe todavía (el paso lleva al alta de a uno).

**LO QUE NO PUDE VERIFICAR**
- La migración 0026 contra la base real: probada en la base local con las mismas migraciones.
- `npm run db:types`: necesita el proyecto real.

---

## 2026-11-04 · CFG-5 · Mensajes editables con vista previa

**QUÉ HICE**
- Configuración → 💬 Mensajes: los 8 mensajes que el gimnasio les manda a sus socios (vence pronto, venció, no viene, nuevo que no viene, se fue, bienvenida, cumpleaños, comprobante rechazado). Cada uno dice cuándo se usa y en qué pantalla, se edita con chips de variables que se insertan donde está el cursor, muestra cómo lo recibe un socio real mientras escribís (sin guardar), avisa cambios sin guardar y tiene "Volver al original".
- Migración `20261104002500_mensajes.sql`: `privado.mensajes_catalogo` (un solo lugar con los mensajes, sus variables y su texto original), `privado.armar_mensaje` (reemplaza {variables}), `privado.retencion_con` (el cálculo de retención de 0010, con plantillas opcionales sin guardar para la vista previa; `privado.retencion` queda como envoltorio, misma salida), `mensajes_panel`, `guardar_mensaje`, `restaurar_mensaje`, `vista_previa_mensaje`. Variables nuevas {plan} y {debe}; {monto} sigue andando. Verificado: `supabase/pruebas/mensajes.test.mjs` (5 pruebas: catálogo, un cambio se ve en la retención con fecha fija, validación, vista previa que no guarda, permisos).
- `scripts/e2e/cfg-5.mjs` (16 pasos): el mensaje cambiado aparece en los 49 links de WhatsApp de Retención y en los 15 de Vencen hoy; "Volver al original" los devuelve; el encargado también edita.
- Los mensajes de éxito ya no repiten el ✅ (el componente ya lo pone).

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- El contenedor de la nube se reinició en medio de la verificación (se cortó un comando largo): se perdió la base local, no el código. Volví a levantar todo y verificar desde cero.
- "Vence pronto" con alguien que vence hoy dice "vence el 04/11" (la fecha de hoy). Se entiende, pero "vence hoy" sería mejor: es la variable {vence} de la retención, que no toqué para no cambiar los textos que ya existen.

**QUÉ CORRÉS VOS**
- Actions → Base de datos → rama `noche/2026-11-04` → `prevuelo`, después `aplicar` (0020 a 0025). Los gimnasios que ya existen reciben los 3 mensajes nuevos con su texto original; los que ya editaron los suyos los conservan.

**QUÉ CONFIGURÁS VOS**
- Nada.

**SIN ARREGLAR**
- Bienvenida, cumpleaños y comprobante rechazado quedan listos pero ninguna pantalla los manda todavía: es la bandeja de avisos (AVI-1).

**LO QUE NO PUDE VERIFICAR**
- La migración 0025 contra la base real: probada en la base local con las mismas migraciones. Reescribe el cálculo de retención copiándolo de 0010 con un solo cambio (el armado del mensaje); si producción tuviera otra versión (no debería), se pisaría.
- `npm run db:types`: necesita el proyecto real.

---

## 2026-11-04 · CFG-4 · Horarios del gimnasio, feriados y cierres

**QUÉ HICE**
- Configuración → ⏰ Horarios: cuándo abre cada sede, día por día, con turno partido (hasta 3 franjas), "Lunes a viernes igual que el lunes", cierre a medianoche (00:00), y "Ahora: Abierto · cierra 22:00" calculado por la base. Debajo, 🚫 Días que cierra: desde, hasta (último día cerrado), motivo, devolver los días a los socios, sede; lista de próximos y recientes con cuántas clases canceló; anular pide el motivo.
- Migración `20261104002400_horarios_y_cierres.sql`: tabla `horarios_apertura` (RLS, FK compuesta a sedes), `privado.agenda` (una sola cuenta de "abierto ahora", próxima apertura salteando cierres, próximos cierres), `agenda_publica(host)` para la página y la app, `horarios_apertura_panel`, `guardar_horarios_apertura`, `cierres_panel`, y `crear_cierre` con errores que se entienden (misma firma). Verificado: `supabase/pruebas/horarios-cierres.test.mjs` (4 pruebas con momentos fijos, nunca `now()`); db:pruebas 188 en verde.
- Página del gimnasio: la sección Horarios sale de lo cargado ("Lunes a viernes 7:00 a 22:00", "Domingo Cerrado"), con "abierto ahora" en la portada y aviso de los próximos cierres arriba. App del socio: "Hoy: Abierto · cierra 22:00" y los cierres. El demo trae horarios.
- `src/lib/horarios.ts` (agrupar días y texto de cierres) con pruebas unitarias. `scripts/e2e/cfg-4.mjs` (18 pasos). Verificado: `npm run e2e` completo en verde (17 + 14 + 40 + 24 + 13 + 18 + 120), capturas revisadas, `npm run verificar` en verde sobre base limpia, `npm run mapa` (77 funciones usadas, ninguna faltante).

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- En la página, el logo se recortaba en un cuadrado (`object-cover`): un logo apaisado quedaba cortado. Ahora se ve entero.
- Las pruebas que escriben en un campo apenas carga la página a veces escribían antes de que React tomara la pantalla y lo escrito se perdía. La pestaña Horarios marca `data-listo` cuando ya responde y la prueba lo espera. (A una persona no le pasa: no escribe en 50 ms.)
- En el navegador de prueba los campos de hora se ven en formato AM/PM porque el sistema está en inglés; en una compu o celular en castellano se ven 07:00.

**QUÉ CORRÉS VOS**
- Actions → Base de datos → rama `noche/2026-11-04` → `prevuelo`, después `aplicar` (0020 a 0024).

**QUÉ CONFIGURÁS VOS**
- Nada.

**SIN ARREGLAR**
- El conteo "canceló N clases" cuenta las clases ya creadas de esos días; las que se crean después (se crean solas al abrir cada día) nacen canceladas igual, pero no suman al número.

**LO QUE NO PUDE VERIFICAR**
- La migración 0024 contra la base real: probada en la base local con las mismas migraciones.
- `npm run db:types`: necesita el proyecto real.

---

## 2026-11-04 · CFG-3 · Medios de pago y datos de transferencia

**QUÉ HICE**
- Configuración → Cobros: 💳 Medios de pago (efectivo, transferencia, débito, crédito, cada uno con su explicación; Mercado Pago apagado hasta conectar) y en Transferencias el banco o billetera. Si las transferencias están apagadas o falta alias y CBU, la pestaña lo avisa.
- Migración `20261104002300_medios_de_pago.sql`: `medios_aceptados` (al menos uno) y `banco_transferencia` en `configuracion_gimnasio`; `guardar_configuracion`, `configuracion_panel`, `precios_venta`, `vender`, `informar_transferencia` y `mi_socio` reescritas (misma firma, copiadas de su última versión con el cambio) para que la base haga cumplir los medios. Verificado: `supabase/pruebas/medios-de-pago.test.mjs` (4 pruebas: guardar y validar, Caja apagada con solo efectivo en los dos órdenes, Vender rechaza medios no aceptados y precios_venta ofrece solo los aceptados, app sin transferencias); db:pruebas 184 en verde.
- Vender ofrece solo los medios que dice la base; con uno solo no ofrece "pagar con dos"; sin ninguno, avisa y no deja cobrar. La app del socio muestra el banco y no ofrece transferir si el gimnasio no las recibe.
- `scripts/e2e/cfg-3.mjs` (13 pasos). Verificado: `npm run e2e` completo en verde (17 + 14 + 40 + 24 + 13 + 120), capturas revisadas, `npm run verificar` en verde sobre base limpia, `npm run mapa` sin funciones faltantes.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- El recargo o descuento por medio que pide el ítem ya existe por plan (`precios_plan` con `medio_pago`), y su pantalla es PLA-5. No hice un segundo sistema de % en Configuración: lo dejé anotado en "Decisiones que tomó el agente". Si querés un recargo general (por ejemplo crédito +10% también en productos), es un ítem nuevo que toca el cobro.
- Con Caja apagada y el efectivo como único medio, Vender quedaba sin cómo cobrar: ahora la base no deja llegar a esa combinación, guardes primero una cosa o la otra.

**QUÉ CORRÉS VOS**
- Actions → Base de datos → rama `noche/2026-11-04` → `prevuelo`, después `aplicar` (0020 a 0023). Los gimnasios que ya existen quedan con los cuatro medios prendidos (como hasta ahora).

**QUÉ CONFIGURÁS VOS**
- Nada.

**SIN ARREGLAR**
- Mercado Pago: necesita la cuenta conectada (ítem 🔌).
- Precio distinto por medio desde la pantalla: PLA-5.

**LO QUE NO PUDE VERIFICAR**
- La migración 0023 contra la base real: probada en la base local con las mismas migraciones (pre-vuelo, aplicada, pruebas). Reescribe seis funciones copiadas de su última versión; si producción tuviera una versión distinta de alguna (no debería: todas salen de este repo), se pisaría.
- `npm run db:types`: necesita el proyecto real.

---

## 2026-11-04 · CFG-2 · Subir logo, favicon y fotos desde el panel

**QUÉ HICE**
- Marca: 🖼️ Logo e 🔖 Ícono de la pestaña, con vista previa (el logo sobre el fondo del gimnasio, el ícono en una pestaña de navegador), Subir / Cambiar / Quitar. Página: 📸 Fotos, hasta 12, se suman varias juntas, se ordenan con ◀ ▶ y se quitan.
- El logo aparece en la barra del panel (compu y celular), en la vista previa de Marca, en la página y en la app del socio; el ícono, en la pestaña del panel, de la página y de la app.
- Migración `20261104002200_imagenes_marca.sql`: `preparar_imagen_marca` (permiso, tipo, tamaño, cupo de 12; da la ruta), `confirmar_imagen_marca` (la ruta es de este gimnasio y, en Supabase, el archivo está; devuelve la anterior para borrarla), `quitar_imagen_marca`, `ordenar_fotos`; `datos_gimnasio_panel` suma las imágenes y sus reglas. El bucket `marcas` baja a 2 MB y pierde la escritura directa. Verificado: `supabase/pruebas/imagenes-marca.test.mjs` (5 pruebas); db:pruebas 180 en verde.
- Servidor: mira los bytes del archivo (no el nombre) y rechaza SVG con código (`src/lib/imagenes.ts`, con pruebas unitarias); sube con la clave de servicio solo después de que la base dijo que sí; si la base rechaza al confirmar, borra lo subido; al reemplazar o quitar, borra el archivo viejo.
- `supabase-local` imita Storage en disco (`.local/storage`): subir y borrar con la clave de servicio, leer los buckets públicos, con los mismos límites de tamaño y tipo.
- `scripts/e2e/cfg-2.mjs` (24 pasos) con imágenes de verdad dibujadas en el navegador. Verificado: `npm run e2e` completo en verde (17 + 14 + 40 + 24 + 120), capturas de compu, celular y app del socio revisadas, `npm run verificar` en verde sobre base limpia, `npm run mapa` (71 funciones usadas, ninguna faltante).

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- El ícono de todas las pestañas era el de Next.js (el triángulo de Vercel, `src/app/favicon.ico` que trae la plantilla), y en el panel convivía con el del gimnasio. Lo moví a `public/`: ya no se agrega solo, y cada pantalla del gimnasio pone el suyo. Falta un ícono de Gym OS / BRIK para las pantallas de la plataforma (es un archivo tuyo).
- La app del socio no ponía el ícono del gimnasio en la pestaña: ahora sí.
- El e2e de Configuración tocaba también las muestras de fondo y dejaba el demo en crema: ahora deja el fondo como estaba.
- En modo desarrollo, una captura de Playwright antes de terminar de cargar la página genera un aviso de React ("hydration mismatch" por `caret-color`). Lo pone Playwright al sacar la foto, no la app. `E2E_CONSOLA=1` muestra la consola del navegador en cualquier e2e para investigar estas cosas.

**QUÉ CORRÉS VOS**
- Actions → Base de datos → rama `noche/2026-11-04` → `prevuelo`, después `aplicar` (0020, 0021 y 0022).
- Nada más: el bucket `marcas` ya existe en Supabase (0008); la 0022 le cambia el límite y saca las políticas de escritura.

**QUÉ CONFIGURÁS VOS**
- Nada nuevo. La subida usa `SUPABASE_SERVICE_ROLE_KEY`, que ya está en Vercel (la usan las contraseñas y los comprobantes).

**SIN ARREGLAR**
- Foto de portada de la página: va con el editor de la página (PAG-1).
- Ícono propio de Gym OS para las pantallas de la plataforma: falta el archivo.

**LO QUE NO PUDE VERIFICAR**
- La subida contra Supabase Storage real: está probada contra la imitación de `supabase-local` (mismos pedidos que hace `@supabase/storage-js`, mismos límites), no contra Supabase. Tampoco está corrido el chequeo de "el archivo está subido" de `confirmar_imagen_marca`, que solo corre donde existe `storage.objects`.
- Que en Supabase se borren de verdad las políticas viejas del bucket: la verificación de la migración lo comprueba al aplicarla, pero acá no hay esquema storage.
- `npm run db:types`: necesita el proyecto real.

---

## 2026-11-04 · CFG-1 · Configuración en pestañas, todo explicado

**QUÉ HICE**
- Configuración en pestañas: 🏠 Gimnasio · 🎨 Marca · 🌐 Página · 💵 Cobros · 📏 Reglas · 🗓️ Clases (solo con clases prendidas) · 🧩 Secciones · 🔗 Dirección · 👥 Equipo (link). Cada campo con su línea de ayuda; cada pestaña con su Guardar (solo se prende con cambios) y "Guardado ✅". Lo escrito sobrevive al cambiar de pestaña, la pestaña con cambios queda marcada con •, y salir con cambios pregunta antes. `?pestana=cobros` abre directo (para mandar el link o para ONB-1).
- Migración `20261104002100_datos_gimnasio.sql`: `datos_gimnasio_panel` (dueño y encargado leen) y `guardar_datos_gimnasio` (solo el dueño): nombre, WhatsApp, Instagram, mail de contacto y, de cada sede, nombre, dirección, teléfono y mapa. Todo o nada, con errores que dicen qué dato y cómo escribirlo. Los teléfonos se aceptan como los escribe la gente y se guardan +54…; Instagram acepta "@usuario" o el link. Verificado: `supabase/pruebas/datos-gimnasio.test.mjs` (3 pruebas: guardar y normalizar, cada error, permisos: encargado lee y no guarda, recepción y otro gimnasio reciben error, nadie toca la sede de otro gimnasio). db:pruebas 175 en verde.
- Página: si está publicada, el link (bien armado desde la plataforma o desde la dirección del gimnasio), Ver mi página, Copiar link y Mandar por WhatsApp. Dirección: las direcciones del gimnasio y si el dominio propio ya funciona.
- `Pestanas`: pestaña con navegación completa (`recargar`) y marca de cambios sin guardar; en compu bajan de renglón en vez de cortarse.
- `scripts/e2e/panel-configuracion.mjs` reescrito para las pestañas (40 pasos). Verificado: `npm run e2e` completo en verde (17 + 14 + 40 + 120), capturas de compu y celular revisadas, `npm run verificar` en verde sobre base limpia, `npm run mapa` (67 funciones usadas, ninguna faltante).

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- `levantar.sh` no liberaba el puerto en este contenedor (lsof no ve los procesos; fuser sí): quedaba vivo un `next dev` viejo y el login de los e2e se colgaba. Ahora junta lo que encuentran las dos herramientas, fuerza si hace falta y, si el puerto sigue ocupado, lo dice y corta en vez de seguir.
- Las sedes no se pueden sumar ni cerrar desde el panel (solo editar las que existen, desde esta vuelta). Para un gimnasio con varias sedes hace falta. No lo agregué a la COLA porque no salió de una auditoría: queda acá para que lo sumes.
- `next dev` agregó `.next-dev/types` a `tsconfig.json` (por el cambio de carpeta de la vuelta anterior). Es inofensivo y va en el commit.

**QUÉ CORRÉS VOS**
- Actions → Base de datos → rama `noche/2026-11-04` → `prevuelo`, después `aplicar` (aplica la 0020 y la 0021).

**QUÉ CONFIGURÁS VOS**
- Nada.

**SIN ARREGLAR**
- Pestaña Mensajes: llega con CFG-5. Logo y fotos en Marca: CFG-2. Formas de entrada: CFG-6. Sumar o cerrar sedes: ver arriba.

**LO QUE NO PUDE VERIFICAR**
- `npm run db:types`: necesita el proyecto real de Supabase. Las dos funciones nuevas se llaman con `rpc()` tipado a mano en la pantalla, así que el build no depende de esos tipos, pero no está corrido.
- "Copiar link": en el navegador de prueba el portapapeles no tiene permiso, así que el botón está, pero copiar no está probado. "Mandar por WhatsApp" está probado hasta el link armado, no abriendo WhatsApp.
- La migración 0021 contra la base real: probada en la base local con las mismas migraciones.

---

## 2026-11-04 · AUD-1 · Auditoría botón por botón: Configuración

**QUÉ HICE**
- Abrí Configuración como dueña y como encargado, en compu y celular, e hice clic en cada muestra de color, interruptor, modo de clases, campo y Guardar. Inventario completo en `docs/paneles/configuracion.md` (cada elemento: qué hace, si anda, qué le falta, con qué se conecta).
- Migración `20261104002000_configuracion_validada.sql`: `guardar_configuracion` (misma firma) valida cada campo antes de escribir y dice qué campo y qué poner ("Días de tolerancia: tiene que estar entre 0 y 60"), en vez del error crudo de Postgres. Suma: alias de 6 a 20 caracteres, CBU con 22 números (limpia espacios y guiones, dice cuántos puso), nombre hasta 60 letras, no se pueden apagar las tres formas de cobro, no se puede dejar sin formas de entrada. Verificado: 20 casos nuevos en `supabase/pruebas/paneles.test.mjs` con sesión de dueño; db:pruebas 172 en verde.
- Configuración: cada bloque marca "• Cambios sin guardar", su Guardar solo se prende con cambios, el resultado aparece en el mismo bloque, el navegador avisa antes de irse con cambios, un número vacío ya no se guarda como 0, y los interruptores son el componente común con una línea que explica cada uno.
- Vender con Caja apagada no ofrece efectivo (antes pedía abrir una caja en una pantalla apagada).
- `scripts/e2e/panel-configuracion.mjs` (27 pasos), sumado a `npm run e2e`. Verificado: `npm run e2e` completo en verde (17 + 14 + 27 + 120), capturas revisadas, `npm run verificar` en verde sobre base limpia, `npm run mapa` sin cambios.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Con fondo claro (el crema del demo), los títulos y todo texto sin color propio salían casi blancos sobre crema en todas las pantallas del gimnasio: el texto se heredaba ya calculado del `:root` oscuro. Lo arreglé en `globals.css` (`[data-tono] { color: var(--texto) }`) porque bloqueaba revisar las capturas; afecta a todo el sistema, para bien.
- El alias del gimnasio demo (`GIMNASIO.DEMO.EJEMPLO`, 21 caracteres) no es un alias válido: pasó a `GYM.DEMO.EJEMPLO` en el seed.
- `npm run build` pisaba `.next` mientras corría `next dev` y la app local quedaba sin estilos ni scripts; y `levantar.sh parar` dejaba vivo el `next dev`. Ahora dev usa `.next-dev` (`NEXT_DIST_DIR`) y `levantar.sh` libera los puertos.
- Campos que la base ya guarda y ninguna pantalla muestra (formas de entrada, reingreso el mismo día, tres días de retención): CFG-6. Dependencias entre secciones: CFG-7. Historial de cambios: CFG-8. Contraste de colores: CFG-9. Las cuatro decisiones que tomé están en "Decisiones que tomó el agente".

**QUÉ CORRÉS VOS**
- Actions → Base de datos → rama `noche/2026-11-04` → `prevuelo`, después `aplicar` (aplica la 0020; si todavía no aplicaste la 0019 de main, va junto).
- Después, mergeás el PR.
- Si un gimnasio real tiene un alias de más de 20 caracteres, sigue guardado; solo al tocar Guardar en Transferencias le va a pedir uno válido.

**QUÉ CONFIGURÁS VOS**
- Nada.

**SIN ARREGLAR**
- CFG-6 a CFG-9, en la COLA con su LISTO SI.

**LO QUE NO PUDE VERIFICAR**
- `npm run db:types`: necesita el proyecto real de Supabase. La firma de `guardar_configuracion` no cambió y las funciones nuevas son de `privado`, así que los tipos no deberían cambiar, pero no está corrido.
- La migración 0020 contra la base real: está probada en la base local con las mismas migraciones (pre-vuelo, aplicada, pruebas), no en Supabase.

---

## 2026-11-04 · AUD-0 · Mapa de pantallas, funciones y conexiones

**QUÉ HICE**
- `scripts/mapa-pantallas.mjs` (`npm run mapa`): arma `docs/paneles/README.md` desde el código. Por cada ruta (y el middleware): quién la ve, qué sección la apaga, qué funciones de la base llama (incluidas las de los componentes compartidos que importa) y a qué pantallas lleva. Contra la base, lista las funciones habilitadas que ninguna pantalla usa.
- `npm run verificar` corre `mapa --verificar`: falla si una pantalla llama a una función que no existe en la base (un botón que se rompería en producción).
- Las vueltas regeneran el mapa al terminar (PROMPT, paso 7).
- Verificado: el mapa contra la base local (31 rutas, 65 funciones usadas, ninguna faltante) y `npm run verificar` en verde con el chequeo nuevo.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- 12 funciones de la base sin pantalla. Las que faltan de verdad pasaron a la COLA: anular una venta (VEN-6, `anular_venta`) y anular un presente (CLA-7, `anular_asistencia`). Pausas (`congelar`…), cierres (`crear_cierre`…) y cambio de plan ya estaban (SOC-9, CFG-4, PLA-6).
- `cobrar_cuota`, `precio_cuota`, `caja_abierta` y `asignar_plan` son de la primera versión del cobro y siguen habilitadas para el equipo sin pantalla. Toca permisos: no lo cambié al pasar. Queda como SEG-7 (confirmar que Vender las reemplaza y sacarles el acceso, nunca dar más).

**QUÉ CORRÉS VOS**
- Nada (sin migraciones).

**QUÉ CONFIGURÁS VOS**
- Nada.

**SIN ARREGLAR**
- Lo de arriba, en la COLA.

**LO QUE NO PUDE VERIFICAR**
- Contra la base real de Supabase: el mapa compara contra la base local con las mismas migraciones; si producción no tiene alguna migración aplicada, el chequeo no lo ve.

---

## 2026-11-04 · DIS-0 · Sistema visual común

**QUÉ HICE**
- Componentes que faltaban, en `src/components/ui/`: `Mensaje` (error, éxito, aviso, info; con role alert/status), `Vacio` (emoji, qué pasa, qué hacer), `Dato`, `Interruptor`, `Pestanas`. Clases nuevas en `globals.css`: `.boton-chico`, `.boton-texto`, `.mensaje-*`, `.fila`, `.pestanas`, `.interruptor`, `.vacio`, animación `subir` y `tilde`.
- Todos los errores y resultados hechos a mano (16) pasan a `Mensaje`; los botones chicos y de texto, a sus clases; las filas para elegir socio, a `.fila`.
- Estados vacíos con acción en Socios (y en la búsqueda sin resultados), Transferencias, Clases del día y la lista de una clase.
- Los 4 números de Inicio llevan a su detalle (si la sección está prendida).
- `docs/DISENO.md`: con qué se arma cada pantalla.
- Verificado: `scripts/e2e/dis-0.mjs` (14 pasos en compu y celu: vacíos con su acción, números que llevan a su detalle, error de ingreso con el componente común), `npm run e2e:admin` (17 pasos), barrido de las 15 pantallas con los 4 roles en compu y celu (120 pasos), `npm run verificar` en verde (171 pruebas de base, 40 unitarias, chequeos, lint, tipos, build). Capturas mirándolas.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- En Socios vacío había dos botones verdes (el de arriba y el del vacío): el del vacío pasó a normal (un solo principal por pantalla).
- Los números de Inicio tenían la etiqueta antes del número en el código; ahora el orden del HTML es el correcto (etiqueta y valor) y se ve igual que antes.

**QUÉ CORRÉS VOS**
- Nada para esta vuelta (sin migraciones).

**QUÉ CONFIGURÁS VOS**
- Nada.

**SIN ARREGLAR**
- Los vacíos secundarios (lista de entradas de hoy, últimas entradas de la ficha, actividades de la grilla, super admin) quedan como texto: se pulen en su DIS de cada panel.

**LO QUE NO PUDE VERIFICAR**
- `npm run db:types`: necesita el proyecto real de Supabase; el código está escrito según la documentación, pero no está ejecutado (esta vuelta no cambia la base).

---

## 2026-11-03 · Super admin completo, claves y gimnasios sin subdominio

**QUÉ HICE**
- **Por qué "no hacía nada" en producción:**
  - El gimnasio se creaba en `nombre.gym-os-pied.vercel.app`, y Vercel no da esos subdominios: el link no abría.
  - El admin no tenía cómo entrar a un gimnasio que no fuera suyo.
  - El dominio base iba crudo a la base (con `https://` o una barra, fallaba con "Dominio base no válido").
  - Un error después de crear (por ejemplo, sin la clave de servicio) rompía la pantalla sin decir nada.
- **Super admin (`/admin`):**
  - Estado de la plataforma: dominios, clave de servicio cargada y respondiendo (sin mostrarla), aviso de "sin dominio propio".
  - Alta de gimnasio con el resultado accionable: Entrar al panel, Equipo y claves, Ver su página. Todo error vuelve como texto.
  - Cada gimnasio: **Entrar al panel** (como "Soporte BRIK", queda en su equipo y el dueño lo ve), **Equipo, claves y direcciones**, **Ver su página** (`/g/<slug>`).
  - Detalle (`/admin/<id>`): equipo con mail y último ingreso, **nueva contraseña** para cualquiera (menos cuentas de BRIK), **dar acceso** a quien no tiene cuenta, sumar personas, sumar y quitar direcciones propias, dejar el equipo.
  - Cambiar la contraseña propia.
- **Claves del lado del dueño:** en Equipo, nueva contraseña para su equipo (no para otros dueños ni para Soporte BRIK) y dar acceso a quien no tenía. En `/ingresar`: "¿Te olvidaste la contraseña? Pedile una nueva al dueño (si sos el dueño, a BRIK)".
- **Sin subdominio:** `/g/<slug>` muestra la página del gimnasio desde la dirección de la plataforma y lo deja elegido (cookie, sin permisos); `/app` y el ingreso del socio usan ese gimnasio, igual que `/panel`. En el panel, "Cambiar de gimnasio".
- **La página del gimnasio no tenía cómo entrar el socio:** botón "💪 Soy socio" (y en la de "próximamente", socio y equipo).
- **Base, 0019:** `equipo.es_soporte`, `gimnasio_por_slug` con una dirección, `admin_gimnasios` (+ estoy adentro, dueños sin acceso), `admin_entrar/salir_gimnasio`, `admin_gimnasio`, `admin_agregar_persona`, `admin_agregar/quitar_dominio`, `cuenta_para_nueva_clave`, `persona_para_dar_acceso`. La base decide quién puede tocar la cuenta de quién; el servidor usa la clave de servicio recién después.
- **GitHub Actions → Base de datos:** `estado` (qué hay en producción, sin datos personales) y `sembrar-demo` (gimnasio demo con 300 socios ficticios).
- **Verificado:**
  - 8 pruebas de base nuevas (entrar/salir, quién cambia la clave de quién, direcciones, anon resuelve el slug).
  - `estado` corrido en producción: 18 migraciones, 1 super admin, un gimnasio "mi-gym" sin socios y con el dueño sin acceso (se creó, pero en una dirección que no abre).
  - Playwright con sesiones reales, 18 pasos: crear gimnasio con dueño → entrar como soporte → nueva contraseña (la vieja deja de servir, la nueva entra) → sumar recepción y darle acceso → sumar y quitar dirección → el dueño ve a Soporte BRIK y le cambia la clave a su recepción → página del demo por `/g/demo` → socio entra con código a la app desde la plataforma → `/g/no-existe` da 404.
  - Barrido de las 15 pantallas del panel con dueña, encargado, recepción y profe: ningún error de servidor.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Al "dar acceso", la pantalla se refrescaba y la contraseña recién creada nunca se mostraba (la persona ya figuraba con cuenta). Arreglado: el resultado se muestra primero.
- El workflow pegaba el mail de `hacer-admin` directo en el comando de la terminal. Ahora va por variable de entorno.
- `npm run lint` fallaba en `/elegir` (un `<a>` a `/admin`). Arreglado.

**QUÉ CORRÉS VOS** (al agente le bloquearon disparar `aplicar` contra la base real)
1. GitHub → Actions → **Base de datos** → Run workflow → `aplicar`. Termina con "Todo en verde".
2. Mismo botón → `sembrar-demo`, dominio `gym-os-pied.vercel.app` (gimnasio demo con 300 socios ficticios).
3. Opcional: `estado` para ver qué quedó.

**QUÉ CONFIGURÁS VOS**
- Vercel: `NEXT_PUBLIC_DOMINIO_BASE` y `NEXT_PUBLIC_DOMINIO_PLATAFORMA` sin `https://` ni barra (el super admin avisa si no).
- Para que el socio entre por celular en producción: un proveedor de SMS en Supabase → Authentication → Providers → Phone.

**SIN ARREGLAR**
- Suspender un gimnasio desde el super admin: la columna existe pero no corta nada. Qué debería bloquear (¿el panel?, ¿la puerta?) es una decisión de permisos y plata.
- Lo anotado el 02/11 sigue igual (permisos de la recepción para forzar entrada y anotar contactos, el profe sin buscar socios, presente sin anular, QR/kiosco, importador, MercadoPago).

**LO QUE NO PUDE VERIFICAR**
- `npm run db:types`: necesita `SUPABASE_PROJECT_ID` y el proyecto real; el código está escrito según la documentación, pero no está ejecutado.
- La migración 0019 en Supabase: pasó en la base local, no está aplicada en producción (paso 1 de arriba).
- Crear cuentas y cambiar contraseñas contra el GoTrue real de Supabase (`auth.admin.createUser` / `updateUserById`): probado con el imitador local; contra Supabase, el código está escrito según la documentación, pero no está ejecutado.
- El ingreso del socio por SMS en producción: no hay proveedor de SMS configurado.

---

## 2026-11-02 · S2–S10, S15 · Diseño oscuro y todos los paneles, probados con sesión real

**QUÉ HICE**
- **Diseño oscuro, modo gimnasio.**
  - Todo sale del fondo y del color principal de cada gimnasio (datos). Si el fondo es oscuro, los textos son claros y las superficies más claras; con un fondo claro, al revés.
  - Títulos en Archivo angosta y pesada, emojis en cada sección, colores de estado de los discos olímpicos.
  - Rehice la landing, la página de la plataforma y la de "no encontramos este gimnasio".
- **Login y panel.**
  - El middleware renueva la sesión y protege `/panel`, `/app` y `/admin`.
  - `/ingresar` tiene dos modos: equipo con mail y contraseña, socio con celular y código.
  - Barra lateral agrupada, con una línea que explica cada sección. Ctrl+K busca secciones y socios.
  - En el celular, cuatro principales abajo y el resto en el menú.
  - Inicio: saludo, accesos rápidos que cada persona elige, cuatro números según su rol, y "ahora y lo que sigue".
- **Pantallas.**
  - Entrada.
  - Socios: lista, alta, edición y ficha.
  - Vender, Caja (arqueo ciego) y Transferencias.
  - Vencen hoy y Retención.
  - Clases, con la grilla para armarlas.
  - Planes y precios, Equipo, Configuración y Mi cuenta.
  - App del socio y super admin de BRIK.
- **Base, 0012–0017.**
  - Colores oscuros por defecto.
  - Las funciones que leen los paneles.
  - Una caja por sede.
  - Precios del mostrador y vencen hoy.
  - Grilla de clases.
  - Cuentas del equipo.
  - App del socio.

  Todas validan rol y gimnasio, y fallan con un error, nunca con una lista vacía. 16 pruebas nuevas.
- **Para probar con sesión real, sin un Supabase:**
  - `scripts/local/supabase-local.mjs` imita las llamadas a funciones de PostgREST (el rol sale del JWT) y el login de GoTrue.
  - `levantar.sh` levanta todo; `usuarios-demo` crea los logins por la API de administración.
- **Probado con Playwright, logueado de verdad:**
  - recepción busca, ve el porqué y anota la entrada;
  - abre la caja con $5.000, cobra $22.000 en efectivo a un socio que no podía entrar (queda "Al día"), cierra contando $30.000 y ve "Sobran $3.000";
  - la dueña crea un plan;
  - la dueña suma a Lucas con contraseña provisoria; Lucas entra y la cambia;
  - la dueña apaga Caja y Lucas deja de verla, ni entrando por la dirección;
  - el admin crea "Olympo Gym" y la dueña nueva entra a su panel;
  - un socio entra con su celular y el código y reserva una clase;
  - la recepción entra a Retención y ve "no tenés acceso".
- **Verificado:**
  - `npm run verificar` con exit 0: 163 pruebas de base, 36 unitarias, chequeos, lint, tipos y build.
  - Base con 0001–0011 tal como se entregaron + 0012–0017 = 163/163.
- **GitHub Actions:**
  - "Base de datos" (prevuelo, aplicar, chequeos, hacer-admin), con el secreto `SUPABASE_DB_URL` y disparado a mano.
  - "Verificar" en cada push.
- **`docs/ARRANQUE.md`** rehecho: sin instalar nada en la compu.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- **Ningún gimnasio tenía caja.** No se podía abrir un turno ni cobrar en efectivo. 0014 crea una por sede (trigger) y completa las sedes que ya existen.
- **El login fallaba por dentro.** Redirigir desde la acción de login renderizaba `/panel` sin los encabezados del gimnasio. Ahora la acción devuelve a dónde ir y navega el navegador.
- **En producción, Next oculta el texto de los errores del servidor.** "No tenés acceso" se iba a ver como un error genérico. Cada pantalla corre en `intentar()` y muestra el mensaje de la base.
- **El resultado del arqueo desaparecía** al refrescar la pantalla, antes de que se viera. Ahora queda hasta tocar "Listo".
- **El socio leía "· avisale"** en su app: es la indicación para la recepción. `mi_socio` la saca, y el veredicto sigue siendo el de la puerta.
- **El profe veía "vencen hoy" y transferencias** en su inicio. Ahora ve sus clases, anotados y presentes.
- **La zona horaria estaba escrita a mano** en la app del socio. Ahora viene del gimnasio.

**QUÉ CORRÉS VOS**
- `docs/ARRANQUE.md`, pasos 1 a 4. Todo desde el navegador.

**QUÉ CONFIGURÁS VOS**
- GitHub: el secreto `SUPABASE_DB_URL`.
- Vercel: las cinco variables de `docs/ARRANQUE.md`.
- Supabase, para el ingreso de socios por celular: un proveedor de SMS (Twilio u otro) en Authentication → Providers → Phone.

**SIN ARREGLAR** (anotado; los tres primeros tocan permisos y no los cambié solo)
- **La recepción puede dejar pasar a cualquiera escribiendo un motivo, incluso a un suspendido.** ¿Debería poder forzar solo el dueño o el encargado, o nadie cuando hay suspensión?
- **La recepción no puede anotar "le escribí"** en Vencen hoy (`registrar_contacto` es solo de dueño y encargado). Le manda el WhatsApp pero no queda registrado.
- **El profe no puede buscar socios** para sumar a alguien que vino sin reservar (`buscar_socios` es del mostrador). En modo "sin reserva", su lista empieza vacía.
- No se puede anular un presente desde la pantalla: `lista_clase` no devuelve el id de la asistencia.
- Faltan:
  - QR del socio, kiosco y molinete;
  - PIN de recepción;
  - importador de socios;
  - editor de la landing y subida de logo y fotos;
  - MercadoPago;
  - rutinas;
  - avisos automáticos;
  - suscripción BRIK.
- Para "Sacar" un horario de la grilla, el confirm usa el diálogo del navegador. Funciona, pero no tiene el estilo.

**LO QUE NO PUDE VERIFICAR**
- Nada corrió contra un Supabase real. Login, sesión y funciones se probaron contra `supabase-local`, que imita PostgREST y GoTrue; el código está escrito según la documentación, pero no está ejecutado contra Supabase.
- Subir el comprobante desde la app y abrirlo con link firmado (Storage): el código está escrito según la documentación, pero no está ejecutado. La base local no tiene Storage.
- El SMS real del código: el código está escrito según la documentación, pero no está ejecutado. En local el código se lee de un archivo.
- Los workflows de GitHub Actions: el código está escrito según la documentación, pero no está ejecutado. Sí corrí localmente los mismos comandos que corren ellos (`aplicar`, `chequeos`, `hacer-admin`, build con las variables de ejemplo).
- El deploy en Vercel y `npm run db:types`: el código está escrito según la documentación, pero no está ejecutado.

---

## 2026-10-30 · S7 + S8 + S9 (base) · Caja, venta, retención y clases, con segunda revisión

**QUÉ HICE**
- **0009 caja y venta.**
  - Caja por turno: se abre con un monto y se cierra contando. Lo esperado se calcula y al cerrar queda la foto con la diferencia.
  - Carrito del mostrador: cuota, pase, pack, producto u otro. Acepta pagos mixtos que tienen que sumar exacto, y el precio siempre lo pone la base. La recepción tiene tope de descuento y el motivo es obligatorio.
  - Transferencia con comprobante: el socio la informa y el equipo la aprueba o la rechaza.
- **0010 retención.** Una sola consulta para todo el gimnasio.
  - Separa a los socios en vencido, por vencer, nuevo, no viene y se fue, con el porqué.
  - Muestra la frecuencia con que venía, la plata en riesgo, el mensaje armado desde plantillas editables y el último contacto.
- **0011 clases.**
  - Actividades y grilla semanal. Las clases se crean a demanda.
  - Reservas con cupo y lock, y lista de espera.
  - Presente con ventana horaria; se puede anular y devuelve la clase.
  - Packs que se descuentan por asistencia. Lista de la clase para el profe.
- **Segunda revisión independiente de 0009–0011.** Un agente que no había visto el código lo probó ejecutando y confirmó 21 errores. Los arreglé todos, cada uno con su prueba de regresión (`revision2.test.mjs`).
  - **Plata:**
    - se podía vender en efectivo en una caja que se estaba cerrando;
    - anular una venta de una caja ya cerrada le cambiaba el arqueo;
    - un turno de otra sede se aceptaba si no había efectivo;
    - la recepción podía reconstruir lo esperado con un SELECT, así que el arqueo no era ciego;
    - el mismo comprobante servía para dos pagos;
    - alguien del equipo podía aprobar su propio pago;
    - un 100% de descuento no se podía registrar;
    - el carrito aceptaba 50 cuotas.
  - **Retención:**
    - faltaban los que se anotaron y nunca pagaron, y los vencidos que cambiaron de plan;
    - un socio viejo que cambiaba de plan aparecía como "nuevo";
    - la deuda de los planes de varios meses no coincidía con la de la puerta;
    - sin precio cargado, el mensaje quedaba con un hueco.
  - **Clases:**
    - un pack se descontaba dos veces con dos presentes a la vez;
    - se descontaba aunque la membresía ya cubría la clase;
    - no respetaba sus actividades;
    - con 1 clase se reservaban varias;
    - cancelar una clase pasada devolvía clases de pack;
    - un cierre cargado después no cancelaba las clases ya creadas;
    - la lista de espera ascendía a socios suspendidos;
    - el presente no tenía ventana, ni chequeo, ni forma de anularse;
    - editar un horario duplicaba clases;
    - un login con varios socios veía la posición de otro;
    - la lista de la clase repetía gente;
    - una actividad no se podía quitar de un plan.
- **Carreras con dos conexiones reales** (`concurrencia-caja-clases.test.mjs`):
  - una venta en efectivo que llega mientras se cierra la caja espera y se rechaza, y no entra plata a un turno ya contado;
  - dos presentes a la vez con un pack de 1 clase dejan un solo consumo.
- **Verificado:** `npm run verificar` con exit 0. Incluye lint, tipos, 25 unitarias, **147 pruebas de base**, chequeos y build.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- **Había editado 0003 y 0007, que ya te había entregado en el zip.** Si las corriste en Supabase, esos cambios no te iban a llegar nunca: el aplicador saltea por nombre lo que ya registró. Además tocan permisos y plata. Lo resolví así:
  - Devolví 0003 y 0007 byte por byte a lo entregado y pasé los cambios a 0009.
  - Borro la firma vieja de `anular_venta`. Si convivían las dos, la llamada era ambigua.
  - 0009 verifica al final que no quedó la firma vieja ni la recepción leyendo pagos.
  - Probado: una base con 0001–0008 tal como se entregaron + las 0009–0011 nuevas queda con el mismo schema, políticas y permisos que una base desde cero, y las 147 pruebas pasan en las dos.
  - Lo agregué como regla 10 de migraciones en `CLAUDE.md`.
- **Retención con 3.000 socios.**
  - El commit anterior decía ~0,4 s, pero los arreglos (deuda igual a la de la puerta) la llevaron a 1,3 s.
  - La causa: Postgres copiaba `via_membresia` en cada `(vm).campo`, así que la llamaba varias veces por socio. Con la subconsulta materializada baja a **0,5 s**, con el mismo resultado byte por byte.
  - Con estadísticas viejas, recién cargados los datos, tardaba **11 s**. Supabase las actualiza solo, pero el importador de socios (S5) tiene que correr `analyze` al terminar. Anotado para S5.

**QUÉ CORRÉS VOS**
- Nada nuevo todavía. Cuando hagas `docs/ARRANQUE.md`, `npm run db:aplicar` aplica 0001–0011, o solo 0009–0011 si ya corriste el zip anterior.

**QUÉ CONFIGURÁS VOS**
- Nada nuevo.

**SIN ARREGLAR**
- Pantallas de caja, venta, retención y clases: esperan tus cambios de diseño.
- Los avisos (`avisos_pendientes`) quedan escritos pero nadie los manda todavía. Eso es S10/S14 (WhatsApp y push).

**LO QUE NO PUDE VERIFICAR**
- Bucket `comprobantes` y sus políticas de Storage: el código está escrito según la documentación, pero no está ejecutado. La base local no tiene el esquema `storage`.
- Nada de esto corrió contra un Supabase real, solo contra Postgres 16 con la simulación de roles y `auth.uid()`.
- `npm run db:types`: el código está escrito según la documentación, pero no está ejecutado.

---

## 2026-10-30 · S13 (primera parte) · Landing editable por gimnasio

**QUÉ HICE**
- **Migración 0008, landing.** La verifiqué aplicándola con pre-vuelo y con 8 pruebas. Tiene:
  - `landing_gimnasio`: portada, contacto y si muestra precios.
  - `landing_secciones`: 8 tipos (quiénes somos, actividades, planes, horarios, galería, profes, preguntas, ubicación), que se pueden ordenar, prender y apagar.
  - Validación del contenido de cada sección, con mensajes de error claros.
  - La función pública `landing_publica(host)`.
  - El bucket de Storage `marcas`, con políticas por carpeta del gimnasio.
  - Que cada gimnasio nuevo nazca con su landing armada.
- **Qué devuelve `landing_publica`:**
  - Sin publicar, solo la marca: la página dice "próximamente".
  - Publicada: los planes con su precio de lista vigente y las variantes más baratas ("$22.000 pagando en efectivo").
  - No devuelve nada de socios: una prueba lo comprueba buscando sus teléfonos y mails en la respuesta.
- **Permisos:** anon lee la landing solo a través de la función, nunca las tablas. Recepción no puede editarla; encargado y dueño sí.
- **Página en Next.**
  - Raíz por host: si es la plataforma muestra la página de Gym OS; si es un gimnasio, su landing.
  - Título, descripción y favicon por gimnasio.
  - Colores de la marca, con el color de texto del botón calculado por contraste.
  - Botón fijo de WhatsApp en el celular, con el mensaje armado. Cada plan tiene su "Lo quiero" con el nombre del plan.
  - Una sección vacía no se muestra.
  - Verificado levantando la app contra la base local y sacando capturas: Gimnasio Demo en celular y compu, Box Norte Demo con otra marca, y un gimnasio sin publicar.
- **Seed:** dos gimnasios demo con marcas distintas y landing completa. `--dominio` sirve para sembrarlos en el dominio real.
- **`docs/ARRANQUE.md`:** el paso a paso de GitHub, Supabase, Vercel y dominio.
- **Total verificado:** 88 pruebas de base, 25 unitarias, chequeos, lint, tipos y build en verde.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Las clases `.boton` y `.tarjeta` estaban fuera de una capa de CSS, así que le ganaban a las utilidades de Tailwind: `hidden` no ocultaba un botón en el celular. Las pasé a `@layer components`.
- Repetía el nombre del gimnasio dos veces arriba (en la barra y en una etiqueta). Saqué la etiqueta: lo vacío está vacío.
- `vitest` no resolvía el alias `@/`. Agregué `vitest.config.mts`.
- `npm run db:types` con `--db-url` necesita Docker. Ahora usa `--project-id` (`scripts/db/tipos.mjs`).

**QUÉ CORRÉS VOS**
- `docs/ARRANQUE.md`, pasos 1 a 4.

**QUÉ CONFIGURÁS VOS**
- Dominio, proyecto de Supabase, variables en Vercel. El detalle está en `docs/ARRANQUE.md`.

**SIN ARREGLAR**
- El editor de la landing en el panel. Necesita el login del equipo (S2): por ahora se edita con SQL o con el seed.
- Las fotos todavía no se suben desde la app. El bucket y sus políticas están, falta la pantalla.

**LO QUE NO PUDE VERIFICAR**
- El bucket `marcas` y sus políticas de Storage: el código está escrito según la documentación, pero no está ejecutado. La base local no tiene el esquema `storage`.
- La landing contra el Supabase real: se probó con un imitador local de su RPC.
- `npm run db:types` con `--project-id`: el código está escrito según la documentación, pero no está ejecutado.

---

## 2026-10-29 · S1 + base de S7 · Núcleo de acceso y cobro, en Postgres real

**QUÉ HICE**
- **Siete migraciones** (0001–0007). El detalle de qué tiene cada una está
  en `docs/SCHEMA.md` § Estado. Verificado así:
  - aplicadas con pre-vuelo contra Postgres 16;
  - re-ejecutadas enteras en una transacción para probar que son idempotentes;
  - `npm run chequeos` en verde.
- **Cálculo de acceso** (`privado.calcular_acceso`): una función por vía y
  una combinación en orden fijo.
  - **21 casos testigo**, un socio por cada respuesta posible. Son la misma
    fuente para el seed y para las pruebas.
  - Verificado con 80 pruebas de base.
  - Las pruebas detectan errores: con una expectativa cambiada a propósito, fallan.
- **Cobro de cuotas**:
  - precio por lista;
  - períodos con ancla en los tres modos de renovación;
  - `cobrar_cuota`, `anular_venta`, `cambiar_plan`, `dar_de_baja`.
  - Verificado con pruebas de cada modo y de los bordes de mes.
- **Compensación de días** por congelamiento y cierre, recalculada por
  trigger. Verificada con pruebas de orden (pagar antes o después de
  congelar), de superposición con un cierre y de anulación.
- **Concurrencia**: dos lecturas de QR casi simultáneas descuentan una sola
  clase. Verificado con dos conexiones reales, con y sin cobro del reingreso.
- **`npm run chequeos`**:
  - revisa contra la base: RLS, `gimnasio_id`, FK compuestas, timestamptz,
    numeric(12,2), `search_path`, lista blanca de EXECUTE, unique por
    gimnasio, sin TRUNCATE para clientes;
  - revisa en los archivos: sin TODO ni BEGIN en las migraciones, sin
    teléfonos con pinta de reales.
  - Verificado con una tabla y una función mal hechas a propósito: las detecta.
- **Gimnasio demo determinístico**:
  - 300 socios más los 21 testigos;
  - cuotas con su venta y su pago;
  - 90 días de ingresos en horarios pico;
  - teléfonos +549000…
  - Se siembra en ~4 s.
- **Rendimiento**, medido con 3.000 socios y 80.000 ingresos:
  - ingreso: ~9 ms;
  - búsqueda: <2 ms, usa el índice;
  - cierre de todo el gimnasio: ~0,5 s (era 21 s; se corrigió un filtro que no usaba el índice);
  - estado de los 3.000 juntos: ~2,6 s.
- **App**:
  - Next 15, middleware host → gimnasio, `/gimnasio-no-encontrado`.
  - Clientes de Supabase con `@supabase/ssr`.
  - `formatearPesos` y fechas en la zona del gimnasio, con 19 pruebas unitarias.
  - Probado levantando la app contra un PostgREST mínimo local:
    - plataforma → 200;
    - gimnasio → 200;
    - host desconocido → 404 con la dirección escrita;
    - header falso → descartado;
    - Supabase caído → 503 que lo dice.
- `npm run build` pasa.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Una **revisión independiente** encontró 17 errores confirmados
  ejecutando. Están todos corregidos, cada uno con su prueba de
  regresión en `supabase/pruebas/revision.test.mjs`. Los más graves:
  - pagar durante un congelamiento hacía perder casi todo el mes;
  - un congelamiento cargado antes de pagar no compensaba nunca;
  - la recepción podía congelar hacia atrás y regalar días;
  - el modo aviso dejaba pasar a un suspendido;
  - un socio dado de baja entraba en verde;
  - la recepción podía cambiar de plan con un UPDATE directo;
  - el día 31 se perdía al renovar;
  - en día fijo, la deuda mostrada era el doble de lo que se cobraba;
  - en efectivo se podía pagar más caro que con crédito;
  - el equipo podía leer el hash del PIN del dueño;
  - anon tenía TRUNCATE.
- **Las migraciones se reescribieron en el lugar**, no con parches,
  porque ninguna estaba aplicada en una base real. Desde el primer
  gimnasio real, eso ya no se puede.
- **Next quedó en 15.5**, no en 16 (que es la última): 16 renombra el
  middleware y no lo pude verificar acá. Actualizar es una decisión
  aparte.
- **`next/font/google` se sacó**: el build baja las fuentes de internet y
  falla sin red. Se usa la fuente del sistema.
- **El teléfono del socio no puede ser único**: las familias comparten número.
- **La investigación cambió prioridades**:
  - factura ARCA por cada cuota;
  - Wellhub ya está en Salta;
  - el refresh token de MercadoPago vence a los 6 meses;
  - el apto físico en Salta tiene una ordenanza de 2019 que no se encontró.
  - Todo está en `docs/requisitos.md` y en el doc del catálogo.

**QUÉ CORRÉS VOS**
```
git clone gym-os.bundle gym-os && cd gym-os && npm install
gh repo create gym-os --private --source=. --push
git log origin/main --oneline -3
```

**QUÉ CONFIGURÁS VOS**
- Comprar el dominio y crear el proyecto de Supabase (São Paulo).
- `.env.local` según `.env.local.example`. Después, `npm run db:prevuelo`
  y `npm run db:aplicar`.
- Copiar `2-LECCIONES.md` y `3-CONVENCIONES.md` a `docs/`.

**SIN ARREGLAR**
- **Listas de retención en lote**: `calcular_acceso` socio por socio tarda
  ~2,6 s con 3.000 socios. Alcanza para el barrio (79 ms con 300), no para una cadena.
- **Prorrateo al cambiar de plan**: la diferencia de precio no se cobra ni
  se devuelve. Es v1.5.
- **Cierres de una sola sede**: no compensan. El check lo impide, porque
  falta decidir qué planes alcanzan.
- **`descongelar`**: solo termina hoy. Una vuelta con fecha pasada la carga el dueño anulando y recreando.
- **Clases y reservas**: no están en el schema ni en el seed.

**LO QUE NO PUDE VERIFICAR**
- **Nada se aplicó en un Supabase real.** La base local simula los roles,
  `auth.uid()` y los permisos por defecto de Supabase. Supabase usa
  Postgres 15 o 17 y acá corrió 16.
- **`npm run db:types`**: está escrito según la documentación, pero no está
  ejecutado. La CLI de Supabase con `--db-url` necesita Docker.
- **El middleware contra el PostgREST real de Supabase**: el código está
  escrito según la documentación, pero no está ejecutado. Se probó con un
  imitador local.
- **Los permisos de `.claude/settings*.json` en una sesión real de Claude
  Code**: el código está escrito según la documentación, pero no está
  ejecutado.

---

## 2026-10-26 · S−1 · Archivos del repo y schema propuesto

**QUÉ HICE**
- `CLAUDE.md` con reglas, migraciones, definición de TERMINADO y
  reporte.
- `docs/SCHEMA.md`: schema completo propuesto, modelo de las tres vías
  de acceso, RLS, índices y preguntas abiertas.
- `docs/PLAN.md` como marcador: `7-PLAN.md` no estaba adjunto.
- `docs/requisitos.md`, `.env.local.example`, `.vercelignore`.
- `.claude/settings.json` (hook compartido + denegaciones),
  `.claude/settings.local.json` (permisos de este equipo),
  `.claude/hooks/bloquear-peligroso.mjs`.
- Hook verificado ejecutándolo: 28 comandos simulados contra un repo
  git de prueba (con remoto), 28 con el resultado esperado. Incluye
  `vercel --prod` limpio y pusheado (pasa), sucio (bloquea), con commit
  sin pushear (bloquea), y aplicar migraciones con y sin
  `.claude/BASE_CON_DATOS_REALES`.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Los cinco documentos del proyecto no estaban adjuntos. Solo
  `B-ARCHIVOS-A-ADJUNTAR.md`.
- `LECCIONES` y `CONVENCIONES` solo viven en el proyecto de claude.ai:
  el agente que codea en el repo no los ve. Tienen que copiarse a
  `docs/LECCIONES.md` y `docs/CONVENCIONES.md`.
- `.claude/settings.local.json` es personal y queda fuera de git. Un
  hook de seguridad ahí no viaja con el repo. Se puso en
  `.claude/settings.json`.
- `create-next-app` se niega a correr en una carpeta con archivos que
  puedan chocar: primero se crea el proyecto, después se copian estos
  archivos.

**SIN ARREGLAR**
- `docs/PLAN.md` vacío hasta tener `7-PLAN.md`.
- `npm run chequeos`, `db:types`, `typecheck` todavía no existen: son
  parte de la primera sección de código.

**LO QUE NO PUDE VERIFICAR**
- El schema es una propuesta: no hay ninguna migración escrita ni
  aplicada.
- La sintaxis de permisos de `.claude/settings*.json` está escrita
  según la documentación de Claude Code, pero no está ejecutada dentro
  de una sesión real de Claude Code.
