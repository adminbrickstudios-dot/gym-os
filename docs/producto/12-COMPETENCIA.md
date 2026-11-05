# Gym OS frente a la competencia

Investigación del 04/11/2026. Comparado contra `docs/HOJA-DE-RUTA.md` (completa,
con el detalle por panel) y `docs/producto/`. Cada función de la competencia que
aparece acá la confirmé en una página que abrí (página del producto, precios,
centro de ayuda, reseñas o la transcripción de un video). Lo que no pude
confirmar no está.

Reddit bloquea la lectura directa: las citas de dueños en Reddit salen de una
recopilación con los links a cada hilo (Vibefam, que también vende software y
por eso barre para su lado). Las de Capterra las leí en Capterra.

---

## 1. Los productos

| Producto | Para quién | Precio (lo que publican) | Por qué se lo conoce |
|---|---|---|---|
| **ABC Glofox** (Irlanda, de ABC Fitness) | Estudios boutique, cadenas y franquicias | No lo publica; "desde US$99/mes" según PushPress | Reporte de socios en riesgo con IA (16+ señales) · recorridos automáticos para socios nuevos · links de pago que reintentan cobros fallidos · reportes de varias sedes juntas |
| **Mindbody** (EE.UU.) | Fitness, bienestar y belleza; más fuerte en estudios grandes | Starter US$79/mes por sede (EE.UU.); Accelerate y Ultimate a cotizar. La app marketplace cobra 20% de la primera compra de cada cliente nuevo (tope US$30) | Marketplace con 3M+ usuarios · recepción con IA (AI Concierge) · precios dinámicos y ofertas de ingreso · integración con ClassPass |
| **PushPress** (EE.UU.) | CrossFit, funcional, gimnasios independientes | Core Free US$0 (4,99% + 0,30 por tarjeta) · Pro US$159 · Max US$229. Agregados: Grow (CRM) US$329, Train desde US$79, app con marca US$97 | Plan gratis de verdad · kiosco en tablet con "check-in rápido" y venta · WOD en las TVs del gimnasio gratis · seguimiento de grados para artes marciales |
| **Wodify** (EE.UU.) | CrossFit, artes marciales, boutique | Essentials desde US$99/mes por sede; Accelerate y Ultimate más caros | Kiosk+ (TV de la sala con anotados, WOD y resultados en vivo) · seguimiento de rendimiento y tablas de posiciones · calculadora de sueldos y tareas para el equipo · integra ClassPass y Wellhub |
| **Zen Planner** (EE.UU., de Daxko) | Artes marciales, CrossFit, estudios | Studio desde US$99 · Essentials US$198 · Ultimate US$348 · Engage (marketing) US$249 | Grados y cinturones · sueldos de profes · cobra por socio activo |
| **Gymdesk** (EE.UU., de Daxko) | Artes marciales (BJJ, karate, judo), gimnasios chicos | US$75 a US$275/mes según socios activos (US$25 más sin su procesador de pagos) | Todas las funciones en todos los planes · grados con requisitos y "listos para rendir" · recuperación de cobros fallidos · torneos (Smoothcomp) |
| **Virtuagym** (Países Bajos, en España y LatAm) | Gimnasios y cadenas (Basic-Fit, Synergym) | Manage 46 · Coach 46 · All-in-One 82 por sede por mes (la página no dice la moneda en lo que leí) | Panel de retención con alertas de inactividad · retos y gamificación · comunidad dentro de la app · encuestas automáticas |
| **Exercise.com** (EE.UU., ahora Daxko) | Gimnasios, entrenadores, rendimiento deportivo | No publicado en la página que leí | Apps con marca propia · comisiones de entrenadores · TV con rutinas, tablas de posiciones, venta de planes online |
| **Fitco** (Perú, en toda LatAm, también Argentina) | Estudios de pilates, yoga, cycling, funcional, boutique | Lite US$59 · Core US$99 · Growth US$169 por mes (pago trimestral); Enterprise a cotizar. Muestra el precio también en pesos argentinos | Integración con Wellhub, TotalPass y Mercado Pago · reserva de lugar (bici/reformer) · factura electrónica · clases grabadas y en vivo |
| **WodBuster** (España) | Boxes de CrossFit | Gratis hasta 10 usuarios · 34€ (35 usuarios) · 44€ (70) · 54€ ilimitado por mes | Pizarra del WOD y Vista TV · marcas de los atletas · competencias (WodBuster Arena) · web gratis |
| **Trainingym** (España, en LatAm) | Gimnasios medianos, grandes y cadenas | Básico desde 199€/mes, Pro desde 319€/mes (500 socios, pago anual) + puesta en marcha 99–580€ | Básculas de bioimpedancia y dietas · control de acceso · integración Wellhub · manejo de redes sociales |
| **DeporWeb** (España) | Centros deportivos y gimnasios | No publicado en la página que leí | Firma de contratos con tableta · control de acceso 24 h con domótica · alquiler de casilleros y materiales · exporta a sistemas contables |
| **GymManager** (Posadas, Argentina) | Gimnasios de barrio y medianos de Argentina | Gratis hasta 15 socios · $35.000 (50 socios) · $60.000 (120) · $95.000 (250) · $145.000 (500) por mes. Seguimiento de morosos: $30.000/mes aparte | En pesos con Mercado Pago · fiado con tope · fichaje QR sin equipos · dice en su web lo que no hace (no factura con ARCA, no integra molinetes, no tiene push ni reservas desde la app) |
| **GymVibes** (Argentina) | Musculación, funcional, pilates, artes marciales, natatorios | Precio fijo mensual, no cobra por socio (no vi el número) | Factura ARCA de a una o por lote · app de profes que calcula los honorarios · app nativa en las tiendas |
| **Midu** (Argentina, 2025) | Gimnasios, pilates, natación | Desde $47.000/mes (Esencial) | Factura ARCA automática con cada cobro · integra molinetes GSD, Tango Access y ZKTeco · automatizaciones con condiciones |

---

## 2. Lo que tienen y nuestra hoja de ruta no

Ordenado por valor para venderle a un gimnasio argentino. "Nota" dice si algo de
la hoja de ruta lo toca a medias.

### Alta

| Qué es | Quién lo tiene | Por qué le importa a un dueño argentino | Panel | Nota |
|---|---|---|---|---|
| **Factura electrónica ARCA por cada cobro**, de a una o el mes entero por lote, y el PDF le llega al socio | GymVibes, Midu (desde el plan Profesional), Fitco (agregado), WodBuster ("facturación cumpliendo la normativa") | Según `docs/requisitos.md`, la RG 5866 pide un comprobante por cada cuota. Entre los argentinos que vi, GymManager no la tiene y GymVibes y Midu sí: es lo que define a quién le compran | Vender/Caja · Configuración (delegar el CUIT a BRIK en el alta) · Super admin | Está investigado en `requisitos.md` y nombrado como FAC-1 en `05-ALTA-Y-PAGOS.md` y `11-IDEAS.md` ("Después"), pero **no tiene ítem en la COLA** |
| **Integración con Wellhub (ex Gympass) y TotalPass**: el check-in del usuario de la plataforma se valida solo, cuenta como entrada y aparece en el Resultado | Fitco (plan Growth), Trainingym (crea el prospecto con origen Wellhub), Wodify (Wellhub y ClassPass), Glofox (ClassPass) | `requisitos.md`: Wellhub tiene gimnasios en Salta y sin integración la recepción valida cada check-in a mano en el portal, dentro de 20 minutos. Una reseña de Glofox en Capterra se queja justamente de que su integración con Wellhub está incompleta | Entrada · Socios (origen) · Resultado · Configuración | Investigado en `requisitos.md` (Access Control API v2), **sin ítem en la COLA**. En la base sería un hecho nuevo que lee `estado_acceso`, nunca un cálculo aparte |
| **Puntaje de riesgo de baja por socio**, armado con varias señales (viene menos que lo suyo de siempre, dejó de reservar, le rebotó un pago, no abre la app), con la acción al lado | Glofox (reporte de socios en riesgo con IA, 16+ señales), Wodify ("clientes en riesgo de cancelar"), Fitco (CRM que "detecta socios en riesgo"), Virtuagym (panel con indicadores: menos de 4 visitas al mes, alta sin terminar, encuesta baja) | Es el corazón de Gym OS y los grandes lo venden como IA. Acá puede salir de una función SQL con reglas claras, explicando el porqué ("venía 3 veces por semana, hace 9 días que no viene") | Retención | Está como "Predicción de bajas" en `11-IDEAS.md` (Después). RET-1 es la tendencia general, no un puntaje por socio |
| **Recorrido de los primeros 30 a 90 días del socio nuevo**: hitos (día 1, 3, 7, 14, 30), una meta ("12 entradas el primer mes") y alerta si en la primera semana no vino 3 veces | Glofox (recorridos automáticos: apuntan a 5+ visitas en los primeros 30 días; recorrido el día 1, clases sugeridas el día 3, control de avance el día 14), Virtuagym (primera visita agendada antes de irse, objetivo a 30 días, control a los 14 días) | Los dos dicen que la mayoría de las bajas pasan en los primeros meses. Es retención antes de que haga falta retener | Retención · Vencen hoy/Avisos (bandeja) · App del socio (la meta) | Hoy está la lista "nuevos que aflojan" y el mensaje de bienvenida (CFG-5), pero falta la secuencia con hitos |
| **Liquidación de los profes**: clases dictadas y presentes → lo que se le paga a cada uno a fin de mes, con comisión por packs o personalizados | GymVibes (la app de profes calcula los honorarios), GymManager ("liquidación de entrenadores"), Wodify (calculadora de sueldos), Zen Planner (sueldos), Glofox (reporte de sueldos), Exercise.com (comisiones de entrenadores) | En Argentina muchos profes son monotributistas y cobran por clase: el dueño lo hace en Excel. Dos competidores argentinos ya lo tienen | Equipo · Resultado (como gasto) | `01-VISION-Y-MVP.md` lo deja fuera del MVP ("comisiones de profes"); **sin ítem**. Toca plata: la decide Mateo |

### Media

| Qué es | Quién lo tiene | Por qué le importa a un dueño argentino | Panel | Nota |
|---|---|---|---|---|
| **TV de la sala**: el WOD grande, los anotados con foto (se ven de lejos), los resultados en vivo; se arma con plantillas | Wodify Kiosk+, PushPress Screens (gratis en todos los planes), WodBuster "Vista TV", Exercise.com "TV Workouts", GymFlow (Argentina) "pantalla de sala" | En un box es lo primero que se ve al entrar. Se arma con un TV y cualquier compu, sin equipos especiales | Clases | CLA-4 muestra el WOD solo en la app |
| **Resultados del WOD y tabla de posiciones** por clase, con benchmarks | Wodify, WodBuster, PushPress Train, Exercise.com | Wodify dice que los gimnasios donde la gente anota sus resultados retienen más, y lo atribuye a sus datos | Clases · Rutinas · App del socio | RUT-3 tiene las marcas de cada uno; el tablero está en `11-IDEAS.md` (Después) |
| **Retos y logros**: reto del mes ("12 entradas"), festejo de la entrada 50 y la 100, premio que configura el dueño | Virtuagym (retos y gamificación), PushPress (Committed Club), Wodify (rachas semanales y festejos), Glofox (festejos automáticos) | Hace que se note quién viene y quién no, y es contenido para Instagram | App del socio · Retención | APP-7 hace la racha; los retos están en `11-IDEAS.md` (Después) |
| **Reservar un lugar puntual** (bici, reformer, colchoneta) en un mapa de la sala | Glofox (mapas de sala y de bicis, según la comparación de PushPress), Fitco ("reserva de posiciones") | El pilates con reformer y el spinning son de lo que más crece en estudios. Una reserva normal no alcanza cuando la bici 3 está rota | Clases · App del socio | No está |
| **Grados y cinturones** con requisitos (clases, horas, antigüedad) y la lista de "listos para rendir" | Gymdesk, PushPress (seguimiento de grados), Zen Planner (cinturones) | "Artes marciales" es uno de nuestros tipos de gimnasio y la tabla dice "grados", pero no hay ningún ítem | Socios · Clases | Sin ítem |
| **Documentos para firmar**: varios por gimnasio (deslinde, contrato, reglamento, autorización del padre), firma en el kiosco o en recepción, sin firma no hay check-in, reporte de "sin firmar" | PushPress (el kiosco pide la firma y bloquea el check-in), Glofox (reporte de acuerdos sin firmar), Exercise.com (firma electrónica), DeporWeb (tableta de firmas), Gymdesk (firma de los padres para menores) | Al socio que se carga en el mostrador hoy nadie le hace aceptar el reglamento. Con menores (D10) hace falta la firma del adulto | Socios · Entrada · Configuración | REG-1 guarda la aceptación solo en el alta online. Sin contenido médico |
| **Pedir la reseña de Google** en un buen momento (después de la entrada 10 o de una marca personal) | PushPress Grow (GymHappy) | Al gimnasio de barrio lo encuentran en Google Maps | Avisos · Página | No está |
| **Encuesta corta automática** ("¿cómo fue tu primer mes?", la pregunta de si nos recomendarías del 0 al 10) | Virtuagym (cuestionarios según el momento del socio), Glofox (encuestas y avisos de satisfacción) | Avisa del enojo antes de la baja; los que ponen 9 o 10 son los que hay que invitar a REF-1 | Retención · App del socio | RET-3 solo pregunta el motivo al dar de baja |
| **Tareas del equipo**: "llamar a Juan el jueves" asignado a alguien, con las de hoy en Inicio | Wodify (tareas), Glofox (reporte de tareas), Gymdesk (tareas en el inicio) | El seguimiento depende de que alguien se acuerde. Una tarea con dueño y fecha no se olvida | Inicio · Retención · Equipo | RET-2 anota el contacto pero no agenda el próximo paso |
| **Tienda en la app del socio**: pide una proteína o un agua y la retira o paga en recepción, o se suma a su cuenta | GymManager (pedidos a la tienda desde la app), Wodify (compras desde la app y "sumar a la próxima factura"), WodBuster (productos desde la app), DeporWeb (tienda online) | Los suplementos son margen. Se conecta con VEN-4 (stock) y D5 (cuenta corriente) | App del socio · Vender | "Tienda online" está en `11-IDEAS.md` (Después) |
| **Cupones con código** para campañas ("VERANO" en la página o en el alta online), con tope de usos y vencimiento | Fitco (cupones), Exercise.com (códigos de cupón) | Los dueños promocionan en Instagram y necesitan saber qué campaña trajo a quién | Planes · Página | D14 es un convenio que se le asigna a un socio, no un código público |
| **Píxel de Meta y Google Analytics** en la página y en el alta online | Fitco | Sin esto no se puede medir lo que se paga en publicidad de Instagram | Página · Configuración | No está |
| **Recuperar cobros fallidos**: reintento automático, link de pago por WhatsApp y un tablero de cobros rebotados y tarjetas por vencer | Glofox (links de pago que reintentan), Gymdesk ("recuperación de cobros fallidos"), PushPress (seguimiento de cobros rebotados y tarjetas vencidas, según Glofox) | Glofox dice que en su red baja las bajas entre 6 y 12%: es el socio que se va sin haberlo decidido | Vencen hoy/Avisos · Resultado | Roza MP-2/MP-3 (aviso de "débito falló"); faltan el reintento y el tablero |
| **Día fijo de cobro para todos** ("del 1 al 10") con el primer mes proporcional | PushPress (cobro proporcional y mismo día de cobro para todos) | Es como cobran muchos gimnasios argentinos | Planes · Configuración | Es la pregunta abierta 2 de `SCHEMA.md` §7; sin decidir |
| **Eventos y workshops** sueltos (seminario, clase especial) con cupo, precio y pago | Fitco ("kit para eventos"), PushPress (check-in de eventos en el kiosco), Glofox (eventos; una reseña dice que le cuesta publicarlos) | Yoga, pilates y boxes viven de los workshops | Clases · Vender · Página | Solo existen clases y packs |
| **Asistente con IA**: el dueño le pregunta por sus números, y una recepción automática contesta precios y horarios y reserva | Mindbody (AI Concierge), Wodify ("Ask Wodify" y conexión MCP), PushPress (asistente de IA), Fitco ("agentes de IA") | Hoy vende. En Argentina la recepción automática tendría que andar por WhatsApp | Inicio · Super admin | "Asistente para el dueño" está en `11-IDEAS.md` (Después) |
| **Retención por camadas y por frecuencia**: bajas del mes, cuántos de los que entraron en un mes siguen a los 90 días, % de socios con menos de 4 visitas al mes | Virtuagym (las tres, con fórmula y señal de alarma), Glofox (movimiento neto de socios y % de bajas) | Virtuagym: un mes puede cerrar con 40 altas y 40 bajas y verse "igual" | Retención · Resultado | RET-1 trae tendencia, altas y bajas; no camadas ni frecuencia |
| **Vender y renovar en el kiosco**: comprar un agua o renovar el plan en la tablet de la puerta | PushPress (compra de productos y planes en el modo kiosco) | En el gimnasio sin recepción (24 h) el kiosco es la única caja | Entrada · Vender | ENT-3 y ENT-6 son solo para entrar |

### Baja

| Qué es | Quién lo tiene | Por qué le importa a un dueño argentino | Panel | Nota |
|---|---|---|---|---|
| Clases grabadas o en vivo en la app | Fitco (clases grabadas desde el plan más barato), Exercise.com (transmisión en vivo, videos), Virtuagym (PRO+) | Valor de la cuota los días que no viene; poco pedido en el gimnasio de barrio | App del socio · Clases | No está |
| Chat interno del equipo y notas del socio a la vista antes de la clase | PushPress Staff App (chat entre el equipo, notas), Fitco (chat en el sistema) | Recepción y profe hoy hablan por WhatsApp personal | Equipo | No está. PushPress además muestra "lesiones" del socio: eso no |
| El socio suma un familiar o cambia su medio de pago desde la app | PushPress | Menos trabajo de recepción | App del socio | APP-8 cubre pausa y baja |
| API, webhooks salientes, Zapier, exportar a sistemas contables | Glofox (Zapier, API), Wodify (QuickBooks, API, MCP), DeporWeb (exporta a contables) | Para cadenas y contadores; RES-2 (CSV) alcanza para el chico | Configuración · Super admin | RES-2 exporta CSV |
| Compararse con gimnasios parecidos (retención, ingreso por socio) | Mindbody (comparación contra ~40.000 estudios) | BRIK tiene los números de todos sus gimnasios: anónimo, es un argumento de venta | Resultado · Super admin | No está |
| Metas del mes (altas, venta de productos) con su barra | Fitco (meta de venta de planes y productos) | Motiva a la recepción que vende | Inicio · Resultado | No está |
| Impresora de tickets | Fitco | Algunos mostradores la piden | Vender | VEN-1 manda el comprobante por WhatsApp |
| Alquiler de casilleros y materiales | DeporWeb | Ingreso extra en gimnasios grandes | Vender · Planes | No está |
| Competencias y torneos | WodBuster Arena, Gymdesk (Smoothcomp) | Comunidad en boxes y artes marciales | Clases | No está |
| Ofertas de ingreso y precios dinámicos ("primer mes $X") | Mindbody | Captar en enero y marzo | Planes | PLA-5 hace precio por día, no oferta de ingreso |

### Lo que tienen y dejamos afuera a propósito

- **Huella y cara en la puerta** (Fitco, Midu, Acceso Gym según Midu): `04-ACCESO.md` las descarta por la Ley 25.326 (datos biométricos).
- **Composición corporal y bioimpedancia** (Trainingym, Virtuagym), **frecuencia cardíaca en vivo** (Wodify, Virtuagym Fitzone), **fotos de progreso del cuerpo** (Exercise.com), **"lesiones" del socio a la vista del profe** (PushPress Staff App): son datos de salud.
- **Planes de alimentación** (GymManager, Trainingym, Virtuagym, DeporWeb): no son diagnósticos, pero se acercan (peso, objetivos de salud). Lo decide Mateo; yo no lo sumaría.
- **Apto médico archivado** (lo recomienda una guía de Develop Argentina): D9 guarda solo sí/no y vencimiento. Ver "Para Mateo" abajo.

---

## 3. Quejas de dueños (y cómo las damos vuelta)

| Queja | Dónde aparece | Cómo la damos vuelta |
|---|---|---|
| **El precio no se sabe hasta hablar con ventas, y aparecen costos escondidos** | Reddit: "Glofox does not advertise their fees or costs, you have to email them and basically negotiate"; Capterra Glofox: "hidden fees… from the cost not including VAT" y "costs and features that aren't well explained in order to… get extra add ons purchased" | Precio publicado en pesos, con todo incluido. En Argentina ya es lo mínimo: GymManager, Midu y Fitco lo publican |
| **Contratos largos y una baja imposible** | Capterra Mindbody: "Do not sign Contract… would not let me out of a predatory contract"; Capterra Glofox: "management cares more about holding you in a contract"; Reddit: "Contracts that are nearly impossible to get out of" | Mes a mes, y el dueño se lleva todos sus datos (SEG-2) |
| **La comisión por cobro come la ganancia** | Reddit (r/smallbusiness): "they are effectively taking close to 10% of my gross"; Reddit: Mindbody "close to $600 a month between the $255 subscription and processing" | La plata del socio va directo al Mercado Pago del gimnasio y BRIK no cobra por cobro (`requisitos.md`). Escribirlo en la página de venta |
| **El soporte desaparece después de la firma, o primero contesta un bot** | Capterra Glofox: "Customer service is terrible. 6 months asking for assistance" y "Live customer service comes after a few different AI Q&A exchanges"; Capterra Mindbody: "The sales person also isn't helpful after you sign" | Soporte por WhatsApp con una persona con nombre, en horario argentino (GymManager ya lo vende así) |
| **Errores que cuestan plata** | Capterra Glofox: "payments being processed… and then their purchased class credits disappearing"; Capterra Mindbody: "purchases don't always remove items from inventory"; Reddit: PushPress "Glitchy af", Exercise.com "iOS app has bugs… Zero response" | Nuestras reglas ya lo cubren: toda escritura verifica filas, los webhooks son idempotentes, todo se prueba ejecutando. Se puede contar como garantía |
| **Reportes que no dicen quién** | Capterra Glofox: "they have a report for trials how many people you lost but then you can't actually see who" y "reporting features are inaccurate" | Cada número abre la lista con nombres (ya pensado en Inicio: "tocar uno lleva a su detalle"). Hacerlo regla en RES y RET |
| **Corte apenas vence, sin días de gracia** | Capterra Glofox: "It doesn't offer a grace period after a client misses a payment, as access is blocked immediately" | La gracia configurable y el amarillo con su motivo ya existen: mostrarlo en la demo |
| **Mails con la marca del software, no del gimnasio** | Capterra Glofox: "very confusing to receive an email with all the glofox branding but it's from my business" | Todo sale con la marca del gimnasio (app, página, avisos) |
| **El marketplace le muestra la competencia a tus socios** | Capterra Mindbody: "not happy the other studio in your aria being promoted on the app and to your clients"; el blog de Glofox lo usa en contra de Mindbody | La app es del gimnasio: sin directorio ni otros gimnasios adentro |
| **Complicado, y desde el celular no se puede hacer casi nada** | Capterra Mindbody: "The mobile app lacks many essential features… I often need to use my laptop" y "old school and very difficult to navigate"; Reddit: Zen Planner "awful", interfaz vieja | Celular primero para el dueño y cuatro secciones principales: decirlo en la venta |
| **La migración es a mano** | Capterra Glofox: "a lot of manual work… setting the correct membership, dates"; Reddit: las membresías recurrentes son "the trickiest step" | SOC-1 (importar con vista previa y deshacer 24 h) más migración acompañada por BRIK |
| **La búsqueda no encuentra si falta una coma** | Capterra Mindbody: "hard to look up client information unless everything was exact" | Búsqueda que tolera errores (el stack ya usa `pg_trgm` y `unaccent`) |
| **No se puede mandar un mensaje a todos los anotados de una clase** | Capterra Glofox: "WISH i could bulk text or email from course or class list!"; Capterra Mindbody: "wish we could send out class and course specific emails" | "Avisar a todos" desde la lista de la clase, con la bandeja de AVI-1 (CLA-3 ya lo hace al cancelar) |

---

## 4. Ideas de diseño y UX para copiar

**Entrada y kiosco**
- **Los habituales para tocar** (PushPress): la tablet muestra los que suelen venir a esa hora y el socio toca su nombre en vez de escribirlo. Desaparecen los que ya entraron o reservaron. Como muestra nombres, se puede apagar. Para ENT-3: nombre y la inicial del apellido.
- **Después del nombre, su clase** (PushPress): el kiosco muestra la clase que reservó o la próxima para confirmar con un toque.
- **El kiosco dice por qué no lo deja pasar** (PushPress: "las reglas del plan lo bloquean" o "falta firmar un documento"). Va con nuestro "siempre con el porqué".
- **Salir del kiosco con PIN** (PushPress): la tablet queda bloqueada en modo kiosco y la recepción sale con su PIN. Encaja con D15.
- **Alta en el kiosco** (Wodify Kiosk+): el que llega sin cuenta carga sus datos, firma y paga el pase en la misma pantalla.

**TV de la sala (Wodify Kiosk+, demo en video)**
- Fotos grandes de los anotados, para verlas desde el fondo.
- El que hace check-in desde el celular aparece en la TV al instante, sin recargar.
- La plantilla abre sola en la clase de esta hora; hay plantillas guardadas por programa ("CrossFit", "Kids").
- Paneles que se agrandan, se achican y se cierran a medida que avanza la clase; modo oscuro y pantalla completa.
- El profe carga los resultados desde la TV y el cursor salta solo al próximo casillero.

**Inicio del dueño**
- Gymdesk junta en una vista: cobrado del mes, gráfico de asistencia, reservas, tareas, cumpleaños y avisos. Es casi nuestro Inicio; lo que nos falta son las tareas.
- Gymdesk separa la cobranza en tres: programado, cobrado y vencido, cada uno con su lista. Sirve para Resultado y para Vencen hoy.
- Virtuagym presenta la retención según el problema y no según la herramienta ("si los nuevos se van pronto…", "si las bajas llegan sin aviso…"). Sirve para la pantalla de Retención: primero el problema, después la lista.

**App del socio**
- Wodify: rachas semanales y "volvé a reservar esta clase" (le sugiere las que ya hizo).
- Glofox: la meta del primer mes a la vista (5 visitas en 30 días), con el recorrido del día 1, 3 y 14.

**Para vender (BRIK)**
- GymManager tiene en su web una sección "Lo que no hace (todavía)". Es la regla de Mateo ("nada se promete que no esté") puesta como argumento de venta.
- Midu publica comparaciones contra cada competidor ("Midu vs Acceso Gym", también contra Socio Plus y ABC Evo). Se puede hacer lo mismo con GymManager, GymVibes y Midu.
- Gymdesk tiene una calculadora pública de cuánto ahorrás. Iría bien con ADM-5 ("Probá Gym OS").
- GymManager tiene una página por ciudad (incluida Salta) para aparecer en Google.

---

## Para Mateo (lo que apareció sin buscarlo)

- **Wellhub y ARCA ya estaban investigados** en `docs/requisitos.md` (28/10) pero ninguno de los dos llegó a la COLA de `HOJA-DE-RUTA.md`. Son los dos huecos más caros para vender en Argentina.
- **El apto físico choca con D9.** `requisitos.md` dice que en CABA (Ley 139) y Provincia de Buenos Aires (Ley 12.329) el gimnasio tiene que archivarlo. D9 guarda solo "sí/no y vence". Para vender en Buenos Aires, D9 puede no alcanzar. Es una decisión legal y de producto, no la toqué.
- **GymManager es el competidor más parecido**: argentino, en pesos, fondo crema (`#f4f1eb`), honesto con lo que no hace, gratis hasta 15 socios y con página para Salta. Lo que le falta (ARCA, push, reservas desde la app, molinetes, link de MP que se acredita solo) está casi todo en nuestra hoja de ruta.
- `requisitos.md` nombra un documento "Gym OS — Catálogo de funciones" con una sección de Competencia que no está en el disco. No lo pude leer; puede repetir parte de esto.

---

## 5. Fuentes

**Productos y precios**
- https://www.glofox.com/features/reporting/
- https://www.glofox.com/blog/customer-retention-software/
- https://www.mindbodyonline.com/business/pricing
- https://www.mindbodyonline.com/business/education/blog/new-mindbody-pricing-united-states
- https://www.mindbodyonline.com/business/education/blog/mindbody-pricing-united-states
- https://www.pushpress.com/
- https://www.pushpress.com/pricing
- https://www.pushpress.com/products/core
- https://www.pushpress.com/products/grow
- https://www.pushpress.com/compare/pushpress-vs-glofox
- https://www.pushpress.com/blog/what-does-gym-software-really-cost
- https://www.pushpress.com/feature-list/staff-app
- https://www.pushpress.com/blog/gym-member-check-ins
- https://help.pushpress.com/en/articles/6636984-how-to-check-in-members-using-kiosk-mode-in-the-staff-app
- http://help.pushpress.com/en/articles/508409-core-members-check-ins
- https://www.wodify.com/pricing
- https://www.wodify.com/products
- https://www.wodify.com/blog/wodify-faqs
- https://www.wodify.com/blog/gymdesk-pricing
- https://www.zenplanner.com/pricing
- https://www.zenplanner.com/blog/blogs/zen-planner-pricing-for-martial-arts-and-yoga-studios
- https://gymdesk.com/
- https://gymdesk.com/pricing
- https://docs.gymdesk.com/en/help/docs/account-plan
- https://gymdesk.com/blog/best-martial-arts-management-software
- https://business.virtuagym.com/our-prices/
- https://business.virtuagym.com/es/blog/herramientas-inteligentes-de-fidelizacion/
- https://www.exercise.com/solutions/gym/
- https://www.fitcolatam.com/precios/
- https://www.fitcolatam.com/competencia/
- https://www.fitcolatam.com/por-que-fitco/
- https://wodbuster.com/
- https://wodbuster.com/public/fitness.html
- https://trainingym.com/es/tarifas-gimnasios
- https://trainingym.com/es/soluciones-gimnasios-cadenas
- https://help.trainingym.com/es/knowledge/c%C3%B3mo-controlar-el-acceso-de-clientes
- https://deporweb.es/
- https://gymmanager.com.ar/software-para-gimnasios/argentina
- https://gymmanager.com.ar/precios
- https://gymmanager.com.ar/funcionalidades
- https://gymvibes.app/funcionalidades/
- https://midu.app/comparativas/accesogym
- https://www.gymflow.com.ar/blog/software-para-gimnasios-argentina.html
- https://www.developargentina.com/blog/sistema-gestion-gimnasios-argentinos-2025
- https://wellhub.com/es-ar/

**Reseñas y quejas**
- https://www.capterra.com/p/40229/MINDBODY/reviews/
- https://www.capterra.com/p/136861/Glofox/reviews/
- https://vibefam.com/gym-management-software-reddit-2026/ (recopila hilos de r/gymowner, r/crossfit, r/smallbusiness, r/mindbody, con el link a cada uno; Reddit no se pudo abrir directo)

**Videos**
- https://www.youtube.com/watch?v=-knm2pNCLiI (Wodify Kiosk+, demo completa con transcripción)
- https://www.youtube.com/watch?v=3RDqXrqqjiA (ABC Glofox, presentación; solo título y descripción)

**De la casa (comparado contra esto)**
- `/home/claude/gym-os/docs/HOJA-DE-RUTA.md`
- `/home/claude/gym-os/docs/producto/` (00 a 11 y `paneles/`)
- `/home/claude/gym-os/docs/requisitos.md`
- `/home/claude/gym-os/docs/SCHEMA.md` §7
