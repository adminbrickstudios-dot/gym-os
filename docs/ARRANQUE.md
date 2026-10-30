# Gym OS — Arranque paso a paso

Cuatro pasos, en este orden. Cada uno termina con algo que se verifica.
Tiempo total: ~40 minutos.

Antes de empezar necesitás: Node 22+, git, una cuenta de GitHub, una de
Supabase y una de Vercel.

---

## Paso 1 · El repo en GitHub (5 min)

```bash
git clone gym-os.bundle gym-os
cd gym-os
git remote remove origin           # el bundle trae su origen local; se saca
npm install
```

Crear el repo privado y subirlo. Con la CLI de GitHub:

```bash
gh repo create gym-os --private --source=. --push
```

Sin la CLI: en github.com → New repository → `gym-os`, privado, **sin**
README. Después:

```bash
git remote add origin https://github.com/TU_USUARIO/gym-os.git
git push -u origin main
```

**LISTO SI:** `git log origin/main --oneline -3` muestra los commits.

---

## Paso 2 · Supabase (10 min)

1. supabase.com → New project.
   - **Región: South America (São Paulo)**.
   - **Contraseña de la base: solo letras y números.** Un `@` o un `#`
     rompe la cadena de conexión y el error no lo dice.
2. Copiar `.env.local.example` a `.env.local` y completar:
   - Project Settings → API: `NEXT_PUBLIC_SUPABASE_URL`,
     `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
   - Project Settings → General: `SUPABASE_PROJECT_ID`.
   - Project Settings → Database → Connection string → **Session pooler**:
     `SUPABASE_DB_URL` (con la contraseña adentro).
   - `NEXT_PUBLIC_DOMINIO_BASE` y `NEXT_PUBLIC_DOMINIO_PLATAFORMA`: el
     dominio del paso 3. Si todavía no lo tenés, dejá `localhost`.
3. Aplicar las migraciones. **Nunca pegarlas en el editor SQL de
   Supabase**: rompe los acentos.

```bash
npm run db:prevuelo     # las corre en una transacción que se revierte
npm run db:aplicar      # ahora sí
npm run chequeos        # las reglas del proyecto, contra la base real
npx supabase login      # una sola vez
npm run db:types
```

**LISTO SI:** `npm run chequeos` dice "Todo en verde".

---

## Paso 3 · Dominio y Vercel (15 min)

1. **Dominio.** Comprarlo en Vercel (Domains → Buy) es lo más simple: el
   DNS queda en Vercel solo. Hace falta para los subdominios: Vercel no
   permite `*.vercel.app`.
2. vercel.com → Add New → Project → Import `gym-os` desde GitHub.
   Framework: Next.js (lo detecta solo).
3. **Antes del primer deploy**, en Environment Variables:

| Variable | Entornos |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | Production |
| `NEXT_PUBLIC_DOMINIO_BASE` | Production, Preview, Development |
| `NEXT_PUBLIC_DOMINIO_PLATAFORMA` | Production, Preview, Development |

   `NEXT_PUBLIC_*` se graba en el build: si la cambiás después, hay que
   **redeployar**.
4. Deploy.
5. Settings → Domains: agregar los tres.
   ```
   midominio.com
   www.midominio.com
   *.midominio.com
   ```
   El comodín necesita que el dominio use los nameservers de Vercel (si
   lo compraste ahí, ya los usa).

**LISTO SI:** `https://midominio.com` muestra la página de Gym OS.

---

## Paso 4 · Los gimnasios demo (5 min)

```bash
node scripts/datos/sembrar-demo.mjs --dominio midominio.com
```

Crea dos gimnasios con datos obviamente ficticios y sus landings.

**LISTO SI:**
- `https://demo.midominio.com` → landing verde del Gimnasio Demo
- `https://demo-box.midominio.com` → landing violeta del Box Norte Demo
- `https://cualquiera.midominio.com` → "No encontramos este gimnasio"

---

## Después

Desde acá trabaja Claude Code en tu compu, sobre este repo, sección por
sección de `docs/PLAN.md`. `CLAUDE.md` le dice cómo.

Cuando cargues el **primer gimnasio real**: crear el archivo
`.claude/BASE_CON_DATOS_REALES`. Desde ese momento el agente escribe
las migraciones y vos las corrés.
