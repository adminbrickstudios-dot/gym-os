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

**Login del dueño recién creado (U0.1, 09/11)**
- Un alta con el mail de una cuenta que YA existe no pisa su contraseña: la que escribe quien crea no se aplica, y el ingreso dice "incorrectos". Se avisa en el alta y se arregla con "Contraseña nueva". Causa más probable de "mail o contraseña incorrectos" junto con la clave de servicio mal puesta en Vercel (la cuenta nunca se creó; `Invalid API key`).
- `/g/<slug>/ingresar` no debe rebotar al `/ingresar` genérico: se reescribe conservando el gimnasio (marca y comprobación de pertenencia). Nunca caer a un gimnasio por defecto ni al demo.
- Un error de ingreso no se esconde bajo "incorrectos": sin confirmar, desactivada, sin gimnasio y demasiados intentos tienen su texto; el código real va al registro del servidor.
- **Las 7 causas de URG-02, revisadas contra el código y la base local** (`supabase/pruebas/login-dueno-nuevo.test.mjs`, `scripts/e2e/fase-u0-login.mjs`):
  a) `createUser` ya lleva `email_confirm: true` en todos los caminos (descartada).
  b) La fila usuario ↔ gimnasio ↔ rol: el alta deja el `equipo` del dueño (activo, sin cuenta) y `vincular_usuario_equipo` lo une a la cuenta; una cuenta sin fila, o con fila de otro gimnasio, no ve este (probado en la base).
  c) El redirect perdía el gimnasio: se resuelve en el proxy (arreglado por B); el slug que no existe no cae a otro (probado: `gimnasio_por_slug`).
  d) Otro proyecto de Supabase (vista previa contra producción): no se ve en el código; lo cubre el chequeo de entorno (PLAT-06).
  e) Mail con mayúsculas o espacios: la búsqueda de la cuenta es insensible (`usuario_por_mail` usa `lower(trim())`, probado con tres escrituras) y el ingreso normaliza. Otra variante: la contraseña que se escribe al crear NO se aplica si el mail ya tenía cuenta (lo de arriba).
  f) El tope de intentos fallidos avisa "muchos intentos", no "incorrectos".
  g) La cookie de sesión no cambia con el redirect (mismo host).
- Regla: una función que crea o busca cuentas normaliza el mail ADENTRO, no en cada pantalla que la llama.
- **F1.2, "Salir" no salía en el recorrido de "Olvidé" (e2e `olvide-socio`)**: el `POST /salir` cerraba la sesión pero armaba la redirección con `req.nextUrl.clone()`. Con la app corriendo detrás de otra dirección (la de CI, `demo.localhost`, contra un servidor que se ve como `localhost:PUERTO`) el destino salía de otro origen y el CSP `form-action 'self'` frena un formulario cuya redirección cambia de origen ("Sending form data to … violates … form-action 'self'"): el botón parecía muerto y el recorrido se quedaba en `/app/cuenta`. No era el código por mail ni el flujo de contraseña (esos pasos pasaban). Arreglo: `Location: /ingresar` relativo. Regla: en una ruta que responde a un formulario, la redirección es relativa; `nextUrl` no es la dirección que ve el navegador. Pendiente de revisar lo mismo en `src/app/admin/entrar`, `src/app/admin/salir-gimnasio` y `src/app/entrar/[slug]` (usan `nextUrl.clone()`; son enlaces/GET de otros carriles).
