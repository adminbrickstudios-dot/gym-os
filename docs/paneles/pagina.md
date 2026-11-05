# Página del gimnasio · inventario botón por botón (AUD-2)

Ruta `/` en la dirección del gimnasio (`demo.gymos…`, su dominio propio o
`/g/<slug>` en la de Gym OS). La ve cualquiera, sin sesión. Lee
`landing_publica` y `agenda_publica`. La edita el dueño desde Configuración →
Página (publicar/borrador, link, WhatsApp, Instagram, mail); el editor de las
secciones es PAG-1.

Probado haciendo clic con `npm run e2e:pagina`
(`scripts/e2e/panel-pagina.mjs`, 16 pasos): publicada en compu y celular,
cada link abierto o validado; la dueña la pasa a borrador y la vuelve a
publicar; un gimnasio recién creado.

| Bloque | Elemento | Qué hace hoy | Anda | Qué le falta | Se conecta con | Configurable |
|---|---|---|---|---|---|---|
| Arriba | Logo + nombre | Vuelve al principio. | ✅ | — | Marca (Configuración) | Sí (logo, nombre) |
| Arriba | 🔥 Ver planes (compu) | Baja a Planes. Solo si hay planes visibles. | ✅ | — | Planes | Sí (los planes) |
| Arriba | 💪 Soy socio | Abre el ingreso del socio (`/ingresar?modo=socio`). | ✅ | — | App del socio | — |
| Portada | Título, bajada, foto | Los textos de la página; la foto de portada si hay. | ✅ | Editarlos desde el panel (PAG-1) | — | Sí (PAG-1) |
| Portada | 🟢 Abierto / cerrado | Con una sede, el estado de ahora con la misma cuenta que la app. | ✅ | — | Horarios (Configuración) | Sí |
| Portada | Botón principal | WhatsApp con el mensaje armado; sin WhatsApp, a Planes; sin planes, al mail. En el celular va fijo abajo (una sola vez). | ✅ | "Hacete socio" con alta online (REG-1) y "Probá una clase" (PAG-3) | WhatsApp de la página | Sí (texto del botón, PAG-1) |
| Quiénes somos · Qué podés hacer | Textos y tarjetas | Secciones de la página. | ✅ | Editarlas (PAG-1) | — | Sí (PAG-1) |
| Planes | Tarjetas | Nombre, precio por período, precio en efectivo, condiciones (horario, veces por semana). | ✅ | — | Planes y precios | Sí (visible en la página, mostrar precios) |
| Planes | Lo quiero | WhatsApp "Hola! Me interesa el plan X." Sin WhatsApp no aparece. | ✅ | Alta online (REG-1) | WhatsApp | — |
| Horarios | Apertura por día | La agenda del gimnasio; los cierres (feriados) avisan arriba. | ✅ | — | Horarios y cierres | Sí |
| El gimnasio | Fotos | Las fotos de la página. | ✅ | — | Configuración → Marca | Sí |
| Profes | Tarjetas | Nombre y especialidad, iniciales sin foto. | ✅ | Foto del profe (PAG-1) | Equipo | Sí (PAG-1) |
| Preguntas frecuentes | Desplegables | Abren y cierran. | ✅ | Editarlas (PAG-1) | — | Sí (PAG-1) |
| Dónde estamos | 🗺️ Cómo llegar · 📞 Llamar | Mapa y teléfono de cada sede (otra pestaña / llamada). | ✅ | — | Sedes (Configuración → Gimnasio) | Sí |
| Pie | 💬 WhatsApp · 📷 Instagram · ✉️ Mail | Contacto (otra pestaña). | ✅ | — | Configuración → Página | Sí |
| Pie | 🛎️ Soy del equipo | Ingreso del equipo. | ✅ (nuevo, AUD-2) | — | Panel | — |
| Compartir | Título y vista al pegar el link | `title` y `og:title`; la foto de portada si hay. | ✅ | Descripción e imagen siempre, botón compartir (PAG-2) | — | Sí (PAG-2) |
| Sin publicar | "Estamos armando nuestra página" | Logo, nombre, 💬 Escribinos por WhatsApp (nuevo), Soy socio, Soy del equipo. | ✅ | — | Configuración → Página | Sí (publicar) |
| Todo | Celular (390 px) | Sin desborde; el botón de WhatsApp fijo abajo. | ✅ | — | — | — |

## Lo que se arregló en esta auditoría

- La página sin publicar era un callejón: solo el nombre. Ahora tiene el
  WhatsApp del gimnasio (migración 0029: `landing_publica` lo devuelve
  también sin publicar; es el mismo dato que se ve al publicar).
- La página publicada no tenía "Soy del equipo" (la especificación lo pide en
  el pie): el equipo tenía que saber la dirección `/ingresar`.

## Lo que va a la COLA

- PAG-1, PAG-2, PAG-3 y REG-1 ya cubren editor, compartir, prospectos y
  alta online.
- **PAG-4** (nuevo): aparecer en Google con los datos del gimnasio (datos
  estructurados de gimnasio, `sitemap.xml`, `robots.txt`).
