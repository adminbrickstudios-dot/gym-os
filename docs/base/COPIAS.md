# Copias de los datos del cliente (C8)

Una copia diaria de la base, cifrada, que no depende de tener Supabase Pro. Si Supabase se cae, se borra algo
por error o hay que volver a un día anterior, hay con qué.

## Qué hace

`.github/workflows/copias.yml` (Actions → **Copias**):

1. **exportar** — todos los días a las 03:17 (Argentina) y cuando apretás *Run workflow*. Con `SUPABASE_DB_URL`
   (solo lee) hace `pg_dump` del esquema `public` y `privado`: el esquema para restaurar, los datos, y los
   conteos de cada gimnasio **real** (no demo): socios, pagos, coberturas e ingresos. Lo empaqueta y lo
   **cifra** (AES-256, clave de `COPIAS_CLAVE`). Prueba descifrarlo antes de seguir. Lo guarda como
   artefacto de Actions **por 30 días**. Nunca va al repo.
2. **restaurar-prueba** — baja esa copia, la descifra, la restaura en un Postgres descartable del runner,
   compara los conteos con los que anotó al exportar (tienen que coincidir exactos), muestra los de la base de
   origen de ahora (informativo: el origen sigue recibiendo pagos) y corre `scripts/chequeos.mjs` sobre lo
   restaurado. Si algo no coincide, el job queda en rojo.

El repo y los logs son públicos: en el log solo salen números (`gimnasio 1: socios 79`), nunca nombres, mails ni
direcciones. Los secretos están enmascarados.

Lo que **no** cubre: los logins (`auth.users`: mails, teléfonos, contraseñas) y los archivos de Storage
(fotos, comprobantes). Quedan en Supabase. La copia trae todo `public` (incluye el gimnasio demo, si existe) y
`privado`; los conteos son por gimnasio real.

## Pasos para Mateo (una sola vez)

1. Generá una clave larga al azar (32 caracteres o más). Por ejemplo, en una terminal: `openssl rand -base64 32`.
2. **Guardala en tu gestor de contraseñas.** Sin esta clave, ninguna copia se puede abrir. Si la perdés, las
   copias viejas quedan inservibles.
3. GitHub → el repo → Settings → Secrets and variables → Actions → pestaña **Secrets** → *New repository secret*:
   nombre `COPIAS_CLAVE`, valor la clave. (`SUPABASE_DB_URL` ya está cargado para el workflow "Base de datos".)
4. Actions → **Copias** → Run workflow. Tiene que quedar verde en los dos jobs. Si falta un secreto, el job
   falla con un mensaje en palabras que dice cuál.

Desde ahí corre solo todos los días. Cada tanto (una vez por mes) mirá que el último haya quedado verde.

## Cómo descargar una copia

- En GitHub: Actions → Copias → la corrida → sección *Artifacts* → `base-copia-<número>`. Baja un `.zip`
  con `base-copia-AAAA-MM-DD.tar.gz.enc` adentro.
- O con la terminal: `gh run download <número de corrida> --name base-copia-<número>`.

Los artefactos de un repo público los puede bajar cualquier cuenta de GitHub. Por eso el archivo va cifrado: sin
`COPIAS_CLAVE` es ruido. Pasados 30 días GitHub los borra solos.

## Cómo restaurar (en una base de prueba)

Necesitás Postgres 15 o más nuevo (con `psql`), `openssl` y Node. **Nunca** se restaura sobre Supabase de
producción: el script se niega.

```bash
# 1. Una base nueva y vacía (local o descartable)
createdb gymos_restaurada

# 2. Restaurar y verificar (la clave por variable de entorno, no pegada en el comando)
export COPIAS_CLAVE='...tu clave...'
scripts/db/restaurar-copia.sh ruta/a/base-copia-AAAA-MM-DD.tar.gz.enc "postgres://postgres@localhost:5432/gymos_restaurada"

# 3. Los chequeos del proyecto sobre lo restaurado
node scripts/chequeos.mjs --url "postgres://postgres@localhost:5432/gymos_restaurada"
```

El script le aplica a la base de prueba la simulación de Supabase (roles y esquema `auth` vacíos), el esquema y
los datos de la copia, y compara conteos. El único chequeo que puede quedar en rojo y no tiene que ver con la
copia es "Diseño" (mira archivos del repo).

Para recuperar de verdad un gimnasio en producción a partir de la copia, no se corre este script contra
Supabase: se saca la fila o la tabla que hace falta de la base restaurada y se la carga con una migración o un
script revisado, a mano y con cuidado. Eso se decide en el momento, con el problema a la vista.

## Cuando se contrate Supabase Pro

- **Pro** trae copias diarias propias de Supabase (7 días de retención) y *Point-in-Time Recovery* como
  complemento pago. Se **suman** a esta copia, no la reemplazan: las de Supabase restauran el proyecto entero
  (incluido `auth` y Storage); estas son nuestras, cifradas, y están fuera de Supabase, así que sirven si se
  pierde el proyecto o la cuenta.
- Alcanza con dejar `copias.yml` como está. Anotar en `SUPER-ADMIN.md` SA-11 (estado de las copias, D51) que hay
  dos copias, la de Supabase y esta.
- Si algún día la base pesa demasiado para el límite de artefactos de GitHub, el cambio es mandar el mismo
  archivo cifrado a un bucket privado (S3 o similar) en vez del artefacto; el cifrado y la restauración no cambian.

## Qué está probado y qué no

Probado en una base local con datos del demo: exportar, cifrar, descifrar, restaurar en una base nueva, conteos
coincidentes, chequeos. Pruebas del workflow: `src/lib/copias-workflow.test.ts`. **No probado todavía:** una
corrida real de Actions contra la base de Supabase (instalación de `pg_dump` 17, tamaño real, permisos de
`pg_dump` con la `SUPABASE_DB_URL` de producción). La primera corrida con `COPIAS_CLAVE` cargada lo dice.
