#!/usr/bin/env bash
# Base local de pruebas: un Postgres real con la simulación de Supabase.
# No reemplaza a Supabase: sirve para aplicar migraciones y correr las
# pruebas de la base sin tocar el proyecto real.
#
#   scripts/db/local.sh nueva     borra y recrea la base gymos_pruebas
#   scripts/db/local.sh url       imprime la URL de conexión
#
# Variables: PGHOST, PGPORT, PGUSER (por defecto localhost:5432 postgres).
set -euo pipefail
cd "$(dirname "$0")/../.."

HOST="${PGHOST:-localhost}"; PORT="${PGPORT:-5432}"; USUARIO="${PGUSER:-postgres}"
BASE="gymos_pruebas"
URL="postgres://${USUARIO}@${HOST}:${PORT}/${BASE}"
if [[ "$HOST" == /* ]]; then URL="postgres://${USUARIO}@/${BASE}?host=${HOST}&port=${PORT}"; fi

case "${1:-}" in
  url) echo "$URL" ;;
  nueva)
    psql -h "$HOST" -p "$PORT" -U "$USUARIO" -d postgres -qc "drop database if exists ${BASE}" -c "create database ${BASE}"
    psql -h "$HOST" -p "$PORT" -U "$USUARIO" -d "$BASE" -q -v ON_ERROR_STOP=1 -f supabase/local/simular-supabase.sql
    node scripts/db/aplicar.mjs --url "$URL"
    echo "Base local lista: $URL"
    ;;
  *) echo "Uso: $0 nueva|url"; exit 1 ;;
esac
