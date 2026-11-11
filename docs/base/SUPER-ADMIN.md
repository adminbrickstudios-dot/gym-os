# Super admin de Base (08/11)

Pedido de Mateo: "un super admin mejor: ver y editar todo de cada gimnasio, y
los miles de detalles que faltan". Es el panel de BRIK para manejar muchos
gimnasios sin depender de que el dueño haga algo.

## Lo que ya existe (no se rehace)

`/admin` (y la puerta `/super`):
- Estado de la plataforma.
- Alta de gimnasio con plantilla por tipo y contraseña del dueño (BASE-2).
- Salud de cada gimnasio y uso semanal.
- Entrar como Soporte BRIK y salir.
- Equipo y claves.
- Direcciones (dominios).
- Marca.
- Abono a BRIK con planes, pagos y suspensión gradual.
- Novedades para dueños.
- Pedidos de demo.
- Ayudas con su bandeja.
- Notas internas.
- Métricas.

Funciones de base: `admin_*` (31).

## La idea que ordena todo

**Editar un gimnasio = entrar como soporte y usar su propio panel.** No se
copian las pantallas del dueño adentro de `/admin`: lo que el dueño puede hacer,
BRIK lo hace entrando como soporte, con las mismas funciones, los mismos
permisos de la base y el mismo registro. Así no hay un segundo camino con
`service_role` que se saltea las reglas, y cada cosa que se mejora en el panel
del dueño le sirve también a BRIK.

`/admin` es para lo que **solo BRIK** puede hacer:
- Ver todos los gimnasios juntos.
- Darlos de alta, pausarlos o darlos de baja.
- El abono.
- La plataforma.
- La auditoría.
- Lo que el dueño no puede tocar: el slug, el dominio, los módulos que paga y los límites de su plan.

## SA-1 · El tablero (Inicio del super admin)

- **Números de hoy:**
  - Gimnasios activos (alguien usó el panel hoy).
  - Entradas en toda la plataforma.
  - Cobrado por los gimnasios hoy.
  - Ingreso mensual de BRIK.
  - Abonos por vencer.
  - Ayudas sin responder.
- **"Necesitan atención"**, primero, cada uno con el motivo escrito y un botón para resolverlo:
  - Abono vencido.
  - Nadie entró en 3 días.
  - El alta sin terminar.
  - Errores en las últimas 24 h.
  - Webhooks de MercadoPago fallidos.
  - Caja sin cerrar hace días.
- **Actividad en vivo** de la plataforma: gimnasio nuevo, primer cobro de un gimnasio, ayuda nueva, error.

**LISTO SI:** cada número lleva a la lista que lo forma; con 200 gimnasios de carga
abre en menos de 2 s.

## SA-2 · La lista de gimnasios

- Buscar por nombre, ciudad, dueño, mail, teléfono o dominio.
- Filtros: salud (verde, amarillo, rojo), abono (al día, por vencer, vencido,
  en prueba), plan de BRIK, ciudad, fecha de alta, módulos prendidos.
- Columnas:
  - Nombre y ciudad.
  - Socios activos.
  - Entradas de hoy.
  - Último uso del panel.
  - Abono.
  - Salud.
  - Dueño.
- Fijar favoritos arriba.
- Por cada fila, botones directos: Entrar como soporte, Ficha, WhatsApp al dueño y Copiar links por rol.
- Exportar la lista.

## SA-3 · La ficha del gimnasio (todo de un local en una pantalla)

Pestañas:

| Pestaña | Qué tiene | Se edita desde |
|---|---|---|
| Resumen | Salud con su motivo, socios activos, entradas y cobros de las últimas 8 semanas, qué le falta del asistente, últimas acciones de soporte | — |
| Datos | Nombre, dirección, zona horaria, contacto, CUIT y razón social para la factura de BRIK, slug | El slug, acá (con aviso: cambia los links); el resto, entrando como soporte |
| Links | La dirección del gimnasio y el link de cada rol (`/dueno`, `/recepcion`, `/profe`, `/socio`), con botón de copiar y QR | — |
| Equipo | Cada usuario con su rol, último ingreso, activo o no | Acá: restablecer contraseña, desactivar, crear, **cambiar quién es el dueño** |
| Módulos y límites | Qué tiene prendido y qué incluye su plan de BRIK (socios máximos, sedes, página, app) | Acá |
| Abono BRIK | Plan, precio, descuento, pagos, próximo vencimiento, suspensión gradual | Acá |
| Integraciones | MercadoPago: conectado o no, último webhook recibido, webhooks fallidos con botón **Reprocesar** (idempotente). Nunca muestra las claves | Acá (probar y reprocesar) |
| Dominio | Direcciones, estado del DNS, certificado | Acá |
| Errores | Los últimos errores de ese gimnasio: pantalla, usuario, mensaje, cuándo | — |
| Registro | Todo lo que pasó, incluido lo que hizo Soporte BRIK (quién, qué, cuándo, motivo) | — |
| Notas | Notas internas de BRIK (el dueño no las ve) | Acá |

Socios, planes, clases, caja y página **no** se copian acá. Tienen un botón
"Abrir como soporte en esta pantalla", que entra directo a esa sección del panel
del gimnasio.

**LISTO SI:** e2e: desde la ficha se cambia el dueño, se restablece la contraseña
de la recepcionista, se apaga Clases y el panel deja de mostrarlas, y se
reprocesa un webhook fallido sin duplicar el cobro.

## SA-4 · Entrar como soporte (mejorado)

Ya existe. Se completa:
- **Motivo obligatorio** y elegir con qué rol entrar: dueño, recepción o profe.
  Así BRIK ve exactamente lo que ve cada uno.
- **"Ver la app como este socio"**: busca un socio y abre su app en modo solo
  lectura. Sirve para "el socio dice que la app le dice que debe".
- Un marco de color en toda la pantalla: "Estás en Olympo como Soporte BRIK
  (recepción) · motivo · Salir". Vence a los 60 minutos.
- **El dueño lo ve**, en su campana y en Control: "BRIK entró a ayudarte:
  motivo".
- **Plata del gimnasio:** como soporte se ve todo. Cobrar, anular y tocar la
  caja **no** se permite, salvo que el dueño lo haya pedido: hay que escribir
  "lo pidió el dueño" en el motivo, y queda marcado en Control.

## SA-5 · Buscar a cualquiera

Una búsqueda (Ctrl+K en `/admin`) por mail, DNI o teléfono en **todos** los
gimnasios: devuelve el gimnasio, el rol y un botón para entrar como soporte en
su ficha. Sirve para "me escribió alguien que no puede entrar y no sé de qué
gimnasio es".

Toca datos personales de todos los gimnasios:
- Pide motivo.
- Queda registrado.
- Muestra solo nombre, gimnasio y rol hasta que se entra.

## SA-6 · Alta, lanzamiento y baja

- **Alta**: lo que existe. Se suma:
  - Clonar la configuración de otro gimnasio (planes, reglas, clases), sin sus socios.
  - Cargar los socios por el dueño, con Excel y vista previa.
- **Lista de lanzamiento** por gimnasio:
  - Dueño entró.
  - Asistente terminado.
  - Primer socio, primer ingreso, primer cobro.
  - Página publicada.
  - MercadoPago conectado.
  - Al lado de cada paso, un botón para mandarle por wa.me lo que le falta.
- **Pausar**: el gimnasio no se puede usar y muestra "pausado, hablá con BRIK".
  No se borra nada.
- **Dar de baja**:
  1. Primero exporta todo (zip con CSV de socios, pagos, ingresos y planes).
  2. Después queda 30 días en "para borrar", y se puede restaurar.
  3. El borrado final pide escribir el nombre del gimnasio y solo lo puede hacer el super admin principal.
- **Papelera**: lo que un gimnasio quita (un socio dado de baja por error, un plan
  o una clase archivados) se puede restaurar desde la ficha por 30 días. Los
  hechos de plata no se borran nunca: un cobro anulado se corrige con un hecho
  nuevo, como hoy.

## SA-7 · Lo de BRIK: abonos y ventas

- Ingreso mensual, gimnasios nuevos y bajas por mes, y cuánto paga en promedio un gimnasio.
- Recordatorio del abono por wa.me con el monto y el link de pago.
- Prueba gratis de Base para un gimnasio nuevo: días, y qué pasa al terminar.
- Descuentos por gimnasio, con motivo y fecha de fin.
- **Demo para mostrar**: un botón "Crear demo para una reunión" que arma un
  gimnasio `[demo]` aparte, con datos ficticios y el nombre del interesado. A
  los 7 días queda "vencida" (se calcula, no hace falta un cron): deja de
  abrirse y aparece en "Borrar demos vencidas". Un gimnasio `[demo]` sí se
  puede borrar entero, porque no tiene datos reales. Esto destraba ADM-5.
- Factura electrónica (ARCA): 🔌, cuando Mateo tenga el servicio.

## SA-8 · Comunicación

- Novedades a dueños (ya existen). Se suma:
  - A quién: todos, por plan, por ciudad, por módulo.
  - Cuántos la vieron.
- Aviso de mantenimiento programado: una franja en todos los paneles con la hora.
- "Qué hay de nuevo" en el panel del dueño, armado con esas mismas novedades.

## SA-9 · Plataforma

- Estado:
  - La base.
  - Storage.
  - El último deploy y su commit.
  - Las migraciones aplicadas y la última.
  - La región.
- Errores de las últimas 24 h de toda la plataforma, agrupados por pantalla.
- Webhooks fallidos de todos los gimnasios, con Reprocesar.
- Uso por gimnasio: fotos y archivos subidos, socios, ingresos. Sirve para ver
  quién se acerca a los límites de su plan.
- **Funciones a prueba por gimnasio**: prender una función nueva solo en un
  gimnasio para probarla antes de dársela a todos.

## SA-10 · Seguridad y auditoría

- Segundo factor obligatorio para entrar a `/admin` (TOTP de Supabase).
- **Varios usuarios de BRIK con roles**:
  - Principal: todo.
  - Soporte: entrar como soporte, ayudas y buscar.
  - Ventas: demos, altas y abonos, sin entrar a los gimnasios.
  - Solo lectura.
- Registro de todo lo que hace cada usuario de BRIK. **Nadie lo puede borrar**:
  solo se agregan entradas.
- Sesiones abiertas de un gimnasio, con "Cerrar todas" (para cuando un empleado se va mal).
- Aviso cuando alguien entra a `/admin` desde un lugar o un equipo nuevo.

## SA-11 · Datos personales (Ley 25.326)

- **Pedido de datos de un socio**: exportar todo lo de un socio en un archivo,
  o borrarlo. El borrado deja los pagos con el nombre tachado, porque la plata
  tiene que cuadrar.
- Exportar un gimnasio entero, en el formato que se usa también para la baja.
- Estado de las copias de seguridad (depende del plan de Supabase, D51).

## SA-12 · Detalles chicos

- Ctrl+K en `/admin`: gimnasios, personas y acciones ("crear gimnasio", "entrar a olympo").
- En celular anda todo, para resolver algo desde la calle.
- Copiar con un toque: links por rol, mail del dueño, WhatsApp de bienvenida.
- QR del gimnasio para imprimir: el de la pared y el de la página.
- Cada número del tablero y de la ficha lleva a su lista.
- El color de salud siempre con su motivo escrito, nunca un punto solo.
- Fechas relativas ("hace 3 días") con la exacta al pasar el mouse.
- Vacío dice qué hacer: "Ningún gimnasio con abono vencido".
- Diseño de Base (`DISENO.md`): claro, íconos de línea, sin emojis.

## Orden

1. **Primero (lo que hace falta para manejar los primeros gimnasios):**
   - SA-3 Ficha con Links, Equipo y Módulos.
   - SA-4 Soporte con rol y motivo.
   - SA-5 Buscar a cualquiera.
   - SA-2 Lista.
   - SA-1 Tablero.
2. **Después:**
   - SA-6 Alta, lanzamiento y baja.
   - SA-3 Integraciones, Errores y Registro.
   - SA-11 Datos personales.
   - SA-10 Segundo factor y roles de BRIK.
3. **Más adelante:**
   - SA-7 Abonos y ventas.
   - SA-8 Comunicación.
   - SA-9 Plataforma.
   - SA-12 Detalles chicos (se van haciendo con cada uno).

Cada SA-* se cierra como un bloque del P0:
1. Base → lógica → pantalla → e2e con sesión real.
2. Publicar.
3. Anotar en `PROGRESO.md`.

Lo que toca permisos (SA-4 plata, SA-5, SA-10) lleva una prueba de base por rol.
