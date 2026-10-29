# Gym OS — Qué necesita para funcionar

## Servicios externos

| Servicio | Para qué | Cuándo | Plan | Notas |
|---|---|---|---|---|
| **Dominio** | Multi-tenant por subdominio (`olympo.midominio.com`) | **Antes de S0** | — | Comprado en Vercel, el DNS queda solo. Vercel no permite comodín sobre `*.vercel.app` |
| **Vercel** | Hosting, dominios por gimnasio vía API, crons | S0 | **Pro** al tener el primer cliente | El plan Hobby es para uso no comercial. Un SaaS cobrado no entra ahí |
| **Supabase** | Base, auth, storage | S0 | Free en desarrollo · **Pro** desde el primer gimnasio real | El free pausa a los 7 días sin actividad y no tiene los backups que necesita un sistema que decide quién entra |
| **Proveedor de SMS/WhatsApp para el código de login** | Login del socio con teléfono + código | Sección de auth | Por mensaje | Se configura **en Supabase**, no en la app. Con un "Send SMS hook" el envío pasa por nuestro código y ahí va el rate limit |
| **MercadoPago — app de BRIK** | (1) Suscripción BRIK → gimnasio con tus credenciales. (2) OAuth para que cada gimnasio vincule **su** cuenta | Sección de cobros | — | Dos webhooks distintos |
| **WhatsApp Cloud API (Meta)** | Automatizaciones (avisos de vencimiento, bienvenida) | Sección de automatizaciones | Por conversación | Requiere plantillas aprobadas por Meta. **No** hace falta para el botón de WhatsApp del panel de retención: ese es un link `wa.me` gratis que abre el WhatsApp de quien toca |
| **Resend** | Mails transaccionales (invitaciones al equipo, recibos, avisos a gimnasios) | Cuando se necesite | Free alcanza al principio | La verificación del dominio tarda: arrancarla temprano, no bloquea |
| **Google OAuth** | Login del equipo (dueño, recepción) | Sección de auth | — | Opcional; mail + link mágico también sirve |

## Variables

Ver `.env.local.example` — cada una con para qué es y de dónde se saca.

## Lo que configura cada gimnasio (en su panel, no en código)

- Nombre, logo, favicon, colores
- Qué cobra: membresía / pase diario / pack
- Modo de clases: con reserva / sin reserva / sin clases
- Modos de acceso activos
- Planes, precios y aumentos programados
- Tolerancia y días de aviso antes de vencer
- Reglas de renovación de cada plan
- Actividades, horarios, cupos, profes
- Equipo y roles
- Plantillas de mensajes y automatizaciones
- Su cuenta de MercadoPago (vinculación por OAuth — **la plata de los
  socios va directo a su cuenta y nunca pasa por BRIK**; esa frase va
  escrita en la pantalla)
- Modo "avisar sin bloquear" (fecha hasta)
- Secciones apagadas

## Lo que configura BRIK por gimnasio (topside)

- Alta, subdominio, dominio propio
- Plan de suscripción
- Suspensión manual con motivo
- Marcar como demo
