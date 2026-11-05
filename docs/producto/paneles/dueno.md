# 👑 Panel del dueño (y encargado)

Celular primero. El encargado ve lo mismo salvo lo marcado en `03-ROLES.md`.

## Menú

```
🔍 Buscar…                     Ctrl K
🏠 Inicio

HOY
🚪 Entrada            quién entra y por qué
🗓️ Clases de hoy       anotados, presente, espera
⏰ Vencen hoy          a quién cobrarle hoy
🔔 Avisos             lo que hay que mandar hoy

SOCIOS
👥 Socios             todos, con su estado
🌱 Prospectos         los que preguntaron o se registraron
📉 Retención          los que se están yendo
💪 Rutinas            ejercicios y rutinas

PLATA
🛒 Vender             cuotas, pases, packs, productos
💵 Caja               turnos, retiros, cierres
🧾 Transferencias     comprobantes por aprobar
📈 Resultado          cómo viene el mes

GIMNASIO
🏷️ Planes y productos  precios y aumentos
🧑‍🤝‍🧑 Equipo            personas, claves, permisos
🌐 Página             tu página y las altas online
⚙️ Configuración      todo lo demás
👤 Mi cuenta
```
Las secciones apagadas no aparecen. El menú es igual en compu (lateral) y celular (hoja que sube).

## Inicio

1. **Saludo**: "Buenas tardes, Sofía 👋 · miércoles 4 de noviembre · Olympo Gym".
2. **Primeros pasos** (mientras falte algo, ONB-1): barra de progreso + el próximo paso como botón.
3. **Alertas** (solo si hay): diferencia de caja, caja olvidada, transferencias por aprobar, débitos fallidos. Cada una con su botón.
4. **Accesos rápidos** (editables, ✅): por defecto 🚪 Entrada (verde) · 🛒 Vender · 💵 Caja · ⏰ Vencen hoy · 👥 Socios · 📈 Resultado.
5. **4 números**: entraron hoy · cobrado hoy · vencen hoy · socios al día. Tocar uno lleva a su detalle.
6. **Ahora y lo que sigue**: clases de las próximas horas con cupo, cajas abiertas, cumpleaños, prospectos nuevos.
7. **La semana** (gráfico chico): entradas y cobros por día contra la semana anterior.

| Botón | Qué hace | Conecta con | Estado |
|---|---|---|---|
| Editar accesos | Elegir y ordenar los botones grandes | `guardar_accesos_rapidos` | ✅ |
| Cada número | Abre el detalle (entradas de hoy, ventas de hoy, vencen hoy, socios filtrados) | Entrada, Caja, Vencen hoy, Socios | 🔧 |
| Alerta → botón | Va a resolverla | Caja, Transferencias, Pagos online | 🆕 |
| Próximo paso | Lleva a la pantalla que lo resuelve | Configuración, Planes, Socios, Página | ✅ ONB-1 |

## Socios

| Pantalla | Botones | Estado |
|---|---|---|
| Lista | Buscar · filtros (al día, vencen, vencidos, en pausa, nuevos, etiquetas, plan) · ➕ Nuevo · 📥 Importar · 📤 Exportar · tocar fila → ficha | ✅ lista · 🆕 filtros, importar, exportar |
| Ficha · Resumen | Semáforo y por qué · Cobrar · WhatsApp · Editar · Pausar · Dar de baja · Unir con otro · Asignar llavero · Foto | 🔧 SOC-2 |
| Ficha · Pagos | Cada pago con comprobante · anular (encargado/dueño) | 🆕 |
| Ficha · Asistencia | Calendario del mes, racha | 🆕 |
| Ficha · Clases y rutina | Reservas, packs, rutina asignada | 🆕 |
| Ficha · Notas | Notas con autor y fecha, etiquetas | 🆕 SOC-3 |
| Nuevo / editar | Datos, plan y cobro en el mismo paso ("Guardar y cobrar") | 🔧 |

## Prospectos (🆕 PAG-3)

Lista con estado (nuevo, contactado, vino a probar, se hizo socio, no le interesó), origen (página, recepción, referido), WhatsApp armado, "Convertir en socio".

## Retención (✅, mejoras RET-1/3)

Arriba: plata en riesgo, bajas del mes, tendencia. Listas: vencidos, por vencer, nuevos que aflojan, no vienen, se fueron. Cada fila: WhatsApp listo, "anotar contacto", resultado.

## Resultado (🆕 RES)

Mes actual contra el anterior: cobrado total, por medio, por plan, por persona que cobró; socios activos, altas, bajas; horas pico; gastos y ganancia (RES-3); exportar para el contador.

## Planes y productos (✅, mejoras PLA)

Planes: nombre, tipo (mensual, pase, pack), duración, precio por medio y por día, horarios y días permitidos, matrícula, visible en la página, archivar. Aumento programado (en lote). Productos con stock.

## Equipo (✅)

Personas con rol, acceso, último ingreso; ➕ Sumar · 🔑 Nueva contraseña · ✉️ Dar acceso · Sacar acceso · PIN · interruptores de permisos (D4).

## Configuración (🔧 CFG-1, en pestañas)

Gimnasio · Marca · Página · Entrada (formas A1–A7, tolerancias) · Cobros (medios, alias, recargos, fiado) · Reglas (gracia, pausas, invitados) · Clases (políticas) · Avisos (canales y textos) · Secciones · Sedes · Dirección.
