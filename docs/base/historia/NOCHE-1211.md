# La noche del 12/11 · Entrada en la esquina, avisos al instante y todo lo que falta

Pedido de Mateo (12/11, 21 h), con sus respuestas a las 4 preguntas (D61–D64 en `PREGUNTAS.md`).
Va como **fase E** en `RECTA-FINAL.md`, primera después de H2c y de lo que ya se está publicando.

---

## 1. Entrada en la esquina (lo que más le importa a Mateo)

Hoy la ventana de Entrada (`VentanaEntrada.tsx`, 1.051 líneas) se abre en el medio de la pantalla en
cuanto alguien toca un número fuera de un campo, en cualquier pantalla del panel. A Mateo le molesta en
la compu: tapa lo que estás haciendo.

### E1 · La barrita del DNI (D61, D62)
- **Tipear números fuera de un campo** (en cualquier pantalla del panel, compu) ya **no abre la ventana
  grande**: aparece una **barrita abajo a la derecha** con lo que vas escribiendo ("DNI 30 45…").
- Al terminar (Enter, o el lector USB, o 7–8 dígitos y una pausa corta), el **resultado sale en la misma
  barrita**: el color, nombre y apellido, la foto si tiene, el motivo en palabras ("Al día hasta 30/11",
  "Debe la cuota de noviembre") y **un solo botón principal** según el caso: Anotar entrada / Cobrar /
  Dejar pasar.
- Si es verde y está prendido "anotar solo en verde", se anota solo y la barrita muestra "Entró ✓".
- **Esc** cancela. **Tocar la barrita** abre la ventana grande con ese socio (lo de hoy: todo lo que
  hace la ventana sigue existiendo, ahí).
- Si escribís un nombre en vez de un número: la barrita muestra los 3 primeros que coinciden, con ↑ ↓.
- Nunca roba lo que estás escribiendo en un campo (como hoy). Nunca se abre con un PIN, la calculadora
  de billetes, un monto de Cobrar ni una hoja abierta.
- En el celular no cambia nada (la Entrada en el celular es su pantalla).
- Sigue la configuración de hoy: `resultado_entrada` = "aviso" pasa a ser esta barrita; "ventana" deja
  la ventana grande para quien la prefiera (por compu y por gimnasio, como ya está).

### E2 · El aviso de "entró" por QR (D63, D64)
Cuando un socio entra solo (QR del socio, QR de la pared, tablet, llavero, molinete):
- **Al instante** (menos de 1 s) aparece abajo a la derecha, en cualquier pantalla del panel, con el
  sonido "ching" si el sonido está prendido (D50).
- **1,5 s grande**: animación de entrada (sube y aparece, 200 ms), foto, nombre y "Entró por QR · al día
  hasta 30/11", con el borde del color.
- Después **se achica a una pastilla** que queda unos **8 s** más. Tocarla (o tocar el aviso grande) lo
  **fija**: queda abierto con Ver ficha, Cobrar, Anular la entrada. Pasar el mouse encima lo frena.
- **Rojo** (no pudo entrar): no se achica; queda grande hasta que alguien lo atienda o lo cierre (como hoy).
- **Amarillo** (entró con aviso): 1,5 s grande y queda la pastilla con el motivo.
- Se apilan como máximo 3; los demás se juntan en "+4 entradas más" (que abre Últimas entradas).
- `prefers-reduced-motion`: sin animación, solo aparece y se va.

### E3 · Al instante de verdad
Hoy los avisos llegan por un pedido cada 4 s (`entradas-vivo.ts`). Con 20 gimnasios y 2–3 compus por
gimnasio son decenas de pedidos por segundo a la base, todo el día, y el aviso llega hasta 4 s tarde.
- **Supabase Realtime** (canal por gimnasio, solo lo de ese gimnasio, con la sesión de quien mira).
- Si Realtime se cae, vuelve al pedido periódico **cada 30 s** y lo dice en chico ("avisos con demora").
  Nunca un fallback silencioso.
- Probado: dos navegadores, uno entra por QR, el otro lo ve en menos de 1 s (e2e en Actions).
- `supabase-local.mjs` no imita Realtime: si hace falta, que el e2e use el pedido periódico y una prueba
  aparte mida Realtime contra el proyecto real con el gimnasio demo.

### Cómo se prueba la fase E
- e2e en Actions, compu y celular: tipear un DNI en Caja → la barrita → el resultado → Anotar; Esc;
  nombre con ↑ ↓; un campo con foco no se roba; el QR en otro navegador → el aviso en menos de 1 s →
  1,5 s grande → pastilla → tocar la fija → Cobrar.
- Las 21 reglas de `FLUIDEZ.md` y capturas mirándolas (compu 1440, notebook 1280, celular).
- La pregunta central no cambia: la barrita y el aviso solo muestran lo que dicen `estado_acceso` /
  `registrar_ingreso`.

---

## 2. Lo que está mal armado y hay que enderezar (estructura)

| # | Qué | Por qué importa |
|---|---|---|
| E4 | Partir `VentanaEntrada.tsx` (1.051 líneas) en piezas: barrita, veredicto, alta rápida, prueba gratis; que lo pesado (cámara, alta, cobro) se cargue solo cuando se usa | Hoy viaja entero a todas las pantallas del panel: más lento para abrir cualquier cosa |
| E5 | Los pedidos periódicos que quedan (caja, transferencias, mensajes) a Realtime o a cada 30 s con "actualizar" | Lo mismo que E3: carga constante sobre la base con 20 gimnasios |
| E6 | Recepción sin internet: si se corta la conexión, la barrita lo dice en rojo ("Sin internet: anotá en papel") y nada parece andar cuando no anda. La cola offline real queda como función nueva (N) | Hoy, sin internet, ¿qué ve la recepción a las 19 h? Probarlo con Playwright offline |
| E7 | Un solo nombre para el producto en pantalla. Mateo compró `pasegym.com`: se anota la pregunta en `PREGUNTAS.md` ("¿Base o Pase?"); por defecto no se toca el nombre hasta que conteste | Que la página diga Pase y el panel Base confunde |
| E8 | Revisar las lecturas que no pasan por `contexto_pantalla` y las pantallas con más de 2 viajes a la base (lo de `VELOCIDAD.md`), con la medición de F0.1 | La velocidad en producción todavía no está medida |

---

## 3. Lo que tienen otros sistemas y Base no (después de terminar; apagado por defecto)

Comparado con Glofox, PushPress, Gymdesk, Fitco y lo que piden los gimnasios argentinos (D64: primero
terminar, después sumar). Base ya tiene: kiosco, QR, llavero, molinete, apto físico (solo fecha, sin
diagnóstico), congelamientos, planes familiares, lista de espera, débito automático (apagado),
cumpleaños, retención, push.

| # | Qué | Nota |
|---|---|---|
| N-A | **Factura electrónica (ARCA)** por cada cobro, automática o con un toque | Lo piden casi todos los gimnasios en Argentina. Necesita los datos fiscales de cada gimnasio y un proveedor con API: el agente lo deja diseñado y con pregunta a Mateo, no contrata nada |
| N-B | **Entradas sin internet**: la recepción sigue anotando y se sincroniza al volver, con el veredicto de la última lectura y el aviso "sin confirmar" | Que nadie entre gratis ni quede afuera (regla de CLAUDE.md): el veredicto offline se marca y se revisa |
| N-C | **Traé un amigo**: el socio comparte su link, el que se anota queda con origen "recomendado" y quién lo trajo; el beneficio lo define el gimnasio | `origenes_alta` ya tiene "recomendado" |
| N-D | **Reportes de plata**: ingreso mensual recurrente, bajas del mes y cuánto deja un socio en promedio, en Resultado | Lo tienen todos; los números salen de lo que ya está guardado |
| N-E | **Lista de espera con aviso** cuando se libera un lugar de una clase (si no está ya completo) | Revisar qué hace hoy |

---

## 4. Lo que depende de Mateo (no lo hace el agente)

| Qué | Por qué | Cuándo |
|---|---|---|
| Conectar los dominios en Vercel (5) y el cambio de variables cuando el agente avise | D1 | Cuando el agente avise, fuera de 16–22 h |
| `BRIK_ADMIN_MAIL` / `BRIK_ADMIN_CLAVE` en GitHub Secrets | Sin eso no hay prueba de humo con sesión real en producción | Cuando pueda |
| `COPIA_CLAVE`, o **Supabase Pro** (copias diarias automáticas) | Hoy se publica sin copia | Antes de sumar otro gimnasio |
| **Vercel Pro** | El plan Hobby de Vercel no permite uso comercial; Temple Gym ya paga | Antes de cobrarle a otro gimnasio |
| Su pasada visual y la prueba del dueño (`PRUEBA-DUENO.md`) | F8 | Al final |
| Contestar `PREGUNTAS.md` (Base o Pase, factura ARCA, precios) | Decisiones de producto | Cuando pueda |

---

## 5. El orden de la noche
1. Lo que ya está publicándose (PR #18, #19 y el resto) y H2c.
2. **Fase E** (E1, E2, E3 primero; E4 a E8 después).
3. El resto de `RECTA-FINAL.md` en orden: Z, 0, 1–9, R, Q.
4. Si sobra tiempo: N-A a N-E, apagadas por defecto, en la fase N.
5. F8: el cierre, "LISTO PARA TU PASADA".
