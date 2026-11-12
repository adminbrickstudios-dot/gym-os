> Reemplazado por docs/base/RECTA-FINAL.md (lo que se hace y en qué orden) y docs/base/ESTADO-GENERAL.md (qué está hecho y publicado). Esto queda como la historia de lo construido de Gym OS.

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
- [x] Login del equipo con `@supabase/ssr` (mail + contraseña), sesión renovada en el middleware, /panel /app /admin protegidos
- [x] Sumar al equipo con contraseña provisoria (o vincular la cuenta si ya tenía), roles, sacar acceso, cambiar la contraseña
- [ ] PIN por persona en la PC de recepción
- [x] Layout por gimnasio: título, favicon y colores desde sus datos; secciones apagadas desaparecen también por URL
- [x] Probado con sesión real (Playwright + supabase-local): otro gimnasio recibe "no tenés acceso", no una lista vacía
**LISTO SI:** un usuario de otro gimnasio recibe error, no lista vacía,
probado con sesión real.

## S3 · Configuración y marca
- [x] Marca (nombre, fondo, color principal con vista previa), qué se cobra, clases, reglas, transferencia, secciones (0013)
- [ ] Logo y fotos desde el panel (el bucket existe; falta la pantalla de subida)
## S4 · Planes y precios (precio por medio, por día, aumentos programados)
- [x] Crear planes (membresía, pase, pack), programar aumentos con fecha, dejar de vender, productos
- [ ] Precio por medio de pago y por día desde la pantalla (hoy: base y seed)
## S5 · Socios e importador (duplicados, deshacer)
- [x] Buscar con semáforo, alta y edición sin datos de salud, ficha con plan, packs, entradas y pagos, cambiar plan, baja con motivo
- [ ] Importador desde Excel (con `analyze` al terminar: sin estadísticas la retención tarda 11 s con 3.000 socios)
## S6 · Entrada — LISTO SI: con 3.000 socios, ingreso en < 2 s de punta a punta
- [x] Recepción: buscar, veredicto con el porqué, anotar, cobrar o dejar pasar con motivo, lista de hoy
- [ ] QR del socio, kiosco, molinete
## S7 · Vender, cobrar, caja (comprobante de transferencia, arqueo ciego)
- [x] Base: precio por lista, períodos con ancla, `cobrar_cuota`, `anular_venta`, cambio de plan y baja
- [x] Carrito del mostrador (cuota, pase, pack, producto, otro) con pagos mixtos, tope de descuento para la recepción (migración 0009)
- [x] Caja por turno con arqueo ciego: la recepción no puede reconstruir lo esperado; devolución de efectivo de una caja cerrada sale de la abierta
- [x] Comprobante de transferencia: el socio informa, el equipo aprueba o rechaza; nadie aprueba su propio pago; un comprobante no se usa dos veces
- [x] Carreras probadas con dos conexiones: venta en efectivo contra cierre de caja
- [x] Pantallas: vender, caja con arqueo ciego, transferencias (probado: abrir, cobrar, cerrar con diferencia)
## S8 · Retención (cálculo por lotes, socios nuevos, plata en riesgo)
- [x] Una consulta para todo el gimnasio: vencido, por vencer, nuevo, no viene, se fue, con el porqué y el mensaje armado (migración 0010)
- [x] Vencidos con el mismo texto y la misma deuda que la puerta (`via_membresia`), incluye los que nunca pagaron y los que cambiaron de plan
- [x] Plantillas de mensaje editables y registro de contactos
- [x] 3.000 socios en 0,5 s (medido, con estadísticas al día)
- [x] Pantallas: vencen hoy y retención con WhatsApp armado y "anotar contacto"
## S9 · Clases y reservas (lista de espera, cierres)
- [x] Actividades, grilla semanal, clases creadas a demanda, reservas con cupo y lock, lista de espera que saltea a quien no puede entrar (migración 0011)
- [x] Cierre cargado después cancela las clases y avisa; anularlo las devuelve. Cerrar un horario cancela sus clases futuras
- [x] Packs: respetan sus actividades, no se descuentan si la membresía cubre, no se reservan más clases que las que quedan
- [x] Presente con ventana horaria, chequeo de habilitación y anulación que devuelve la clase; carrera de dos presentes con un pack de 1 probada
- [x] Pantallas: día por día, lista con presente, cancelar; armar la grilla (0015)
## S10 · App del socio (teléfono + código con límite, QR rotativo, pagar)
- [x] Entrar con el celular y un código; el servidor vincula la cuenta a los socios del gimnasio (0017)
- [x] Estado, plan, packs, reservar y cancelar, pagar por transferencia subiendo el comprobante
- [ ] QR rotativo para entrar; límite de pedidos de código
## S11 · Rutinas
## S12 · MercadoPago del gimnasio (OAuth con renovación del refresh token, webhook firmado e idempotente)
## S13 · Página pública y alta online
- [x] Landing por gimnasio desde la base: portada, 8 secciones editables y reordenables, planes y precios, sedes (migración 0008)
- [x] Marca por gimnasio: colores, logo, favicon y título de la pestaña
- [x] Probada con capturas en celular y compu, con dos gimnasios de marcas distintas
- [ ] Editor de la landing en el panel del dueño (el login ya está)
- [ ] Clase de prueba y alta online desde la landing
## S14 · Automatizaciones y resumen diario al dueño
## S15 · Plataforma BRIK (alta, suscripción, suspensión gradual, salud del cliente)
- [x] Super admin: lista de gimnasios con salud (socios, al día, entradas) y alta con subdominio y dueño
- [ ] Suscripción y suspensión gradual
## S16 · Legal, exportación, primeros pasos
## S17 · Endurecer (entrada sin internet, rendimiento, auditoría)

El catálogo completo de funciones por versión está en el doc
"Gym OS — Catálogo de funciones" (claude.ai).
