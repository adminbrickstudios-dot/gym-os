# Equipo y Mi cuenta · inventario botón por botón (AUD-12)

Rutas `/panel/equipo` (dueño edita; encargado mira) y `/panel/cuenta` (todos).

Probado haciendo clic con `npm run e2e:equipo` (`scripts/e2e/panel-equipo.mjs`).

| Elemento | Qué hace hoy | Anda | Qué le falta | Se conecta con | Configurable |
|---|---|---|---|---|---|
| Lista del equipo | Nombre, rol, sede y si tiene acceso; "vos" marcado. | ✅ | — | `equipo_gimnasio` | — |
| Rol (selector) | Cambia el rol al toque. Hacer **dueño** ahora pide confirmación en pantalla (le da la plata y la configuración). | ✅ (arreglado) | — | `guardar_equipo` | — |
| Sacar / Devolver acceso | Lo desactiva o lo reactiva (sin borrar nada). | ✅ | — | `guardar_equipo` | — |
| Dar acceso / Nueva contraseña | Crea o vincula la cuenta por mail; contraseña provisoria a la vista. A otro dueño no se le cambia la contraseña. | ✅ | — | `darAcceso` (servidor) | — |
| ➕ Sumar a alguien | Nombre, mail opcional, rol (con qué hace cada uno) y sede si hay varias. | ✅ | — | `guardar_equipo` | — |
| Editar nombre o sede | No se puede: hay que sacarlo y sumarlo de nuevo. | ❌ | Editar en el lugar | — | — |
| 🔐 Qué puede hacer cada rol | Cuatro interruptores del dueño (D4): la recepción ve lo cobrado, la recepción vende productos, el profe ve el teléfono, el encargado ve el Resultado. | ✅ (EQU-1) | — | `permisos_equipo`, `guardar_permisos_equipo` | — |
| Encargado | Ve la lista sin botones. | ✅ | — | — | — |
| Mi cuenta · Contraseña | Cambiarla (las dos tienen que coincidir); los campos tienen nombre para lectores de pantalla. | ✅ (arreglado) | — | Supabase Auth | — |
| Mi cuenta · PIN | Su PIN para la compu compartida (D15). | ✅ | — | `guardar_mi_pin` | — |
| Mi cuenta · Notificaciones | Prender el push en este dispositivo (no para el profe). | ✅ (PUSH-1) | — | `guardar_suscripcion_push` | — |
| Cerrar sesión | Sale. | ✅ | — | `/salir` | — |
| Cargando | `loading.tsx` en las dos rutas (faltaban). | ✅ (nuevo) | — | — | — |

## Lo que se pensó en cadena

- "Qué hizo cada uno" (EQU-3) cuelga de cada persona.
