# 13 · Que nunca se rompa, nada pase dos veces y aguante miles

Mateo: "que nada se pueda hacer dos veces, que nada se rompa, que todo se
conecte bien con Supabase, que nada cambie de un día para el otro, que no se
caiga, que haya muchos clientes a la vez".

## 1. Nada pasa dos veces (idempotencia)

| Dónde | Riesgo | Regla |
|---|---|---|
| Todo botón que escribe | doble clic, Enter repetido, red lenta | El botón se deshabilita y muestra "Guardando…" hasta la respuesta; un segundo envío igual se ignora. Un solo componente `BotonAccion` para todo el panel. |
| Cobrar | dos compus cobran la misma cuota (REV-6a) | Cada intento de cobro lleva una **clave de operación** (uuid generado al abrir Cobrar). La base guarda la clave en la venta con unique por gimnasio: reintentar la misma operación devuelve la venta ya hecha. Distinta operación sobre la misma cuota del mismo período en < 2 min → aviso "ya se cobró hace 40 s (Sofi)" (frenar o no lo decide REV-6a). |
| Entrada | doble pasada | Ya resuelto en la base (lock + ventana, VD-3). |
| Alta de socio | dos altas del mismo DNI | Unique (gimnasio, DNI) + el alta ofrece la ficha existente. |
| Webhooks (MercadoPago) | aviso repetido | Ya: `eventos_webhook` por ID externo. |
| Avisos / WhatsApp en tanda | mandar dos veces | Marcado "ya avisado hoy" por socio y tipo. |
| Importar socios | correr el mismo archivo dos veces | Detecta duplicados por DNI y los muestra antes de importar (ya existe deshacer 24 h). |
| Acciones de la app del socio (reservar, pagar, cambiar de plan) | doble toque | Igual que el panel: deshabilitar + clave de operación en pagos. |

## 2. Dos personas a la vez (concurrencia)

- Cupos (clases, eventos, lugares): ya con unique/locks en la base; se
  revisa cada uno con dos sesiones simultáneas en la prueba de base.
- Editar lo mismo (ficha de socio, configuración, plan): guardar con
  "versión" (`actualizado_en`); si cambió desde que se abrió: "Sofi lo
  cambió hace 1 min — ver cambios / guardar igual". Nunca pisar en silencio.
- Caja: un turno abierto por persona y sede (unique parcial).
- Stock: descontar en la base con `stock = stock - n where stock >= n`
  (o permitir negativo con aviso, como hoy, configurable).

## 3. Nunca se pierde lo escrito ni se queda trabado

- Formularios largos (alta, plan, evento, configuración): borrador
  automático en el navegador por pantalla y usuario; al volver, "¿Seguimos
  donde dejaste?".
- Un error de la base vuelve como texto en el mismo lugar; los datos quedan
  (ya arreglado en el alta, extender a todos los formularios con
  `useActionState`).
- Toda pantalla tiene salida: Volver al origen, menú, y "Ir al inicio" en
  cualquier error (`error.tsx` y `not-found.tsx` con esos dos botones).
- Hojas flotantes (Entrada, Cobrar): si algo falla, el mensaje adentro y la
  hoja sigue abierta con lo cargado; Esc siempre cierra.

## 4. Que no se caiga y que no cambie de un día para el otro

- **Producción solo con todo en verde**: base + pantallas en GitHub, luego
  prevuelo y aplicar, luego merge (D25). Nunca un deploy a mano.
- **Migraciones aditivas** (regla de siempre): una pantalla vieja sigue
  andando con la base nueva mientras Vercel publica.
- **Monitoreo de errores** del lado del servidor y del navegador: Sentry
  (plan gratis) 🔌 — el agente deja la integración lista detrás de una
  variable; si no está, no hace nada. Errores de Vercel y Supabase
  revisados cada mañana (skill `manana`).
- **Backups**: Supabase Pro tiene backups diarios y recuperación a un
  momento (PITR, pago aparte). Recomendado pasar a Pro cuando haya
  gimnasios pagando (QUÉ CONFIGURÁS VOS). Además, exportar por gimnasio ya
  existe (`/panel/exportar`).
- **Estado de la plataforma** en el super admin (ya existe) + una página
  pública simple `/estado` (base responde, último deploy).
- **Límites**: tamaño máximo de archivos subidos, paginación en toda lista,
  rate limit en ingreso y códigos (ya hay límite de códigos), tope de filas
  en exportes por pedido.

## 5. Muchos gimnasios y miles de socios a la vez

- Toda consulta filtra por `gimnasio_id` con índice que empieza por
  `gimnasio_id` (chequeo en `npm run chequeos`: índice por gimnasio en cada
  tabla grande).
- Funciones de pantalla medidas con el demo grande (3.000 socios) y con
  **200 gimnasios** sembrados (script de carga): ninguna función de pantalla
  > 300 ms en la base.
- Conexiones: el panel usa la API de Supabase (PostgREST), no conexiones
  directas; los scripts usan el pooler.
- Fotos: Storage con tamaños chicos (redimensionar al subir: 800 px y
  webp), nunca imágenes originales de 5 MB en listas.
- Avisos en vivo por consulta cada 4 s **solo** con la pestaña visible, y
  la función devuelve poco (desde un momento).

## 6. Seguridad (además de RLS en todo, que ya está)

- Sesiones: ver dónde está abierta la cuenta y "cerrar en todos lados"
  (dueño, super admin, socio).
- Dueño y super admin: segundo factor opcional (código por mail o app)
  para entrar desde una compu nueva — 🟢 si Supabase MFA (TOTP) alcanza.
- Renuncia de alguien del equipo: "Quitar acceso" corta sus sesiones, su
  PIN y su turno; su historial queda.
- Contraseñas: mínimo 8, chequeo de filtradas si Supabase lo tiene
  prendido (QUÉ CONFIGURÁS VOS), recuperar por mail.
- Datos personales (Ley 25.326): exportar y anonimizar ya existen;
  "Política de privacidad" y "Términos" del gimnasio editables en la página
  y aceptados al registrarse.
