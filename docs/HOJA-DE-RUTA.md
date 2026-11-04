# Gym OS — Hoja de ruta, panel por panel

Este archivo manda sobre qué se hace y en qué orden. Lo leen Mateo, las
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
- [ ] DIS-0 · 🟢 · Sistema visual común: botones, tarjetas, campos, pestañas, avisos, estados vacíos (`docs/DISENO.md`)
- [ ] AUD-0 · 🟢 · Mapa de pantallas, funciones y conexiones (`docs/paneles/README.md`)

### 1 · Configuración y primeros pasos
- [ ] AUD-1 · 🟢 · Auditoría botón por botón: Configuración
- [ ] CFG-1 · 🟢 · Configuración en pestañas, todo explicado
- [ ] CFG-2 · 🟢 · Subir logo, favicon y fotos desde el panel
- [ ] CFG-3 · 🟢 · Medios de pago y datos de transferencia
- [ ] CFG-4 · 🟢 · Horarios del gimnasio, feriados y cierres
- [ ] CFG-5 · 🟢 · Mensajes editables con vista previa
- [ ] ONB-1 · 🟢 · "Primeros pasos" del dueño en Inicio

### 2 · Página del gimnasio
- [ ] AUD-2 · 🟢 · Auditoría botón por botón: Página del gimnasio
- [ ] PAG-1 · 🟢 · Editor de la página del gimnasio con vista previa
- [ ] PAG-2 · 🟢 · Publicar / despublicar la página, y compartirla
- [ ] PAG-3 · 🟢 · "Quiero probar": prospectos desde la página
- [ ] DIS-13 · 🟢 · Pulido: Página del gimnasio

### 3 · Socios
- [ ] AUD-3 · 🟢 · Auditoría botón por botón: Socios (lista, alta, edición, ficha)
- [ ] SOC-1 · 🟢 · Importar socios desde Excel o CSV
- [ ] SOC-2 · 🟢 · Ficha del socio en pestañas (resumen, pagos, asistencia, notas)
- [ ] SOC-3 · 🟢 · Notas y etiquetas, con filtros
- [ ] SOC-4 · 🟢 · Exportar la lista de socios
- [ ] SOC-6 · 🟢 · Cumpleaños
- [ ] SOC-7 · 🟢 · Foto del socio desde la cámara
- [ ] SOC-8 · 🟢 · Encontrar y unir socios duplicados
- [ ] SOC-5 · 🟢 · Grupo familiar
- [ ] SOC-9 · 🟡 D7 · Pausas desde la ficha
- [ ] SOC-10 · 🟡 D10 · Menores con adulto responsable
- [ ] SOC-11 · 🟡 D9 · Apto físico (solo sí/no y vencimiento)
- [ ] DIS-3 · 🟢 · Pulido: Socios

### 4 · Entrada
- [ ] AUD-4 · 🟢 · Auditoría botón por botón: Entrada
- [ ] ENT-1 · 🟢 · Veredicto en pantalla completa, sonido y teclado
- [ ] ENT-2 · 🟢 · QR del socio y lector con cámara en la recepción
- [ ] ENT-4 · 🟡 D1 · Reglas de "dejar pasar"
- [ ] ENT-3 · 🟢 · Tablet en la puerta (modo kiosco)
- [ ] DIS-2 · 🟢 · Pulido: Entrada

### 5 · Planes y precios
- [ ] AUD-5 · 🟢 · Auditoría botón por botón: Planes y productos
- [ ] PLA-5 · 🟢 · Precio por medio de pago y por día, desde la pantalla
- [ ] PLA-4 · 🟢 · Aumento de precios masivo y programado
- [ ] PLA-1 · 🟢 · Planes trimestral, semestral y anual
- [ ] PLA-2 · 🟢 · Planes por horario y por días por semana
- [ ] PLA-3 · 🟢 · Matrícula / inscripción
- [ ] PLA-6 · 🟡 D6 · Cambio de plan con días a favor
- [ ] PLA-7 · 🟡 D8 · Recargo por pagar tarde
- [ ] DIS-10 · 🟢 · Pulido: Planes y productos

### 6 · Vender, Caja y Transferencias
- [ ] AUD-6 · 🟢 · Auditoría botón por botón: Vender, Caja y Transferencias
- [ ] VEN-1 · 🟢 · Comprobante de pago por WhatsApp
- [ ] VEN-4 · 🟢 · Productos con stock
- [ ] VEN-3 · 🟡 D14 · Convenios y descuentos automáticos
- [ ] VEN-5 · 🟡 D5 · Deuda / cuenta corriente
- [ ] CAJ-1 · 🟢 · Historial de turnos de caja
- [ ] CAJ-2 · 🟢 · Cierre de caja para compartir
- [ ] CAJ-3 · 🟡 D15 · PIN del equipo en la recepción
- [ ] DIS-4 · 🟢 · Pulido: Vender
- [ ] DIS-5 · 🟢 · Pulido: Caja
- [ ] DIS-6 · 🟢 · Pulido: Transferencias

### 7 · Vencen hoy y avisos
- [ ] AUD-7 · 🟢 · Auditoría botón por botón: Vencen hoy
- [ ] AVI-1 · 🟢 · Bandeja de avisos del día (WhatsApp ya escrito)
- [ ] VEH-1 · 🟢 · Cobranza en tanda desde Vencen hoy
- [ ] DIS-7 · 🟢 · Pulido: Vencen hoy

### 8 · Resultado (la plata)
- [ ] RES-1 · 🟢 · Resultado: la plata del mes, clara
- [ ] RES-2 · 🟢 · Exportar para el contador
- [ ] RES-3 · 🟢 · Gastos y ganancia

### 9 · Clases
- [ ] AUD-9 · 🟢 · Auditoría botón por botón: Clases (día, lista, grilla, actividades)
- [ ] CLA-1 · 🟡 D16 · Políticas de reserva y faltas
- [ ] CLA-2 · 🟢 · Turnos fijos (abono a un horario)
- [ ] CLA-3 · 🟢 · Cancelar una clase avisando a los anotados
- [ ] CLA-4 · 🟢 · WOD / rutina del día en la clase
- [ ] CLA-5 · 🟢 · Ocupación por horario
- [ ] CLA-6 · 🟢 · Clase de prueba para prospectos
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
- [ ] ADM-2 · 🟡 D11 · Suspensión gradual del gimnasio
- [ ] ADM-3 · 🟡 D13 · Suscripción del gimnasio a BRIK
- [ ] DIS-15 · 🟢 · Pulido: Super admin
- [ ] DIS-14 · 🟢 · Pulido: Ingresar, elegir gimnasio, no encontrado

### 16 · Cierre
- [ ] SEG-1 · 🟢 · Límite de pedidos de código por celular
- [ ] SEG-2 · 🟢 · Exportar todos los datos del gimnasio
- [ ] SEG-4 · 🟢 · Rendimiento con 3.000 socios en todas las pantallas
- [ ] AUD-16 · 🟢 · Recorrido completo como un cliente, de punta a punta

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

### AUD · Auditoría botón por botón (cada panel)

**AUD-0 · Mapa.** `docs/paneles/README.md`: cada pantalla con su ruta, qué
roles la ven, qué funciones de la base llama, qué sección la apaga, y a qué
otras pantallas lleva. Es la base de las auditorías.

**AUD-n · Auditoría de un panel.** La hace el agente como si fuera el dueño de
cada tipo de gimnasio (tabla de arriba) y cada rol que usa ese panel.

1. **Abrirlo de verdad.** Con cada rol que lo ve, en compu y celular, con datos
   y vacío (un gimnasio recién creado). Capturas en `.local/capturas/aud-<n>-*`.
2. **Inventario botón por botón** en `docs/paneles/<panel>.md`: una fila por
   cada botón, link, campo, filtro y acción, con: qué hace hoy · si anda
   (probado haciendo clic, no leyendo) · qué le falta para servir de verdad ·
   con qué otras pantallas y funciones se conecta · si es configurable por
   gimnasio y si debería serlo.
3. **Pensar lo que falta**, en cadena: "para hacer X el dueño necesita Y, y
   sin Y no anda Z". Qué botón falta, cuál sobra, cuál confunde, cuál debería
   estar al lado de cuál, qué atajo ahorra trabajo, qué debería poder
   personalizar cada gimnasio (textos, colores, orden, qué se muestra), qué
   necesita cada rol (por ejemplo: cambiar su contraseña, ver solo lo suyo).
4. **Arreglar ya** lo roto que sea chico (un botón que no hace nada, un texto
   que confunde, un desborde, un error sin salida), con su prueba.
5. **Lo grande va a la COLA**: ítems nuevos al final del bloque de ese panel
   (`- [ ] <SIGLA>-<n> · 🟢 · título`), con su detalle y su LISTO SI en
   "Detalle por panel". Si un ítem nuevo pide una decisión de permisos o
   plata, el agente la toma (la más prudente) y la anota en "Decisiones que
   tomó el agente".
6. **Un recorrido e2e que hace clic en cada botón** del panel
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

### PAG · Página del gimnasio

**PAG-1.** Editor en el panel de las secciones de la página (ya existen en la base, 0008: portada, planes, horarios, sedes, fotos, etc.): texto, foto, mostrar u ocultar, ordenar. Vista previa en vivo al costado (en celular, botón "ver cómo queda").
**PAG-2.** Estado de la página: borrador / publicada (si no está publicada, se ve "próximamente"). Botón publicar, link para copiar y compartir por WhatsApp, y Open Graph (título, descripción y foto al compartir el link).
**PAG-3.** Formulario "Quiero probar una clase" (nombre, celular, qué le interesa) → sección **Prospectos** en el panel: lista, estado (nuevo, contactado, vino, se hizo socio, no), WhatsApp armado y "convertir en socio" (abre el alta con los datos). Con límite contra spam.
LISTO SI (los tres): e2e de punta a punta (editar → publicar → un visitante deja sus datos → aparece en Prospectos → se convierte en socio).

### SOC · Socios

**SOC-1 · Importador.** Subir Excel (.xlsx) o CSV → elegir qué columna es qué (nombre, apellido, DNI, celular, mail, plan, vence el, nacimiento) → vista previa con errores marcados (DNI repetido, celular inválido, plan que no existe) → importar en un solo paso → resumen. **Deshacer** la importación completa durante 24 h. Al terminar, `analyze`. Los vencimientos importados se cargan como coberturas (hechos), nunca como un estado.
LISTO SI: 3.000 filas importadas en < 30 s, duplicados detectados, deshacer probado, pruebas de base.

**SOC-2.** Ficha en pestañas: **Resumen** (semáforo y por qué, plan, vence, packs, acciones grandes: cobrar, WhatsApp, editar) · **Pagos** · **Asistencia** (calendario del mes) · **Notas**.
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

### ADM · Super admin (BRIK)

**ADM-1.** Al crear un gimnasio, elegir su tipo (tabla de arriba): prende las secciones, el modo de clases y planes de ejemplo editables.
**ADM-4.** Salud por gimnasio: última vez que alguien del equipo entró, entradas y ventas de los últimos 7 días, socios activos, alerta si deja de usarse.

### SEG · Endurecer

**SEG-1.** Límite de pedidos de código por celular y por IP (base), con mensaje claro.
**SEG-2.** El dueño descarga todos los datos de su gimnasio (zip de CSV).
**SEG-4.** Medir cada pantalla con 3.000 socios (seed grande) y dejar todas por debajo de 1 s en el servidor; lo que no, índice o materialización.
**SEG-5.** Entrada sin internet: la recepción guarda una copia de quién puede entrar y sincroniza al volver. Grande; se diseña antes de codear.
