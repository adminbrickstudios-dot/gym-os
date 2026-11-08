# Convenciones: "¿cómo se hace esto acá?"

**Base de datos**
- Tablas, columnas, funciones y triggers en español. `gimnasio_id` en toda tabla, con FK compuesta `(gimnasio_id, x_id)` → `x(gimnasio_id, id)`; las excepciones están en `docs/SCHEMA.md` y en `scripts/chequeos.mjs` (`SIN_GIMNASIO_ID`).
- RLS activa en la misma migración que crea la tabla. Todo `unique` es por gimnasio.
- Fechas en `timestamptz`; los días calendario son intervalos `[desde, hasta)` en la medianoche local del gimnasio. Plata en `numeric(12,2)`; se muestra solo con `formatearPesos()`.
- Funciones: `set search_path = ''`, nombres calificados, `revoke execute ... from public` y después `grant` explícito. Las que solo llama el servidor van a `service_role` y empiezan con `privado.es_servicio()`.
- Migraciones: aditivas e idempotentes, sin `begin/commit`, con guarda de entrada y verificación final (`raise exception`). Una migración entregada no se edita: lo nuevo va en otra. Cuidado al generarlas con `String.replace` de JavaScript: un `$$` en el reemplazo se come un `$`.
- Nombres: `20261108BBNN00_descripcion.sql` (BB = bloque, NN = orden).

**Aplicación**
- Las pantallas solo llaman RPC (`rpc()` / `rpcLectura()`); el veredicto nunca se recalcula en TypeScript.
- Cada pantalla corre dentro de `intentar()`: un permiso denegado es un **error con texto**, nunca una lista vacía. Toda escritura verifica filas afectadas.
- `<Link>` en vez de `router.push`; `loading.tsx` en cada ruta con la forma real; press state con `:active`.
- Todo texto visible dice **Base**, no "Gym OS". Claro por defecto; el color sale de tokens (`globals.css`), no de hex sueltos.
- Variaciones por gimnasio = datos: `configuracion_gimnasio`, secciones apagables, planes, etc.

**Pruebas**
- Base: `npm run db:pruebas` en una base limpia (`scripts/db/local.sh nueva`), con momentos fijos. Recorridos: `scripts/e2e/*.mjs` con sesión real contra la app compilada (`APP_MODO=produccion scripts/local/levantar.sh nueva`). Una prueba no depende de lo que dejó la anterior.
- Para cerrar un bloque: `npm run verificar`, e2e del recorrido, capturas mirándolas, y la entrada en `docs/LOG.md`.

**Git y publicación**
- Rama de trabajo, PR a `main` por bloque. Migraciones nuevas: Actions → Base de datos → `prevuelo` y `aplicar` con la rama, y recién después el merge (producción nunca tiene código que espera una migración que no está). Nada de claves en el repo (es público); los logs de Actions también son públicos.
