# Estado: zona dueño y super admin (revisión de todo lo viejo, 11/11)

> **12/11:** las tres listas vigentes (publicado, sin publicar, falta) están en `docs/base/ESTADO-GENERAL.md`; este archivo es el detalle de la revisión del 11/11 y, donde difiera, manda `ESTADO-GENERAL.md` (se escribió antes del PR #16 y de los cierres de F4, F5 y Z).

Rama `carril/rev-dueno`, salida de `base/2026-11-07`. Se revisó función por función contra `PEDIDO-ORIGINAL.md`, `AJUSTES-0911-NOCHE.md`, `docs/v2/` (03, 06, 10), `DETALLES-70.md`, `FALTANTES.md`, `SUPER-ADMIN.md`, `PLATAFORMA.md`, `PULIDO.md`, `FLUIDEZ.md` y `DISENO.md`. Todo lo probado ejecutando fue en el gimnasio demo; nunca en Temple Gym.

Cómo leer las tablas:
- **Hecho y publicado**: está en `base/2026-11-07` con recorrido e2e que lo cubre. "Publicado" quiere decir "en la base de integración con su prueba"; llega a producción con el PR de Mateo después de aplicar las migraciones.
- **Hecho sin publicar**: está en esta rama (`carril/rev-dueno`) y falta mergearlo. Ninguno necesita migración.
- **Falta**: no existe o está a medias. Lo grande se anota acá y no se tocó.

Qué revisé de las 21 reglas de `FLUIDEZ.md` y de `DISENO.md`: lo de código (íconos dentro de `option`, campos que se vacían, estados vacíos sin botón) lo arreglé. Lo que pide abrir cada pantalla en celular lento (reglas 16, 17, 18) lo cubre `botones.mjs` y el barrido, que corre el principal; acá no se repitió.

## Verificación de "lo que se edita se ve al toque"

La página pública y la app del socio leen de `landing_publica` y funciones hermanas con `unstable_cache` (60 s, etiqueta `landing`). La etiqueta la invalida `rpc()` (`src/lib/panel/servidor.ts`) cuando corre una escritura cuyo nombre figura en `src/lib/panel/lo-publico.ts`.

| Cambio | Se ve al toque | Cómo se sabe |
|---|---|---|
| Portada, secciones, textos, altas online, prueba social, video (`guardar_*`) | Sí | `pag-1`, `pag-2`, `pag-3`, `web-p8b` |
| Plan, precio, aumento programado, ajustes del plan (`guardar_*`, `programar_*`, `aplicar_*`) | Sí | `pla-1`, `pla-4`, `pla-5`, `vd-17` |
| Marca, horarios, cierres, feriados | Sí | `cfg-2`, `cfg-4` |
| **Orden de los planes** (`ordenar_planes`) | **No (por lectura del código: la etiqueta no se invalidaba, vencía a los 60 s). Arreglado en esta rama; no corrí la versión anterior para ver el rojo** | `rev-dueno-1` (nuevo) y `lo-publico.test.ts` |
| **Agregar o cerrar un horario de la grilla, cancelar una clase** (`agregar_horario`, `cerrar_horario`, `cancelar_clase`): "Clases de la semana" de la página | **No: tardaba hasta 60 s. Arreglado** | `lo-publico.test.ts` (nombre por nombre) |
| **Lo que hace el super admin** (dirección, pausa, baja, módulos, marca, plantillas): la página de un gimnasio pausado o con otra dirección | **No: tardaba hasta 60 s. Arreglado** | `lo-publico.test.ts` |
| Lo cobrado en el mostrador aparece en Resultado del mes | Sí (Resultado no usa caché: `cache-prohibido.test.ts` lo exige) | `rev-dueno-1` (nuevo): la recepción cobra $1.500 y Resultado sube |
| Apagar una sección en Configuración la saca del menú y de las pantallas | Sí | `cfg-7` |
| Medios de pago prendidos aparecen en Vender y en la app | Sí | `cfg-3` |

## 1. Hecho y publicado

| Función | Rol | Prueba | Estado |
|---|---|---|---|
| Inicio del dueño: saludo, cuatro números, accesos elegibles, Para hacer hoy, Primeros pasos, novedades de BRIK | Dueño | `panel-inicio`, `onb-1`, `adm-6` | En base, con prueba |
| Resultado del mes: cobrado contra el mes anterior, por concepto, por medio, día por día, horas pico, deuda, por sede; mes anterior; la recepción no lo ve | Dueño, encargado | `res-1`, `rev-dueno-1` | En base, con prueba |
| Exportar el mes para el contador (Ventas, Pagos, Caja en CSV) | Dueño | `res-2` | En base, con prueba |
| Gastos, presupuesto y ganancia | Dueño | `res-3`, `vd-41` | En base, con prueba |
| Control: alertas al dueño, línea de tiempo, suspensiones y expulsiones con motivo | Dueño | `vd-10`, `vd-46b` | En base, con prueba |
| Equipo: sumar, cambiar rol, sacar acceso, dar de baja, hacer dueño con confirmación, qué hizo cada uno | Dueño | `panel-equipo`, `equ-3`, `vd-42` | En base, con prueba |
| Permisos por gimnasio (la recepción vende, el encargado ve Resultado) y el profe que busca socios sin plata | Dueño | `equ-1`, `equ-2` | En base, con prueba |
| Configuración: pestañas, buscador, logo y fotos, medios de pago, horarios, feriados, mensajes con vista previa, reglas, contraste, historial de cambios, apagar secciones | Dueño | `panel-configuracion`, `cfg-2` a `cfg-9` | En base, con prueba |
| Tu página: editor con vista previa al lado, mostrar y ocultar, compartir, Probá una clase, Google (JSON-LD, robots, sitemap) | Dueño | `pag-1` a `pag-4`, `web-p8`, `web-p8b`, `panel-pagina` | En base, con prueba |
| Asistente de 9 pasos reanudable, con Probar conexión de MercadoPago | Dueño | `base-7`, `base-7b` | En base, con prueba |
| Planes y precios: trimestral y anual, por horario y por días, matrícula, aumento masivo y programado, precio por medio y día, cambio de plan con días a favor, recargo por mora, orden, servicios | Dueño, encargado | `pla-1` a `pla-7`, `panel-planes`, `vd-17` | En base, con prueba |
| Rutinas y ejercicios; la rutina del socio en su app | Dueño, profe | `rut-1`, `rut-2` | En base, con prueba |
| Clases del lado del dueño: faltas, turnos fijos, cancelar avisando, WOD, grilla | Dueño | `cla-1` a `cla-4`, `cla-9`, `panel-clases` | En base, con prueba |
| Ayuda y guías: globos de primera vez, Ctrl+K con preguntas y respuestas, guías con capturas | Todos | `vd-31`, `vd-63`, `guias-capturas` | En base, con prueba |
| Segunda pasada: una semana entera como dueña, y un gimnasio de cada tipo dado de alta | Dueño, super admin | `rev-2`, `rev-5` | En base, con prueba |
| Super admin, tablero: números de hoy, "necesitan atención" con su motivo, actividad, errores | Super admin | `super-f2`, `vd-40` | En base, con prueba |
| Super admin, lista de gimnasios: búsqueda, filtros, favoritos, exportar | Super admin | `super-f2`, `super-admin` | En base, con prueba |
| Super admin, ficha del gimnasio: datos, links por rol, equipo y claves, módulos y límites, abono, integraciones y Reprocesar, dominio, errores, registro, notas | Super admin | `super-f2`, `super-f10`, `super-p` | En base, con prueba |
| Super admin, alta en tres pasos con plantilla por tipo, accesos listos para WhatsApp y Probar acceso | Super admin | `super-p`, `adm-1`, `vd-40`, `rev-5` | En base, con prueba |
| Entrar como soporte con rol, motivo, 60 minutos, aviso al dueño y plata bloqueada salvo pedido; ver la app como un socio | Super admin | `super-f2`, `super-admin` | En base, con prueba |
| Buscar a cualquiera en todos los gimnasios (con motivo registrado) y Ctrl+K | Super admin | `super-f2` | En base, con prueba |
| Pausar, dar de baja con exportación, papelera, borrado definitivo, demos con vencimiento | Super admin | `super-f2`, `super-f10` | En base, con prueba |
| Plantillas de la plataforma (landing, textos, mensajes) con Restaurar por defecto y actualización de los gimnasios que no editaron | Super admin | `super-f9` | En base, con prueba |
| Estado de la plataforma: variables por entorno, base, copias, errores, mantenimiento programado | Super admin | `super-plat`, `super-f11`, `super-f10` | En base, con prueba |
| Abono a BRIK: planes, pagos, descuentos, suspensión gradual; novedades a dueños | Super admin | `adm-3`, `adm-6` | En base, con prueba |
| Dominios desde el super admin por la API de Vercel | Super admin | `super-plat` con un Vercel simulado | Escrito y probado simulado; en producción espera `VERCEL_TOKEN` y el dominio (⛔ de Mateo) |

## 2. Hecho sin publicar (esta rama)

| Función | Rol | Prueba | Falta publicar |
|---|---|---|---|
| La página pública se actualiza al toque al ordenar planes, agregar o cerrar horarios, cancelar una clase y con lo que hace el super admin | Dueño, super admin | `src/lib/panel/lo-publico.test.ts` (33 casos) y `rev-dueno-1` | Solo código: mergear la rama |
| Lo cobrado llega a Resultado del mes (prueba nueva) y el orden de planes se ve en la página (prueba nueva) | Dueño | `rev-dueno-1` | Solo la prueba |
| Equipo: si "Sumar a alguien" da error (mail inválido, la base lo rechaza) el nombre, el mail y el rol quedan escritos | Dueño | `panel-equipo`; typecheck y lint limpios | Solo código |
| Alta de gimnasio: el dueño, el mail, el celular y el plan de Base no se vacían con un error; un error de la dirección vuelve al paso 2, donde se corrige | Super admin | `super-p`, `vd-40`, `super-f2` corren el alta | Solo código |
| Resultado: Horas pico muestra las 24 horas (un gimnasio que abre a las 5 o las 24 h perdía horas) | Dueño | `res-1` abre la pantalla; tipos limpios | Solo código |
| Sin íconos dentro de `<option>` (rutinas, grilla, Equipo): HTML inválido y error de consola | Dueño, profe | `panel-clases`, `panel-equipo`, `rut-1` miran la consola | Solo código |
| Clases: el día sin clases ofrece "Armar la grilla" | Dueño, encargado, profe | `rev-dueno-1` | Solo código |
| Plata y permisos que no se tocaron, con la opción más segura | Dueño | Ninguna | `PREGUNTAS.md`, sección "Revisión zona dueño y super admin" |

## 3. Falta

Lo que ya estaba en `PULIDO.md` y sigue igual en el código (se verificó leyendo el archivo) más lo nuevo de esta revisión.

| Función | Rol | Por qué falta / qué hay |
|---|---|---|
| Cambiar el rol en Equipo pide confirmación para todo, no solo para dueño | Dueño | **Permisos.** La opción más segura está en `PREGUNTAS.md`; no la apliqué |
| El panel reconoce al soporte por el nombre "Soporte BRIK" y no por `equipo.es_soporte` | Dueño, soporte | **Permisos.** Toca `panel/layout.tsx` (carril A). En `PREGUNTAS.md` |
| "Entrar como soporte" con rol Encargado | Super admin | **Permisos.** Necesita migración de `admin_entrar_gimnasio`. En `PREGUNTAS.md` |
| Crear un plan valida la matrícula después de crearlo | Dueño | **Plata.** En `PREGUNTAS.md` |
| Quitar un gasto o dejar de repetir un fijo sin confirmación ni Deshacer | Dueño | **Plata.** En `PREGUNTAS.md` |
| El profe ve como ajena una clase por el nombre del profe, no por el id | Profe | Pide que `clases_del_dia` devuelva `profe_id` (migración que reemplaza una función con permisos) |
| Confirmaciones nativas (`window.confirm`) en dar de baja, restaurar textos, quitar dominio y borrar datos de un socio, en el super admin | Super admin | Hay que armar un confirmador en pantalla y cambiar `super-admin`, `super-f2` y `seg-6`, que hoy aceptan el diálogo. Mediano |
| Retención: "Avisar a todos", exportar y que Altas, Bajas, En riesgo y Socios al día lleven a su lista | Dueño | No existe. Grande |
| Tareas: editar, borrar y cortar una tarea que se repite todos los días | Dueño | No existe (`tareas/acciones.ts` solo crea y tilda) |
| Mensajes: "ver más" después de los 100 y que se actualice sola | Dueño | Corta en 100; no hay en vivo |
| La campana no se actualiza con la pantalla quieta | Todos | Pide intervalo o Realtime. Está en `components/panel` (carril D) |
| Configuración: Eventos no se puede apagar desde Secciones | Dueño | `secciones.ts` lo deja sin `apagable`. Rutinas sí se apaga |
| El aviso de cambios sin guardar de Configuración y Tu página solo frena cerrar la pestaña, no un click en el menú | Dueño | Falta un guardia en la navegación del Marco (carril A) |
| `/admin/gimnasios` no pagina y "← Gimnasios" de la ficha va a `/admin` en vez de a la lista con sus filtros | Super admin | Con 200 gimnasios se nota. Mediano |
| El tablero del super admin tiene unos 16 bloques sin menú (4 secciones) | Super admin | Diseño; no se tocó para no pisar los e2e de `super-f2` |
| El tema claro u oscuro se guarda en la base pero el panel solo lee la cookie | Todos | Toca `panel/layout.tsx` (carril A) |
| Detalles premium del dueño: reporte del mes para compartir, comparación con el año pasado, metas, vistas guardadas, tecla "?" con atajos | Dueño | Lista de `PULIDO.md`, Z6; no se hizo nada |
| Super admin: ingreso mensual de BRIK y cohortes, notas por gimnasio en la lista, "ver como el dueño" de solo lectura | Super admin | Lista de `PULIDO.md`, Z6; no se hizo nada |
| Factura electrónica (ARCA) para el abono de BRIK | Super admin | ⛔ hasta que Mateo tenga el servicio |
| Dominios en producción | Super admin | ⛔ `VERCEL_TOKEN`, `VERCEL_PROJECT_ID` y el dominio |
| Segundo factor obligatorio en `/admin` en producción | Super admin | Está escrito (SA-10); falta que Mateo lo active para su cuenta |

## Resultado de las corridas (Actions, rama `carril/rev-dueno`, app en modo producción)

| Corrida | Qué corrió | Resultado |
|---|---|---|
| 43117971930 | 53 recorridos de la zona dueño (Inicio, Resultado, Control, Equipo, Configuración, Página, asistente, Planes, Rutinas, Clases, Ayuda) + `rev-dueno-1` | Base (migraciones, pruebas de la base, chequeos) en verde. Pantallas: 44 en verde, 9 en rojo. Ninguno rojo por el código de esta rama: todos eran pruebas viejas que ya no miraban lo que la pantalla dice hoy (ver abajo) |
| 43120559934 | Los 9 rojos corregidos + 11 del super admin (`super-admin`, `super-f2`, `super-f9`, `super-f10`, `super-f11`, `super-p`, `super-plat`, `adm-1`, `adm-3`, `vd-40`, `rev-5`) + `rev-dueno-1` | 19 de 21 en verde (todo el super admin en verde); rojos `cfg-7` y `rev-2` |
| 43122253878 | `cfg-7`, `rev-2`, `rev-dueno-1`, `panel-inicio`, `vd-12`, `dis-0` | `cfg-7`, `rev-2`, `rev-dueno-1` y `panel-inicio` en verde; rojos `vd-12` (un selector que ahora toma el menú) y `dis-0` (esperaba 4 números) |
| 43123329812 | `vd-12`, `dis-0` | Los dos en verde (16 y 17 pasos) |

Qué estaba mal en los 9 recorridos rojos de la primera corrida (ninguno era un fallo del producto):
- `cfg-2`: el logo ahora se elige, se ve una vista previa y recién "Usar este logo" lo sube (BASE-7). La prueba no apretaba ese botón.
- `cfg-7`: buscaba el interruptor de cada sección por un emoji que ya no está.
- `rut-1` y `panel-clases`: elegían la opción por un texto con emoji; las opciones ya no llevan emoji.
- `equ-1`: el texto de un emoji sacado quedó vacío y coincidía con todo ("aparecen productos" siempre).
- `adm-6`: el botón se llama Publicar, no "Publicar para todos".
- `pla-7`: la búsqueda "Testigo Vencida" trae primero a "Testigo Pack Vencido"; ahora se elige por nombre entero.
- `vd-17`: leía la fila del plan antes de que el servidor la refrescara.
- `rev-2`, `vd-12` y `dis-0`: Inicio muestra más de 4 números desde BASE-4 (lo dice la migración `20261108040100`); el desplegable seguía diciendo "Elegir mis 4 números" y ahora dice "Elegir mis números".

`rev-dueno-1` (nuevo) pasó en las tres corridas en que corrió: lo cobrado en el mostrador sube Resultado, subir un plan cambia el orden en la página pública al instante, y el día sin clases ofrece la grilla.
