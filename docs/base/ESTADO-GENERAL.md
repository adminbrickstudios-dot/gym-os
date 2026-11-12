# ESTADO GENERAL de Base (revisión de todo lo viejo, 11/11)

Revisión hecha por zona y por rol, leyendo cada función contra el código vigente y los recorridos de Actions. El detalle (función, rol, prueba, estado) está en:
- `docs/base/estado/mostrador.md` — Entrada, Caja, Vender, Socios, Interesados, Clases en recepción, Retención, Mensajes.
- `docs/base/estado/dueno-super.md` — Inicio del dueño, Resultado, Control, Equipo, Configuración, Página, asistente, Planes, super admin.
- `docs/base/estado/socio-profe-publico.md` — app del socio, profe, kiosco, TV, páginas públicas, notificaciones.

Los MD viejos que se contradecían con `docs/base/` quedaron marcados "reemplazado por docs/base/…" (docs/v2/01, 02, 03, 04, 05, 06, 10 y docs/producto/paneles/socio.md y pagina.md). `FALTANTES.md` está desactualizado: FA-14, FA-15, FA-16 y FA-18 existen en el código (sin prueba propia salvo lo indicado en la zona socio).

## 1. Hecho y publicado (en `main` y en producción)
Todo lo de la fase U, P y C1/C2/aviso al socio (PR #14 y #15) y lo construido antes (Gym OS v2): ver las tablas "Hecho y publicado" de cada zona (86 funciones entre las tres: 32 del mostrador, 26 del dueño y super admin, 28 del socio y público). Prueba: el e2e o la prueba de base que nombra cada fila.

## 2. Hecho sin publicar (en `base/2026-11-07`, rama `publicar/base-hoy`; migraciones 20261111120000 a 164237)
Esperando `COPIA_CLAVE` de Mateo (ver PROGRESO.md). Con su prueba:
| Función | Prueba |
|---|---|
| Caja por medio, Transferencias en dos pestañas y tilde "ya la vi en el banco" (H1) | `caja-medios` 49 pasos (43122146047) + prueba de base `caja-medios.test.mjs` |
| `/g/<slug>/hacete-socio` y camino del socio completo (H3, H3b) | `hacete-socio-directo` 12, `socio-flujo` 26, `reg-1` 12 (43120082906) |
| Lo roto de PULIDO que pega hoy (H7, parcial) | `pulido-roto` 18, `panel-equipo` 8 |
| Cargar socios y pagos en el pasado (C10) | prueba de base `cargar-pasado.test.mjs` 9/9; e2e `cargar-pasado` en rojo (en `carril/c-pasado2`) |
| QR para registrarse y cartel "Anotate acá" (C9) | `qr-alta` 18 (43101166763) |
| Lector USB, cambio de persona y cierre por inactividad (C5/C6) | `recepcion-lector` 15 (43043466593) |
| Guías por rol y carteles (C3/C4/C7) | `guias-carteles` 57 |
| `filtros_socios` en lote (52 ms a 5.000 socios) | `filtros-en-lote.test.mjs` (cero diferencias en 7.440 veredictos), `escala-5000` |
| Importar con "pagó hasta" como cobertura (C2) | `importar-300` 14 |
| Revisiones: vd-6 por causa raíz, caché pública al toque, Equipo, alta de gimnasio, app del socio | `vd-6` 20, `rev-dueno-1`, `rev-socio` 12, `ent-1`, `ent-2` |

## 3. Falta
Ver la tabla "Falta" de cada zona. Lo que repite en las tres:
- **Plata y permisos decididos por defecto, sin arreglar** (opción más segura en `PREGUNTAS.md`): Cobrar que se cierra mientras cobra, cerrar caja sin confirmación, aprobar transferencia sin comparar monto, vuelto en efectivo, pase diario para no socio, cambiar un rol de un toque, reconocer al soporte por el nombre, `crearPlan`, gastos sin Deshacer, "clase ajena" del profe por nombre.
- **Necesita migración, sin escribir:** exportar socios con filtros; `equipo.es_soporte`.
- **Sin cron, sin disparador:** avisos por hora (FA-12), plazo del lugar de la lista de espera (FA-23).
- **Falta de producto:** términos del servicio (FA-19), panel lateral con cuándo toca pagar (FA-1), Interesado sin contactar en 24 h (FA-13), borrador del alta (FA-17), Retención con "Avisar a todos", Tareas sin editar, campana en vivo, tablero del super admin sin menú, TV en Realtime.
- **Bloqueado por Mateo (⛔):** secretos de GitHub (`COPIA_CLAVE`, `BRIK_ADMIN_MAIL`, `BRIK_ADMIN_CLAVE`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_CONTRASENA`), clave `service_role` en Vercel, dominio y `VERCEL_TOKEN`, segundo proyecto de Supabase "ensayo", factura electrónica.
- **En curso:** pulido Z2-Z7 (`carril/z-iconos-textos`, `carril/z-diseno-falta`), H4/H6/N0/F6.1 (`carril/h-resto`), y el cierre F8 (botones + barrido en los 6 roles, simulación completa, humo).
