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
