# Lecciones (leer antes de tocar permisos, migraciones o webhooks)

**Permisos**
- Un cero filtrado por RLS es indistinguible de un cero real: toda pantalla y toda función que depende de un permiso falla con error y texto. Cambiar solo el *texto* de un error (p. ej. "no tenés permiso" en vez de "sección apagada") es seguro; cambiar quién ve qué no lo es sin la matriz (`docs/base/PERMISOS.md`).
- Lo que toca plata o permisos más allá del ítem no se arregla solo: se anota en `docs/base/PREGUNTAS.md`.

**Migraciones**
- Probar siempre en una base limpia y con `prevuelo` (transacción que revierte) antes de aplicar. `db:pruebas` falla en cascada si se corre sobre una base que ya tiene los usuarios demo (`users_email_unico`).
- No se edita una migración entregada; si cambia la firma de una función, la vieja se borra en la misma migración.
- Una tabla nueva sin `gimnasio_id` (límites globales) se agrega a `SIN_GIMNASIO_ID` y a `docs/SCHEMA.md` § Excepciones, o `chequeos` la rechaza.
- Si se genera SQL con JavaScript, `replace()` interpreta `$$` y `$&` en el reemplazo: usar `split().join()`.
- Con un gimnasio real cargado, las migraciones las aplica Mateo; con solo gimnasios de prueba (0 socios) se pueden aplicar con Actions. Se mira con `estado` (imprime solo números).

**Webhooks (MercadoPago)**
- Mandan los webhooks, nunca el navegador; idempotentes por ID externo; firma verificada; nunca pasan por el proxy. La reconsulta ("Revisar con MercadoPago") mira de a 40 pagos por vez, los menos revisados primero.

**Next 16 / React 19**
- Next 15.5 traía un React con un bug que dejaba colgadas las acciones del servidor (`isPending` que no vuelve); se arregló pasando a Next 16.4.5. `middleware` es `proxy`; Turbopack es el compilador por defecto (hay que fijar `turbopack.root`); `revalidateTag` pide el perfil (`{ expire: 0 }`).
- React 19 **vacía el formulario después de cada acción con error**: un radio controlado se ve elegido pero no viaja. Lo que tiene que viajar va en un `<input type="hidden">` con el estado.
- Un atributo `data-…` en `<html>` puede coincidir con selectores de las pruebas (`[data-ventana-entrada]` matcheaba el `<html>`): los atributos "de estado" van con otro nombre (`entradaLista`).

**Velocidad**
- Con 5.000 socios la puerta (buscar, veredicto, registrar) tarda menos de 40 ms en la base; lo lento son las listas que recorren a todos (`privado.retencion`, ~440 ms). Llamar a una función cara varias veces dentro de otra multiplica el costo (`numeros_inicio` pasó de 1 a 4 llamadas y tardó 1,8 s): se calcula una vez.
- Las funciones de Vercel van en `gru1` (donde está Supabase); sin eso cada consulta cruza el continente.

**Entorno de Windows**
- La compu se queda sin memoria con el demo de 5.000 socios y con cadenas largas de e2e: tandas de 20 con base nueva, y la medición grande en Actions (`medir-escala.yml`).
- El cliente de pedidos de Playwright no resuelve `demo.localhost`: helper `api()` en `scripts/e2e/comun.mjs`.

**Ingreso (U0.1 / URG-02: "mail o contraseña incorrectos" con la cuenta que se acababa de crear)**
- **Causa real más probable: la cuenta nunca se creó.** El alta de producción fallaba con "Invalid API key" (falta o está mal `SUPABASE_SERVICE_ROLE_KEY` en Vercel): el gimnasio y la fila del dueño en `equipo` se crean con la base, pero la cuenta de ingreso (`auth.users`) se crea con la clave de servicio. Sin la cuenta, el ingreso responde "credenciales inválidas" y la pantalla decía lo mismo para todo. Desde U1 el alta dice qué falta y deja "Terminar alta".
- Las 7 causas de URG-02, revisadas contra el código y la base local (`supabase/pruebas/login-dueno-nuevo.test.mjs`, `scripts/e2e/fase-u0-login.mjs`): a) `createUser` ya lleva `email_confirm: true` (descartada; si apareciera `email_not_confirmed` la pantalla ahora lo dice con esas palabras). b) fila en `equipo`: el alta la deja (`equipo` del dueño, activo, sin cuenta) y `vincular_usuario_equipo` la une a la cuenta; una cuenta sin fila, o con fila de otro gimnasio, no ve este (probado). c) **`/g/<slug>/ingresar` redirigía a `/ingresar` y dejaba el gimnasio solo en una cookie**: el ingreso quedaba como el genérico de la plataforma, sin marca y con el error genérico. Ahora el redirect lleva `?gimnasio=<slug>` y el proxy resuelve ESE gimnasio (nunca uno por defecto; un slug que no existe da 404). d) otro proyecto de Supabase: lo cubre el chequeo de entorno (PLAT-06), no el código. e) mail con mayúsculas o espacios: la búsqueda era insensible (`lower(trim())`), pero la creación de la cuenta (`darAcceso`) confiaba en quien la llamaba; ahora normaliza adentro, y el ingreso también (espacio duro incluido). f) el tope de intentos fallidos avisa "muchos intentos", no "incorrectos". g) la cookie de sesión no cambia con el redirect (mismo host).
- **Mensajes honestos (PLAT-08):** tras una contraseña mala el servidor ahora dice cuál de tres: la cuenta existe y la contraseña no coincide, el mail no tiene cuenta (con el nombre del gimnasio si se entra desde su dirección), o la cuenta no está confirmada. El código real queda en el registro del servidor. Nunca un solo "incorrecto" para todo.
- Regla: un formulario que crea o busca cuentas normaliza el mail EN LA FUNCIÓN que lo guarda, no en cada pantalla que la llama.
