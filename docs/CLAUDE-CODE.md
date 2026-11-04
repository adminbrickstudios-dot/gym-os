# Gym OS en tu compu con Claude Code — paso a paso

Al terminar vas a tener: el repo en tu compu, Gym OS andando en
`http://demo.localhost:3123` con datos de prueba, Claude Code listo para
trabajar panel por panel de día, y la noche corriendo sola con
`scripts/noche/noche.sh`.

**Las claves no van en ningún lado de tu compu.** Para trabajar y para la noche
no hacen falta: todo corre contra una base local con datos inventados.
Producción se toca solo desde GitHub Actions y Vercel, como hasta ahora.

---

## Paso 1 · Instalar las herramientas (una sola vez, ~15 min)

### Mac

En la Terminal:

```bash
# Homebrew (si no lo tenés)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node, git, GitHub CLI y Postgres
brew install node git gh postgresql@16
brew services start postgresql@16
echo 'export PATH="$(brew --prefix postgresql@16)/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
createuser -s postgres

# Claude Code
curl -fsSL https://claude.ai/install.sh | bash
```

### Windows

1. PowerShell **como administrador**: `wsl --install`. Reiniciá. Abrí **Ubuntu**
   desde el menú Inicio y creá tu usuario. **Todo lo que sigue va dentro de Ubuntu.**
2. En Ubuntu:

```bash
sudo apt update && sudo apt install -y git postgresql postgresql-contrib gh curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
sudo service postgresql start
sudo -u postgres psql -c "alter user postgres password 'postgres'"
curl -fsSL https://claude.ai/install.sh | bash
```

**LISTO SI:** `node -v` dice 22 o más, y `claude --version` responde.

---

## Paso 2 · Traer el repo (~5 min)

```bash
gh auth login            # GitHub.com → HTTPS → Login with a web browser
gh repo clone adminbrickstudios-dot/gym-os ~/gym-os
cd ~/gym-os
npm install
npx playwright install chromium          # en Windows/Ubuntu: npx playwright install --with-deps chromium
```

---

## Paso 3 · Decirle dónde está la base local (una sola vez)

**Mac** (en `~/.zshrc`):

```bash
echo 'export PGHOST=localhost PGPORT=5432 PGUSER=postgres' >> ~/.zshrc && source ~/.zshrc
```

**Windows/Ubuntu** (en `~/.bashrc`):

```bash
echo 'export PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=postgres' >> ~/.bashrc && source ~/.bashrc
echo 'sudo service postgresql start >/dev/null 2>&1' >> ~/.bashrc
```

**LISTO SI:** `psql -d postgres -c "select 1"` responde `1`.

---

## Paso 4 · Ver Gym OS andando en tu compu

```bash
cd ~/gym-os
scripts/local/levantar.sh nueva
```

Abrí en **Chrome** (Safari no abre `demo.localhost`):

| Qué | Dirección | Usuario |
|---|---|---|
| Página del gimnasio demo | http://demo.localhost:3123 | — |
| Panel de la dueña | http://demo.localhost:3123/ingresar | `duena@ejemplo.invalid` |
| Recepción / profe / encargado | lo mismo | `recepcion@` · `profe@` · `encargado@ejemplo.invalid` |
| Super admin | http://localhost:3123/ingresar | `admin@ejemplo.invalid` |

Contraseña de todos: `demo-gymos`. Para apagar: `scripts/local/levantar.sh parar`.

Probá que todo esté sano: `npm run e2e` (tiene que terminar con "pasos en verde").

---

## Paso 5 · Trabajar de día con Claude Code

```bash
cd ~/gym-os
claude
```

La primera vez te pide iniciar sesión (con tu cuenta de Claude). Adentro, escribile
como a una persona. Lo que más vas a usar:

| Escribís | Qué hace |
|---|---|
| `/panel entrada` | Abre ese panel con sesión real, te muestra cómo está, te propone cambios, te pregunta lo que es tuyo y hace lo que apruebes |
| `/manana` | Te resume lo que hizo la noche y qué tenés que correr vos |
| `aprobá D1, D2 y D7` | Marca esas decisiones ✅ en la hoja de ruta |
| `sumá a la hoja de ruta: …` | Agrega un ítem con su "LISTO SI" |
| `qué falta para vender el primer gimnasio` | Lee la hoja de ruta y te dice |

La hoja de ruta es `docs/HOJA-DE-RUTA.md`: el orden, las decisiones y el detalle
de cada panel. Lo que cambies ahí cambia lo que hace la noche.

---

## Paso 6 · Antes de dormir: largar la noche

1. **Mirá las decisiones** (arriba de `docs/HOJA-DE-RUTA.md`). Las que te cierran,
   marcalas con ✅ (o decile a Claude Code "aprobá D1, D3…"). Sin ✅, esos ítems
   se saltean. Si cambiaste algo, que quede commiteado y pusheado
   (decile "guardá y subí la hoja de ruta").
2. Chequeo:
   ```bash
   cd ~/gym-os
   scripts/noche/noche.sh --prueba
   ```
   Tiene que terminar con "Todo listo".
3. Largar, sin que la compu se duerma:
   - **Mac:** `caffeinate -i scripts/noche/noche.sh`
   - **Windows:** Configuración → Sistema → Energía → "Suspender: nunca" (enchufada), y en Ubuntu `scripts/noche/noche.sh`
4. Dejá la terminal abierta y la compu enchufada.

**Qué hace:** crea la rama `noche/<fecha>` desde `main` y hace un ítem por
vuelta (hasta 12), cada uno probado ejecutando, commiteado y subido a esa rama.
Nunca toca `main` ni producción. Si se acaba el límite de uso de tu plan, espera
30 minutos y sigue. Al final deja un PR en GitHub.

Cuánto hace por noche depende del plan: cada ítem lleva entre 30 y 90 minutos.
Con el plan Max son varios por noche; con Pro se corta más seguido por el límite
(la noche espera y sigue sola).

---

## Paso 7 · A la mañana

1. `claude` → `/manana`. O mirá `.local/noche/<fecha>/resumen.txt` y las capturas en `.local/capturas/`.
2. Para ver lo nuevo en tu compu: `git switch noche/<fecha>` y `scripts/local/levantar.sh nueva`.
3. Para publicarlo:
   - Si el PR trae migraciones nuevas: GitHub → Actions → **Base de datos** →
     Run workflow → **elegí la rama `noche/<fecha>`** → `prevuelo`; si sale verde,
     otra vez con `aplicar`.
   - Mergeá el PR "Noche <fecha>" en GitHub. Vercel publica solo.
4. Volvé a `main` en tu compu: `git switch main && git pull`.

---

## Paso 8 · Cuando compres el dominio

Seguí `docs/ARRANQUE.md`, paso 5 (comprarlo en Vercel, sumar el dominio, `www`,
`*.dominio` y `app.dominio`, cambiar las dos variables `NEXT_PUBLIC_DOMINIO_*` y
redeployar). Desde ahí cada gimnasio tiene su dirección propia.

---

## Si algo falla

| Pasa | Qué hacer |
|---|---|
| `levantar.sh` dice que no llega a la base | Paso 3: `psql -d postgres -c "select 1"`. En Ubuntu: `sudo service postgresql start` |
| `demo.localhost` no abre | Usá Chrome |
| `noche.sh --prueba` marca algo con ✗ | Te dice qué falta y en qué paso de esta guía está |
| La noche cortó con "seis fallas seguidas" | Mirá `.local/noche/<fecha>/vuelta-NN.err` y contáselo a Claude Code de día |
| Un ítem quedó `[!]` | Leé el motivo en la hoja de ruta y el LOG; resolvelo de día con `/panel` |
