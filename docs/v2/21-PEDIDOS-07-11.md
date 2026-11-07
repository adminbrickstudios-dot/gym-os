# 21 · Pedidos de Mateo del 07/11: ingreso, páginas e información

Se hacen en la **fase 5** de `CIERRE.md`, después de verificar y publicar lo
anterior. Cada uno con prueba de base si toca la base y e2e del recorrido,
en compu y en celular (iPhone Safari incluido).

## VD-61 · Ingreso, segunda pasada (`11-INGRESO-Y-SEGURIDAD.md`)
- Más lindo: marca del gimnasio a pantalla completa (foto o color), tarjeta
  de vidrio, una sola animación de entrada, carga en < 1 s.
- Cada caso con su pantalla clara: no tengo cuenta → registrarme; olvidé la
  contraseña → código o link (con SMTP 🔌; sin SMTP, lo dice y ofrece el
  código por celular o pedírselo a la recepción); código vencido; demasiados
  intentos ("probá en 1 min"); sin internet.
- Registro del socio claro, en pasos cortos, con el nombre de cada cosa.
- Recepción: cambiar de persona con el PIN sin cerrar sesión, a la vista.
- Botón de Google listo (aparece solo cuando están las credenciales).
LISTO SI: e2e de cada caso; capturas en celular mirándolas.

## VD-62 · Páginas, segunda pasada (`06-PAGINA.md`)
- **Página del gimnasio**: foto o video real arriba, "Probá gratis" (D31),
  reseñas y cantidad de socios, planes con precio, horarios en vivo,
  equipo con foto, preguntas, ubicación, WhatsApp flotante. Textos que
  carga el dueño con ejemplos buenos por defecto.
- **Página de Gym OS** (para vender): qué resuelve en 3 líneas, capturas
  reales del panel y la app (generadas del demo), planes de BRIK desde el
  super admin, "Pedí una demo" por WhatsApp, "Ingresar".
LISTO SI: Lighthouse celular ≥ 90 en las dos (o anotado por qué no);
capturas mirándolas; e2e: "Probá gratis" crea el interesado.

## VD-63 · Información y ayuda (`12-NOTIFICACIONES-Y-ONBOARDING.md`)
- **Centro de ayuda** (`/panel/ayuda` y `/app/ayuda`): preguntas cortas por
  rol, buscables también desde Ctrl+K ("¿cómo anulo un cobro?", "¿cómo
  pauso a un socio?", "¿qué es día fijo?"), cada una con el botón que lleva a
  hacerlo.
- **Info del gimnasio en la app del socio**: horarios de apertura y
  feriados, reglamento, contacto y WhatsApp, cómo llegar, preguntas
  frecuentes (los mismos datos de la página, nada se tipea dos veces).
- **Textos de ayuda** de cada pantalla revisados: una línea clara de qué es
  y qué hacer, sin repetir ni llenar.
LISTO SI: e2e: buscar una pregunta en Ctrl+K lleva a la respuesta y su
botón; el socio ve la info del gimnasio sin pedirla.
