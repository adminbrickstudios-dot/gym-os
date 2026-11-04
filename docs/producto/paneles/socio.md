# 🏃 App del socio

Web instalable (PWA) con el nombre, ícono y colores del gimnasio. Se entra
desde la página del gimnasio ("💪 Soy socio") o el ícono en el celular.

## Inicio

1. **Semáforo grande** + "Al día hasta el 30/11" (o el motivo si no).
2. **Mi QR** (rotativo, borde que gira) + "Mostralo en la entrada". Brillo al máximo sugerido.
3. Si está rojo o vence pronto: **Pagar ahora** (verde).
4. **Racha**: "🔥 12 entradas este mes · 3 semanas seguidas".
5. Próxima clase reservada / clases de hoy con lugar.
6. Novedades del gimnasio (APP-6).

## Pantallas

| Pantalla | Botones | Estado |
|---|---|---|
| Inicio | QR · Pagar ahora · Reservar · Ver rutina | ✅ estado · 🆕 QR, racha, novedades |
| Pagar / renovar | Plan actual o cambiar · medio (MercadoPago, transferencia con alias para copiar y subir comprobante) · adelantar meses · adherir débito automático | ✅ transferencia · 🔌 MP |
| Clases | Grilla de la semana · Reservar · Cancelar (con la política visible) · Lista de espera · Turno fijo | ✅ reservar/cancelar/espera · 🆕 turno fijo |
| Mi rutina | Rutina del día · anotar peso y repeticiones · marcas y progreso | 🆕 RUT |
| Historial | Pagos con comprobante · asistencia del mes | 🆕 APP-3 |
| Invitar a un amigo | Pase de prueba con link para compartir | 🆕 REF-1 |
| Pedir pausa / baja | Formulario con motivo; lo resuelve el gimnasio | 🆕 |
| Mi perfil | Datos, foto, celular, mail, contraseña, avisos (qué recibir), instalar la app, cerrar sesión | 🔧 |
| Avisos 🔔 | Lo que le mandó el gimnasio y el sistema | 🆕 AVI-5 |

## Primera vez

1. Entra con su celular o mail y el código (P1).
2. Si el número coincide con un socio, queda vinculado (✅ `vincular_socios_por_telefono`).
3. Si no coincide: "No te encontramos. ¿Te querés hacer socio?" → alta online (REG-1), o "Pedile a la recepción que cargue tu celular".
4. Sugerencia de instalar la app (con instrucciones para iPhone y Android) y de prender los avisos.
