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
