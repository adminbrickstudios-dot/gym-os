#!/usr/bin/env bash
# Vuelta final (22/11) · el Postgres de las pruebas de la base en Actions, con el reloj fijo.
# Las pruebas siembran los casos testigo con HOY = 2026-11-14 (supabase/pruebas/_comun.mjs) y algunas funciones usan now():
# con el reloj real, a partir del 22/11 "Al Día" salía amarillo y otras ocho pruebas fallaban por la fecha, no por el código.
# Regla del proyecto: relojes fijos. Esto levanta el Postgres 16 del runner con libfaketime corrido a RELOJ_PRUEBAS (por defecto
# el 19/11/2026 12:00 de Argentina, el último día con todas en verde); el reloj avanza normal desde ahí.
# Solo para Actions (ubuntu-latest trae Postgres 16 instalado y apagado). Nunca toca Supabase.
set -euo pipefail
OBJETIVO="${RELOJ_PRUEBAS:-2026-11-19 15:00:00 UTC}"
sudo apt-get install -y -qq faketime > /dev/null
LIB=$(dpkg -L libfaketime | grep -m1 'libfaketime.so.1$')
VERSION=$(ls /etc/postgresql | sort -n | tail -1)
CONF="/etc/postgresql/${VERSION}/main"
corrimiento=$(( $(date -u +%s) - $(date -u -d "$OBJETIVO" +%s) ))
{
  echo "LD_PRELOAD = '${LIB}'"
  echo "FAKETIME = '-${corrimiento}'"
  echo "FAKETIME_DONT_FAKE_MONOTONIC = '1'"
} | sudo tee -a "${CONF}/environment" > /dev/null
sudo sed -i -E 's/(scram-sha-256|md5|peer)$/trust/' "${CONF}/pg_hba.conf"
sudo pg_ctlcluster "${VERSION}" main start
for _ in $(seq 1 30); do pg_isready -h localhost -p 5432 -q && break; sleep 1; done
echo "Postgres ${VERSION} con reloj fijo: $(psql -h localhost -U postgres -d postgres -Atc 'select now()')"
# Node (las pruebas comparan "ahora" de JS con el de la base) corre con el mismo reloj en los pasos que siguen.
if [ -n "${GITHUB_ENV:-}" ]; then
  { echo "LD_PRELOAD=${LIB}"; echo "FAKETIME=-${corrimiento}"; echo "FAKETIME_DONT_FAKE_MONOTONIC=1"; } >> "$GITHUB_ENV"
fi
