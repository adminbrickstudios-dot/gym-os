# Vencen hoy y Avisos de hoy · inventario botón por botón (AUD-7, AVI-1)

Rutas `/panel/vencen-hoy` y `/panel/avisos`. Las ven dueño, encargado y
recepción (el profe no). Vencen hoy se apaga por gimnasio (`vencen_hoy`).

Probado haciendo clic con `npm run e2e:vencen` (`scripts/e2e/panel-vencen.mjs`)
y `npm run e2e:avi-1` (`scripts/e2e/avi-1.mjs`).

| Elemento | Qué hace hoy | Anda | Qué le falta | Se conecta con | Configurable |
|---|---|---|---|---|---|
| Lista | A quién se le termina la cuota hoy, con el porqué y la última vez que vino. Sale de la misma cuenta que Retención. | ✅ | — | `vencen_hoy` | Mensaje `por_vencer` |
| Bajada | Dice cuántos vencen hoy (antes decía siempre lo mismo). | ✅ (arreglado) | — | — | — |
| 💬 WhatsApp | El mensaje de Configuración → Mensajes ya escrito. Sin teléfono, no aparece. | ✅ | — | `linkWhatsappSocio` | Mensajes |
| 💵 Cobrar | Abre Vender con el socio y su cuota en el carrito. Solo si el gimnasio cobra membresía y quien mira puede vender. | ✅ (nuevo) | — | Vender `?socio=&cuota=1` | — |
| Dice que vuelve / anotar | Dueño y encargado anotan el contacto ("Le escribió X el …"). La recepción no. | ✅ | — | `anotar_contacto` | — |
| Vacío | "Hoy no vence nadie" y el camino a Retención → Vence pronto (antes era una lista vacía). | ✅ (arreglado) | — | — | — |
| Cargando | `loading.tsx` con la forma real. | ✅ (nuevo) | — | — | — |
| 📬 Avisos de hoy | Bandeja del día: vence pronto, venció hace 1 a 3 días, no viene, cumple años, comprobante rechazado. Cada uno con su mensaje y WhatsApp. | ✅ (nuevo, AVI-1) | Push al socio (PUSH-1) | `bandeja_avisos` | Mensajes |
| ✓ Ya le avisé | Queda anotado con quién y a qué se refiere (ese vencimiento, ese cumpleaños). Tocar WhatsApp también lo marca. Lo avisado hoy se ve con ✓ al final; otro día ya no aparece; un aviso nuevo del mismo socio sí. | ✅ (nuevo) | — | `marcar_avisado`, `avisos_enviados` | — |

## Lo que se pensó en cadena

- "Vencen hoy" y la bandeja se pisan en "vence pronto": Vencen hoy queda como
  la lista del mostrador (con Cobrar), la bandeja como la lista de mensajes del
  día. Las dos leen la misma cuenta de Retención, nunca se contradicen.
- La bandeja se calcula al abrirla: si nadie la abre, no se manda nada, y nada
  depende de un cron.
