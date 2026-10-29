# Gym OS — Registro

Una entrada por capa cerrada, la más nueva arriba. Siempre con esta
estructura. `docs/ESTADO.md` es una copia local de este archivo y no se
commitea.

```
QUÉ HICE                        por punto, y cómo lo verifiqué
LO QUE ENCONTRÉ SIN PEDIRTELO   lo que apareció solo
QUÉ CORRÉS VOS                  comandos exactos, en orden
QUÉ CONFIGURÁS VOS              variables, paneles, DNS
SIN ARREGLAR                    lo que quedó, y por qué
LO QUE NO PUDE VERIFICAR        obligatorio, sin adornar
```

---

## 2026-10-29 · S1 + base de S7 · Núcleo de acceso y cobro, en Postgres real

**QUÉ HICE**
- **Siete migraciones** (0001–0007). El detalle de qué tiene cada una está
  en `docs/SCHEMA.md` § Estado. Verificado así:
  - aplicadas con pre-vuelo contra Postgres 16;
  - re-ejecutadas enteras en una transacción para probar que son idempotentes;
  - `npm run chequeos` en verde.
- **Cálculo de acceso** (`privado.calcular_acceso`): una función por vía y
  una combinación en orden fijo.
  - **21 casos testigo**, un socio por cada respuesta posible. Son la misma
    fuente para el seed y para las pruebas.
  - Verificado con 80 pruebas de base.
  - Las pruebas detectan errores: con una expectativa cambiada a propósito, fallan.
- **Cobro de cuotas**:
  - precio por lista;
  - períodos con ancla en los tres modos de renovación;
  - `cobrar_cuota`, `anular_venta`, `cambiar_plan`, `dar_de_baja`.
  - Verificado con pruebas de cada modo y de los bordes de mes.
- **Compensación de días** por congelamiento y cierre, recalculada por
  trigger. Verificada con pruebas de orden (pagar antes o después de
  congelar), de superposición con un cierre y de anulación.
- **Concurrencia**: dos lecturas de QR casi simultáneas descuentan una sola
  clase. Verificado con dos conexiones reales, con y sin cobro del reingreso.
- **`npm run chequeos`**:
  - revisa contra la base: RLS, `gimnasio_id`, FK compuestas, timestamptz,
    numeric(12,2), `search_path`, lista blanca de EXECUTE, unique por
    gimnasio, sin TRUNCATE para clientes;
  - revisa en los archivos: sin TODO ni BEGIN en las migraciones, sin
    teléfonos con pinta de reales.
  - Verificado con una tabla y una función mal hechas a propósito: las detecta.
- **Gimnasio demo determinístico**:
  - 300 socios más los 21 testigos;
  - cuotas con su venta y su pago;
  - 90 días de ingresos en horarios pico;
  - teléfonos +549000…
  - Se siembra en ~4 s.
- **Rendimiento**, medido con 3.000 socios y 80.000 ingresos:
  - ingreso: ~9 ms;
  - búsqueda: <2 ms, usa el índice;
  - cierre de todo el gimnasio: ~0,5 s (era 21 s; se corrigió un filtro que no usaba el índice);
  - estado de los 3.000 juntos: ~2,6 s.
- **App**:
  - Next 15, middleware host → gimnasio, `/gimnasio-no-encontrado`.
  - Clientes de Supabase con `@supabase/ssr`.
  - `formatearPesos` y fechas en la zona del gimnasio, con 19 pruebas unitarias.
  - Probado levantando la app contra un PostgREST mínimo local:
    - plataforma → 200;
    - gimnasio → 200;
    - host desconocido → 404 con la dirección escrita;
    - header falso → descartado;
    - Supabase caído → 503 que lo dice.
- `npm run build` pasa.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Una **revisión independiente** encontró 17 errores confirmados
  ejecutando. Están todos corregidos, cada uno con su prueba de
  regresión en `supabase/pruebas/revision.test.mjs`. Los más graves:
  - pagar durante un congelamiento hacía perder casi todo el mes;
  - un congelamiento cargado antes de pagar no compensaba nunca;
  - la recepción podía congelar hacia atrás y regalar días;
  - el modo aviso dejaba pasar a un suspendido;
  - un socio dado de baja entraba en verde;
  - la recepción podía cambiar de plan con un UPDATE directo;
  - el día 31 se perdía al renovar;
  - en día fijo, la deuda mostrada era el doble de lo que se cobraba;
  - en efectivo se podía pagar más caro que con crédito;
  - el equipo podía leer el hash del PIN del dueño;
  - anon tenía TRUNCATE.
- **Las migraciones se reescribieron en el lugar**, no con parches,
  porque ninguna estaba aplicada en una base real. Desde el primer
  gimnasio real, eso ya no se puede.
- **Next quedó en 15.5**, no en 16 (que es la última): 16 renombra el
  middleware y no lo pude verificar acá. Actualizar es una decisión
  aparte.
- **`next/font/google` se sacó**: el build baja las fuentes de internet y
  falla sin red. Se usa la fuente del sistema.
- **El teléfono del socio no puede ser único**: las familias comparten número.
- **La investigación cambió prioridades**:
  - factura ARCA por cada cuota;
  - Wellhub ya está en Salta;
  - el refresh token de MercadoPago vence a los 6 meses;
  - el apto físico en Salta tiene una ordenanza de 2019 que no se encontró.
  - Todo está en `docs/requisitos.md` y en el doc del catálogo.

**QUÉ CORRÉS VOS**
```
git clone gym-os.bundle gym-os && cd gym-os && npm install
gh repo create gym-os --private --source=. --push
git log origin/main --oneline -3
```

**QUÉ CONFIGURÁS VOS**
- Comprar el dominio y crear el proyecto de Supabase (São Paulo).
- `.env.local` según `.env.local.example`. Después, `npm run db:prevuelo`
  y `npm run db:aplicar`.
- Copiar `2-LECCIONES.md` y `3-CONVENCIONES.md` a `docs/`.

**SIN ARREGLAR**
- **Listas de retención en lote**: `calcular_acceso` socio por socio tarda
  ~2,6 s con 3.000 socios. Alcanza para el barrio (79 ms con 300), no para una cadena.
- **Prorrateo al cambiar de plan**: la diferencia de precio no se cobra ni
  se devuelve. Es v1.5.
- **Cierres de una sola sede**: no compensan. El check lo impide, porque
  falta decidir qué planes alcanzan.
- **`descongelar`**: solo termina hoy. Una vuelta con fecha pasada la carga el dueño anulando y recreando.
- **Clases y reservas**: no están en el schema ni en el seed.

**LO QUE NO PUDE VERIFICAR**
- **Nada se aplicó en un Supabase real.** La base local simula los roles,
  `auth.uid()` y los permisos por defecto de Supabase. Supabase usa
  Postgres 15 o 17 y acá corrió 16.
- **`npm run db:types`**: está escrito según la documentación, pero no está
  ejecutado. La CLI de Supabase con `--db-url` necesita Docker.
- **El middleware contra el PostgREST real de Supabase**: el código está
  escrito según la documentación, pero no está ejecutado. Se probó con un
  imitador local.
- **Los permisos de `.claude/settings*.json` en una sesión real de Claude
  Code**: el código está escrito según la documentación, pero no está
  ejecutado.

---

## 2026-10-26 · S−1 · Archivos del repo y schema propuesto

**QUÉ HICE**
- `CLAUDE.md` con reglas, migraciones, definición de TERMINADO y
  reporte.
- `docs/SCHEMA.md`: schema completo propuesto, modelo de las tres vías
  de acceso, RLS, índices y preguntas abiertas.
- `docs/PLAN.md` como marcador: `7-PLAN.md` no estaba adjunto.
- `docs/requisitos.md`, `.env.local.example`, `.vercelignore`.
- `.claude/settings.json` (hook compartido + denegaciones),
  `.claude/settings.local.json` (permisos de este equipo),
  `.claude/hooks/bloquear-peligroso.mjs`.
- Hook verificado ejecutándolo: 28 comandos simulados contra un repo
  git de prueba (con remoto), 28 con el resultado esperado. Incluye
  `vercel --prod` limpio y pusheado (pasa), sucio (bloquea), con commit
  sin pushear (bloquea), y aplicar migraciones con y sin
  `.claude/BASE_CON_DATOS_REALES`.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Los cinco documentos del proyecto no estaban adjuntos. Solo
  `B-ARCHIVOS-A-ADJUNTAR.md`.
- `LECCIONES` y `CONVENCIONES` solo viven en el proyecto de claude.ai:
  el agente que codea en el repo no los ve. Tienen que copiarse a
  `docs/LECCIONES.md` y `docs/CONVENCIONES.md`.
- `.claude/settings.local.json` es personal y queda fuera de git. Un
  hook de seguridad ahí no viaja con el repo. Se puso en
  `.claude/settings.json`.
- `create-next-app` se niega a correr en una carpeta con archivos que
  puedan chocar: primero se crea el proyecto, después se copian estos
  archivos.

**SIN ARREGLAR**
- `docs/PLAN.md` vacío hasta tener `7-PLAN.md`.
- `npm run chequeos`, `db:types`, `typecheck` todavía no existen: son
  parte de la primera sección de código.

**LO QUE NO PUDE VERIFICAR**
- El schema es una propuesta: no hay ninguna migración escrita ni
  aplicada.
- La sintaxis de permisos de `.claude/settings*.json` está escrita
  según la documentación de Claude Code, pero no está ejecutada dentro
  de una sesión real de Claude Code.
