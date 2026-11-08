# Diagnóstico de los recorridos que fallan (BASE-0, 08/11 de madrugada)

Hecho desde la nube (Linux, app compilada con Next 15, **base nueva** y cada
recorrido corrido **solo**, no en cadena). Sirve para separar lo que es
cuelgue o arrastre de la cadena de lo que está roto de verdad. Los recorridos
que fallan en tu compu con Next 16 son casi los mismos: estos fallos no son el
cuelgue.

## Rotos de verdad (fallan solos, con base nueva)

| Recorrido | Lo que dice | Pista |
|---|---|---|
| `vd-13` | Después de cobrar, la persona sigue en Para hacer hoy, y **error de React #310** en `/panel/hoy` (→ `/panel/tareas`): un componente llama a distinta cantidad de hooks entre un render y otro | Buscar un `return` antes de un hook o un hook dentro de un `if`, en lo que se monta después de cobrar (la hoja Cobrar o `tareas/Hoy.tsx`). Con `next dev` se ve el mensaje completo. |
| `vd-7` | La simulación dice "Paga la cuota entera: cubre del 11/11 al 11/12. $25.000" y la hoja dice "Cubre del 8/11 al 17/11" | **Toca plata**: la simulación y lo que cobra la hoja no coinciden. No se arregla solo: se averigua cuál de las dos está mal y se reporta (`PREGUNTAS.md`). Puede ser también que la prueba dependa de la fecha (el demo se siembra con `hoy`). |
| `vd-8` | "El PIN equivocado no avisó" (todo lo demás del recorrido pasa) | Dejar pasar con PIN: un PIN mal puesto tiene que decir algo. **Toca permisos**: reportar si el PIN equivocado deja pasar. |
| `vd-41` | "El encargado sin permiso: datos 0, aviso 0" | El encargado sin permiso no ve los gastos, pero **tampoco ve el aviso** de que no tiene permiso. La regla es "permiso denegado = error, nunca lista vacía". |
| `ent-6` | El socio escanea el QR de la pared y entra, pero la tablet nunca muestra "¡Pasá, Testigo!" (espera 30 s) | La tablet del kiosco no se entera del ingreso hecho desde el celular. |

## Pasan solos (fallaban en la cadena)

| Recorrido | Qué quiere decir |
|---|---|
| `vd-4` | Falla en la cadena y pasa solo: arrastre de lo que dejaron los recorridos anteriores en la misma base (turnos de caja abiertos, cobros, configuraciones cambiadas) o falta de memoria. |

## Cómo seguir

1. Correr en tandas chicas y con la base nueva cada tanda
   (`scripts/local/levantar.sh nueva`), no 200 seguidos: así no se queda sin
   memoria y no hay arrastre.
2. Lo que falla solo con base nueva es un error de verdad (tabla de arriba).
   Lo que solo falla en cadena: la prueba tiene que dejar la base como la
   encontró, o no depender de lo que dejó la anterior.
3. `vd-7` y `vd-8` tocan plata y permisos: se averigua, se escribe en
   `PREGUNTAS.md` y se sigue con lo demás.
