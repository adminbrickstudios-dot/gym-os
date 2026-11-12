# El ensayo antes de producción (N0 y H5)

Temple Gym ya cobra con Base. Probar una migración directo en producción es apostar la plata del cliente. El orden es:

```
migración nueva → ENSAYO (otra base, sin datos reales) → se prueba con la vista previa → recién después PRODUCCIÓN
                                                                                          (copia cifrada previa incluida)
```

## Qué hay armado

| Pieza | Qué hace | Estado |
|---|---|---|
| `.github/workflows/ensayo.yml` (Actions → **Ensayo**) | Aplica las migraciones a la base de ENSAYO (`prevuelo`, `aplicar` o `chequeos`). Usa **solo** `SUPABASE_ENSAYO_DB_URL`. Falla con los pasos si el secreto falta, y se frena si apunta al mismo servidor que producción. | listo; ⛔ falta la base de ensayo |
| `.github/workflows/base-de-datos.yml` → `aplicar` | Producción. **Antes** de aplicar hace la copia cifrada de la base (`COPIA_CLAVE`, ver `docs/base/COPIAS.md`) y la guarda 30 días; sin `COPIA_CLAVE` **no se aplica nada**. Después: pre-vuelo, aplicar y chequeos. | hecho (H5) |
| `.github/workflows/copias.yml` | Copia diaria cifrada y restauración de prueba en una base descartable. | hecho (C8) |

## Pasos para Mateo (una sola vez, 5 minutos) ⛔

1. supabase.com → **New project** → nombre `ensayo`, plan gratis, la misma región que el de producción. Guardá la contraseña
   de la base en tu gestor.
2. En ese proyecto: **Project Settings → Database → Connection string** (la de *Session pooler*, puerto 5432). Reemplazá
   `[YOUR-PASSWORD]` por la contraseña.
3. GitHub → el repo → **Settings → Secrets and variables → Actions → pestaña Secrets → New repository secret**: nombre
   `SUPABASE_ENSAYO_DB_URL` (exacto), valor la dirección del paso 2. **En Secrets, no en Variables** (las variables se ven).
4. Actions → **Ensayo** → Run workflow → `prevuelo`. Tiene que quedar verde. Después `aplicar`: deja la base de ensayo al día
   y corre los chequeos.
5. (Opcional, para probar la app contra el ensayo) en Vercel, para el entorno *Preview*, apuntá `NEXT_PUBLIC_SUPABASE_URL`,
   la clave `anon` y la `service_role` al proyecto `ensayo`. La producción no se toca.

El agente **no** crea proyectos de Supabase ni carga secretos.

## Cómo se publica una migración, desde ahora

1. El agente escribe la migración y corre el pre-vuelo en la base local de Actions.
2. **Ensayo → aplicar** (rama del día/noche). Si falla, se arregla antes de tocar producción.
3. Se prueba la pantalla con la vista previa de Vercel apuntando al ensayo, y con el recorrido en modo mirar
   (`docs/base/RECOMENDACIONES.md`, punto 7: el workflow **Botones Temple**).
4. **Base de datos → aplicar** en producción: copia cifrada, pre-vuelo, aplicar, chequeos. Recién entonces se mergea el PR.

## Lo que el ensayo no cubre

- No tiene los datos reales de Temple Gym: una migración que falla solo con datos reales (un `not null` sobre una columna
  con filas viejas, por ejemplo) no se ve ahí. Por eso las migraciones son siempre aditivas (nullable → backfill → not null)
  y por eso existe la copia previa.
- El ensayo es un proyecto aparte: sus logins y archivos son propios. Sirve para el esquema, las funciones y los permisos.
