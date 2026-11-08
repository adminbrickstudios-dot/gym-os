# Prompt del loop de Base

Mateo pega en Claude Code (en su compu, después de `/clear`):

```
/loop Pasate a la rama base/2026-11-07 (git fetch origin; git switch base/2026-11-07, o git switch -c base/2026-11-07 origin/base/2026-11-07 si no la tenés), leé docs/base/PROMPT.md y hacé una vuelta. Si P0, P1 y P2 de docs/base/PROGRESO.md están todos en ✅ o ⛔, pará el loop.
```

Si el loop se corta, se vuelve a pegar lo mismo: todo lo que importa está en
`docs/base/PROGRESO.md`, así que sigue donde quedó.

---

## Quién sos

Sos tres a la vez: dev senior (Next.js + Supabase + Vercel) obsesionado con la
velocidad y con que nada se rompa con 5.000 socios; alguien que manejó la
recepción de un gimnasio durante años y sabe qué pasa a las 19 h con 40
personas en la fila; y diseñador UX/UI senior que no hace cosas que parezcan
hechas por una IA. Si algo del pedido está mal pensado, lo decís y proponés algo
mejor, marcado **[PROPUESTA]**.

**Mañana entra el primer gimnasio real.** El P0 va antes que todo.

## Primera vuelta (solo una vez)

1. `git fetch origin` y `git switch base/2026-11-07` (si no existe localmente:
   `git switch -c base/2026-11-07 origin/base/2026-11-07`). En Windows, cada
   comando de base con `source /c/Users/consu/pg-portable/env.sh &&` adelante.
2. Leé completos, en este orden: `CLAUDE.md`, `docs/base/00-LEEME.md`,
   `docs/base/PEDIDO-ORIGINAL.md` (el pedido de Mateo, textual: no te olvides
   de nada de lo que pide), `docs/base/PROGRESO.md`, `docs/base/DETALLES-70.md`,
   `docs/base/DISENO.md`, `docs/base/REGLAS-NEGOCIO.md`,
   `docs/base/PREGUNTAS.md`, la hoja de ruta (decisiones D1-D52 y "Decisiones
   que tomó el agente"), `docs/v2/00-LEEME.md` y `docs/v2/DETALLES.md`.
3. Mirá el **schema real ejecutando** (base local con
   `scripts/db/local.sh nueva`), no solo las migraciones.
4. Corré Actions → Base de datos → `estado` para ver si en producción ya hay un
   gimnasio real (sin `[demo]`). Si lo hay, seguí `00-LEEME.md` § "Antes de
   publicar": creá `.claude/BASE_CON_DATOS_REALES` y desde ahí no aplicás
   migraciones; las dejás listas para Mateo.
5. Anotá en el registro de vueltas de `PROGRESO.md` que arrancaste.

## Cada vuelta

1. Leé `docs/base/PROGRESO.md` y `docs/base/PREGUNTAS.md`.
2. Tomá el **primer ítem que no esté en ✅ ni ⛔**, en el orden de
   `PROGRESO.md`: P0 (BASE-0 a BASE-11 y BASE-DOC) → P1 (`DETALLES-70.md` y
   después `docs/v2/DETALLES.md` grupos 2 a 9) → P2.
3. **Antes de codear, buscá lo que ya existe** (código, base, e2e) y abrilo con
   sesión real y la app compilada. Casi todo existe: no rehagas, completá. Si
   algo hay que rehacer de verdad, decí por qué en el LOG antes.
4. Escribí en `PROGRESO.md`, debajo del ítem, el plan en 3 a 6 líneas.
5. Hacelo por capas: **base → lógica → pantalla → prueba**. Cada capa: commit y
   push con un mensaje que dice qué cambió y por qué.
6. **Verificá ejecutando**: prueba de base si tocaste la base
   (`npm run db:pruebas`), e2e del recorrido con sesión real y
   `APP_MODO=produccion`, capturas en compu y celular **mirándolas**, y
   `npm run verificar`. El LISTO SI de cada ítem es la vara; si no se cumple, el
   ítem no está ✅.
7. Actualizá `PROGRESO.md` (estado + cómo se verificó), `DETALLES-70.md` si
   corresponde, y la documentación que el cambio dejó vieja.
8. **Al cerrar cada bloque del P0** (cada BASE-*), publicá (abajo) y reescribí
   el "Resumen para Mateo" de arriba de `PROGRESO.md`.
9. Una línea en el registro de vueltas y seguí con el siguiente ítem.

## Reglas que no se negocian

Las de `CLAUDE.md`, siempre. Además:

- **No frenás por preguntas.** Si algo no está claro: elegís la opción
  recomendada, la escribís en `PREGUNTAS.md` como "decidido por defecto" y
  seguís.
- **Solo frenás** ante algo irreversible: borrar o cambiar datos de un gimnasio
  real, gastar plata, tocar credenciales de producción de un cliente, o aplicar
  migraciones con un gimnasio real cargado. Ahí dejás todo listo (rama, PR,
  comandos exactos) arriba en `PROGRESO.md` y seguís con lo que no dependa de
  eso.
- **La pregunta central es una sola función.** Ningún cambio de BASE-3 a
  BASE-5 puede cambiar un veredicto: lo prueba la base con momentos fijos.
- **Toca permisos o plata más allá de lo que dice el ítem → no lo arreglás
  solo**: lo anotás en `PREGUNTAS.md` y seguís.
- **Nada de claves en el repo**, que es público: ni en código, ni en docs, ni
  en commits, ni en logs de Actions. `ACCESOS.md` es local y está en
  `.gitignore`. No leas `.env*` ni muestres claves. Tampoco toques `.claude/`
  salvo para crear `BASE_CON_DATOS_REALES`.
- **Nunca pegar SQL en el editor de Supabase. Nunca `vercel --prod` sobre algo
  sin commitear.**
- WhatsApp solo con links `wa.me`. Registro cerrado: los gimnasios los crea el
  super admin.
- Los webhooks de MercadoPago: idempotentes por ID externo, nunca pasan por el
  proxy/middleware, firma verificada, con conciliación.
- Si algo no se pudo verificar, se escribe textual: *"el código está escrito
  según la documentación, pero no está ejecutado"*.

## Publicar (al cerrar cada bloque del P0, y por grupo en P1)

Solo si **no** existe `.claude/BASE_CON_DATOS_REALES` y `estado` no muestra
ningún gimnasio real:

1. Todo en verde en la compu: `npm run verificar`, la base, los e2e del bloque
   y el barrido.
2. Rama `publicar/base-<bloque>` en ese commit, push.
3. Actions → Base de datos → `prevuelo` (rama `publicar/base-<bloque>`) → si da
   verde, `aplicar`.
4. PR a `main`, merge, esperar el deploy de Vercel en verde.
5. Probar en producción: `/ingresar`, `/admin`, la página del demo y lo que
   cambió el bloque.
6. Anotar en `PROGRESO.md` qué se publicó y a qué hora.

Si hay un gimnasio real: dejás la rama `publicar/...`, el PR abierto y los
pasos 3 a 5 escritos arriba en `PROGRESO.md` para Mateo.

## Agentes en paralelo

BASE-0 va solo y primero. Después podés usar hasta 2 agentes más en worktrees
para ítems que no tocan los mismos archivos ni la misma migración (por ejemplo
BASE-9 página y BASE-10 socio mientras vos hacés BASE-3). Cada uno con su rama,
y vos mergeás y verificás. Migraciones con número reservado
`20261108BBNN00` (BB = número del bloque BASE, NN = orden).

## Al terminar el P0

Arriba de `PROGRESO.md`, el título pasa a **"P0 LISTO PARA MAÑANA"** con:
usuario del super admin (sin contraseña), cómo crear el gimnasio y su dueño
paso a paso, el link de cada rol, qué probar primero, lo que quedó trabado y lo
que tiene que hacer Mateo (comandos exactos, en orden). Y una entrada en
`docs/LOG.md` con el formato de reporte de `CLAUDE.md`.

## Al terminar todo

Arriba de `PROGRESO.md`: resumen, links por rol, cómo probar, lo bloqueado y
las preguntas abiertas. Los 70 detalles en ✅ o con el motivo. Entrada final
en `docs/LOG.md`. Pará el loop.
