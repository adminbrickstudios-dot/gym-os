# Pase 1.0 → Pase 2.0 (Mateo, 15/11)

Mateo, textual: *"Hay que terminar PASE 1.0, para después hacer Pase 2.0, donde vamos a cambiar y hacer
mejoras de estructura, de diseño, de métodos, de landing, de fluidez, de cosas que estamos pasando por
alto."*

**Pase 1.0** es lo que un gimnasio necesita para usarlo todos los días sin problemas:
- entrar, cobrar, dar de alta y la caja;
- la página del gimnasio, el socio con su cuenta y su QR;
- el super admin.

Lo que es mejorar, rediseñar o pulir a fondo está marcado **➡️ Pase 2.0** en `RECTA-FINAL.md`. Para
cerrar 1.0, un ➡️ cuenta como cerrado, igual que ✅ y ⛔.

## Ya hecho y publicado en 1.0 (no se rehace)

- **La página del gimnasio en una pantalla** (L1, Lighthouse celular 94).
- **"Quiero ser socio" con la cuenta gratis y DNI obligatorio** (L2).
- **La app del socio sin pagar con el QR bloqueado**, que se activa solo cuando la recepción cobra (L3,
  PR #23).
- **El origen de cada alta con conversión** (N4).
- **La barrita del DNI y los avisos de QR** (E1, E2).
- **La velocidad, primera parte** (E8): Configuración de 30 viajes a 6, Inicio de 29 a 6, Planes de 23 a 4.

## Lo que faltaba para cerrar Pase 1.0 (cerrado: queda de registro; el estado de cada punto, en `PROGRESO.md`)

1. **Publicar lo que está en la rama**, fuera de 16–22 h: N10 (migración 20261114180000) y lo que se
   cierre en esta vuelta.
2. **Pase en todo lo que ve la gente** (D69): panel, app del socio, super admin, mails, títulos, manifest,
   página de la plataforma. Antes, una búsqueda de "Base" en `src/`: lo que es nombre del producto se
   cambia; lo que es palabra común ("base de datos") no. Va con una prueba que falla si el nombre del
   producto vuelve a aparecer escrito a mano: el nombre sale de un solo lugar.
3. **Q1 y F4.1** según D70: las opciones recomendadas que no cambian plata ni quién la ve, cada una con su
   prueba de base. Las demás pasan a ➡️ 2.0 con la recomendación escrita.
4. **F1.4 vuelve a 🟡 hasta mirar las capturas.** Se miran una por una (claro y oscuro, compu y celular),
   y se vuelve a correr el barrido de modales sin la hoja de Cobrar, que nunca se corrió así.
5. **Cerrar la velocidad con lo medido.**
   - E8: Configuración e Inicio todavía hacen 6 viajes. Se baja lo que se pueda sin rehacer pantallas; lo
     que quede, ➡️ 2.0 con su número en `VELOCIDAD.md`.
   - F0.2: igual, con lo medido.
   - Desde ahora, una prueba en `npm run chequeos` que falla si una pantalla supera los viajes que tiene
     hoy: nunca más lento que hoy.
6. **Los chicos a medias:** P2 (ninguna dirección escrita a mano), D4 (la alerta de webhooks fallidos), F1.3
   y F1.7 (cerrarlos con lo que ya está en verde).
7. **F5.1 y Q3:** lo que falta pasa a la cadena e2e completa. De FALTANTES, solo lo que rompe o bloquea el
   uso diario; lo grande, ➡️ 2.0.
8. **El QR de Temple Gym.** Cuando Mateo prenda las altas online:
   - probar `/g/templegym1/hacete-socio?o=qr` de punta a punta en producción, solo mirando, sin crear
     socios en Temple Gym;
   - en un clon `[demo]`, el mismo camino creando la cuenta.
   Si las altas siguen apagadas, queda ⛔ con el paso exacto.
9. **Los documentos en orden** (sin crear documentos nuevos):
   - `00-LEEME.md` como índice real: lo vigente arriba; lo histórico marcado como tal.
   - Ninguna contradicción entre documentos: Base/Pase, D40/D56 cerradas con D62, estados de
     `RECTA-FINAL` que digan la verdad.
   - `ESTADO-GENERAL.md` al día.
10. **F8.2:** la cadena e2e en verde, en tandas de 20 como máximo, con la base nueva en cada tanda.
11. **El cierre (F8.5):**
    - "LISTO PARA TU PASADA" arriba en `PROGRESO.md`, con el resumen de lo que se cerró.
    - `PRUEBA-DUENO.md` listo.
    - La sección "Para Pase 2.0" de abajo completa y priorizada.
    - La entrada final en `docs/LOG.md`.
    - La última línea: `TERMINADO`.

## Lo de Mateo (solo esto · cierre para vender, 25/11)

1. **`COPIA_CLAVE` (urgente: no hay copia de la base desde el 18/11).** El workflow *Copias* falla todas las noches porque falta ese secreto. *Recomendación:* generá 32 caracteres al azar en tu gestor de contraseñas, guardalos ahí y cargalos en GitHub → Settings → Secrets and variables → Actions → Secrets → `COPIA_CLAVE`. Después corré *Copias* a mano: cifra la copia, la restaura en una base de prueba y compara. Pasos en `COPIAS.md`. Las tres publicaciones del 25/11 se aplicaron SIN COPIA con tu permiso.
2. **Pista Semáforo en Temple Gym.** La llave `pista_semaforo` de Temple Gym figura prendida desde el 25/11 a las 15:50 ART (junto con `landing_nueva`, `aviso_vencimiento`, `vuelto_efectivo` y `panel_pago`, una por una desde el panel); el agente no la tocó. *Recomendación:* si fuiste vos, miralo un día con Benja en la recepción y en la tablet; si no fuiste vos, apagala desde Configuración → Funciones nuevas (o /super → ficha) y avisá: se vuelve a ver como antes al instante.
3. **Supabase Pro y Vercel Pro.** *Recomendación:* Supabase Pro antes del segundo gimnasio pago (copias automáticas con restauración a un punto del tiempo, sin pausa por inactividad); Vercel Pro antes de cobrarle a alguien (el plan Hobby no permite uso comercial).
4. **Términos y privacidad.** La página de venta trae un **borrador** de términos del servicio y de política de privacidad (Ley 25.326). *Recomendación:* que los lea un abogado antes de publicar la página de venta; el texto está en `src/components/landing/PlataformaNueva.tsx` (TERMINOS y PRIVACIDAD).

## Para Pase 2.0 (no se empieza hasta que Mateo lo diga)

Ordenado por lo que más importa. Todo lo de acá cuenta como cerrado para Pase 1.0.

### 0. Lo que sigue después de Pista (orden de Mateo, 18/11; NO se empieza antes de la fecha)

**(1) Borrar el estilo clásico y dejar todo super liviano. Arranca el 26/11 si Temple Gym no volvió a clásico.** Va en **dos publicaciones** (expandir y contraer):
- *Publicación A (solo código; la base no cambia):* Pista pasa a ser el único estilo. Archivos: `src/app/globals.css` (los tokens y los componentes clásicos: Pista sube a base y desaparece el bloque `html[data-estilo="pista"]`; los `!important` sobre el `--fondo` en línea ya no hacen falta), `src/lib/marca.ts` (`propsMarca` sin las variables del clásico), `src/app/layout.tsx` (sin `data-estilo`; el `data-modo` se queda), `src/proxy.ts` (sin la cabecera `x-gimnasio-estilo`), `src/app/panel/configuracion/EstiloMarca.tsx` + `estilo-acciones.ts` (queda solo el modo), `src/app/admin/[id]/FichaExtra.tsx` (`EstiloGimnasioFicha` queda solo con el modo), `scripts/e2e/comun.mjs` (`E2E_SIN_MAYUSCULAS` pasa a ser siempre), `scripts/e2e/inventario-pantallas.mjs`, `scripts/local/levantar.sh` y los workflows (`ESTILO_DEMO`, `estilo`), `scripts/medir/pista-produccion.mjs` y `.github/workflows/pista-produccion.yml`, y las fuentes que el estilo clásico usaba y Pista no (revisar `src/app/fuentes/`).
- *Publicación B (una semana después, migración nueva; la anterior no se edita):* sacar la columna `configuracion_gimnasio.estilo`, las funciones `guardar_estilo_gimnasio`, `admin_guardar_estilo` y `estilo_gimnasio`, y la columna `estilo` de `gimnasio_por_host` y `gimnasio_por_slug` (la vieja se borra en la misma migración); `modo` se queda. Con su vuelta atrás y `npm run db:types`.
- *La prueba de antes (se guarda antes de tocar nada):* las capturas `inv-pista-*` del inventario (compu y celular, oscuro y claro), el inventario clásico-contra-Pista en verde, las 254 e2e en las dos llaves, `scripts/medir/js-rutas.mjs` y `chunks-panel.mjs` (el JS y el CSS por ruta de hoy), el tope de viajes, y Lighthouse de la página del gimnasio (93). Después de cada publicación: lo mismo, y el CSS y el JS por ruta tienen que ser **menores** que antes (el objetivo es más liviano, no igual).

**(2) Seguridad.** ✅ Primera vuelta hecha el 22/11 (vuelta final: gitleaks sobre toda la historia, secretos en el JS publicado, cabeceras, cookies, webhook, grants a anon; el detalle en `PROGRESO.md` arriba). Lo que quedó: un inventario de lo que hay que revisar, sin tocar permisos ni plata hasta que Mateo decida: lo que salga de la auditoría del 18/11 (ver "Lo que encontró la auditoría" en `PROGRESO.md`), los permisos de `PERMISOS.md` contra lo que ve cada rol en pantalla, los logs públicos de Actions (que no impriman nombres de gimnasios ni mails), las claves y secretos de Actions, y las funciones que ve `anon`.

**(3) Profesionalización** (en este orden, y no se empieza nada de esto sin que Mateo lo diga): landing de venta (✅ armada el 22/11 detrás de `landing_venta_nueva`; cuando existan, sumarle débito automático, factura ARCA, Wellhub/TotalPass e importar desde otro sistema: hoy NO se nombran porque no existen), débito automático (`DEBITO-AUTOMATICO.md`), alta del gimnasio sola, y Resend y Sentry al final.

### 1. Plata y permisos (D70): ✅ decidido por Mateo el 25/11: van las recomendaciones de abajo

**Decisión de Mateo (25/11, tarea "Cierre para vender"):** cada fila de estas dos tablas queda como dice su recomendación. Para la 1.0 todo queda como está: sin bonos ni porcentajes de profes (P7) y la factura ARCA pasa a Pase 2.0 (R5). No se programa nada de plata en la 1.0. Lo que una recomendación dice "hacerlo" (por ejemplo, el estado de cuenta de solo lectura o la aprobación comparando el monto) queda para Pase 2.0 con esa recomendación como diseño. Detalle en `PREGUNTAS.md` (25/11).


Cada una cambia cuánto se cobra, a quién, o quién ve o mueve plata; por eso el agente no las hizo solo. El detalle y el porqué de cada una están en `PREGUNTAS.md`.

| Qué | Recomendación |
|---|---|
| Pase diario en 2 toques y para quien no es socio (detalle 13, Z6) | Alta rápida de socio con nombre y DNI + el pase, todo en una operación de la base y por el mismo camino de cobro |
| Pagos parciales (24) | No hacerlo: el fiado con tope cubre el caso |
| Cambio de plan prorrateado o al próximo período (26) | Dejar lo de hoy (días a favor con vista previa) y no ofrecer la opción |
| Matriz de permisos editable (43) | Dejar los interruptores de hoy (Equipo → Permisos) |
| Estado de cuenta único con saldo (21) | Una vista de solo lectura de cargos y pagos del socio, con los mismos permisos que la ficha |
| Link de MercadoPago por socio (33) | Cuando el gimnasio cargue sus credenciales |
| Aprobar una transferencia comparando el monto | Mostrar "Debe $25.000 (Mensual)", amarillo si no coincide, y Deshacer por 5 segundos |
| Deshacer en gastos | Confirmar con el monto a la vista y Deshacer por 10 segundos (anular el hecho, no borrarlo) |
| `equipo.es_soporte` en lugar del nombre "Soporte BRIK" | Leer la columna, no el nombre (hoy un empleado con ese nombre queda afuera de su panel) |
| "Entrar como soporte" con rol Encargado | Solo con el permiso del dueño y con tiempo |
| `profe_id` en `clases_del_dia` | ✅ Hecho el 19/11 (paneles completos): se devuelve solo al equipo y la grilla compara el id (`clase-ajena-profe-id`) |
| Decisiones de la COLA: REF-2, REV-1d, COM-6b, COM-8b, COM-9b | La opción recomendada de cada una en `PREGUNTAS.md` |

**Los 💲 de "Paneles completos" (19/11, inventario en `ESTADO-GENERAL.md` § Paneles completos).** Andan y tienen prueba; lo que queda es de plata y no se tocó:

| # | Qué | Recomendación |
|---|---|---|
| S3 | El monto que ve el socio al pagar por transferencia o link (hoy: el precio del plan, o el de transferencia si el plan lo tiene) | Dejarlo así para 1.0; con deuda de varios meses, mostrar "Debe $X" con el mismo cálculo de la puerta (`calcular_acceso`), nunca otro cálculo en TypeScript |
| S10 | Renovar desde la app (hoy renueva el mismo plan al precio vigente) | Dejarlo así; el cambio de plan con prorrateo sigue como dice la fila "Cambio de plan" de arriba |
| P7 | Reglas de cuánto se le paga al profe (hoy: por hora o por clase, fijo) | No sumar porcentajes ni bonos en 1.0; la liquidación de hoy (`vd-52`) alcanza para Temple Gym |
| R5 | Pagos parciales, estado de cuenta, prorrateos, matriz de permisos, ARCA | Las filas de arriba; ARCA a Pase 2.0 |
| R3b | `borrador_alta` (borrador del alta completa) | Prenderla en Temple Gym después de probarla un día en producción: guarda lo escrito, no mueve plata |
| — | `vuelto_efectivo` (cuánto devolver en la hoja Cobrar) | Prenderla: solo muestra una resta, el cobro queda igual; probar antes un cierre de caja con ella prendida |

### 2. Velocidad (números de hoy, 15/11, app compilada, dueña; tope guardado en `scripts/medir/topes-viajes.json`)

- **App del socio: `/app` hace 22 viajes y `/app/clases` 8.** Es lo más lento que queda y lo abre el socio desde el celular: un lote como el del panel.
- **Caja 9 (recepción 8), Prospectos 9, Entrada 7, Inicio 6, Configuración 6, Mensajes 6.** El piso de toda pantalla del panel es 3. Prospectos y Configuración repiten `contexto_pantalla` (la pantalla se arma dos veces).
- JS del layout del panel: 71,0 KB gzip; promedio por ruta 245,9 KB. Siguiente paso: partir lo que el layout baja en toda ruta.
- Lo fino: F0.4, F0.5 y la medición en producción (F0.1, ⛔ por los secretos).
- Cada baja se anota bajando el tope (`ACTUALIZAR_TOPES=1` solo baja).

### 3. Estructura, diseño, métodos, landing y fluidez (lo que nombró Mateo)

- Pulido profundo: Z3 a Z7, F3.2, F6.1.
- La landing nueva: ✅ armada el 22/11 (las dos, detrás de su llave; ver Lo de Mateo). Lo que sigue: el rediseño de lo que se está pasando por alto.
- El plan de profesionalización (`docs/PLAN-PROFESIONALIZACION.md`, cuando Mateo diga "terminado oficialmente").

### 4. Funciones nuevas (apagadas por defecto, detrás de su llave)

Entradas sin internet (N9), débito automático (N1), resumen de la noche (N3), factura ARCA (N7), molinete (N8).

### 5. Escala y plataforma

- Escala: F9.4, F9.6.
- Ensayo antes de producción (N0) y dominios desde el super admin (P9).
- Revisión: la cola vieja (Q4) y la prueba de todo junto (R3).

### 6. Lo que se encontró durante 1.0 y no es de 1.0

- **Lo que salió de "Lo de Mateo" el 25/11** (Mateo pidió dejar solo cuatro): los secretos `BRIK_ADMIN_MAIL`/`BRIK_ADMIN_CLAVE` (sesión de super admin para Actions), `DEMO_CONTRASENA`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CLAVE_PRUEBA_MATEO` y `SUPABASE_REF_ESPERADO` (los tipos de la base ya salen sin `SUPABASE_PROJECT_ID`: acción `tipos` de *Base de datos*); la variable `SALUD_URL`; `landing_venta_nueva` desde /super; SPF/DKIM con Resend; la pasada visual y `PRUEBA-DUENO.md`.
- **Cierre para vender (25/11), lo que quedó afuera:**
  - `casi_lleno_pct` (el umbral de "Casi lleno" de Clases) vive en datos con 85 por defecto, pero no tiene pantalla para cambiarlo.
  - 💲 "Cobrado hoy" del Inicio suma los cobros sin turno de caja y el Cierre del día no los lista (toca plata: no se arregló; `r1-numeros` lo aparta con su motivo).
  - 🔐 `admin_crear_gimnasio` y `admin_alta_gimnasio` piden super admin (`soy_admin_plataforma`) y no miran el rol de BRIK: alguien de BRIK con rol `lectura` podría dar de alta (toca permisos: no se arregló).
  - `docs/base/pista/semaforo/inicio-panel.png` sigue mostrando la casilla de "Para hacer hoy" (el HTML ya no la tiene; la captura no se pudo regenerar en esta compu).
  - El importador le pone el 9 a todo `+54` de 10 cifras: un teléfono fijo escrito con `+54` queda como celular.
  - Intermitentes de Caja en el clásico: `vd-9` (espera "Faltaban $50") y `caj-4` (se colgó 50 min después de abrir el ticket); las dos pasaron al volver a correr.
- **No hay recorrido que pruebe activar la tablet (`/kiosco/activar`) ni la TV (`/tv/activar`)**; en 1.0 esas dos rutas pasaron a armar su dirección con `origenDe` (P2) y solo las cubre la lectura del código y el tipado. Escribir `kiosco-activar` y `tv-activar`.
- **La cámara de QR no se abre en el barrido de modales** (pide permiso del navegador): se revisó por código (X visible) pero no con captura. Hace falta un permiso simulado en Playwright.
- **El barrido de modales falla a veces con `net::ERR_ABORTED` o un `waitFor` agotado en la compu** (navegación pisada por otra del panel); ya reintenta, pero conviene entender la causa.
- El link de referido del socio (`Referir`) ahora sale de `urlDeHost`, que saca el puerto: en local con puerto el link queda sin puerto (en producción no cambia nada).
- `producto.test.ts` deja pasar "Pase diario" y "Pase libre" (son planes, no el producto): si algún día el producto cambia de nombre otra vez, hay que revisar esa excepción.
- Los mails de Supabase (invitación, recuperar contraseña) se escriben en el panel de Supabase, no en el código: revisar que digan Pase (⛔ de Mateo, ver `PRUEBA-DUENO.md`).
- Los documentos viejos dicen "Base" a propósito (histórico); no se reescriben.
- **Cuadre de Pase 1.0 (15/11, contra los 10 documentos de pedidos):** unas 245 filas revisadas contra el código: 159 ✅ con prueba, 65 🟡, 7 🔴 y 14 ➡️. Lo de uso diario que faltaba se hizo (foto en el panel lateral, últimas entradas que abren el panel, número del menú que quedaba viejo, "Probá una clase"). Lo que sigue, de menor a mayor importancia:
  - El asistente de 9 pasos no se abre solo la primera vez (D80); hoy es una tarjeta en Inicio.
  - Notas y "cuándo le toca pagar" detrás de una función apagada (D81): decidir cuándo prenderla por gimnasio.
  - Caja, transferencias y mensajes se actualizan cada 30 s y no con Realtime; solo la puerta es instantánea.
  - Listas largas (Socios, Vencen hoy, Control) sin virtualizar; la ficha del socio no se midió (el agente de la auditoría contó 22 consultas, sin verificar).
  - `error.message` crudo en algunos mensajes al usuario (landing, tablet, super admin): pasar por `errores-humanos.ts`.
  - "Con solo QR el DNI no deja entrar" (SF-3b) sin prueba en la puerta.
  - La región de Supabase sin confirmar (VELOCIDAD.md) y la medición en producción (F0.1, ⛔).
  - Interesado sin contactar en 24 h dentro de Para hacer hoy (FA-13) y la oferta con plazo de la lista de espera (FA-23).
  - La prueba social, "¿Primera vez? Empezá acá" y la barra de WhatsApp de la portada: los componentes siguen en el código pero la portada de una pantalla (L1) no los dibuja; `vd-25` quedó apartado de la cadena e2e hasta la landing nueva.
- **El número del menú quedaba viejo** al contestar un mensaje o aprobar (un pedido "fresco" reusaba uno en vuelo): arreglado en 1.0 (`vivo-cliente.test.ts`); si aparece algo parecido en otra pantalla, es el mismo patrón (un pedido compartido que no distingue lo anterior de lo posterior a una acción).
- **`ent-6` (QR de la tablet en la puerta) apartado de la cadena e2e por intermitente:** pasó 2 de 4 corridas con la app compilada; cuando falla, el socio ve "entró" en su app (la entrada se registra) pero el cartel "¡Pasá, …!" de la tablet no aparece en 30 s (la tablet pregunta cada 1,5 s con una acción del servidor, `Kiosco.tsx`). Hay que encontrar por qué una de dos veces no lo ve y volver a meterlo en la cadena.
- **La lista de clases para probar de la página solo muestra clases que ya existen** (`clases_para_probar` lee `public.clases`, y las clases de cada día se crean al abrirlo, `materializar_dia`): en un gimnasio donde nadie abrió los próximos días, el formulario "Probá una clase" no ofrece clase y queda el pedido de siempre (no se rompe, pero ofrece menos). Arreglo de Pase 2.0: crear los próximos 7 días desde la grilla al consultar (la función de lectura es `stable`: hay que hacerlo en una escritura aparte). Los recorridos `vd-51` y `com-12` ya crean los días ellos mismos (eran los que fallaban según el orden de las tandas).
- **Recorridos que dependían del orden de la cadena** (corrían bien en serie y fallaban al arrancar una tanda con la base nueva): `vd-51`, `com-12` y `soc-14`; ya son deterministas. Si aparece otro así, el patrón es el mismo.
