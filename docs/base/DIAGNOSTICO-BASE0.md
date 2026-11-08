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

---

## Ronda en la compu de Mateo (08/11, Next 16.4.5, app compilada, tandas de 20 con base nueva)

- `scripts/diag/accion-colgada.mjs 50` → **colgadas 0 de 50** (el cuelgue está resuelto con Next 16).
- Cadena entera en tandas: 220 recorridos, **171 en verde, 49 fallan**. Vueltos a correr solo los 49 en tandas nuevas: **42 siguen fallando**
  (7 eran arrastre: `vd-13`, `vd-41`, `vd-8`, `ent-6`, `ent-9`, `adm-3`, `super-admin` pasan al correrlos aparte).

### Arreglado en esta ronda
| Recorrido | Qué era |
|---|---|
| `pla-4`, `vd-46d` | **Roto de verdad**: la vista previa del aumento de precios mandaba a `vista_aumento` un argumento (`p_motivo_sin_aviso`) que la función no tiene → "No existe la función". Arreglado en `planes/acciones.ts`. |
| `vd-41` | El encargado sin permiso veía "sección apagada"; ahora dice que le falta el permiso. |
| `vd-7`, `vd-8` | Defectos de la prueba (orden y selector); la base no cambió. Ver `PREGUNTAS.md`. |

### Todavía fallan (42): hay que mirarlos uno por uno
Se cortan por espera (selector que ya no existe porque la pantalla cambió en VD-5/VD-12): `vd-10`, `vd-18`, `vd-6`, `vd-9`, `vd-29`, `vd-46a`, `vd-46r`,
`vd-63`, `panel-vender`, `panel-equipo`, `caj-4`, `caj-5` (tickets de caja / Storage simulado), `vd-27`.
Dicen qué esperaban: `vd-12` y `vd-12b` (más de 4 números / gráficos: hay que decidir la regla, BASE-4), `vd-2` (Cobrar no es el principal), `vd-11`, `vd-15`,
`vd-19`, `vd-20`, `vd-31`, `vd-38` (aviso de salud), `vd-40`, `vd-46e`, `vd-49` (caja: **plata**), `vd-5` (recibo), `vd-62`, `com-11`, `rev-3`.
Sin motivo en el resumen (el script cae con una excepción): `vd-3`, `vd-37`, `vd-42`, `vd-46c`, `vd-46f`, `vd-46j`, `vd-46t`, `com-13`.
`vd-22` y `vd-44`: `ENOTFOUND demo.localhost` (el entorno de esta compu no resuelve el host de pruebas para la API; no es de la app).
`vd-35`, `vd-39`: el checkbox no cambia de estado al tocarlo.
Los logs de cada una quedan en `.local/e2e-falla-*.log` (no se suben).

### Vuelta 2 (08/11): quedan 30
Arreglados además: vd-46c/j/t (Vender ya no arma la cuota sin `&cuota=1`), vd-22/42/44 (helper `api` en `comun.mjs`: el cliente de pedidos no resuelve
`demo.localhost` en Windows), vd-10 y panel-vender (el motivo del descuento es una lista, VD-46C), rev-3 (`esperarCobro` sigue con motivo si la base frena el doble cobro, VD-50),
vd-18 (botón Agregar del producto), pla-4/vd-46d (falla real, ver arriba).
Siguen fallando, al correrlos de nuevo en 2 tandas con base nueva: caj-4, caj-5 (tickets de caja), panel-equipo, com-11, com-13 (no hay clase pasada en el demo),
vd-3, vd-5 (recibo), vd-6, vd-9, vd-11, vd-12, vd-12b, vd-15, vd-19, vd-20, vd-27, vd-29 (la ventana de Entrada no se monta en /panel para esa sesión), vd-31, vd-35, vd-37, vd-38,
vd-39, vd-40, vd-46a, vd-46e, vd-46f, vd-46r, vd-49 (plata), vd-62, vd-63.
