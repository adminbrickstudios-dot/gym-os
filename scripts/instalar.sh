#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Deja la compu lista para Gym OS + Claude Code + la noche, de una.
#   bash scripts/instalar.sh
# Mac (con Homebrew) o Windows dentro de Ubuntu (WSL). Se puede correr
# varias veces: lo que ya está, lo saltea. No pide ni guarda ninguna clave.
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/.."
paso() { echo; echo "▶ $*"; }
tiene() { command -v "$1" >/dev/null 2>&1; }

SO="$(uname -s)"
if [[ "$SO" == "Darwin" ]]; then
  PERFIL="$HOME/.zshrc"
  tiene brew || { echo "Falta Homebrew. Instalalo con la línea de docs/CLAUDE-CODE.md y volvé a correr esto."; exit 1; }
  paso "Node, git, GitHub CLI y Postgres (Homebrew)"
  for p in node git gh postgresql@16; do brew list "$p" >/dev/null 2>&1 || brew install "$p"; done
  brew services start postgresql@16 >/dev/null
  PGBIN="$(brew --prefix postgresql@16)/bin"
  export PATH="$PGBIN:$PATH"
  grep -q "postgresql@16/bin" "$PERFIL" 2>/dev/null || echo "export PATH=\"$PGBIN:\$PATH\"" >> "$PERFIL"
  sleep 3
  psql -d postgres -Atc "select 1" >/dev/null 2>&1 || true
  createuser -s postgres 2>/dev/null || true
  LINEA_PG='export PGHOST=localhost PGPORT=5432 PGUSER=postgres'
elif [[ "$SO" == "Linux" ]] && tiene apt-get; then
  PERFIL="$HOME/.bashrc"
  paso "git, GitHub CLI, curl y Postgres (apt)"
  sudo apt-get update -qq
  sudo apt-get install -y -qq git gh curl postgresql postgresql-contrib >/dev/null
  if ! tiene node || ! node -e 'process.exit(+process.versions.node.split(".")[0] >= 22 ? 0 : 1)'; then
    paso "Node 22"
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - >/dev/null
    sudo apt-get install -y -qq nodejs >/dev/null
  fi
  sudo service postgresql start >/dev/null
  sudo -u postgres psql -qc "alter user postgres password 'postgres'" >/dev/null
  grep -q "service postgresql start" "$PERFIL" 2>/dev/null || echo 'sudo service postgresql start >/dev/null 2>&1' >> "$PERFIL"
  LINEA_PG='export PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=postgres'
else
  echo "Este instalador es para Mac o para Ubuntu (Windows con WSL). Ver docs/CLAUDE-CODE.md."; exit 1
fi

paso "Variables de la base local"
grep -q "PGUSER=postgres" "$PERFIL" 2>/dev/null || echo "$LINEA_PG" >> "$PERFIL"
eval "$LINEA_PG"
psql -d postgres -Atc "select 1" >/dev/null && echo "✓ Postgres responde"

paso "Tu nombre en los commits (sale de tu cuenta de GitHub)"
if ! git config --global user.email >/dev/null; then
  if gh auth status >/dev/null 2>&1; then
    login="$(gh api user -q .login)"; id="$(gh api user -q .id)"; nombre="$(gh api user -q '.name // .login')"
    git config --global user.name "$nombre"
    git config --global user.email "${id}+${login}@users.noreply.github.com"
  else
    echo "Falta la sesión de GitHub: corré gh auth login y volvé a correr este script."; exit 1
  fi
fi
echo "✓ git firma como $(git config --global user.name) <$(git config --global user.email)>"

paso "Claude Code"
if ! tiene claude && [[ ! -x "$HOME/.local/bin/claude" ]]; then curl -fsSL https://claude.ai/install.sh | bash; fi
export PATH="$HOME/.local/bin:$PATH"
grep -q '.local/bin' "$PERFIL" 2>/dev/null || echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$PERFIL"
claude --version

paso "Dependencias del proyecto y navegador de pruebas"
npm install --silent
if [[ "$SO" == "Linux" ]]; then npx playwright install --with-deps chromium; else npx playwright install chromium; fi

paso "Gym OS en tu compu, con el gimnasio demo"
scripts/local/levantar.sh nueva
npm run e2e:admin
scripts/local/levantar.sh parar >/dev/null

echo
echo "════════════════════════════════════════════════════════════"
echo "✓ Listo. Ahora, en esta misma terminal:"
echo "    source $PERFIL"
echo "    claude              (iniciá sesión con tu cuenta y salí con /exit)"
echo "    gh auth status      (si dice que no, corré: gh auth login)"
echo "  Y para largar la noche:"
if [[ "$SO" == "Darwin" ]]; then
  echo "    caffeinate -i scripts/noche/noche.sh"
else
  echo "    scripts/noche/noche.sh"
fi
echo "════════════════════════════════════════════════════════════"
