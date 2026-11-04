---
name: panel
description: Revisar un panel de Gym OS con Mateo — abrirlo con sesión real, mostrar cómo está, proponer cambios desde la hoja de ruta y lo que se vea, preguntar lo que es de él y hacer lo aprobado. Usar cuando Mateo dice "vamos con el panel X", "revisemos X" o /panel X.
---

# Revisar un panel con Mateo

Mateo decide; vos mostrás, proponés y hacés. Hablale en castellano rioplatense, corto.

## 1. Ubicar el panel
- Paneles: Inicio · Entrada · Socios · Vender · Caja · Transferencias · Vencen hoy · Retención · Clases · Planes · Equipo · Configuración · Resultado · App del socio · Página del gimnasio · Super admin · Ingresar.
- Buscá en `docs/HOJA-DE-RUTA.md` todos los ítems de ese panel (su DIS-n y los de su sigla) y las decisiones que lo tocan.

## 2. Mirarlo de verdad
- `scripts/local/levantar.sh` (o `nueva` si la base está vieja).
- Con `scripts/e2e/comun.mjs`, abrilo con cada rol que lo usa (dueña, encargado, recepción, profe, socio o admin), en compu y en celular, con datos y vacío. Capturas en `.local/capturas/panel-<nombre>-*.jpg` y miralas con Read.

## 3. Proponer
Mostrale a Mateo, en este orden y breve:
1. Cómo está hoy (2-3 líneas y las capturas más útiles con SendUserFile si está disponible, si no la ruta).
2. Lo que propongo, en una lista numerada: lo de la hoja de ruta + lo que viste (pensando como dueño de cada tipo de gimnasio: barrio, cadena, box, yoga/pilates, artes marciales, natación, personal, 24 h). Cada punto: qué cambia y para qué le sirve al dueño o al socio.
3. Las preguntas que son suyas (permisos, plata, cosas de negocio), con AskUserQuestion, máximo 4, con tu recomendación primero.

## 4. Anotar
- Lo que aprueba va a `docs/HOJA-DE-RUTA.md`: ítems nuevos o cambiados (con LISTO SI), orden en la COLA, ✅ en las decisiones que confirme.
- Lo que no aprueba, no se anota.

## 5. Hacer (si Mateo dice "dale" o "hacelo ahora")
- Trabajá en una rama `dia/<fecha>` (nunca en `main`) y seguí los pasos 4 a 8 de `scripts/noche/PROMPT.md` por cada ítem: base → pantalla → probar ejecutando → marcar `[x]` → LOG → commit → push.
- Al final, mostrale capturas del antes y el después, y decile qué tiene que correr él (migraciones nuevas → Actions → Base de datos con la rama → prevuelo → aplicar → mergear el PR).
