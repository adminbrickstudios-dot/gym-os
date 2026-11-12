# Fluidez por pantalla (F3.2)

**Qué es.** Cada pantalla contra las reglas de `FLUIDEZ.md`, hecha leyendo el código de cada carpeta (`loading.tsx` con la forma real, `error.tsx` con salida, botones que muestran "Enviando…" y se apagan mientras trabajan, salida para volver, teclado numérico en DNI/celular/monto, sin emojis). **No reemplaza** la comprobación en ejecución: eso lo hace `scripts/e2e/botones.mjs` (reglas 1, 2, 3, 5, 6, 11, 16 y 19) y su informe `.local/botones-informe.md`.

Generado el 2026-11-11 para el carril C (app del socio, página del gimnasio, "Quiero ser socio" y privacidad). Un **no** en negrita es algo por arreglar o por justificar.

## Carril C · lo que se revisó

| Pantalla | Esqueleto (r. 9, 16, 17) | Error con salida (r. 15) | Botones que trabajan se apagan (r. 1-3) | Salida/volver (r. 5) | Teclado numérico (r. 8) | Sin emojis |
|---|---|---|---|---|---|---|
| `/` | **no** | sí | sí | **no** | sí | sí |
| `/app/ayuda` | sí | sí | sí | sí | sí | sí |
| `/app/clases` | sí | sí | sí | sí | sí | sí |
| `/app/cuenta` | sí | sí | sí | sí | sí | sí |
| `/app/historial` | sí | sí | sí | sí | sí | sí |
| `/app/info` | sí | sí | sí | sí | sí | sí |
| `/app/locker` | sí | sí | sí | sí | sí | sí |
| `/app/mensajes/[id]` | sí | sí | sí | sí | sí | sí |
| `/app/mensajes/nuevo` | sí | sí | sí | sí | sí | sí |
| `/app/mensajes` | sí | sí | sí | sí | sí | sí |
| `/app/novedades` | sí | sí | sí | sí | sí | sí |
| `/app` | sí | sí | sí | sí | sí | sí |
| `/app/pago` | sí | sí | sí | sí | sí | sí |
| `/app/pedir-datos` | sí | sí | sí | sí | sí | sí |
| `/app/plan` | sí | sí | sí | sí | sí | sí |
| `/app/pt` | sí | sí | sí | sí | sí | sí |
| `/app/recibo/[venta]` | sí | sí | sí | sí | sí | sí |
| `/app/resumen` | sí | sí | sí | sí | sí | sí |
| `/app/rutina` | sí | sí | sí | sí | sí | sí |
| `/app/yo` | sí | sí | sí | sí | sí | sí |
| `/hacete-socio` | sí | sí | sí | sí | sí | sí |
| `/privacidad` | sí | sí | sí | sí | sí | sí |

## Textos (DISENO.md § Textos)

Se revisaron las carpetas del carril C buscando las frases de IA que prohíbe la regla ("experiencia única", "siguiente nivel", "sin complicaciones", "potenciá", "solución integral", "disfrutá"): **no hay ninguna** en `src/`. Los textos de la app del socio y de la landing dicen algo comprobable (días que quedan, hasta qué hora, cuánto debe). Los nuevos de FA-12, FA-14, FA-15, FA-16, FA-17, FA-23 y U4 siguen esa regla.

## Lo que se arregló en esta pasada

- "Quiero ser socio" y "Política de privacidad" no tenían pantalla de error propia (regla 15): ahora tienen `error.tsx` con Probar de nuevo, Volver e Ir al inicio. La política no tenía esqueleto: ahora lo tiene.
- El favicon de un gimnasio sin logo es un cuadrado con su color y sus iniciales (nunca una página sin favicon).
- La página oculta (U4) y la 404 de un gimnasio llevan su marca y siempre vuelven a su página.

**Sobre el único "no" de la tabla (`/`, la landing):** no lleva "volver" porque es la entrada, y no tiene esqueleto propio porque sale de la caché del servidor por gimnasio (se muestra de una vez); un `loading.tsx` en la raíz de `src/app/` lo decide el carril A porque alcanza a todas las rutas.

## Lo que no es del carril C (por carril; a completar con el informe de `botones.mjs`)

- **Carril A (principal):** `src/proxy.ts` (bfcache bloqueado por `no-store`), `src/app/ingresar/` (Lighthouse da NO_FCP en `/ingresar`), la Entrada y el Marco del panel, `globals.css`.
- **Carril B (super admin):** `/admin/*`: confirmaciones con nombre en baja, pausa y papelera; botones de "Entrar como soporte" (regla 10).
- **Carril D (panel):** el resto de `/panel/*`: sobre todo Caja y Cobrar (regla 10: la confirmación dice qué va a pasar, con nombre y monto), Equipo y Configuración (regla 7: borrador en formularios largos; el hook está en `src/lib/app/BorradorAutomatico.tsx`), y la campana (regla 14: en vivo).
- **Regla 7 (borrador):** hoy solo lo usa el alta de `/hacete-socio`; pendientes alta completa, plan y configuración de la página.
- **Regla 20 (sincronía en vivo):** no es de una pantalla; es Realtime (carril A).

## Carril D (panel) y pasada de botones · F3.1 y F3.2 (11/11)

Corridas de `Botones` en Actions sobre `carril/d-f3`, los 6 roles en compu y celular (43090684539 la primera, 43099403588 la segunda). `botones.mjs` mide ahora, además, los saltos al cargar (CLS), la salida visible de cada pantalla y lista (sin tocarlos) los botones que cambian o mandan algo: ahí solo se verifica que existen, no se aprietan.

| Pantalla | Regla | Hallazgo | Estado |
|---|---|---|---|
| `/panel/rutinas/socio` sin `?socio` | 15, 19 | Tiraba un `Error` común: en producción llegaba como pantalla genérica y React #419 en consola | Arreglado: dice "Falta elegir el socio. Abrí la rutina desde su ficha." |
| `/app/pago` sin `?pago` | 15, 19 | Igual (#419) | Arreglado: dice qué falta y qué hacer |
| `/app/clases` sin sedes, `/panel/socios/nuevo` con interesado inexistente | 15 | Igual | Arreglado: el mensaje llega a la pantalla |
| `/panel/planes/aumento` | 19 | Al salir de la pantalla con la vista previa en camino quedaba "An unexpected response was received from the server" en consola (11 a 20 por corrida) | Arreglado: los pedidos de la pantalla se descartan al salir |
| `/panel/configuracion`, `/panel/asistente` | 9, 16 | No tenían `loading.tsx` con su forma | Arreglado |
| Menú del celular (hoja del panel) | 5, 6 | No cerraba con Esc ni con el "atrás" del teléfono | Arreglado en `Navegacion.tsx` (Esc, atrás del teléfono, y saca la entrada de historial que suma) |
| `/panel/hoy` | 1 | Primer toque en el menú 152 ms (redirige a `/panel/tareas`) | Anotado: es la compilación en frío del primer toque, no se repite |
| `intentar.tsx` (`src/lib/panel/`) | texto | Los avisos usan `emoji="🧩"`, `"🐢"`, `"🔒"`; salen como ícono por `Icono` (no se ven emojis), pero el nombre del campo invita a escribirlos | Carril A: no se tocó |

Falsos positivos que se sacaron del recorrido (no eran de la app): enlace a la pestaña en la que ya estás, descargas (`/mis-datos`, `/exportar`), campos con su `<label>` alrededor, contenido dentro de un `<details>` cerrado, y "Si algo salió mal, lo deshacés" en Importar socios, que no es una pantalla de error.

**Confirmaciones de lo destructivo (regla 10):** el recorrido no aprieta nada que cambie datos o plata; en el informe de cada rol queda la lista por pantalla de los botones que existen y no se tocaron (Anular, Dar de baja, Cobrar, Cerrar caja, Pausar, etc.). La comprobación de que piden confirmación con nombre y monto y de que Cancelar no cambia nada sigue en los e2e propios de cada flujo (caja, ventas, socios); no se repitió acá.

**Textos:** buscadas en `src/` las frases prohibidas (experiencia única, siguiente nivel, sin complicaciones, potenciá, solución integral, disfrutá, revolucionar): ninguna. Los emojis que quedan están en textos que salen por WhatsApp y notificaciones push (`src/lib/caja.ts`, `recibo.ts`, `push-acciones.ts`), no en pantallas.

## F3.2 · pasada de las reglas que `botones.mjs` no mira (12/11, carril f32-f05)

**Cómo se hizo.** Tres cosas, ninguna a ojo:

1. **`src/lib/fluidez-pantallas.test.ts` (vitest, corre en `npm test`)**: cada pantalla del panel, del admin y de la app del socio tiene su `loading.tsx` (excepto `/panel/hoy`, que solo redirige) y ese esqueleto se anuncia con `aria-busy`; cada zona tiene `error.tsx` y todos usan `PantallaError` (Reintentar, Volver, Ir al inicio); los campos `dni`, `telefono`, `monto`, `precio`, `matricula`, `cantidad` y `cupo` abren teclado numérico; ningún texto de pantalla lleva un emoji suelto.
2. **`scripts/e2e/fluidez-reglas.mjs` (Actions, pantallas)**: regla 16 con 4G lento y CPU x4 en 12 pantallas del panel y con 3G (400 kbps, 300 ms) en 3; regla 7 con plan nuevo, rutina y evento (se escribe, se recarga, "¿Seguimos donde dejaste?", Seguir); reglas 7 y 8 con un envío que la base rechaza (los campos siguen llenos y el error sale junto al campo); regla 8 con el foco y el teclado de DNI y celular; regla 15 con una dirección que no existe y una pantalla con un dato que falta.
3. **`scripts/fluidez-tabla.mjs`**: lee el código de cada carpeta de pantalla y arma la tabla de abajo con reglas simples (hay `loading.tsx`, borrador, confirmación, `inputMode`, `autoFocus`, imágenes con tamaño…). **Es una guía de dónde mirar, no una prueba**: un ✅ de la tabla quiere decir "el código lo tiene", un 🟡 quiere decir "no lo encontró" y se explica abajo.

**Se arregló en esta pasada**

- **Regla 7**: el alta de plan, la rutina y el evento guardan lo escrito en el dispositivo (7 días, nunca en la base) y al volver ofrecen seguir (`BorradorDeEstado.tsx` para los formularios con estado en React; `BorradorAutomatico` para los de `<form>`). Si el plan nuevo da error, **los campos siguen llenos** (React 19 vacía el formulario al terminar la acción: ahora la acción devuelve lo escrito, igual que Equipo y "Quiero ser socio"). Si el plan se creó pero falló la matrícula no se devuelven los campos (volver a enviar lo duplicaría).
- **Regla 8**: el error del precio del plan y el de la fecha del evento salen junto al campo; el nombre del plan toma el foco al abrir; la rutina nueva toma el foco en el nombre.
- **Regla 15**: el error del ingreso (`/ingresar`) no tenía "Volver": ahora lo tiene.
- **Regla 18**: `viewport.interactiveWidget = "resizes-content"` en el layout raíz: con el teclado abierto la página se achica y el botón de guardar y la barra de abajo quedan a la vista. **No probado en un teléfono real** (Playwright no simula teclado).
- **Regla 17 / F0.5**: el logo del panel, el de la landing y los flyers de eventos de la landing pasan por `next/image` cuando salen del bucket público de Supabase (en la base local siguen siendo `<img>`); los flyers ya tienen su lugar reservado.

**Leyenda de la tabla** (columnas = números de `FLUIDEZ.md`): 4 dónde se queda, 7 borrador, 8 formularios cómodos, 9 esqueleto, 10 confirmar lo irreversible, 14 en vivo, 16 red lenta, 17 imágenes, 18 teclado del celular. No están las que no son por pantalla: 12 (mismo nombre en botón, aviso y registro) se revisó con los textos de Cobrar, Anular y Pausar en F3.1; 13 (teclado de la recepción: Tab, Esc, Enter, Ctrl+K, F2) es del Marco y de la Puerta, no de cada pantalla; 20 es Realtime (ver los 🟡).

**Resultado en Actions** (`pruebas-completas.yml`, `solo=fluidez-reglas`, app compilada): corrida **43146695444**, **93 pasos en verde**. Con 4G lento y CPU x4 sin caché, las 12 pantallas muestran contenido y terminan de cargar en 1,5 a 2,8 s (el panel de inicio 2,8 s); con 3G, 2,4 a 3,8 s. Ninguna queda en blanco, rota, con un botón colgado en "…ando" ni con errores de consola. La primera corrida (43145982078) encontró 2 faltas de la regla 15 que se arreglaron: los avisos de error de `intentar()` (sin permiso, sección apagada, dato inválido, por ejemplo `/panel/rutinas/socio` sin socio) y la 404 del gimnasio no ofrecían **Volver**; ahora todos lo traen (`SalidaError`, `VolverAtras`).

### Tabla pantalla × regla (generada por `scripts/fluidez-tabla.mjs`)

| Pantalla | 4 | 7 | 8 | 9 | 10 | 14 | 16 | 17 | 18 |
|---|---|---|---|---|---|---|---|---|---|
| `/admin` | ✅ | — | ✅ | ✅ | ✅ | — | ✅ loading | — | ✅ viewport |
| `/admin/[id]` | ✅ | — | 🟡 foco | ✅ | ✅ | — | ✅ loading | — | ✅ viewport |
| `/admin/buscar` | — | — | ✅ | ✅ | — | — | ✅ loading | — | ✅ viewport |
| `/admin/gimnasios` | — | — | 🟡 teclado | ✅ | — | — | ✅ loading | — | ✅ viewport |
| `/admin/plantillas` | — | — | ✅ | ✅ | — | — | ✅ loading | — | ✅ viewport |
| `/admin/registro` | — | — | — | ✅ | — | — | ✅ loading | — | — |
| `/admin/seguridad` | — | — | 🟡 foco | ✅ | — | — | ✅ loading | — | ✅ viewport |
| `/admin/ver-socio` | — | — | — | ✅ | — | — | ✅ loading | — | — |
| `/app` | ✅ | — | 🟡 foco | ✅ | 🟡 sin confirmación con nombre | ✅ | ✅ loading | ✅ | ✅ viewport |
| `/app/ayuda` | — | — | — | ✅ | — | — | ✅ loading | — | — |
| `/app/ayuda/guia` | — | — | — | ✅ | — | — | ✅ loading | — | — |
| `/app/clases` | 🟡 no cambia la pantalla sola | — | — | ✅ | — | — | ✅ loading | ✅ | — |
| `/app/cuenta` | 🟡 no cambia la pantalla sola | — | 🟡 foco | ✅ | 🟡 sin confirmación con nombre | — | ✅ loading | — | ✅ viewport |
| `/app/historial` | — | — | — | ✅ | — | — | ✅ loading | — | — |
| `/app/info` | — | — | — | ✅ | — | — | ✅ loading | — | — |
| `/app/locker` | — | — | — | ✅ | — | — | ✅ loading | — | — |
| `/app/mensajes` | ✅ | — | 🟡 foco | ✅ | — | — | ✅ loading | — | ✅ viewport |
| `/app/mensajes/[id]` | — | — | — | ✅ | — | — | ✅ loading | ✅ | — |
| `/app/mensajes/nuevo` | — | — | — | ✅ | — | — | ✅ loading | — | — |
| `/app/novedades` | 🟡 no cambia la pantalla sola | — | — | ✅ | — | — | ✅ loading | — | — |
| `/app/pago` | — | — | — | ✅ | — | — | ✅ loading | — | — |
| `/app/pedir-datos` | 🟡 no cambia la pantalla sola | — | 🟡 foco | ✅ | 🟡 sin confirmación con nombre | — | ✅ loading | — | ✅ viewport |
| `/app/plan` | 🟡 no cambia la pantalla sola | — | 🟡 teclado | ✅ | — | — | ✅ loading | — | ✅ viewport |
| `/app/pt` | ✅ | — | — | ✅ | — | — | ✅ loading | — | — |
| `/app/recibo/[venta]` | — | — | — | ✅ | — | — | ✅ loading | — | — |
| `/app/resumen` | — | — | — | ✅ | — | — | ✅ loading | — | — |
| `/app/rutina` | ✅ | — | 🟡 foco | ✅ | — | — | ✅ loading | — | ✅ viewport |
| `/app/yo` | ✅ | — | 🟡 teclado | ✅ | ✅ | — | ✅ loading | ✅ | ✅ viewport |
| `/hacete-socio` | 🟡 no cambia la pantalla sola | ✅ | 🟡 foco | ✅ | 🟡 sin confirmación con nombre | — | ✅ loading | — | ✅ viewport |
| `/panel` | ✅ | — | — | ✅ | ✅ | ✅ | ✅ e2e | — | — |
| `/panel/asistente` | 🟡 no cambia la pantalla sola | — | — | ✅ | 🟡 sin confirmación con nombre | ✅ | ✅ loading | ✅ | — |
| `/panel/avisos` | ✅ | — | 🟡 teclado | ✅ | 🟡 sin confirmación con nombre | ✅ | ✅ loading | — | ✅ viewport |
| `/panel/ayuda` | — | — | — | ✅ | — | ✅ | ✅ loading | — | — |
| `/panel/ayuda/carteles` | — | — | — | ✅ | — | ✅ | ✅ loading | — | — |
| `/panel/ayuda/carteles/anotate` | ✅ | — | 🟡 foco | ✅ | — | ✅ | ✅ loading | — | ✅ viewport |
| `/panel/ayuda/carteles/app` | — | — | — | ✅ | — | ✅ | ✅ loading | — | — |
| `/panel/ayuda/carteles/puerta` | — | — | — | ✅ | — | ✅ | ✅ loading | — | — |
| `/panel/ayuda/guias` | — | — | — | ✅ | — | ✅ | ✅ loading | — | — |
| `/panel/ayuda/guias/[rol]` | — | — | — | ✅ | — | ✅ | ✅ loading | — | — |
| `/panel/caja` | ✅ | — | ✅ | ✅ | ✅ | ✅ | ✅ e2e | — | ✅ viewport |
| `/panel/caja/historial` | — | — | — | ✅ | — | ✅ | ✅ loading | — | — |
| `/panel/caja/reporte` | — | — | — | ✅ | — | ✅ | ✅ loading | — | — |
| `/panel/campana` | ✅ | — | 🟡 teclado | ✅ | 🟡 sin confirmación con nombre | ✅ | ✅ loading | — | ✅ viewport |
| `/panel/clases` | ✅ | — | — | ✅ | 🟡 sin confirmación con nombre | ✅ | ✅ e2e | — | — |
| `/panel/clases/[id]` | ✅ | — | ✅ | ✅ | — | ✅ | ✅ loading | ✅ | ✅ viewport |
| `/panel/clases/grilla` | ✅ | — | 🟡 foco | ✅ | — | ✅ | ✅ loading | — | ✅ viewport |
| `/panel/clases/tv` | 🟡 no cambia la pantalla sola | — | 🟡 foco | ✅ | 🟡 sin confirmación con nombre | ✅ | ✅ loading | — | ✅ viewport |
| `/panel/configuracion` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ e2e | ✅ | ✅ viewport |
| `/panel/control` | — | — | 🟡 foco | ✅ | — | ✅ | ✅ loading | — | ✅ viewport |
| `/panel/cuenta` | ✅ | — | 🟡 foco | ✅ | ✅ | ✅ | ✅ loading | ✅ | ✅ viewport |
| `/panel/cupones` | ✅ | — | ✅ | ✅ | 🟡 sin confirmación con nombre | ✅ | ✅ loading | — | ✅ viewport |
| `/panel/datos-personales` | ✅ | — | 🟡 foco | ✅ | 🟡 sin confirmación con nombre | ✅ | ✅ loading | — | ✅ viewport |
| `/panel/documentos` | ✅ | — | 🟡 foco | ✅ | 🟡 sin confirmación con nombre | ✅ | ✅ loading | — | ✅ viewport |
| `/panel/entrada` | ✅ | — | ✅ | ✅ | ✅ | ✅ | ✅ loading | ✅ | ✅ viewport |
| `/panel/entrada/control` | — | — | — | ✅ | — | ✅ | ✅ loading | — | — |
| `/panel/equipo` | ✅ | — | 🟡 teclado | ✅ | ✅ | ✅ | ✅ e2e | ✅ | ✅ viewport |
| `/panel/equipo/actividad` | — | — | — | ✅ | — | ✅ | ✅ loading | — | — |
| `/panel/eventos` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ e2e | ✅ | ✅ viewport |
| `/panel/fichar` | ✅ | — | ✅ | ✅ | — | ✅ | ✅ loading | — | ✅ viewport |
| `/panel/gastos` | ✅ | — | 🟡 foco | ✅ | ✅ | ✅ | ✅ loading | — | ✅ viewport |
| `/panel/grados` | ✅ | — | 🟡 foco | ✅ | 🟡 sin confirmación con nombre | ✅ | ✅ loading | — | ✅ viewport |
| `/panel/horas` | ✅ | — | 🟡 foco | ✅ | 🟡 sin confirmación con nombre | ✅ | ✅ loading | — | ✅ viewport |
| `/panel/hoy` | — | — | — | — | — | ✅ | — | — | — |
| `/panel/incidentes` | ✅ | — | 🟡 foco | ✅ | — | ✅ | ✅ loading | — | ✅ viewport |
| `/panel/lockers` | ✅ | — | 🟡 foco | ✅ | ✅ | ✅ | ✅ loading | — | ✅ viewport |
| `/panel/maquinas` | ✅ | — | 🟡 foco | ✅ | ✅ | ✅ | ✅ loading | — | ✅ viewport |
| `/panel/mensajes` | ✅ | — | 🟡 foco | ✅ | 🟡 sin confirmación con nombre | ✅ | ✅ loading | ✅ | ✅ viewport |
| `/panel/pagina` | ✅ | ✅ | 🟡 foco | ✅ | ✅ | ✅ | ✅ loading | ✅ | ✅ viewport |
| `/panel/pin` | 🟡 no cambia la pantalla sola | — | ✅ | ✅ | — | ✅ | ✅ loading | — | ✅ viewport |
| `/panel/planes` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ e2e | ✅ | ✅ viewport |
| `/panel/planes/aumento` | 🟡 no cambia la pantalla sola | — | 🟡 foco | ✅ | — | ✅ | ✅ loading | — | ✅ viewport |
| `/panel/profes` | ✅ | — | 🟡 foco | ✅ | 🟡 sin confirmación con nombre | ✅ | ✅ loading | — | ✅ viewport |
| `/panel/prospectos` | ✅ | — | ✅ | ✅ | — | ✅ | ✅ loading | — | ✅ viewport |
| `/panel/pt` | ✅ | — | 🟡 foco | ✅ | ✅ | ✅ | ✅ loading | — | ✅ viewport |
| `/panel/recibo/[venta]` | — | — | — | ✅ | — | ✅ | ✅ loading | — | — |
| `/panel/resultado` | ✅ | — | 🟡 foco | ✅ | 🟡 sin confirmación con nombre | ✅ | ✅ e2e | — | ✅ viewport |
| `/panel/resumen` | — | — | — | ✅ | — | ✅ | ✅ loading | — | — |
| `/panel/retencion` | ✅ | — | — | ✅ | 🟡 sin confirmación con nombre | ✅ | ✅ e2e | — | — |
| `/panel/rutinas` | ✅ | — | 🟡 foco | ✅ | 🟡 sin confirmación con nombre | ✅ | ✅ e2e | — | ✅ viewport |
| `/panel/rutinas/editar` | ✅ | ✅ | ✅ | ✅ | 🟡 sin confirmación con nombre | ✅ | ✅ loading | — | ✅ viewport |
| `/panel/rutinas/socio` | — | — | — | ✅ | — | ✅ | ✅ loading | — | — |
| `/panel/socios` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ e2e | — | ✅ viewport |
| `/panel/socios/[id]` | 🟡 no cambia la pantalla sola | — | ✅ | ✅ | ✅ | ✅ | ✅ loading | ✅ | ✅ viewport |
| `/panel/socios/[id]/editar` | — | — | — | ✅ | — | ✅ | ✅ loading | — | — |
| `/panel/socios/[id]/reglamento` | — | — | — | ✅ | — | ✅ | ✅ loading | — | — |
| `/panel/socios/duplicados` | ✅ | — | — | ✅ | — | ✅ | ✅ loading | — | — |
| `/panel/socios/importar` | ✅ | — | 🟡 teclado | ✅ | — | ✅ | ✅ loading | — | ✅ viewport |
| `/panel/socios/nuevo` | — | — | — | ✅ | — | ✅ | ✅ loading | — | — |
| `/panel/tareas` | ✅ | — | ✅ | ✅ | 🟡 sin confirmación con nombre | ✅ | ✅ loading | — | ✅ viewport |
| `/panel/transferencias` | ✅ | — | 🟡 teclado | ✅ | — | ✅ | ✅ loading | — | ✅ viewport |
| `/panel/vencen-hoy` | — | — | — | ✅ | — | ✅ | ✅ loading | — | — |
| `/panel/vender` | ✅ | — | ✅ | ✅ | ✅ | ✅ | ✅ e2e | ✅ | ✅ viewport |

**Qué quiere decir cada 🟡 de la tabla** (el script marca dónde mirar; ninguno de estos es un error confirmado):

- **4 "no cambia la pantalla sola"**: la carpeta no llama a `revalidatePath`, `router.refresh` ni `redirect`. En las pantallas de lectura (`/panel/pin`, `/panel/clases/tv`) no hace falta; en las demás la acción vive en un `acciones.ts` de otra carpeta que sí revalida. **No se revisó una por una**: lo que sí está probado en ejecución es lo de F3.1 (el botón vuelve) y los e2e de cada flujo (cobrar, anular, pausar).
- **8 "foco"**: el formulario se abre con un botón o es una tarjeta chica y no tiene `autoFocus`. Se arregló en plan nuevo y rutina nueva; el resto queda. **8 "teclado"**: el script vio un campo de monto, teléfono o DNI sin `inputMode` en esa carpeta; `fluidez-pantallas.test.ts` (que mira cada `<input name=…>`) dice que no hay ninguno suelto, así que casi seguro es un campo que se llama distinto: revisar.
- **10 "sin confirmación con nombre"**: la pantalla nombra una acción de baja, anulación, cobro o borrado y el script no vio un diálogo de confirmación en la carpeta. `botones.mjs` no aprieta esos botones por diseño; que piden confirmación con nombre y monto y que Cancelar no cambia nada lo prueban los e2e de cada flujo, no esta pasada.
- **Regla 14 y 20 (en vivo)**: no hay Realtime en el panel. Lo que existe: la campana y los pendientes del menú se renuevan cada 60 s y al volver a la pestaña; las últimas entradas, el kiosco y la TV de clases cada 20 a 30 s; la app del socio tiene la ocupación en vivo (`OcupacionEnVivo`). Una venta o un ingreso hecho en otra compu aparece en menos de un minuto, no al instante. **Suscribirse a Supabase Realtime por gimnasio es una pieza propia (CAL-04)** y toca permisos (qué tablas se publican y quién las escucha): queda en `PREGUNTAS.md`.
- **Regla 12** (mismo nombre en botón, aviso y registro) y **13** (teclado en la recepción): no se midieron por pantalla (ver la leyenda).
