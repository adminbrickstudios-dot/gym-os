# Plataforma: direcciones, login y gimnasios (PLAT, 09/11)

Pensada para miles de gimnasios, como Vercel Platforms. Mateo compra el dominio
el 10/11; acá lo llamamos `<dominio>`. Los pasos para conectarlo están en
`DOMINIO.md`.

## PLAT-01 · El mapa de direcciones

| Dirección | Qué muestra |
|---|---|
| `<dominio>` | La página de venta de Base |
| `app.<dominio>` | El login universal y todos los paneles: super admin, dueño, encargado, recepción y profe |
| `<slug>.<dominio>` | La web pública del gimnasio y el ingreso de sus socios (la app del socio) |
| Dominio propio del gimnasio | La misma web pública, sacada de la tabla de dominios |
| `gym-os-pied.vercel.app` y `/g/<slug>` | Siguen andando mientras tanto. Cuando esté el dominio, redirigen a la dirección nueva |

Las puertas por rol (`/dueno`, `/recepcion`, `/profe`, `/socio`, `/super`)
siguen andando en cualquier dirección del gimnasio. Llevan al login con su
marca.

## PLAT-02 · Login universal del equipo

Una sola pantalla: `app.<dominio>/ingresar`, y mientras tanto `/ingresar`. Al
entrar, se buscan los gimnasios de esa persona:
- **Ninguno**: "Tu usuario no tiene un gimnasio asignado. Escribinos.", con el
  WhatsApp de BRIK.
- **Uno**: va directo a su panel, según su rol.
- **Varios**: elige el gimnasio (`/elegir`, que ya existe).

Desde `/g/<slug>/ingresar`, desde una puerta por rol o desde el dominio propio,
el login muestra el logo y el color del gimnasio, y es **el mismo login**. Si
la persona no es de ese gimnasio, se lo dice claro: "Tu usuario no es del
equipo de X". El socio entra desde la web de su gimnasio.

## PLAT-03 · Cómo el proxy encuentra el gimnasio

En este orden: dominio propio → subdominio → `/g/<slug>` → si no hay ninguno,
página 404 de la plataforma.
- **Nunca** cae a un gimnasio por defecto ni al demo. Es la lección de
  yadeportes: el login rebotaba porque el respaldo caía al club demo.
- La resolución queda en caché, sin consultar la base en cada pedido, y se
  invalida al cambiar los dominios.

## PLAT-04 · Ninguna dirección escrita a mano

Toda dirección se arma con un helper (`urlGimnasio`, `urlPanel`, `urlIngreso`).
Se reemplaza cada `"/ingresar"`, `"/panel"`, host o slug escrito a mano, y un
chequeo en `npm run chequeos` falla si aparece uno nuevo.

## PLAT-05 · Dominios desde el super admin

1. Se carga el dominio y se agrega a Vercel por su API. Necesita `VERCEL_TOKEN`
   en Vercel, que lo carga Mateo.
2. Se muestran los registros DNS exactos que hay que cargar.
3. Se verifica, con estado en semáforo: pendiente, verificado o error.
4. El SSL es automático.

⛔ hasta que Mateo compre el dominio y cargue el token. Queda todo listo para
que sea cargarlo y esperar.

## PLAT-06 · Variables de entorno

Dominio de la plataforma, URLs y claves por entorno. Ninguna en el código. Una
lista en el "Estado de la plataforma" de `/super` confirma que producción y la
vista previa apuntan al Supabase correcto: compara el `ref` del proyecto de la
URL con el de la clave de servicio, sin mostrar ninguna clave.

## PLAT-07 · El demo, aparte

El gimnasio demo está marcado `es_demo`, aislado, y nunca se usa como respaldo
de nada.

## PLAT-08 · Errores de login honestos

A la persona, un mensaje humano según el caso:
- mail o contraseña mal,
- cuenta sin confirmar,
- sin gimnasio,
- usuario desactivado,
- demasiados intentos (cuándo puede volver a probar),
- falla de configuración ("No pudimos verificar tu cuenta. Avisale a BRIK").

En el registro del servidor queda el código real de Supabase, nunca la
contraseña.
