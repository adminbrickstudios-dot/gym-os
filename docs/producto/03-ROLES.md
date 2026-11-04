# Roles: quién ve y hace qué

Los roles son fijos; cada gimnasio prende o apaga algunos permisos con
interruptores (D4). La base decide siempre (funciones con `exigir_rol`): la
pantalla solo esconde lo que la base igual rechazaría.

✅ puede · 👁️ solo ver · ⚙️ si el dueño lo prende · — no

| Acción | 👑 Dueño | 🧭 Encargado | 🛎️ Recepción | 💪 Profe | 🏃 Socio |
|---|---|---|---|---|---|
| Ver Inicio con plata del día | ✅ | ✅ | ⚙️ | — | — |
| Entrada: buscar, ver veredicto | ✅ | ✅ | ✅ | — | — |
| Dejar pasar a un vencido (con motivo, con tope diario) | ✅ | ✅ | ✅ (tope) | — | — |
| Dejar pasar a un suspendido o dado de baja | ✅ | ✅ | — | — | — |
| Buscar socios (nombre, foto, semáforo) | ✅ | ✅ | ✅ | ✅ (D3) | — |
| Ver teléfono y datos del socio | ✅ | ✅ | ✅ | ⚙️ | su propio |
| Alta y edición de socio | ✅ | ✅ | ✅ | — | sus datos |
| Dar de baja un socio | ✅ | ✅ | — | — | pedir baja |
| Pausar (congelar) | ✅ | ✅ | pedir | — | pedir |
| Vender y cobrar | ✅ | ✅ | ✅ | — | pagar lo suyo |
| Descuento | ✅ | ✅ (tope) | ⚙️ (tope) | — | — |
| Anular una venta | ✅ | ✅ (con aviso al dueño) | — (pide) | — | — |
| Abrir y cerrar caja | ✅ | ✅ | ✅ | — | — |
| Ver lo esperado en caja | ✅ | ✅ | — (arqueo ciego) | — | — |
| Retiro de caja | ✅ | ✅ | ✅ (con motivo, aviso) | — | — |
| Aprobar transferencias | ✅ | ✅ | ✅ | — | subir comprobante |
| Vencen hoy y avisos | ✅ | ✅ | ✅ | — | — |
| Retención | ✅ | ✅ | ✅ sin plata en riesgo (D2) | — | — |
| Clases: ver, tomar presente | ✅ | ✅ | ✅ | sus clases | — |
| Clases: grilla, actividades, cancelar | ✅ | ✅ | cancelar con motivo | cancelar las suyas | — |
| Reservar y cancelar reserva | ✅ (por otro) | ✅ | ✅ (por otro) | — | ✅ |
| Rutinas: armar y asignar | ✅ | ✅ | — | ✅ | ver y anotar |
| Planes, precios, aumentos | ✅ | 👁️ | — | — | — |
| Productos y stock | ✅ | ✅ | 👁️ | — | — |
| Resultado (la plata del mes) | ✅ | ⚙️ | — | — | — |
| Equipo: altas, claves, permisos | ✅ | 👁️ | — | — | — |
| Configuración | ✅ | 👁️ | — | — | — |
| Página pública: editar, publicar | ✅ | ⚙️ | — | — | — |
| Prospectos | ✅ | ✅ | ✅ | — | — |
| Qué hizo cada uno (auditoría) | ✅ | ⚙️ | — | — | — |
| Exportar datos | ✅ | — | — | — | sus datos |
| Su contraseña y sus datos | ✅ | ✅ | ✅ | ✅ | ✅ |

**Super admin (BRIK)** no es un rol del gimnasio: entra como "Soporte BRIK"
(dueño, visible en Equipo) y nada más. Todo lo que hace queda registrado.

## Reglas de cuentas

- Cada persona del equipo entra con su mail y contraseña; puede tener PIN de 4 dígitos para la PC de recepción (D15).
- El dueño genera contraseñas nuevas para su equipo (no para otros dueños); BRIK para cualquiera.
- Cada uno cambia su contraseña desde Mi cuenta.
- Alguien que deja de trabajar: "Sacar acceso" (se desactiva, su historial queda).
- Una persona puede estar en varios gimnasios (profe que da en dos lugares): elige gimnasio al entrar.
- El socio entra con su celular o su mail y un código (ver `09-PREGUNTAS.md`, P1), o con contraseña si la crea.
