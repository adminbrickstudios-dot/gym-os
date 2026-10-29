# Gym OS — reglas para el agente

Sistema de gestión multi-tenant para gimnasios. Línea BRIK.
Stack: Next.js (App Router) + Supabase + Vercel.

**Antes de tocar permisos, migraciones o webhooks: leer `docs/LECCIONES.md`.**
**Ante cualquier "¿cómo se hace esto acá?": `docs/CONVENCIONES.md`.**
**El schema vigente y sus decisiones: `docs/SCHEMA.md`.**
**Por dónde se avanza: `docs/PLAN.md`.**

---

## La pregunta central

> ¿Este socio puede entrar hoy?

- **Se calcula, nunca se guarda.** No existe una columna `al_dia`,
  `estado`, `vencido` ni parecida. Se guardan **hechos** (pagos,
  coberturas, congelamientos, suspensiones, consumos) y el estado sale
  de la función `estado_acceso(socio_id, momento)`.
- **Una sola fuente de verdad.** Recepción, kiosco, QR, app del socio,
  listas de retención y "Vencen hoy" usan la misma función SQL.
  Prohibido reimplementar el cálculo en TypeScript.
- **La respuesta siempre dice por qué**: color, motivo y texto listo
  para mostrar.
- **Nada que importe depende de un cron.** Si un cron falla, nadie
  entra gratis y nadie queda afuera.

---

## Reglas de desarrollo

- **Cero hardcodeo.** Todo conectado a Supabase desde el día 1.
- **Toda variación de cada gimnasio vive en datos**: paleta, logo,
  planes, clases, reglas de vencimiento, secciones prendidas.
- **Tablas, columnas, funciones y triggers en español.**
- **`gimnasio_id` en todas las tablas**, denormalizado, y **protegido
  por FK compuesta** `(gimnasio_id, x_id)` → `x(gimnasio_id, id)`. Sin
  la FK compuesta, el denormalizado es una promesa, no una garantía.
  Excepciones: ver `docs/SCHEMA.md` § Excepciones.
- **RLS activa en toda tabla, en la misma migración que la crea.**
- **Todo unique es por gimnasio.** Excepciones listadas en el schema.
- **Las pantallas se apagan por gimnasio.** Un gimnasio sin clases no
  ve nada de clases en ningún panel.
- **Primero el schema, después el código.**
- **Permiso denegado = error, nunca lista vacía.** Un cero filtrado por
  RLS es indistinguible de un cero real.
- **Toda escritura verifica filas afectadas.** Un 200 con cero filas no
  es éxito.
- **Los webhooks mandan, nunca el navegador**, e idempotentes por ID
  externo (`eventos_webhook`).
- **Nunca un fallback silencioso.** Host que no resuelve →
  `/gimnasio-no-encontrado` con la dirección escrita.
- **Fechas en `timestamptz`, nunca `timestamp`.** Los días calendario
  (vencimientos, pases diarios) se guardan como intervalos semiabiertos
  `[desde, hasta)` con límites en la medianoche local del gimnasio.
- **Plata en `numeric(12,2)`**, nunca float. Formato `$84.500,50`
  solo a través del helper `formatearPesos()`.
- **No se guardan datos de salud.** Peso levantado y asistencia sí;
  condiciones médicas, lesiones o diagnósticos, no.
- **`@supabase/ssr` en todo el flujo de auth.**
- **Press state en CSS (`:active`)**, `<Link>` en vez de
  `router.push`, `loading.tsx` en cada ruta con la forma real.

---

## Migraciones

**Mientras no exista `.claude/BASE_CON_DATOS_REALES`**: el agente
escribe y aplica sus migraciones.
**Cuando ese archivo existe**: el agente escribe la migración y la
entrega; Mateo la corre. El hook bloquea la aplicación.

Siempre:
1. Aditivas: nullable → backfill → NOT NULL.
2. Idempotentes: `if not exists` en todo.
3. Sin `begin`/`commit` propios — el aplicador abre la transacción.
4. Guarda de entrada (verifica precondiciones) y verificación al final
   (falla con `raise exception` si el resultado no es el esperado).
5. Toda función: `set search_path = ''` (nombres calificados) y
   `revoke execute ... from public`, después `grant` explícito.
6. RLS activa en toda tabla nueva, con sus políticas, en la misma
   migración.
7. Pre-vuelo en transacción que revierte, después aplicar, después
   `npm run db:types`.
8. **Nunca pegar SQL en el editor de Supabase** — rompe los acentos.
9. **Ningún TODO dentro de una migración.**

---

## Definición de TERMINADO

Una tarea está terminada solo si **todo** esto es cierto:

- [ ] `npm run build` pasa
- [ ] `npm run db:types` corrido y sin diff pendiente
- [ ] `npm run lint` limpio
- [ ] `npm run typecheck` limpio
- [ ] `npm run chequeos` en verde (RLS en todas las tablas, `search_path`
      y `revoke` en todas las funciones, `gimnasio_id` + FK compuesta
      fuera de la lista de excepciones, ningún `timestamp` sin zona,
      ningún TODO en migraciones, ningún teléfono con pinta de real en
      el seed demo)
- [ ] **Probado ejecutando**: el endpoint llamado, la pantalla abierta
      con sesión real, el webhook con evento firmado, la migración
      aplicada en transacción que revierte
- [ ] Entrada en `docs/LOG.md` con el formato de reporte
- [ ] Commit con mensaje que dice qué cambió y por qué, y push

Si algo no se pudo verificar, se escribe textual:
*"el código está escrito según la documentación, pero no está
ejecutado"*.

---

## Cómo trabaja el agente

- **No frena entre partes.** Si un punto no cierra, lo dice y sigue.
- **No pide permiso para lo obvio.**
- **Confirma antes de rehacer** algo que ya existe.
- **Solo frena** si lo pedido es imposible o contradictorio, si hay dos
  caminos y elegir mal cuesta caro, o si algo roto bloquea.

Lo que encuentra roto:
- Bloquea → lo arregla y lo dice.
- Trivial y al lado → lo arregla y lo dice.
- Otra cosa → lo anota en el LOG, no lo toca.
- **Toca permisos o plata → nunca lo arregla solo. Lo reporta.**

## Reporte (siempre esta estructura)

```
QUÉ HICE                        por punto, y cómo lo verifiqué
LO QUE ENCONTRÉ SIN PEDIRTELO   lo que apareció solo
QUÉ CORRÉS VOS                  comandos exactos, en orden
QUÉ CONFIGURÁS VOS              variables, paneles, DNS
SIN ARREGLAR                    lo que quedó, y por qué
LO QUE NO PUDE VERIFICAR        obligatorio, sin adornar
```

## Git

- Commit y push al cerrar cada capa, no al final de todo.
- El mensaje dice qué cambió y por qué. Nunca "fix".
- **Nunca `vercel --prod` con cambios sin commitear** (el hook lo
  bloquea).
- `git branch -r` dice más que `git log` de main.

## Datos de prueba

- El gimnasio demo usa **solo datos obviamente ficticios**: teléfonos
  con característica `000` (`+54 9 000 …`), mails `@ejemplo.invalid`.
- Los **casos testigo** (un socio por cada color del semáforo) tienen
  nombres fijos definidos en un solo archivo, que importan el seed y
  los tests. Nunca se tipean dos veces.
- Los tests de acceso llaman `estado_acceso(socio, momento)` con un
  `momento` fijo — nunca dependen de `now()`.
