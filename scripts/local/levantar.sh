#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Levanta Gym OS entero en tu compu, sin proyecto de Supabase:
#   base local + supabase-local (auth y RPC) + la app en modo desarrollo.
#
#   scripts/local/levantar.sh            levanta todo (y siembra si la base está vacía)
#   scripts/local/levantar.sh nueva      borra la base, siembra de cero y levanta
#   scripts/local/levantar.sh parar      apaga supabase-local y la app
#
# Después: http://demo.localhost:3123 (landing), /ingresar, /panel
#          http://localhost:3123/admin (super admin)
# Usuarios: los imprime al final (contraseña demo-gymos).
# Necesita PGHOST/PGPORT/PGUSER de un Postgres 15+ (ver CLAUDE.md).
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/../.."
mkdir -p .local
PUERTO_APP="${PUERTO_APP:-3123}"
PUERTO_SUPABASE="${PUERTO_SUPABASE:-54321}"

parar() {
  if [[ -f ".local/$1.pid" ]]; then kill "$(cat ".local/$1.pid")" 2>/dev/null || true; rm -f ".local/$1.pid"; fi
}
esperar() {   # esperar <url> <nombre>
  for _ in $(seq 1 60); do curl -s -o /dev/null "$1" && return 0; sleep 0.5; done
  echo "✗ $2 no respondió en $1 (ver .local/$2.log)"; exit 1
}

case "${1:-}" in
  parar) parar supabase; parar app; echo "Apagado."; exit 0 ;;
  nueva) scripts/db/local.sh nueva ;;
esac

URL="$(scripts/db/local.sh url)"
eval "$(node scripts/local/supabase-local.mjs claves | sed 's/^/export /')"

parar supabase
node scripts/local/supabase-local.mjs --url "$URL" --puerto "$PUERTO_SUPABASE" > .local/supabase.log 2>&1 &
echo $! > .local/supabase.pid
esperar "http://127.0.0.1:$PUERTO_SUPABASE/" supabase

if [[ "$(psql "$URL" -Atc "select count(*) from public.gimnasios where slug = 'demo'")" == "0" ]]; then
  node scripts/datos/sembrar-demo.mjs --url "$URL" --dominio localhost
fi
node scripts/datos/usuarios-demo.mjs --url "$URL" --supabase "http://127.0.0.1:$PUERTO_SUPABASE" --servicio "$SUPABASE_SERVICE_ROLE_KEY"

parar app
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:$PUERTO_SUPABASE" \
NEXT_PUBLIC_DOMINIO_BASE=localhost \
NEXT_PUBLIC_DOMINIO_PLATAFORMA=localhost \
  npx next dev -p "$PUERTO_APP" > .local/app.log 2>&1 &
echo $! > .local/app.pid
esperar "http://localhost:$PUERTO_APP/" app
echo "Listo: http://demo.localhost:$PUERTO_APP  ·  panel: /panel  ·  super admin: http://localhost:$PUERTO_APP/admin"
