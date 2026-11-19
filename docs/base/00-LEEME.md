# Pase: índice de `docs/base/` (una pantalla)

**El producto se llama Pase (D69).** El repo y el código siguen diciendo gym-os. Reglas de trabajo: `CLAUDE.md` (raíz). Si algo de acá choca con `docs/v2/`, gana `docs/base/`.

## Leer en este orden
1. `PASE-1.0.md`: lo que manda hoy. Pase 1.0 cerrado, y "Para Pase 2.0" (lo que sigue, en orden).
2. `PROGRESO.md`: arriba "DÓNDE QUEDÉ" y el resumen para Mateo; abajo el detalle de cada BASE-*.
3. `CAMBIOS-MATEO.md`: lo que Mateo pide; es lo primero de cada vuelta. `PROMPT.md`: cómo trabaja el loop.
4. `RECTA-FINAL.md`: la lista por ítem con su LISTO SI. `ESTADO-GENERAL.md`: el mapa de todo lo que hay, por panel.
5. `PREGUNTAS.md`: las decisiones (gana la más nueva). `REGLAS-NEGOCIO.md` y `PERMISOS.md` (sacado de la base real: `node scripts/datos/permisos-md.mjs`).
6. `DISENO.md`: el diseño (§ Pase 2.0 = Pista; los tokens y los desvíos); `pista/` trae las muestras visuales.
7. `PRUEBA-DUENO.md`: la pasada de Mateo.

## Por tema (cuando toca)
- Velocidad y fluidez: `VELOCIDAD.md` (números y topes), `FLUIDEZ.md` (las reglas), `FLUIDEZ-PANTALLAS.md`.
- Plataforma: `PLATAFORMA.md`, `DOMINIO.md`, `SUPER-ADMIN.md`, `COPIAS.md`, `ENSAYO.md` (probar migraciones antes de producción), `ESCALA.md`, `PREVENCION.md` (qué se rompe y la hora pico).
- Camino del socio: `SOCIO-FLUJO.md`, `PRIMER-DIA.md` (la guía del dueño).
- Diseñado y todavía apagado: `DEBITO-AUTOMATICO.md`, `FACTURA-ARCA.md`, `MOLINETE-API.md`.
- Método: `PENSAR.md` (las 5 preguntas antes de cada bloque), `REPARTO.md` (carriles), `DETALLES-70.md`.

## Historia (`historia/`: ya hecho, sirve de registro; no se reescribe)
`LEEME-0711.md` (el índice y las decisiones D36–D52 del 07/11), `PEDIDO-ORIGINAL.md`, `AJUSTES-0911-NOCHE.md`, `NOCHE-1211.md`, `LANDING-SOCIO-1411.md`, `DIAGNOSTICO-BASE0.md`, `PULIDO.md`, `FALTANTES.md`, `RECOMENDACIONES.md`, `INVESTIGACION.md`, `CONTEXTO.md`, `PLAN.md` (el plan original) y `DISENO-v2.md` (el diseño de Gym OS v2, reemplazado por `DISENO.md`).

## Fuera de esta carpeta
`docs/LECCIONES.md`, `docs/CONVENCIONES.md`, `docs/SCHEMA.md` (los busca `CLAUDE.md`), `docs/HOJA-DE-RUTA.md` (la cola de la noche: la lee `scripts/noche/pendientes.mjs`, por eso no se movió), `docs/LOG.md` (el registro de cada vuelta), `docs/CLAUDE-CODE.md` (cómo trabaja Mateo con Claude Code).
