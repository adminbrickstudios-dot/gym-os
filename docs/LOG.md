# Gym OS — Registro

Una entrada por capa cerrada, la más nueva arriba. Siempre con esta
estructura. `docs/ESTADO.md` es una copia local de este archivo y no se
commitea.

```
QUÉ HICE                        por punto, y cómo lo verifiqué
LO QUE ENCONTRÉ SIN PEDIRTELO   lo que apareció solo
QUÉ CORRÉS VOS                  comandos exactos, en orden
QUÉ CONFIGURÁS VOS              variables, paneles, DNS
SIN ARREGLAR                    lo que quedó, y por qué
LO QUE NO PUDE VERIFICAR        obligatorio, sin adornar
```

---

## 2026-11-04 · CFG-1 · Configuración en pestañas, todo explicado

**QUÉ HICE**
- Configuración en pestañas: 🏠 Gimnasio · 🎨 Marca · 🌐 Página · 💵 Cobros · 📏 Reglas · 🗓️ Clases (solo con clases prendidas) · 🧩 Secciones · 🔗 Dirección · 👥 Equipo (link). Cada campo con su línea de ayuda; cada pestaña con su Guardar (solo se prende con cambios) y "Guardado ✅". Lo escrito sobrevive al cambiar de pestaña, la pestaña con cambios queda marcada con •, y salir con cambios pregunta antes. `?pestana=cobros` abre directo (para mandar el link o para ONB-1).
- Migración `20261104002100_datos_gimnasio.sql`: `datos_gimnasio_panel` (dueño y encargado leen) y `guardar_datos_gimnasio` (solo el dueño): nombre, WhatsApp, Instagram, mail de contacto y, de cada sede, nombre, dirección, teléfono y mapa. Todo o nada, con errores que dicen qué dato y cómo escribirlo. Los teléfonos se aceptan como los escribe la gente y se guardan +54…; Instagram acepta "@usuario" o el link. Verificado: `supabase/pruebas/datos-gimnasio.test.mjs` (3 pruebas: guardar y normalizar, cada error, permisos: encargado lee y no guarda, recepción y otro gimnasio reciben error, nadie toca la sede de otro gimnasio). db:pruebas 175 en verde.
- Página: si está publicada, el link (bien armado desde la plataforma o desde la dirección del gimnasio), Ver mi página, Copiar link y Mandar por WhatsApp. Dirección: las direcciones del gimnasio y si el dominio propio ya funciona.
- `Pestanas`: pestaña con navegación completa (`recargar`) y marca de cambios sin guardar; en compu bajan de renglón en vez de cortarse.
- `scripts/e2e/panel-configuracion.mjs` reescrito para las pestañas (40 pasos). Verificado: `npm run e2e` completo en verde (17 + 14 + 40 + 120), capturas de compu y celular revisadas, `npm run verificar` en verde sobre base limpia, `npm run mapa` (67 funciones usadas, ninguna faltante).

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- `levantar.sh` no liberaba el puerto en este contenedor (lsof no ve los procesos; fuser sí): quedaba vivo un `next dev` viejo y el login de los e2e se colgaba. Ahora junta lo que encuentran las dos herramientas, fuerza si hace falta y, si el puerto sigue ocupado, lo dice y corta en vez de seguir.
- Las sedes no se pueden sumar ni cerrar desde el panel (solo editar las que existen, desde esta vuelta). Para un gimnasio con varias sedes hace falta. No lo agregué a la COLA porque no salió de una auditoría: queda acá para que lo sumes.
- `next dev` agregó `.next-dev/types` a `tsconfig.json` (por el cambio de carpeta de la vuelta anterior). Es inofensivo y va en el commit.

**QUÉ CORRÉS VOS**
- Actions → Base de datos → rama `noche/2026-11-04` → `prevuelo`, después `aplicar` (aplica la 0020 y la 0021).

**QUÉ CONFIGURÁS VOS**
- Nada.

**SIN ARREGLAR**
- Pestaña Mensajes: llega con CFG-5. Logo y fotos en Marca: CFG-2. Formas de entrada: CFG-6. Sumar o cerrar sedes: ver arriba.

**LO QUE NO PUDE VERIFICAR**
- `npm run db:types`: necesita el proyecto real de Supabase. Las dos funciones nuevas se llaman con `rpc()` tipado a mano en la pantalla, así que el build no depende de esos tipos, pero no está corrido.
- "Copiar link": en el navegador de prueba el portapapeles no tiene permiso, así que el botón está, pero copiar no está probado. "Mandar por WhatsApp" está probado hasta el link armado, no abriendo WhatsApp.
- La migración 0021 contra la base real: probada en la base local con las mismas migraciones.

---

## 2026-11-04 · AUD-1 · Auditoría botón por botón: Configuración

**QUÉ HICE**
- Abrí Configuración como dueña y como encargado, en compu y celular, e hice clic en cada muestra de color, interruptor, modo de clases, campo y Guardar. Inventario completo en `docs/paneles/configuracion.md` (cada elemento: qué hace, si anda, qué le falta, con qué se conecta).
- Migración `20261104002000_configuracion_validada.sql`: `guardar_configuracion` (misma firma) valida cada campo antes de escribir y dice qué campo y qué poner ("Días de tolerancia: tiene que estar entre 0 y 60"), en vez del error crudo de Postgres. Suma: alias de 6 a 20 caracteres, CBU con 22 números (limpia espacios y guiones, dice cuántos puso), nombre hasta 60 letras, no se pueden apagar las tres formas de cobro, no se puede dejar sin formas de entrada. Verificado: 20 casos nuevos en `supabase/pruebas/paneles.test.mjs` con sesión de dueño; db:pruebas 172 en verde.
- Configuración: cada bloque marca "• Cambios sin guardar", su Guardar solo se prende con cambios, el resultado aparece en el mismo bloque, el navegador avisa antes de irse con cambios, un número vacío ya no se guarda como 0, y los interruptores son el componente común con una línea que explica cada uno.
- Vender con Caja apagada no ofrece efectivo (antes pedía abrir una caja en una pantalla apagada).
- `scripts/e2e/panel-configuracion.mjs` (27 pasos), sumado a `npm run e2e`. Verificado: `npm run e2e` completo en verde (17 + 14 + 27 + 120), capturas revisadas, `npm run verificar` en verde sobre base limpia, `npm run mapa` sin cambios.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Con fondo claro (el crema del demo), los títulos y todo texto sin color propio salían casi blancos sobre crema en todas las pantallas del gimnasio: el texto se heredaba ya calculado del `:root` oscuro. Lo arreglé en `globals.css` (`[data-tono] { color: var(--texto) }`) porque bloqueaba revisar las capturas; afecta a todo el sistema, para bien.
- El alias del gimnasio demo (`GIMNASIO.DEMO.EJEMPLO`, 21 caracteres) no es un alias válido: pasó a `GYM.DEMO.EJEMPLO` en el seed.
- `npm run build` pisaba `.next` mientras corría `next dev` y la app local quedaba sin estilos ni scripts; y `levantar.sh parar` dejaba vivo el `next dev`. Ahora dev usa `.next-dev` (`NEXT_DIST_DIR`) y `levantar.sh` libera los puertos.
- Campos que la base ya guarda y ninguna pantalla muestra (formas de entrada, reingreso el mismo día, tres días de retención): CFG-6. Dependencias entre secciones: CFG-7. Historial de cambios: CFG-8. Contraste de colores: CFG-9. Las cuatro decisiones que tomé están en "Decisiones que tomó el agente".

**QUÉ CORRÉS VOS**
- Actions → Base de datos → rama `noche/2026-11-04` → `prevuelo`, después `aplicar` (aplica la 0020; si todavía no aplicaste la 0019 de main, va junto).
- Después, mergeás el PR.
- Si un gimnasio real tiene un alias de más de 20 caracteres, sigue guardado; solo al tocar Guardar en Transferencias le va a pedir uno válido.

**QUÉ CONFIGURÁS VOS**
- Nada.

**SIN ARREGLAR**
- CFG-6 a CFG-9, en la COLA con su LISTO SI.

**LO QUE NO PUDE VERIFICAR**
- `npm run db:types`: necesita el proyecto real de Supabase. La firma de `guardar_configuracion` no cambió y las funciones nuevas son de `privado`, así que los tipos no deberían cambiar, pero no está corrido.
- La migración 0020 contra la base real: está probada en la base local con las mismas migraciones (pre-vuelo, aplicada, pruebas), no en Supabase.

---

## 2026-11-04 · AUD-0 · Mapa de pantallas, funciones y conexiones

**QUÉ HICE**
- `scripts/mapa-pantallas.mjs` (`npm run mapa`): arma `docs/paneles/README.md` desde el código. Por cada ruta (y el middleware): quién la ve, qué sección la apaga, qué funciones de la base llama (incluidas las de los componentes compartidos que importa) y a qué pantallas lleva. Contra la base, lista las funciones habilitadas que ninguna pantalla usa.
- `npm run verificar` corre `mapa --verificar`: falla si una pantalla llama a una función que no existe en la base (un botón que se rompería en producción).
- Las vueltas regeneran el mapa al terminar (PROMPT, paso 7).
- Verificado: el mapa contra la base local (31 rutas, 65 funciones usadas, ninguna faltante) y `npm run verificar` en verde con el chequeo nuevo.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- 12 funciones de la base sin pantalla. Las que faltan de verdad pasaron a la COLA: anular una venta (VEN-6, `anular_venta`) y anular un presente (CLA-7, `anular_asistencia`). Pausas (`congelar`…), cierres (`crear_cierre`…) y cambio de plan ya estaban (SOC-9, CFG-4, PLA-6).
- `cobrar_cuota`, `precio_cuota`, `caja_abierta` y `asignar_plan` son de la primera versión del cobro y siguen habilitadas para el equipo sin pantalla. Toca permisos: no lo cambié al pasar. Queda como SEG-7 (confirmar que Vender las reemplaza y sacarles el acceso, nunca dar más).

**QUÉ CORRÉS VOS**
- Nada (sin migraciones).

**QUÉ CONFIGURÁS VOS**
- Nada.

**SIN ARREGLAR**
- Lo de arriba, en la COLA.

**LO QUE NO PUDE VERIFICAR**
- Contra la base real de Supabase: el mapa compara contra la base local con las mismas migraciones; si producción no tiene alguna migración aplicada, el chequeo no lo ve.

---

## 2026-11-04 · DIS-0 · Sistema visual común

**QUÉ HICE**
- Componentes que faltaban, en `src/components/ui/`: `Mensaje` (error, éxito, aviso, info; con role alert/status), `Vacio` (emoji, qué pasa, qué hacer), `Dato`, `Interruptor`, `Pestanas`. Clases nuevas en `globals.css`: `.boton-chico`, `.boton-texto`, `.mensaje-*`, `.fila`, `.pestanas`, `.interruptor`, `.vacio`, animación `subir` y `tilde`.
- Todos los errores y resultados hechos a mano (16) pasan a `Mensaje`; los botones chicos y de texto, a sus clases; las filas para elegir socio, a `.fila`.
- Estados vacíos con acción en Socios (y en la búsqueda sin resultados), Transferencias, Clases del día y la lista de una clase.
- Los 4 números de Inicio llevan a su detalle (si la sección está prendida).
- `docs/DISENO.md`: con qué se arma cada pantalla.
- Verificado: `scripts/e2e/dis-0.mjs` (14 pasos en compu y celu: vacíos con su acción, números que llevan a su detalle, error de ingreso con el componente común), `npm run e2e:admin` (17 pasos), barrido de las 15 pantallas con los 4 roles en compu y celu (120 pasos), `npm run verificar` en verde (171 pruebas de base, 40 unitarias, chequeos, lint, tipos, build). Capturas mirándolas.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- En Socios vacío había dos botones verdes (el de arriba y el del vacío): el del vacío pasó a normal (un solo principal por pantalla).
- Los números de Inicio tenían la etiqueta antes del número en el código; ahora el orden del HTML es el correcto (etiqueta y valor) y se ve igual que antes.

**QUÉ CORRÉS VOS**
- Nada para esta vuelta (sin migraciones).

**QUÉ CONFIGURÁS VOS**
- Nada.

**SIN ARREGLAR**
- Los vacíos secundarios (lista de entradas de hoy, últimas entradas de la ficha, actividades de la grilla, super admin) quedan como texto: se pulen en su DIS de cada panel.

**LO QUE NO PUDE VERIFICAR**
- `npm run db:types`: necesita el proyecto real de Supabase; el código está escrito según la documentación, pero no está ejecutado (esta vuelta no cambia la base).

---

## 2026-11-03 · Super admin completo, claves y gimnasios sin subdominio

**QUÉ HICE**
- **Por qué "no hacía nada" en producción:**
  - El gimnasio se creaba en `nombre.gym-os-pied.vercel.app`, y Vercel no da esos subdominios: el link no abría.
  - El admin no tenía cómo entrar a un gimnasio que no fuera suyo.
  - El dominio base iba crudo a la base (con `https://` o una barra, fallaba con "Dominio base no válido").
  - Un error después de crear (por ejemplo, sin la clave de servicio) rompía la pantalla sin decir nada.
- **Super admin (`/admin`):**
  - Estado de la plataforma: dominios, clave de servicio cargada y respondiendo (sin mostrarla), aviso de "sin dominio propio".
  - Alta de gimnasio con el resultado accionable: Entrar al panel, Equipo y claves, Ver su página. Todo error vuelve como texto.
  - Cada gimnasio: **Entrar al panel** (como "Soporte BRIK", queda en su equipo y el dueño lo ve), **Equipo, claves y direcciones**, **Ver su página** (`/g/<slug>`).
  - Detalle (`/admin/<id>`): equipo con mail y último ingreso, **nueva contraseña** para cualquiera (menos cuentas de BRIK), **dar acceso** a quien no tiene cuenta, sumar personas, sumar y quitar direcciones propias, dejar el equipo.
  - Cambiar la contraseña propia.
- **Claves del lado del dueño:** en Equipo, nueva contraseña para su equipo (no para otros dueños ni para Soporte BRIK) y dar acceso a quien no tenía. En `/ingresar`: "¿Te olvidaste la contraseña? Pedile una nueva al dueño (si sos el dueño, a BRIK)".
- **Sin subdominio:** `/g/<slug>` muestra la página del gimnasio desde la dirección de la plataforma y lo deja elegido (cookie, sin permisos); `/app` y el ingreso del socio usan ese gimnasio, igual que `/panel`. En el panel, "Cambiar de gimnasio".
- **La página del gimnasio no tenía cómo entrar el socio:** botón "💪 Soy socio" (y en la de "próximamente", socio y equipo).
- **Base, 0019:** `equipo.es_soporte`, `gimnasio_por_slug` con una dirección, `admin_gimnasios` (+ estoy adentro, dueños sin acceso), `admin_entrar/salir_gimnasio`, `admin_gimnasio`, `admin_agregar_persona`, `admin_agregar/quitar_dominio`, `cuenta_para_nueva_clave`, `persona_para_dar_acceso`. La base decide quién puede tocar la cuenta de quién; el servidor usa la clave de servicio recién después.
- **GitHub Actions → Base de datos:** `estado` (qué hay en producción, sin datos personales) y `sembrar-demo` (gimnasio demo con 300 socios ficticios).
- **Verificado:**
  - 8 pruebas de base nuevas (entrar/salir, quién cambia la clave de quién, direcciones, anon resuelve el slug).
  - `estado` corrido en producción: 18 migraciones, 1 super admin, un gimnasio "mi-gym" sin socios y con el dueño sin acceso (se creó, pero en una dirección que no abre).
  - Playwright con sesiones reales, 18 pasos: crear gimnasio con dueño → entrar como soporte → nueva contraseña (la vieja deja de servir, la nueva entra) → sumar recepción y darle acceso → sumar y quitar dirección → el dueño ve a Soporte BRIK y le cambia la clave a su recepción → página del demo por `/g/demo` → socio entra con código a la app desde la plataforma → `/g/no-existe` da 404.
  - Barrido de las 15 pantallas del panel con dueña, encargado, recepción y profe: ningún error de servidor.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Al "dar acceso", la pantalla se refrescaba y la contraseña recién creada nunca se mostraba (la persona ya figuraba con cuenta). Arreglado: el resultado se muestra primero.
- El workflow pegaba el mail de `hacer-admin` directo en el comando de la terminal. Ahora va por variable de entorno.
- `npm run lint` fallaba en `/elegir` (un `<a>` a `/admin`). Arreglado.

**QUÉ CORRÉS VOS** (al agente le bloquearon disparar `aplicar` contra la base real)
1. GitHub → Actions → **Base de datos** → Run workflow → `aplicar`. Termina con "Todo en verde".
2. Mismo botón → `sembrar-demo`, dominio `gym-os-pied.vercel.app` (gimnasio demo con 300 socios ficticios).
3. Opcional: `estado` para ver qué quedó.

**QUÉ CONFIGURÁS VOS**
- Vercel: `NEXT_PUBLIC_DOMINIO_BASE` y `NEXT_PUBLIC_DOMINIO_PLATAFORMA` sin `https://` ni barra (el super admin avisa si no).
- Para que el socio entre por celular en producción: un proveedor de SMS en Supabase → Authentication → Providers → Phone.

**SIN ARREGLAR**
- Suspender un gimnasio desde el super admin: la columna existe pero no corta nada. Qué debería bloquear (¿el panel?, ¿la puerta?) es una decisión de permisos y plata.
- Lo anotado el 02/11 sigue igual (permisos de la recepción para forzar entrada y anotar contactos, el profe sin buscar socios, presente sin anular, QR/kiosco, importador, MercadoPago).

**LO QUE NO PUDE VERIFICAR**
- `npm run db:types`: necesita `SUPABASE_PROJECT_ID` y el proyecto real; el código está escrito según la documentación, pero no está ejecutado.
- La migración 0019 en Supabase: pasó en la base local, no está aplicada en producción (paso 1 de arriba).
- Crear cuentas y cambiar contraseñas contra el GoTrue real de Supabase (`auth.admin.createUser` / `updateUserById`): probado con el imitador local; contra Supabase, el código está escrito según la documentación, pero no está ejecutado.
- El ingreso del socio por SMS en producción: no hay proveedor de SMS configurado.

---

## 2026-11-02 · S2–S10, S15 · Diseño oscuro y todos los paneles, probados con sesión real

**QUÉ HICE**
- **Diseño oscuro, modo gimnasio.**
  - Todo sale del fondo y del color principal de cada gimnasio (datos). Si el fondo es oscuro, los textos son claros y las superficies más claras; con un fondo claro, al revés.
  - Títulos en Archivo angosta y pesada, emojis en cada sección, colores de estado de los discos olímpicos.
  - Rehice la landing, la página de la plataforma y la de "no encontramos este gimnasio".
- **Login y panel.**
  - El middleware renueva la sesión y protege `/panel`, `/app` y `/admin`.
  - `/ingresar` tiene dos modos: equipo con mail y contraseña, socio con celular y código.
  - Barra lateral agrupada, con una línea que explica cada sección. Ctrl+K busca secciones y socios.
  - En el celular, cuatro principales abajo y el resto en el menú.
  - Inicio: saludo, accesos rápidos que cada persona elige, cuatro números según su rol, y "ahora y lo que sigue".
- **Pantallas.**
  - Entrada.
  - Socios: lista, alta, edición y ficha.
  - Vender, Caja (arqueo ciego) y Transferencias.
  - Vencen hoy y Retención.
  - Clases, con la grilla para armarlas.
  - Planes y precios, Equipo, Configuración y Mi cuenta.
  - App del socio y super admin de BRIK.
- **Base, 0012–0017.**
  - Colores oscuros por defecto.
  - Las funciones que leen los paneles.
  - Una caja por sede.
  - Precios del mostrador y vencen hoy.
  - Grilla de clases.
  - Cuentas del equipo.
  - App del socio.

  Todas validan rol y gimnasio, y fallan con un error, nunca con una lista vacía. 16 pruebas nuevas.
- **Para probar con sesión real, sin un Supabase:**
  - `scripts/local/supabase-local.mjs` imita las llamadas a funciones de PostgREST (el rol sale del JWT) y el login de GoTrue.
  - `levantar.sh` levanta todo; `usuarios-demo` crea los logins por la API de administración.
- **Probado con Playwright, logueado de verdad:**
  - recepción busca, ve el porqué y anota la entrada;
  - abre la caja con $5.000, cobra $22.000 en efectivo a un socio que no podía entrar (queda "Al día"), cierra contando $30.000 y ve "Sobran $3.000";
  - la dueña crea un plan;
  - la dueña suma a Lucas con contraseña provisoria; Lucas entra y la cambia;
  - la dueña apaga Caja y Lucas deja de verla, ni entrando por la dirección;
  - el admin crea "Olympo Gym" y la dueña nueva entra a su panel;
  - un socio entra con su celular y el código y reserva una clase;
  - la recepción entra a Retención y ve "no tenés acceso".
- **Verificado:**
  - `npm run verificar` con exit 0: 163 pruebas de base, 36 unitarias, chequeos, lint, tipos y build.
  - Base con 0001–0011 tal como se entregaron + 0012–0017 = 163/163.
- **GitHub Actions:**
  - "Base de datos" (prevuelo, aplicar, chequeos, hacer-admin), con el secreto `SUPABASE_DB_URL` y disparado a mano.
  - "Verificar" en cada push.
- **`docs/ARRANQUE.md`** rehecho: sin instalar nada en la compu.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- **Ningún gimnasio tenía caja.** No se podía abrir un turno ni cobrar en efectivo. 0014 crea una por sede (trigger) y completa las sedes que ya existen.
- **El login fallaba por dentro.** Redirigir desde la acción de login renderizaba `/panel` sin los encabezados del gimnasio. Ahora la acción devuelve a dónde ir y navega el navegador.
- **En producción, Next oculta el texto de los errores del servidor.** "No tenés acceso" se iba a ver como un error genérico. Cada pantalla corre en `intentar()` y muestra el mensaje de la base.
- **El resultado del arqueo desaparecía** al refrescar la pantalla, antes de que se viera. Ahora queda hasta tocar "Listo".
- **El socio leía "· avisale"** en su app: es la indicación para la recepción. `mi_socio` la saca, y el veredicto sigue siendo el de la puerta.
- **El profe veía "vencen hoy" y transferencias** en su inicio. Ahora ve sus clases, anotados y presentes.
- **La zona horaria estaba escrita a mano** en la app del socio. Ahora viene del gimnasio.

**QUÉ CORRÉS VOS**
- `docs/ARRANQUE.md`, pasos 1 a 4. Todo desde el navegador.

**QUÉ CONFIGURÁS VOS**
- GitHub: el secreto `SUPABASE_DB_URL`.
- Vercel: las cinco variables de `docs/ARRANQUE.md`.
- Supabase, para el ingreso de socios por celular: un proveedor de SMS (Twilio u otro) en Authentication → Providers → Phone.

**SIN ARREGLAR** (anotado; los tres primeros tocan permisos y no los cambié solo)
- **La recepción puede dejar pasar a cualquiera escribiendo un motivo, incluso a un suspendido.** ¿Debería poder forzar solo el dueño o el encargado, o nadie cuando hay suspensión?
- **La recepción no puede anotar "le escribí"** en Vencen hoy (`registrar_contacto` es solo de dueño y encargado). Le manda el WhatsApp pero no queda registrado.
- **El profe no puede buscar socios** para sumar a alguien que vino sin reservar (`buscar_socios` es del mostrador). En modo "sin reserva", su lista empieza vacía.
- No se puede anular un presente desde la pantalla: `lista_clase` no devuelve el id de la asistencia.
- Faltan:
  - QR del socio, kiosco y molinete;
  - PIN de recepción;
  - importador de socios;
  - editor de la landing y subida de logo y fotos;
  - MercadoPago;
  - rutinas;
  - avisos automáticos;
  - suscripción BRIK.
- Para "Sacar" un horario de la grilla, el confirm usa el diálogo del navegador. Funciona, pero no tiene el estilo.

**LO QUE NO PUDE VERIFICAR**
- Nada corrió contra un Supabase real. Login, sesión y funciones se probaron contra `supabase-local`, que imita PostgREST y GoTrue; el código está escrito según la documentación, pero no está ejecutado contra Supabase.
- Subir el comprobante desde la app y abrirlo con link firmado (Storage): el código está escrito según la documentación, pero no está ejecutado. La base local no tiene Storage.
- El SMS real del código: el código está escrito según la documentación, pero no está ejecutado. En local el código se lee de un archivo.
- Los workflows de GitHub Actions: el código está escrito según la documentación, pero no está ejecutado. Sí corrí localmente los mismos comandos que corren ellos (`aplicar`, `chequeos`, `hacer-admin`, build con las variables de ejemplo).
- El deploy en Vercel y `npm run db:types`: el código está escrito según la documentación, pero no está ejecutado.

---

## 2026-10-30 · S7 + S8 + S9 (base) · Caja, venta, retención y clases, con segunda revisión

**QUÉ HICE**
- **0009 caja y venta.**
  - Caja por turno: se abre con un monto y se cierra contando. Lo esperado se calcula y al cerrar queda la foto con la diferencia.
  - Carrito del mostrador: cuota, pase, pack, producto u otro. Acepta pagos mixtos que tienen que sumar exacto, y el precio siempre lo pone la base. La recepción tiene tope de descuento y el motivo es obligatorio.
  - Transferencia con comprobante: el socio la informa y el equipo la aprueba o la rechaza.
- **0010 retención.** Una sola consulta para todo el gimnasio.
  - Separa a los socios en vencido, por vencer, nuevo, no viene y se fue, con el porqué.
  - Muestra la frecuencia con que venía, la plata en riesgo, el mensaje armado desde plantillas editables y el último contacto.
- **0011 clases.**
  - Actividades y grilla semanal. Las clases se crean a demanda.
  - Reservas con cupo y lock, y lista de espera.
  - Presente con ventana horaria; se puede anular y devuelve la clase.
  - Packs que se descuentan por asistencia. Lista de la clase para el profe.
- **Segunda revisión independiente de 0009–0011.** Un agente que no había visto el código lo probó ejecutando y confirmó 21 errores. Los arreglé todos, cada uno con su prueba de regresión (`revision2.test.mjs`).
  - **Plata:**
    - se podía vender en efectivo en una caja que se estaba cerrando;
    - anular una venta de una caja ya cerrada le cambiaba el arqueo;
    - un turno de otra sede se aceptaba si no había efectivo;
    - la recepción podía reconstruir lo esperado con un SELECT, así que el arqueo no era ciego;
    - el mismo comprobante servía para dos pagos;
    - alguien del equipo podía aprobar su propio pago;
    - un 100% de descuento no se podía registrar;
    - el carrito aceptaba 50 cuotas.
  - **Retención:**
    - faltaban los que se anotaron y nunca pagaron, y los vencidos que cambiaron de plan;
    - un socio viejo que cambiaba de plan aparecía como "nuevo";
    - la deuda de los planes de varios meses no coincidía con la de la puerta;
    - sin precio cargado, el mensaje quedaba con un hueco.
  - **Clases:**
    - un pack se descontaba dos veces con dos presentes a la vez;
    - se descontaba aunque la membresía ya cubría la clase;
    - no respetaba sus actividades;
    - con 1 clase se reservaban varias;
    - cancelar una clase pasada devolvía clases de pack;
    - un cierre cargado después no cancelaba las clases ya creadas;
    - la lista de espera ascendía a socios suspendidos;
    - el presente no tenía ventana, ni chequeo, ni forma de anularse;
    - editar un horario duplicaba clases;
    - un login con varios socios veía la posición de otro;
    - la lista de la clase repetía gente;
    - una actividad no se podía quitar de un plan.
- **Carreras con dos conexiones reales** (`concurrencia-caja-clases.test.mjs`):
  - una venta en efectivo que llega mientras se cierra la caja espera y se rechaza, y no entra plata a un turno ya contado;
  - dos presentes a la vez con un pack de 1 clase dejan un solo consumo.
- **Verificado:** `npm run verificar` con exit 0. Incluye lint, tipos, 25 unitarias, **147 pruebas de base**, chequeos y build.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- **Había editado 0003 y 0007, que ya te había entregado en el zip.** Si las corriste en Supabase, esos cambios no te iban a llegar nunca: el aplicador saltea por nombre lo que ya registró. Además tocan permisos y plata. Lo resolví así:
  - Devolví 0003 y 0007 byte por byte a lo entregado y pasé los cambios a 0009.
  - Borro la firma vieja de `anular_venta`. Si convivían las dos, la llamada era ambigua.
  - 0009 verifica al final que no quedó la firma vieja ni la recepción leyendo pagos.
  - Probado: una base con 0001–0008 tal como se entregaron + las 0009–0011 nuevas queda con el mismo schema, políticas y permisos que una base desde cero, y las 147 pruebas pasan en las dos.
  - Lo agregué como regla 10 de migraciones en `CLAUDE.md`.
- **Retención con 3.000 socios.**
  - El commit anterior decía ~0,4 s, pero los arreglos (deuda igual a la de la puerta) la llevaron a 1,3 s.
  - La causa: Postgres copiaba `via_membresia` en cada `(vm).campo`, así que la llamaba varias veces por socio. Con la subconsulta materializada baja a **0,5 s**, con el mismo resultado byte por byte.
  - Con estadísticas viejas, recién cargados los datos, tardaba **11 s**. Supabase las actualiza solo, pero el importador de socios (S5) tiene que correr `analyze` al terminar. Anotado para S5.

**QUÉ CORRÉS VOS**
- Nada nuevo todavía. Cuando hagas `docs/ARRANQUE.md`, `npm run db:aplicar` aplica 0001–0011, o solo 0009–0011 si ya corriste el zip anterior.

**QUÉ CONFIGURÁS VOS**
- Nada nuevo.

**SIN ARREGLAR**
- Pantallas de caja, venta, retención y clases: esperan tus cambios de diseño.
- Los avisos (`avisos_pendientes`) quedan escritos pero nadie los manda todavía. Eso es S10/S14 (WhatsApp y push).

**LO QUE NO PUDE VERIFICAR**
- Bucket `comprobantes` y sus políticas de Storage: el código está escrito según la documentación, pero no está ejecutado. La base local no tiene el esquema `storage`.
- Nada de esto corrió contra un Supabase real, solo contra Postgres 16 con la simulación de roles y `auth.uid()`.
- `npm run db:types`: el código está escrito según la documentación, pero no está ejecutado.

---

## 2026-10-30 · S13 (primera parte) · Landing editable por gimnasio

**QUÉ HICE**
- **Migración 0008, landing.** La verifiqué aplicándola con pre-vuelo y con 8 pruebas. Tiene:
  - `landing_gimnasio`: portada, contacto y si muestra precios.
  - `landing_secciones`: 8 tipos (quiénes somos, actividades, planes, horarios, galería, profes, preguntas, ubicación), que se pueden ordenar, prender y apagar.
  - Validación del contenido de cada sección, con mensajes de error claros.
  - La función pública `landing_publica(host)`.
  - El bucket de Storage `marcas`, con políticas por carpeta del gimnasio.
  - Que cada gimnasio nuevo nazca con su landing armada.
- **Qué devuelve `landing_publica`:**
  - Sin publicar, solo la marca: la página dice "próximamente".
  - Publicada: los planes con su precio de lista vigente y las variantes más baratas ("$22.000 pagando en efectivo").
  - No devuelve nada de socios: una prueba lo comprueba buscando sus teléfonos y mails en la respuesta.
- **Permisos:** anon lee la landing solo a través de la función, nunca las tablas. Recepción no puede editarla; encargado y dueño sí.
- **Página en Next.**
  - Raíz por host: si es la plataforma muestra la página de Gym OS; si es un gimnasio, su landing.
  - Título, descripción y favicon por gimnasio.
  - Colores de la marca, con el color de texto del botón calculado por contraste.
  - Botón fijo de WhatsApp en el celular, con el mensaje armado. Cada plan tiene su "Lo quiero" con el nombre del plan.
  - Una sección vacía no se muestra.
  - Verificado levantando la app contra la base local y sacando capturas: Gimnasio Demo en celular y compu, Box Norte Demo con otra marca, y un gimnasio sin publicar.
- **Seed:** dos gimnasios demo con marcas distintas y landing completa. `--dominio` sirve para sembrarlos en el dominio real.
- **`docs/ARRANQUE.md`:** el paso a paso de GitHub, Supabase, Vercel y dominio.
- **Total verificado:** 88 pruebas de base, 25 unitarias, chequeos, lint, tipos y build en verde.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Las clases `.boton` y `.tarjeta` estaban fuera de una capa de CSS, así que le ganaban a las utilidades de Tailwind: `hidden` no ocultaba un botón en el celular. Las pasé a `@layer components`.
- Repetía el nombre del gimnasio dos veces arriba (en la barra y en una etiqueta). Saqué la etiqueta: lo vacío está vacío.
- `vitest` no resolvía el alias `@/`. Agregué `vitest.config.mts`.
- `npm run db:types` con `--db-url` necesita Docker. Ahora usa `--project-id` (`scripts/db/tipos.mjs`).

**QUÉ CORRÉS VOS**
- `docs/ARRANQUE.md`, pasos 1 a 4.

**QUÉ CONFIGURÁS VOS**
- Dominio, proyecto de Supabase, variables en Vercel. El detalle está en `docs/ARRANQUE.md`.

**SIN ARREGLAR**
- El editor de la landing en el panel. Necesita el login del equipo (S2): por ahora se edita con SQL o con el seed.
- Las fotos todavía no se suben desde la app. El bucket y sus políticas están, falta la pantalla.

**LO QUE NO PUDE VERIFICAR**
- El bucket `marcas` y sus políticas de Storage: el código está escrito según la documentación, pero no está ejecutado. La base local no tiene el esquema `storage`.
- La landing contra el Supabase real: se probó con un imitador local de su RPC.
- `npm run db:types` con `--project-id`: el código está escrito según la documentación, pero no está ejecutado.

---

## 2026-10-29 · S1 + base de S7 · Núcleo de acceso y cobro, en Postgres real

**QUÉ HICE**
- **Siete migraciones** (0001–0007). El detalle de qué tiene cada una está
  en `docs/SCHEMA.md` § Estado. Verificado así:
  - aplicadas con pre-vuelo contra Postgres 16;
  - re-ejecutadas enteras en una transacción para probar que son idempotentes;
  - `npm run chequeos` en verde.
- **Cálculo de acceso** (`privado.calcular_acceso`): una función por vía y
  una combinación en orden fijo.
  - **21 casos testigo**, un socio por cada respuesta posible. Son la misma
    fuente para el seed y para las pruebas.
  - Verificado con 80 pruebas de base.
  - Las pruebas detectan errores: con una expectativa cambiada a propósito, fallan.
- **Cobro de cuotas**:
  - precio por lista;
  - períodos con ancla en los tres modos de renovación;
  - `cobrar_cuota`, `anular_venta`, `cambiar_plan`, `dar_de_baja`.
  - Verificado con pruebas de cada modo y de los bordes de mes.
- **Compensación de días** por congelamiento y cierre, recalculada por
  trigger. Verificada con pruebas de orden (pagar antes o después de
  congelar), de superposición con un cierre y de anulación.
- **Concurrencia**: dos lecturas de QR casi simultáneas descuentan una sola
  clase. Verificado con dos conexiones reales, con y sin cobro del reingreso.
- **`npm run chequeos`**:
  - revisa contra la base: RLS, `gimnasio_id`, FK compuestas, timestamptz,
    numeric(12,2), `search_path`, lista blanca de EXECUTE, unique por
    gimnasio, sin TRUNCATE para clientes;
  - revisa en los archivos: sin TODO ni BEGIN en las migraciones, sin
    teléfonos con pinta de reales.
  - Verificado con una tabla y una función mal hechas a propósito: las detecta.
- **Gimnasio demo determinístico**:
  - 300 socios más los 21 testigos;
  - cuotas con su venta y su pago;
  - 90 días de ingresos en horarios pico;
  - teléfonos +549000…
  - Se siembra en ~4 s.
- **Rendimiento**, medido con 3.000 socios y 80.000 ingresos:
  - ingreso: ~9 ms;
  - búsqueda: <2 ms, usa el índice;
  - cierre de todo el gimnasio: ~0,5 s (era 21 s; se corrigió un filtro que no usaba el índice);
  - estado de los 3.000 juntos: ~2,6 s.
- **App**:
  - Next 15, middleware host → gimnasio, `/gimnasio-no-encontrado`.
  - Clientes de Supabase con `@supabase/ssr`.
  - `formatearPesos` y fechas en la zona del gimnasio, con 19 pruebas unitarias.
  - Probado levantando la app contra un PostgREST mínimo local:
    - plataforma → 200;
    - gimnasio → 200;
    - host desconocido → 404 con la dirección escrita;
    - header falso → descartado;
    - Supabase caído → 503 que lo dice.
- `npm run build` pasa.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Una **revisión independiente** encontró 17 errores confirmados
  ejecutando. Están todos corregidos, cada uno con su prueba de
  regresión en `supabase/pruebas/revision.test.mjs`. Los más graves:
  - pagar durante un congelamiento hacía perder casi todo el mes;
  - un congelamiento cargado antes de pagar no compensaba nunca;
  - la recepción podía congelar hacia atrás y regalar días;
  - el modo aviso dejaba pasar a un suspendido;
  - un socio dado de baja entraba en verde;
  - la recepción podía cambiar de plan con un UPDATE directo;
  - el día 31 se perdía al renovar;
  - en día fijo, la deuda mostrada era el doble de lo que se cobraba;
  - en efectivo se podía pagar más caro que con crédito;
  - el equipo podía leer el hash del PIN del dueño;
  - anon tenía TRUNCATE.
- **Las migraciones se reescribieron en el lugar**, no con parches,
  porque ninguna estaba aplicada en una base real. Desde el primer
  gimnasio real, eso ya no se puede.
- **Next quedó en 15.5**, no en 16 (que es la última): 16 renombra el
  middleware y no lo pude verificar acá. Actualizar es una decisión
  aparte.
- **`next/font/google` se sacó**: el build baja las fuentes de internet y
  falla sin red. Se usa la fuente del sistema.
- **El teléfono del socio no puede ser único**: las familias comparten número.
- **La investigación cambió prioridades**:
  - factura ARCA por cada cuota;
  - Wellhub ya está en Salta;
  - el refresh token de MercadoPago vence a los 6 meses;
  - el apto físico en Salta tiene una ordenanza de 2019 que no se encontró.
  - Todo está en `docs/requisitos.md` y en el doc del catálogo.

**QUÉ CORRÉS VOS**
```
git clone gym-os.bundle gym-os && cd gym-os && npm install
gh repo create gym-os --private --source=. --push
git log origin/main --oneline -3
```

**QUÉ CONFIGURÁS VOS**
- Comprar el dominio y crear el proyecto de Supabase (São Paulo).
- `.env.local` según `.env.local.example`. Después, `npm run db:prevuelo`
  y `npm run db:aplicar`.
- Copiar `2-LECCIONES.md` y `3-CONVENCIONES.md` a `docs/`.

**SIN ARREGLAR**
- **Listas de retención en lote**: `calcular_acceso` socio por socio tarda
  ~2,6 s con 3.000 socios. Alcanza para el barrio (79 ms con 300), no para una cadena.
- **Prorrateo al cambiar de plan**: la diferencia de precio no se cobra ni
  se devuelve. Es v1.5.
- **Cierres de una sola sede**: no compensan. El check lo impide, porque
  falta decidir qué planes alcanzan.
- **`descongelar`**: solo termina hoy. Una vuelta con fecha pasada la carga el dueño anulando y recreando.
- **Clases y reservas**: no están en el schema ni en el seed.

**LO QUE NO PUDE VERIFICAR**
- **Nada se aplicó en un Supabase real.** La base local simula los roles,
  `auth.uid()` y los permisos por defecto de Supabase. Supabase usa
  Postgres 15 o 17 y acá corrió 16.
- **`npm run db:types`**: está escrito según la documentación, pero no está
  ejecutado. La CLI de Supabase con `--db-url` necesita Docker.
- **El middleware contra el PostgREST real de Supabase**: el código está
  escrito según la documentación, pero no está ejecutado. Se probó con un
  imitador local.
- **Los permisos de `.claude/settings*.json` en una sesión real de Claude
  Code**: el código está escrito según la documentación, pero no está
  ejecutado.

---

## 2026-10-26 · S−1 · Archivos del repo y schema propuesto

**QUÉ HICE**
- `CLAUDE.md` con reglas, migraciones, definición de TERMINADO y
  reporte.
- `docs/SCHEMA.md`: schema completo propuesto, modelo de las tres vías
  de acceso, RLS, índices y preguntas abiertas.
- `docs/PLAN.md` como marcador: `7-PLAN.md` no estaba adjunto.
- `docs/requisitos.md`, `.env.local.example`, `.vercelignore`.
- `.claude/settings.json` (hook compartido + denegaciones),
  `.claude/settings.local.json` (permisos de este equipo),
  `.claude/hooks/bloquear-peligroso.mjs`.
- Hook verificado ejecutándolo: 28 comandos simulados contra un repo
  git de prueba (con remoto), 28 con el resultado esperado. Incluye
  `vercel --prod` limpio y pusheado (pasa), sucio (bloquea), con commit
  sin pushear (bloquea), y aplicar migraciones con y sin
  `.claude/BASE_CON_DATOS_REALES`.

**LO QUE ENCONTRÉ SIN PEDIRTELO**
- Los cinco documentos del proyecto no estaban adjuntos. Solo
  `B-ARCHIVOS-A-ADJUNTAR.md`.
- `LECCIONES` y `CONVENCIONES` solo viven en el proyecto de claude.ai:
  el agente que codea en el repo no los ve. Tienen que copiarse a
  `docs/LECCIONES.md` y `docs/CONVENCIONES.md`.
- `.claude/settings.local.json` es personal y queda fuera de git. Un
  hook de seguridad ahí no viaja con el repo. Se puso en
  `.claude/settings.json`.
- `create-next-app` se niega a correr en una carpeta con archivos que
  puedan chocar: primero se crea el proyecto, después se copian estos
  archivos.

**SIN ARREGLAR**
- `docs/PLAN.md` vacío hasta tener `7-PLAN.md`.
- `npm run chequeos`, `db:types`, `typecheck` todavía no existen: son
  parte de la primera sección de código.

**LO QUE NO PUDE VERIFICAR**
- El schema es una propuesta: no hay ninguna migración escrita ni
  aplicada.
- La sintaxis de permisos de `.claude/settings*.json` está escrita
  según la documentación de Claude Code, pero no está ejecutada dentro
  de una sesión real de Claude Code.
