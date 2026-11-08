# El pedido de Mateo, textual (07/11/2026)

Copia sin tocar del prompt que mandó Mateo. Lo que vale para trabajar es `00-LEEME.md` y `PROGRESO.md`: ahí está este pedido cruzado con lo que ya existe y con sus respuestas. Si algo de acá choca con `00-LEEME.md`, gana `00-LEEME.md`.

---

# BASE (sistema de gimnasios) — Vuelta completa: velocidad, usuarios y accesos, ingreso rápido con aviso flotante, landing de gimnasio, asistente de 9 pasos, panel del socio, seguridad y 70 detalles. Trabajo autónomo en loop hasta terminar.

Leé este mensaje COMPLETO antes de hacer nada. Vas a trabajar en loop, vuelta tras vuelta, hasta terminar TODO.

MAÑANA le paso el acceso al primer gimnasio para que lo pruebe. Por eso lo de la sección 4 (P0) tiene que quedar perfecto ANTES que cualquier otra cosa. Si el loop se corta en algún momento, que lo importante ya esté hecho.

No te olvides de NADA de lo que pido. Podés agregar, mejorar, cambiar y reorganizar (tenés permiso para todo), pero ninguna de mis peticiones puede quedar afuera.

====================================================================
## 0. QUIÉN SOS
====================================================================

Sos tres personas a la vez:
1. Desarrollador senior (Next.js + Supabase + Vercel), obsesionado con la velocidad, la seguridad y que nada se rompa aunque haya 500 o 5.000 socios cargados.
2. Alguien que manejó la recepción y la administración de un gimnasio durante años. Sabés qué pasa en el mostrador a las 19 h, cuando entran 40 personas seguidas y hay que cobrarle a la mitad.
3. Diseñador UX/UI senior: limpio, encuadrado, con identidad de gimnasio, que no parezca hecho por una IA.

Si algo que pido está mal pensado, decilo y proponé algo mejor. Lo que agregues por tu cuenta va marcado [PROPUESTA].

====================================================================
## 1. CÓMO TRABAJÁS EN LOOP
====================================================================

PRIMERA vuelta:
1. Encontrá la carpeta del proyecto Base y sus proyectos de Supabase y Vercel. Si hay más de una carpeta candidata, anotá cuál elegiste y por qué.
2. Releé todo:
   - los .md de diseño que ya existen (diseño completo, checklist por secciones, casos de puede_entrar, panel de retención, accesos)
   - CLAUDE.md
   - el código
   - el schema REAL de la base, consultado ejecutando
3. Reorganizá la documentación. Si un .md está desactualizado, contradice a otro o está desordenado, REESCRIBILO DE CERO. Set mínimo:
   - CONTEXTO.md
   - SCHEMA.md
   - REGLAS-NEGOCIO.md (vigencia, cobros, accesos, deuda)
   - PERMISOS.md (matriz rol × acción)
   - DISEÑO.md
   - CONVENCIONES.md
   - LECCIONES.md
   - DETALLES-70.md (sección 6)
4. Creá PROGRESO.md con TODO lo de este mensaje como checklist, ordenado por prioridad (P0 → P1 → P2). Estados:
   - ✅ hecho y verificado
   - 🟡 existe pero incompleto, roto o lento
   - ❌ no existe
   - ⛔ bloqueado (y por qué)
   Lo que ya está hecho NO se rehace: se verifica que tenga todas las funciones que pido y se completa lo que falte.
5. Creá PREGUNTAS.md.
6. Investigá en internet cómo lo hacen los mejores sistemas de gimnasios (Mindbody, Glofox, PushPress, Wodify, Virtuagym, Fitco y los argentinos) y anotá en INVESTIGACION.md qué tomar de cada uno, sobre todo para recepción, control de acceso y panel del socio.

En CADA vuelta:
1. Leé PROGRESO.md y PREGUNTAS.md (puede haber respuestas mías nuevas).
2. Tomá el próximo ítem pendiente de mayor prioridad.
3. Hacelo completo: schema → lógica → pantalla → prueba ejecutando.
4. Verificá ejecutando. Nada se marca ✅ sin el comando y su salida.
5. Commit y push. Publicá en Vercel al cerrar cada bloque.
6. Actualizá PROGRESO.md y los .md que correspondan.
7. Seguí.

Si tenés una duda: NO te frenes. Anotala en PREGUNTAS.md con opciones y tu recomendación, aplicá la recomendada, marcala "decidido por defecto" y seguí.

Solo FRENÁS ante algo irreversible:
- borrar datos reales
- gastar plata
- tocar credenciales de producción de un cliente

Cuando termines TODO el P0, escribí arriba de PROGRESO.md "P0 LISTO PARA MAÑANA", con:
- cómo entro como superadmin
- cómo creo el gimnasio y el dueño
- los links de cada panel
- qué probar primero

====================================================================
## 2. CONTEXTO
====================================================================

- Base es el SaaS multi-tenant de BRIK para gimnasios en Argentina, con suscripción mensual.
- Cubre:
  - tres formas de cobro: cuota mensual, pase diario y pack de clases
  - tres modos de clase
  - varios modos de acceso
- El corazón del sistema es una sola pregunta: "¿este socio puede entrar hoy, y si no, por qué?" (puede_entrar). Todos los modos de acceso terminan en la misma función registrar_ingreso.
- El segundo corazón es la retención: socios que dejan de venir, por vencer, vencidos y los que se fueron.
- Mañana entra el primer gimnasio real. Yo lo doy de alta desde el superadmin, le creo la contraseña al dueño y le paso el acceso.
- Referencia de cómo dividir paneles y secciones: Sillón, mi sistema de peluquerías (sidebar por secciones, paneles separados por rol). Inspirate en esa organización.

====================================================================
## 3. REGLAS FIJAS (NO NEGOCIABLES)
====================================================================

- Explicar el plan antes de tocar código (en PROGRESO.md al inicio de cada bloque).
- Por capa: build → probar ejecutando → commit y push → publicar.
- Primero schema, después lógica, después pantallas.
- Nada de "listo" sin el comando y su salida. Toda escritura verifica filas afectadas.
- Tablas, columnas, triggers y funciones en español.
- Multi-tenant: todo filtrado por negocio_id. RLS en cada tabla, probada con cada rol.
- Cero hardcodeo: nombre, logo, colores, planes, precios, horarios, textos y políticas de cada gimnasio van en datos.
- Cada módulo y pantalla se puede apagar por gimnasio.
- WhatsApp solo con links wa.me, sin envíos automáticos.
- Registro cerrado: los gimnasios se dan de alta desde el superadmin.
- Migraciones:
  - Reversibles, en transacción, con verificación previa.
  - Podés aplicarlas vos mientras la base tenga solo datos demo.
  - Si detectás datos de un gimnasio real, FRENÁ y dejame el script listo para que lo corra yo.
- Webhooks de Mercado Pago:
  - idempotentes
  - NUNCA pasan por el middleware (lección de yadeportes: falsos 200 y pagos perdidos para siempre)
  - con firma verificada
  - con reconciliación si un aviso no llega
- UI: simple, botones grandes, unas 4 secciones principales por panel y el resto en el menú lateral. Cada sección con una línea que explique qué es.

====================================================================
## 4. P0 — TIENE QUE QUEDAR PERFECTO PARA MAÑANA
====================================================================

--------------------------------------------------------------
### 4.1 Velocidad: diagnóstico y arreglo
--------------------------------------------------------------
La página anda MUY lenta. Quiero que ande muy fluida y que no pueda andar mal en ningún momento, ni hoy ni con 500 o más socios.

PASO 1 — Diagnosticar ANTES de tocar nada. Medí y anotá en VELOCIDAD.md, con números:
- Tiempo de carga de: login, inicio del dueño, recepción, búsqueda de un socio, registrar un ingreso, abrir la ficha, landing pública, panel del socio.
- Región de Vercel y región de Supabase. Si no coinciden, ESA es probablemente la causa principal: cada consulta viaja entre continentes. Anotá cuál es y proponé la solución (mover las funciones de Vercel a la región de la base, o migrar).
- Plan y potencia de Supabase (si se pausa, si se queda corto).
- Si el middleware consulta la base en cada pedido para saber qué gimnasio es.
- Consultas en cadena (N+1), consultas sin índice (EXPLAIN ANALYZE) y políticas RLS que evalúan funciones por cada fila.
- Si la vigencia de cada socio se calcula al leer, en vez de estar guardada.
- Tamaño del JavaScript que baja el navegador, imágenes pesadas, componentes que se redibujan de más.
Explicá en lenguaje simple POR QUÉ andaba lento, en un párrafo, arriba de VELOCIDAD.md.

PASO 2 — Arreglar:
- Alinear regiones (si es la causa).
- Resolver qué gimnasio es sin ir a la base en cada pedido (caché).
- Vigencia guardada en el socio (vigente_hasta, estado, deuda) y actualizada por trigger cuando hay un pago, congelamiento o cambio de plan. puede_entrar lee eso, no recalcula todo.
- Índices en negocio_id, DNI, nombre (búsqueda sin importar tildes ni mayúsculas), estado, fechas de ingreso y pagos.
- RLS con el patrón (select auth.uid()) y funciones estables.
- Paginación y listas virtualizadas.
- Componentes de servidor donde convenga.
- Imágenes optimizadas.
- Esqueletos de carga, sin pantallas en blanco.

PASO 3 — Prueba de carga: cargá un gimnasio demo con 5.000 socios y 100.000 ingresos y medí todo de nuevo.
Objetivos:
- buscar socio y registrar ingreso: menos de 1 segundo
- cualquier pantalla: menos de 2 segundos
Si no llega, seguí optimizando y anotá qué hiciste.

--------------------------------------------------------------
### 4.2 Usuarios, login y accesos por rol
--------------------------------------------------------------
- SUPERADMIN (yo):
  - Creo un gimnasio y su DUEÑO, poniéndole yo mail y contraseña. Después le paso el acceso.
  - Veo y controlo todos los gimnasios: estado, módulos, usuarios.
  - Puedo resetear la contraseña de cualquier dueño.
  - Puedo "entrar como" un gimnasio para revisarlo, con registro de que lo hice.
- DUEÑO: desde su panel, en una sección "Equipo", crea:
  - recepcionistas
  - profes
  - otros usuarios con mail
  Les pone contraseña o les manda un link para crearla. Puede desactivar a alguien sin borrarlo y resetear contraseñas.
- RECEPCIONISTA y PROFE: cada uno ve solo lo suyo (matriz en PERMISOS.md).
- SOCIO: tiene su propio panel (4.6).
- Links de entrada por rol, claros y fijos (por ejemplo /dueno, /recepcion, /profe, /socio y /super). Yo los paso después. Dejá en PROGRESO.md cuáles son.
- Login muy simple, lindo y con la identidad del gimnasio (logo y color):
  - mail, contraseña, botón grande
  - "olvidé mi contraseña" que funcione
  - mensajes de error claros
  - después del login, va directo al panel de su rol
- Paneles divididos por secciones, como Sillón.
- [PROPUESTA] Las credenciales demo y las del gimnasio que cree para mañana van en ACCESOS.md, que tiene que estar en .gitignore y NUNCA subirse al repo.

--------------------------------------------------------------
### 4.3 Ingreso rápido con aviso flotante (lo más importante de recepción)
--------------------------------------------------------------
- En el inicio de recepción, un botón GRANDE de ingreso rápido, siempre a mano. Además, un atajo de teclado desde cualquier pantalla (por ejemplo F2 o la tecla /).
- Se escribe DNI, nombre o teléfono, o se escanea el QR/tarjeta (el lector escribe en el mismo campo). Enter → se registra.
- Al registrar, aparece un AVISO FLOTANTE abajo a la derecha: una tarjeta chica con una franja de color, que no tapa el trabajo:
  - 🟢 VÁLIDO → nombre, plan, "le quedan X días".
  - 🔴 NO VIGENTE → en rojo, imposible de no ver. Dice el motivo ("venció hace 6 días", "debe $X", "pack agotado", "fuera del horario de su plan", "congelado").
  - 🟡 POR VENCER → vence en 3 días o menos.
  - 🔵 EN PRUEBA → período de prueba, con fecha de fin.
- Si entran varios seguidos, se apilan los últimos 3.
- El aviso se va solo a los segundos, pero queda fijo si pasás el mouse o lo tocás.
- [PROPUESTA] Sonido distinto para válido y no válido, desactivable.
- Al TOCAR el aviso se abre un panel lateral (sin cambiar de pantalla) con la ficha rápida de ESE socio:
  - nombre, foto (si tiene) y DNI con el que ingresó
  - estado: vigente / no vigente / en prueba / congelado
  - plan y tipo de plan
  - vigencia: desde, hasta, meses y días que le quedan, con barra visual
  - cuándo pagó la última vez, cuánto pagó y por qué método
  - cuándo le toca pagar y cuánto
  - cuánto lleva pagado (historial de pagos)
  - si NO está vigente: cuánto debe, desde cuándo, qué plan tiene que pagar y cuánto, más un botón grande "COBRAR AHORA" con el monto sugerido
  - botón "Dejar pasar igual", con motivo obligatorio que queda registrado
  - últimos ingresos
  - notas del socio
  - botón wa.me para escribirle
- Todo dividido por socio: cada uno tiene su estado de cuenta propio y claro.
- Esc cierra el panel. La X siempre visible. Nunca queda trabado.
- Un ingreso repetido del mismo socio en pocos minutos no cuenta doble.

--------------------------------------------------------------
### 4.4 Lo que se ve siempre (para no estar apretando todo el tiempo)
--------------------------------------------------------------
En recepción, fijo en pantalla, actualizado en vivo:
- adentro ahora
- entraron hoy
- vencen hoy
- deben (cantidad)
- caja del turno
- lista en vivo de los últimos ingresos (tocar uno abre su ficha)

En el dueño, en el inicio, lo mismo más:
- cobrado hoy
- por vencer esta semana
- plata en riesgo (socios que dejaron de venir)

Funciones frecuentes como botones emergentes y accesos rápidos (cobrar, alta de socio, pase diario), no escondidas en menús.

--------------------------------------------------------------
### 4.5 Landing predeterminada de gimnasio
--------------------------------------------------------------
- Cada gimnasio tiene una landing LISTA desde el día uno, con plantilla de gimnasio y su nombre. Entrás y ves el gimnasio, no una página vacía. Después todo se edita desde Configuración.
- Contenido base:
  - portada con foto grande, nombre y dirección
  - dos botones: "Soy socio" (entrar) y "Quiero ser socio" (alta)
  - planes y precios
  - clases de la semana
  - horarios
  - ubicación con mapa
  - WhatsApp (wa.me)
  Todo sale de los datos del gimnasio.
- Más limpia, más encuadrada y más linda que la actual: márgenes consistentes, una grilla clara, nada desalineado.
- Editable desde Configuración: logo, colores, foto de portada, textos, qué secciones se muestran y en qué orden.
- Preparada para Google: título, descripción, imagen para compartir, datos estructurados de gimnasio, sitemap.
- Preparada para dominio propio (lo compro yo después): configuración lista en Vercel.

--------------------------------------------------------------
### 4.6 Panel del socio (login para clientes)
--------------------------------------------------------------
- Login simple y perfeccionado (ver la decisión en PREGUNTAS.md). Por defecto: mail y contraseña, con "olvidé mi contraseña"; el socio recibe un link para crearla cuando lo dan de alta.
- Ve:
  - si está vigente o no, en grande
  - días que le quedan
  - cuánto debe y cuándo paga
  - historial de pagos
  - su QR de ingreso, que rota y no se puede reenviar
  - sus clases
  - botón para pagar
- [PROPUESTA] Instalable como app en el celular (PWA).

--------------------------------------------------------------
### 4.7 Asistente de configuración de 9 pasos
--------------------------------------------------------------
Al entrar por primera vez, el dueño completa 9 pasos para que todo quede perfecto. Reglas:
- Se puede salir y retomar sin perder nada.
- Se ve el avance.
- Cada paso explica qué es.

Los 9 pasos:
1. Datos del gimnasio: nombre, dirección, teléfono, WhatsApp.
2. Logo, colores y foto de portada (con vista previa de la landing).
3. Horarios de apertura.
4. Planes y precios (cuota, pase diario, packs; prueba gratis sí/no).
5. Métodos de cobro: efectivo, transferencia, QR, Mercado Pago. El botón "probar conexión" verifica contra Mercado Pago.
6. Cómo entra la gente: modos de acceso, días de tolerancia y qué hacer con quien debe.
7. Clases y profes (o saltear si es solo sala de máquinas).
8. Equipo: crear recepcionistas.
9. Cargar socios: a mano o importando un Excel, con validación.

Al terminar: "Tu gimnasio está listo", con los links para compartir.

--------------------------------------------------------------
### 4.8 Seguridad
--------------------------------------------------------------
- RLS probada con cada rol: un gimnasio no ve nada de otro; una recepcionista no ve lo que no debe; un socio solo se ve a sí mismo.
- Límite de intentos en el login y en los formularios públicos, y protección anti-bots en "Quiero ser socio".
- Todo validado en el servidor (precios, montos, vigencias). Nada importante se decide en el navegador.
- Claves solo en variables de entorno. Nada sensible expuesto.
- Cabeceras de seguridad.
- Auditoría: quién cobró, anuló, dejó pasar, creó o desactivó a quién, y cuándo.
- DNI y datos personales tratados con cuidado (Ley 25.326).
- Antes de mañana: cambiar contraseñas demo débiles y dejar anotado en PROGRESO.md si Supabase y Vercel necesitan plan pago para un cliente real.

--------------------------------------------------------------
### 4.9 Las últimas cosas pendientes
--------------------------------------------------------------
Revisá en la checklist existente del proyecto todo lo que quedó sin terminar y metelo en PROGRESO.md con su prioridad. Lo que bloquee el uso de mañana es P0.

====================================================================
## 5. DISEÑO (lo quiero muy bien)
====================================================================
Escribí DISEÑO.md con el sistema visual y respetalo en todo.

Identidad: gimnasio, con energía pero limpio. Encuadrado, ordenado, fácil de leer de un vistazo en el mostrador.

Propuesta base (mejorala si encontrás algo mejor en la investigación):
- Tipografía: condensada y fuerte para títulos y números grandes (por ejemplo Barlow Condensed, Archivo o Oswald), y una sans muy legible para el texto. Números tabulares en montos y días.
- Color:
  - fondo claro y limpio
  - texto casi negro
  - el color del gimnasio como acento único (configurable)
  - semáforo fijo para estados: verde, rojo, ámbar y azul
  Todo con tokens; ningún color suelto en el código.
- Recepción como un "mostrador":
  - buscador gigante arriba
  - números fijos en una franja
  - lista en vivo de ingresos
  - avisos flotantes abajo a la derecha
  - fichas en panel lateral
- Paneles: sidebar por secciones como Sillón, 4 secciones principales y el resto en el menú.
- Landing: la foto real del gimnasio manda; título grande con el nombre; botones claros; planes en tarjetas simples con el precio grande.

PROHIBIDO (que no parezca IA):
- degradados violeta y azul
- emojis como decoración
- grillas de tarjetas idénticas de "ícono + título + texto"
- frases vacías tipo "Transformá tu vida"
- testimonios o números inventados
- fotos de stock que pretenden ser el gimnasio
- sombras y bordes redondeados exagerados

Modales y paneles: abren y cierran limpio, X siempre visible, Esc y tocar afuera cierran, nunca se superponen ni se traban.

Celular: recepción usable en tablet y celular; el socio y el profe, celular primero.

====================================================================
## 6. P1 — LOS 70 DETALLES (escribilos en DETALLES-70.md y verificá cada uno)
====================================================================
Varios pueden existir ya: verificalos, no los rehagas.

RECEPCIÓN E INGRESO
1. Búsqueda por nombre, DNI, teléfono o número de socio, sin importar tildes, mayúsculas ni errores chicos.
2. Atajo de teclado global para el ingreso rápido.
3. El lector de QR o tarjeta escribe en el mismo campo del buscador.
4. Aviso flotante verde / rojo / ámbar / azul (4.3).
5. Sonido válido / no válido, desactivable.
6. Ficha rápida en panel lateral al tocar el aviso.
7. "Cobrar ahora" desde el aviso rojo, con monto sugerido.
8. "Dejar pasar igual" con motivo obligatorio y registrado.
9. Motivo de rechazo siempre escrito.
10. Ingreso repetido en pocos minutos no cuenta doble.
11. Lista "Entraron hoy" en vivo.
12. Contador "Adentro ahora".
13. Pase diario vendido en dos toques.
14. Alta rápida de socio desde recepción en menos de 30 segundos (nombre, DNI, teléfono, plan).
15. Foto del socio desde la cámara, para validar identidad.
16. Si se corta internet: mensaje claro, reintento y ningún ingreso perdido.
17. Historial de ingresos por socio.
18. "Vencen hoy" siempre visible.
19. Cumpleaños de hoy.
20. Notas del socio visibles al validar (por ejemplo "debe la toalla").

SOCIOS, VIGENCIA Y COBROS
21. Estado de cuenta claro por socio: plan, desde, hasta, pagos y deuda.
22. Barra visual de vigencia con días restantes.
23. Métodos de pago: efectivo, transferencia, QR, débito y Mercado Pago, editables por gimnasio.
24. Pagos parciales con saldo pendiente.
25. Renovar en un toque con el mismo plan.
26. Cambio de plan: desde el próximo período o prorrateado (configurable).
27. Período de prueba con fecha de fin y botón para convertirlo en socio.
28. Congelamiento con tope de días, que corre el vencimiento.
29. Packs de clases que se descuentan al asistir, no al reservar.
30. Recargo por mora encendido / apagado y editable.
31. Descuentos configurables (familiar, estudiante, etc.).
32. Comprobante de pago para mandar por wa.me.
33. Link de pago de Mercado Pago por socio, por el monto exacto y con vencimiento.
34. Webhook idempotente y fuera del middleware.
35. Anular un cobro con motivo y auditoría.
36. Caja por turno: apertura, cierre y arqueo, discriminada por método.
37. La recepcionista ve su caja; el dueño ve todas.
38. Importar socios desde Excel con validación y vista previa.

EQUIPO Y PERMISOS
39. El superadmin crea el gimnasio y el dueño, con la contraseña que pone él.
40. El dueño crea recepcionistas, profes y otros usuarios con mail.
41. Desactivar usuarios sin borrarlos.
42. Resetear contraseñas desde el dueño y el superadmin.
43. Matriz de permisos editable por el dueño (por ejemplo, si recepción puede anular cobros).
44. Registro de quién hizo qué.
45. "Entrar como" del superadmin, auditado.
46. Links fijos por rol, listos para pasar.

PROFES Y CLASES
47. El profe ve sus clases del día y sus alumnos.
48. Tomar asistencia en un toque.
49. Cupos y lista de espera.
50. Rutinas simples por alumno.
51. El profe no ve plata.
52. Horas dadas por profe, para liquidarle.

PANEL DEL SOCIO
53. Login simple con recuperación de contraseña.
54. Ve vigencia, días que le quedan, deuda y fecha de pago.
55. QR de ingreso rotativo.
56. Reservar clases.
57. Historial de pagos.
58. Instalable como app (PWA).

LANDING
59. Plantilla de gimnasio por defecto, con el nombre del gimnasio.
60. Editable desde Configuración (logo, colores, fotos, textos, secciones y orden).
61. Botones "Soy socio" y "Quiero ser socio".
62. Planes, clases y horarios salen de los datos.
63. Lista para Google (SEO, datos estructurados, sitemap).
64. Lista para dominio propio.

DUEÑO
65. Inicio con los números del día.
66. Retención: dejaron de venir, por vencer, vencidos y se fueron, con wa.me armado.
67. "Plata en riesgo" en pesos.
68. Horarios pico reales, según los ingresos.
69. Reporte mensual simple: socios, altas, bajas, ingresos.
70. Asistente de 9 pasos que se puede retomar.

====================================================================
## 7. P2 — [PROPUESTAS] PARA DESPUÉS DE LO ANTERIOR
====================================================================
- Pantalla para la TV del gimnasio: clases de hoy, cupos y profe.
- Pase de invitado: un socio trae un amigo y queda como contacto.
- Ocupación en vivo visible para el socio ("está lleno, voy más tarde").
- Congelamiento autogestionado por el socio.
- Modo "tengo que cobrar": el 1 de cada mes, quién pagó, quién no y los wa.me armados.
- Tablet en la entrada en modo kiosco.

====================================================================
## 8. CRITERIO DE "TERMINADO": SIMULACIÓN COMPLETA
====================================================================
En un gimnasio demo con 5.000 socios:
1. Como superadmin creo un gimnasio y su dueño con contraseña, y entro como él.
2. El dueño completa los 9 pasos, la landing queda linda con su nombre sin tocar código, y crea una recepcionista y un profe.
3. La recepcionista registra 20 ingresos seguidos con el atajo de teclado:
   - aparecen los avisos verde, rojo, ámbar y azul
   - uno rojo se cobra desde el aviso y pasa a verde
   - uno se deja pasar con motivo
4. Ningún ingreso tarda más de 1 segundo, ni con 5.000 socios.
5. Un pago de prueba por Mercado Pago actualiza la vigencia solo, y un webhook repetido no duplica nada.
6. Un socio entra a su panel desde el celular, ve su vigencia y su deuda, y muestra su QR.
7. El profe toma asistencia y no ve plata.
8. Un segundo gimnasio no puede ver nada del primero (RLS probada con cada rol).
9. VELOCIDAD.md muestra el antes y el después, con la explicación de por qué andaba lento.
10. Ningún botón roto, ningún modal trabado, ningún color fuera de la paleta.
11. Los 70 detalles están marcados ✅ o tienen el motivo escrito.

Al final dejame arriba de PROGRESO.md:
- resumen corto
- links por rol
- cómo probarlo
- lo bloqueado
- las preguntas abiertas