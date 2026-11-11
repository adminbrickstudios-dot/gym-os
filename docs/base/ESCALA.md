# Escala: lo que hay hecho, lo que falta y cómo se prueba (F9.4, F9.5, F9.6)

Pensado para miles de gimnasios. Cada punto dice **qué está en el código**, **qué hace falta de Mateo** y **cómo se prueba**.

## ESC-01 · Conexiones y región

- **La app no abre conexiones directas a Postgres.** Todo va por la API de Supabase (HTTP, PostgREST), que ya agrupa las conexiones con su propio pooler. Las funciones de Vercel no se quedan con conexiones abiertas: no hay nada que agotar mientras sea así.
- **Cuando haga falta una conexión directa** (scripts, un job, una herramienta de reportes): usar el **pooler de transacciones** de Supabase (Project Settings → Database → Connection pooling → "Transaction", puerto **6543**, host `…pooler.supabase.com`), nunca `db.<ref>.supabase.co:5432` (límite chico de conexiones). Las migraciones sí van por la conexión directa o de sesión (puerto 5432/`pooler` modo sesión), porque usan `begin` y `set`.
  - Con el pooler de transacciones no se puede usar `set` de sesión, `listen`, ni sentencias preparadas con nombre. Los scripts de `scripts/medir/` (`carga.mjs`, `explain.mjs`) usan `set local` dentro de una transacción: sirven igual.
- **Variable:** `SUPABASE_DB_URL` (opcional). Si se carga y no pasa por el pooler, "Estado de la plataforma" avisa en amarillo (`src/lib/admin/entorno.ts`).
- **Región:** `vercel.json` ya fija `"regions": ["gru1"]` (São Paulo) y el proyecto de Supabase tiene que estar en São Paulo (`sa-east-1`). El Estado de la plataforma avisa si `VERCEL_REGION` no es `gru1`.
- ⛔ **Lo que tiene que hacer Mateo:** confirmar en Supabase que el proyecto está en São Paulo (Project Settings → General → Region). Yo no puedo ver ese dato desde acá.

## ESC-02 · Páginas públicas en caché y sin auth en el proxy

- **Sin auth en el proxy ya está hecho:** `src/proxy.ts` solo llama a `getClaims()` en `/panel`, `/app`, `/admin` y `/ingresar`; la landing, `/hacete-socio`, `/g/<slug>`, `/gimnasio-no-encontrado`, la web pública y los webhooks pasan sin tocar la autenticación. La resolución de gimnasio por dirección se recuerda 60 s (`memoriaCorta`).
- **Datos de la landing en caché:** `traerLanding` y `traerMedicion` usan `unstable_cache` con etiqueta y se invalidan al editar (`revalidateTag`).
- **Lo que falta para que el HTML también salga de la caché de la red de Vercel** (es del principal: `src/proxy.ts` y las rutas públicas). Ver el pedido exacto en `PREGUNTAS.md` § "Pedido al principal (ESC-02)".

## ESC-03 · Consultas, RLS y asesores

- **EXPLAIN de lo que se usa seguido:** ya existe `scripts/medir/explain.mjs` (corre cada función de pantalla como su rol, con `explain analyze`, presupuesto 300 ms y `pendientes_panel` 50 ms) y el workflow `medir-escala.yml` lo corre con 3.000 socios y 200 gimnasios. El workflow `carga.yml` lo vuelve a correr con 1.000 gimnasios.
- **RLS con `(select auth.uid())`:** la migración `20261109020700` reescribe, partiendo de `pg_policies` (las políticas vigentes, no de una copia), las que llamaban `auth.uid()` pelado. La verificación de la propia migración y la prueba `escala-limites-monitoreo.test.mjs` fallan si queda alguna. Las demás políticas ya usaban `in (select privado.mis_gimnasios(...))`, que Postgres evalúa una sola vez.
- **Índices:** la misma migración agrega los de las claves foráneas calientes que no tenían ninguno que arrancara por esa columna (turnos de caja, ítems de cobertura, profes). El resto de las "faltantes" del asesor están cubiertas por índices de otra forma (por ejemplo `socio_id` suelto): no se duplican.
- ⛔ **Asesores de Supabase (seguridad y rendimiento):** no los puedo leer (el Supabase conectado acá ve otros proyectos). Mateo: Project → Advisors → Security y Performance, copiar los avisos a `PREGUNTAS.md`. Los que esperamos: "RLS enabled, no policy" en las tablas cerradas a propósito (info), "unindexed foreign keys" (ver arriba) y "auth RLS initplan" (resuelto).

## ESC-04 · Prueba de carga (F9.5)

- `scripts/medir/carga.mjs` + `.github/workflows/carga.yml`: 1.000 gimnasios y 500 usuarios virtuales a la vez (pool de 50 conexiones, como el pooler), p50 / p95 / p99 por pantalla, errores y pedidos por segundo; con la opción `con_web`, 500 visitantes más a la web pública. **Solo corre contra una base local o la del runner: se niega contra cualquier otro host.**
- Se dispara a mano (Actions → Carga → Run workflow) o con `[carga]` en el mensaje de un push. El resultado queda en el resumen de la corrida y como artefacto. **Todavía no hay resultados: se corre en Actions** (no hay memoria para hacerlo en la compu de desarrollo).

## ESC-05 · Tablas que crecen

- **Siempre paginadas:** el registro de BRIK por cursor (`admin_registro_brik(limite, antes)`, páginas de 50, tope 200); los errores y las listas de socios ya van con límite. Regla: ninguna función devuelve "todo" de una tabla que crece.
- **Listas para partirse por mes:** `ingresos`, `registro_brik` y `errores_app` ya se consultan siempre por rango de fechas y tienen índice por fecha (y por gimnasio + fecha). `admin_tamano_tablas()` muestra filas y megas y marca "conviene partirla" al pasar 5 millones de filas o 2 GB (se ve en `/admin` y alimenta una alerta).
- **Procedimiento para partir una tabla** (cuando la marque): 1) crear `<tabla>_nueva` `partition by range (momento)` con las mismas columnas; 2) crear las particiones de los últimos meses y de los próximos 3; 3) en una ventana corta, `insert … select` por tandas, renombrar y recrear las claves foráneas; 4) un job mensual (o la función de alta del mes) crea la partición siguiente. La clave primaria tiene que incluir la columna de partición. No se hace antes de que haga falta: con una tabla chica solo suma complejidad.

## ESC-06 · Monitoreo propio

- **Errores:** tabla `errores_app` (los registran los paneles desde la pantalla de error) y su lectura por pantalla y por gimnasio en `/admin`.
- **¿Responde?:** `GET /api/salud` (pública, sin datos: app y base con tiempos, 200 o 503) y el workflow `chequeo-salud.yml`, que la consulta cada 15 minutos y falla (GitHub avisa por mail) si no responde 3 veces seguidas o tarda más de 3 s. **Se activa cargando la variable `SALUD_URL` en GitHub** (Settings → Secrets and variables → Actions → Variables).
- **Alertas:** `admin_alertas()` (errores de la última hora, avisos de MercadoPago fallidos, abonos vencidos, gimnasios cerca del límite, tablas grandes), visible en `/admin`.
- ⛔ **Sentry:** queda para cuando Mateo cree la cuenta y cargue `SENTRY_DSN`. Mientras tanto, lo de arriba.

## ESC-08 · Límites por plan

- `plataforma_planes.max_socios` y `max_sedes` (vacío = sin límite), editables en `/admin` ("Límites por plan"). `admin_limites_gimnasios()` calcula por gimnasio: ok, **cerca** (desde el 90 %), **pasado**. Se muestra "se acerca al límite" en el super admin y entra a las alertas.
- **No se hace cumplir** (no bloquea altas): bloquear socios nuevos al llegar al límite cambia quién puede hacer qué y cuánto se cobra, y es decisión de Mateo. Si lo quiere, es un trigger sobre `socios` y `sedes` que consulte este mismo cálculo.
