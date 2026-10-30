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
- [x] Segunda revisión (0009–0011): 21 errores confirmados, todos corregidos con prueba de regresión
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
- [x] Carrito del mostrador (cuota, pase, pack, producto, otro) con pagos mixtos, tope de descuento para la recepción (migración 0009)
- [x] Caja por turno con arqueo ciego: la recepción no puede reconstruir lo esperado; devolución de efectivo de una caja cerrada sale de la abierta
- [x] Comprobante de transferencia: el socio informa, el equipo aprueba o rechaza; nadie aprueba su propio pago; un comprobante no se usa dos veces
- [x] Carreras probadas con dos conexiones: venta en efectivo contra cierre de caja
- [ ] Pantallas (esperan el diseño)
## S8 · Retención (cálculo por lotes, socios nuevos, plata en riesgo)
- [x] Una consulta para todo el gimnasio: vencido, por vencer, nuevo, no viene, se fue, con el porqué y el mensaje armado (migración 0010)
- [x] Vencidos con el mismo texto y la misma deuda que la puerta (`via_membresia`), incluye los que nunca pagaron y los que cambiaron de plan
- [x] Plantillas de mensaje editables y registro de contactos
- [x] 3.000 socios en 0,5 s (medido, con estadísticas al día)
- [ ] Pantallas (esperan el diseño)
## S9 · Clases y reservas (lista de espera, cierres)
- [x] Actividades, grilla semanal, clases creadas a demanda, reservas con cupo y lock, lista de espera que saltea a quien no puede entrar (migración 0011)
- [x] Cierre cargado después cancela las clases y avisa; anularlo las devuelve. Cerrar un horario cancela sus clases futuras
- [x] Packs: respetan sus actividades, no se descuentan si la membresía cubre, no se reservan más clases que las que quedan
- [x] Presente con ventana horaria, chequeo de habilitación y anulación que devuelve la clase; carrera de dos presentes con un pack de 1 probada
- [ ] Pantallas (esperan el diseño)
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
