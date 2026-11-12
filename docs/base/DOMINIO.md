# Conectar los dominios de Base (D1 y D2)

Dominios comprados por Mateo (12/11): **`pasegym.com`** y **`templegymsalta.com`**. El agente no compra
ni cambia nada en Vercel, Supabase ni DNS: los pasos de abajo son de Mateo.

## Cómo queda armado
| Dirección | Qué es |
|---|---|
| `pasegym.com` | La plataforma: `/ingresar` (ingreso de todos) y `/super` (Mateo). `www.pasegym.com` va a lo mismo. |
| `<slug>.pasegym.com` | Cada gimnasio nuevo (el super admin lo arma solo al crearlo). Ej.: `templegym1.pasegym.com`. |
| `templegymsalta.com` | El dominio propio de Temple Gym: su landing, su alta (`/hacete-socio`), su ingreso y su panel. `www.templegymsalta.com` redirige a este. |
| `gym-os-pied.vercel.app` | **La dirección vieja.** Redirige con 308 permanente a `pasegym.com`, con la misma ruta y los mismos parámetros, y de ahí a la dirección propia del gimnasio. Es la del QR impreso: no se rompe nunca. |

La cadena del QR impreso (probada con el proxy real en `src/lib/dominios-nuevos.test.ts`):

`gym-os-pied.vercel.app/g/templegym1/hacete-socio` → `pasegym.com/g/templegym1/hacete-socio` → `templegymsalta.com/hacete-socio`

Lo mismo con `/g/templegym1` (la landing), `/ingresar` y `/privacidad`, y con `www.templegymsalta.com`.

Cada cuenta entra solo a lo suyo, desde cualquier dirección (lo decide la base por la sesión, no la dirección):
el mail del dueño de Temple Gym entra a Temple Gym desde `templegymsalta.com`, desde `templegym1.pasegym.com`
y desde `pasegym.com/ingresar`; un mail de otro gimnasio no entra nunca (pruebas `fase-u3` y `fase-u02`).
Los botones de la landing (alta, ingreso, perfil) son relativos: llevan al alta, al ingreso y al perfil del gimnasio de esa dirección.

## Cuándo
**Fuera de la hora pico de Temple Gym: entre las 22 h y las 16 h** (mejor a la mañana temprano). No empieces hasta que
arriba de `PROGRESO.md` diga **"LISTO PARA CAMBIAR LOS DOMINIOS"** (significa que el código nuevo, con la lista de
direcciones viejas y las pruebas, ya está publicado). Todo junto tarda unos 30 minutos más lo que tarde el DNS.

## Pasos, en este orden (el orden importa)
1. **Vercel → el proyecto → Settings → Domains → Add.** Agregá cinco:
   `pasegym.com`, `*.pasegym.com`, `www.pasegym.com` (que redirija a `pasegym.com`),
   `templegymsalta.com` y `www.templegymsalta.com` (que redirija a `templegymsalta.com`). **No saques `gym-os-pied.vercel.app`**: tiene que seguir apuntando al proyecto para poder redirigir.
2. **DNS** (donde compraste cada dominio). Vercel muestra los valores exactos al agregar:
   - `pasegym.com`: lo más simple es cambiar los nameservers a `ns1.vercel-dns.com` y `ns2.vercel-dns.com` (hace andar el comodín `*.pasegym.com` y su certificado).
   - `templegymsalta.com`: registro `A` de `@` → `76.76.21.21` y `CNAME` de `www` → `cname.vercel-dns.com` (o también los nameservers de Vercel).
   - Esperá a que Vercel muestre los cinco dominios con el tilde verde. **No sigas antes**: si los dominios no responden, lo que sigue rompe el QR impreso.
3. **Variables de entorno en Vercel** (Settings → Environment Variables, entorno **Production**), las tres juntas y sin `https://` ni barra final:
   - `NEXT_PUBLIC_DOMINIO_BASE` = `pasegym.com`
   - `NEXT_PUBLIC_DOMINIO_PLATAFORMA` = `pasegym.com`
   - `NEXT_PUBLIC_DOMINIOS_VIEJOS` = `gym-os-pied.vercel.app` (la lista de direcciones viejas que redirigen; si hubiera más, separadas por coma). **Sin esta variable el QR impreso da "gimnasio no encontrado".**
4. **Redeploy** del último deploy de producción (Deployments → los tres puntos → Redeploy). Las variables `NEXT_PUBLIC_*` se fijan al compilar: sin redeploy no cambian. Esperá el verde.
5. **Supabase → Authentication → URL Configuration:**
   - Site URL = `https://pasegym.com`
   - Redirect URLs (agregá todas): `https://pasegym.com/**`, `https://*.pasegym.com/**`, `https://templegymsalta.com/**`, `https://www.templegymsalta.com/**`. Dejá por unos días la de `gym-os-pied.vercel.app/**` (después se puede sacar).
6. **Recién ahora, super admin (`https://pasegym.com/super`) → la ficha de Temple Gym → direcciones:** agregá `templegymsalta.com` (propio) y `templegym1.pasegym.com` (subdominio). *No antes del paso 4:* en cuanto el gimnasio tiene dirección propia, `/g/templegym1/…` redirige ahí.
7. **Probar** (abrir, sin crear ni cobrar nada):
   - `https://gym-os-pied.vercel.app/g/templegym1/hacete-socio` → termina en `https://templegymsalta.com/hacete-socio` con la marca de Temple Gym.
   - `https://www.templegymsalta.com` → `https://templegymsalta.com`.
   - `https://templegymsalta.com`, `https://templegym1.pasegym.com` y `https://pasegym.com/g/templegym1`: la página de Temple Gym.
   - `https://pasegym.com/ingresar`: el ingreso de todos; `https://pasegym.com/super` (con tu cuenta).
   - En `/super` → Estado de la plataforma: las variables en verde.
8. **El equipo de Benja vuelve a iniciar sesión una vez** en `templegymsalta.com` (la sesión es por dirección: la de `gym-os-pied.vercel.app` no pasa sola). Los socios que tengan la app instalada en el celular, también entran una vez de nuevo.

## Volver atrás (si algo falla)
Devolvé las tres variables a lo de antes (`NEXT_PUBLIC_DOMINIO_BASE` y `NEXT_PUBLIC_DOMINIO_PLATAFORMA` = `gym-os-pied.vercel.app`, `NEXT_PUBLIC_DOMINIOS_VIEJOS` vacía), Redeploy, y en la ficha de Temple Gym sacá las dos direcciones nuevas. El QR impreso vuelve a andar como hoy.

## Si algo no anda
- "Gimnasio no encontrado" con la dirección escrita: el gimnasio no tiene esa dirección cargada (ficha → direcciones, paso 6) o el DNS todavía no propagó.
- El QR impreso dice "gimnasio no encontrado": falta `NEXT_PUBLIC_DOMINIOS_VIEJOS` o no se hizo el Redeploy (pasos 3 y 4).
- Certificado inválido en un subdominio: falta `*.pasegym.com` en Vercel o no se cambiaron los nameservers (pasos 1 y 2).
- Entra a la plataforma pero el gimnasio no: `NEXT_PUBLIC_DOMINIO_BASE` tiene que ser la raíz (`pasegym.com`), no un subdominio.
- Un mail que no es del gimnasio dice "ese mail no tiene cuenta en <gimnasio>": es lo esperado, cada cuenta entra solo a lo suyo.
