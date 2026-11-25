# Pase: índice de `docs/base/` (una pantalla)

**Qué es.** Pase es el sistema de gestión de gimnasios de BRIK: la puerta ("¿este socio puede entrar hoy?", calculado por la base),
el cobro y la caja, la app del socio, las clases, la retención, la página de cada gimnasio y el super admin. Multi-gimnasio, en
Next.js + Supabase + Vercel. El repo y el código siguen diciendo gym-os (D69). Reglas de trabajo: `CLAUDE.md` (raíz). Si algo choca
con `docs/v2/`, gana `docs/base/`.

**Cómo está hoy (22/11).**
1. Pase 1.0 cerrado y en producción; Temple Gym lo usa todos los días (templegymsalta.com), ya con el estilo **Pista** prendido.
2. Paneles completos por rol publicados (PR #38). Pista publicada (PR #35 y #37); el estilo clásico se borra desde el 26/11.
3. Vuelta final (22/11): caza de errores, seguridad (gitleaks, secretos, cabeceras, cookies, webhook), la página nueva del gimnasio
   (`landing_nueva`) y la página de venta de Pase (`landing_venta_nueva`), las dos armadas y apagadas para los reales.
4. Lo que falta es de Mateo: `PASE-1.0.md` § **Lo de Mateo** (la copia de la base no corre desde el 18/11: falta `COPIA_CLAVE`).
5. Lo que sigue después: `PASE-1.0.md` § Para Pase 2.0 (borrar el clásico, profesionalización).

## Leer en este orden
1. `PASE-1.0.md`: lo que manda. **Lo de Mateo** (por urgencia) y Para Pase 2.0 (en orden).
2. `CAMBIOS-MATEO.md`: lo que Mateo pide; es lo primero de cada vuelta. `PROMPT.md`: cómo trabaja el loop.
3. `PROGRESO.md`: arriba lo último y cómo volver atrás; abajo el detalle de cada BASE-*.
4. `RECTA-FINAL.md` (la lista por ítem con su LISTO SI) y `ESTADO-GENERAL.md` (el mapa de todo, por panel y por rol).
5. `PREGUNTAS.md`: las decisiones (gana la más nueva). `REGLAS-NEGOCIO.md` y `PERMISOS.md` (sale de la base: `node scripts/datos/permisos-md.mjs`).
6. `DISENO.md`: el diseño (§ Pase 2.0 = Pista, con los tokens; los dibujos de la página en `src/components/ilustraciones/`).
7. `PRUEBA-DUENO.md`: la pasada de Mateo.

## Qué es de Mateo
Secretos y variables de GitHub, Supabase Pro y Vercel Pro, prender las llaves en Temple Gym, lo 💲 (plata y permisos), los textos
legales y su pasada visual. Todo en `PASE-1.0.md` § Lo de Mateo, cada punto con la recomendación.

## Por tema (cuando toca)
- Velocidad y fluidez: `VELOCIDAD.md` (números y topes), `FLUIDEZ.md` (las reglas), `FLUIDEZ-PANTALLAS.md`.
- Plataforma: `PLATAFORMA.md`, `DOMINIO.md`, `SUPER-ADMIN.md`, `COPIAS.md`, `ENSAYO.md` (probar migraciones antes de producción), `ESCALA.md`, `PREVENCION.md` (qué se rompe y la hora pico).
- Camino del socio: `SOCIO-FLUJO.md`, `PRIMER-DIA.md` (la guía del dueño).
- Diseñado y todavía apagado: `DEBITO-AUTOMATICO.md`, `FACTURA-ARCA.md`, `MOLINETE-API.md`.
- Método: `PENSAR.md` (las 5 preguntas antes de cada bloque), `REPARTO.md` (carriles), `DETALLES-70.md`.

## Historia (`historia/`: ya hecho, sirve de registro; no se reescribe)
`LEEME-0711.md`, `PEDIDO-ORIGINAL.md`, `AJUSTES-0911-NOCHE.md`, `NOCHE-1211.md`, `LANDING-SOCIO-1411.md`, `DIAGNOSTICO-BASE0.md`, `PULIDO.md`, `FALTANTES.md`, `RECOMENDACIONES.md`, `INVESTIGACION.md`, `CONTEXTO.md`, `PLAN.md` (el plan original) y `DISENO-v2.md`.

## Fuera de esta carpeta
`docs/LECCIONES.md`, `docs/CONVENCIONES.md`, `docs/SCHEMA.md` (los busca `CLAUDE.md`), `docs/HOJA-DE-RUTA.md` (la cola de la noche: la lee `scripts/noche/pendientes.mjs`), `docs/LOG.md` (el registro de cada vuelta), `docs/CLAUDE-CODE.md` (cómo trabaja Mateo con Claude Code).
