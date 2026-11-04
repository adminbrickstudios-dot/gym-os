---
name: manana
description: Resumen de lo que hizo la noche en Gym OS y qué tiene que hacer Mateo para publicarlo. Usar cuando Mateo dice "qué hizo la noche", "buen día", "resumen de la noche" o /manana.
---

# Lo que hizo la noche

1. Buscá la carpeta más nueva en `.local/noche/` (una por fecha) y leé `resumen.txt` y `pr.md`.
2. `git fetch origin` y `git log --oneline origin/main..origin/noche/<fecha>`; leé las entradas de esa fecha en `docs/LOG.md` (en la rama de la noche).
3. Corré `node scripts/noche/pendientes.mjs` sobre la rama de la noche (`git show origin/noche/<fecha>:docs/HOJA-DE-RUTA.md` si no estás en ella).
4. Contale a Mateo, corto y sin adornar:
   - **Qué quedó hecho**, por ítem, con cómo se verificó. Ofrecé mostrar capturas (`.local/capturas/`).
   - **Qué quedó trabado** y por qué.
   - **Lo que encontró sin que se lo pidieran.**
   - **Lo que no se pudo verificar**, textual.
   - **Qué decisiones están esperando** (las 🟡 sin ✅).
5. Decile qué hace él, en orden:
   - Si hay migraciones nuevas: GitHub → Actions → Base de datos → Run workflow → elegir la rama `noche/<fecha>` → `prevuelo`; si sale verde, otra vez con `aplicar`.
   - Mergear el PR "Noche <fecha>" (Vercel publica solo).
   - Si quiere, abrir el panel con `/panel <nombre>` para revisar algo puntual.
