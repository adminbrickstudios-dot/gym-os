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
- [ ] AUD-9 · 🟢 · Auditoría botón por botón: Clases (día, lista, grilla, actividades)
- [ ] CLA-1 · 🟡 D16 · Políticas de reserva y faltas
- [ ] CLA-2 · 🟢 · Turnos fijos (abono a un horario)
- [ ] CLA-3 · 🟢 · Cancelar una clase avisando a los anotados
- [ ] CLA-4 · 🟢 · WOD / rutina del día en la clase
- [ ] CLA-5 · 🟢 · Ocupación por horario
- [ ] CLA-6 · 🟢 · Clase de prueba para prospectos
- [ ] CLA-7 · 🟢 · Anular un presente marcado por error
- [ ] DIS-9 · 🟢 · Pulido: Clases

### 10 · Retención
- [ ] AUD-10 · 🟢 · Auditoría botón por botón: Retención
- [ ] RET-1 · 🟢 · Tablero de retención (bajas del mes, tendencia)
- [ ] RET-2 · 🟡 D2 · La recepción anota contactos
- [ ] RET-3 · 🟢 · Antes de la baja, ofrecer pausa y preguntar el motivo
- [ ] DIS-8 · 🟢 · Pulido: Retención

### 11 · App del socio
- [ ] AUD-11 · 🟢 · Auditoría botón por botón: App del socio
- [ ] APP-1 · 🟢 · App del socio instalable (con el ícono y los colores del gimnasio)
- [ ] APP-3 · 🟢 · Historial de pagos y asistencia en la app
- [ ] APP-6 · 🟢 · Novedades del gimnasio en la app
- [ ] APP-7 · 🟢 · Racha y entradas del mes
- [ ] APP-8 · 🟢 · Pedir pausa o baja desde la app
- [ ] APP-9 · 🟢 · Entrar con mail y código, o con contraseña (P1)
- [ ] REF-1 · 🟢 · Invitá a un amigo (pase de prueba con link)
- [ ] DIS-12 · 🟢 · Pulido: App del socio

### 12 · Equipo y cuentas
- [ ] AUD-12 · 🟢 · Auditoría botón por botón: Equipo y Mi cuenta
- [ ] EQU-1 · 🟡 D4 · Interruptores de permisos por gimnasio
- [ ] EQU-2 · 🟡 D3 · El profe busca socios
- [ ] EQU-3 · 🟢 · Qué hizo cada uno (auditoría)
- [ ] DIS-11 · 🟢 · Pulido: Equipo y Mi cuenta

### 13 · Rutinas
- [ ] RUT-1 · 🟢 · Ejercicios y rutinas del gimnasio
- [ ] RUT-2 · 🟢 · Asignar rutina; el socio la ve y anota sus pesos
- [ ] RUT-3 · 🟢 · Marcas personales y progreso

### 14 · Inicio (al final: junta todo lo anterior)
- [ ] AUD-14 · 🟢 · Auditoría botón por botón: Inicio de cada rol
- [ ] DIS-1 · 🟢 · Pulido: Inicio

### 15 · Super admin y plataforma
- [ ] AUD-15 · 🟢 · Auditoría botón por botón: Super admin, Ingresar y Elegir gimnasio
- [ ] ADM-1 · 🟢 · Plantillas por tipo de gimnasio al crear
- [ ] ADM-4 · 🟢 · Salud de cada gimnasio en el super admin
- [ ] ADM-5 · 🟢 · Demo para vender: link "Probá Gym OS" y reiniciar el demo
- [ ] ADM-6 · 🟢 · Novedades de Gym OS para todos los dueños
- [ ] ADM-2 · 🟡 D11 · Suspensión gradual del gimnasio
- [ ] ADM-3 · 🟡 D13 · Suscripción del gimnasio a BRIK
- [ ] DIS-15 · 🟢 · Pulido: Super admin
- [ ] DIS-14 · 🟢 · Pulido: Ingresar, elegir gimnasio, no encontrado

### 16 · Cierre
- [ ] SEG-1 · 🟢 · Límite de pedidos de código por celular
- [ ] SEG-2 · 🟢 · Exportar todos los datos del gimnasio
- [ ] SEG-4 · 🟢 · Rendimiento con 3.000 socios en todas las pantallas
- [ ] SEG-6 · 🟢 · Datos personales: el socio descarga sus datos; baja con anonimización
- [ ] SEG-7 · 🟢 · Funciones viejas sin pantalla (cobrar_cuota, precio_cuota, caja_abierta, asignar_plan): confirmar que Vender las reemplazó y sacarles el acceso del equipo
- [ ] AUD-16 · 🟢 · Recorrido completo como un cliente, de punta a punta

### 17 · Segunda pasada (todo de nuevo, con ojos nuevos)
Cada una vuelve a abrir todo el panel con su rol, lo compara con `docs/producto/`
y con `10-DIA-A-DIA-Y-CASOS-RAROS.md` fila por fila, y suma lo que falte al
bloque 18.
- [ ] REV-1 · 🟢 · Segunda pasada: un día entero como recepción (de abrir a cerrar caja)
- [ ] REV-2 · 🟢 · Segunda pasada: una semana como dueño (celular)
- [ ] REV-3 · 🟢 · Segunda pasada: un mes como socio (alta online → pagar → entrar → reservar → renovar)
- [ ] REV-4 · 🟢 · Segunda pasada: un día como profe
- [ ] REV-5 · 🟢 · Segunda pasada: BRIK da de alta un gimnasio de cada tipo y lo deja andando
- [ ] REV-6 · 🟢 · Segunda pasada: intentar romperlo (permisos, doble clic, dos personas a la vez, sin internet, datos raros)

### 18 · Lo que encontró la segunda pasada

### 19 · Lo que tiene la competencia y nos falta (pedido de Mateo, 04/11 · `docs/producto/12-COMPETENCIA.md`)
- [ ] COM-1 · 🟢 · Riesgo de baja de cada socio, con el porqué y la acción al lado
- [ ] COM-2 · 🟢 · Los primeros 30 días del socio nuevo: meta de visitas y aviso si la primera semana no vino
- [ ] COM-3 · 🟢 · Avisar a todos los anotados de una clase
- [ ] COM-4 · 🟢 · Tareas del equipo ("llamar a Juan el jueves") con las de hoy en Inicio
- [ ] COM-5 · 🟢 · Retención en números: bajas del mes, cuántos siguen a los 90 días, socios con pocas visitas
- [ ] COM-6 · 🟢 · Documentos para firmar (reglamento, deslinde, autorización de menores) con aviso en la entrada
- [ ] COM-7 · 🟢 · Kiosco: los habituales de esta hora para tocar su nombre
- [ ] COM-8 · 🟢 · Eventos y workshops sueltos con cupo, precio y pago
- [ ] COM-9 · 🟢 · Cupones con código para campañas (tope de usos y vencimiento)
- [ ] COM-10 · 🟢 · Pedir la reseña de Google y una encuesta corta en buenos momentos
- [ ] COM-11 · 🟢 · Píxel de Meta y Google Analytics en la página (el dueño pega su código)
- [ ] COM-12 · 🟢 · Reservar un lugar puntual (bici, reformer) en el mapa de la sala
- [ ] COM-13 · 🟢 · Grados y cinturones (artes marciales) con "listos para rendir"
- [ ] COM-14 · 🟢 · TV de la sala: clase de ahora, WOD y anotados en grande
- [ ] COM-15 · 🟡 · Liquidación de los profes (clases dictadas → lo que se le paga) — toca plata: decide Mateo
- [ ] COM-16 · 🔌 · Factura electrónica ARCA por cada cobro (necesita el certificado de cada gimnasio; P3)
- [ ] COM-17 · 🔌 · Wellhub y TotalPass: el check-in de la plataforma cuenta como entrada

### Necesitan una cuenta externa (🔌: el agente deja todo listo, Mateo conecta)
- [ ] AVI-2 · 🔌 · Mails automáticos (Resend)
- [ ] AVI-4 · 🔌 · Resumen diario al dueño por mail
- [ ] MP-1 · 🔌 · Conectar MercadoPago del gimnasio
- [ ] MP-2 · 🔌 · Pagar la cuota con link de MercadoPago (webhook firmado e idempotente)
- [ ] MP-3 · 🔌 · Débito automático mensual
- [ ] AVI-3 · 🔌 · WhatsApp automático oficial
- [ ] ENT-5 · 🔌 · Molinete o lector de tarjeta
- [ ] SEG-5 · 🟢 · Entrada sin internet (después de todo lo demás: es grande)

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
