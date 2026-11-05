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
PUERTO_MP="${PUERTO_MP:-$((PUERTO_SUPABASE + 10))}"   # simulador de MercadoPago (PAY-1)

parar() {
  if [[ -f ".local/$1.pid" ]]; then kill "$(cat ".local/$1.pid")" 2>/dev/null || true; rm -f ".local/$1.pid"; fi
}
# Matar el pid de npx no alcanza: `next dev` (hijo) sigue vivo con el puerto tomado y
# la app vieja seguía respondiendo. Se libera el puerto, sea quien sea que lo tenga.
liberar_puerto() {
  # Junta lo que encuentre cada herramienta: en algunos contenedores lsof no ve los procesos y fuser sí.
  local pids
  pids="$(lsof -ti "tcp:$1" 2>/dev/null || true) $(fuser "$1/tcp" 2>/dev/null || true)"
  [[ "$1" == "$PUERTO_APP" ]] && pids="$pids $(pgrep -f "next dev -p $1" || true)"
  pids="$(echo $pids | tr ' ' '\n' | grep -E '^[0-9]+$' | sort -u | tr '\n' ' ' || true)"
  [[ -n "${pids// /}" ]] && kill $pids 2>/dev/null || true
  for _ in $(seq 1 20); do curl -s -o /dev/null "http://localhost:$1/" || return 0; sleep 0.5; done
  [[ -n "${pids// /}" ]] && kill -9 $pids 2>/dev/null || true
  sleep 1
  if curl -s -o /dev/null "http://localhost:$1/"; then echo "✗ El puerto $1 sigue ocupado por otro proceso: cerralo y volvé a correr esto."; exit 1; fi
}
esperar() {   # esperar <url> <nombre>
  for _ in $(seq 1 60); do curl -s -o /dev/null "$1" && return 0; sleep 0.5; done
  echo "✗ $2 no respondió en $1 (ver .local/$2.log)"; exit 1
}

case "${1:-}" in
  parar) parar supabase; parar mp; parar app; liberar_puerto "$PUERTO_APP"; liberar_puerto "$PUERTO_SUPABASE"; liberar_puerto "$PUERTO_MP"; echo "Apagado."; exit 0 ;;
  nueva) scripts/db/local.sh nueva; rm -rf .local/storage ;;   # base nueva: sin archivos de antes
esac

URL="$(scripts/db/local.sh url)"
eval "$(node scripts/local/supabase-local.mjs claves | sed 's/^/export /')"

parar supabase
liberar_puerto "$PUERTO_SUPABASE"
node scripts/local/supabase-local.mjs --url "$URL" --puerto "$PUERTO_SUPABASE" > .local/supabase.log 2>&1 &
echo $! > .local/supabase.pid
esperar "http://127.0.0.1:$PUERTO_SUPABASE/" supabase

if [[ "$(psql "$URL" -Atc "select count(*) from public.gimnasios where slug = 'demo'")" == "0" ]]; then
  node scripts/datos/sembrar-demo.mjs --url "$URL" --dominio localhost
fi
node scripts/datos/usuarios-demo.mjs --url "$URL" --supabase "http://127.0.0.1:$PUERTO_SUPABASE" --servicio "$SUPABASE_SERVICE_ROLE_KEY"

# Simulador de MercadoPago: el pago online de punta a punta sin cuenta real.
parar mp
liberar_puerto "$PUERTO_MP"
node scripts/local/mp-simulado.mjs --puerto "$PUERTO_MP" > .local/mp.log 2>&1 &
echo $! > .local/mp.pid
esperar "http://127.0.0.1:$PUERTO_MP/" mp

parar app
liberar_puerto "$PUERTO_APP"
NEXT_DIST_DIR=.next-dev \
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:$PUERTO_SUPABASE" \
NEXT_PUBLIC_DOMINIO_BASE=localhost \
NEXT_PUBLIC_DOMINIO_PLATAFORMA=localhost \
MP_API_URL="http://127.0.0.1:$PUERTO_MP" \
  npx next dev -p "$PUERTO_APP" > .local/app.log 2>&1 &
echo $! > .local/app.pid
esperar "http://localhost:$PUERTO_APP/" app
echo "Listo: http://demo.localhost:$PUERTO_APP  ·  panel: /panel  ·  super admin: http://localhost:$PUERTO_APP/admin"
