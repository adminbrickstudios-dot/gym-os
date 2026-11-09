# Preguntas para Mateo

El agente no frena por una pregunta: aplica la opción recomendada, la marca
**decidido por defecto** y sigue. Mateo contesta cuando puede; si elige otra
opción, se cambia en la vuelta siguiente.

Formato de cada pregunta nueva:

```
## P-<n> · <tema> (<fecha>)
<la pregunta, en una línea>
- A) … (recomendada: por qué)
- B) …
Decidido por defecto: A. Dónde se nota: <pantalla o ítem>.
Respuesta de Mateo: (vacío)
```

---

## Contestadas por Mateo (07/11)

| # | Pregunta | Respuesta |
|---|---|---|
| D36 | ¿Guardar la vigencia en el socio? | Guardar `cubierto_hasta` por trigger; el color se calcula comparando con hoy. |
| D37 | ¿Fondo claro u oscuro? | Claro por defecto, oscuro elegible. |
| D38 | ¿Emojis? | Íconos de línea propios. |
| D39 | ¿Se llama Base? | Sí. |

## Decididas por defecto (07/11, al armar `docs/base/`)

| # | Pregunta | Por defecto | Por qué |
|---|---|---|---|
| D40 | El pedido pide aviso en la esquina + panel lateral; hoy está la ventana grande del veredicto (VD-1). | Aviso + panel en la recepción; la ventana grande queda como opción en Configuración. | Con 10 personas en la fila, un aviso que no tapa deja seguir tipeando; la ventana grande sirve para una tablet en la puerta. |
| D41 | ¿Pantallas nuevas en `/dueno`, `/recepcion`…? | Puertas fijas que llevan a lo que ya existe. | Duplicar pantallas duplica errores. |
| D42 | ¿Quién pone la contraseña del dueño y del equipo? | Quien crea la cuenta elige: la escribe o manda un link. | Mañana Mateo necesita darle la clave al dueño en el momento; el link sirve cuando haya SMTP. |
| D43 | ¿Cómo se entra? | Mail y contraseña adelante; Google y código abajo si están configurados. | Es lo que todos entienden y no depende de cuentas externas. |
| D44 | ¿Asistente nuevo o el de Primeros pasos? | El de Primeros pasos, con los 9 pasos del pedido. | Ya calcula qué está hecho (VD-43). |
| D45 | ¿Con cuántos datos se mide? | 5.000 socios, 100.000 ingresos. | Lo pide el pedido; hoy se midió con 3.000. |
| D46 | ¿`negocio_id` o `gimnasio_id`? | `gimnasio_id`. | Renombrar 215 migraciones no suma nada. |
| D47 | ¿Y si no se puede leer el repo de Sillón? | Se sigue la barra de yadeportes. | No frena nada. |
| D48 | ¿Dónde quedan los accesos? | `ACCESOS.md` local, en `.gitignore`. | El repo es público. |
| D49 | ¿Anti-robot sin cuenta externa? | Turnstile si está la variable, más campo trampa y tope por IP siempre. | Anda desde mañana sin configurar nada. |
| D50 | ¿Sonido? | Prendido, distinto para el rojo, se apaga desde la recepción. | En el mostrador no siempre se mira la pantalla. |
| D51 | ¿Planes pagos? | El agente escribe qué hace falta; no contrata. | Gastar plata es de Mateo. |
| D52 | ¿Ley 25.326? | Política, consentimiento y pedido de datos del socio; la inscripción en la AAIP la hace el gimnasio. | Es obligación del responsable de la base, que es el gimnasio. |

## Decididas por defecto en la revisión del 09/11

| # | Pregunta | Por defecto | Por qué |
|---|---|---|---|
| D53 | El segundo factor estaba pedido en cuatro lugares (VD-33D, VD-42B, VD-42C, SA-10) | Uno solo: SA-10. Obligatorio para el super admin; para el dueño, recomendado y que él lo prenda. | Un dueño que pierde el celular no puede quedar afuera de su gimnasio el primer día. |
| D54 | VD-40B repetía el super admin nuevo | Pasa a los SA-* de `SUPER-ADMIN.md`. | Una sola lista. |
| D55 | La demo que "se borra sola a los 7 días" chocaba con "nada depende de un cron" y con ADM-5 | La demo es un gimnasio `[demo]` aparte. A los 7 días queda vencida (se calcula) y se borra entera con un botón. | Borrar un gimnasio sin datos reales no rompe ninguna regla, y destraba ADM-5. |
| D56 | Los avisos de abajo a la derecha tapaban el botón de Entrada | Se apilan arriba del botón, o a la izquierda de la barra fija. | Nada tapa nada. |
| D57 | ¿El socio sube su foto desde la app? | Solo si el gimnasio lo prende (apagado por defecto). La recepción ve "foto nueva" hasta confirmarla. | Es la foto con la que lo reconocen en la puerta (anti-préstamo). |
| D58 | ¿Qué es lo principal del Inicio? | Recepción: el mostrador (búsqueda, números, lista en vivo). Dueño: números y Para hacer hoy. | Cada uno hace otra cosa en su primer minuto. |
| D59 | Reseñas en la página y "+N socios" contra "nada inventado" | Reseñas solo con nombre, fecha y link a la reseña de Google; sin link no se muestran. "+N socios" sale de la base y solo aparece con 20 o más. | Así nada de la página puede ser inventado. |
| D60 | Términos BRIK–gimnasio y contrato de encargado del tratamiento | El agente escribe un borrador, marcado "revisar con un abogado"; el dueño lo acepta al entrar y queda la fecha y la versión. | Sin texto no hay qué aceptar; la revisión legal es de Mateo. |

---

## Abiertas

### BASE-0 · vd-7 y vd-8 (averiguados el 08/11, base nueva y app compilada con Next 16.4.5)

- **vd-8 (PIN equivocado): no era un fallo de permisos.** El PIN equivocado no deja pasar y sí avisa
  ("PIN equivocado: te quedan N intentos"). La prueba miraba el primer `role="alert"` de la página, que es el
  anunciador de rutas de Next (vacío). Se corrigió la prueba: pasa 15 de 15. **Nada que decidir.**
- **vd-7 (simulación vs. hoja Cobrar): no hay diferencia de plata.** La simulación mostraba "Paga la cuota entera" porque
  la prueba la corría ANTES de pasar los planes a la regla del gimnasio, y `simular_cuota` usa la regla de ese plan
  (que era "continua"): correcto. Además la prueba pedía fechas de dos dígitos ("8/11"). Se reordenó la prueba y se acepta
  una cifra. **Nada que decidir**; la cuenta de la base no se tocó.
- Decidido por defecto: lo que dice la hoja Cobrar y lo que dice la simulación vienen de la misma regla; no se cambió ninguna función.
- vd-41: la sección Gastos, apagada para el encargado sin permiso, decía "sección apagada por el gimnasio". Ahora dice
  "No tenés permiso para ver los gastos" (solo cambia el texto, quién ve qué no cambió).

- (09/11, decidido por defecto) **Medición en producción sin usuarios demo:** se escribió igual el script y el workflow, y se mide desde afuera lo público; las pantallas con sesión quedan ⛔ hasta que Mateo cargue los tres secretos. Recomendada: cargarlos y correr `usuarios-demo`.
- (09/11, decidido por defecto) **F0.2:** primero se paralelizaron los viajes (ganancia inmediata, sin migración); `contexto_pantalla` en una sola función queda para después de medir.
### Carril B · Super admin (09/11, ayudante 1)

- **SA-4 plata como soporte: NO está aplicada.** Pide que, entrando como soporte, cobrar/anular/tocar la caja no se
  permita salvo "lo pidió el dueño" en el motivo. Eso cambia quién puede cobrar en `vender`, `anular_*` y la caja
  (permisos y plata), así que no lo toqué. Hoy el soporte entra con el rol elegido (dueño, recepción o profe) y puede
  lo que ese rol. Recomendado: una sola función `privado.exigir_equipo` que mire `soportes_gimnasio` y rechace
  esas acciones si el motivo no dice "lo pidió el dueño". Lo hace el principal.
- **SA-5 buscar a cualquiera:** devuelve nombre, gimnasio y rol (nunca DNI, mail ni teléfono), pide motivo y deja
  registro en `registro_brik` con lo buscado y cuántos encontró, no con el resultado. Busca socios por mail exacto,
  DNI exacto o teléfono (últimos dígitos) y al equipo por mail exacto. Decidido: coincidencia exacta, para que nadie
  explore la base de a letras.
- **Registro de BRIK (`registro_brik`):** tabla nueva sin `gimnasio_id` obligatorio (la búsqueda no tiene gimnasio).
  La sumé a la lista de excepciones de `scripts/chequeos.mjs` (junto con `favoritos_brik`): el principal debe confirmarlo.
- **Bug de base encontrado:** `privado.hecho_inmutable()` sin argumentos NO frena los UPDATE (con la lista de columnas
  permitidas vacía, la comparación da NULL). Por eso `registro_brik` lo usa con un argumento que no es columna. Otras
  tablas que lo usen sin argumentos podrían dejarse editar: conviene revisarlo (permisos, no lo arreglé).
- **Ciudad del gimnasio:** no existe la columna, así que la lista no filtra ni muestra ciudad. Recomendado: agregarla a
  `configuracion_gimnasio` cuando el dueño la cargue en el asistente.
- **Errores de las últimas 24 h (tablero y ficha):** no hay tabla de errores de la app, solo `ultimo_error` en las ayudas.
  Quedó sin hacer hasta decidir dónde se guardan (recomendado: `errores_app` alimentada desde `error.tsx`).
- **Reprocesar webhook:** la ficha lista los fallidos pero no los reprocesa: eso toca la ruta del webhook de MercadoPago
  (plata). Recomendado: función que vuelva a correr el mismo handler idempotente por `id_externo`.
- **Cambiar quién es el dueño:** el anterior queda como encargado (no pierde el acceso). Decidido por defecto.

#### Carril B, segunda tanda (migración 20261109020200)

- **Roles de BRIK (SA-10): aplicados solo a lo nuevo.** `privado.exigir_brik(roles)` manda en entrar como soporte, buscar,
  lista, tablero, pausa, baja, demos, exportar, borrar y registro. Las 31 funciones `admin_*` viejas (abono, novedades, alta,
  equipo, claves, dominios) siguen aceptando a cualquier admin: un "solo lectura" todavía podría llamarlas. Recomendado:
  que el principal les ponga `exigir_brik` una por una (es permisos, no lo toqué). Todos los admins existentes quedan `principal`.
- **Segundo factor (SA-10):** `privado.soy_admin_plataforma()` ahora exige `aal2` cuando `plataforma_ajustes.exigir_2fa` es
  true. Por defecto está apagado (nada cambia hoy). Mateo lo prende desde `/admin/seguridad` después de activar y confirmar
  su código; la base no deja prenderlo si quien lo prende no confirmó. Cambia una función central de permisos: revisar.
  No hice "aviso por equipo o lugar nuevo" ni "cerrar todas las sesiones de un gimnasio" (necesita la API de admin de Supabase).
- **Pausa:** pausar = `suspension_manual_*` y `privado.solo_lectura` devuelve true (panel en solo lectura; puerta y app siguen).
  El mensaje del trigger sigue hablando del abono vencido: cambiar el texto toca `frenar_si_solo_lectura` (otro carril/permisos).
  "Muestra: pausado, hablá con BRIK" en la pantalla no está: lo mostraría el layout del panel (carril A).
- **Baja:** deja el gimnasio pausado y "para borrar" 30 días, restaurable, con exportación primero (zip de CSV en
  `/admin/[id]/exportar`). **El borrado definitivo NO está hecho**: los hechos (pagos, ingresos) no se pueden borrar por
  diseño y falta un procedimiento revisado. Decidir si "borrar" es anonimizar todo (como con un socio) o un purge manual.
- **Papelera (socio, plan o clase quitados por error):** sin hacer.
- **Clonar la configuración de otro gimnasio:** sin hacer (los planes tienen historial de precios: hay que decidir qué se copia).
- **Demo para reunión:** crea el gimnasio `[demo]` con la plantilla elegida y vence a los 7 días (se calcula); no carga socios
  ficticios (los pone `scripts/` del seed, fuera de la base). "Deja de abrirse" al vencer: no está aplicado (tocaría `gimnasio_por_slug`
  y el proxy, carril A); hoy aparece como "demo vencida" y "Borrar demos vencidas" la pone en baja.
- **Errores (SA-9):** tabla `errores_app` y `registrar_error_app(gimnasio, pantalla, mensaje)`. **Falta llamarla** desde las
  pantallas `error.tsx` de los paneles (`src/app/panel/error.tsx`, carril D/A) y de `/app`. Hasta entonces el tablero muestra 0 errores.
- **Campana del dueño:** "BRIK entró a ayudarte (como X)" + motivo, por 7 días. Envuelvo `privado.avisos_moderacion` (el
  original queda como `avisos_moderacion_base`). Si otro carril redefine `avisos_moderacion`, pierde el aviso: usar la base.
- **Marco de color de soporte:** ya existía (`BannerSoporte` en `src/app/panel/layout.tsx`, carril A). No dice con qué rol entró:
  pedirle al principal que lo muestre con `estado_soporte`.
- **Datos personales (SA-11):** borrar a un socio deja el nombre en "Socio borrado" y borra DNI, mail, teléfono, foto, emergencia
  y notas; pagos y coberturas quedan. Convive con los pedidos de datos del socio (carril D), que resuelve el dueño.
  Estado de las copias de seguridad (D51): depende del plan de Supabase, sin hacer.
#### Carril B, tercera tanda (migración 20261109020300)

- **Borrado definitivo = anonimizar (decidido por defecto, opción recomendada).** `admin_borrar_definitivo(gimnasio, nombre)`:
  solo el principal, con la baja de más de 30 días y escribiendo el nombre exacto. Borra los datos personales de los socios
  (nombre, DNI, mail, teléfono, foto, notas), desactiva al equipo y le saca la cuenta, borra las direcciones y despublica la
  página; el gimnasio queda "Gimnasio borrado" (`borrado_en`). Pagos, ventas e ingresos se quedan (plata y hechos no se borran).
  No toca `auth.users` (una cuenta puede estar en otros gimnasios). Si Mateo prefiere un purge físico, es otra migración revisada.
- **Reprocesar webhook: a pedido, idempotente, sin tocar la ruta.** `admin_evento_webhook` (principal y soporte) lee el evento
  fallido y deja registro; la acción del servidor `reprocesarWebhook` lee el pago de la API de MercadoPago con el token del
  gimnasio y llama a `procesarPagoMP` (el mismo camino del webhook, idempotente por pago y estado), y recién ahí cierra el
  evento. Un pago ya acreditado no se duplica. **Sin probar contra MercadoPago real** (la lógica de `procesarPagoMP` ya tiene sus pruebas).
- **SA-8:** novedades por plan, ciudad y módulo (`para_*`), "le llega a N" y "la cerraron N". "Cuántos la vieron" = cuántos la
  cerraron: no hay marca de "vista" (habría que registrarla desde el panel del dueño, carril A/D). "Qué hay de nuevo" del dueño:
  `novedades_historial(gimnasio)` existe; **falta la pantalla** en el panel del dueño. Mantenimiento: `mantenimiento_vigente()`
  (pública) devuelve el aviso de las próximas 48 h; **falta pintar la franja** en los layouts de los paneles (carril A).
- **SA-7:** prueba gratis por gimnasio (`prueba_dias`, 14 por defecto: igual que antes), descuento con motivo y fecha de fin
  (`precio_con_descuento` sale en `estado_abono`), recordatorio por wa.me con monto y link de pago (el link lo carga Mateo en `/admin`).
  Se redefinió `privado.estado_abono` desde su única definición (0110); agrega claves, no cambia las que había.
  **El descuento solo se muestra: no cambia lo que el gimnasio paga ni cobra nada** (BRIK cobra a mano). Confirmar que es lo que se quiere.
  ARCA/factura electrónica sigue en 🔌.
- **SA-9:** estado (migraciones, tamaño de la base, commit y región de Vercel), uso por gimnasio (socios, fotos, entradas 30 días,
  sedes; los límites del plan no existen como datos, así que no hay "se acerca al límite") y funciones a prueba
  (`funcion_prendida(gimnasio, clave)`; nadie la consulta todavía: la usa quien construya la función nueva).
- **Papelera:** socios dados de baja en 30 días y planes archivados, con restaurar. Las clases archivadas no se incluyeron
  (necesitan decidir qué es "archivar" una clase).
- **Clonar configuración:** copia planes activos con su precio de hoy, actividades, modo de clases, qué cobra y módulos apagados, a un
  gimnasio sin planes. No copia horarios, reglas finas ni la página.
- **Carga de socios con Excel:** ya existe en el panel del dueño (`/socios/importar`); BRIK la usa entrando como soporte. No se
  duplicó dentro de `/admin`. Los botones "Abrir como soporte en esta pantalla" de la ficha quedan sin hacer.
- **Parches de otras migraciones:** antes de redefinir `estado_abono`, `novedades_dueno`, `admin_novedades` y
  `admin_publicar_novedad` verifiqué que ninguna otra migración las vuelve a definir. `privado.avisos_moderacion` y
  `privado.soy_admin_plataforma` ya estaban envueltas/redefinidas en la tanda anterior.
- **Sin hacer de la lista:** nada de los 5 puntos quedó sin tocar; lo parcial está arriba.
### Carril C · Socio, página e ingreso (ayudante 2, 09/11) — opción recomendada ya aplicada, avisame si no
- **"Ese mail no tiene cuenta en Gimnasio X" contra VD-33 ("el mismo mensaje exista o no la cuenta").** El pedido (F1.2) manda el error con nombre. Se aplicó **solo desde la dirección de un gimnasio, solo después de una contraseña mala y con el tope de BASE-8 ya aplicado** (8 fallos por mail y 20 por conexión cada 15 min); si el mail tiene ficha de socio o usuario del equipo ahí, el texto sigue siendo "El mail o la contraseña no son correctos". Costo: alguien puede averiguar si un mail es socio de un gimnasio (hasta 8 veces por mail cada 15 min). Si preferís el mensaje único, es borrar la llamada a `mail_para_ingresar` en `src/app/ingresar/acciones.ts`. **`scripts/e2e/vd-33.mjs` línea 58 compara con cuenta y sin cuenta y va a fallar: hay que cambiarla** (es del carril A).
- **Mail y contraseña adelante para el socio (D43).** Cambia lo que se ve primero en `/ingresar?modo=socio`: ya no es el campo de celular. **Todas las pruebas e2e que entran con `entrarSocio` (`scripts/e2e/comun.mjs`) dejan de andar** hasta que `entrarSocio` haga clic en el botón "Celular" antes de llenar `input[name=telefono]` (una línea, del carril A).
- **FA-16, foto que sube el socio:** se guarda en el mismo bucket privado y queda marcada "sin confirmar" (`socios.foto_sin_confirmar_desde`) hasta que la recepción la confirma (`confirmar_foto_subida`) o pone otra. Mientras tanto la Entrada la usa igual (con la marca); si querés que no se use hasta confirmarla, es un cambio de `foto_socio`. Falta la tarjeta "foto nueva, subida por el socio" en la ficha y el interruptor en Configuración (son de `src/app/panel/`, carril D): las funciones ya están (`foto_estado_socio`, `confirmar_foto_subida`, `guardar_foto_socio_permitida`).
- **FA-14, la regla de la recomendación:** "si hace 7 días o más que no entra, lo dice con los días y, si hay clases, suma la próxima de hoy". Una sola regla, sin reglas ocultas. Los 7 días son una constante de la función `resumen_app_socio`.
- **Lighthouse (F1.8):** no se midió (no se levanta la app en este carril). Medirlo con la app compilada: `npx lighthouse http://demo.localhost:3123 --form-factor=mobile --only-categories=performance,seo,accessibility`.
### Carril D (ayudante 3, 09/11) · F1.7, F1.5, F1.4 — decisiones tomadas por defecto

- **Prueba de permisos por rol (`permisos-por-rol.test.mjs`).** Llama cada función de `PERMISOS.md` como dueño, encargado, recepción, profe, dueño de otro gimnasio, socio sin cargo y anónimo. **No encontró ninguna contradicción** (2.093 llamadas, 2.082 concluyentes; las 11 restantes fallan antes de llegar a la regla por un dato inexistente y no prueban nada). Una función con ramas por un booleano (ej. `marcar_no_escribirle`: marcar lo hace la recepción, sacar la marca solo dueño y encargado) se prueba con el booleano en las dos posiciones. Recomendado: dejarla en `db:pruebas` (tarda ~45 s).
- **Anti-robot de "Quiero ser socio" (D49).** El campo trampa `sitio` ya existía en `hacete-socio/acciones.ts`. Se suma el tope en la base: `registrar_envio_publico(formulario, ip, clave)` (10 por hora por conexión, 3 por hora por persona, hash). El helper `src/lib/seguridad/envio-publico.ts` hace las dos cosas. **Falta engancharlo en `src/app/hacete-socio/acciones.ts` (carril C): una línea antes del `rpc("alta_online")`.** Recomendado: `const f = await frenarEnvioPublico(form, "alta_online", datos.dni); if (f.robot) return { listo: true, nombre: datos.nombre }; if (f.error) return { error: f.error, datos };`. El "Olvidé mi contraseña" ya tenía tope por mail y por conexión (`pedirRecuperacion` → `limiteCodigos`, SEG-1).
- **Ley 25.326 (D52).** Migración `20261109040100`: política de privacidad del gimnasio (texto del dueño, pública por `politica_privacidad_publica(host)`; sin texto se muestra un modelo), consentimiento anotado en `socios.consentimiento_datos_en` cuando el socio acepta el reglamento (trigger), y pedidos de ver/corregir/borrar (`pedir_mis_datos` para el socio, `pedidos_datos_panel` y `resolver_pedido_datos` para dueño y encargado). Pantalla del panel: `/panel/datos-personales`. **Falta, en otros carriles:** (C) mostrar la política en `/privacidad` de la página del gimnasio y un link en "Quiero ser socio"; (C) un botón "Pedir mis datos" en la app del socio que llame `pedir_mis_datos`; (A) un link en el menú. "Borrar" no borra a mano ni en automático: los pagos y las entradas se guardan por obligación contable; el dueño anonimiza la ficha y anota qué hizo. Recomendado así hasta que Mateo hable con su abogado. El texto modelo está marcado "revisar con un abogado".
- **Contraseñas demo.** `usuarios-demo.mjs` se niega a correr contra un Supabase que no sea local con `demo-gymos` (o cualquier contraseña de menos de 10 letras o repetida). El workflow ya exigía 10 o más letras.
- **Asistente, paso 6 y 7 (BASE-7).** Se miden en `public.pasos_asistente` (función aparte: `privado.primeros_pasos`, que usa el widget de Inicio, no se tocó). Paso 6 = el dueño cambió una regla de entrada (queda en el historial) o hay una tablet autorizada. Paso 7 = si no hay clases, "no aplica" y cuenta como hecho; con clases, un horario vigente y un profe activo. **Decisión a confirmar:** un gimnasio nuevo arranca con el paso 7 hecho por no dar clases (así "Seguir donde quedé" lo salta solo). Alternativa: pedir una confirmación explícita, pero eso sería guardar "paso hecho".
- **Vista previa del logo.** Elegir un archivo ahora lo muestra y pide "Usar este logo" antes de subirlo. **Esto cambia el flujo de `scripts/e2e/cfg-2.mjs`**: después de cada `setInputFiles` de logo/ícono hay que hacer click en "Usar este logo" / "Usar este ícono" antes de esperar "Logo listo". Lo arregla el principal (carril A es dueño de `scripts/e2e/`).
- **Tema por usuario (BASE-6).** Se guarda en `equipo.preferencias.tema` (`guardar_tema_usuario`, `mi_tema`) y en la cookie `tema` (`claro` | `oscuro`; sin cookie = el del gimnasio). Mi cuenta ya tiene el selector. **Falta del principal:** que el layout lea la cookie y pinte `data-tono` con ese valor en vez del que calcula `propsMarca` (y que `globals.css` tenga los tokens de los dos tonos completos).
- **Chequeo de diseño.** `scripts/diseno-chequeo.mjs` (dentro de `npm run chequeos`): falla si un archivo suma un color hex suelto o un emoji más que su número guardado en `scripts/diseno-base.json`. Hoy quedan 32 colores y ~1.670 emojis por convertir al componente `Icono`; **el chequeo no queda en cero hasta que el principal cree `Icono` y se conviertan** (`node scripts/chequeos.mjs --actualizar-diseno` baja los números a medida que se convierte).
- (09/11, decidido por defecto) Se subió la base de `diseno-base.json` para los emojis y colores que sumaron los carriles B y C: bajan a cero cuando exista `Icono` (F1.4).
