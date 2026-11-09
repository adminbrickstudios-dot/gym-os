#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Base: Claude Code trabaja vuelta tras vuelta hasta terminar
# docs/base/RECTA-FINAL.md. Cada vuelta es un Claude nuevo (contexto limpio
# y memoria libre), así que si una se corta, la siguiente sigue donde quedó.
# Si llega al límite de uso, espera 30 minutos y vuelve a probar.
#
#   bash scripts/base/hasta-terminar.sh             hasta terminar (máximo 200 vueltas)
#   bash scripts/base/hasta-terminar.sh --vueltas 5
#
# Se corre desde Git Bash, en la carpeta del proyecto, con la compu enchufada
# y sin suspenderse. Para frenarlo: Ctrl+C.
# ═══════════════════════════════════════════════════════════════════
set -uo pipefail
cd "$(dirname "$0")/../.."

VUELTAS=200
[[ "${1:-}" == "--vueltas" ]] && VUELTAS="${2:-200}"

# La base local de la compu de Mateo (Windows, Postgres portátil).
[[ -f /c/Users/consu/pg-portable/env.sh ]] && source /c/Users/consu/pg-portable/env.sh

RAMA="base/2026-11-07"
CARPETA=".local/base-vueltas"
mkdir -p "$CARPETA"
RESUMEN="$CARPETA/resumen.txt"
dice() { echo "[$(date +%d/%m\ %H:%M)] $*" | tee -a "$RESUMEN"; }

git fetch -q origin
git switch -q "$RAMA" 2>/dev/null || git switch -q -c "$RAMA" "origin/$RAMA"
git pull -q --rebase origin "$RAMA" || dice "No pude traer lo último de $RAMA: sigo con lo que hay."

PROMPT='Leé docs/base/PROMPT.md y hacé UNA vuelta: el próximo ítem de docs/base/RECTA-FINAL.md que no esté en ✅ ni ⛔, completo y verificado. Al terminar la vuelta: commit y push, cerrá los navegadores y procesos que levantaste, y escribí como ÚLTIMA línea de tu respuesta exactamente "SIGUE: <qué hiciste>" o, si toda la RECTA-FINAL está en ✅ o ⛔, "TERMINADO".'

fallas=0
for (( v = 1; v <= VUELTAS; v++ )); do
  base="$CARPETA/vuelta-$(date +%d%H%M)"
  dice "Vuelta $v"
  claude -p "$PROMPT" --dangerously-skip-permissions --output-format json \
    < /dev/null > "$base.json" 2> "$base.err"
  salida=$?
  final="$(node -e '
    try { const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
          const t = String(r.result ?? "").trim().split("\n").pop();
          console.log((r.is_error ? "ERROR " : "") + t); }
    catch { console.log("ERROR sin respuesta legible"); }' "$base.json")"
  dice "  → $final"

  if [[ "$final" == TERMINADO* ]]; then dice "Terminó la RECTA-FINAL."; break; fi

  if [[ $salida -ne 0 || "$final" == ERROR* ]]; then
    if grep -qiE "usage limit|rate limit|resets at|overloaded|limit reached" "$base.json" "$base.err" 2>/dev/null; then
      dice "  Límite de uso: espero 30 minutos y sigo."; sleep 1800
      continue                       # el límite no cuenta como falla
    fi
    fallas=$((fallas + 1))
    dice "  Falló la vuelta ($fallas seguidas). Espero 3 minutos."; sleep 180
    if (( fallas >= 8 )); then dice "Ocho fallas seguidas: corto. Mirá $CARPETA."; break; fi
    continue
  fi
  fallas=0

  # Que quede en su rama y con todo subido, pase lo que pase.
  [[ "$(git branch --show-current)" != "$RAMA" ]] && git switch -q "$RAMA"
  git push -q origin "$RAMA" 2>/dev/null || true
done
dice "Fin. Resumen en $RESUMEN"
