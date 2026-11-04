# Deja lista la base local en una sesión de Claude Code en la nube (o en Linux)
# y carga sus variables. Se usa con source, delante de cada comando:
#   source scripts/local/entorno.sh && npm run db:pruebas
# Si la base ya corre, no hace nada más que cargar las variables.

# Carpeta de la base: la que ya exista, si no una que un usuario común pueda usar
# (Postgres no corre como root y /root no se puede recorrer).
_base="/home/claude/pg-local"
[[ -d "$_base" ]] || _base="/var/lib/gymos-pg"
_bin="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
if [[ -n "$_bin" ]]; then
    _datos="$_base/data"
    _dueno="$(stat -c %U "$_base" 2>/dev/null || true)"
    if [[ ! -d "$_datos" ]]; then
      # Postgres no corre como root: usa un usuario común (claude o postgres).
      _dueno="$(id -u claude >/dev/null 2>&1 && echo claude || echo postgres)"
      mkdir -p "$_datos" && chown -R "$_dueno" "$_base"
      su "$_dueno" -c "$_bin/initdb -D $_datos -U postgres --auth=trust -E UTF8 >/dev/null"
    fi
    export PGHOST="$_base" PGPORT=54322 PGUSER=postgres
    if ! "$_bin/pg_isready" -q -h "$PGHOST" -p "$PGPORT"; then
      su "$_dueno" -c "$_bin/pg_ctl -D $_datos -l $_base/log.txt -o '-p $PGPORT -k $_base' start >/dev/null"
      for _i in 1 2 3 4 5 6 7 8 9 10; do "$_bin/pg_isready" -q -h "$PGHOST" -p "$PGPORT" && break; sleep 1; done
    fi
fi
export DB_PRUEBAS_URL="${DB_PRUEBAS_URL:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && scripts/db/local.sh url 2>/dev/null)}"
psql -w -d postgres -Atc "select 1" >/dev/null 2>&1 && echo "✓ base local lista ($PGHOST:$PGPORT)" || echo "✗ no pude levantar la base local"
