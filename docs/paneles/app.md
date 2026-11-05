# App del socio · inventario botón por botón (AUD-11)

Rutas `/app`, `/app/clases`, `/app/novedades`, `/app/historial`, `/app/cuenta`, `/app/pago`. Celular primero, con la marca del gimnasio.

Probado haciendo clic con `npm run e2e:app` (`scripts/e2e/panel-app.mjs`) y los e2e de cada función (app-1, app-3, app-7, app-8, avi-5, pay-1, ent-2, ent-6, inv-1, cla-1, cla-2, cla-4).

| Elemento | Qué hace hoy | Anda | Qué le falta | Se conecta con | Configurable |
|---|---|---|---|---|---|
| Logo y nombre (arriba) | Vuelve al inicio. | ✅ (ahora `<Link>`, antes recargaba la página) | — | — | Logo y nombre |
| Salir | Cierra la sesión. | ✅ | — | `/salir` | — |
| 📣 Novedades | Lo que publicó el gimnasio, arriba del semáforo, hasta el día elegido. | ✅ (APP-6) | Foto opcional | `novedades_socio` | Avisos de hoy → En la app |
| ¿Quién entrena hoy? | Si la cuenta tiene varios socios (familia), elige uno; el resto de las pantallas lo recuerda en `?socio=`. | ✅ | — | `mi_socio` | — |
| 🔔 Campana | Novedades con el número sin ver. | ✅ (AVI-5) | — | `campana_socio` | — |
| Semáforo | "Podés entrar / No podés entrar", el porqué y hasta cuándo está cubierto. | ✅ | — | `estado_acceso` vía `mi_socio` | Reglas de vencimiento |
| Racha | Veces este mes y semanas seguidas. | ✅ (APP-7) | — | `racha_socio` | — |
| QR / Escanear entrada | Su QR que cambia cada 30 s, o escanear el de la pared. | ✅ (ENT-2, ENT-6) | — | `mi_qr`, `entrar_por_qr_pared` | Formas de entrada |
| Horarios y cierres | Abierto/cerrado hoy y los próximos cierres. | ✅ (CFG-4) | — | `agenda` | Horarios |
| Pagar online / Transferencia | MercadoPago si está conectado; si no, los datos para transferir y subir el comprobante. | ✅ (PAY-1, VEN-1) | MercadoPago real sin probar | `pago_online_disponible`, `informar_transferencia` | Medios de pago |
| Invitar | Pase para un invitado. | ✅ (INV-1) | — | `mis_invitados` | Invitados por mes |
| 🧾 Mis pagos y cuándo vine | Historial. | ✅ (APP-3) | Comprobante de cada pago | `mi_historial` | — |
| 🔑 Mi contraseña | En Mi membresía: crearla o cambiarla para entrar con mail y contraseña. | ✅ (APP-9) | — | Supabase Auth | — |
| 💪 Mi rutina | Si el profe le asignó una: por día, series × repeticiones, video y "Anotar" kilos y repeticiones. | ✅ (RUT-2) | — | `rutina_de_socio`, `anotar_ejercicio` | Sección Rutinas |
| ⏸️ Pausar o dar de baja | Pide la pausa o la baja. | ✅ (APP-8) | — | `pedir_pausa_socio`, `pedir_baja_socio` | Máximo de pausa |
| Instalar | Instalar en el celular (Android directo; iPhone con los pasos). | ✅ (APP-1) | Probar en un teléfono real | — | — |
| Mis clases / Reservar | Sus reservas con Cancelar; Reservar abre los próximos 7 días. | ✅ | — | `clases_del_dia`, `reservar` | Modo de clases, ventana, cancelación, faltas |
| Clases "sin reserva" | Antes mostraba "Reservar" y fallaba al tocar. Ahora "🗓️ Ver horarios", "vení directo" y sin botones. | ✅ (arreglado) | — | `clases_del_dia` | Modo de clases |
| ← Volver en Clases | Con varios socios perdía cuál era. | ✅ (arreglado) | — | — | — |
| Cargando | `loading.tsx` con la forma real en el inicio y en Clases (faltaban). | ✅ (nuevo) | — | — | — |

## Lo que se pensó en cadena

