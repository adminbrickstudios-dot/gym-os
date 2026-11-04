#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# La noche: Claude Code hace ítems de docs/HOJA-DE-RUTA.md uno por uno,
# cada uno en una vuelta nueva (contexto limpio), en la rama noche/<fecha>.
# Nunca toca main ni producción. A la mañana queda un PR para revisar.
#
#   scripts/noche/noche.sh               hasta que no quede nada (máximo 60 vueltas)
#   scripts/noche/noche.sh --vueltas 4
#   scripts/noche/noche.sh --prueba      solo chequea que esté todo listo
#
# Necesita: claude (con sesión iniciada), node 22, git, gh (con sesión),
# Postgres local (PGHOST/PGPORT/PGUSER) y el navegador de Playwright.
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

# Corre desde una copia: si algo cambia este archivo durante la noche, la noche no cambia.
if [[ -z "${NOCHE_COPIA:-}" ]]; then
  cd "$(dirname "$0")/../.."
  mkdir -p .local/noche
  cp scripts/noche/noche.sh .local/noche/noche-en-curso.sh
  cp scripts/noche/PROMPT.md .local/noche/prompt-en-curso.md
  NOCHE_COPIA=1 exec bash .local/noche/noche-en-curso.sh "$@"
fi
cd "$(dirname "$0")/../.."

VUELTAS=60
PRUEBA=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --vueltas) VUELTAS="$2"; shift 2 ;;
    --prueba) PRUEBA=1; shift ;;
    *) echo "Opción desconocida: $1"; exit 1 ;;
  esac
done

FECHA="$(date +%Y-%m-%d)"
RAMA="noche/$FECHA"
CARPETA=".local/noche/$FECHA"
mkdir -p "$CARPETA"
RESUMEN="$CARPETA/resumen.txt"
dice() { echo "[$(date +%H:%M)] $*" | tee -a "$RESUMEN"; }

# ── 1. Chequeos ─────────────────────────────────────────────────────
problemas=0
mal() { echo "✗ $*"; problemas=$((problemas + 1)); }
bien() { echo "✓ $*"; }

command -v claude >/dev/null && bien "Claude Code $(claude --version 2>/dev/null | head -1)" || mal "Falta Claude Code (docs/CLAUDE-CODE.md, paso 1)"
claude --help 2>/dev/null | grep -q -- "--permission-prompts" && bien "Claude Code sabe correr sin nadie mirando" || mal "Claude Code viejo: actualizalo (claude update)"
node -e 'process.exit(+process.versions.node.split(".")[0] >= 22 ? 0 : 1)' 2>/dev/null && bien "Node $(node -v)" || mal "Falta Node 22 o más nuevo"
# Ningún chequeo se queda esperando: sin límite de tiempo, gh o psql pueden pedir algo en silencio.
espera() { if command -v timeout >/dev/null; then timeout 20 "$@"; else "$@"; fi; }
command -v gh >/dev/null && espera gh auth status </dev/null >/dev/null 2>&1 && bien "GitHub CLI con sesión" || mal "Falta gh o su sesión: gh auth login"
if [[ -z "${PGUSER:-}" ]]; then
  mal "No están las variables de la base: corré  source ~/.bashrc  (o volvé a correr bash scripts/instalar.sh)"
elif command -v psql >/dev/null && espera psql -w -d postgres -Atc "select 1" </dev/null >/dev/null 2>&1; then
  bien "Postgres local (${PGHOST:-localhost}:${PGPORT:-5432})"
else
  mal "No llego al Postgres local. En Ubuntu: sudo service postgresql start  y después  source ~/.bashrc"
fi
espera psql -w -d postgres -Atc "select 1 from pg_available_extensions where name in ('pg_trgm','unaccent') having count(*) = 2" </dev/null 2>/dev/null | grep -q 1 \
  && bien "Postgres con pg_trgm y unaccent" || mal "Al Postgres le faltan pg_trgm o unaccent"
[[ -d node_modules ]] || { echo "Instalando dependencias…"; npm install --silent; }
node -e 'import("playwright").then(({chromium}) => chromium.launch()).then((b) => b.close()).catch(() => process.exit(1))' 2>/dev/null \
  && bien "Navegador de Playwright" || mal "Falta el navegador de Playwright: npx playwright install chromium"
[[ -z "$(git status --porcelain)" ]] && bien "Repo sin cambios sueltos" || mal "Hay cambios sin commitear: commitealos o guardalos antes de la noche"
git config user.email >/dev/null && bien "git firma como $(git config user.name)" || mal "git no tiene nombre ni mail: corré bash scripts/instalar.sh"
git remote get-url origin >/dev/null 2>&1 && bien "Remoto: $(git remote get-url origin)" || mal "El repo no tiene remoto origin"
if [[ -f .env.local ]] && grep -q "SERVICE_ROLE" .env.local 2>/dev/null; then
  echo "• Aviso: hay un .env.local con claves. La noche no lo necesita (todo corre contra la base local)."
fi
echo "• Hoja de ruta: $(node scripts/noche/pendientes.mjs | head -1)"
echo "• Próximo ítem: $(node scripts/noche/pendientes.mjs --siguiente)"

if (( problemas > 0 )); then echo; echo "Hay $problemas cosa(s) para arreglar antes de arrancar."; exit 1; fi
if (( PRUEBA )); then echo; echo "Todo listo. Para arrancar: scripts/noche/noche.sh"; exit 0; fi

# ── 2. Rama de la noche (desde main actualizado) ────────────────────
git fetch -q origin
if git show-ref -q "refs/remotes/origin/$RAMA"; then
  git switch -q "$RAMA" 2>/dev/null || git switch -q -c "$RAMA" "origin/$RAMA"
  git pull -q --ff-only origin "$RAMA"
else
  git switch -q -c "$RAMA" origin/main
  git push -q -u origin "$RAMA"
fi
dice "Rama $RAMA lista. Hasta $VUELTAS vueltas."

# ── 3. Permisos de la noche (se suman a .claude/settings.json; lo prohibido gana) ──
# Las migraciones que ya están en main no se tocan: se bloquean una por una.
CONGELADAS="$(ls supabase/migrations/*.sql | sed 's|^|"Edit(./|; s|$|)"|' | paste -sd, -)"
cat > .local/noche/permisos.json <<JSON
{
  "permissions": {
    "allow": [
      "Bash(npm *)", "Bash(npx tsc *)", "Bash(npx eslint *)", "Bash(npx next *)", "Bash(npx vitest *)", "Bash(npx playwright *)",
      "Bash(node *)", "Bash(scripts/*)", "Bash(bash scripts/*)", "Bash(psql *)",
      "Bash(git status*)", "Bash(git diff*)", "Bash(git log*)", "Bash(git show*)", "Bash(git add *)", "Bash(git commit *)",
      "Bash(git push origin $RAMA*)", "Bash(git stash *)", "Bash(git rm *)", "Bash(git mv *)", "Bash(git branch --show-current)",
      "Bash(curl -s http://localhost*)", "Bash(curl -s http://demo.localhost*)", "Bash(sleep *)", "Bash(kill *)",
      "Bash(ls *)", "Bash(cat *)", "Bash(head *)", "Bash(tail *)", "Bash(grep *)", "Bash(wc *)", "Bash(find *)",
      "Bash(mkdir *)", "Bash(cp *)", "Bash(mv *)", "Bash(rm .local/*)", "Bash(rm -f .local/*)",
      "WebFetch", "WebSearch"
    ],
    "deny": [
      "Bash(git push origin main*)", "Bash(git push * main*)", "Bash(git push -f*)", "Bash(git push --force*)",
      "Bash(git switch main*)", "Bash(git checkout main*)", "Bash(git merge *)", "Bash(git rebase *)", "Bash(git reset *)",
      "Bash(vercel *)", "Bash(npx vercel *)", "Bash(gh *)", "Bash(supabase *)", "Bash(npx supabase *)", "Bash(npm run db:types*)",
      "Read(./.env)", "Read(./.env.*)", "Edit(./.env*)", "Edit(./.claude/**)", "Edit(./scripts/noche/**)",
      $CONGELADAS
    ]
  }
}
JSON

export DB_PRUEBAS_URL="$(scripts/db/local.sh url)"
PROMPT="$(sed "s|{{RAMA}}|$RAMA|g" .local/noche/prompt-en-curso.md)"

# ── 4. Vueltas ──────────────────────────────────────────────────────
fallas=0
hechas=0
vuelta=0
while (( hechas < VUELTAS )); do
  siguiente="$(node scripts/noche/pendientes.mjs --siguiente)"
  if [[ "$siguiente" == "NADA" ]]; then dice "No queda nada que se pueda hacer sin tu decisión."; break; fi
  vuelta=$((vuelta + 1))
  base="$CARPETA/vuelta-$(printf %02d "$vuelta")"
  dice "Vuelta $vuelta: $siguiente"
  set +e
  claude -p "$PROMPT" \
    --permission-mode acceptEdits --permission-prompts none \
    --settings .local/noche/permisos.json \
    --output-format json < /dev/null > "$base.json" 2> "$base.err"
  salida=$?
  set -e
  final="$(node -e '
    try { const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
          const t = String(r.result ?? "").trim().split("\n").pop();
          console.log((r.is_error ? "ERROR " : "") + t); }
    catch { console.log("ERROR sin respuesta legible"); }' "$base.json")"
  dice "  → $final"

  if [[ "$final" == *"NADA MÁS"* ]]; then break; fi
  if [[ $salida -ne 0 || "$final" == ERROR* ]]; then
    fallas=$((fallas + 1))
    if grep -qiE "usage limit|rate limit|resets at|overloaded" "$base.json" "$base.err" 2>/dev/null; then
      dice "  Límite de uso: espero 30 minutos ($fallas)."; sleep 1800
    else
      dice "  Falló la vuelta ($fallas seguidas). Espero 2 minutos."; sleep 120
    fi
    if (( fallas >= 6 )); then dice "Seis fallas seguidas: corto la noche. Mirá $CARPETA."; break; fi
    continue
  fi
  fallas=0
  hechas=$((hechas + 1))

  # Que siga en su rama y con todo subido, pase lo que pase en la vuelta.
  if [[ "$(git branch --show-current)" != "$RAMA" ]]; then
    dice "  La vuelta cambió de rama: vuelvo a $RAMA."; git switch -q "$RAMA" || { dice "No pude volver a $RAMA: corto."; break; }
  fi
  git push -q origin "$RAMA" 2>/dev/null || true
done

# ── 5. PR para la mañana ────────────────────────────────────────────
scripts/local/levantar.sh parar >/dev/null 2>&1 || true
if [[ -n "$(git log --oneline "origin/main..$RAMA" 2>/dev/null)" ]]; then
  {
    echo "Lo que hizo la noche del $FECHA. **No mergear sin antes aplicar las migraciones nuevas** (ver abajo)."
    echo
    echo '```'; node scripts/noche/pendientes.mjs; echo '```'
    echo
    echo "### Vueltas"; echo '```'; cat "$RESUMEN"; echo '```'
    echo
    echo "### Migraciones nuevas"
    git diff --name-only --diff-filter=A "origin/main...$RAMA" -- supabase/migrations | sed 's/^/- /' || true
    echo
    echo "### Commits"
    git log --format='- %s' "origin/main..$RAMA"
  } > "$CARPETA/pr.md"
  if gh pr view "$RAMA" >/dev/null 2>&1; then
    gh pr edit "$RAMA" --body-file "$CARPETA/pr.md" >/dev/null && dice "PR actualizado: $(gh pr view "$RAMA" --json url -q .url)"
  else
    gh pr create --draft --base main --head "$RAMA" --title "Noche $FECHA" --body-file "$CARPETA/pr.md" >/dev/null \
      && dice "PR creado: $(gh pr view "$RAMA" --json url -q .url)"
  fi
fi
dice "Fin de la noche. Resumen en $RESUMEN"
