# Gym OS — Hoja de ruta, panel por panel

Este archivo manda sobre **en qué orden** se hace. **Qué** se hace (cada panel,
cada botón, cada regla) está en `docs/producto/`: leerlo antes de tocar algo. Lo leen Mateo, las
sesiones de Claude Code de día y el loop de la noche (`scripts/noche/noche.sh`).
`docs/PLAN.md` queda como historia de lo ya construido.

---

## Cómo se usa

**Estados de cada ítem de la COLA**

| Marca | Quiere decir |
|---|---|
| `[ ]` | Pendiente |
| `[~]` | Alguien lo está haciendo (el loop lo marca al empezar) |
| `[x]` | Hecho y verificado según la definición de TERMINADO de `CLAUDE.md`. Al lado, una línea: cómo se verificó |
| `[!]` | Trabado. Al lado, por qué y qué haría falta |

**Tipo de cada ítem**

| Tipo | Quién |
|---|---|
| 🟢 | El agente lo hace solo (de día o de noche) |
| 🟡 Dn | Depende de la decisión Dn. Se hace solo si Mateo marcó ✅ en la tabla de decisiones |
| 🔌 | Necesita una cuenta o servicio externo (MercadoPago, mail, WhatsApp, SMS, dominio). El agente deja todo listo hasta el punto de conectar, y la conexión la hace Mateo |

**Reglas para todos los ítems** (además de `CLAUDE.md`):

1. **Primero la base, después la pantalla.** Si cambia datos: migración nueva (0020 en adelante), con pruebas en `supabase/pruebas/`.
2. **Todo configurable por gimnasio.** Lo que un gimnasio podría querer distinto va en datos (configuración), con un valor por defecto sensato, nunca en código.
3. **Cada pantalla que se toca sale mejor de lo que estaba**: celular de 390 px sin desbordes, estado vacío que invita a actuar, `loading.tsx` con la forma real, botones grandes, un solo verde por pantalla, una línea que explica qué es.
4. **Probado ejecutando**: `npm run verificar` + `npm run e2e` + capturas de compu y celular de lo nuevo, mirándolas. Si el ítem agrega una pantalla o un flujo, suma su recorrido a `scripts/e2e/`.
5. **Nada se promete que no esté**: si algo queda a medias, el ítem queda `[!]`, nunca `[x]`.

---

## Decisiones

Lo que toca **permisos o plata** necesita el OK de Mateo. **El 03/11/2026 Mateo
autorizó todo**: van todas con ✅ y se hacen como dice la recomendación. Si
quiere cambiar una, borra el ✅ y escribe cómo la quiere (el loop la saltea
mientras no tenga ✅).

| # | Decisión | Lo que recomiendo | Mateo |
|---|---|---|---|
| D1 | ¿A quién puede dejar pasar la recepción? (hoy: a cualquiera, con motivo, incluso suspendidos) | Recepción deja pasar con motivo a vencidos o sin clases, con un tope por día que pone el dueño (por defecto 5). A suspendidos y dados de baja, solo encargado o dueño. Cada "dejar pasar" aparece en el resumen del dueño. | ✅ |
| D2 | ¿La recepción anota contactos de retención? (hoy no puede) | Sí: es la que habla con el socio. Ve la lista de retención sin la plata en riesgo. | ✅ |
| D3 | ¿El profe busca socios? (hoy no puede) | Sí, solo nombre, foto y semáforo. Sin plata ni teléfono. | ✅ |
| D4 | ¿Permisos configurables? | Roles fijos y además interruptores por gimnasio: la recepción ve lo cobrado del día · la recepción hace descuentos (con tope) · la recepción vende productos · el profe ve el teléfono del socio · el encargado ve el Resultado. Nada de permisos sueltos persona por persona. | ✅ |
| D5 | ¿Se puede fiar (deuda / cuenta corriente)? | Apagado por defecto. Si el gimnasio lo prende: tope en $ por socio, la puerta muestra amarillo "debe $X" y la deuda se cobra en Vender. | ✅ |
| D6 | Cambio de plan a mitad de mes | Sin plata automática: el plan nuevo arranca hoy y lo que quedaba del viejo se convierte en días a favor. Si el dueño quiere cobrar la diferencia, lo hace en Vender. | ✅ |
| D7 | Pausas (congelar) | Las da el dueño o el encargado (la recepción las pide). Motivos: viaje, trabajo, estudio u otro (nunca "lesión": no se guardan datos de salud). Máximo de días por año configurable (por defecto 30). | ✅ |
| D8 | Recargo por pagar tarde | Configurable y apagado por defecto: % o monto fijo después de N días vencido, siempre visible antes de cobrar. | ✅ |
| D9 | Apto físico | Guardar solo "presentó apto: sí/no, vence el …". Sin archivo ni contenido médico. ¿Lo querés o lo dejamos afuera? | ✅ |
| D10 | Socios menores de edad | Se cargan con un adulto responsable (nombre y celular). El menor no entra a la app; entra el responsable. | ✅ |
| D11 | Gimnasio que no le paga a BRIK | Aviso 7 días antes. Después, el panel queda en solo lectura (no vende ni edita), pero la puerta y la página siguen andando: ningún socio queda afuera por una deuda del gimnasio con BRIK. | ✅ |
| D12 | Avisos automáticos: ¿por dónde? | Primero una "bandeja de avisos" con el WhatsApp ya escrito (gratis, se manda a mano en 2 toques). Después, mail automático (🔌 Resend, gratis hasta 3.000 por mes). WhatsApp automático oficial al final (cobra por mensaje). | ✅ |
| D13 | Precio de Gym OS para los gimnasios | El precio es un dato que carga Mateo en el super admin (por plan de BRIK); el código no inventa ninguno. | ✅ |
| D14 | Convenios y descuentos automáticos | Un convenio (estudiante, empresa X, familiar) tiene un % o un monto; se asigna al socio y Vender lo aplica solo, mostrado como una línea aparte. Tiene vencimiento opcional. | ✅ |
| D15 | PIN de 4 dígitos para el equipo en la PC de recepción | Sí: la PC queda con la sesión del gimnasio y cada uno pone su PIN para que quede registrado quién cobró. El PIN no reemplaza la contraseña para entrar desde otra compu. | ✅ |
| D16 | Faltar a una clase reservada | Configurable: nada (por defecto), o descontar la clase del pack, o no dejar reservar por N días. Siempre avisado en la app al reservar. | ✅ |
| D17 | ¿Cómo se abre la Entrada? (05/11, `docs/v2/`) | Las tres formas juntas y adaptándose entre sí: se abre sola al tipear un número, botón (grande en Inicio, chico en el resto) y barra fija opcional. Configurable. | ✅ |
| D18 | Día fijo y alguien que se anota a mitad de mes | Paga proporcional hasta el día fijo y entra al ciclo (en Configuración también: mes entero o gratis hasta el día fijo). | ✅ |
| D19 | ¿Cuánto puede fiar la recepción? | Los tres modos, elegibles en Configuración: hasta N días sola y más con PIN del dueño · siempre con PIN · libre con registro. Siempre anotado con nombre y motivo. | ✅ |
| D20 | Cierre de caja | Por turno; una caja de un día anterior queda "cerrada sin contar" (se calcula, sin cron) y la revisa el dueño. | ✅ |
| D21 | Vender | Productos y stock. Cuotas y pases se cobran con "Cobrar" desde la Entrada, la ficha, Vencen y el alta. | ✅ |
| D22 | Prospectos | Pasa a Socios como "Interesados", con "darlo de alta". | ✅ |
| D23 | ¿Con qué entra el socio? | Google, mail y contraseña, código por mail y código por SMS/WhatsApp. | ✅ |
| D24 | Reingreso | Una visita dura 5 h (configurable): dentro de la ventana, volver a pasar es "ya entró" y no cuenta ni consume; anti-préstamo configurable. | ✅ |
| D25 | ¿Los cambios salen en producción durante la noche? (05/11) | Sí, por tanda: cuando una tanda entera da verde en GitHub (base y pantallas), el agente corre prevuelo y aplicar de sus migraciones y mergea a main. Mientras no exista `.claude/BASE_CON_DATOS_REALES`. | ✅ |
| D26 | Socio que se registra solo | Queda socio sin pagar con el plan que eligió; ve horarios y paga desde la app; entra cuando paga. El dueño lo puede apagar. | ✅ |
| D27 | Dudas, consultas y quejas de los socios | Mensajes dentro de la app con categoría y foto; llegan al panel con número de pendientes y se contestan ahí. | ✅ |
| D28 | ¿El socio cambia de plan o compra pases desde la app? | Sí: elige, ve lo que le queda a favor (D6) y paga online o por transferencia; aprobación del dueño opcional. | ✅ |

### Decisiones que tomó el agente

Las auditorías y los ítems van a encontrar preguntas nuevas. Sin nadie para
preguntar, el agente elige y lo anota acá para que Mateo lo revise a la mañana.
En permisos y plata elige siempre lo más prudente (nunca da más acceso del que
había, nunca cobra más de lo que el dueño ve antes de cobrar).

| Fecha | Ítem | Qué decidió | Por qué | Cómo se cambia |
|---|---|---|---|---|
| 2026-11-04 | AUD-1 | Con Caja apagada, Vender no ofrece efectivo (solo transferencia, débito y crédito). | El efectivo sin caja no queda en ningún arqueo: es plata que nadie controla. Lo prudente es no cobrarlo. | Prender Caja en Configuración. |
| 2026-11-04 | AUD-1 | No se pueden apagar las tres formas de cobro a la vez. | Sin ninguna, Vender queda vacío y el gimnasio no puede cobrar. | Migración nueva sobre `guardar_configuracion`. |
| 2026-11-04 | AUD-1 | El alias de transferencia se valida como en los bancos: 6 a 20 caracteres, letras, números, puntos o guiones. | Un alias mal escrito manda al socio a transferirle a otro. | Migración nueva sobre `guardar_configuracion`. |
| 2026-11-04 | AUD-1 | El nombre del gimnasio tiene hasta 60 letras. | Se muestra en la barra, el saludo y la página; más largo rompe el diseño. | Ídem. |
| 2026-11-04 | CFG-1 | La pestaña Mensajes no se armó todavía: queda para CFG-5, que es el ítem que la hace andar. Equipo es un link a su pantalla. | Una pestaña vacía promete algo que no existe. | Se suma con CFG-5. |
| 2026-11-04 | CFG-1 | Clases se prende y apaga desde Secciones; la pestaña Clases (con reserva o sin reserva, y sus plazos) solo aparece con clases prendidas. | "Un gimnasio sin clases no ve nada de clases", y el dueño necesita un lugar donde prenderlas. | Mover el interruptor. |
| 2026-11-04 | CFG-1 | La zona horaria se muestra pero no la cambia el dueño: se la pide a soporte. | Cambiarla corre el principio y fin de cada día (vencimientos, pases ya vendidos). | Una función de super admin. |
| 2026-11-04 | CFG-1 | Teléfonos: se aceptan como los escribe la gente ("11 1234-5678", "011…", "+54 9…") y se guardan +54… Diez números sin característica de país se toman como celular de Argentina (+549). | Es como los escribe un dueño argentino; el formato de la base no cambia. | `privado.telefono_normalizado`. |
| 2026-11-04 | CFG-2 | Logo, ícono y fotos los cambia solo el dueño, y se suben por el servidor (la base decide, el servidor sube con la clave de servicio). Se sacaron las políticas que dejaban al dueño y al encargado escribir directo en el bucket `marcas`. | Con escritura directa, un encargado podía pisar el logo con cualquier archivo. Es dar menos acceso, nunca más. | Migración nueva con una política de storage. |
| 2026-11-04 | CFG-2 | Límites: logo y fotos 2 MB, ícono 512 KB; logo PNG/JPG/SVG/WEBP, ícono PNG/SVG, fotos JPG/PNG/WEBP. El tipo se mira en los bytes del archivo, no en el nombre. Un SVG con scripts, eventos o links se rechaza (no se "limpia"). | Un SVG con código se ejecuta si alguien abre su link. 2 MB alcanza para una foto web. | `privado.reglas_imagen_marca` y `src/lib/imagenes.ts`. |
| 2026-11-04 | CFG-3 | El recargo o descuento por medio de pago no se hizo como un % aparte en Configuración: el precio por medio ya existe en cada plan (`precios_plan`, el que usa Vender) y su pantalla es PLA-5. Dos lugares para lo mismo darían dos precios distintos para el mismo cobro. | Plata: una sola fuente para el precio. | Si querés un % general (ej. crédito +10% en todo, también productos), es un ítem nuevo que toca `vender`. |
| 2026-11-04 | CFG-3 | La base hace cumplir los medios: `vender` rechaza un medio no aceptado, `informar_transferencia` rechaza si no se reciben transferencias, y no se puede dejar el efectivo como único medio con Caja apagada. | Si solo lo hiciera la pantalla, un pedido directo cobraría por un medio que el dueño apagó. | `guardar_configuracion` y los envoltorios públicos de `vender` e `informar_transferencia`. |
| 2026-11-04 | CFG-3 | Mercado Pago aparece en la lista, apagado y sin poder prenderse, con la explicación. | Lo pide el ítem (🔌 apagado hasta conectar), y así el dueño sabe que va a estar. | Se prende con el ítem de Mercado Pago. |
| 2026-11-04 | CFG-4 | Los horarios los cambia el dueño; los cierres los carga y anula también el encargado (como ya permitía la base desde 0006). Recepción ve los horarios, no los cierres del panel. | Un feriado lo carga quien está en el día a día; el horario es una decisión del dueño. No se dio acceso nuevo. | `guardar_horarios_apertura` / `crear_cierre`. |
| 2026-11-04 | CFG-4 | Horarios y próximos cierres son públicos (`agenda_publica`, sin sesión, por la dirección del gimnasio, como la página). | Los publica el gimnasio para que la gente sepa cuándo ir; no hay datos de socios ni de plata. | Sacar el grant a anon. |
| 2026-11-04 | CFG-4 | Un cierre dura hasta 3 meses, no se superpone con otro, y desde la pantalla solo se cargan desde hoy (la base acepta pasados, que devuelven días hacia atrás). | Un cierre cargado tarde devuelve días a todos: es plata; mejor que no sea un clic al pasar. | Quitar el `min` del campo. |
| 2026-11-04 | CFG-5 | Los mensajes los edita el dueño y también el encargado (las plantillas ya eran de los dos desde 0010). Recepción no los ve. | Es el que más contacta socios; no se dio acceso nuevo. | `guardar_mensaje`. |
| 2026-11-04 | CFG-5 | Mensajes: los 5 de retención + bienvenida, cumpleaños y comprobante rechazado. "Comprobante" se tomó como el rechazado (el aprobado no necesita mensaje: la app ya muestra que puede entrar). Los tres nuevos dicen en pantalla que todavía no los manda ninguna pantalla. | Quedan listos para la bandeja de avisos (AVI-1) sin prometer algo que hoy no pasa. | Catálogo en `privado.mensajes_catalogo`. |
| 2026-11-04 | CFG-5 | Una variable que ese mensaje no tiene (ej. {dias} en cumpleaños) es un error al guardar, no un hueco en blanco. | Un mensaje con "{cosa}" o un espacio vacío le llega así al socio. | `privado.validar_mensaje`. |
| 2026-11-04 | ONB-1 | Para que el paso "Publicar tu página" no sea un callejón sin salida, sumé el botón Publicar / Pasar a borrador en Configuración → Página (solo el dueño). Copiar el link, mandarlo por WhatsApp y la vista al compartir ya estaban. Lo que queda de PAG-2 es poco. | Una página nueva quedaba en "Estamos armando nuestra página" para siempre: solo se publicaba desde la base. | `publicar_pagina`. |
| 2026-11-04 | ONB-1 | Los pasos son 8: datos y dirección, logo, planes con precio, horarios (y grilla si da clases), cómo le pagan, equipo, socios, página publicada. "Equipo" cuenta hecho con una persona más que el dueño; si trabaja solo, puede ocultar la tarjeta. Importar socios desde Excel no existe todavía: el paso lleva al alta. | Cada uno sale de un dato real; nada se marca a mano. | `privado.primeros_pasos`. |
| 2026-11-04 | CFG-6 | Formas de entrada: hoy solo existe la recepción, así que se muestra prendida y bloqueada (es el respaldo); QR del socio, tablet en la puerta y llavero aparecen apagados como "todavía no disponible". Cada ítem ENT que los construya prende su interruptor. El punto del LISTO SI "una forma apagada no aparece en Entrada ni en la app" queda para esos ítems: hoy no hay ninguna otra forma que esconder. | No se muestra un interruptor que no hace nada. | Interruptores en Configuración → Reglas. |
| 2026-11-04 | CFG-7 | Con la sección Transferencias apagada, la app ya no pide comprobantes y la base no los acepta; el mostrador sigue cobrando por transferencia. | Nadie podía aprobarlos: el socio pagaba y quedaba sin acreditar. Es restringir, nunca dar más. | Prender Transferencias. |
| 2026-11-04 | CFG-7 | Apagar una sección no se prohíbe nunca: se arreglan las pantallas que llevaban a ella (un nombre queda sin link, un botón desaparece). | Lo pide el ítem; cada gimnasio decide qué usa. | `LinkPanel` / `rutaDisponible`. |
| 2026-11-04 | CFG-8 | El historial lo escriben triggers en las tablas de configuración (configuración, nombre, página, sedes, mensajes), no `guardar_configuracion`. | Así queda todo cambio, venga de la pantalla, de soporte o de otra función; y una guardada que no cambia nada no deja fila. | Escribirlo desde cada función de guardado. |
| 2026-11-04 | CFG-8 | El historial va en su propia pestaña "🕓 Cambios" (la última de Configuración), no al pie de cada pestaña. | Con diez pestañas, "al pie" quedaba en una sola o repetido en todas. | Mostrar los últimos cambios de cada pestaña al pie de esa pestaña. |
| 2026-11-04 | CFG-8 | El historial no se puede borrar ni editar desde ningún panel, ni por el dueño; la pantalla muestra los últimos 100 y el super admin los últimos 20. | Es un registro: si el dueño lo pudiera borrar no serviría para "¿quién subió el descuento?". | Dejar que el dueño lo limpie. |
| 2026-11-04 | CFG-8 | Lo que cambió sin una persona (el armado del demo, migraciones) aparece como "El sistema"; alguien que ya no está en el equipo, como tal. | No inventar un autor. | — |
| 2026-11-04 | PAG-1 | La página la edita el dueño; el encargado la ve sin poder cambiarla (igual que el resto de la configuración). | Lo más prudente; la tabla permitía escribir al encargado pero ninguna pantalla lo usaba. | Que el encargado también edite. |
| 2026-11-04 | PAG-1 | La foto de portada se elige entre las fotos del gimnasio (no hay una subida aparte); si esa foto se quita, la portada queda sin foto. | Un solo lugar para subir fotos y nunca un link roto. | Subida propia de la portada. |
| 2026-11-04 | PAG-3 | Prospectos los ven y mueven dueño, encargado y recepción (como dice 03-ROLES); el profe no. Nadie escribe la tabla directo: todo por funciones. Un visitante sin sesión solo puede dejar su pedido. | Lo que pide la especificación, sin dar más. | — |
| 2026-11-04 | PAG-3 | Contra el spam: el mismo celular no se duplica (actualiza su pedido), hasta 30 pedidos por hora por gimnasio desde la página y un campo escondido para robots. No hay captcha. | Suficiente para un gimnasio; un captcha espanta a la gente. | Captcha. |
| 2026-11-04 | PAG-3 | "Se hizo socio" no se marca a mano: solo al darlo de alta desde "Hacerlo socio" (queda atado a su ficha). | Que el número de conversiones sea verdad. | Marcarlo a mano. |
| 2026-11-04 | PAG-3 | Prospectos no se apaga por separado: con "Probá una clase" oculta en la página, igual sirve para anotar a los que preguntan en el mostrador. | Es la herramienta de recepción para los que preguntan. | Sumarla a Secciones. |
| 2026-11-04 | REG-1 | Las altas online arrancan apagadas y no se prenden sin reglamento; las prende solo el dueño. | Es la puerta de entrada de gente y plata: la decide el dueño. | Prendidas por defecto. |
| 2026-11-04 | REG-1 | El que se anota online queda socio con el plan asignado y sin cobertura: la Entrada dice "Todavía no pagó…" hasta que la recepción cobra o aprueba el comprobante. Ningún pago se crea en el alta. | Nadie entra gratis por anotarse; la plata entra por donde siempre (Vender, Transferencias). | Darle días de cortesía. |
| 2026-11-04 | REG-1 | Si el DNI o el celular ya son de un socio, no se toca nada y se le dice "Ya sos socio, entrá con tu celular". | No duplicar ni pisar datos de alguien desde una página pública. | Actualizar sus datos. |
| 2026-11-04 | REG-1 | Menores de 18 no se anotan online: "el alta la hace un adulto responsable en el gimnasio" (D10 pide datos del responsable). | Lo más prudente con menores. | Pedir los datos del adulto en el formulario. |
| 2026-11-04 | REG-1 | Un pase o un pack elegido online no se asigna (no son suscripciones): queda anotado como socio y la nota dice qué quiere comprar. | Se compran como siempre, en Vender. | — |
| 2026-11-04 | REG-1 | El aviso al gimnasio es la fila en Prospectos → "Se hicieron socios" con cómo va a pagar (hasta que exista la bandeja de avisos, AVI-1). | Ya existe y la ven recepción, encargado y dueño. | — |
| 2026-11-04 | AUD-3 | "Volver a darlo de alta" lo hacen dueño, encargado y recepción (los mismos que dan de baja); la baja queda guardada en `historial_bajas` y vuelve sin plan: no recupera días de la suscripción vieja. | Volver no da días gratis; la plata entra como siempre. Si había pagado de más, se arregla al cobrar. | Reabrir la suscripción vieja. |
| 2026-11-04 | AUD-3 | El teléfono se normaliza en la base para todo el sistema (entiende el 15 del celular, el 0 de la característica, 0054, +54 9). | Un solo lugar; la pantalla armaba números mal. | — |
| 2026-11-04 | SOC-1 | Importan dueño y encargado (recepción no). Lo que tiene error no entra (se informa por fila); el resto entra junto. "Vence el" es una cobertura de origen importación desde hoy hasta ese día; sin fecha, queda con el plan y sin pagar. | Nadie entra gratis por un archivo mal cargado: lo que entra es lo que dice la planilla del dueño. | Rechazar todo el archivo si una fila tiene error. |
| 2026-11-04 | SOC-1 | Deshacer borra la importación entera (socios, planes y coberturas) dentro de 24 h y solo si esos socios no tienen movimientos; es la única forma en que se borra un hecho, y solo desde esa función. | Que un archivo mal mapeado se pueda volver a importar bien sin dejar fantasmas. | Anularlos y dejarlos dados de baja. |
| 2026-11-04 | SOC-3 | Notas y etiquetas: las ponen dueño, encargado y recepción; una nota la borra quien la escribió o el dueño/encargado (queda borrada, no se pierde de la base). Una etiqueta que nadie tiene desaparece sola. | Es el trabajo de todos los días del mostrador. | — |
| 2026-11-04 | SOC-7 | La foto del socio la sacan dueño, encargado y recepción; la ven también los profes (para reconocerlo en clase). Bucket privado: el panel la sirve solo a quien la base dice que es del equipo. | Es para la puerta; nunca pública. | Bucket público con ruta difícil de adivinar. |
| 2026-11-04 | SOC-8 | Unir fichas lo hace solo el dueño (mueve pagos, cuotas y la cuenta de la app); el encargado ve los posibles duplicados. No se deshace; queda registrado en `uniones_socios`. Con DNI distinto, dos membresías activas, la misma clase o dos cuentas de app, no se une y dice qué resolver. | Mueve plata: lo más prudente. | Que el encargado también una. |
| 2026-11-04 | COM | Lo que tiene la competencia entra como bloque 19, después de la segunda pasada; lo que toca plata (liquidación de profes) queda 🟡 y lo que necesita cuentas (ARCA, Wellhub) 🔌. Afuera a propósito: biometría, composición corporal, lesiones, planes de alimentación. | Lo pidió Mateo (mirar la competencia); las reglas de salud y plata siguen. | Mezclarlos en cada panel. |
| 2026-11-05 | SOC-9 | La recepción ya no congela: pide la pausa y la aprueba el dueño o el encargado (D7). El máximo de días es por socio y por año calendario; una pausa que cruza el año se cuenta en cada uno. Los motivos viejos (personal, económico) siguen valiendo para lo ya cargado. | Es lo que dice D7; es dar menos acceso, nunca más. | `public.congelar` / `privado.validar_pausa`. |
| 2026-11-05 | SOC-10 | Menor = menos de 18 años el día de hoy según la fecha de nacimiento (no se guarda). Sin fecha de nacimiento se toma como adulto. Un menor que ya estaba vinculado a su propia cuenta antes de 0043 sigue vinculado. | D10 pide responsable para menores; desvincular cuentas existentes toca permisos: no lo hice solo. | `privado.es_menor` / `vincular_socios_por_telefono`. |
| 2026-11-05 | SOC-11 | El apto físico no frena la entrada: es un aviso (en la ficha y en el veredicto). Lo carga y lo quita la recepción también. | D9 pide solo sí/no y vencimiento; frenar la entrada es una decisión del dueño que no estaba. | Que `calcular_acceso` lo mire (decisión tuya). |
| 2026-11-05 | ENT-2 | El QR vale la ventana actual y la anterior (como mucho un minuto), una sola vez, y si puede entrar se anota solo, sin tocar nada. | Hora pico sin tipear; una captura vieja no sirve. | `leer_qr` / `Puerta.tsx`. |
| 2026-11-05 | ENT-4 | El tope de "dejar pasar" es por persona y por día (no del gimnasio entero). Dueño y encargado no tienen tope. Tope 0 = la recepción no deja pasar. Si el socio igual puede entrar, no cuenta. | Cada uno responde por lo suyo; D1 dice "un tope por día". | `privado.puede_dejar_pasar`. |
| 2026-11-05 | ENT-3 | La tablet la autoriza solo el dueño (el encargado ve la lista). En la tablet se muestra solo el nombre de pila y el porqué, sin montos ni datos; nadie deja pasar desde ahí. 30 intentos por minuto por tablet. El token vive en una cookie httpOnly por 400 días. | Es una pantalla pública en la puerta: lo mínimo. | `kiosco_entrar` / `autorizar_tablet`. |
| 2026-11-05 | ENT-6 | El QR de la tablet lo firma un secreto de esa tablet (sale del hash de su token); vale un minuto como mucho. Si el socio puede entrar, entra; si no, la app y la tablet le dicen por qué. Nadie deja pasar desde ahí. | Un QR fotografiado de lejos sirve un minuto, no para siempre. | `entrar_por_qr_pared`. |
| 2026-11-05 | ENT-7 | El llavero lo asigna cualquiera del mostrador desde la ficha; es único por gimnasio y se guarda en mayúsculas sin guiones. En la recepción, un código sin espacios se prueba primero como llavero; si no es de nadie, es una búsqueda común. | El lector escribe el código igual que una persona: así anda con cualquier lector USB. | `asignar_llavero` / `leer_llavero`. |
| 2026-11-05 | INV-1 | Invita solo un socio que puede entrar hoy. El límite (2 por mes por defecto) es por socio que invita y también por DNI invitado. Un DNI de socio no puede ser invitado. El invitado no cuenta como entrada del socio ni se cobra. | Que nadie entrene gratis rotando de anfitrión; "nunca anónimo". | `privado.validar_invitado`. |
| 2026-11-05 | AUD-5 | Editar un plan cambia solo lo que se manda; el tipo y la duración no se editan (cambiarían lo ya vendido: para eso, un plan nuevo). | "Dejar de vender" borraba las veces por semana y el horario: el plan quedaba libre en la puerta. | — |
| 2026-11-05 | PLA-5 | Los precios especiales (por medio o por pagar antes de un día del mes) solo pueden ser más baratos que el general, y el día va del 1 al 28. Se edita la lista entera: un precio nuevo arma una lista nueva y lo que no está deja de regir. La deuda y la página muestran el general. | Cobrar ya usa el menor que aplica (0005): uno más caro nunca se usaría y confundiría. Con la lista entera, subir el general no borra sin avisar el de efectivo. | Recargo por medio (ej. crédito +10%) sería otra regla. |
| 2026-11-05 | PLA-4 | El aumento aplica el mismo % o monto al general y a los precios especiales; redondeo a $1, 10, 50, 100, 500 o 1.000; más de 200% se rechaza. El aviso a los socios es un texto para copiar a WhatsApp hasta que exista la bandeja (AVI-1). | Lo que se ve en la vista previa es lo que se guarda (misma cuenta en la base). | — |
| 2026-11-05 | PLA-2 | Horario y veces por semana solo en membresías; las clases incluidas (ninguna tildada = todas) en cualquier plan y solo si el gimnasio usa clases. | La puerta ya los calculaba (0006); faltaba dónde cargarlos. | — |
| 2026-11-05 | PLA-3 | Matrícula solo en membresías: única o una vez por año. Se cobra en el mostrador (Vender la suma con la cuota); el pago por transferencia desde la app todavía cobra solo la cuota. Una venta anulada la vuelve a deber. | Lo debido sale de lo cobrado, no de una marca. | Sumarla en la app cuando se toque el pago desde la app (PAY-1). |
| 2026-11-05 | PLA-6 | Cambiar de plan pasa los días pagos 1 a 1 al plan nuevo, aunque cueste distinto; la ficha muestra la diferencia por mes y deja ir a Vender. | D6: sin plata automática. | Prorratear en plata. |
| 2026-11-05 | PLA-7 | Recargo: el atraso cuenta desde el primer día sin cubrir; con "más de N días" (N de 1 a 60), % de la cuota (hasta 50%) o monto fijo; quien nunca pagó no tiene atraso. La base lo exige junto con la cuota: no cobrarlo es un descuento con motivo, con el tope de la recepción. El pago por transferencia desde la app todavía no lo suma. | D8: siempre visible antes de cobrar, y que la recepción no lo saque sin dejar rastro. | Que la recepción pueda sacarlo libre. |
| 2026-11-05 | VEN-6 | Anulan el dueño y el encargado (desde la ficha, desde Vender recién cobrado o desde el pedido en Inicio). La recepción pide solo ventas que cobró ella hoy. Si había efectivo de una caja ya cerrada, la devolución sale como retiro de la caja abierta de esa sede (si no hay ninguna abierta, no deja anular y lo dice). | Anular toca plata; el arqueo de una caja contada no se reabre. | — |
| 2026-11-05 | VEN-4 | El stock se calcula (entradas + conteos − ventas no anuladas), no se guarda. Cada producto elige si lleva stock; al prenderlo se cuenta lo que hay. Vender muestra cuántos quedan y avisa, pero no frena una venta. Cargan mercadería y cuentan el dueño y el encargado; la recepción lo ve. | Una venta frenada por un número mal contado es peor que un stock negativo, que avisa que hay que contar. | Frenar la venta sin stock. |
| 2026-11-05 | VEN-3 | El convenio se aplica solo a la cuota (no a pases, packs ni productos), por cuota, y nunca más que su precio. Lo crean, asignan y quitan el dueño y el encargado; la recepción lo ve. Un socio tiene uno a la vez; asignar otro reemplaza al anterior. Se guarda como descuento de la cuota con motivo "Convenio X" y no cuenta para el tope de la recepción. | D14: lo aplica Vender solo; que la recepción no pueda inventar descuentos y el dueño vea por qué se cobró menos. | Aplicarlo también a pases y packs. |
| 2026-11-05 | VEN-5 | "A cuenta" es un medio de pago más en Vender: solo con socio, hasta el tope (deuda anterior + lo nuevo) y nunca para pagar deuda. La deuda sale de los pagos a cuenta menos los pagos de deuda (ventas no anuladas); no se guarda. La puerta deja entrar al que debe y lo pone en amarillo con "Debe $X a cuenta" (también si después se apaga el fiado). "Cobrado hoy" no suma lo fiado: la plata entra cuando paga la deuda. | D5. Si lo fiado contara como cobrado, el pago de la deuda se contaría dos veces. | Que deber deje afuera. |
| 2026-11-05 | CAJ-4 | Las alertas no se guardan: se calculan de los últimos 7 días (cajas cerradas con diferencia, retiros, ventas anuladas, descuentos mayores al tope de la recepción sin contar convenios) y no se muestran las que hizo quien mira. Las ven el dueño y el encargado en Inicio, hasta que existan la campana (AVI-5) y las notificaciones (PUSH-1). La diferencia avisa desde $1 (no hay margen configurable). El ticket del retiro es opcional; lo sube quien anotó el retiro y no se cambia. | Que "nada que importe dependa de un cron" y que el dueño no reciba avisos de lo que hizo él. | Un margen de diferencia en Configuración. |
| 2026-11-05 | CAJ-5 | "Olvidada" = abierta desde otro día, o hoy después de la última hora de cierre de esa sede (sin horarios cargados, solo el cambio de día). Nadie puede tener dos cajas abiertas a la vez (olvidada o no). El aviso lo ven en Inicio quien la abrió, el dueño y el encargado. | Sin cron: se calcula al mirar o al abrir. | Cerrarla sola (no: alguien tiene que contar la plata). |
| 2026-11-05 | CAJ-3 | El PIN nunca da más permisos: con PIN puesto, solo se puede lo que pueden a la vez la sesión de la compu y quien puso el PIN, y queda anotado quien lo puso. Vale 12 horas en esa compu (cookie solo-servidor con un token firmado por la base). Un token vencido no se manda; uno adulterado o de otro gimnasio da error (nunca se anota a otro en silencio). PIN de 4 números, distinto entre los del equipo, sin los obvios (1234, 0000…); 5 equivocados en 10 minutos bloquean esa sesión. El hash vive en `privado` (nadie lo lee). Se cambia en Mi cuenta, sin PIN puesto. | D15, sin abrir una puerta: 4 números se adivinan, así que no pueden subir permisos. | Que el PIN del dueño habilite cosas de dueño en la compu de la recepción (pediría algo más fuerte que 4 números). |
| 2026-11-05 | AVI-1 | La bandeja junta: vence en los próximos días (lo de Retención), venció hace 1 a 3 días, no viene (la lista de Retención), cumple años y comprobante rechazado en los últimos 3 días. “Avisado ✓” se guarda con a qué se refiere (el vencimiento, el último día que vino, el año del cumpleaños, el pago): ese aviso no vuelve, uno nuevo del mismo socio sí. Tocar WhatsApp ya lo marca. La ven dueño, encargado y recepción. | Se calcula al abrirla (sin cron) con las mismas cuentas de Retención y Cumpleaños. | Avisar por push o mail sin que nadie toque (PUSH-1). |
| 2026-11-05 | VEH-1 | "Avisar a todos" va de a uno: cada toque abre un WhatsApp (el navegador no deja abrir varios de una) y lo marca avisado en la bandeja; se puede saltear o terminar. Está en Vencen hoy y en cada grupo de la bandeja. Tocar WhatsApp en una fila de Vencen hoy también marca (la recepción incluida). | El avisado es el mismo que el de la bandeja: nunca dos registros distintos de "ya le escribí". | — |
| 2026-11-05 | AVI-5 | La campana no guarda avisos: los calcula de los hechos (comprobantes para revisar, cajas abiertas, alertas de caja, pedidos de anular y de pausa, dejados pasar, stock para reponer; a la recepción, lo que pidió anular ya resuelto; al profe, sus clases canceladas; al socio, si hoy no está al día, sus comprobantes y sus clases). Solo se guarda qué vio cada usuario. Lo que lleva a una pantalla apagada o que el rol no ve no aparece. El número se pide después de pintar la pantalla. | Sin cron y sin una tabla que se desincronice de los hechos. | Que el aviso llegue sin abrir la app (PUSH-1). |
| 2026-11-05 | AVI-6 | El resumen es de un día o de una semana (lunes a domingo), siempre comparado con el período anterior del mismo largo. Cobrado = pagos aprobados en ese período por medio y por quien cobró (los de la app: quien aprobó; sin nadie, "Online"); lo fiado aparte. Llega a la campana del dueño y del encargado: el del día desde las 22 h (antes, el de ayer) y el de la semana pasada desde el lunes. Mail cuando esté conectado (fuera de esta tanda). | Se calcula al abrirlo, sin cron, con las mismas tablas que Caja e Inicio. | Mandarlo por mail o push a una hora fija (PUSH-1 y mail). |
| 2026-11-05 | PUSH-1 | Push para: comprobante informado (dueño, encargado, recepción de esa sede), pago aprobado o rechazado (el socio), caja con diferencia y retiros (dueño y encargado, menos quien lo hizo), pedido de anular (dueño y encargado), clase cancelada (los socios anotados). Cada dispositivo elige dentro de lo de su rol; por defecto, todo. El texto y a quién lo decide la base; cada hecho se manda una vez. Se manda después de responder (la acción no espera). El profe todavía no tiene avisos. En iPhone, solo con la app agregada a inicio (se explica en pantalla); por eso hay manifest con la marca. | Sin costo ni servicio externo (claves VAPID propias en Vercel). Si no llega, todo está en la campana. | Push de "no viene hace 10 días" o "vence mañana" al socio: necesita un envío programado (cron), y nada importante puede depender de uno. |
| 2026-11-05 | RES-1 | Cobrado = pagos aprobados en el mes, sin lo fiado (igual que Inicio y el Resumen). Un mes en curso se compara con los mismos días del anterior. "De dónde" sale de lo vendido (ventas no anuladas), por plan, productos, matrícula, recargos o deuda: puede no coincidir con lo cobrado (transferencias pendientes, fiado). Recurrente = precio de hoy de cada membresía al día, dividido por su duración en meses. Horas pico: entradas que pasaron, de 6 a 23 h. | Todo de la base, con las mismas reglas que el resto. | Gráficos con una librería: con barras simples alcanza y no suma peso. |
| 2026-11-05 | RES-3 | Gastos en cuatro categorías (alquiler, sueldos, servicios, otros), por mes, con detalle opcional. Los ve y los carga solo el dueño (hay sueldos): el encargado ve el Resultado sin gastos ni ganancia. Ganancia = cobrado del mes (sin fiado) menos gastos. Quitar un gasto lo deja anulado. "Repetir los del mes pasado" copia todos si el mes está vacío. | Simple: alcanza para saber si el mes dio, sin hacer contabilidad. | Gastos con comprobante, proveedores o cuotas: es otro producto. |
| 2026-11-05 | PAY-1 | Hasta que exista el OAuth (MP-1), el dueño pega el Access Token y la clave del webhook de su aplicación de MercadoPago en Configuración → Cobros; van a Vault y no se vuelven a mostrar. Modo prueba o producción. El socio paga la cuota de su plan al precio del medio "mercadopago" (si no tiene uno propio, el general); al día, la puede adelantar. Un pago pendiente de la última hora se reusa. El aviso viene a `/api/webhooks/mercadopago?g=<gimnasio>`, se verifica la firma con la clave del gimnasio, y estado y monto se leen de la API de MercadoPago con su token (no del aviso). Se acredita solo si el monto coincide al centavo. Rechazado o devuelto: el pago queda rechazado con el motivo. Los medios del mostrador no cambian. | El webhook manda (CLAUDE.md), idempotente por ID externo. | Débito automático (MP-3) y alta online con pago (sigue en la app después del alta). |
| 2026-11-05 | CLA-1 | Falta = reserva confirmada de una clase que terminó sin presente (y sin cancelar); se calcula. Opciones hoy: no pasa nada (por defecto) o el socio no puede reservar por N días (1 a 60) desde el día de la clase; cuenta desde que se prende la regla; la recepción, el encargado y el dueño lo pueden anotar igual. La app muestra las reglas (cancelar hasta y faltas) y el motivo si está bloqueado. Las faltas se ven en la ficha (Asistencia). "Descontar del pack" quedó como CLA-9: pide cambiar cómo se cuentan los packs. | Calculado y prudente: nadie queda bloqueado por algo de antes de la regla. | Descontar del pack ahora (CLA-9). |
| 2026-11-05 | CLA-2 | Los turnos fijos se prenden por gimnasio (Configuración → Clases, solo con reserva). Los toma el socio desde la app o el mostrador desde la ficha. Tope: el cupo del horario. Sin cron: al mirar las clases de un día se reserva a los abonados que pueden tomar la clase (dentro de la ventana de reserva) y se libera el lugar de los que ya no pueden (sube la espera). Si una semana el socio cancela, esa semana no se vuelve a reservar. Quitar el turno cancela las próximas que había reservado solo. | Nada depende de un cron; el lugar del que no paga no queda tomado. | Avisarle al socio que se liberó su lugar fijo (va por la campana cuando sume ese aviso). |
| 2026-11-05 | CLA-3 | La recepción ve "Cancelar esta clase" (la base ya la dejaba). Los anotados aparecen primero en Avisos de hoy durante 2 días, con el mensaje nuevo "Clase cancelada" (editable, variables {clase} {dia} {motivo}); además les llega por la campana y el push. Los packs no se tocan: reservar no gasta clase. La vista previa de los mensajes usa ejemplos para las variables que no son del socio. | Lo urgente primero, con el mensaje listo. | — |
| 2026-11-05 | CLA-8 | Editar un horario respeta "un horario no se edita" (0011): se crea uno nuevo y se cierra el viejo, llevando las clases futuras. Las que ya tienen reservas conservan su hora (nadie pierde su lugar) y toman cupo y profe; si cambió la hora, el nuevo arranca después de la última reservada (no hay dos clases el mismo día). El cupo no baja de lo ya reservado (se dice qué clase lo impide); si sube, entra la espera. Un horario que arranca hoy no se edita: se saca y se agrega. Actividades: nombre, emoji y apagarla. | Nadie pierde su reserva por un cambio de grilla. | Pasar a espera a los que sobran si baja el cupo (hoy se impide). |
| 2026-11-05 | CLA-8 (0094, 0097) | Corrige la fila anterior: un horario que arranca hoy o más adelante sí se edita y se saca entero (0097: un horario puede quedar vacío, sin ninguna clase). Las clases de los días en que el viejo sigue vigente se quedan en él con su hora (antes se movían y al mirar el día aparecía otra). | Corregir un horario recién cargado es el caso más común. | — |
| 2026-11-05 | CLA-9 | La falta se descuenta del pack que respaldaba la reserva (cada reserva con pack ya guarda cuál). Se calcula, no se guarda: si se apaga la regla, esas faltas dejan de contar. No es falta si ese día entró por la puerta. | Lo mismo en todos lados y sin cron; nadie paga dos veces. | Mostrar en la ficha "se descontó del pack" al lado de cada falta. |
| 2026-11-05 | ADM-1 | Los planes de ejemplo de cada plantilla van sin precio: el dueño los pone antes de vender (no se inventan precios). La plantilla se aplica solo a un gimnasio sin planes. | No arrancar con precios que nadie eligió. | Precios sugeridos por zona, si BRIK quiere cargarlos. |
| 2026-11-05 | ADM-2/ADM-3 | El abono se calcula de los pagos que registra BRIK (hasta qué día cubren). Al asignar un plan hay 14 días hasta el primer pago. Vencido: solo lectura hecha cumplir en la base con un trigger que frena solo al equipo del gimnasio (el socio, la página y la puerta siguen; el admin de BRIK puede igual). | D11 y D13, sin trabar a nadie por error. | Cobrar el abono con MercadoPago (MP-3, 🔌). |
| 2026-11-05 | RET-3 | Los motivos de baja quedan con la lista fija que ya tenía la base (precio, horario, se mudó, otro gimnasio, sin tiempo, no le gustó, otro): hacerla editable por gimnasio cambiaría una restricción de la tabla de socios y cómo se agrupan en el Resultado. La pausa se ofrece si tiene plan y el motivo no es "se mudó" ni "otro gimnasio"; el botón lleva a Pausas de la ficha. Los motivos del mes se ven en el Resultado. | Lo prudente sin tocar datos existentes. | Lista de motivos editable por gimnasio. |
| 2026-11-05 | REV-1a | "Le prometieron pagar": dueño y encargado ven a todos los que dejaron pasar ayer u hoy y siguen sin poder entrar; la recepción, solo los que dejó pasar ella. Sale solo cuando la puerta lo deja pasar. | Calculado de las entradas forzadas y de la misma función de la puerta; la recepción no ve nada que no viera. | Guardar "prometió pagar" como estado. |
| 2026-11-05 | COM-7 | Los habituales en la tablet vienen apagados; prendidos, tocar el nombre pide los últimos 3 números del DNI (y cuenta para el freno de 30 intentos por minuto). | Sin eso, cualquiera entraría tocando un nombre ajeno: la tablet no tiene a nadie mirando. Nombre e inicial del apellido, nada más. | Entrar solo con tocar el nombre. |
| 2026-11-05 | COM-8 | Un evento es un producto con stock = cupo (más su fecha, para quién y descripción): se vende en Vender sin tocar el cobro y los anotados son sus ventas no anuladas. El nombre del producto lleva la fecha. | Cero cambios en `vender` (plata). Cancelar o terminar lo saca de Vender; lo vendido queda. | Un tipo de ítem nuevo en Vender. |
| 2026-11-05 | COM-9 | El cupón no toca `vender`: Vender carga el descuento en cada línea que corresponde (cuotas, pases y packs de sus planes; nunca productos) con motivo "Cupón X", y al cobrar registra el uso (la base exige que la venta tenga ese descuento). El tope de la recepción sigue valiendo. Monto fijo: una vez por venta. | Cero cambios en el cobro; el uso se cuenta de ventas no anuladas. | Que el cupón saltee el tope de la recepción (es darle más permiso). |
| 2026-11-05 | COM-12 | El lugar se elige en un paso aparte después de reservar (no se tocó `reservar`); lo garantiza un índice único sobre las reservas confirmadas. En espera no se elige. La recepción también puede asignarlo; el profe solo mira. | Reservar sigue igual; el índice frena a dos que tocan a la vez. | Pasar el lugar dentro de `reservar` (una sola llamada). |
| 2026-11-05 | COM-13 | Grados: el profe puede otorgarlos (toma el examen); anular, solo dueño o encargado; la recepción solo mira. "Listos para rendir" se calcula con asistencias y meses desde el grado actual, o desde la primera clase si no tiene. | Es la persona que evalúa; anular deshace un hecho y queda para los que gestionan. | Migración nueva sobre `otorgar_grado`. |
| 2026-11-05 | COM-14 | La TV muestra los nombres con la inicial del apellido y usa su propio token (otra tabla que la tablet): solo sirve para mirar, no da entrada. "La de ahora" incluye la que empieza en 15 minutos. | Una pantalla en la sala la ve cualquiera; un token de TV filtrado no tiene que abrir la puerta. | Migración nueva sobre `privado.clase_tv`. |
| 2026-11-05 | SEG-5 | Sin internet solo se anota a los que la copia dice que pueden (no hay "dejar pasar"); al volver, la base registra cada entrada con la función de siempre en la hora en que pasó y, si no podía, queda rechazada y se muestra. La copia se prende por compu (tiene nombres y DNI) y vale hasta la medianoche. | La puerta nunca decide en el navegador; nadie entra gratis en silencio; el tope de la recepción no se puede controlar sin internet. | Permitir "dejar pasar" sin internet (con el tope chequeado al volver). |

---

## Pensar como dueño: tipos de gimnasio

Cada gimnasio prende lo que usa. Al crear uno, el super admin elige el tipo
(ítem ADM-1) y queda prendido lo que corresponde, con planes de ejemplo editables.

| Tipo | Cómo es | Lo que más necesita |
|---|---|---|
| 🏋️ Musculación de barrio | Dueño solo o con una recepción. Cuota mensual en efectivo o transferencia, sin clases o con pocas, horario largo | Entrada rápida, Vencen hoy, cobranza por WhatsApp, caja simple, todo desde el celular |
| 🏢 Gimnasio grande o cadena | Varias sedes, recepción por turnos, muchos planes, convenios con empresas, molinete | Multi-sede, QR/molinete, permisos, Resultado por sede, auditoría |
| 🔥 Box de crossfit o funcional | Clases con cupo y reserva, mensual libre o packs, WOD del día, comunidad | Reservas y espera, WOD, marcas personales, clase de prueba |
| 🧘 Yoga o pilates | Packs de 4/8/12 clases, cupos de 6 a 10, máquinas (reformer), cancelación estricta | Packs con vencimiento, políticas de cancelación, turnos fijos |
| 🥋 Artes marciales o escuela deportiva | Cuota por disciplina, muchos chicos, matrícula anual, grados | Actividades separadas, grupo familiar, menores con responsable, matrícula |
| 🏊 Natación | Turnos fijos por día y hora, temporada | Turnos fijos con cupo, apto (D9) |
| 💪 Entrenador personal o estudio chico | Sesiones 1 a 1 | Packs de sesiones, agenda por profe |
| 🌙 24 horas o sin recepción | Entra solo, paga solo | Kiosco o QR en la puerta, débito automático (🔌 MercadoPago) |

## Pensar como dueño: situaciones de todos los días

| Situación | Qué la resuelve |
|---|---|
| "Se olvidó de pagar y viene igual" | Semáforo con el porqué + cobrar en la puerta (hecho) · ENT-1 |
| "Pagó en efectivo y nadie lo anotó" | Caja con arqueo ciego (hecho) · EQU-3 auditoría · D15 PIN |
| "Me transfirió a las 11 de la noche" | Comprobante desde la app (hecho) · TRF en la bandeja del día |
| "Se va de viaje un mes" | SOC-9 pausa (D7) |
| "Viene con la hermana / el hijo" | SOC-5 grupo familiar · D14 descuento familiar · D10 menores |
| "La empresa paga la cuota de sus empleados" | D14 convenios |
| "Quiere probar una clase" | PAG-3 prospectos + CLA-6 clase de prueba |
| "Aumento por inflación" | PLA-4 aumento masivo programado con aviso |
| "El profe faltó" | CLA-3 cancelar con aviso a los anotados |
| "Cerramos por feriado" | CFG-4 cierres y horarios (compensa días, ya existe en la base) |
| "Quiere su recibo" | VEN-1 comprobante por WhatsApp |
| "Se cambió de plan" | D6 |
| "No viene hace dos semanas" | Retención (hecho) · AVI-1 bandeja de avisos |
| "Cumple años" | AVI-1 · SOC-6 |
| "Perdió el celular" | Buscar por DNI (hecho) · ENT-2 QR que se regenera |
| "Se quiere dar de baja" | Baja con motivo (hecho) · RET-3 ofrecer pausa antes de la baja |
| "Me debe dos meses" | Vencidos (hecho) · D5 deuda · D8 recargo |
| "El contador me pide los números" | RES-1 Resultado + RES-2 exportar |
| "Tengo 400 socios en un Excel" | SOC-1 importador |
| "Mi recepcionista de la tarde y la de la mañana" | Caja por turno (hecho) · CAJ-1 historial · D15 PIN |
| "¿Cuándo se llena el gimnasio?" | RES-1 horas pico · CLA-5 ocupación |
| "Se cortó internet" | SEG-5 (después) |

---

## COLA — el orden en que se hace

Panel por panel. Cada panel arranca con su **auditoría botón por botón (AUD)**,
que puede sumar ítems nuevos al final de su propio bloque. El loop toma el
primer `[ ]` que pueda hacer (🟢, o 🟡 con ✅).

### 0 · Base
- [x] DIS-0 · 🟢 · Sistema visual común: botones, tarjetas, campos, pestañas, avisos, estados vacíos (`docs/DISENO.md`) — verificado: e2e:dis-0 (14 pasos, compu y celu), barrido 120 pasos, verificar en verde
- [x] AUD-0 · 🟢 · Mapa de pantallas, funciones y conexiones (`docs/paneles/README.md`) — verificado: npm run mapa contra la base local (31 rutas, 65 funciones usadas, 0 faltantes), verificar en verde

### 1 · Configuración y primeros pasos
- [x] AUD-1 · 🟢 · Auditoría botón por botón: Configuración — verificado: e2e:configuracion (27 pasos, dueña/encargado, compu y celu), db:pruebas 172 en verde con la 0020, npm run e2e completo y verificar en verde
- [x] CFG-1 · 🟢 · Configuración en pestañas, todo explicado — verificado: e2e:configuracion (40 pasos: 8 pestañas, dueña/encargado, compu y celu), db:pruebas 175 con la 0021, npm run e2e completo y verificar en verde
- [x] CFG-2 · 🟢 · Subir logo, favicon y fotos desde el panel — verificado: e2e:cfg-2 (24 pasos con archivos de verdad: PNG, SVG, JPG, rechazos, orden, página pública, app del socio), db:pruebas 180 con la 0022, npm run e2e completo y verificar en verde
- [x] CFG-3 · 🟢 · Medios de pago y datos de transferencia — verificado: e2e:cfg-3 (13 pasos: Vender y app del socio con los medios prendidos), db:pruebas 184 con la 0023 (la base rechaza medios no aceptados), npm run e2e completo y verificar en verde
- [x] CFG-4 · 🟢 · Horarios del gimnasio, feriados y cierres — verificado: e2e:cfg-4 (18 pasos: un feriado cancela las 6 clases del día, se ve en la app y la página, anularlo las devuelve), db:pruebas 188 con la 0024, npm run e2e completo y verificar en verde
- [x] CFG-5 · 🟢 · Mensajes editables con vista previa — verificado: e2e:cfg-5 (16 pasos: el cambio se ve en los links de Retención y Vencen hoy, volver al original), db:pruebas 193 con la 0025, npm run e2e completo y verificar en verde
- [x] ONB-1 · 🟢 · "Primeros pasos" del dueño en Inicio — verificado: e2e:onb-1 (12 pasos: subir el logo marca su paso, publicar la página, ocultar/mostrar), db:pruebas 196 con la 0026, npm run e2e completo y verificar en verde
- [x] CFG-6 · 🟢 · Lo que la base ya guarda y Configuración no muestra: formas de entrada, reingreso el mismo día, días de retención — verificado: e2e:cfg-6 (9 pasos: reingreso, 1 día mueve 47 vencidos a “se fue”, formas de entrada), db:pruebas 198, npm run e2e completo y verificar en verde
- [x] CFG-7 · 🟢 · Apagar una sección avisa qué deja de andar en las otras — verificado: e2e:cfg-7 (18 pasos: cada sección apagada, 14 pantallas sin links a ella, app sin comprobantes), db:pruebas 200 con la 0027, npm run e2e completo y verificar en verde
- [x] CFG-8 · 🟢 · Historial de cambios de configuración (quién, qué, cuándo) — verificado: e2e:cfg-8 (11 pasos: cambio con quién y cuándo, guardar sin cambio real no suma filas, encargado, super admin, celular), db:pruebas con la 0028, npm run e2e completo (cfg-8 cortó una vez esperando que el modo desarrollo compile el super admin: subí la espera; solo pasa en verde) y verificar en verde
- [x] CFG-9 · 🟢 · Aviso de contraste al elegir colores — verificado: pruebas unitarias de contraste()/seLeePoco() (vitest), e2e:cfg-9 (6 pasos: amarillo sobre crema y gris sobre grafito avisan, violeta oscuro y verde no, con aviso se guarda igual, celular)

### 2 · Página del gimnasio
- [x] AUD-2 · 🟢 · Auditoría botón por botón: Página del gimnasio — verificado: e2e:pagina (16 pasos: cada link de la página publicada en compu y celular, borrador → próximamente con WhatsApp → publicar, gimnasio nuevo), inventario en docs/paneles/pagina.md, migración 0029 aplicada local
- [x] PAG-1 · 🟢 · Editor de la página del gimnasio con vista previa — verificado: db (editor-pagina, 4 pruebas: guardar, errores con dónde, foto de portada, permisos; landing sigue en verde), e2e:pag-1 (17 pasos: vista previa en vivo, ocultar, ordenar, agregar pregunta, error, foto, página pública, encargado, celular)
- [x] PAG-2 · 🟢 · Publicar / despublicar la página, y compartirla — verificado: e2e:pag-2 (10 pasos: estado, copiar link, WhatsApp con el link, og:title/description/image + /og se abre, borrador → próximamente → publicar, encargado comparte sin publicar, celular)
- [x] PAG-3 · 🟢 · "Quiero probar": prospectos desde la página — verificado: db (prospectos, 4 pruebas: sin sesión solo publicada y visible, sin duplicar, tope 30/h, permisos y "socio" solo al dar de alta), e2e:pag-3 (16 pasos, el de punta a punta de PAG-1 a 3: editar → publicar → visitante en celular → Prospectos → escribirle → vino → Hacerlo socio → ficha)
- [x] REG-1 · 🟢 · "Hacete socio": alta online desde la página, con reglamento y forma de pago (`docs/producto/05-ALTA-Y-PAGOS.md`) — verificado: db (alta-online, 4 pruebas: apagado por defecto y sin reglamento no prende, alta sin cobertura con reglamento aceptado, sin duplicar DNI ni celular, menores al gimnasio, transferencia solo si el gimnasio la recibe, versiones, anon no lee), e2e:reg-1 (13 pasos: transferencia y mostrador desde la página, Entrada no lo deja pasar sin pagar con su motivo, Prospectos, apagar); MercadoPago queda para MP-1/MP-2 (🔌)
- [x] DIS-13 · 🟢 · Pulido: Página del gimnasio — verificado: capturas antes/después (dis13-*), botones ≥ 52 px medidos, un solo verde por pantalla, loading con la forma real en Hacete socio, Tu página y Prospectos, foco visible al elegir con teclado; barrido en verde
- [x] PAG-4 · 🟢 · Aparecer en Google: datos estructurados del gimnasio, sitemap y robots — verificado: vitest (datos-estructurados, 2), e2e:pag-4 (9 pasos: JSON-LD coincide con dirección y horarios, robots y sitemap por dirección, panel noindex, sin publicar noindex y robots que dice que no)

### 3 · Socios
- [x] AUD-3 · 🟢 · Auditoría botón por botón: Socios (lista, alta, edición, ficha) — verificado: e2e:socios (16 pasos), db (volver-a-dar-de-alta, paneles con teléfonos nuevos), inventario en docs/paneles/socios.md, migración 0033 aplicada local
- [x] SOC-1 · 🟢 · Importar socios desde Excel o CSV — verificado: db (importar-socios, 4 pruebas: errores por fila, vence como cobertura, deshacer y no con movimientos, 3.000 filas en 8,9 s), vitest (importar: CSV y columnas), e2e:soc-1 (12 pasos: CSV con errores, importar, deshacer, Excel, recepción sin permiso)
- [x] SOC-2 · 🟢 · Ficha del socio en pestañas (resumen, pagos, asistencia, notas) — verificado: db (asistencia-socio: días en hora local, sin rechazos, profe no), e2e:soc-2 (8 pasos: cada pestaña, calendario = veces, mes anterior, recepción sin Pagos, celular)
- [x] SOC-3 · 🟢 · Notas y etiquetas, con filtros — verificado: db (notas-etiquetas: autor, quién borra, etiquetas sin repetir, filtro, profe no), e2e:soc-3 (6 pasos: etiqueta en dos socios, nota con autor y hora, filtro en Socios y Retención, la dueña borra, la etiqueta desaparece)
- [x] SOC-4 · 🟢 · Exportar la lista de socios — verificado: vitest (csv: punto y coma, BOM, comillas, sin fórmulas), e2e:soc-4 (5 pasos: CSV con el mismo filtro, recepción sin botón y con “Sin permiso” en la dirección directa)
- [x] SOC-6 · 🟢 · Cumpleaños — verificado: db (cumpleanos: momento fijo, 29/2 el 28/2 en años no bisiestos, bajas no, mensaje), e2e:soc-6 (3 pasos: Inicio con “Saludar” armado, edad, el profe no); la bandeja de avisos la suma AVI-1
- [x] SOC-7 · 🟢 · Foto del socio desde la cámara — verificado: db (foto-socio: ruta de la base, otra ruta no, el profe la ve, un ajeno no), e2e:soc-7 (6 pasos con la cámara de prueba de Chrome: ficha 480×480, bucket privado, Entrada, sin sesión no, cambiar borra la anterior, quitar)
- [x] SOC-8 · 🟢 · Encontrar y unir socios duplicados — verificado: db (unir-socios: encuentra por celular, mueve entradas, cuota (queda verde), notas y etiquetas sin repetir, registro; frena membresías dobles y DNI distinto; solo dueño; los hechos siguen fijos), e2e:soc-8 (7 pasos)
- [x] SOC-5 · 🟢 · Grupo familiar
- [x] SOC-9 · 🟡 D7 · Pausas desde la ficha
- [x] SOC-10 · 🟡 D10 · Menores con adulto responsable
- [x] SOC-11 · 🟡 D9 · Apto físico (solo sí/no y vencimiento)
- [x] SOC-12 · 🟢 · Filtros de la lista de socios por estado y plan
- [x] SOC-13 · 🟢 · Alta en un paso: datos, plan y "Guardar y cobrar"
- [x] SOC-14 · 🟢 · La ficha dice cómo llegó y qué reglamento aceptó
- [x] SOC-15 · 🟢 · Los avisos por WhatsApp de un menor van al responsable
- [x] DIS-3 · 🟢 · Pulido: Socios

### 4 · Entrada
- [x] AUD-4 · 🟢 · Auditoría botón por botón: Entrada
- [x] ENT-1 · 🟢 · Veredicto en pantalla completa, sonido y teclado
- [x] ENT-2 · 🟢 · QR del socio y lector con cámara en la recepción
- [x] ENT-4 · 🟡 D1 · Reglas de "dejar pasar"
- [x] ENT-3 · 🟢 · Tablet en la puerta (modo kiosco)
- [x] ENT-6 · 🟢 · Kiosco con QR en pantalla: el socio lo escanea con su app (A4)
- [x] ENT-7 · 🟢 · Llavero o tarjeta con lector USB (A5)
- [x] INV-1 · 🟢 · Invitados y pases de cortesía con DNI y límite
- [x] ENT-8 · 🟢 · Control de "dejar pasar": a quién, quién y por qué, por día y semana
- [x] ENT-9 · 🟢 · Cobrar desde la Entrada con la cuota ya en el carrito
- [x] DIS-2 · 🟢 · Pulido: Entrada

### 5 · Planes y precios
- [x] AUD-5 · 🟢 · Auditoría botón por botón: Planes y productos
- [x] PLA-5 · 🟢 · Precio por medio de pago y por día, desde la pantalla
- [x] PLA-4 · 🟢 · Aumento de precios masivo y programado
- [x] PLA-1 · 🟢 · Planes trimestral, semestral y anual
- [x] PLA-2 · 🟢 · Planes por horario y por días por semana
- [x] PLA-3 · 🟢 · Matrícula / inscripción
- [x] PLA-6 · 🟡 D6 · Cambio de plan con días a favor
- [x] PLA-7 · 🟡 D8 · Recargo por pagar tarde
- [x] DIS-10 · 🟢 · Pulido: Planes y productos

### 6 · Vender, Caja y Transferencias
- [x] AUD-6 · 🟢 · Auditoría botón por botón: Vender, Caja y Transferencias
- [x] VEN-1 · 🟢 · Comprobante de pago por WhatsApp
- [x] VEN-4 · 🟢 · Productos con stock
- [x] VEN-3 · 🟡 D14 · Convenios y descuentos automáticos
- [x] VEN-5 · 🟡 D5 · Deuda / cuenta corriente
- [x] VEN-6 · 🟢 · Anular una venta desde la caja y la ficha (encargado y dueño, con motivo; la recepción la pide)
- [x] CAJ-1 · 🟢 · Historial de turnos de caja
- [x] CAJ-2 · 🟢 · Cierre de caja para compartir
- [x] CAJ-4 · 🟢 · Alertas de caja al dueño: diferencia, retiro, anulación, descuento grande (con foto del ticket en retiros)
- [x] CAJ-5 · 🟢 · Caja olvidada abierta: aviso y cierre obligatorio antes de abrir otra
- [x] CAJ-3 · 🟡 D15 · PIN del equipo en la recepción
- [x] DIS-4 · 🟢 · Pulido: Vender
- [x] DIS-5 · 🟢 · Pulido: Caja
- [x] DIS-6 · 🟢 · Pulido: Transferencias

### 7 · Vencen hoy y avisos
- [x] AUD-7 · 🟢 · Auditoría botón por botón: Vencen hoy — verificado: e2e:vencen (Cobrar abre Vender con la cuota; la recepción no anota; celular sin desborde); inventario en docs/paneles/vencen-hoy.md
- [x] AVI-1 · 🟢 · Bandeja de avisos del día (WhatsApp ya escrito) — verificado: db (bandeja-avisos: momento de cada lista, avisado no vuelve, uno nuevo sí, permisos), e2e:avi-1 (marcar ✓, al volver “Avisado por Ana”, celular)
- [x] VEH-1 · 🟢 · Cobranza en tanda desde Vencen hoy — verificado: e2e:veh-1 (uno tras otro: abre su WhatsApp, pasa al siguiente, queda “Avisado por Martín”)
- [x] AVI-5 · 🟢 · Campana de avisos en la app del socio y en el panel — verificado: db (campana: cada rol lo suyo, visto por usuario, el socio sus comprobantes, nadie lee la de otro), e2e:avi-5 (🔔 con el número, lista, visto al volver, profe sin plata, socio)
- [x] AVI-6 · 🟢 · Resumen diario y semanal del dueño en la app — verificado: db (resumen-dueno: por medio y por persona, fiado aparte, período anterior, permisos, en la campana), e2e:avi-6 (Inicio → resumen, semana pasada, aviso en la campana, celular, recepción no)
- [x] PUSH-1 · 🟢 · Notificaciones push (web push con claves propias, sin costo) — verificado: db (push: cada uno elige dentro de lo suyo, a quién va cada hecho, una sola vez, solo la clave de servicio ve destinos), vitest (push.test: el navegador descifra el mensaje y la firma VAPID es la nuestra), e2e:push-1 (dónde activarlas, profe no, sw y manifest). Sin verificar: la entrega real en un navegador (el servicio de push no es alcanzable desde acá)
- [x] DIS-7 · 🟢 · Pulido: Vencen hoy — verificado: e2e:dis-7 (recepción y dueña en celular: Vencen hoy, Avisos, Novedades, Resumen sin desborde, botones altos, un verde), capturas dis7-*

### 8 · Resultado (la plata)
- [x] RES-1 · 🟢 · Resultado: la plata del mes, clara — verificado: db (resultado: cobrado sin fiado, por medio, por concepto, por día, contra el anterior, permisos), e2e:res-1 (menú → Resultado, mes anterior, celular, recepción no)
- [x] RES-2 · 🟢 · Exportar para el contador — verificado: db (resultado: ventas y pagos fila por fila, la recepción no), e2e:res-2 (baja los tres CSV, la recepción recibe 403 con el motivo)
- [x] RES-3 · 🟢 · Gastos y ganancia — verificado: db (gastos: cargar, ganancia, quitar = anulado, repetir el mes pasado, el encargado no), e2e:res-3 (agrega $1.234,50 y la ganancia baja lo mismo, quitar, encargado sin gastos)

### 8b · Pagos online
- [x] PAY-1 · 🟢 · Pagos online listos para MercadoPago: proveedor por gimnasio, "Pagar ahora" en la app y en el alta, webhook firmado e idempotente, probado con eventos simulados firmados (`docs/producto/05-ALTA-Y-PAGOS.md`) — verificado: db (pagos-online: conectar solo el dueño y en Vault, el socio inicia y se reusa, acredita con monto exacto una vez, evento repetido reconocido, solo la clave de servicio acredita), e2e:pay-1 con el simulador de MercadoPago (conecta, paga, vuelve “¡Pago acreditado!”, aviso repetido no acredita dos veces, firma inválida 401). Sin verificar: contra MercadoPago real (MP-1)

### 9 · Clases
- [x] AUD-9 · 🟢 · Auditoría botón por botón: Clases (día, lista, grilla, actividades) — verificado: e2e:clases (días, presente desde la búsqueda, grilla: actividad, horario y sacar con confirmación en pantalla, profe sin grilla, celular); inventario en docs/paneles/clases.md
- [x] CLA-1 · 🟡 D16 · Políticas de reserva y faltas — verificado: db (faltas-clases: apagada nada, lo de antes no cuenta, bloquea N días, la recepción anota igual, con presente no es falta), e2e:cla-1 (configurar, la app avisa y frena, la ficha lo muestra). "Descontar del pack" quedó como CLA-9
- [x] CLA-2 · 🟢 · Turnos fijos (abono a un horario) — verificado: db (turnos-fijos: apagados no, abonarse reserva, cancelar una semana se respeta, al que no puede no se le reserva, tope = cupo, quitar), e2e:cla-2 (prender, el socio lo elige y lo quita, la ficha lo muestra)
- [x] CLA-3 · 🟢 · Cancelar una clase avisando a los anotados — verificado: db (bandeja-avisos: el anotado con el mensaje armado, primero, avisado ✓; mensajes: 11), e2e:cla-3 (la recepción cancela, Avisos de hoy y la campana del socio)
- [x] CLA-4 · 🟢 · WOD / rutina del día en la clase — verificado: db (wod: el profe en su clase, no en otra, la recepción no, vacío lo borra, lo ve el anotado), e2e:cla-4
- [x] CLA-5 · 🟢 · Ocupación por horario — verificado: db (ocupacion: promedio de los que vinieron contra el cupo, canceladas no cuentan, la recepción no), e2e:clases (la sección en la grilla)
- [!] CLA-6 · 🟢 · Clase de prueba para prospectos — trabado: hoy toda reserva es de un socio y la clase de prueba da entrada sin pagar (toca "¿puede entrar?"). Decidí: ¿se lo da de alta como socio sin plan con una clase gratis, o se anota el prospecto sin ser socio? ¿y la puerta lo deja pasar ese día?
- [x] CLA-7 · 🟢 · Anular un presente marcado por error — verificado: db (anular-presente: con motivo, el profe solo en sus clases, dos veces no, la recepción dentro del día), e2e:clases (deshacer con motivo)
- [x] CLA-8 · 🟢 · Editar actividades y horarios sin sacarlos (de AUD-9) — verificado: db (editar-horario: cupo y profe a las clases futuras, la reservada conserva la hora, sin duplicados, el cupo no baja de lo reservado), e2e:clases (editar hora y cupo)
- [x] CLA-9 · 🟢 · Faltas: descontar la clase del pack (tercera opción de D16) — verificado: db (faltas-pack: puerta, reserva, ficha; presente, entró ese día y regla en "nada" no cuentan; presente tarde), e2e:cla-9 (pendiente de la tanda final)
- [x] DIS-9 · 🟢 · Pulido: Clases — verificado: e2e:dis-9 (día, clase y grilla en el celular: sin desborde, botones altos, un verde), capturas dis9-*

### 10 · Retención
- [x] AUD-10 · 🟢 · Auditoría botón por botón: Retención — verificado: e2e:retencion (plata en riesgo, listas, WhatsApp, Dice que vuelve, Cobrar, vacía, celular, recepción no); inventario en docs/paneles/retencion.md
- [x] RET-1 · 🟢 · Tablero de retención (bajas del mes, tendencia) — verificado: db (tablero-retencion: 12 semanas, la última igual a los al día de hoy, altas, recepción no), e2e:retencion
- [x] RET-2 · 🟡 D2 · La recepción anota contactos — verificado: db (retencion: la recepción ve las listas sin monto ni plata en riesgo y anota), vitest (secciones), e2e:retencion y e2e:vencen
- [x] RET-3 · 🟢 · Antes de la baja, ofrecer pausa y preguntar el motivo — verificado: db (motivos de baja del mes), e2e:socios (con plan, “¿le ofreciste una pausa?” antes de confirmar)
- [x] DIS-8 · 🟢 · Pulido: Retención — verificado: e2e:dis-8 (tres listas, dueña y recepción en el celular: sin desborde, botones altos, un verde), capturas dis8-*

### 11 · App del socio
- [x] AUD-11 · 🟢 · Auditoría botón por botón: App del socio — verificado: e2e:app (pendiente de la tanda final); inventario en docs/paneles/app.md
- [x] APP-1 · 🟢 · App del socio instalable (con el ícono y los colores del gimnasio) — verificado: e2e:push-1 (manifest con la marca y service worker), e2e:app-1 (la invitación a instalar). Sin verificar: instalar en un celular real
- [x] APP-3 · 🟢 · Historial de pagos y asistencia en la app — verificado: db (historial-socio: pagos y entradas, lo nuevo primero, otro socio no), e2e:app-3
- [x] APP-6 · 🟢 · Novedades del gimnasio en la app — verificado: db (novedades-gimnasio: publicar, la app la ve, quitar, recepción no publica, máximo 3, otro no), e2e:app-6 (pendiente de la tanda final). Sin foto todavía
- [x] APP-7 · 🟢 · Racha y entradas del mes — verificado: db (racha: semanas seguidas, la actual no corta, rechazados no cuentan), e2e:app-7
- [x] APP-8 · 🟢 · Pedir pausa o baja desde la app — verificado: db (pedidos-socio), e2e:app-8 (pendiente de la tanda final)
- [x] APP-9 · 🟢 · Entrar con mail y código, o con contraseña (P1) — verificado: db (entrar-con-mail: vincula por mail verificado, menores no, ya vinculado lo dice, solo el servidor), e2e:app-9 (pendiente de la tanda final). Falta la plantilla del mail en Supabase
- [x] REF-1 · 🟢 · Invitá a un amigo (pase de prueba con link) — verificado: db (referidos: código fijo, el pedido entra como referido, uno ajeno no cuenta, sin página no hay link, otro socio no), e2e:ref-1 (pendiente de la tanda final). Sin pase ni premio: REF-2
- [ ] REF-2 · 🟡 · Pase de prueba y premio del referido (días gratis al que recomendó) — tocan quién entra y plata: decide Mateo (junto con CLA-6)
- [x] DIS-12 · 🟢 · Pulido: App del socio — verificado: e2e:dis-12 (pendiente de la tanda final: 5 pantallas en el celular, un verde)

### 12 · Equipo y cuentas
- [x] AUD-12 · 🟢 · Auditoría botón por botón: Equipo y Mi cuenta — verificado: e2e:equipo (pendiente de la tanda final); inventario en docs/paneles/equipo.md
- [x] EQU-1 · 🟡 D4 · Interruptores de permisos por gimnasio — verificado: db (permisos-equipo: por defecto como antes, solo el dueño, cada interruptor cambia lo que deja la base), e2e:equ-1 (pendiente de la tanda final)
- [x] EQU-2 · 🟡 D3 · El profe busca socios — verificado: db (profe-busca-socios: solo nombre, foto y semáforo genérico, sin bajas, de afuera no), e2e:equ-2 (pendiente de la tanda final)
- [x] EQU-3 · 🟢 · Qué hizo cada uno (auditoría) — verificado: db (actividad-equipo: ventas, descuentos, anulaciones, dejados pasar, caja con diferencia; recepción no; encargado según el permiso), e2e:equ-3 (pendiente de la tanda final)
- [x] DIS-11 · 🟢 · Pulido: Equipo y Mi cuenta — verificado: e2e:dis-11 (pendiente de la tanda final)

### 13 · Rutinas
- [x] RUT-1 · 🟢 · Ejercicios y rutinas del gimnasio — verificado: db (rutinas: el profe carga, nombre único, video https, la recepción no, guardar reemplaza, archivar), vitest (secciones), e2e:rut-1 (pendiente de la tanda final)
- [x] RUT-2 · 🟢 · Asignar rutina; el socio la ve y anota sus pesos — verificado: db (rutina-socio: asignar, ver con lo último, anotar con límites, anular, otro socio no, reemplazar y quitar), e2e:rut-2 (pendiente de la tanda final)
- [x] RUT-3 · 🟢 · Marcas personales y progreso — verificado: db (rutina-socio: la marca es el mayor peso, el progreso, el profe lo ve, otro socio no), e2e:rut-2 (pendiente de la tanda final)

### 14 · Inicio (al final: junta todo lo anterior)
- [x] AUD-14 · 🟢 · Auditoría botón por botón: Inicio de cada rol — verificado: e2e:inicio (pendiente de la tanda final), db (pedidos-socio: bajas pendientes); inventario en docs/paneles/inicio.md
- [x] DIS-1 · 🟢 · Pulido: Inicio — verificado: e2e:dis-1 (pendiente de la tanda final); sin cambios de código

### 15 · Super admin y plataforma
- [x] AUD-15 · 🟢 · Auditoría botón por botón: Super admin, Ingresar y Elegir gimnasio — verificado: e2e:acceso y e2e:admin (pendiente de la tanda final); inventario en docs/paneles/acceso.md
- [x] ADM-1 · 🟢 · Plantillas por tipo de gimnasio al crear — verificado: db (plantillas-gimnasio: box completo, las 8, una sola vez, solo el admin), e2e:adm-1 (pendiente de la tanda final). Planes sin precio
- [x] ADM-4 · 🟢 · Salud de cada gimnasio en el super admin — verificado: db (último acceso, ventas, solo el admin), e2e:adm-1 (pendiente de la tanda final)
- [!] ADM-5 · 🟢 · Demo para vender: link "Probá Gym OS" y reiniciar el demo — trabado: "solo lectura" pide un rol nuevo que la base respete en cada escritura (toca permisos), y "reiniciar" pide borrar hechos que hoy son inmutables (pagos, entradas) o un gimnasio demo nuevo por visita. Decidí: ¿demo compartido que se puede tocar y se rehace de noche desde Actions, o uno nuevo por visitante?
- [x] ADM-6 · 🟢 · Novedades de Gym OS para todos los dueños — verificado: db (publicar, el dueño la ve hasta cerrarla, retirar, recepción no, solo el admin publica), e2e:adm-6 (pendiente de la tanda final)
- [x] ADM-2 · 🟡 D11 · Suspensión gradual del gimnasio — verificado: db (abono-brik: vencido no vende ni edita, la puerta sigue, el admin sí, pagar destraba; db:pruebas completo con los triggers), e2e:adm-3 (pendiente de la tanda final)
- [x] ADM-3 · 🟡 D13 · Suscripción del gimnasio a BRIK — verificado: db (abono-brik: planes solo el admin, 14 días de gracia, por vencer, montos solo al dueño), e2e:adm-3 (pendiente de la tanda final)
- [x] DIS-15 · 🟢 · Pulido: Super admin — verificado: e2e:dis-15 (pendiente de la tanda final)
- [x] DIS-14 · 🟢 · Pulido: Ingresar, elegir gimnasio, no encontrado — verificado: e2e:dis-14 (pendiente de la tanda final)

### 16 · Cierre
- [x] SEG-1 · 🟢 · Límite de pedidos de código por celular — verificado: db (limite-codigos: 5 por destino, 20 por IP, hash, solo el servidor), e2e:seg-1 (pendiente de la tanda final)
- [x] SEG-2 · 🟢 · Exportar todos los datos del gimnasio — verificado: db (cada tabla, sin rutas internas, recepción no), e2e:seg-2 (pendiente de la tanda final)
- [x] SEG-4 · 🟢 · Rendimiento con 3.000 socios en todas las pantallas — medido (npm run medir): 13 índices (0114) bajaron lo lento de 5–16 s a 1–2,6 s; lo que queda arriba de 1 s pasa a SEG-8
- [x] SEG-6 · 🟢 · Datos personales: el socio descarga sus datos; baja con anonimización — verificado: db (mis_datos, anonimizar: solo ex socios, BORRAR, quedan pagos, solo el dueño), e2e:seg-6 (pendiente de la tanda final)
- [x] SEG-7 · 🟢 · Funciones viejas sin pantalla (cobrar_cuota, precio_cuota, caja_abierta, asignar_plan): confirmar que Vender las reemplazó y sacarles el acceso del equipo — verificado: db (cobro con Vender, la vieja sin permiso; pin-equipo). asignar_plan queda: tiene pantalla
- [x] SEG-8 · 🟢 · Calcular el estado de todos los socios juntos (retención, Vencen hoy, Inicio, Avisos, filtro "al día") para bajar de 1 s con 3.000 socios — toca el cálculo de acceso: con las pruebas de acceso al lado — verificado: db (355 en verde), retención idéntica fila por fila en el demo grande, npm run medir: todo por debajo de 1 s (Socios "al día" 2,6 s → 63 ms). Sin un segundo cálculo: índices + cortar temprano
- [x] AUD-16 · 🟢 · Recorrido completo como un cliente, de punta a punta — verificado: e2e:cliente 20 pasos en verde (BRIK crea el gimnasio → precio, alias, grilla, importar, publicar, recepción → caja → cobro → entrada verde → socio reserva → transferencia con comprobante → la dueña aprueba → Resultado $60.000 → otra sede con su caja → celular sin desborde)

### 17 · Segunda pasada (todo de nuevo, con ojos nuevos)
Cada una vuelve a abrir todo el panel con su rol, lo compara con `docs/producto/`
y con `10-DIA-A-DIA-Y-CASOS-RAROS.md` fila por fila, y suma lo que falte al
bloque 18.
- [x] REV-1 · 🟢 · Segunda pasada: un día entero como recepción (de abrir a cerrar caja) — verificado: e2e:rev-1 (12 pasos, en el orden del documento); lo que falta, en el bloque 18 (REV-1a…d)
- [x] REV-2 · 🟢 · Segunda pasada: una semana como dueño (celular) — verificado: e2e:rev-2 (contra la app local; la contraseña por WhatsApp corre en la tanda); lo que falta: REV-2a
- [x] REV-3 · 🟢 · Segunda pasada: un mes como socio (alta online → pagar → entrar → reservar → renovar) — verificado: e2e:rev-3 8 pasos en verde (el rechazo con su motivo en el historial, migración 0136), db (historial-socio)
- [x] REV-4 · 🟢 · Segunda pasada: un día como profe — verificado: e2e:rev-4 7 pasos en verde (faltan, anotados en el LOG: fotos en la lista de la clase y sumar a alguien desde la lista)
- [x] REV-5 · 🟢 · Segunda pasada: BRIK da de alta un gimnasio de cada tipo y lo deja andando — verificado: e2e:rev-5 (15 pasos: los 8 tipos; el dueño entra, ve sus planes y actividades, Clases según el tipo, pone el primer precio, celular sin desbordes)
- [x] REV-6 · 🟢 · Segunda pasada: intentar romperlo (permisos, doble clic, dos personas a la vez, sin internet, datos raros) — verificado: e2e:rev-6 7 pasos en verde (dos personas cobrando la misma cuota a la vez sigue en REV-6a, decide Mateo)

### 18 · Lo que encontró la segunda pasada
- [x] REV-1a · 🟢 · "Le prometió pagar": al que dejaron pasar con un motivo de pago ("paga a la tarde", "paga mañana"), recordárselo a la recepción esa tarde y al día siguiente (Vencen hoy / Avisos), calculado de las entradas forzadas, sin guardar estado — verificado: db (prometieron-pagar: hoy y ayer, sale solo al pagar, la recepción ve los suyos), e2e:rev-1 (en la tanda)
- [x] REV-1b · 🟢 · El WhatsApp al prospecto lleva el link de la página del gimnasio — hecho sin tocar la plantilla: el link va abajo del mensaje, solo si la página está publicada (verificado: e2e:rev-1, en la tanda)
- [ ] REV-1c · 🟡 · Pase de prueba gratis, una vez por DNI (lo pide el día a día de las 10:00) — da acceso sin pagar: decide Mateo si se hace y con qué tope
- [ ] REV-1d · 🟡 · Retiro de caja para el proveedor: sumar el stock en el mismo paso (la foto del ticket ya estaba, CAJ-4). La entrada de mercadería hoy la cargan solo el dueño y el encargado: ¿la recepción también, cuando paga al proveedor? — decide Mateo (es darle un permiso)
- [x] REV-2a · 🟢 · Sumar una sede desde Configuración (hoy solo se editan las que hay): con su caja (ya se crea sola), su entrada y su grilla — verificado: db (sumar-sede: caja sola, repetida y vacía avisan, encargado y recepción no), e2e:cliente (en la tanda)
- [ ] REV-6a · 🟡 · Dos personas cobran la cuota del mismo socio a la vez: hoy quedan las dos ventas (cubre dos meses). El día a día pide que la segunda vea "ya se cobró hace 10 s" — toca plata: decide Mateo cómo (frenar la segunda cuota del mismo período en unos segundos, o avisar y dejar)

### 19 · Lo que tiene la competencia y nos falta (pedido de Mateo, 04/11 · `docs/producto/12-COMPETENCIA.md`)
- [x] COM-1 · 🟢 · Riesgo de baja de cada socio, con el porqué y la acción al lado — verificado: db (riesgo-baja: dejó de venir y vence → alto, viene igual → nada, pidió la baja → alto, vencido → no, la ficha de uno, sin permiso → error); demo de 3.000: 289 en riesgo en 0,13 s; e2e:com-1 (en la tanda). "No abre la app" no entra: la app no registra cuándo se abre
- [x] COM-2 · 🟢 · Los primeros 30 días del socio nuevo: meta de visitas y aviso si la primera semana no vino — verificado: db (primer-mes: ficha, avisos de los días 1, 7 y 30, riesgo de la primera semana, meta 1 a 60; 360 pruebas en verde), e2e:com-2 (en la tanda)
- [x] COM-3 · 🟢 · Avisar a todos los anotados de una clase — verificado: db (avisar-clase: un mensaje por persona con nombre, clase y día; queda anotado; el profe solo en las suyas y sin teléfonos si no tiene permiso; vacío no), e2e:com-3 (en la tanda). Mail: cuando exista AVI-2
- [x] COM-4 · 🟢 · Tareas del equipo ("llamar a Juan el jueves") con las de hoy en Inicio — verificado: db (tareas: cada uno las suyas, dueño todas, otra persona no la toca, reabrir), vitest (menú), e2e:com-4 (en la tanda)
- [x] COM-5 · 🟢 · Retención en números: bajas del mes, cuántos siguen a los 90 días, socios con pocas visitas — verificado: db (retencion-numeros: altas, bajas con motivo, cohorte de hace 3 meses, pocas visitas, la recepción no), 0,1 s con 3.000 socios, e2e:com-5 (en la tanda). "Pocas visitas" mira los últimos 30 días (el mes calendario daría todos "pocos" a principio de mes)
- [x] COM-6 · 🟢 · Documentos para firmar (reglamento, deslinde, autorización de menores) con aviso en la entrada — verificado: db (documentos: versiones, firma en la app y en recepción, el de menores solo a menores, la versión vieja no se firma, la recepción no publica), e2e:com-6 (en la tanda). Que bloquee la entrada: COM-6b
- [ ] COM-6b · 🟡 · Que "falta firmar" frene la entrada si el gimnasio lo elige — cambia quién entra (el cálculo de acceso): decide Mateo
- [x] COM-7 · 🟢 · Kiosco: los habituales de esta hora para tocar su nombre — verificado: db (kiosco-habituales: apagado por defecto, nombre con inicial, DNI equivocado no entra, el que ya entró no aparece), e2e:com-7 (en la tanda). Tocar el nombre pide los últimos 3 del DNI
- [x] COM-8 · 🟢 · Eventos y workshops sueltos con cupo, precio y pago — verificado: db (eventos: crear, vender como producto, anotados y lugares, página y app, cerrar lo saca de Vender), e2e:com-8 (en la tanda). "Solo socios" y el cupo se muestran pero Vender no los frena (como el stock): COM-8b
- [ ] COM-8b · 🟡 · Que Vender frene un evento lleno o "solo socios" vendido sin socio — hoy avisa (como el stock) y no frena: tocar el cobro, decide Mateo
- [x] COM-9 · 🟢 · Cupones con código para campañas (tope de usos y vencimiento) — verificado: db (cupones: crear y validar, vencido y agotado frenan, uso anotado solo si la venta lleva el descuento, panel con usos y socios), vitest (aplicarCupon), e2e:com-9 (en la tanda). Alta online y "¿saltea el tope de la recepción?": COM-9b
- [ ] COM-9b · 🟡 · Cupón en el alta online, y si el cupón puede pasar el tope de descuento de la recepción (hoy no: es un descuento más) — plata y permisos: decide Mateo
- [x] COM-10 · 🟢 · Pedir la reseña de Google y una encuesta corta en buenos momentos — verificado: db (resena-encuesta: link solo https, aviso de reseña en la bandeja tras la entrada 10, encuesta pendiente a los 10 días o al mes, una respuesta cada 90 días, promotores con link; mensajes con 14 plantillas), e2e:com-10 (en la tanda)
- [x] COM-11 · 🟢 · Píxel de Meta y Google Analytics en la página (el dueño pega su código) — verificado: db (medicion: solo IDs válidos —código libre rechazado—, solo el dueño, la página los da solo publicada), e2e:com-11 (en la tanda)
- [x] COM-12 · 🟢 · Reservar un lugar puntual (bici, reformer) en el mapa de la sala — verificado: db (lugares-sala: numerar, fuera de servicio, dos no tienen el mismo lugar por índice único, en espera no elige, cancelar libera, profe solo sus clases), vitest (leerNumeros), e2e:com-12 (en la tanda)
- [x] COM-13 · 🟢 · Grados y cinturones (artes marciales) con "listos para rendir" — verificado: db (grados: armar, listos para rendir, profe otorga, fecha futura no, socio ve su progreso, anular vuelve al grado anterior), vitest (textoRequisitos), e2e:com-13 (en la tanda)
- [x] COM-14 · 🟢 · TV de la sala: clase de ahora, WOD y anotados en grande — verificado: db (tv-sala: solo dueño/encargado crea, token se ve una vez y no se lee la tabla, clase de ahora con WOD y anotados con inicial, el que vino sin reservar aparece presente, el token no sirve de tablet, revocada no ve), e2e:com-14 (en la tanda)
- [ ] COM-15 · 🟡 · Liquidación de los profes (clases dictadas → lo que se le paga) — toca plata: decide Mateo
- [ ] COM-16 · 🔌 · Factura electrónica ARCA por cada cobro (necesita el certificado de cada gimnasio; P3)
- [ ] COM-17 · 🔌 · Wellhub y TotalPass: el check-in de la plataforma cuenta como entrada

### 20 · Gym OS v2 (VD-*): dueño, recepción y socio (pedido de Mateo, 05/11 · `docs/v2/`, detalle y LISTO SI en `docs/v2/08-PLAN.md`; se publica por tanda, D25)
*Tanda 1 · Para mañana (lo que ve el dueño)*
- [x] VD-34 · 🟢 · Confiabilidad base: nada dos veces (botón único y clave de operación), nada se pierde, nada se traba — verificado: db: misma clave dos veces = una venta (también simultáneas) y la versión avisa quién cambió, corrida de base en verde en GitHub; e2e vd-34: en la corrida de la tanda
- [x] VD-47 · 🟢 · Rapidez de verdad: misma región, middleware liviano, un viaje por pantalla, streaming, caché de lo que no cambia, carga diferida y medición (`docs/v2/16-RAPIDEZ-Y-FLUIDEZ.md`) — verificado: middleware con gimnasio en memoria y getClaims, rpc con 10 s y Reintentar, Inicio con Suspense, caché pública con etiqueta, QR bajo demanda, scripts/medir/tiempos.mjs; base en verde en GitHub; lo que falta está en VD-47X
- [x] VD-27 · 🟢 · Diseño v2: vidrio, movimiento, componentes únicos — verificado: sistema de movimiento, vidrio, Hoja/Tilde/Brillo y loading con .esqueleto; base en verde en GitHub; e2e vd-27 y capturas: en la corrida de la tanda
- [x] VD-33 · 🟢 · Ingreso más lindo: marca del gimnasio, "primero quién, después cómo", código que se completa solo — verificado: ingreso con marca, un campo celular o mail, código de 6 dígitos con reenviar, olvidé mi contraseña por código, errores que no revelan cuentas; base en verde en GitHub; e2e vd-33 en la corrida de la tanda
- [x] VD-1 · 🟢 · Ventana de Entrada flotante en todas las pantallas (se abre al tipear, botón, barra fija; teclado numérico y lectores) — verificado: ventana de Entrada global (tipeo, botón, F2/Ctrl+E, lector USB, barra fija opcional) sobre las funciones de siempre + Configuración → Entrada; base en verde en GitHub; e2e vd-1 en la corrida de la tanda
- [x] VD-2 · 🟢 · Todas las situaciones del veredicto con su texto, lo que hay que decirle y su botón — verificado: guia_entrada en la base: botón, qué decirle, chips por situación; prueba de base por cada fila de la tabla; base en verde en GitHub; e2e vd-2 en la corrida de la tanda
- [x] VD-5 · 🟢 · Cobrar: un solo flujo en todos lados (Entrada, ficha, Vencen, alta, Ctrl+K) — verificado: hoja Cobrar única (Entrada, ficha, Vencen, Retención, Ctrl+K) con las mismas acciones que Vender, otro día solo dueño/encargado exigido por la base, vuelve al origen; base en verde en GitHub; e2e vd-5 en la corrida de la tanda
- [x] VD-6 · 🟢 · Alta rápida desde la Entrada y alta completa en un solo lugar — verificado: base en verde en GitHub; e2e (vd-6, vd-1b, vd-2b y los 12 viejos actualizados) en la corrida de la tanda
- [x] VD-12 · 🟢 · Inicio del dueño y de la recepción — verificado: numeros_inicio en un viaje con permisos por rol, 4 números configurables, turno de caja de la recepción; base en verde en GitHub; e2e vd-12 en la corrida de la tanda
- [x] VD-36 · 🟢 · App del socio en 4 pestañas, limpia — verificado: 4 pestañas Inicio·Clases·Rutina·Yo calculadas por pestanas_app en la base, pantallas viejas accesibles en Yo; base en verde en GitHub; e2e vd-36 en la corrida de la tanda
- [x] VD-23 · 🟢 · Inicio del socio, progreso (racha, meta, hitos) y bienvenida — verificado: progreso_inicio en la base (semana, racha, meta, hito, Entraste), bienvenida de 3 pasos, Pagar arriba si debe; base en verde en GitHub; e2e vd-23 en la corrida de la tanda
- [x] VD-47X · 🟢 · Rapidez, lo que quedó: useTransition en filtros, useOptimistic en tareas/reservas, fotos a 800 px webp al subir, next/image en listas, índices según explain analyze con 3.000 socios (migración 20261106004701), prueba de dos roles con caché, tabla de tiempos antes/después en el LOG — verificado: filtros con lista atenuada, useOptimistic en tareas/contactado, fotos a 800 px webp, 7 índices, pruebas de dos gimnasios/roles y de caché prohibida; base en verde en GitHub; explain.mjs y e2e vd-47x sin ejecutar
- [x] VD-12B · 🟢 · Inicio: últimas entradas en vivo con ⛔ y botón Cobrar, y Para hacer hoy con [Ver] (LISTO SI: Inicio muestra las últimas entradas con hora y vía y los vencidos llevan a cobrar) — verificado: base en verde en GitHub (inicio-en-vivo); e2e vd-12b/vd-23c en la corrida de la tanda
- [x] VD-12C · 🟢 · Interruptor: la recepción ve lo cobrado hoy (LISTO SI: el dueño lo prende en Configuración y la recepción ve el número) — verificado: base en verde en GitHub (inicio-en-vivo); e2e vd-12b/vd-23c en la corrida de la tanda
- [x] VD-12D · 🟢 · Mini gráfico de tendencia en los 8 números de Inicio — verificado: base en verde en GitHub (inicio-en-vivo); e2e vd-12b/vd-23c en la corrida de la tanda
- [x] VD-33B · 🟢 · Mi cuenta: cambiar contraseña con la actual, ver dispositivos y cerrar las demás sesiones (LISTO SI: e2e de las tres cosas) — verificado: base en verde en GitHub (mi-seguridad); e2e vd-33b/vd-12e en la corrida de la tanda
- [x] VD-33C · 🟢 · Desafío anti-robot (Turnstile) antes de mandar códigos que cuestan SMS, detrás de una variable (LISTO SI: sin el desafío resuelto no se manda el código; sin la variable todo sigue igual) — verificado: base en verde en GitHub (mi-seguridad); e2e vd-33b/vd-12e en la corrida de la tanda
- [x] VD-23B · 🟢 · Editor de la meta de visitas del mes (meta_visitas_mes) en Configuración, y fila "Escribile al gimnasio" en Yo → Más (LISTO SI: el dueño cambia la meta y el Inicio del socio la sigue) — verificado: base en verde en GitHub (inicio-en-vivo); e2e vd-12b/vd-23c en la corrida de la tanda
- [x] VD-23C · 🟢 · Socio demo vencido en usuarios-demo.mjs y e2e de "vencido → Pagar arriba" — verificado: base en verde en GitHub (inicio-en-vivo); e2e vd-12b/vd-23c en la corrida de la tanda
- [x] VD-1B · 🟢 · Ventana de Entrada: tecla F abre la ficha y su Volver regresa a la ventana con el mismo socio; selector de sede para el dueño con varias sedes (LISTO SI: e2e de ambas) — verificado: base en verde en GitHub; e2e (vd-6, vd-1b, vd-2b y los 12 viejos actualizados) en la corrida de la tanda
- [x] VD-2B · 🟢 · Veredicto: chip "tiene clase hoy" y situación "En prueba" (LISTO SI: prueba de base con una reserva de hoy muestra el chip) — verificado: base en verde en GitHub; e2e (vd-6, vd-1b, vd-2b y los 12 viejos actualizados) en la corrida de la tanda
- [x] VD-47Y · 🟢 · Correr scripts/medir/explain.mjs con 3.000 socios y poner la tabla antes/después en el LOG (LISTO SI: ninguna función de pantalla pasa de 300 ms) — verificado: tabla antes/después en el LOG de VD-30 (workflow medir-escala.yml)
- [x] VD-12E · 🟢 · Inicio: "Ahora y lo que sigue" no repite lo que ya está en Para hacer hoy (LISTO SI: nada aparece dos veces) — verificado: base en verde en GitHub (mi-seguridad); e2e vd-33b/vd-12e en la corrida de la tanda
- [x] VD-5B · 🟢 · El alta ("Dar de alta y cobrar") y la pantalla de Entrada abren la hoja Cobrar en vez de ir a /panel/vender?…&cuota=1; actualizar ent-9, pla-3, pla-6, soc-13, vd-1 y vd-34 que esperan esa URL (LISTO SI: todos siguen verdes) — verificado: base en verde en GitHub; e2e (vd-6, vd-1b, vd-2b y los 12 viejos actualizados) en la corrida de la tanda
- [ ] VD-5C · 🟢 · Prueba: Transferencias no mezcla comprobantes de mostrador con los del socio
- [ ] VD-33D · 🟢 · 2FA TOTP para dueño y super admin (LISTO SI: sin segundo factor no se entra a plata ni a equipo)
- [ ] VD-33E · 🟢 · Al cambiar la contraseña, ofrecer cerrar las demás sesiones
- [ ] VD-33F · 🟢 · Aviso al dueño cuando el equipo entra desde un dispositivo nuevo
- [x] VD-6B · 🟢 · Interesados con DNI: la tabla guarda el DNI y el alta lo ofrece por DNI (hoy solo por celular) — verificado: prospectos.dni y el alta lo ofrece por DNI; base en verde en GitHub (interesados-dni)
- [ ] VD-6C · 🟢 · El primer pago del alta muestra el proporcional exacto del día fijo (depende de VD-7)
- [ ] VD-2C · 🟡 CLA-6 · Situación "En prueba" definitiva (hoy provisoria: primera vez con pase o pack, solo informativa)
- [ ] VD-3B · 🟢 · Foto del socio en el amarillo de anti-préstamo; chip de alertas de préstamo de la semana en Inicio del dueño; UltimasEntradas de Inicio con el mismo polling de 4 s (LISTO SI: aparece una entrada por QR en < 6 s sin recargar)
- [ ] VD-4B · 🟢 · Aviso en vivo con el nombre de la sede para el dueño con varias sedes
- [ ] VD-7B · 🟢 · La deuda de la puerta (para_regularizar) de quien se anota con día fijo usa el proporcional que cobra la hoja (LISTO SI: db: para_regularizar de un socio sin cobertura con día fijo = lo que cobra la hoja)
- [ ] VD-7C · 🟢 · Ventana de pago en Vencen hoy ("día 4 de 10" con día fijo y gracia)
- [ ] VD-7D · 🟢 · Un gimnasio nuevo arranca con la regla proporcional (hoy sin fila queda "como hasta ahora")
- [ ] VD-8B · 🟢 · Lista de promesas de pago incumplidas con quién las autorizó y aviso al dueño
- [ ] VD-9B · 🟢 · Alerta al dueño (campana) una sola vez cuando una caja se cierra sin contar
- [ ] VD-9C · 🟢 · "Abrir mi turno" en Inicio también para dueño y encargado
- [ ] VD-9D · 🟢 · Etiquetas legibles de caja.* en el historial de configuración
- [ ] VD-9E · 🟢 · Avisar si el fondo con que se abre no coincide con lo que dejó el turno anterior
- [ ] VD-41B · 🟢 · El menú oculta Gastos al encargado sin permiso (se hace con VD-11)
- [ ] VD-41C · 🟢 · El interruptor encargado_ve_gastos también en Equipo → Permisos
- [ ] VD-41D · 🟢 · Presupuesto distinto por mes y aviso al dueño al pasarse
- [ ] VD-10B · 🟢 · Control: filtro por socio, e2e del cobro con fecha atrasada que llega a la campana, y el conteo de Control en el resumen del día del dueño
- [x] VD-16B · 🟢 · Sembrador con cantidad (npm run sembrar:demo -- --socios 3000) y medir retencion_periodo/vencen_pestanas < 300 ms (va con VD-30) — verificado: sembrador con --socios 3000 y cargar-gimnasios.mjs; retencion_periodo/vencen_pestanas medidas en medir-escala
- [ ] VD-16C · 🟢 · Retención: posponer una fila de riesgo hasta una fecha; gráficos de socios activos y churn mes a mes; cobrado por mes y por medio y proyección del mes
- [ ] VD-18B · 🟢 · Resultado: margen por producto (la base ya trae costo y margen); ficha del socio con sus servicios contratados; costo unitario en cada entrada de mercadería
- [ ] VD-15B · 🟢 · Socios: la píldora 🌐 cuenta solo los que no pagaron; encabezado de la ficha fijo al scrollear; línea de tiempo única en la ficha (entradas, pagos, contactos y cambios de plan)
- [ ] VD-13B · 🟢 · Avisos al socio en su app (automáticos, según Configuración → Mensajes), con el contador de personas a avisar sobre cada grupo (LISTO SI: el socio ve el aviso "vence en 3 días" en su app)
- [ ] VD-13C · 🟢 · Tres automáticas que faltan: firmas pendientes, hitos de 10/50/100 entradas con botón Hecho, pedir reseña a los contentos
- [ ] VD-13D · 🟢 · Para hacer hoy como bloque principal del Inicio (mismo componente AutomaticasHoy)
- [ ] VD-37B · 🟢 · Para el dueño nuevo, solo lo urgente prendido por defecto (comprobantes, caja, pedidos)
- [ ] VD-37C · 🟢 · Canales mail y WhatsApp en las preferencias de avisos
- [ ] VD-37D · 🟢 · Punto en Yo y Clases de la app del socio cuando hay un pago a hacer o un mensaje respondido (depende de VD-38)
- [x] VD-38B · 🟢 · pendientes_panel suma mensajes_sin_responder (hoy en 0) y el menú prende el punto de Mensajes (LISTO SI: db: llega un mensaje y el contador sube; baja al contestar) — verificado: pendientes_panel suma mensajes_sin_responder; base en verde en GitHub; e2e vd-38b en la corrida de la tanda
- [ ] VD-38C · 🟢 · Respuestas rápidas de ejemplo al crear un gimnasio; el equipo puede adjuntar foto en sus respuestas
- [ ] VD-39B · 🟢 · Aprobación previa del dueño para cambios de plan pagados por MercadoPago (opcional); deshacer un cambio de plan (anular la venta devuelve suscripción y coberturas); el mensaje de /app/pago nombra lo comprado ("Tu plan ahora es X")
- [ ] VD-24B · 🟢 · Cancelar una reserva suelta desde el panel (avisa a la espera) y promover de la espera al subir el cupo de una clase
- [ ] VD-25B · 🟢 · Grilla de clases con cupo en la página pública (RPC pública de clases, Reservar y Probar esta clase)
- [ ] VD-25C · 🔌 · Reseñas automáticas desde la API de Google (hoy las tipea el dueño)
- [ ] VD-25D · 🟢 · Medir Lighthouse celular de la página pública en el despliegue (≥ 90) y ajustar
- [ ] VD-19B · 🟢 · Editar un evento ya creado; check-in por DNI de anotados que no son socios; aviso cuando alguien sube de la espera
- [ ] VD-19C · 🔌 · Pago online del evento con MercadoPago (webhook deja al socio anotado)
- [ ] VD-20B · 🟢 · Aviso de rutina vencida al socio y gráfico de progreso por rutina y por socio para el profe
- [ ] VD-22C · 🟢 · Botón "Sumar a otra persona" en /app y desvincular un Google desde la ficha (recepción)
- [ ] VD-22D · 🟢 · Un solo usuario por socio con varias identidades (Google, celular, mail) sin que un ingreso desplace a otro
- [ ] VD-40B · 🟢 · Super admin: avisos a dueños por segmento y vigencia; campana del dueño para "BRIK entró a ayudarte"; módulos por gimnasio desde el super admin; logo en el alta; errores de 24 h, migraciones aplicadas y primeros pasos en la ficha
- [ ] VD-42B · 🟢 · Super admin con 2FA obligatorio: sin factor no entra a /admin y las admin_* exigen aal2
- [ ] VD-42C · 🟢 · Pedir el código TOTP justo después de la contraseña al ingresar
- [ ] VD-42D · 🟢 · Alerta al dueño por exportes grandes e intentos fallidos de PIN; aal2 en exportar_mes y exportar_gastos
- [ ] VD-43B · 🟢 · Ventas y clases de ejemplo borrables sin dejar plata en Resultado
- [ ] VD-43C · 🟢 · Fecha objetivo "abrimos el…" y pista de primera vez por rol
- [ ] VD-21B · 🟢 · Historial de cambios visible desde cada opción ("Ver cambios")
- [ ] VD-21C · 🟢 · Vista previa en vivo de los mensajes y de la página al editar
- [ ] VD-26B · 🟢 · Avisar a BRIK de cada pedido de demo (mail o WhatsApp) y un flag propio de plan público
- [ ] VD-28B · 🟢 · desde=entrada y origen conviven (hoy gana la Entrada)
- [ ] VD-28C · 🟢 · El alta nueva conserva el origen (alta desde Socios filtrado, cobrar y volver con el filtro)
- [ ] VD-28D · 🟢 · Memoria de lista también en Mensajes y Resultado cuando haya detalle propio
- [ ] VD-46S · 🟢 · MercadoPago: pagos devueltos en Control (linea_de_control), botón Revisar también en Ventas, estado in_mediation con aviso, etiqueta devuelto en la ficha de pagos
- [x] VD-46T · 🟢 · La base rechaza descuentos manuales con motivo fuera de la lista motivos_beneficio (hoy solo lo exige la pantalla) — verificado: base en verde en GitHub (vd-46n/o/t/u/w en supabase/pruebas); e2e vd-46x en la corrida de la tanda
- [x] VD-46U · 🟢 · Topes y motivos de cortesías y devoluciones en Configuración → Reglas (hoy en Control); anular una devolución registrada por error — verificado: base en verde en GitHub (vd-46n/o/t/u/w en supabase/pruebas); e2e vd-46x en la corrida de la tanda
- [ ] VD-46V · 🟢 · Suspensión por sede o de toda la cadena; el dueño no deja pasar a un expulsado con dejar pasar
- [x] VD-46W · 🟢 · Al dar de baja, rechazar también los pedidos de pausa pendientes y evitar que un aviso tardío de MercadoPago apruebe un pago ya rechazado — verificado: base en verde en GitHub (vd-46n/o/t/u/w en supabase/pruebas); e2e vd-46x en la corrida de la tanda
- [ ] VD-46X · 🟢 · Las emergencias de la puerta aparecen en Control (extender privado.avisos_moderacion copiando la versión vigente) y el llavero/kiosco habitual también entran marcados en emergencia (prueba de base)
- [ ] VD-46Y · 🟢 · Deshacer un perdón de falta (con motivo, queda el hecho); un reemplazo de profe sobrevive a editar el horario; perdones y reemplazos en Control; hora real del incidente hasta 7 días atrás; la recepción pide el perdón y dueño/encargado aprueba
- [ ] VD-46Z · 🟢 · Aumentos: anular un aumento avisa a los socios; el aviso del aumento también por push/mail; plan con categoría menores/mayores al cumplir 18; prueba de resultado_por_sede con venta mixta
- [ ] VD-46G2 · 🟢 · Plan familiar: el miembro respeta franja horaria, tope semanal y sede del plan del titular, medido con sus propias visitas
- [ ] VD-46G3 · 🟢 · Plan familiar: cobrar la cuota del titular desde cualquier miembro y resumen mensual de socios activos por empresa (corporativo)
- [ ] VD-46G4 · 🟢 · Plan familiar: avisar a los miembros cuando el titular vence o se da de baja
- [ ] VD-46N2 · 🟢 · Los avisos automáticos por push o mail (si existen) también respetan "No escribirle" (prueba de base de cada generador masivo)
- [ ] VD-46O2 · 🟢 · Mensaje a todos los ex socios filtrados con tope y registro de contacto
- [ ] VD-46W2 · 🟢 · Resolver el cobro tardío de MercadoPago (devolverlo o conciliarlo a mano) y cerrar la alerta
- [ ] VD-44B · 🟢 · "Mi foto": el profe o la recepción cambia su propia foto desde Mi cuenta
- [ ] VD-44C · 🟢 · La foto del profe en la TV de la sala y en el detalle de la clase del panel
- [ ] VD-31B · 🟢 · Apagar las ayudas también desde Yo en la app del socio, y un tour de la hoja Cobrar
- [ ] VD-29B · 🟢 · "entrada <dni>" también desde /panel/entrada (la página lee ?q=)
- [ ] VD-29C · 🟢 · Caja con acción directa (?accion=abrir|cerrar enfoca el formulario)
- [ ] VD-29D · 🟢 · "nuevo socio María" abre el alta con el nombre cargado
- [ ] VD-30B · 🟢 · Pendientes e Inicio sin recalcular la retención en cada vista (contadores guardados o caché de 60 s por gimnasio, o retención incremental). LISTO SI: pendientes_panel < 50 ms y filtros_socios < 300 ms con 3.000 socios en la tabla de medir-escala
*Tanda 2 · Plata y control*
- [x] VD-7 · 🟡 D18 · Cómo vencen las cuotas, con pantalla (día fijo con proporcional, desde el pago, continua) — verificado: regla de vencimiento por gimnasio y por plan (proporcional/mes entero/gratis/como antes) calculada en la base, simulador y hoja Cobrar; base en verde en GitHub; e2e vd-7 en la corrida de la tanda
- [x] VD-8 · 🟡 D19 · Dejar pasar sin pagar en tres modos configurables — verificado: dejar pasar en tres modos (hasta N días/siempre PIN/libre) con registro fijo en promesas_pago; base en verde en GitHub; e2e vd-8 en la corrida de la tanda
- [x] VD-9 · 🟡 D20 · Caja por turno que se cierra sola (sin contar) con reporte X y Z — verificado: caja vencida = sin_contar calculada sin cron, trigger que impide cobrar en ella, Para revisar, reportes X y Z con SOBRAN/FALTAN, calculadora; base en verde en GitHub (caja-sin-contar); e2e vd-9 en la corrida de la tanda
- [x] VD-10 · 🟢 · Control: todo queda escrito, con alertas al dueño — verificado: linea_de_control con 11 tipos paginada por cursor, alertas a la campana sin duplicar, /panel/control con filtros recordados y CSV; base en verde en GitHub (control); e2e vd-10 en la corrida de la tanda
- [x] VD-3 · 🟡 D24 · Reingreso: una visita dura N horas y anti-préstamo configurable — verificado: base en verde en GitHub (reingreso-visita, entradas-en-vivo); e2e vd-3 y vd-4 en la corrida de la tanda
- [x] VD-4 · 🟢 · Entradas en vivo (QR, tablet, otra compu) como avisos en todas las pantallas — verificado: base en verde en GitHub (reingreso-visita, entradas-en-vivo); e2e vd-3 y vd-4 en la corrida de la tanda
- [x] VD-41 · 🟢 · Gastos y presupuesto: la ganancia del mes — verificado: gastos por categoría con comprobante, fijos calculados sin cron, presupuesto, ganancia_mes en Resultado, encargado solo con permiso nuevo; base en verde en GitHub (gastos-presupuesto); e2e vd-41 en la corrida de la tanda
*Tanda 3 · El día del dueño*
- [x] VD-11 · 🟡 D21 · Menú nuevo (Para hacer hoy, Vencen y cobrar, Productos y stock, Control, Interesados) con redirecciones — verificado: menú nuevo con los nombres del doc 03 (claves intactas, ninguna ruta sacada), mapa central de rutas, Gastos oculto al encargado sin permiso; base en verde en GitHub (menu-gastos); e2e vd-11 en la corrida de la tanda
- [x] VD-37 · 🟢 · Pendientes con números y puntitos calculados, y centro de notificaciones — verificado: pendientes_panel en un pedido por rol, números en el menú con regla del rojo, campana agrupada por día con marcar todo leído y preferencias por tipo; base en verde en GitHub (pendientes-panel); e2e vd-37 en la corrida de la tanda; los 50 ms con 3.000 socios sin medir
- [x] VD-13 · 🟢 · Para hacer hoy: tareas inteligentes, manuales con repetición y avisos también a la app — verificado: 13 automáticas calculadas con su dato, manuales con repetición, checklist de apertura y cierre, cada una prendible y asignable; base en verde en GitHub (para-hacer-hoy); e2e vd-13 en la corrida de la tanda
- [x] VD-14 · 🟢 · Vencen y cobrar con pestañas y totales — verificado: base en verde en GitHub (vencen-pestanas, retencion-periodo); e2e vd-14 y vd-16 en la corrida de la tanda; los 300 ms con 3.000 socios sin medir
- [x] VD-15 · 🟡 D22 · Socios: lista con memoria, Interesados, autoalta visible, ficha con acciones — verificado: lista de Socios con memoria, Interesados como pestaña de Socios, 🌐 de autoalta, ficha con Entrada y Cobrar; base en verde en GitHub (interesados-dni); e2e vd-15 en la corrida de la tanda
- [x] VD-38 · 🟡 D27 · Mensajes de los socios al gimnasio (consultas, quejas, objetos perdidos) — verificado: mensajes del socio con foto y motivos, bandeja del panel con respuestas rápidas y estados, permisos por rol y aviso al socio; base en verde en GitHub (mensajes-socios); e2e vd-38 en la corrida de la tanda
- [x] VD-16 · 🟢 · Retención y números (churn general y de 90 días, asistencia, ocupación, plata) — verificado: base en verde en GitHub (vencen-pestanas, retencion-periodo); e2e vd-14 y vd-16 en la corrida de la tanda; los 300 ms con 3.000 socios sin medir
- [x] VD-17 · 🟢 · Planes y servicios (renovación por plan, servicios adicionales, orden y visibilidad) — verificado: base en verde en GitHub (planes-servicios, productos-stock); e2e vd-17 y vd-18 en la corrida de la tanda
- [x] VD-18 · 🟡 D21 · Productos y stock (venta rápida con foto, mínimo, mercadería) — verificado: base en verde en GitHub (planes-servicios, productos-stock); e2e vd-17 y vd-18 en la corrida de la tanda
- [x] VD-44 · 🟢 · Equipo con foto, clases y horario — verificado: foto, actividades y horario del equipo (foto privada servida tras autorizar la base), visible en /app/clases y en la página solo si el dueño lo prende; base en verde en GitHub (equipo-perfil); e2e vd-44 en la corrida de la tanda
*Tanda 4 · Socio y página*
- [x] VD-35 · 🟡 D26 · Registro del socio por su cuenta (queda socio sin pagar) — verificado: alta online con fecha de nacimiento obligatoria, interruptor registro abierto, 'Soy nuevo' en el ingreso, 🌐 A cobrar en Socios y clave de operación en los pagos de la app; base en verde en GitHub (registro-cambio-plan-app); e2e vd-35 en la corrida de la tanda
- [x] VD-39 · 🟡 D28 · Cambio de plan y compra de pases desde la app — verificado: /app/plan con días a favor calculados por la base, pago por MercadoPago o transferencia con clave de operación, el plan cambia al acreditarse el pago; base en verde en GitHub; e2e vd-39 en la corrida de la tanda
- [x] VD-22 · 🟡 D23 · Entrar con Google (todo listo hasta las credenciales) y sesión recordada — verificado: todo listo hasta las credenciales de Google (botón detrás de ENTRAR_CON_GOOGLE, vínculo por DNI + código, sesión recordada, imitador); base en verde en GitHub (entrar-con-google); e2e vd-22 en la corrida de la tanda
- [x] VD-24 · 🟢 · Lista de espera automática y motivo de "no podés reservar" — verificado: promoción de la espera sin dobles (dos conexiones reales), push de lugar liberado, motivo_reserva con frase y botón; base en verde en GitHub (espera-motivo, espera-concurrente); e2e vd-24 en la corrida de la tanda
- [x] VD-25 · 🟢 · Página del gimnasio rediseñada (prueba arriba, precios, horario en vivo, reseñas, WhatsApp) — verificado: prueba social en la portada (abierto ahora, reseñas, +N socios), primera vez en 3 pasos, WhatsApp flotante, next/image; base en verde en GitHub (prueba-social); e2e vd-25 en la corrida de la tanda; Lighthouse sin medir
- [x] VD-19 · 🟢 · Eventos completos (flyer, varias fechas, precio socio/no socio, espera, check-in) — verificado: eventos con flyer, fechas, precio socio/no socio, espera calculada, check-in en la Entrada y cierre con asistentes; base en verde en GitHub (eventos-completos); e2e vd-19 en la corrida de la tanda
- [x] VD-20 · 🟢 · Rutinas: biblioteca, plantillas, asignar a varios, progreso — verificado: biblioteca, plantillas, asignar a varios, la rutina de hoy en la app y quién la hizo; base en verde en GitHub (rutinas-completas); e2e vd-20 en la corrida de la tanda
*Tanda 5 · BRIK y seguridad*
- [x] VD-40 · 🟢 · Super admin v2: salud, alta en 3 pasos, soporte con motivo, ayuda con contexto, métricas — verificado: alta de gimnasio en 3 pasos con vista previa, salud con colores calculada, entrar como soporte con motivo visible al dueño, ayuda del dueño con contexto, métricas; base en verde en GitHub (super-admin-v2); e2e vd-40 en la corrida de la tanda
- [x] VD-42 · 🟢 · Mi cuenta y seguridad: contraseña, sesiones, 2FA, dar de baja a alguien del equipo — verificado: TOTP con aal2 solo si hay factor verificado en exportes/equipo/MercadoPago, dar de baja corta sesión+PIN+turno, alertas de seguridad al dueño; base en verde en GitHub (dos-pasos-y-baja); e2e vd-42 en la corrida de la tanda; el enrolamiento TOTP real no es ejecutable en el imitador
- [x] VD-43 · 🟢 · Gimnasio nuevo: onboarding calculado y datos de ejemplo — verificado: 9 pasos calculados, socios de ejemplo marcados que no tachan 'Tus socios', cargar y borrar ejemplos; base en verde en GitHub (onboarding-ejemplos); e2e vd-43 en la corrida de la tanda
- [x] VD-21 · 🟢 · Configuración con buscador, explicación y restablecer, con todo lo nuevo — verificado: buscador de ~60 opciones con ancla y resaltado, explicación y recomendado por opción, restablecer por tarjeta con confirmación; sin migración; lint, typecheck, pruebas, build y base en verde; e2e vd-21 en la corrida de la tanda
*Tanda 6 · El día a día real*
- [x] VD-46 · 🟢 · Situaciones del día a día (`docs/v2/14-SITUACIONES.md`): armar un ítem por cada ⭐ que falte y hacerlos — verificado: análisis de las 89 situaciones: 25 ⭐ (14 cubiertas, 5 parciales, 6 abiertas) y 18 ítems VD-46A…R armados en la COLA con su LISTO SI
- [x] VD-46A · 🟢 · MercadoPago: reembolso, contracargo y conciliación (un pago aprobado + charged_back pasa a devuelto, anula la venta y retira la cobertura; un approved posterior a refunded se ignora; el pendiente > 15 min se reconsulta sin cron; revierte solo por webhook o reconsulta, nunca por el navegador; alerta al dueño) — caso 17 de 14-SITUACIONES — verificado: devolución/contracargo de un pago aprobado pasa a devuelto, anula la venta y retira la cobertura (solo por webhook firmado o reconsulta del servidor); orden por fecha; reconsulta sin cron; alerta en la campana; base en verde en GitHub (mercadopago-devoluciones); e2e vd-46a en la corrida de la tanda
- [x] VD-46B · 🟢 · Suspender o expulsar a un socio con motivo y fecha de revisión (suspender_socio / levantar_suspension; la recepción suspende pero solo dueño/encargado levantan; el suspendido no entra ni como invitado; aparece en Control) — caso 37 — verificado: base en verde en GitHub (vd-46b/c/e/j en supabase/pruebas); e2e vd-46x en la corrida de la tanda
- [x] VD-46C · 🟢 · Cortesías y descuentos con motivo de una lista y tope bajo por defecto (dar_cortesia con vencimiento, tope por rol y por mes, alerta de cortesías repetidas; el motivo del descuento sale de una lista del gimnasio) — casos 11, 22, 23 — verificado: base en verde en GitHub (vd-46b/c/e/j en supabase/pruebas); e2e vd-46x en la corrida de la tanda
- [x] VD-46E · 🟢 · Baja con constancia: el pedido da un código, el pedido sin resolver > 24 h aparece en Para hacer hoy y la campana, y dar la baja anula pagos pendientes, turnos fijos y reservas futuras — caso 30 — verificado: base en verde en GitHub (vd-46b/c/e/j en supabase/pruebas); e2e vd-46x en la corrida de la tanda
- [x] VD-46J · 🟢 · Devolución proporcional al dar de baja con cuota adelantada (calcular_devolucion_baja y registrar_devolucion como hecho nuevo, egreso de caja con motivo, visible en Control y cierre) — casos 24, 16 — verificado: base en verde en GitHub (vd-46b/c/e/j en supabase/pruebas); e2e vd-46x en la corrida de la tanda
- [x] VD-46N · 🟢 · "No escribirle" por socio: un socio marcado no aparece en avisos masivos pero sí en Vencen para cobrar — casi nadie 14, caso 69 — verificado: base en verde en GitHub (vd-46n/o/t/u/w en supabase/pruebas); e2e vd-46x en la corrida de la tanda
- [x] VD-46O · 🟢 · Reactivar ex socios por motivo de baja y antigüedad, con seguimiento de cuántos volvieron a pagar — caso 80 — verificado: base en verde en GitHub (vd-46n/o/t/u/w en supabase/pruebas); e2e vd-46x en la corrida de la tanda
- [x] VD-46D · 🟢 · Aumento de precios con aviso previo mínimo (30 días, excepción solo del dueño con motivo) y constancia por socio activo; el que tiene cobertura pagada conserva el precio hasta que vence — caso 13 — verificado: base en verde en GitHub (aumento-aviso, deuda-socios, resultado-por-sede, firma-propia); e2e vd-46x en la corrida de la tanda
- [x] VD-46F · 🟢 · Chip "subió comprobante hace X" en la Entrada para el vencido con una transferencia pendiente (informativo: no cambia quién entra) — caso 10 — verificado: chip 'subió comprobante hace X' informativo (no cambia el color ni quién entra); base en verde en GitHub (chip-transferencia); e2e vd-46f en la corrida de la tanda
- [x] VD-46M · 🟢 · Modo emergencia de la puerta (solo dueño/encargado, con motivo, vence solo; las entradas de ese rato quedan marcadas y se listan al cerrar; arranca apagado por gimnasio) — casos 8, 63 — verificado: modo emergencia de la puerta (apagado de origen, solo dueño/encargado, con motivo, vence solo, entradas marcadas y listadas al cerrar); base en verde en GitHub (emergencia-puerta); e2e vd-46m en la corrida de la tanda
- [x] VD-46G · 🟢 · Plan familiar/corporativo: el titular paga por los vinculados y calcular_acceso hereda la cobertura ("cubierto por X"); titular vencido o dado de baja explicado a los miembros; arranca apagado por gimnasio — casos 32, 33 — verificado: plan familiar/corporativo apagado de origen: calcular_acceso hereda la cobertura del titular (cubierto por X / titular vencido / plan individual pendiente), los avisos de cobro van al titular sin duplicados; base en verde en GitHub (vd-46g-plan-familiar); e2e vd-46g en la corrida de la tanda
- [x] VD-46H · 🟢 · Detector de datos de salud en campos libres (notas, mensajes, pausas, tareas): avisa y pide reescribir — casi nadie 7 — verificado: base en verde en GitHub (incidentes, reemplazar-profe, perdonar-falta, salud en vitest); e2e vd-46x en la corrida de la tanda
- [x] VD-46I · 🟢 · Registro de incidentes en la sala sin diagnóstico (inmutable a las 24 h, solo dueño/encargado listan todo) — caso 62 — verificado: base en verde en GitHub (incidentes, reemplazar-profe, perdonar-falta, salud en vitest); e2e vd-46x en la corrida de la tanda
- [x] VD-46K · 🟢 · Reemplazar al profe en una sola clase con motivo — caso 50 — verificado: base en verde en GitHub (incidentes, reemplazar-profe, perdonar-falta, salud en vitest); e2e vd-46x en la corrida de la tanda
- [x] VD-46Q · 🟢 · Perdonar una falta o un bloqueo de reservas con motivo — caso 52 — verificado: base en verde en GitHub (incidentes, reemplazar-profe, perdonar-falta, salud en vitest); e2e vd-46x en la corrida de la tanda
- [x] VD-46L · 🟢 · Resultado: "lo que le debés a los socios" (packs con usos restantes + cuotas adelantadas) — caso 24 — verificado: base en verde en GitHub (aumento-aviso, deuda-socios, resultado-por-sede, firma-propia); e2e vd-46x en la corrida de la tanda
- [x] VD-46P · 🟢 · Resultado por sede donde se cobró y por sede donde se usó — casos 86, 87 — verificado: base en verde en GitHub (aumento-aviso, deuda-socios, resultado-por-sede, firma-propia); e2e vd-46x en la corrida de la tanda
- [x] VD-46R · 🟢 · Al cumplir 18: tarea automática y firma propia de documentos — casi nadie 6 — verificado: base en verde en GitHub (aumento-aviso, deuda-socios, resultado-por-sede, firma-propia); e2e vd-46x en la corrida de la tanda
*Tanda 7 · Cierre*
- [x] VD-28 · 🟢 · Navegación con memoria y Volver al origen — verificado: origen único (ruta+query+scroll) por pestaña, VolverAlOrigen con Link en ficha, clase y 9 pantallas, useMemoriaLista en las listas, vuelta del cobro con aviso; sin migración; lint, typecheck, pruebas, build y base en verde; e2e vd-28 en la corrida de la tanda
- [x] VD-29 · 🟢 · Ctrl+K con acciones — verificado: intérprete de comandos (cobrar juan, entrada DNI, ficha, nuevo socio, vender, turno, tarea, nuevo gasto) con permisos por rol y secciones; sin migración; lint, typecheck, 147 pruebas, build y base en verde; e2e vd-29 en la corrida de la tanda
- [x] VD-30 · 🟢 · Velocidad medida y escala (3.000 socios, 200 gimnasios) — verificado: 8 funciones de pantalla dentro del presupuesto con 3.019 socios y 202 gimnasios; 4 no (pendientes_panel, filtros_socios, exportar_socios, vencen_pestanas) con causa anotada -> VD-30B; base en verde en GitHub
- [x] VD-31 · 🟢 · Ayuda y onboarding por pantalla — verificado: globo de ayuda la primera vez por pantalla (panel y app del socio), guardado en la base por usuario, '?' para volver a verlo y apagado en Mi cuenta; base en verde en GitHub (ayuda-pantalla); e2e vd-31 en la corrida de la tanda
- [x] VD-26 · 🟢 · Página de Gym OS para vender — verificado: landing de plataforma (hero, 3 bloques en CSS, preguntas, planes solo si hay cargados, demo con campo trampa) y tarjeta de pedidos en /admin; base en verde en GitHub (pedidos-demo-brik); e2e vd-26 en la corrida de la tanda
- [ ] VD-32 · 🟢 · Segunda pasada v2: un día del dueño, de la recepción y un mes del socio
*Necesitan una cuenta (🔌: el agente deja todo listo, Mateo conecta)*
- [ ] VD-22B · 🔌 · Credenciales de Google para el ingreso del socio (las crea Mateo)
- [ ] VD-45 · 🔌 · SMTP propio (Resend) para que los mails de ingreso y "olvidé mi contraseña" anden en producción (Supabase manda 2 por hora sin esto)
- [ ] VD-45B · 🔌 · Sentry para ver los errores de producción (la integración queda lista detrás de una variable)
- [ ] VD-45C · 🔌 · Turnstile (CAPTCHA) en el registro y el envío de códigos

### Necesitan una cuenta externa (🔌: el agente deja todo listo, Mateo conecta)
- [ ] AVI-2 · 🔌 · Mails automáticos (Resend)
- [ ] AVI-4 · 🔌 · Resumen diario al dueño por mail
- [ ] MP-1 · 🔌 · Conectar MercadoPago del gimnasio
- [ ] MP-2 · 🔌 · Pagar la cuota con link de MercadoPago (webhook firmado e idempotente)
- [ ] MP-3 · 🔌 · Débito automático mensual
- [ ] AVI-3 · 🔌 · WhatsApp automático oficial
- [ ] ENT-5 · 🔌 · Molinete o lector de tarjeta
- [x] SEG-5 · 🟢 · Entrada sin internet (después de todo lo demás: es grande) — verificado: db (sin-internet: la copia es calcular_acceso fila por fila, sincronizar registra con la función de siempre en la hora en que pasó, el que no podía queda rechazado, reintentar no duplica, hora imposible y socio ajeno fallan), vitest (buscarEnCopia, copiaVigente), e2e:seg-5 (en la tanda)

---

## Detalle por panel

### Ítems que salieron de la especificación (`docs/producto/`)

**REG-1 · Hacete socio online.** Flujo de `05-ALTA-Y-PAGOS.md` pasos 1 a 7: plan con precio por medio, datos, reglamento (texto en Configuración, se guarda versión y fecha), forma de pago (MercadoPago si está conectado → PAY-1; transferencia con comprobante; en el mostrador → pendiente), cuenta creada, aviso al gimnasio. DNI repetido no duplica. Interruptor para apagar altas online.
LISTO SI: e2e de un visitante que se hace socio por cada forma de pago, y la recepción lo ve como corresponde en Entrada.

**ENT-6 · Kiosco con QR en pantalla (A4).** Tablet autorizada (token revocable) muestra un QR que cambia cada 30 s; el socio lo escanea desde su app (cámara del celular) → la tablet muestra su veredicto con nombre y foto. Mismo cálculo y registro que todas las entradas.
**ENT-7 · Llavero o tarjeta (A5).** Número de llavero por socio (único por gimnasio); el lector USB escribe en el buscador de Entrada o del kiosco y entra directo. Asignar y anular llavero desde la ficha.
**INV-1 · Invitados.** Pase de invitado desde Entrada o desde la app del socio: nombre y DNI del invitado, socio que invita, límite por socio y por mes (configurable), nunca anónimo; el invitado sale en el resumen del dueño.
LISTO SI (los tres): pruebas de base (QR vencido, repetido, de otro gimnasio; llavero anulado; tope de invitados) y e2e.

**CAJ-4 · Alertas de caja.** Diferencia al cerrar fuera del margen, retiro (con foto opcional del ticket en Storage privado), anulación y descuento mayor a lo configurado → aviso al dueño (en la app con AVI-5; push con PUSH-1).
**CAJ-5 · Caja olvidada.** A la hora de cierre del gimnasio, si hay caja abierta → aviso a quien la abrió y al dueño; no se abre otra caja de esa persona sin cerrar la vieja (se calcula al intentar abrir, no con un cron).
LISTO SI: pruebas de base y e2e de cierre con diferencia y de caja olvidada.

**AVI-5 · Campana de avisos.** Avisos en la app del socio y en el panel (por rol), leídos/no leídos, con el link a lo que hay que hacer.
**AVI-6 · Resumen del dueño.** Diario y semanal, calculado al abrirlo (lo de `06-CAJA-Y-CONTROL.md` punto 11), en Inicio y como aviso.
**PUSH-1 · Notificaciones push.** Web push con claves VAPID (variables de entorno, nunca en el código), suscripción por dispositivo, el usuario elige qué recibir; en iPhone, instrucciones para agregar a inicio. Probado con el envío real a un navegador de Playwright.
LISTO SI (los tres): e2e de un aviso que llega a la campana y a la notificación.

**PAY-1 · Pagos online.** Tabla de proveedores de pago por gimnasio (credenciales en Supabase Vault, nunca en texto plano), creación de preferencia de pago, webhook firmado e idempotente por ID externo (`eventos_webhook`), acreditación como cobertura, "Confirmando tu pago…" con actualización sola. Probado con eventos simulados firmados con un secreto de prueba; la conexión real a MercadoPago (MP-1) es 🔌.
LISTO SI: webhook con firma válida acredita una vez; repetido no acredita dos veces; firma inválida se rechaza; e2e del socio que paga y vuelve.

**APP-7 · Racha.** Entradas del mes y semanas seguidas, en el inicio de la app.
**APP-8 · Pedir pausa o baja.** Formulario con motivo → aviso al encargado y al dueño → lo resuelven desde la ficha.
**APP-9 · Entrar con mail.** Código por mail (además del celular) y opción de crear contraseña; vincula por mail igual que por teléfono.
**REF-1 · Invitá a un amigo.** Link personal → el amigo deja sus datos → prospecto con origen "referido de X" y pase de prueba; si se hace socio, el premio que configure el dueño (días gratis o nada).
LISTO SI: e2e de cada uno.

**ADM-5 · Demo para vender.** Link público "Probá Gym OS" que entra al gimnasio demo con un usuario de solo lectura; botón para reiniciar el demo (vuelve a sembrar).
**ADM-6 · Novedades para dueños.** BRIK escribe una novedad y aparece en el Inicio de todos los dueños hasta que la cierran.
**SEG-6 · Datos personales.** El socio descarga sus datos desde su perfil; la baja definitiva anonimiza (nombre, DNI, contacto) y deja los pagos para la contabilidad.

**REV-1 … REV-6 · Segunda pasada.** Cada una es un recorrido e2e largo (`scripts/e2e/rev-<n>.mjs`) que hace lo que dice el título, con capturas mirándolas, y compara contra `docs/producto/` y `10-DIA-A-DIA-Y-CASOS-RAROS.md` fila por fila. Lo chico se arregla en la misma vuelta; lo grande va al bloque 18 con su LISTO SI.

**VEN-6 · Anular una venta.** La base ya lo tiene (`anular_venta`, solo dueño o encargado) y ninguna pantalla lo usa. Botón en la venta (Caja → mis ventas / ficha → pagos) con motivo obligatorio; la venta queda tachada, nunca se borra; la cobertura que generó se anula; aviso al dueño (CAJ-4). La recepción ve "Pedir anulación" (queda pendiente para el encargado).
**CLA-7 · Anular un presente.** `anular_asistencia` existe y no tiene botón: en la lista de la clase, deshacer el presente con motivo (el profe, dentro del día; encargado y dueño siempre).
**SEG-7 · Funciones viejas.** `cobrar_cuota`, `precio_cuota`, `caja_abierta` y `asignar_plan` quedaron de la primera versión del cobro y siguen habilitadas para el equipo sin pantalla. Confirmar con pruebas que Vender cubre todo lo que hacían, y en una migración nueva sacarles el `grant` a `authenticated` (menos acceso, nunca más). Si alguna sirve, se usa desde su pantalla en vez de sacarla.
LISTO SI (los tres): pruebas de base por rol y e2e; `node scripts/mapa-pantallas.mjs` deja de listarlas como "sin pantalla".

### AUD · Auditoría botón por botón (cada panel)

**AUD-0 · Mapa.** `docs/paneles/README.md` (lo genera `npm run mapa` desde el código; `verificar` falla si una pantalla llama a una función que no existe): cada pantalla con su ruta, qué
roles la ven, qué funciones de la base llama, qué sección la apaga, y a qué
otras pantallas lleva. Es la base de las auditorías.

**AUD-n · Auditoría de un panel.** La hace el agente como si fuera el dueño de
cada tipo de gimnasio (tabla de arriba) y cada rol que usa ese panel.

1. **Abrirlo de verdad.** Con cada rol que lo ve, en compu y celular, con datos
   y vacío (un gimnasio recién creado). Capturas en `.local/capturas/aud-<n>-*`.
2. **Comparar con la especificación**: `docs/producto/paneles/<rol>.md` y las
   filas de `docs/producto/10-DIA-A-DIA-Y-CASOS-RAROS.md` que tocan ese panel.
   Cada fila tiene que estar hecha o en la COLA.
3. **Inventario botón por botón** en `docs/paneles/<panel>.md`: una fila por
   cada botón, link, campo, filtro y acción, con: qué hace hoy · si anda
   (probado haciendo clic, no leyendo) · qué le falta para servir de verdad ·
   con qué otras pantallas y funciones se conecta · si es configurable por
   gimnasio y si debería serlo.
4. **Pensar lo que falta**, en cadena: "para hacer X el dueño necesita Y, y
   sin Y no anda Z". Qué botón falta, cuál sobra, cuál confunde, cuál debería
   estar al lado de cuál, qué atajo ahorra trabajo, qué debería poder
   personalizar cada gimnasio (textos, colores, orden, qué se muestra), qué
   necesita cada rol (por ejemplo: cambiar su contraseña, ver solo lo suyo).
5. **Arreglar ya** lo roto que sea chico (un botón que no hace nada, un texto
   que confunde, un desborde, un error sin salida), con su prueba.
6. **Lo grande va a la COLA**: ítems nuevos al final del bloque de ese panel
   (`- [ ] <SIGLA>-<n> · 🟢 · título`), con su detalle y su LISTO SI en
   "Detalle por panel". Si un ítem nuevo pide una decisión de permisos o
   plata, el agente la toma (la más prudente) y la anota en "Decisiones que
   tomó el agente".
7. **Un recorrido e2e que hace clic en cada botón** del panel
   (`scripts/e2e/panel-<panel>.mjs`), sumado a `npm run e2e`.

LISTO SI: el inventario está completo (ningún botón sin probar), lo chico
está arreglado con prueba, lo grande quedó en la COLA con LISTO SI, y el e2e
del panel está en verde.

**AUD-16 · Como un cliente.** `scripts/e2e/cliente.mjs`: el super admin crea un
gimnasio desde cero → el dueño entra, hace los primeros pasos, carga planes,
importa socios, publica la página → un prospecto deja sus datos → la
recepción vende, cobra en la puerta, cierra la caja → un socio entra a la app,
reserva y paga por transferencia → el dueño ve el Resultado. Todo en verde, en
compu y celular.

### DIS · Diseño (todas las pantallas)

**DIS-0 · Sistema visual común.** Revisar `src/app/globals.css` y `src/components/panel/*`.
Que existan y se usen siempre los mismos: botón (normal, principal, peligro, chico), tarjeta, campo con etiqueta y ayuda, pestañas, píldoras de estado, aviso (éxito, error, info), estado vacío (emoji + frase + acción), cabecera de sección (emoji, título, una línea de qué es), fila de lista. Escribir `docs/DISENO.md` con cada uno, cuándo se usa y un ejemplo.
LISTO SI: ninguna pantalla define un botón o una tarjeta a mano (grep), `docs/DISENO.md` existe, y el barrido en celular no da desbordes.

**DIS-1 … DIS-15 · Pulido de cada pantalla.** Para la pantalla del ítem:
abrirla con cada rol que la ve, en compu y celular, con datos y vacía; sacar capturas antes y después.
Lista: 390 px sin desbordes · botones ≥ 52 px de alto · un solo verde · la línea de qué es · estado vacío con acción · `loading.tsx` con la forma real · errores con salida (qué hacer) · todo se usa con teclado · respuesta < 100 ms (estado "guardando…" inmediato) · textos cortos en castellano rioplatense · nada repetido para llenar.
LISTO SI: capturas antes/después en `.local/capturas/`, el barrido en verde y una línea en el LOG con qué cambió.

### ONB · Primeros pasos

**ONB-1.** El dueño, en Inicio, ve "Primeros pasos" mientras le falte algo: datos del gimnasio · logo y colores · planes y precios · horarios (y clases, si las usa) · medios de pago y alias · su equipo · socios (cargar o importar) · publicar la página. Cada paso lleva a la pantalla que lo resuelve. El progreso **se calcula** de los datos (función de la base), no se guarda. Desaparece cuando está todo; el dueño también lo puede ocultar.
LISTO SI: gimnasio recién creado muestra 0/8; el gimnasio demo muestra lo que le falta de verdad; prueba de base de la función y recorrido e2e.

### CFG · Configuración

**CFG-1.** Configuración en pestañas: **Gimnasio** (nombre, dirección, contacto, redes) · **Marca** · **Página** · **Cobros** · **Reglas** (gracia, vencimientos, qué pasa al vencer, en palabras simples) · **Clases** (si están prendidas) · **Secciones** (prender o apagar, explicando qué aparece y qué desaparece) · **Mensajes** · **Equipo** (link) · **Dirección** (dominio, link a la página). Cada campo con una línea de ayuda. Guardar por pestaña, con "guardado ✓".
LISTO SI: todo lo que hoy está en Configuración sigue funcionando (e2e), el encargado lo ve en solo lectura, en celular las pestañas se deslizan.

**CFG-2.** Subir logo (PNG/JPG/SVG ≤ 2 MB), favicon y hasta 12 fotos para la página, al bucket `marcas` (ya existe, migración 0008), con vista previa en el panel, la página y la app. Borrar y reordenar fotos. Se valida el tipo y el tamaño en la base (políticas de Storage) y en la pantalla.
LISTO SI: subir, ver, reemplazar y borrar probados contra supabase-local (si hace falta, sumar Storage a `scripts/local/supabase-local.mjs`), y el título y el ícono de la pestaña cambian.

**CFG-3.** Medios de pago que acepta el gimnasio (efectivo, transferencia, débito, crédito, MercadoPago 🔌 apagado hasta conectar), con recargo o descuento por medio, y los datos de transferencia (alias, CBU/CVU, titular, banco) que ve el socio con botón copiar.
LISTO SI: Vender y la app usan solo los medios prendidos; prueba de base.

**CFG-4.** Horarios de apertura por día (para la página y para "abierto ahora") y cierres (feriados, vacaciones) en un calendario. Los cierres ya existen en la base (cancelan clases y compensan días): falta la pantalla y mostrarlos en la página y la app.
LISTO SI: cargar un feriado cancela las clases de ese día y lo muestra en la app; anularlo las devuelve (prueba de base ya existe: sumar e2e).

**CFG-5.** Mensajes editables (vence pronto, venció, no viene, cumpleaños, bienvenida, comprobante) con variables `{nombre}` `{plan}` `{vence}` `{debe}` `{gimnasio}`, vista previa con un socio real, y "volver al original". Las plantillas de retención ya existen: unificarlas acá.
LISTO SI: un cambio de plantilla se ve en Retención, Vencen hoy y la bandeja de avisos.


**CFG-6.** (Salió de AUD-1.) La base ya tiene `accesos_activos`, `reingreso_mismo_dia_consume`, `retencion_dias_nuevo`, `retencion_dias_vencido` y `retencion_dias_se_fue`, y `guardar_configuracion` ya los acepta, pero ninguna pantalla los muestra. Sumarlos a Configuración: las formas de entrada con interruptores que explican qué hace falta para cada una (QR en la pared: imprimir el cartel; kiosco: una tablet; tarjeta y molinete: 🔌 hardware), el reingreso con un ejemplo ("Juan entra a las 8 y vuelve a las 19: ¿gasta otra clase?"), y los tres días de retención en Reglas.
LISTO SI: cada campo se cambia desde la pantalla y se ve el efecto (una forma de entrada apagada no aparece en Entrada ni en la app; reingreso probado con `estado_acceso` en la base; la lista de retención cambia con los días); no se puede dejar sin ninguna forma de entrada (la base ya lo frena desde 0020); e2e en `panel-configuracion.mjs`.

**CFG-7.** (Salió de AUD-1.) Apagar una sección no avisa qué pasa en las otras. Caja ya está resuelto (Vender sin efectivo). Falta pensarlo para el resto, por ejemplo: Socios apagado con Entrada prendida (¿recepción puede buscar socios?), Vender apagado con Transferencias prendida, Entrada apagada con QR del socio prendido, Vencen hoy apagado con los avisos. Al apagar, el interruptor muestra en una línea qué cambia; si apagar algo deja otra pantalla sin salida, se arregla esa pantalla (como Vender sin Caja), no se prohíbe apagar.
LISTO SI: una tabla de dependencias en `docs/paneles/configuracion.md`; cada combinación probada abriendo las pantallas con la sección apagada (e2e); ninguna pantalla prendida manda a una apagada.

**CFG-8.** (Salió de AUD-1.) Historial de cambios de configuración: quién cambió qué campo, de qué valor a qué valor y cuándo (tabla nueva con RLS, escrita por `guardar_configuracion`, nunca desde el navegador). Lo ve el dueño (y el encargado, solo lectura) al pie de Configuración y el super admin en el detalle del gimnasio. Sirve para "¿quién subió el descuento máximo de recepción?" y para soporte.
LISTO SI: cada guardado deja una fila por campo cambiado (no por campo enviado); probado en la base con sesión de dueño; recepción no lo lee (error, no lista vacía); e2e que cambia algo y lo ve en el historial.

**CFG-9.** (Salió de AUD-1.) Con "Otro color" se puede elegir un color principal que no se lee sobre el fondo (amarillo sobre crema, gris sobre gris). La vista previa ya lo muestra, pero no avisa. Calcular el contraste con `luminancia()` de `src/lib/marca.ts` y avisar en el bloque ("Este color se ve poco sobre este fondo") sin prohibirlo.
LISTO SI: prueba unitaria del cálculo; el aviso aparece y desaparece en el e2e al elegir colores malos y buenos.
### PAG · Página del gimnasio

**PAG-1.** Editor en el panel de las secciones de la página (ya existen en la base, 0008: portada, planes, horarios, sedes, fotos, etc.): texto, foto, mostrar u ocultar, ordenar. Vista previa en vivo al costado (en celular, botón "ver cómo queda").
**PAG-2.** Estado de la página: borrador / publicada (si no está publicada, se ve "próximamente"). Botón publicar, link para copiar y compartir por WhatsApp, y Open Graph (título, descripción y foto al compartir el link).
**PAG-3.** Formulario "Quiero probar una clase" (nombre, celular, qué le interesa) → sección **Prospectos** en el panel: lista, estado (nuevo, contactado, vino, se hizo socio, no), WhatsApp armado y "convertir en socio" (abre el alta con los datos). Con límite contra spam.
LISTO SI (los tres): e2e de punta a punta (editar → publicar → un visitante deja sus datos → aparece en Prospectos → se convierte en socio).
**PAG-4.** (Salió de AUD-2.) Que el gimnasio aparezca bien en Google: la página publicada lleva datos estructurados (`ExerciseGym` de schema.org con nombre, logo, dirección de cada sede, teléfono, horarios de apertura y link de Instagram), `sitemap.xml` y `robots.txt` por host (la página sin publicar y el panel no se indexan). Todo sale de los datos que ya carga el dueño.
LISTO SI: prueba que lee el JSON-LD de la página demo y coincide con la agenda y las sedes; `robots.txt` de un gimnasio sin publicar dice que no; el panel tiene `noindex`.

### SOC · Socios

**SOC-1 · Importador.** Subir Excel (.xlsx) o CSV → elegir qué columna es qué (nombre, apellido, DNI, celular, mail, plan, vence el, nacimiento) → vista previa con errores marcados (DNI repetido, celular inválido, plan que no existe) → importar en un solo paso → resumen. **Deshacer** la importación completa durante 24 h. Al terminar, `analyze`. Los vencimientos importados se cargan como coberturas (hechos), nunca como un estado.
LISTO SI: 3.000 filas importadas en < 30 s, duplicados detectados, deshacer probado, pruebas de base.

**SOC-2.** Ficha en pestañas: **Resumen** (semáforo y por qué, plan, vence, packs, acciones grandes: cobrar, WhatsApp, editar) · **Pagos** · **Asistencia** (calendario del mes) · **Notas**.
**SOC-12.** (Salió de AUD-3.) Filtros en píldoras arriba de la lista: al día, por vencer, vencidos, en pausa, nuevos (30 días), dados de baja, y por plan; cada uno con su cuenta. Salen de `estado_acceso` (nunca un cálculo aparte).
LISTO SI: e2e que toca cada filtro y ve solo los que corresponden.
**SOC-13.** (Salió de AUD-3.) Alta en un paso: en el mismo formulario, elegir plan y "✅ Guardar y cobrar" (va a Vender con el socio y el plan elegidos) o "Guardar" solo.
LISTO SI: e2e de alta con plan que termina cobrado.
**SOC-14.** (Salió de AUD-3.) La ficha dice cómo llegó (alta online, prospecto, importado, mostrador) y, si aceptó el reglamento, qué versión y cuándo (para mostrarle al socio).

**SOC-15.** (Salió de SOC-10.) Retención, Vencen hoy, Cumplen hoy y los mensajes armados usan `socios.telefono`: para un menor tienen que ir al celular del responsable (la ficha ya lo hace). Una sola función de la base que diga "a qué celular se le escribe a este socio", y que la usen todas.
LISTO SI: prueba de la base y e2e con un alta online.
**SOC-3.** Notas con fecha y autor, y etiquetas libres por gimnasio (turno mañana, estudiante…) para filtrar la lista y la retención.
**SOC-4.** Exportar la lista filtrada a CSV/Excel (solo dueño y encargado).
**SOC-5.** Grupo familiar: vincular socios (sin descuento automático: eso es D14).
**SOC-6.** Cumpleaños: fecha de nacimiento opcional, "cumplen hoy" en Inicio y en la bandeja de avisos.
**SOC-7.** Foto del socio con la cámara de la compu o el celular, guardada en Storage privado, vista en la entrada y la ficha.
**SOC-8.** Posibles duplicados (mismo DNI, celular o nombre parecido) y unir dos fichas, moviendo pagos y asistencias. Prueba de base obligatoria.

### ENT · Entrada

**ENT-1.** Veredicto grande: el color ocupa la pantalla, nombre, foto, motivo y acción (cobrar / dejar pasar); sonido distinto para verde y rojo (se puede apagar); Enter confirma, Esc vuelve a buscar; el buscador queda siempre con foco para el lector de código de barras o DNI.
**ENT-2.** QR en la app del socio, rotativo (cambia cada 30 s, firmado, no sirve una captura vieja) y lector con la cámara en Entrada. La validación es la misma función de acceso: nada se calcula en TypeScript.
**ENT-3.** Modo kiosco para una tablet en la puerta: pantalla sin menú, el socio escanea su QR o escribe su DNI y ve su semáforo. Sin sesión de una persona: un dispositivo autorizado por el dueño (token revocable).
LISTO SI: pruebas de base del QR (vencido, de otro gimnasio, repetido) y e2e de la recepción y del kiosco.

**ENT-8.** (Salió de AUD-4.) Para el dueño y el encargado: la lista de entradas "dejadas pasar" y anuladas de un día o una semana, con quién lo hizo y el motivo, y la cuenta por persona del equipo. Desde Entrada ("ver otro día") y desde Inicio del dueño si hubo alguna hoy. Sale de `ingresos` (no se guarda nada nuevo).
LISTO SI: prueba de base (la recepción no la ve si es solo para el dueño y el encargado; cuenta bien con anuladas) y e2e.

**ENT-9.** (Salió de AUD-4.) "💵 Cobrar" desde el veredicto rojo o amarillo abre Vender con la cuota de su plan ya en el carrito (como "Dar de alta y cobrar", SOC-13), y al cobrar vuelve a la Entrada con el socio elegido y el veredicto nuevo.
LISTO SI: e2e: rojo → Cobrar → cobrar en efectivo → vuelve verde y "Anotar entrada".

### VEN · Vender · CAJ · Caja · TRF · Transferencias

**VEN-1.** Comprobante de cada venta: link único (no adivinable) con lo pagado, para mandar por WhatsApp desde Vender y la ficha.
**VEN-4.** Productos con stock opcional: cantidad, baja sola al vender, aviso de poco stock en Inicio.
**CAJ-1.** Historial de turnos: quién abrió, quién cerró, esperado, contado, diferencia, retiros.
**CAJ-2.** Cierre para compartir (imagen o link) para mandarle al dueño.

### VEH · Vencen hoy · AVI · Avisos

**AVI-1.** Bandeja del día: a quién avisar hoy (vence en 3 días, venció ayer, no viene hace 10 días, cumple años, transferencia rechazada), con el mensaje de CFG-5 ya escrito, botón WhatsApp y "avisado ✓" (queda registrado). Se calcula al abrirla, no la arma un cron.
**VEH-1.** Desde Vencen hoy, "avisar a todos": abre los WhatsApp uno tras otro, marcando cada uno.

### RET · Retención

**RET-1.** Arriba de Retención: socios activos y su tendencia (12 semanas), bajas del mes, altas del mes, plata en riesgo.
**RET-3.** Al dar de baja: preguntar el motivo (lista configurable) y ofrecer pausa (si D7 está aprobada) antes de confirmar. Motivos de baja en el Resultado.

### CLA · Clases · RUT · Rutinas

**CLA-2.** Turno fijo: el socio (o la recepción) se abona a un horario semanal y queda reservado solo cada semana mientras esté al día; si deja de estar al día, se libera el lugar y sube la espera.
**CLA-3.** El profe o la recepción cancela una clase con motivo: los anotados ven "cancelada" en la app y aparecen en la bandeja de avisos con el mensaje armado; los packs no se descuentan.
**CLA-4.** WOD / rutina del día cargado por el profe en la clase; lo ven los anotados en la app.
**CLA-5.** Ocupación: % por horario de la semana (mapa de calor), para decidir horarios.
**CLA-8.** (de AUD-9) Actividades: cambiar nombre y emoji, y apagarla (sus horarios dejan de generar clases). Horarios: cambiar hora, duración, cupo y profe desde la grilla; lo que cambia vale desde la próxima clase sin reservas tomadas, y si una clase ya tiene reservas y baja el cupo, los que sobran pasan a espera con aviso. LISTO SI: prueba de base (cambio de cupo con reservas) y e2e.
**CLA-9.** (de CLA-1) Tercera opción de D16: la falta descuenta la clase del pack. Hoy un consumo de pack necesita un ingreso o un presente; hay que sumar "falta" como hecho (consumo con reserva_id) sin cron: se anota la primera vez que algo mira el pack de ese socio después de la clase, y la cuenta de clases que le quedan tiene que dar igual en la puerta, la app y la ficha. LISTO SI: prueba de base con momento fijo y e2e.
**CLA-6.** Clase de prueba: un prospecto (PAG-3) reserva una clase gratis una vez, con cupo, sin ser socio.
**RUT-1.** Biblioteca de ejercicios del gimnasio (nombre, grupo muscular, video opcional por link) y rutinas plantilla (días, ejercicios, series, repeticiones).
**RUT-2.** Asignar rutina a un socio; en la app la ve por día y anota peso y repeticiones (peso levantado sí se guarda; nada de salud).
**RUT-3.** Marcas personales por ejercicio y gráfico de progreso; el profe las ve.

### PLA · Planes

**PLA-1.** Duración del plan (1, 3, 6 o 12 meses) con su precio.
**PLA-2.** Restricciones: horario (ej. solo de 7 a 16), días por semana (2x, 3x, libre), actividades. Impacta la función de acceso: casos testigo nuevos para cada restricción.
**PLA-3.** Matrícula: cargo único al dar de alta (o anual), configurable por plan.
**PLA-4.** Aumento masivo: elegir planes, % o monto, desde qué fecha; vista previa de precios viejos y nuevos; aviso a los socios en la bandeja. Usa los precios programados que ya existen.
**PLA-5.** En la pantalla de planes: precio por medio de pago y por día (la base ya lo soporta, migración 0014).

### RES · Resultado (sección PLATA)

**RES-1.** Pantalla Resultado: ingresos del mes contra el anterior, por medio, por plan y por día; socios activos, altas, bajas, ingreso mensual recurrente estimado; horas pico de entradas. Todo desde funciones de la base, con el mismo cálculo que el resto.
**RES-2.** Exportar el mes (ventas, pagos, caja) en CSV para el contador.
**RES-3.** Gastos simples (alquiler, sueldos, servicios, otros) por mes → ganancia.

### EQU · Equipo

**EQU-3.** "Qué hizo cada uno": ventas, descuentos, anulaciones, dejados pasar, cierres de caja, por persona y día. Solo dueño (y encargado si D4 lo prende).

### APP · App del socio

**APP-1.** Instalable (manifest y service worker mínimo) con nombre, ícono y colores del gimnasio; "agregar a inicio" explicado.
**APP-3.** Historial: pagos (con comprobante, VEN-1) y asistencia del mes.
**APP-6.** Novedades: el dueño publica un aviso (texto y foto opcional, con vencimiento) y se ve arriba en la app.

### COM · Lo que tiene la competencia (`docs/producto/12-COMPETENCIA.md`)

**COM-1 · Riesgo de baja.** Por socio, un nivel (alto, medio, bajo) armado con reglas en SQL, sin IA: viene menos que su promedio de las últimas 8 semanas, dejó de reservar, venció y no renovó, no abre la app, pidió pausa. Cada socio en riesgo dice el porqué en una línea ("venía 3 veces por semana, las últimas 2 no vino") y al lado el WhatsApp armado. Se calcula, no se guarda. Va en Retención (primera lista) y en la ficha. Lo tienen Glofox, Wodify, Fitco y Virtuagym.
LISTO SI: pruebas de la base con un socio por regla (momento fijo); la lista en Retención con su porqué; e2e.

**COM-2 · Socio nuevo.** Los primeros 30 días: meta de entradas configurable (por defecto 8), aviso en Retención si en la primera semana vino menos de 2 veces, y mensajes sugeridos los días 1, 7 y 30 (plantillas editables de CFG-5). En la ficha, "Día 12 de 30 · 4 entradas".
LISTO SI: prueba de la base con fechas fijas; aparece en Retención y en la ficha; e2e.

**COM-3 · Avisar a los anotados.** Desde la lista de una clase, "Avisar a todos": texto con plantilla, un WhatsApp armado por persona (y mail cuando AVI-2 esté). Queda anotado en la clase.
LISTO SI: e2e desde Clases de hoy.

**COM-4 · Tareas del equipo.** Una tarea tiene qué, sobre qué socio (opcional), para quién y para cuándo. Se crea desde la ficha, Retención o Inicio; las de hoy y vencidas aparecen en Inicio de quien la tiene. Cada uno ve las suyas; dueño y encargado ven todas.
LISTO SI: tabla con RLS y pruebas de permisos; e2e de crear, ver en Inicio y completar.

**COM-5 · Retención en números.** En Retención y en Resultado: altas y bajas del mes (movimiento neto), de los que entraron hace 3 meses cuántos siguen, y % de socios activos con menos de 4 entradas en el mes. Cada número abre la lista con nombres.
LISTO SI: pruebas de la base con datos armados; e2e que toca cada número y ve la lista.

**COM-6 · Documentos para firmar.** El gimnasio carga sus textos (reglamento, deslinde, autorización del responsable para menores), cada uno con versión. El socio firma con nombre y tilde en la app o en recepción; se guarda versión, fecha y quién. En la entrada, "falta firmar" es un aviso amarillo, no bloquea (el gimnasio puede elegir que bloquee). Nunca datos de salud en los textos que se guardan firmados.
LISTO SI: pruebas de la base (versión nueva pide firmar de nuevo); e2e firma desde la app y aviso en la entrada.

**COM-7 · Kiosco con habituales.** La tablet de la puerta muestra los que suelen venir a esta hora (nombre e inicial del apellido) para tocar en vez de escribir; se puede apagar en Configuración.
LISTO SI: e2e en el kiosco.

**COM-8 · Eventos.** Un evento suelto (seminario, clase especial) con fecha, cupo, precio y quién puede anotarse; se vende en Vender y se muestra en la página y la app.
LISTO SI: e2e crear → anotarse → cobrar.

**COM-9 · Cupones.** Código, descuento (% o monto), tope de usos, vencimiento, planes a los que aplica; se usa en Vender y en el alta online. El Resultado dice cuántos socios trajo cada código.
LISTO SI: pruebas de la base (tope y vencimiento); e2e.

**COM-10 · Reseña y encuesta.** Después de la entrada 10 o del primer mes, la bandeja de avisos sugiere pedir la reseña de Google (link que carga el dueño) y una encuesta de una pregunta (0 a 10). Los 9 y 10 se marcan para invitar a traer a un amigo.
LISTO SI: e2e en la bandeja.

**COM-11 · Píxel y Analytics.** En Configuración → Página, el dueño pega su ID de píxel de Meta y de Google Analytics; la página publicada los carga. Validado (solo dígitos o `G-…`), nunca código libre.
LISTO SI: e2e que ve el script con el ID en la página publicada y no en la sin publicar.

**COM-12 · Lugar puntual.** Para clases con máquinas: la sala tiene lugares numerados (con uno fuera de servicio), el socio elige el suyo al reservar.
LISTO SI: pruebas de la base (dos no reservan el mismo lugar); e2e.

**COM-13 · Grados.** Para artes marciales: grados por actividad con requisitos (clases y tiempo), el grado de cada socio y la lista de listos para rendir.
LISTO SI: pruebas de la base; e2e.

**COM-14 · TV de la sala.** Una dirección para una TV: la clase de ahora, los anotados con nombre grande, el WOD del día (RUT) y la próxima clase. Se actualiza sola.
LISTO SI: e2e que abre la TV y ve aparecer a un anotado nuevo.

**COM-15 · Liquidación de profes.** Toca plata: espera decisión de Mateo (por clase, por presente o fijo; comisión por packs).

**COM-16 · Factura ARCA.** Necesita el certificado de cada gimnasio. Espera respuesta de P3.

**COM-17 · Wellhub y TotalPass.** Necesita la cuenta de partner de cada plataforma.

### ADM · Super admin (BRIK)

**ADM-1.** Al crear un gimnasio, elegir su tipo (tabla de arriba): prende las secciones, el modo de clases y planes de ejemplo editables.
**ADM-4.** Salud por gimnasio: última vez que alguien del equipo entró, entradas y ventas de los últimos 7 días, socios activos, alerta si deja de usarse.

### SEG · Endurecer

**SEG-1.** Límite de pedidos de código por celular y por IP (base), con mensaje claro.
**SEG-2.** El dueño descarga todos los datos de su gimnasio (zip de CSV).
**SEG-4.** Medir cada pantalla con 3.000 socios (seed grande) y dejar todas por debajo de 1 s en el servidor; lo que no, índice o materialización.
**SEG-5.** Entrada sin internet: la recepción guarda una copia de quién puede entrar y sincroniza al volver. Grande; se diseña antes de codear.
