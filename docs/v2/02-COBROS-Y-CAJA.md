> reemplazado por docs/base/RECTA-FINAL.md (H1: Caja por medio, Transferencias en dos pestañas), docs/base/PULIDO.md y docs/base/estado/mostrador.md en lo que se contradiga; lo que no choca sigue valiendo.

# 02 · Cobros y caja

Hoy existe mucho (ver inventario en `00-LEEME.md` → `docs/paneles/`): medios
por gimnasio, dos medios, recargo, descuentos con tope, convenios, cupones,
cuenta corriente, "dejar pasar" con tope, "prometieron pagar", PIN, caja con
arqueo ciego, historial, actividad del equipo. **Se queda todo.** Lo que
cambia: cobrar es **un solo flujo** que aparece donde se lo necesita, los
modos de cobro tienen pantalla, el fiado tiene tres modos, y la caja se
cierra sola.

## 1. Cómo cobra cada gimnasio (pantalla nueva)

La base ya tiene `planes.renovacion` (`continua` / `desde_pago` / `dia_fijo`),
`planes.dia_fijo`, `reinicio_tras_dias` y `tolerancia_dias`, sin pantalla.

**Configuración → Cobros → "Cómo vencen las cuotas"** (por gimnasio, y cada
plan puede pisarlo en su editor):

| Modo | Qué significa | Ejemplo |
|---|---|---|
| **Desde el día que paga** (`desde_pago`) | Cada uno vence un mes después del día que pagó | Pagó el 20/11 → vence el 20/12 |
| **Continua** (`continua`, el de hoy) | El mes nuevo arranca cuando terminó el anterior, aunque pague tarde | Vencía el 10, pagó el 15 → vence el 10 del mes siguiente |
| **Día fijo** (`dia_fijo`) | Todos vencen el mismo día; se paga del día X al día Y | Todos pagan del 1 al 10 |

**Día fijo, alguien que se anota a mitad de mes (D18):** por defecto **paga
proporcional** a los días que faltan hasta el día fijo (redondeado a $100,
configurable), y desde ahí entra al ciclo de todos. Opciones en
Configuración: proporcional · mes entero (le cubre hasta el día fijo del mes
siguiente) · gratis hasta el día fijo. **Siempre se muestra el cálculo antes
de cobrar** ("10 días de 30 = $10.700").

**Ventana de pago del día fijo:** "se paga del 1 al 10" = vence el 1, con 10
días de gracia (usa los días de gracia que ya existen). Vencen hoy lo muestra
como "período de pago (día 4 de 10)".

Cada cambio de modo se aplica a los cobros **nuevos**; lo ya cobrado no se
toca. Va con prueba de base (proporcional exacto, febrero, día 31, cambio de
modo con socios activos).

## 2. Cobrar — un solo flujo, en todos lados

Se abre desde: la ventana de Entrada (tecla C), la ficha del socio, Vencen
hoy, Retención, el alta de socio, la campana ("prometió pagar"), Ctrl+K
("cobrar a Juan"), y la app de recepción en el celular. Siempre el mismo
componente (`Cobrar`), en una hoja flotante con vidrio, que al terminar
**vuelve al lugar de origen**.

**Arriba:** el socio (foto, nombre, estado) y **qué debe**: "Cuota de
noviembre — Plan Full — $32.000 · cubre del 20/11 al 19/12". Si debe más de
un período o tiene cuenta corriente, lo lista. Sugerido según el modo de
cobro y el plan (la base lo calcula: `precio_cuota` / `proximo_periodo`).

**El cuerpo (todo en una pantalla, sin pasos innecesarios):**
- **Qué**: la cuota sugerida ya elegida; "cambiar plan" (lista de planes),
  "+ producto", "+ matrícula", "+ deuda".
- **Medio**: botones grandes con los medios que el gimnasio acepta
  (💵 Efectivo · 🏦 Transferencia · 💳 Débito · 💳 Crédito · 📱 MercadoPago ·
  📒 A cuenta). "➗ Dos medios" ya existe.
- **Monto**: lo calculado; descuento (motivo, tope de la recepción), recargo
  visible, cupón, convenio — cada uno como línea aparte.
- **Transferencia**: foto del comprobante opcional (ya existe el bucket).
- **Cuándo**: por defecto ahora. "Cobré otro día" (fecha y hora) solo
  dueño/encargado, con motivo; queda marcado en la auditoría.
- **Quién cobra**: la persona del PIN activo ("👤 Atiende Sofi").
- **Botón**: "Cobrar $32.000" (verde, Enter). Al cobrar: tilde, "Recibo por
  WhatsApp" (texto ya escrito con detalle y hasta cuándo cubre), y vuelta al
  origen (si vino de la Entrada: veredicto verde y anota).

**Rápido de verdad:** desde la Entrada, un vencido con el monto justo en
efectivo se cobra con **C → Enter → Enter** (abrir, efectivo por defecto,
cobrar). El medio por defecto es configurable ("el medio que más se usa").

**Seña / pago parcial:** "Paga una parte" → queda el resto como deuda en
cuenta corriente (si el gimnasio la tiene prendida) y el período **no** se
cubre hasta completar, salvo que el gimnasio elija "una parte cubre igual"
(apagado por defecto). Toca plata: prudente por defecto.

**Doble cobro (REV-6a):** si la misma cuota del mismo socio se cobró hace
menos de 2 minutos (otra compu), avisar "Ya se cobró hace 40 s (Sofi)" y
pedir confirmación. Esto **sí** lo decide Mateo (REV-6a sigue 🟡): mientras
tanto solo el aviso, sin frenar.

## 3. Dejar pasar sin pagar — fiado (D19)

**Configuración → Cobros → "Dejar pasar sin pagar"**, un selector de tres:

1. **La recepción hasta N días** (por defecto 3): dentro de eso decide sola,
   con motivo ("paga mañana", "paga a la tarde", "se olvidó la plata",
   "otro"); más días pide el **PIN del dueño o del encargado**.
2. **Siempre con PIN** del dueño o encargado.
3. **Libre con registro**: la recepción decide, queda anotado y el dueño lo
   ve en la lista.

Siempre:
- Queda un hecho con quién, cuándo, motivo y "promete pagar el …".
- Aparece en Inicio del dueño ("Dejados pasar hoy: 3") y en Vencen hoy
  ("Prometieron pagar"), y en la Entrada del día prometido ("Ayer dijo que
  pagaba hoy").
- El tope por día que ya existe (D1) sigue valiendo, y a suspendidos y dados
  de baja solo los deja pasar dueño o encargado.

## 4. Caja por turno, se cierra sola (D20)

Hoy: abrir con fondo, movimientos con foto, cerrar con arqueo ciego, caja
olvidada que obliga a cerrar antes de abrir otra.

Lo nuevo:
- **Turno = caja de la persona.** Al abrir la Entrada sin turno abierto, se
  ofrece "Abrir mi turno" (fondo sugerido = lo que dejó el turno anterior).
  Cambio de turno: "Cerrar mi turno" (arqueo ciego) → el siguiente abre.
- **Cierre automático**: una caja abierta de un día anterior **es** "cerrada
  sin contar" (se calcula, no depende de un cron). **La hora de corte la
  elige el gimnasio** (por defecto 00:00; un gimnasio 24 h pone la de su
  cambio de turno) y también "un turno abierto más de N horas" (por
  defecto 14). La venta pertenece al turno, no al reloj. Al primer acceso del día
  se registra el cierre con estado `sin_contar`, el esperado calculado y
  nadie como responsable del conteo. El dueño la ve en Caja → "Para revisar"
  y la puede contar después ("conté $X") o dejarla así con motivo.
- **Reporte del turno** (X) y **del día** (Z): esperado vs contado por medio,
  SOBRA / FALTA en grande, calculadora de billetes (opcional), ventas,
  retiros, anulaciones y dejados pasar del turno. Para compartir por
  WhatsApp.
- Configuración → Caja: "Caja por turno" (por defecto) · "Una caja por día";
  "Pedir conteo de billetes" sí/no; "Fondo fijo" $.

## 5. Anti-robo: todo queda escrito

Ya existen la actividad del equipo, el control de la puerta y el historial
de cambios. Se juntan en **Dueño → Control** (una línea de tiempo filtrable):
- Cobros, anulaciones (con motivo y quién aprobó), descuentos, cobros con
  fecha atrasada, dejados pasar, cajas con diferencia o sin contar, cambios
  de precio y de configuración, entradas anuladas, invitados.
- **Alertas** (campana del dueño + resumen del día): anulación, descuento
  mayor al X %, caja con faltante, dejar pasar sobre el tope, cobro con fecha
  vieja, reingreso sospechoso (anti-préstamo).
- Nada se borra: anular es un hecho nuevo, no un delete.
- Filtros: persona, tipo, fecha. Exportar a Excel.
