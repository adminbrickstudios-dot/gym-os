# Diseño

**Modo gym oscuro, minimalista, con emojis.** Inspiración: el esqueleto de
yadeportes (inicio con saludo, accesos grandes, cuatro números, "ahora y lo que
sigue") y la calidez de app de Santa María. Cuando Mateo pase capturas de esos
dos, se guardan en `docs/producto/referencias/` y se comparan pantalla por
pantalla.

## Base (ya existe, se respeta)

- Colores salen de los datos del gimnasio: `color_fondo` y `color_acento` → `propsMarca()` arma todo (tono oscuro o claro automático). Por defecto grafito `#14161b` y verde `#2fbf5b`.
- Letra Archivo (variable): títulos condensados y pesados (`.titular`, `.titulo`), números grandes (`.numero`).
- Estados con los colores de los discos olímpicos: verde (puede), amarillo (puede pero ojo), rojo (no puede), azul (información).

## Reglas visuales

1. **Un solo verde por pantalla**: la acción principal. El resto, botones neutros.
2. **Botones grandes**: mínimo 52 px de alto; en recepción, la acción del día (Entrada, Cobrar) es enorme.
3. **Emojis como íconos**, siempre el mismo emoji para la misma cosa en todo el sistema (tabla de abajo).
4. **Jerarquía por tamaño de letra**, no por cajas dentro de cajas.
5. **Lo vacío está vacío**, con una frase y una acción ("Todavía no hay socios. ➕ Cargar el primero · 📥 Importar desde Excel").
6. **Cada sección dice qué es** en una línea, debajo del título.
7. **Nada de tablas en el celular**: las filas pasan a tarjetas.
8. **Textos en castellano rioplatense**, cortos, en segunda persona ("Cobrale", "Te falta cargar…").

## Emojis fijos

| Cosa | Emoji | Cosa | Emoji |
|---|---|---|---|
| Inicio | 🏠 | Caja | 💵 |
| Entrada | 🚪 | Vender | 🛒 |
| Clases | 🗓️ | Resultado | 📈 |
| Vencen hoy | ⏰ | Transferencias | 🧾 |
| Socios | 👥 | Planes | 🏷️ |
| Retención | 📉 | Equipo | 🧑‍🤝‍🧑 |
| Rutinas | 💪 | Configuración | ⚙️ |
| Avisos | 🔔 | Prospectos | 🌱 |
| Página | 🌐 | Mi cuenta | 👤 |
| Dueño | 👑 | Recepción | 🛎️ |
| Profe | 💪 | Socio | 🏃 |
| BRIK | 🧱 | QR | 📲 |

## Componentes (uno de cada, siempre el mismo)

`docs/DISENO.md` (ítem DIS-0) los documenta con código. Lista mínima:
botón (principal, normal, peligro, chico, ícono) · tarjeta · fila de lista
(con acción a la derecha y deslizable en celular) · campo con etiqueta, ayuda
y error · selector · interruptor · pestañas · píldora de estado · aviso (éxito,
error, info, con acción) · estado vacío · cabecera de sección · número grande
con etiqueta · hoja inferior (en celular, reemplaza a los modales) · buscador
con Ctrl+K · confirmación ("¿Seguro?", con el nombre de lo que se borra) ·
toast ("Guardado ✓", "Cobrado $12.000 ✓", con deshacer cuando se puede).

## Animaciones (pocas y con sentido)

| Momento | Animación | Duración |
|---|---|---|
| Tocar un botón | Se achica apenas (`:active` en CSS) | inmediato |
| Veredicto de entrada | El color llena la pantalla desde el centro, nombre y motivo entran después | 200 ms |
| Cobro hecho | Tilde que se dibuja + el monto | 400 ms |
| Número que cambia en Inicio | Cuenta de un valor al otro | 300 ms |
| Abrir hoja inferior | Sube desde abajo | 180 ms |
| Cargando | Esqueleto con la forma real (nunca un spinner solo) | — |
| QR del socio | Borde que gira mientras el código es válido | continuo |

Todas respetan `prefers-reduced-motion` (se cambian por un fundido).

## Sonido (solo en Entrada, se puede apagar)

Verde: un "ding" corto. Rojo: dos tonos graves. Amarillo: uno medio.

## Cómo se arma cada tipo de pantalla

- **Inicio** (todos los roles): saludo + fecha + gimnasio → accesos rápidos editables → 4 números → "Ahora y lo que sigue" → avisos.
- **Lista** (socios, ventas, prospectos): buscador arriba, filtros en píldoras, filas grandes, acción principal flotante en celular.
- **Ficha** (socio, clase): cabecera con estado y acciones grandes, pestañas debajo.
- **Formulario**: un paso por pantalla en celular cuando son más de 6 campos; guardar siempre visible abajo.
- **Recepción**: pantalla partida en compu (izquierda la acción, derecha el contexto: lo que pasó hoy).
