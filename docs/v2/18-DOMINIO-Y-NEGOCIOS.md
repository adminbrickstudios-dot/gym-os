# 18 · El dominio y cada gimnasio separado de la plataforma

## Cómo queda (cuando Mateo compra el dominio, por ejemplo `gymos.com.ar`)

| Dirección | Qué es |
|---|---|
| `gymos.com.ar` | La página de Gym OS (para vender) e "Ingresar" |
| `gymos.com.ar/admin` | El super admin de BRIK |
| `olympo.gymos.com.ar` | La página del gimnasio Olympo, su panel (`/panel`) y la app de sus socios (`/app`) |
| `www.gimnasioolympo.com` | (Opcional) el dominio propio del gimnasio, apuntado a Gym OS (ya existe "Direcciones" en el super admin) |

Cada gimnasio queda **separado**: su dirección, su marca, sus datos (RLS por
gimnasio). Mientras no hay dominio, se entra por
`gym-os-pied.vercel.app/g/<nombre>`.

## Lo que hace Mateo (una vez)

1. Comprar el dominio **en Vercel** (Domains → Buy) — así el comodín
   (`*.dominio`) funciona sin tocar DNS.
2. Vercel → proyecto gym-os → Settings → Domains → agregar `gymos.com.ar` y
   `*.gymos.com.ar`.
3. Vercel → Settings → Environment Variables (Production):
   `NEXT_PUBLIC_DOMINIO_BASE=gymos.com.ar`,
   `NEXT_PUBLIC_DOMINIO_PLATAFORMA=gymos.com.ar` → Redeploy.
4. Supabase → Authentication → URL Configuration: Site URL
   `https://gymos.com.ar` y Redirect URLs `https://gymos.com.ar/**` y
   `https://*.gymos.com.ar/**`.
5. Si usa Google para ingresar: sumar las mismas direcciones en Google Cloud.
6. Decirle al agente "ya está el dominio": revisa que cada gimnasio responda
   en su subdominio y que el ingreso funcione.

**Antes de activar huella/Face ID (passkeys)**: el dominio tiene que ser el
definitivo (las passkeys quedan atadas al dominio).

## Crear un gimnasio nuevo (lo que Mateo va a hacer seguido)

1. Entrar a **`/admin`** (hoy `https://gym-os-pied.vercel.app/admin`; con
   dominio `https://gymos.com.ar/admin`).
2. **➕ Nuevo gimnasio** → tipo (plantilla) → nombre, dirección corta
   (`olympo`), logo y colores con vista previa → mail y celular del dueño.
3. Se crea la cuenta del dueño y aparece el **WhatsApp de bienvenida** con el
   link y la contraseña provisoria: mandarlo.
4. **Entrar a terminar de configurarlo** (como Soporte BRIK, con motivo) o
   dejar que el dueño siga los Primeros pasos: planes, forma de entrada,
   equipo, primer socio (o importar Excel), probar la Entrada.
5. Si es un cliente real: cuando ya tiene socios cargados, crear
   `.claude/BASE_CON_DATOS_REALES` (desde ahí las migraciones las aplica
   Mateo, no el agente).
