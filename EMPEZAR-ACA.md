# Empezar acá — Gym OS en tu compu

Esta carpeta es el repo de Gym OS completo (con su historia de git y conectado
a GitHub). Se trabaja con Claude Code abierto en esta carpeta.

## 1. Una sola vez: lo que tiene que estar instalado

Abrí **PowerShell** (tecla Windows → "PowerShell").

| Qué | Cómo se fija | Si falta |
|---|---|---|
| Node 22 o más | `node -v` | https://nodejs.org (la versión LTS) |
| Git | `git --version` | https://git-scm.com/downloads/win |
| Claude Code | `claude --version` | `irm https://claude.ai/install.ps1 \| iex` |

## 2. Una sola vez: preparar la carpeta

Dentro de esta carpeta (`proyectos\gym-os`), en PowerShell:

```powershell
cd $HOME\proyectos\gym-os
npm install
npx vercel link          # elegí el proyecto gym-os
npx vercel env pull .env.local
```

`vercel env pull` trae las variables de Vercel a `.env.local` sin pegar ninguna
clave en ningún chat. Ese archivo no se sube a GitHub.

Después abrí `.env.local` y cambiá estas dos líneas para que la compu sea "la
plataforma":

```
NEXT_PUBLIC_DOMINIO_BASE=localhost
NEXT_PUBLIC_DOMINIO_PLATAFORMA=localhost
```

⚠️ Con esto, la app de tu compu usa **la base de producción** (la del cliente).
Para probar, usá siempre el gimnasio demo.

## 3. Cada vez que trabajás

```powershell
cd $HOME\proyectos\gym-os
git pull
claude
```

Claude Code lee solo el `CLAUDE.md` y `docs/` (reglas, schema, hoja de ruta).
Le hablás normal: "vamos con el panel de socios", "esto quiero que sea así".

Para ver la app mientras trabajan, en **otra** PowerShell:

```powershell
cd $HOME\proyectos\gym-os
npm run dev
```

y abrí http://localhost:3000/g/demo → después http://localhost:3000/ingresar
con tu mail de super admin → /admin → Gimnasio demo → **Entrar al panel**.

## 4. Cómo se publica

1. Se trabaja en una rama del día (`dia/<fecha>`), nunca en `main`.
2. Claude Code hace commit y push de esa rama.
3. Si hay migraciones nuevas: GitHub → Actions → **Base de datos** → esa rama
   → `prevuelo`, después `aplicar`.
4. Recién después: el PR de esa rama → **Merge**. Vercel publica solo.

## Links

- App: https://gym-os-pied.vercel.app
- Super admin: https://gym-os-pied.vercel.app/admin
- Demo: https://gym-os-pied.vercel.app/g/demo
- GitHub: https://github.com/adminbrickstudios-dot/gym-os
- Actions (base de datos): https://github.com/adminbrickstudios-dot/gym-os/actions/workflows/base-de-datos.yml
