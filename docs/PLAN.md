# Gym OS — Plan

> **Propuesta del agente.** Se reconcilia con `7-PLAN.md` (las 17
> secciones de Mateo) cuando esté en el repo. Si choca, manda el de Mateo.
> Una casilla se marca solo con la definición de TERMINADO de `CLAUDE.md`.

## S0 · Arranque — paso a paso en `docs/ARRANQUE.md`
- [ ] Repo en GitHub (privado) y push
- [ ] Proyecto Supabase en São Paulo, contraseña solo letras y números
- [ ] Dominio comprado
- [ ] Vercel enlazado, dominio raíz + www + comodín
- [ ] Variables en Vercel y primer deploy
**LISTO SI:** el dominio raíz responde la página de Gym OS.

## S1 · Núcleo del schema y cálculo de acceso
- [x] Migraciones 0001–0007 con RLS, FK compuestas y verificación final
- [x] `calcular_acceso` por vías + `registrar_ingreso` idempotente con lock (probado con dos conexiones)
- [x] Congelamiento, descongelamiento y cierre con compensación recalculada por trigger
- [x] 21 casos testigo compartidos entre seed y pruebas; 80 pruebas de base
- [x] Revisión independiente: 17 errores confirmados, todos corregidos con prueba de regresión
- [x] `npm run chequeos`
- [ ] Aplicado en el Supabase real (pre-vuelo + aplicar + `db:types`)
**LISTO SI:** `npm run chequeos` en verde contra la base de Supabase
(las pruebas corren solo en la base local: se niegan a tocar Supabase).

## S2 · Multi-tenant y equipo
- [x] Middleware host → gimnasio, sin fallback (probado con un PostgREST mínimo local)
- [ ] Login del equipo con `@supabase/ssr` (mail + link, Google opcional)
- [ ] Invitar al equipo; PIN por persona en la PC de recepción
- [ ] Layout por gimnasio: título, favicon y colores desde sus datos
**LISTO SI:** un usuario de otro gimnasio recibe error, no lista vacía,
probado con sesión real.

## S3 · Configuración y marca
## S4 · Planes y precios (precio por medio, por día, aumentos programados)
## S5 · Socios e importador (duplicados, deshacer)
## S6 · Entrada — LISTO SI: con 3.000 socios, ingreso en < 2 s de punta a punta
## S7 · Vender, cobrar, caja (comprobante de transferencia, arqueo ciego)
- [x] Base: precio por lista, períodos con ancla, `cobrar_cuota`, `anular_venta`, cambio de plan y baja
- [ ] Pase y pack en el mostrador, comprobante de transferencia, caja con arqueo ciego, pantallas
## S8 · Retención (cálculo por lotes, socios nuevos, plata en riesgo)
## S9 · Clases y reservas (lista de espera, cierres)
## S10 · App del socio (teléfono + código con límite, QR rotativo, pagar)
## S11 · Rutinas
## S12 · MercadoPago del gimnasio (OAuth con renovación del refresh token, webhook firmado e idempotente)
## S13 · Página pública y alta online
- [x] Landing por gimnasio desde la base: portada, 8 secciones editables y reordenables, planes y precios, sedes (migración 0008)
- [x] Marca por gimnasio: colores, logo, favicon y título de la pestaña
- [x] Probada con capturas en celular y compu, con dos gimnasios de marcas distintas
- [ ] Editor de la landing en el panel del dueño (necesita S2: login)
- [ ] Clase de prueba y alta online desde la landing
## S14 · Automatizaciones y resumen diario al dueño
## S15 · Plataforma BRIK (alta, suscripción, suspensión gradual, salud del cliente)
## S16 · Legal, exportación, primeros pasos
## S17 · Endurecer (entrada sin internet, rendimiento, auditoría)

El catálogo completo de funciones por versión está en el doc
"Gym OS — Catálogo de funciones" (claude.ai).
