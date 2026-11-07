# 16 · Rapidez y fluidez (lo que más se nota)

Mateo: "rapidez, fluidez, animaciones, efectos". Esto es lo concreto, mirado
en el código el 05/11 (Next 15.5, React 19.1, supabase-js 2.118, sin
caché ni Suspense hoy).

## 1. Dónde se va el tiempo hoy (medido en el código)

- **Cada pedido hace 2 viajes a Supabase antes de empezar la página**: el
  middleware llama `auth.getUser()` (va al servidor de Auth) y otra RPC
  para saber de qué gimnasio es la dirección. Después la página vuelve a
  pedir el usuario y sus datos.
- **No hay `vercel.json`**: las funciones corren en la región por defecto de
  Vercel (Washington, `iad1`). Si Supabase está en São Paulo, **cada viaje
  cruza el continente** (~120-150 ms ida y vuelta) y una pantalla con 4
  viajes en fila pierde medio segundo solo en eso.
- Ninguna pantalla usa `Suspense`: la página espera a la consulta más lenta
  para mostrar algo (el `loading.tsx` ayuda, pero todo aparece junto).
- Nada se guarda en caché: marca, planes, secciones y configuración se
  piden en cada pantalla aunque cambien una vez por mes.

## 2. Lo que se hace (VD-47, tanda 1)

1. **Misma región**: Vercel en la región de Supabase (São Paulo → `gru1`).
   Mateo confirma la región de Supabase (Settings → General) y la pone en
   Vercel (Settings → Functions → Region), o el agente agrega
   `vercel.json` con `"regions": ["gru1"]` si Mateo dejó escrito que
   Supabase está en São Paulo. **Es el cambio que más se nota y es gratis.**
2. **Middleware liviano**:
   - El gimnasio de cada dirección se guarda en memoria del servidor 60 s
     (un `Map` con vencimiento): la RPC se hace una vez por minuto, no en
     cada pedido. La plataforma no la necesita.
   - La sesión: usar `auth.getClaims()` (verifica el JWT sin ir a Auth
     cuando el proyecto usa claves asimétricas — verificarlo en la
     documentación de Supabase; si el proyecto no las tiene, dejarlo en QUÉ
     CONFIGURÁS VOS: "Supabase → JWT Signing Keys → migrar") y refrescar
     solo cuando el token está por vencer. La seguridad no cambia: la base
     sigue decidiendo todo con `auth.uid()`.
   - `matcher` que no pase por el middleware lo estático (imágenes, fuentes,
     `_next`, manifest).
3. **Un viaje por pantalla cuando se puede**: las pantallas principales
   (Inicio, Entrada, Socios, Vencen, Caja, app del socio) piden lo suyo en
   **una** función de la base que devuelve todo junto (como ya hace
   `retencion_con`), o en `Promise.all`, nunca en fila.
4. **Streaming**: la estructura (menú, saludo, botones) aparece al instante;
   los bloques lentos (números, listas, gráficos) entran con `Suspense` y su
   esqueleto. Primero lo que se usa (el botón de Entrada), después lo demás.
5. **Caché de lo que casi no cambia**, por gimnasio: marca, secciones
   prendidas, planes, actividades, horarios, configuración pública
   (`unstable_cache` con etiqueta `gimnasio:<id>` y `revalidateTag` al
   guardar). **Nunca** se cachea nada que dependa de quién mira (permisos,
   plata, socios): eso siempre va a la base.
6. **En el navegador**:
   - `<Link>` (con prefetch) en toda navegación; nada de `router.push`
     para ir a otra pantalla (regla de siempre).
   - `useOptimistic` en lo que casi nunca falla (tildar tarea, marcar
     contactado, reservar, presente) con vuelta atrás si falla.
   - `useTransition` para filtros y búsquedas: la lista anterior se queda
     (atenuada) mientras llega la nueva; nunca una pantalla en blanco.
   - Lo pesado se carga solo cuando se abre: lector de cámara/QR, Excel
     del importador, gráficos, editor de la página (`next/dynamic`).
   - Fotos: se achican al subir (800 px, webp) y se muestran con `next/image`
     y su tamaño; nunca la foto original de 5 MB en una lista.
7. **La base**: `explain analyze` de las funciones de las pantallas
   principales con el demo grande (3.000 socios); índices que falten;
   nada de bucles fila por fila en plpgsql donde se puede hacer en una
   consulta.
8. **Medir siempre**: `scripts/medir/tiempos.mjs` (Playwright) abre las 15
   pantallas clave con cada rol contra la app de prueba con 3.000 socios y
   anota: tiempo hasta ver contenido y hasta poder usarla. Tabla en el LOG
   antes y después. Presupuesto: **< 1 s** hasta ver contenido en
   compu, **< 1,5 s** en celular, **< 100 ms** entre un toque y su primer
   cambio. Corre en las Pruebas completas (avisa, no corta).

## 3. Fluidez y animaciones (VD-27, ver `07` para las reglas)

Un solo sistema de movimiento en `globals.css`:

```css
--dur-rapida: 150ms;  --dur-media: 220ms;  --dur-hoja: 260ms;
--curva: cubic-bezier(.2, .8, .2, 1);      /* sale rápido, frena suave */
```

| Clase | Qué hace | Dónde |
|---|---|---|
| `.aparecer` | opacidad 0→1 + 4 px de abajo, 150 ms | contenido que llega por streaming |
| `.hoja` | escala 0,96→1 + opacidad, 220 ms (sube desde abajo en celular, 260 ms) | Entrada, Cobrar, Ctrl+K, menús |
| `.lista-entra` | la fila nueva entra, la que se va se achica | avisos en vivo, tareas, listas |
| `.tilde` | el ✓ se dibuja (stroke) en 300 ms | al anotar, cobrar, guardar |
| `.pulso` | un latido del color del semáforo | veredicto de la Entrada |
| `.brillo` | el número que cambió se ilumina 600 ms | números de Inicio (en vez de contar de a uno) |
| `:active` | escala 0,97 | todo botón y tarjeta tocable |
| `.esqueleto` | brillo que pasa lento | cargas |

Detalles que hacen que se sienta caro:
- El foco y la selección con el color del gimnasio; scroll suave solo
  dentro de listas; nada salta cuando carga (los esqueletos tienen la
  medida real).
- En la app del socio: vibración corta (`navigator.vibrate(10)`, solo
  Android) al entrar y al reservar; transición nativa de CSS entre
  pantallas donde el navegador la tiene.
- En la recepción: sonido (ya existe) + el color del veredicto ocupa la
  pantalla al instante (sin animación que demore el "puede/no puede").
- `prefers-reduced-motion`: solo opacidad.

## 4. Que no se trabe nunca

- Toda llamada a la base con un tiempo máximo (10 s): pasado eso, "La base
  está tardando — Reintentar" en el lugar, nunca una rueda infinita.
- Lecturas que fallan por red se reintentan una vez solas; escrituras nunca
  solas (usan la clave de operación, `13`).
- Cada sección con su `error.tsx` (Reintentar · Volver · Ir al inicio).
