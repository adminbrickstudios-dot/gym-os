# 14 · Situaciones del día a día (del gimnasio más grande al más chico)

Investigación del 05/11/2026: repos de código abierto (solo ideas, nunca
código: varios son AGPL/GPL o sin licencia) y 89 situaciones reales. Para la
**tanda 6 (VD-46)**: el agente recorre cada situación, marca con ✅ las que
Gym OS ya resuelve (con dónde), y cada ⭐ que falte se vuelve un ítem
`VD-46A`, `VD-46B`… en la COLA con su LISTO SI. Las que tocan permisos o
plata y no están decididas (D1-D28): lo más prudente, anotado en
"Decisiones que tomó el agente".

**Ojo, reglas del proyecto que mandan sobre lo de abajo**: no se guardan
datos de salud (el incidente se registra sin diagnóstico; nada de
"lesiones"); nada importante depende de un cron (la conciliación nocturna
solo **avisa** y solo corrige lo que falta por el mismo camino del webhook);
la pregunta "¿puede entrar?" la responde solo `calcular_acceso`.

Cosas no verificadas en la fuente (dichas por la investigación): si los
gimnasios están obligados al "botón de baja" (Res. 316/2018 y Disp.
357/2021); los plazos exactos de la Ley 25.326; detalles de CiviCRM y
jverein más allá de su README.

**Primero en la tanda 6** (las más caras si salen mal en Argentina):
aumentos con aviso previo y precio del contrato respetado (13, "lo que
casi nadie piensa" 2); baja por el mismo medio y sin cobros posteriores
(30); cortesías y descuentos con motivo y reporte por persona (11, 22, 23);
cobro duplicado (15, ya en VD-34); aviso si alguien escribe datos de salud
en una nota (casi nadie piensa 7); fichas duplicadas (38); plan familiar o
corporativo cuando el titular deja de pagar (32, 33); socio que cumple 18
(casi nadie piensa 6); vencimiento en un día cerrado (54, casi nadie piensa
12); dispositivos con credencial propia (casi nadie piensa 4).

---

## PARTE 1: Repos open source (solo ideas, no código)

Las estrellas son de una búsqueda en GitHub del 5/11/2026. Los repos AGPL/GPL no se pueden copiar a un SaaS cerrado, y un repo sin licencia tiene todos los derechos reservados. No se toma código de ninguno.

**1. wger-project/wger** (AGPL-3.0, ~7.200★, activo). Rutinas y nutrición, más un módulo de gimnasio.
- Tres niveles de permiso: el profe ve los socios, el admin gestiona un gimnasio, el superadmin gestiona varios.
- Contratos con tipo, opciones y periodicidad (anual a diaria). **El contrato guarda una copia del mail y la dirección del socio al momento de firmar.**
- Notas internas del staff y documentos por socio.
- Aviso al staff de socios inactivos después de N semanas sin venir (configurable).

**2. AsteriaCreations/portico** (AGPL-3.0, pocas estrellas, el más pensado). Check-in para un club de ~1.000 socios, con varias personas atendiendo la puerta a la vez.
- Roles anidados más capacidades sueltas que no dependen del rango (por ejemplo, "equipo de limpieza").
- **Cortesías con motivo.** El admin decide qué motivos puede usar la puerta. El organizador de un evento pide la cortesía y la aprueba un admin.
- **Lista de observación con fecha de revisión.** Notas de conducta cuya visibilidad depende del rol.
- **Datos personales enmascarados** hasta que alguien pide verlos.
- Panel "quién está adentro ahora".
- **Pago al instructor desde la caja del turno.**
- Una entrada cobrada se anula solo con la caja abierta y un motivo. Con la caja cerrada, solo el dueño puede anularla.
- **Los créditos vendidos y no usados se muestran como pasivo.**
- Cuentas de reportes que no ven datos personales.
- Backups con prueba de restauración.
- Funciones que se prenden y apagan por club.

**3. usamam46-git/Frappe-Gymstack** (MIT, chico, con muy buen diseño de pagos).
- **Los días congelados se suman al vencimiento.** Bloquea membresías superpuestas.
- En el lector de acceso: descarta lecturas repetidas dentro de 60 s y chequea que cada dispositivo siga conectado.
- El webhook tiene **guarda de orden**: un "aprobado" que llega después de un "reembolsado" se ignora.
- **Conciliación nocturna contra la pasarela de pago, con 7 chequeos.** Solo corrige sola los eventos que nunca llegaron, y lo hace por el mismo camino que el webhook. El resto lo reporta, porque corregir adivinando mueve plata. Revisa una ventana de 25 h con 15 min de gracia.

**4. johndavedecano/laragym** (~364★, **sin licencia declarada**: se mira, no se toca).
- Multisede, con asistencia por sede.
- Ciclos de cobro diario, semanal, a fecha fija y anual.
- Número de cuenta del socio distinto del DNI.
- Registro de actividad de todo el sistema y PWA para el socio.

**5. civicrm/civicrm-core** (AGPL, ~794★, CRM de membresías muy maduro).
- **El estado se calcula con reglas de fechas** (nuevo, vigente, en gracia, vencido). Es la misma filosofía que `estado_acceso`.
- **Estado forzado a mano con fecha en la que el forzado se vence solo.**
- **Membresía heredada por relación:** de la empresa a sus empleados, o del titular a su familia.
- Membresía vitalicia y período de gracia configurable.

**6. openjverein/jverein** (GPL-3.0, 71★, software alemán para clubes).
- **Cuota familiar:** paga uno y los demás quedan asociados.
- Cargos adicionales únicos o periódicos.
- Débito con mandato firmado y conciliación con el homebanking.
- **Intimaciones de deuda escalonadas.**
- Grupos de cuota por edad.

**7. southlondonmakerspace/membership-system** (48★).
- El acceso se controla por API.
- **Permisos por máquina o área según una inducción hecha.** Aplicado a un gimnasio: pileta, sauna, sala de fuerza para menores, sin guardar datos de salud.
- Débito directo.

**8. doubleunion/arooo** (GPL-3.0, 71★).
- **Cuota escalonada que elige el socio, y becas con aprobación.**
- Mails automáticos por deuda.
- Socios "llave" con acceso fuera de horario.

**9. mayerbalintdev/GYM-One** (223★, licencia propia). Básico: tipos de pase, horario de apertura como dato, reportes. Sirve para ver el mínimo del mercado.

---

## PARTE 2: Catálogo (89 situaciones)

Formato: *qué pasa* → **qué hace el sistema**. ⭐ = una de las 25 más frecuentes o más caras si se resuelven mal.

### Recepción y acceso
1. ⭐ *Fila a las 19 h con un solo puesto.* → **La entrada autónoma es lo normal. Recepción atiende solo las excepciones que marca el sistema.**
2. ⭐ *Socio sin celular o sin batería.* → **Entra con el DNI y la foto en pantalla. Nunca se lo habilita "a mano" sin dejar un motivo.**
3. ⭐ *Credencial prestada.* → **Alertas por patrón: dos entradas sin salida, dos sedes en pocos minutos, entradas muy por encima de su promedio. Foto visible en cada entrada.**
4. *Captura del QR que circula.* → **QR que cambia cada 30–60 s y queda atado al dispositivo.**
5. *Tarjeta perdida.* → **La credencial vieja se anula en el momento, la reposición se cobra si corresponde y queda el historial de credenciales.**
6. ⭐ *Invitado de un socio.* → **Pase con DNI del invitado, tope por mes, deslinde aceptado y registro de quién lo trajo.**
7. *Menor de edad.* → **Edad mínima por plan, horarios y zonas permitidas, y un adulto responsable vinculado.**
8. *Molinete roto o en "libre".* → **Modo emergencia con hora de inicio y fin. Las entradas de ese rato quedan marcadas.**
9. *Se cae internet.* → **Ya está cubierto. Falta avisar los conflictos al sincronizar (el mismo socio en dos lugares).**
10. *"Pagué ayer por transferencia."* → **Pago pendiente con comprobante y un pase provisorio de 24 h que vence solo.**
11. ⭐ *Socio vencido que discute en la puerta.* → **Se ven el motivo y el último pago. Recepción puede dar un único día de cortesía, con motivo, y queda registrado.**
12. *Gimnasio 24 h sin staff de noche.* → **La entrada nocturna se habilita solo si el plan la incluye, hay un aviso la primera vez que alguien entra de noche y se ve el conteo de quiénes están adentro.**

### Plata
13. ⭐ *Aumento por inflación.* → **El precio nuevo tiene fecha de vigencia y aviso previo automático. Quien pagó por adelantado conserva el precio de su contrato.** Ya hay multas confirmadas a gimnasios por no avisar un aumento.
14. *Pago parcial.* → **Queda como saldo o deuda, nunca como "pagó". Qué acceso le da (proporcional o ninguno) es una regla del gimnasio.**
15. ⭐ *Cobro duplicado.* → **Idempotencia por ID externo, alerta si hay dos pagos iguales en menos de 10 min y devolución en un clic.**
16. *Devolución.* → **Se registra como un hecho nuevo con motivo, nunca se borra el pago original. Si hubo factura, se hace nota de crédito.**
17. ⭐ *Contracargo de tarjeta.* → **Llega por webhook, revierte la cobertura (el acceso cambia solo) y arma la evidencia con las entradas del período.**
18. ⭐ *Débito rechazado.* → **Reintentos espaciados según las fechas de cobro de sueldo, link de pago y gracia configurable por gimnasio. En la puerta se ve amarillo, "en gracia".**
19. *Tarjeta por vencer.* → **Aviso 15 días antes y link para que el socio la actualice.**
20. *Deuda vieja que reaparece.* → **Al volver, una regla decide: perdonar, cobrar o cobrar matrícula de reingreso.**
21. ⭐ *Falta efectivo en la caja.* → **El arqueo ciego ya está. Falta ver la diferencia acumulada por cajero a lo largo del tiempo.**
22. ⭐ *Robo interno.* → **Reporte de anulaciones, cortesías y descuentos por usuario. Alerta si un socio entra seguido, no paga y figura "al día" por un ajuste manual.**
23. *Descuento "porque es amigo".* → **Solo con motivos de una lista y un tope por rol. Total mensual de descuentos visible.**
24. *Pago por adelantado de 6 o 12 meses.* → **Se registra como ingreso diferido. Si se da de baja, se calcula el proporcional a devolver.**
25. *Matrícula.* → **Cargo aparte, con excepciones por campaña o convenio.**
26. *Venta pagada con varios medios.* → **Una venta con varios cobros. La caja suma cada medio por separado.**
27. *Factura electrónica (ARCA).* → **Factura B o C, nota de crédito para cada devolución. Una factura nunca se edita.**
28. *Alguien paga la cuota de otro.* → **Pagador y beneficiario son campos distintos.**

### Socios
29. ⭐ *Congelar la membresía.* → **El congelamiento es un hecho con fechas que se suma al vencimiento, con máximo anual y costo opcional. No se guarda el motivo médico.**
30. ⭐ *Baja.* → **Se puede pedir por el mismo medio por el que se contrató (Ley 24.240, art. 10 ter) y se da un código de baja. Los cobros futuros se cancelan en ese mismo acto.** Cobrar después de la baja es la queja número uno contra las cadenas.
31. *Mudanza.* → **Baja sin penalidad o traslado a otra sede.**
32. ⭐ *Plan familiar.* → **Un titular paga y los demás heredan el acceso. Si el titular deja de pagar, el sistema explica qué pasa con cada uno.**
33. *Plan corporativo.* → **La empresa recibe una factura por los socios activos. Si el empleado deja la empresa, pasa a un plan individual o queda sin acceso.**
34. *Convenio con obra social, sindicato o universidad.* → **Precio por convenio, validación periódica de que el socio sigue perteneciendo y fecha de fin del convenio.**
35. *Cambio de plan a mitad de mes.* → **Prorrateo con una regla explícita: si sube, aplica ya; si baja, desde el próximo ciclo.**
36. *Transferir la membresía a otra persona.* → **Solo si el gimnasio lo permite. Queda como hecho, con cargo opcional y el historial separado de cada uno.**
37. *Socio expulsado.* → **Suspensión con motivo, fecha de revisión y alcance (una sede o toda la cadena). También queda bloqueado como invitado y en la venta online.**
38. *Socio duplicado.* → **Fusión de las fichas con todo su historial. Se bloquea un alta duplicada por documento normalizado.**
39. *Prueba gratis.* → **Una por documento y por gimnasio, con seguimiento al terminar.**
40. *Vuelve después de un año.* → **Se reactiva la misma ficha.**

### Staff
41. ⭐ *Se va un recepcionista.* → **Baja en un clic: cierra sus sesiones, revoca sus dispositivos y deja pendiente el cierre de su caja.**
42. ⭐ *Contraseña compartida.* → **Un usuario por persona y un PIN para cambiar de operador rápido. Cada acción queda firmada.**
43. *Turnos y ausencias.* → **Grilla de turnos con alerta si una franja queda sin cubrir.**
44. ⭐ *Liquidación de profes (por clase, por presente o por hora).* → **Las reglas son datos. Si se corrige la asistencia, se recalcula la liquidación.**
45. *Profe que cobra en negro a alumnos propios.* → **Se detecta en la asistencia: gente en sus clases que no figura como socio.**
46. *Permisos finos.* → **La recepción no ve la plata ni exporta. Toda exportación queda registrada.**
47. *Encargado de dos sedes.* → **Rol por sede, no global.**
48. *Personal trainer externo.* → **Se carga como proveedor, con canon y lista de sus alumnos.**
49. *Staff que entrena en el gimnasio.* → **Plan de staff que se corta solo con la baja del empleado.**

### Clases
50. ⭐ *Falta el profe.* → **Se asigna un reemplazo o se cancela con aviso. Se devuelven los créditos y se ajusta la liquidación.**
51. ⭐ *Clase llena.* → **Lista de espera: se ofrece el lugar con un plazo para aceptar. Si no acepta, pasa al siguiente.**
52. ⭐ *No-shows.* → **Ventana de cancelación tardía configurable (2–24 h), penalidad como dato (crédito, cargo o bloqueo) y perdón con motivo.**
53. *Cambio de horario.* → **Aviso a los inscriptos recurrentes.**
54. *Feriado o puente.* → **Calendario de feriados más cierres propios. Cancela con aviso. Si el día cerrado se suma o no al vencimiento lo dice una regla.**
55. *Sobrecupo.* → **El cupo se controla en la base de datos, no solo en la pantalla.**
56. *Lugar o equipo numerado (bici de spinning).* → **Reserva de un lugar concreto.**
57. *Clase con poca gente.* → **Mínimo de inscriptos y cancelación automática X horas antes.**

### Instalaciones
58. *Máquina rota.* → **Ticket con foto y estado "fuera de servicio". Historial por máquina para decidir si conviene reparar o reemplazar.**
59. *Mantenimiento preventivo.* → **Tareas periódicas por equipo, con responsable.**
60. *Lockers.* → **Alquiler con vencimiento propio y procedimiento de apertura con testigo.**
61. *Objetos perdidos.* → **Registro con foto y plazo antes de donar.**
62. ⭐ *Accidente en la sala.* → **Registro del incidente: qué pasó, dónde, testigos, qué se hizo. Sin diagnóstico. Queda cerrado e inmodificable a las 24 h.**
63. *Corte de luz.* → **Definir si el molinete queda abierto o cerrado sin energía, y registrar el evento.**
64. *Apertura y cierre.* → **Checklist por turno, firmado y con hora.**
65. *Limpieza.* → **Checklist asignado como capacidad de la persona, no como rol.**

### Comunicación
66. *Consulta por WhatsApp de alguien que no es socio.* → **Se carga como posible socio, con el origen del contacto.**
67. *Queja.* → **Ticket con responsable y plazo, vinculado a la ficha del socio.**
68. *Sugerencia.* → **Buzón en la app.**
69. *Aviso masivo.* → **Segmentado por sede, plan o clase. Excluye a los dados de baja y respeta a quien no quiere mensajes. Tope de envíos para no quedar como spam en WhatsApp.**
70. *Recordatorio de vencimiento.* → **Automático, con link de pago. El cron solo avisa: nunca decide quién entra.**

### Seguridad y legal
71. ⭐ *Ley 25.326.* → **La base se inscribe en la AAIP. Acceso a los datos en 10 días corridos, corrección o borrado en 5 hábiles. Borrar significa anonimizar: las facturas se conservan.**
72. *Cámaras.* → **Cartel AAIP, registro de la base y manual de tratamiento (Disposición 10/2015).**
73. *Deslinde y reglamento.* → **Aceptación con versión, fecha e IP. Si el reglamento cambia, se vuelve a aceptar en la próxima entrada.**
74. *Menores.* → **Firma del adulto responsable y consentimiento para aparecer en fotos.**
75. *Empleado que se lleva la base de socios.* → **Exportar requiere un permiso y queda registrado.**
76. *Fotos de socios en redes.* → **Consentimiento revocable por socio.**
77. *Denuncia en Defensa del Consumidor.* → **Historial del socio en PDF: pagos, avisos, bajas y aceptaciones.**

### Crecimiento
78. *Picos de enero y marzo.* → **Alta exprés desde el celular con pago incluido.**
79. *Verano.* → **Congelamiento de verano como producto y campaña "mantené tu precio".**
80. ⭐ *Reactivar ex socios.* → **Segmentos por motivo de baja y antigüedad, con oferta y seguimiento de quién volvió.**
81. *Referidos.* → **El premio se acredita cuando el referido paga su segundo mes.**
82. *Cupones.* → **Ya existen. Falta medir el costo del descuento contra la retención a 90 días.**
83. *Origen del socio.* → **Campo obligatorio en el alta y reporte de costo por socio según el origen.**

### Multisede
84. ⭐ *Socio que entra en otra sede.* → **Plan de sede propia o de todas las sedes, tope de visitas y el mismo semáforo en todas.**
85. *Precio distinto por sede.* → **Lista de precios por sede.**
86. *Caja por sede.* → **Caja por sede y por puesto, con consolidado para el dueño.**
87. ⭐ *Reportes consolidados.* → **Ingresos por sede donde se cobró y por sede donde se usó, para repartir al socio que entrena en las dos.**
88. *Traslado de sede.* → **Un único contrato que cambia de sede, nunca dos.** En un caso real de una cadena, un traslado mal hecho terminó en el cobro de cuatro membresías.
89. *Cierre de una sede.* → **Migración masiva de socios o devolución proporcional.**

---

## Lo que casi nadie piensa y después explota

1. **Pagos fuera de orden o perdidos.** Hace falta una guarda de orden y una conciliación nocturna contra Mercado Pago que solo corrija sola los pagos que faltan.
2. **Precio del contrato contra precio de lista.** Si no se guarda el precio de cada contrato, el aumento le cae a quien ya pagó, y eso termina en multa.
3. **Créditos sin usar.** Son deuda del gimnasio. Explota cuando cierra una sede o se vende el negocio.
4. **Dispositivos con usuario de persona.** El kiosco queda logueado con el usuario de la recepcionista que renunció. Cada dispositivo necesita su propia credencial.
5. **Caja 24 h que cruza la medianoche.** La venta pertenece al turno, no al reloj.
6. **El socio que cumple 18.** Cambia de categoría, precio y permisos solo.
7. **Datos de salud en texto libre.** "Operado de rodilla" escrito en una nota: hace falta aviso o filtro en todo campo libre.
8. **Borrar contra conservar.** Se anonimiza al socio, pero las facturas se guardan.
9. **Conflictos al sincronizar sin internet.** Dos entradas imposibles aparecen recién cuando vuelve la conexión.
10. **Venta del gimnasio.** Nuevo CUIT, otra cuenta de Mercado Pago y deudas de socios: ¿cómo se transfiere el gimnasio dentro del sistema?
11. **Cortesías sin motivo.** Es la fuga más silenciosa que hay.
12. **Vencimiento en un día cerrado.** Si no hay una regla en datos, cada recepcionista decide distinto.
13. **Titular familiar o corporativo que deja de pagar.** Cinco personas quedan afuera de golpe.
14. **Mensajes masivos a quien no corresponde.** Ex socios, menores o un bloqueo de WhatsApp por spam.
15. **Fichas duplicadas.** Rompen la deuda, la retención y los cobros.

---

**URLs**
- https://github.com/wger-project/wger
- https://github.com/AsteriaCreations/portico
- https://github.com/usamam46-git/Frappe-Gymstack
- https://github.com/johndavedecano/laragym
- https://github.com/civicrm/civicrm-core
- https://github.com/openjverein/jverein
- https://github.com/southlondonmakerspace/membership-system
- https://github.com/doubleunion/arooo
- https://github.com/mayerbalintdev/GYM-One
- https://gymdesk.com/blog/gym-failed-payment-recovery
- https://www.getkisi.com/blog/membership-sharing
- https://www.glofox.com/blog/fitness-class-cancellation-policy/
- https://www.clubautomation.com/blog/member-retention/managing-member-access-across-locations-with-club-software
- https://www.wbrz.com/news/gym-member-billed-for-four-memberships-unbeknown-to-her/
- https://abogados.com.ar/confirman-la-multa-impuesta-a-un-gimnasio-que-no-informo-el-incremento-de-las-cuotas-del-servicio-ofrecido/25970
- https://www.argentina.gob.ar/normativa/nacional/norma-310734/texto
- https://www.argentina.gob.ar/aaip/datospersonales/responsables/videovigilancia
