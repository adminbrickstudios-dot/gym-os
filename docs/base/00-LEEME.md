# BASE: la vuelta completa (07/11/2026)

Pedido de Mateo del 07/11 a la noche. Mañana entra el primer gimnasio real.
El texto del pedido, sin tocar, está en `PEDIDO-ORIGINAL.md`. Este archivo lo
cruza con lo que ya está construido y con lo que contestó Mateo. Si algo choca
con el pedido original, **gana este archivo**.

## Lo primero que hay que saber

**Gym OS v2 ya está construido y publicado** (PR #4, 07/11, 79 migraciones).
Casi todo lo que pide el pedido ya existe: la Entrada en todas las pantallas,
los 4 colores del veredicto, Cobrar, la caja por turno, el super admin que da
de alta gimnasios, el equipo, la app del socio con QR que rota, la página del
gimnasio, los primeros pasos, Ctrl+K, la medición de velocidad con 3.000
socios. Ver `docs/HOJA-DE-RUTA.md` bloques 20 a 23.

Entonces esta vuelta **no rehace nada**. Por cada punto del pedido:

1. Se busca lo que ya existe (código, base, e2e).
2. Se lo abre **con sesión real, con la app compilada** (`APP_MODO=produccion`).
3. Se completa lo que le falta para que quede como pide el pedido.
4. Se cambia solo lo que el pedido o una decisión de abajo cambia de verdad.

`DETALLES-70.md` ya trae, por cada uno de los 70 detalles, qué existe y con qué
ítem. `PROGRESO.md` es la lista de trabajo.

## Lo que decidió Mateo (07/11)

| # | Tema | Decisión |
|---|---|---|
| D36 | Vigencia guardada | **Se guarda solo `cubierto_hasta` en el socio** (ni estado ni deuda: la deuda crece sola con los días), por trigger, cada vez que cambia un hecho: pago, anulación, pausa, cambio de plan, regla de vencimiento, plan familiar. El color se saca comparando esa fecha con el momento: nunca queda viejo y no hay cron. Detalle en `REGLAS-NEGOCIO.md` § Vigencia. |
| D37 | Fondo | **Claro por defecto, oscuro elegible**: el gimnasio elige el suyo en Configuración y cada usuario puede cambiarlo en Mi cuenta. Reemplaza el "modo gym oscuro" del 05/11. |
| D38 | Íconos | **Íconos de línea propios** (set tipo Lucide, en el color del gimnasio) en lugar de emojis, en todos lados: menú, botones, app, página. |
| D39 | Nombre | **El producto se llama Base.** Cambia todo lo que ve la gente (ingreso, página de venta, mails, super admin, títulos, manifest). El repo, el código, las tablas y las variables siguen como están. |

## Lo que se decidió por defecto (Mateo lo puede cambiar)

Están en `PREGUNTAS.md` con el porqué. El agente trabaja con esto sin frenar.

| # | Tema | Por defecto |
|---|---|---|
| D40 | Resultado del ingreso en recepción | **Aviso flotante abajo a la derecha + panel lateral** al tocarlo. La ventana grande del veredicto (VD-1) queda como opción en Configuración ("Mostrar el resultado: aviso en la esquina / ventana grande"). Las tres formas de abrir la Entrada de D17 siguen; se suman F2 y `/` como atajo global. |
| D41 | Links por rol | `/dueno`, `/recepcion`, `/profe`, `/socio`, `/super` son **puertas fijas**: muestran el ingreso con la marca del gimnasio y después llevan a las pantallas que ya existen (`/panel`, `/app`, `/admin`). No se duplican pantallas. |
| D42 | Contraseña del dueño y del equipo | Quien crea la cuenta elige: **"la escribo yo"** (se muestra una sola vez para copiarla) o **"le mando un link"**. Al primer ingreso se le sugiere cambiarla. |
| D43 | Cómo se entra | **Mail y contraseña** es la forma principal y visible, con "Olvidé mi contraseña". Las otras de D23 (Google, código) quedan abajo, en "Otras formas de entrar", solo si están configuradas. Al socio con mail se le manda un link para crear su contraseña cuando lo dan de alta. |
| D44 | Asistente de 9 pasos | Se arma sobre los **Primeros pasos que ya existen** (VD-43), con los 9 pasos del pedido en ese orden. No es otra pantalla. |
| D45 | Prueba de carga | **5.000 socios y 100.000 ingresos.** Búsqueda e ingreso en menos de 1 s, cualquier pantalla en menos de 2 s (medido en la app compilada), cada función de base en menos de 300 ms. |
| D46 | `negocio_id` | El pedido dice `negocio_id`; el proyecto usa **`gimnasio_id`** y se queda así. |
| D47 | "Como Sillón" | Si el repo de Sillón se puede leer (`gh repo list adminbrickstudios-dot`), se mira su barra lateral. Si no, se sigue la del proyecto (la de yadeportes). No frena nada. |
| D48 | `ACCESOS.md` | En `.gitignore`, solo en la compu de Mateo, **nunca en el repo** (el repo es público). Links por rol, usuarios demo y cómo crear un gimnasio. Las contraseñas reales las escribe Mateo, nunca el agente. |
| D49 | Anti-robot en "Quiero ser socio" | Turnstile (ya está, detrás de una variable) + campo trampa invisible + tope por IP, que andan sin cuenta externa. |
| D50 | Sonido del aviso | **Prendido por defecto**, corto. Un sonido distinto para el rojo. Se apaga desde la recepción misma y desde Configuración. |
| D51 | Planes pagos | El agente anota qué plan hace falta y por qué (Vercel Hobby no permite uso comercial; Supabase Free pausa el proyecto si nadie lo usa y no guarda copias). **No contrata nada**: pagar es de Mateo. |
| D52 | Ley 25.326 | Política de privacidad del gimnasio, consentimiento en el alta y en "Quiero ser socio", y que el socio pueda pedir ver, corregir o borrar sus datos. La inscripción de la base en la AAIP es del gimnasio y de Mateo: se le deja escrito. |

## Lo que se encontró al armar esto (07/11)

- **El "Guardando…/Sumando…" que se queda colgado** es un bug del React que trae
  Next 15.5 (`19.2.0-canary-0bdb9206-20250818`). Next 16.4 lo trae arreglado.
  Va primero: **BASE-0** (era VD-64). Con esto colgándose, nada del P0 se
  puede probar en serio.
- **Verificación en Linux con la app compilada** (07/11, la cadena entera:
  221 recorridos + barrido): **fallan 58**. Entran en BASE-0. Muchos se cortan
  esperando algo que no llega (el mismo cuelgue); otros son pruebas que quedaron
  viejas o cosas rotas de verdad, y hay que mirar cada uno:
  `super-admin`, `ent-6`, `pla-4`, `panel-vender`, `caj-4`, `caj-5`, `cla-2`, `panel-equipo`, `rut-1`, `adm-3`, `cliente`, `rev-3`, `rev-5`, `com-3`, `com-11`, `vd-27`, `vd-12`, `vd-2`, `vd-12b`, `vd-6`, `vd-2b`, `vd-3`, `vd-4`, `vd-7`, `vd-8`, `vd-9`, `vd-41`, `vd-10`, `vd-18`, `vd-11`, `vd-15`, `vd-13`, `vd-37`, `vd-38`, `vd-35`, `vd-39`, `vd-24`, `vd-19`, `vd-20`, `vd-22`, `vd-40`, `vd-42`, `vd-26`, `vd-46a`, `vd-44`, `vd-31`, `vd-29`, `vd-46c`, `vd-46e`, `vd-46j`, `vd-46f`, `vd-46d`, `vd-46r`, `vd-46t`, `vd-49`, `vd-58`, `vd-62`, `vd-63`.
  Errores vistos: `com-3` el demo no tiene clases futuras con reservas · `vd-12`
  Inicio muestra más de 4 números · `vd-2` Cobrar no es el principal · `vd-12b`
  0 gráficos para 6 números · `vd-40` el veredicto no quedó en rojo con el
  motivo. Logs de cada uno: se reproducen con `npm run e2e` del script.
- **Los logs de GitHub Actions son públicos** (el repo es público). El paso
  `usuarios-demo` imprime la contraseña de los usuarios demo, y `estado` y
  `hacer-admin` imprimen nombres de gimnasios y el mail del admin. Hasta ahora
  `usuarios-demo` nunca corrió bien en producción, pero hay que cerrarlo antes
  de que alguien lo use: **BASE-8a**.
- `docs/CONVENCIONES.md` y `docs/LECCIONES.md` no existen, y `CLAUDE.md` los pide.
  Se escriben en BASE-DOC.

## Antes de publicar: ¿ya hay un gimnasio real?

Puede que Mateo ya haya creado el primer gimnasio real en producción. **Antes de
cada `aplicar`**, se corre Actions → Base de datos → `estado`. Si aparece un
gimnasio sin `[demo]`:

1. Se crea `.claude/BASE_CON_DATOS_REALES` en la compu.
2. Desde ahí el agente **no aplica más migraciones**. Deja la rama
   `publicar/...`, el PR y los pasos escritos al principio de `PROGRESO.md` para
   que los corra Mateo.

Esto es lo que pide el pedido: "si detectás datos de un gimnasio real, FRENÁ y
dejame el script listo".

## Cuándo se frena (solo esto)

- Borrar o cambiar datos de un gimnasio real.
- Gastar plata: contratar un plan, comprar un dominio, pagar una API.
- Tocar credenciales de producción de un cliente.
- Aplicar migraciones con un gimnasio real cargado (ver arriba).

Todo lo demás se decide con la opción recomendada, se anota en `PREGUNTAS.md`
como "decidido por defecto" y se sigue.

## Los archivos de esta carpeta

| Archivo | Qué tiene | Quién lo escribe |
|---|---|---|
| `00-LEEME.md` | Esto | Armado el 07/11 |
| `PEDIDO-ORIGINAL.md` | El pedido de Mateo textual | Armado el 07/11 |
| `RECTA-FINAL.md` | **Desde el 09/11, la única lista que sigue el loop**: 8 fases hasta "LISTO PARA TU PASADA" | Armado el 09/11, el agente marca el estado |
| `PROGRESO.md` | El detalle de cada BASE-* del P0, y arriba el resumen para Mateo | El agente lo mantiene |
| `SUPER-ADMIN.md` | El super admin mejorado (SA-1 a SA-12) | Armado el 08/11 |
| `PLATAFORMA.md` | Direcciones, login universal, cómo se encuentra el gimnasio, dominios (PLAT-01 a 08) | Armado el 09/11 |
| `PENSAR.md` | Las 5 preguntas antes de cada bloque, y lo que pensó el agente | El agente escribe |
| `AJUSTES-0911-NOCHE.md` | El pedido de Mateo del 09/11 a la noche, textual, y dónde quedó cada ID | Armado el 09/11 |
| `RECOMENDACIONES.md` | Cómo trabajar ahora que hay un gimnasio real, y las funciones nuevas propuestas (fase N) | Armado el 11/11 |
| `SOCIO-FLUJO.md` | El camino del socio: landing, registro con DNI, pago, entrar, su app y su perfil | Armado el 11/11 |
| `PULIDO.md` | Auditoría del código del 11/11: todo lo que hay que pulir, pantalla por pantalla, con archivo y línea (fase Z) | Armado el 11/11 |
| `PREVENCION.md` | Lo que se va a romper si no lo prevenimos, y quién hace qué | Armado el 12/11 |
| `REPARTO.md` | Los 4 carriles: el agente principal y sus 3 ayudantes sin pisarse | Armado el 09/11 |
| `FLUIDEZ.md` | La pasada botón por botón: las 14 reglas | Armado el 09/11 |
| `FALTANTES.md` | Lo que Mateo pidió y no estaba en ninguna lista (FA-1 a FA-24) | Armado el 09/11 |
| `PRUEBA-DUENO.md` | La pasada visual y la prueba del dueño que hace Mateo al final | Armado el 09/11, el agente lo prepara |
| `CAMBIOS-MATEO.md` | Lo que Mateo anota en su pasada; va primero en el loop | Mateo |
| `PREGUNTAS.md` | Preguntas abiertas con la opción recomendada aplicada | El agente agrega |
| `DETALLES-70.md` | Los 70 detalles: qué existe, qué falta, con qué ítem | Armado el 07/11, el agente actualiza el estado |
| `DISENO.md` | El diseño de Base: claro, íconos de línea, tipografía, recepción como mostrador | Armado el 07/11 |
| `REGLAS-NEGOCIO.md` | Vigencia (`cubierto_hasta`), cobros, accesos, deuda, avisos | Armado el 07/11, el agente completa |
| `VELOCIDAD.md` | Diagnóstico con números, antes y después | El agente lo llena |
| `CONTEXTO.md` | Qué es Base, para quién, cómo se vende | El agente |
| `PERMISOS.md` | Matriz rol × acción, **sacada de la base real** | El agente |
| `INVESTIGACION.md` | Mindbody, Glofox, PushPress, Wodify, Virtuagym, Fitco, sistemas argentinos (parte de `docs/v2/09-INSPIRACION.md` y `docs/producto/12-COMPETENCIA.md`) | El agente |

`docs/SCHEMA.md` (actualizar con lo real), `docs/CONVENCIONES.md` y
`docs/LECCIONES.md` (escribirlos) siguen en `docs/`, porque `CLAUDE.md` los busca
ahí.
