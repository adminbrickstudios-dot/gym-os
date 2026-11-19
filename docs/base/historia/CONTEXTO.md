# Qué es Base

**Base** (antes "Gym OS") es el sistema de gestión para gimnasios de BRIK: una sola aplicación web donde el dueño, la recepción, los profes y los socios hacen lo suyo. Un gimnasio es un "inquilino": todo lo que lo distingue (marca, planes, horarios, clases, reglas de vencimiento, secciones prendidas) vive en datos, no en código.

## Para quién
- **Dueño**: ve cuánto entró, quién deja de venir, cuánta plata está en riesgo; arma planes, equipo y página.
- **Recepción**: en el mostrador, 19 h, 40 personas en la fila: tipear un DNI, nombre o celular y saber *en un segundo* si el socio puede entrar y por qué; cobrar en un toque.
- **Profe**: toma asistencia y ve sus clases; nunca ve plata.
- **Socio**: ve si está al día, cuánto debe, su QR, sus clases y paga desde el celular.

## La pregunta central
> ¿Este socio puede entrar hoy?

Se **calcula**, no se guarda: una sola función SQL (`estado_acceso`) responde para la recepción, el kiosco, el QR, la app y las listas, y siempre dice el motivo. La única fecha guardada es `socios.cubierto_hasta` (D36): el fin de la cobertura, mantenido por trigger, que sirve a las listas de muchos socios; el color sigue saliendo de compararla con el momento.

## Cómo se vende
Registro cerrado: BRIK da de alta cada gimnasio desde el super admin (alta en 3 pasos: tipo, marca, dueño) y le pasa su link (`/dueno`). Abono mensual a BRIK; el gimnasio cobra a sus socios con efectivo, transferencia, tarjeta o MercadoPago. La página de venta de Base está en la dirección de la plataforma ("Pedí una demo" por WhatsApp).

## Piezas
Next.js (App Router) + Supabase (Postgres, Auth, Storage) + Vercel (funciones en São Paulo, `gru1`). Español en tablas, columnas y funciones; `gimnasio_id` en todo, con FK compuesta; RLS en toda tabla; los webhooks de MercadoPago mandan y son idempotentes. Detalle: `CLAUDE.md`, `docs/SCHEMA.md`, `docs/CONVENCIONES.md`, `docs/base/PERMISOS.md`.
