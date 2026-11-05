# Configuración · inventario botón por botón (AUD-1)

Ruta `/panel/configuracion`. La ven el dueño (cambia) y el encargado (solo
mira). Recepción y profe no la ven (el barrido lo prueba). Lee
`configuracion_panel` y escribe `guardar_configuracion` (migración 0020: cada
valor se valida con un mensaje que dice qué campo y qué poner).

Probado haciendo clic con `npm run e2e:configuracion`
(`scripts/e2e/panel-configuracion.mjs`, 27 pasos) con la base local y el
gimnasio demo, en compu y en celular, como dueña y como encargado.

**Cómo guarda.** Cada bloque tiene su Guardar, que se prende solo si ese
bloque tiene cambios. Al lado aparece "• Cambios sin guardar"; si el dueño se
va de la página con algo sin guardar, el navegador pregunta antes. El
resultado (guardado o el error) aparece en el mismo bloque, al lado del botón
que se tocó. Lo que el navegador puede validar no llega a la base; la base
valida igual (nadie se saltea la regla llamando a la función directo).

| Bloque | Elemento | Qué hace hoy | Anda | Qué le falta | Se conecta con | Configurable |
|---|---|---|---|---|---|---|
| Marca | Nombre del gimnasio | Cambia el nombre en la barra, el saludo y la página. Obligatorio, hasta 60 letras. | ✅ | Dirección, contacto y redes (CFG-1, pestaña Gimnasio) | Inicio, landing, app del socio | Sí (es el dato) |
| Marca | 6 muestras de fondo + "Otro fondo" | Eligen el fondo; la vista previa cambia al instante. | ✅ | Avisar si el acento elegido no se lee sobre el fondo (CFG-9) | Todo el gimnasio (`propsMarca`) | Sí |
| Marca | 7 muestras de color principal + "Otro color" | Eligen el color de los botones; al guardar cambia el panel. | ✅ (probadas las 13 muestras) | Ídem CFG-9 | Ídem | Sí |
| Marca | Vista previa | Muestra nombre, texto y botón con los colores elegidos. | ✅ | Logo en la vista previa (CFG-2) | — | — |
| Marca | Guardar | Guarda nombre y colores. | ✅ | — | `guardar_configuracion` | — |
| Qué cobrás | Membresía · Pase diario · Packs | Prenden o apagan lo que aparece en Vender. No deja apagar los tres. | ✅ | — | Vender, Planes | Sí |
| Qué cobrás | Guardar | Guarda. Con los tres apagados: "Dejá prendida al menos una forma de cobrar". | ✅ | — | `guardar_configuracion` | — |
| Clases | Con reserva · Sin reserva · No damos clases | Elige cómo funcionan las clases. Sin clases, desaparecen del menú (probado). | ✅ | Políticas de faltas (D16) | Clases de hoy, app del socio, menú | Sí |
| Clases | Se reserva con hasta (días) | 0 a 60. Solo con reserva. | ✅ | — | Reservas de la app | Sí |
| Clases | Cancelar hasta (horas antes) | 0 a 72. Solo con reserva. | ✅ | — | Reservas de la app | Sí |
| Reglas | Días de gracia al vencer | 0 a 60. Vacío o fuera de rango: mensaje en el bloque. | ✅ | Explicarlo con un ejemplo de fechas (CFG-1) | `estado_acceso` (Entrada, QR, app) | Sí |
| Reglas | Avisar que vence (días antes) | 0 a 30. | ✅ | — | Entrada (amarillo), Vencen hoy | Sí |
| Reglas | Descuento máximo de la recepción (%) | 0 a 100. | ✅ | — | Vender (tope de descuento) | Sí |
| Reglas | "No viene" después de (días) | 3 a 90. | ✅ | Los otros tres días de retención no tienen pantalla (CFG-6) | Retención | Sí |
| Transferencias | Alias | 6 a 20: letras, números, puntos o guiones. Vacío lo borra. | ✅ | Botón copiar en la app (CFG-3) | App del socio (pagar por transferencia) | Sí |
| Transferencias | CBU / CVU | 22 números; espacios y guiones se limpian. Dice cuántos números puso si no son 22. | ✅ | Banco (CFG-3) | App del socio | Sí |
| Transferencias | Titular | Hasta 80 letras. | ✅ | — | App del socio | Sí |
| Secciones | 7 interruptores (Entrada, Vencen hoy, Socios, Retención, Vender, Caja, Transferencias) | Apagan la sección en todos los paneles. Cada uno dice qué es. | ✅ (probados los 7) | Avisar qué deja de andar al apagar algo que otra sección usa (CFG-7) | Menú, Inicio, accesos rápidos | Sí |
| Secciones | Caja apagada | Vender deja de ofrecer efectivo (no manda a abrir una caja que no existe). | ✅ | — | Vender | Sí |
| Todo | Encargado | Ve todo deshabilitado, sin Guardar, con "Solo el dueño cambia la configuración". | ✅ | — | — | — |
| Todo | Celular (390 px) | Sin desborde. | ✅ | — | — | — |

## Lo que la base ya tiene y la pantalla no muestra

- `accesos_activos` (cómo entra la gente: recepción, QR del socio, QR en la
  pared, kiosco, tarjeta, molinete).
- `reingreso_mismo_dia_consume` (si volver a entrar el mismo día gasta otra
  clase del pack o otro pase).
- `retencion_dias_nuevo`, `retencion_dias_vencido`, `retencion_dias_se_fue`.

Van en CFG-6.

## Lo que se arregló en esta auditoría

- Valores imposibles mostraban el error crudo de Postgres ("violates check
  constraint"): ahora cada campo dice su rango (migración 0020 + la pantalla).
- Un número borrado se guardaba como 0 sin avisar: ahora pide un número.
- Cambiar el nombre y tocar Guardar en otro bloque decía "Guardado ✅" y el
  nombre se perdía al recargar: ahora cada bloque marca sus cambios sin
  guardar y el navegador avisa antes de salir.
- El alias no se validaba: ahora 6 a 20 caracteres, como los bancos.
- Se podían apagar las tres formas de cobro: el gimnasio quedaba sin nada
  para vender.
- Caja apagada: Vender ofrecía efectivo y mandaba a abrir la caja, una
  pantalla apagada (callejón sin salida).
- Con fondo claro, los títulos de todas las pantallas del gimnasio salían
  casi blancos sobre crema (el color de texto se heredaba del fondo oscuro de
  la raíz). Arreglado en `globals.css` para todo el sistema.

## Qué pasa al apagar cada sección (CFG-7)

Ninguna pantalla prendida lleva a una apagada: los links y botones a otra
pantalla usan `LinkPanel` (`src/components/panel/LinkPanel.tsx`), que solo
aparece si esa pantalla está prendida para el gimnasio y el rol
(`rutaDisponible` en `src/lib/panel/secciones.ts`). Un nombre que llevaba a
la ficha queda como texto; un botón, desaparece. Inicio no muestra avisos
("3 vencen hoy", "transferencias para aprobar", "la caja está cerrada") que
llevan a una pantalla apagada. Probado con `npm run e2e:cfg-7`: cada sección
apagada, 14 pantallas abiertas buscando links a ella.

| Sección apagada | Qué deja de andar | Qué sigue andando | Ajustes que hizo falta |
|---|---|---|---|
| Entrada | Marcar entradas desde el panel | El semáforo en la ficha; Vender sin "Ir a la entrada" | — |
| Vencen hoy | La lista del día y su aviso en Inicio | Retención → Vence pronto (mismo cálculo) | Inicio oculta "N vencen hoy" |
| Socios | Lista, fichas (también al entrar por la dirección), altas | Entrada busca y marca; Vender busca; Retención, Vencen hoy y Transferencias muestran el nombre sin link | Ficha y Editar exigen la sección; "Darlo de alta" y "Ver ficha" desaparecen |
| Retención | Las listas de los que se van | Vencen hoy | — |
| Vender | Cobrar desde el panel | La app del socio (transferencia); aprobar transferencias | "Cobrar" y "Vender" de la ficha y la entrada desaparecen |
| Caja | Efectivo | Vender con los otros medios; la base rechaza efectivo (0023) | Inicio no muestra "la caja está cerrada" (ya lo hacía la base) |
| Transferencias | Aprobar comprobantes | Cobrar por transferencia en el mostrador | La app no pide comprobantes y la base no los acepta (0027) |
| Clases (en Secciones) | Clases en el menú, Inicio, la app y la pestaña de Configuración | Todo lo demás | — (ya estaba) |

## Historial de cambios (CFG-8)

Pestaña "🕓 Cambios" (dueño y encargado, solo lectura) y "Últimos cambios de
configuración" en el super admin. Cada fila: qué campo, de qué a qué, quién y
cuándo (hora del gimnasio). Lo escriben triggers en la base, nunca la
pantalla: queda cualquier cambio venga de donde venga, y guardar sin cambiar
nada no deja fila. No se puede borrar. Probado con `npm run e2e:cfg-8`.
