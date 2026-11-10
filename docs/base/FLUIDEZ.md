# Fluidez: la pasada botón por botón

Pedido de Mateo (09/11): "que todo sea fluido: pensar que cuando apriete este
botón no quede estático porque no tiene cómo volver". Es la revisión de **cada
botón, cada hoja y cada pantalla**, con cada rol, en compu y en celular.
Completa lo de `docs/v2/07` (memoria, volver al origen) y `docs/v2/16`
(rapidez, que no se trabe), que siguen valiendo.

## Las 21 reglas (cada botón y cada pantalla las cumple todas)

1. **Responde al instante.** Entre el toque y el primer cambio en pantalla
   pasan menos de 100 ms: el botón se ve apretado, y si la acción tarda dice
   lo que está haciendo ("Cobrando…").
2. **Siempre termina.** Termina en éxito o en error, nunca a medias.
   - Éxito: dice qué pasó, con nombre y monto ("Cobrado $25.000 a Lucía").
   - Error: dice qué pasó y qué hacer, con Reintentar.
   - A los 10 s sin respuesta avisa "está tardando más de lo normal" y deja
     reintentar.
3. **El botón vuelve.** Después del éxito o del error, el botón queda para usar
   de nuevo, o desaparece si ya no corresponde. Nunca queda gris para siempre.
   Dos toques seguidos no hacen la acción dos veces (clave de operación,
   VD-34).
4. **Después de la acción, se sabe dónde se queda.** O se queda en la misma
   pantalla con el dato ya cambiado, o vuelve a donde estaba antes (VD-28):
   con el mismo filtro, la misma búsqueda y el mismo scroll. Nunca cae en una
   pantalla en blanco ni en Inicio sin motivo.
5. **Siempre hay salida.**
   - Cada pantalla tiene Volver o el menú.
   - Cada hoja y cada modal se cierra con la X, con Esc y con un click afuera.
   - En celular, el "atrás" del teléfono cierra el modal y no saca de la app.
6. **El "atrás" del navegador hace lo esperado**: cierra lo que está abierto o
   vuelve a la pantalla anterior con sus filtros.
7. **Nada se pierde.** Un formulario largo que se cierra sin querer guarda lo
   escrito como borrador. Si guardar da error, los campos siguen llenos.
8. **Formularios cómodos.**
   - El foco arranca en el primer campo y Enter envía.
   - El error aparece al lado del campo que lo tiene.
   - En celular, DNI, teléfono y monto abren el teclado numérico.
9. **Listas.**
   - Mientras carga se ve un esqueleto con la forma real.
   - Vacía, dice qué hacer y tiene el botón para hacerlo.
   - Al borrar o quitar algo, "Deshacer" durante 5 s donde se pueda.
10. **Confirmar solo lo que no tiene vuelta.** Y la confirmación dice qué va a
    pasar, con nombre y monto ("Anular el cobro de $25.000 a Lucía").
11. **Lo que no se puede usar no se muestra.** Un rol sin permiso no ve el
    botón, y un gimnasio que apagó una sección no la ve. Ningún botón que al
    tocarlo dice "no tenés permiso". Por la dirección directa sí: ahí da error
    con el motivo, nunca una lista vacía.
12. **La misma acción se llama igual en todos lados**: en el botón, en el aviso
    y en el registro (Cobrar → "Cobrado" → "cobró").
13. **Teclado en la recepción.** Tab va en orden lógico, Esc cierra, Enter
    confirma, y los atajos se ven (F2, Ctrl+K).
14. **En vivo donde importa.** Lo que pasa en otra compu, la tablet o el
    celular del socio (entradas, caja, pendientes, mensajes) aparece sin
    recargar.

15. **Errores con salida.** "No encontrado", error, sesión vencida y pago
    fallido tienen página propia, con el estilo del gimnasio o del panel, y
    siempre ofrecen "Volver" e "Ir al inicio".
16. **Internet y celular lentos.** Con la red y la CPU lentas simuladas
    (Playwright: 4G lento y CPU x4), todo muestra que está cargando y nada
    queda congelado ni en blanco.
17. **Nada salta al cargar.** Las imágenes tienen su lugar reservado, carga
    diferida y un color de fondo mientras llegan.
18. **El teclado del celular no tapa el botón** de guardar o confirmar.
19. **Cero errores en la consola**, y los errores del servidor quedan
    registrados para encontrarlos después.

20. **Todo sincronizado entre paneles en vivo** (CAL-04): lo que se hace en
    una compu aparece en las otras del mismo gimnasio (Supabase Realtime,
    filtrado por gimnasio, nunca de otro).
21. **Prueba de humo en producción después de cada publicación** (CAL-07): en
    el gimnasio demo `[demo]`, entrar por las 3 puertas, crear un socio,
    registrar un ingreso y cobrar. Corre en Actions (`humo-produccion.yml`).

## Cómo se hace

1. **Un recorrido automático** `scripts/e2e/botones.mjs`: por cada rol (dueño,
   encargado, recepción, profe, socio, super admin), en compu y en celular,
   abre cada pantalla de `scripts/mapa-pantallas.mjs` y toca cada botón y
   link que no esté marcado `data-peligro`. Chequea las reglas 1, 2, 3, 5, 6, 11, 16 y 19:
   - El botón cambia en menos de 100 ms.
   - Ningún "…ando" queda más de 10 s.
   - No hay errores de consola.
   - El modal cierra con Esc.
   - Hay forma de volver.
   - El "atrás" del navegador no deja la pantalla rota.

   Los botones peligrosos (anular, borrar, dar de baja) se prueban en su propio
   e2e con datos de prueba.
2. **Una revisión a mano, pantalla por pantalla,** para lo que la máquina no
   ve: las reglas 4, 7, 8, 9, 10, 12, 13, 14, 15, 17 y 18. Va en una tabla en
   `FLUIDEZ-PANTALLAS.md` (pantalla × regla, con ✅ o lo que se arregló), con
   capturas mirándolas.
3. Cada falla se arregla en la pantalla. Si toca plata o permisos, se anota en
   `PREGUNTAS.md`.

**LISTO SI:**
- `botones.mjs` en verde para los 6 roles en compu y en celular.
- `FLUIDEZ-PANTALLAS.md` con todas las pantallas en ✅.
- El barrido (`e2e:barrido`) en verde.
