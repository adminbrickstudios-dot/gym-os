#!/usr/bin/env bash
# Restaura una copia (la que arma scripts/db/copia.mjs) en una base de PRUEBA y verifica los conteos.
#
#   COPIA_CLAVE=... scripts/db/restaurar-copia.sh <archivo.tar.gz.enc> <url de una base VACÍA de prueba>
#
# La base destino tiene que estar vacía y ser un Postgres común (local o el de servicio del runner):
# el script le aplica supabase/local/simular-supabase.sql (roles y auth) y después el esquema y los datos
# de la copia. Se NIEGA a tocar una base de Supabase o una que ya tenga tablas de Base: restaurar encima
# de producción es el error que esto existe para evitar.
# La clave entra por la variable COPIA_CLAVE, nunca por la línea de comandos.
set -euo pipefail
cd "$(dirname "$0")/../.."

ARCHIVO="${1:-}"; URL="${2:-}"
[[ -n "$ARCHIVO" && -n "$URL" ]] || { echo "Uso: COPIA_CLAVE=... $0 <archivo.tar.gz.enc> <url de la base de prueba>"; exit 1; }
[[ -f "$ARCHIVO" ]] || { echo "ERROR: no existe el archivo de la copia"; exit 1; }
[[ -n "${COPIA_CLAVE:-}" ]] || { echo "ERROR: falta COPIA_CLAVE, la clave con la que se cifró la copia"; exit 1; }
if [[ "$URL" == *supabase.co* || "$URL" == *supabase.com* || "$URL" == *pooler* ]]; then
  echo "ERROR: la base destino parece ser de Supabase. Restaurar es solo para una base de PRUEBA vacía."; exit 1
fi
# psql imprime el error con la dirección; lo dejamos pasar por filtro para no mostrarla.
psq() { psql -X -q -v ON_ERROR_STOP=1 "$@" --dbname "$URL" >/dev/null 2> >(sed -E 's#postgres(ql)?://[^ ]+#<url>#g' >&2); }

hay="$(psql -X -At -c "select count(*) from information_schema.tables where table_schema in ('public','privado')" --dbname "$URL" 2>/dev/null || echo error)"
[[ "$hay" == "0" ]] || { echo "ERROR: la base destino no está vacía o no se pudo conectar (tablas: $hay). Usá una base nueva."; exit 1; }

TRABAJO="$(mktemp -d)"; trap 'rm -rf "$TRABAJO"' EXIT
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass env:COPIA_CLAVE -in "$ARCHIVO" -out "$TRABAJO/copia.tar.gz" \
  || { echo "ERROR: no se pudo descifrar. La clave no es la de esta copia, o el archivo está dañado."; exit 1; }
tar -xzf "$TRABAJO/copia.tar.gz" -C "$TRABAJO"
echo "Copia descifrada."

psq -f supabase/local/simular-supabase.sql
# La simulación da permisos por defecto a anon/authenticated; la copia trae los suyos, explícitos: se sacan los de la simulación.
psq -c "alter default privileges in schema public revoke all on tables from anon, authenticated, service_role" -c "alter default privileges in schema public revoke all on functions from anon, authenticated, service_role" -c "alter default privileges in schema public revoke all on sequences from anon, authenticated, service_role"
# Las extensiones que el esquema usa (en Supabase ya vienen; el esquema de la copia no las crea).
psq -c "create extension if not exists pg_trgm with schema extensions" -c "create extension if not exists pgcrypto with schema extensions" -c "create extension if not exists unaccent with schema extensions"
# pg_dump de 16 incluye "CREATE SCHEMA public": en una base nueva ya existe.
sed -i '/^CREATE SCHEMA public;[[:space:]]*$/d' "$TRABAJO/esquema.sql"
# Si el esquema da permisos a roles que solo existen en Supabase (supabase_admin, etc.), se crean vacíos.
for rol in $(grep -E '^(GRANT|REVOKE|ALTER DEFAULT PRIVILEGES)' "$TRABAJO/esquema.sql" | grep -oE '(TO|FROM|FOR ROLE) "?[a-z_][a-z0-9_]*' | awk '{print $NF}' | tr -d '"' | sort -u); do
  case "$rol" in PUBLIC|postgres|public) continue ;; esac
  psq -c "do \$\$ begin if not exists (select 1 from pg_roles where rolname = '$rol') then create role \"$rol\" nologin; end if; end \$\$"
done
psq -f "$TRABAJO/esquema.sql"
# Los datos entran con los triggers y las claves foráneas apagadas (la copia ya es consistente,
# y los triggers recalcularían cosas guardadas como hechos). Hace falta ser superusuario: en una base de prueba lo somos.
PGOPTIONS="-c session_replication_role=replica" psq -f "$TRABAJO/datos.sql"
echo "Esquema y datos restaurados."

# Si ORIGEN_URL está puesta (solo lectura), también muestra los conteos de la base de origen de ahora.
node scripts/db/copia.mjs verificar --carpeta "$TRABAJO" --url "$URL" ${ORIGEN_URL:+--origen "$ORIGEN_URL"}
