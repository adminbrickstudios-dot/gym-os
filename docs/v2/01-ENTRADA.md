> reemplazado por docs/base/PULIDO.md, docs/base/DISENO.md y docs/base/estado/mostrador.md en lo que se contradiga (aviso flotante, ventana, colores, estado de cada función); lo que no choca sigue valiendo.

# 01 · La Entrada que está en todos lados

Hoy la entrada vive en `/panel/entrada` (`Puerta.tsx`): buscador, veredicto a
pantalla completa, cobrar, dejar pasar, deshacer, invitados, cámara, sin
internet. **Todo eso se queda.** Lo nuevo es que la Entrada se puede usar
**desde cualquier pantalla del panel**, sin perder lo que estabas haciendo.

## 1. Las tres formas (D17: conviven y se adaptan)

| Forma | Cómo es | Cuándo se usa |
|---|---|---|
| **A · Se abre sola al tipear** | En cualquier pantalla del panel, si el foco no está en un campo de texto, tocar un número (fila de arriba o teclado numérico USB) abre la ventana con ese número ya escrito. Un lector de QR o de llavero (que "escribe" y manda Enter) también la abre. | La compu del mostrador con teclado numérico. |
| **B · Botón** | En **Inicio**: un botón grande "🚪 Entrada" (el principal, verde). En **el resto**: un botón redondo flotante abajo a la derecha (en el celular, el centro de la barra de abajo). Atajo: `F2` o `Ctrl+E`. | Cualquier compu, tablet o celular. |
| **C · Barra fija** | Una barra angosta a la derecha (en compu ≥ 1280 px) con el campo DNI siempre visible y las últimas 5 entradas en vivo. | La compu del mostrador que no hace otra cosa. |

**Se adaptan entre sí:** si la barra fija está prendida, tipear un número
escribe en la barra (no abre otra ventana) y el veredicto aparece flotando
encima; si la ventana flotante está abierta, el botón se transforma en
"cerrar". Una sola Entrada activa a la vez, siempre con el mismo estado.

**Configuración** (Configuración → Entrada, por gimnasio, y "en esta compu"
para pisarla en una compu puntual, guardado en el navegador):
- Abrir al tipear: sí / no (por defecto sí)
- Barra fija: no / sí (por defecto no; "en esta compu" la puede prender)
- Anotar solo cuando está en verde: sí / no (por defecto no: Enter anota)
- Cerrar sola después de anotar: en 3 s / 6 s / no (por defecto 4 s)
- Sonido: sí / no (ya existe, por compu)
- Quién puede usarla: dueño, encargado, recepción (siempre); profe: solo ver

## 2. La ventana (cómo se ve)

Efecto "iPhone": vidrio esmerilado (fondo desenfocado detrás, borde fino
claro, sombra suave), esquinas de 24 px, entra con una animación corta
(escala 0,96 → 1 + opacidad, 160 ms) y sale igual al revés. Centrada en
compu, hoja que sube desde abajo en celular. Esc o tocar afuera la cierra y
**vuelve exactamente a donde estabas** (foco incluido).

**Paso 1 · Escribir.** Número enorme (el DNI con puntos a medida que se
tipea: 30.123.456), debajo "Enter para buscar · Esc para cerrar". Si escribe
letras, busca por nombre (como el buscador de hoy). Mientras escribe, abajo
aparecen hasta 3 coincidencias (por DNI, número de socio o nombre);
flechas + Enter eligen.

**Paso 2 · El veredicto** (lo calcula `calcular_acceso`, nunca la pantalla):
- Arriba, del color del semáforo, a todo el ancho: el texto listo de la
  base ("✅ Al día hasta el 30/11").
- Foto grande (si no tiene, iniciales) para comparar con la persona.
- Nombre y apellido, número de socio, plan.
- **Cuánto le falta**: "Vence en 15 días (el 20/11)" o "Venció hace 3 días".
- Lo que hay que decirle, en una línea: "Decile que en 15 días vuelve a
  pagar", "Cobrale $32.000 antes de pasar", "Es su primer día: dale la
  bienvenida 🎉".
- Chips de aviso si corresponde: 🎂 cumple hoy · ✍️ falta firmar · 💬 le
  prometieron pagar ayer · 💳 debe $X · 🧒 menor (responsable: …) · 🗓️ tiene
  Spinning 19:00 · ⭐ 100 entradas.
- Botones (grandes, con su tecla):
  - **Enter · ✅ Anotar entrada** (o "Entró" si ya se anotó solo)
  - **C · 💵 Cobrar** → abre "Cobrar" (`02-COBROS-Y-CAJA.md`) **dentro de la
    misma ventana**; al cobrar, vuelve al veredicto ya en verde y anota.
  - **D · 🤝 Dejar pasar** → motivo + modo de fiado (D19)
  - **F · 👤 Ficha** → abre la ficha (y Volver regresa a la Entrada)
  - **Esc · Cerrar**

**Paso 3 · Anotado.** Tilde animado, "Entró 19:04 · lleva 12 este mes", se
cierra sola a los N segundos (config) y queda lista para el próximo DNI.

**DNI que no existe:** "No hay nadie con el DNI 30.123.456" y un botón grande
**➕ Darlo de alta** (tecla A) que abre el **alta rápida dentro de la misma
ventana**: DNI ya puesto, nombre, apellido, celular, plan (botones), y
"Guardar y cobrar" → Cobrar → anotar entrada. Tres pantallas, sin salir de
donde estabas. Si es un **Interesado** con ese celular o DNI, lo ofrece:
"¿Es Juan Pérez, que preguntó el 2/11?".

## 3. Todas las situaciones (cada una con su texto y su botón principal)

La base ya resuelve la mayoría (`calcular_acceso`). Verificar cada una con
una prueba de base y sumar las que faltan.

| Situación | Color | Texto (ejemplo) | Botón principal | ¿Existe? |
|---|---|---|---|---|
| Al día | 🟢 | Al día hasta el 30/11 | Anotar | ✅ |
| Al día, vence pronto (≤ días de aviso) | 🟢/🟡 | Vence en 3 días (el 8/11): recordale | Anotar | ✅ (revisar texto "decile") |
| Vence hoy | 🟡 | Vence hoy: cobrale | Cobrar | ✅ |
| En días de gracia | 🟡 | Venció el 2/11 · le quedan 2 días de gracia | Cobrar / Anotar | ✅ |
| Vencido | 🔴 | Venció el 2/11 · debe $32.000 | Cobrar | ✅ |
| Nuevo, sin pagar todavía (alta online) | 🔴 | Se anotó por la web: falta el primer pago | Cobrar | ✅ |
| Primer día | 🟢 + 🎉 | Primer día: ¡bienvenido! | Anotar | 🆕 chip |
| En prueba (clase o días de prueba) | 🟢 | Clase de prueba (1 de 1) | Anotar | 🆕 depende de CLA-6/REV-1c |
| Pausado | 🔵 | En pausa hasta el 20/11 (viaje) | "Volvió antes" | ✅ |
| Suspendido | 🔴 | Suspendido: habla con el dueño | Dejar pasar (solo dueño/encargado) | ✅ |
| Dado de baja | ⚫ | Se dio de baja el 1/10 | Volver a dar de alta | ✅ |
| Pack sin clases | 🔴 | Usó las 8 clases del pack | Cobrar pack | ✅ |
| Pase diario usado / reingreso | 🟢 | Pase de hoy · reingreso | Anotar | ✅ |
| Fuera del horario del plan | 🔴 | Su plan es de 7 a 14 h | Cobrar diferencia / Dejar pasar | ✅ |
| Veces por semana agotadas | 🔴 | Ya vino 3 veces esta semana (plan 3x) | Dejar pasar | ✅ |
| **Ya entró, dentro de la visita (D24)** | 🟢 | Ya entró a las 15:10 (reingreso, no cuenta otra) | Cerrar | 🆕 VD-3 |
| **Ya entró hace muy poco (anti-préstamo)** | 🟡 | Ya entró hace 4 min: ¿es la misma persona? (mirá la foto) | Anotar igual / Cancelar | 🆕 VD-3 |
| Debe $X (cuenta corriente) | 🟡 | Debe $12.000 | Cobrar / Anotar | ✅ |
| Prometió pagar y no pagó | 🟡 | Ayer dijo que pagaba hoy | Cobrar | ✅ (REV-1a) |
| Falta firmar | 🟡 | Falta firmar el reglamento | Firmar ahora / Anotar | ✅ (aviso) |
| Menor sin responsable cargado | 🟡 | Falta el adulto responsable | Ficha | 🆕 chip |
| Sede equivocada (plan de otra sede) | 🔴 | Su plan es de la sede Centro | Dejar pasar | revisar |
| Gimnasio cerrado (feriado/horario) | 🟡 | Hoy el gimnasio cierra a las 13 h | Anotar | revisar |
| DNI no existe | — | No hay nadie con ese DNI | Darlo de alta | 🆕 VD-6 |
| Sin internet | — | Sin internet: usando la copia de las 18:45 | (SEG-5) | ✅ |

## 4. Reingreso y anti-préstamo (D24)

- **Visita**: ventana configurable (por defecto **5 h**). Dentro de la
  ventana, un segundo paso del mismo socio por cualquier vía (DNI, QR,
  kiosco) devuelve "ya entró" (`repetido`), **no** crea otra entrada que
  cuente para estadísticas ni consume clase/pase. Pasada la ventana, es una
  entrada nueva. Reemplaza el doble toque fijo de 60 s de hoy
  (`registrar_ingreso`, `interval '60 seconds'`), que pasa a ser "minutos
  de anti-préstamo".
- **Anti-préstamo**: si la segunda pasada es por **otra vía o desde otro
  dispositivo** y en menos de N minutos (por defecto 60, configurable,
  0 = apagado): amarillo "Ya entró hace 4 min por QR: ¿es la misma
  persona?" con la foto. Queda registrado como alerta para el dueño.
- **QR dos veces** desde la app: "Ya entraste a las 15:10 ✓" (verde, sin
  contar otra).
- Configuración → Reglas: "Una visita dura (horas)", "Avisar si vuelve a
  entrar antes de (minutos)", y el que ya existe "Volver el mismo día gasta
  otra clase del pack".
- **Toca acceso**: migración nueva que cambia `registrar_ingreso`; pruebas
  de base con momentos fijos (5 h menos 1 min = repetido; 5 h + 1 min =
  nueva; otra vía a los 4 min = alerta). Decidido por Mateo (D24).

## 5. Entradas en vivo (QR, kiosco, otra compu)

Hoy la recepción no se entera si alguien entró por QR o por la tablet.

- Un aviso chiquito arriba a la derecha (toast con vidrio), en **cualquier
  pantalla** del panel de dueño/encargado/recepción con la Entrada
  habilitada: "✅ Juan Pérez entró por QR · al día hasta 30/11" (verde),
  "⛔ Ana Gómez intentó entrar: vencida" (rojo, se queda hasta que se toca,
  con botón Cobrar). Tocarlo abre el veredicto en la ventana.
- Cómo: una función `entradas_desde(gimnasio, sede, desde)` (equipo del
  gimnasio) que devuelve las entradas e intentos posteriores a un momento;
  la pantalla la pide cada 4 s mientras la pestaña está visible (se pausa
  oculta). Sin Realtime por ahora (la imitación local no lo tiene y no es
  necesario); dejar el punto preparado para cambiarlo.
- La lista "Hoy" de la Entrada y la barra fija usan lo mismo y se actualizan
  solas.
- Configuración: "Avisar entradas por QR/tablet en todas las pantallas" sí/no.

## 6. Teclado numérico y lectores

- Teclado numérico USB: los números y Enter del keypad (`Numpad0..9`,
  `NumpadEnter`) funcionan igual que los de arriba. El punto/coma del keypad
  se ignora en DNI.
- Lector de QR/llavero USB: escribe rápido (< 30 ms entre teclas) y manda
  Enter. Distinguir: si el texto tiene formato de QR de socio (`mi_qr`) va
  por QR; si es número de llavero, por llavero; si no, DNI/búsqueda.
- La ventana nunca roba el foco a un campo de texto donde se está
  escribiendo (ej: el alta de socio, el buscador de Ctrl+K).

## 7. Salida

No hay registro de salida en esta versión (no hay molinete). La "visita"
dura N horas (D24). Si en el futuro hay molinete (ENT-5), la salida cierra la
visita antes. Mostrar en Inicio "adentro ahora: aprox. 23" = entradas de las
últimas 1,5 h (configurable: "una visita promedio dura"), con la aclaración
"aproximado".
