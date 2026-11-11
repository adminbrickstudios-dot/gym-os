# Conectar el dominio de Base (U5)

Cuando Mateo compre el dominio (ejemplo: `midominio.com`), esto es todo lo que hay
que hacer. El agente no compra nada. Tarda unos minutos más lo que tarde el DNS.

## Cómo queda armado
- **La plataforma** (super admin, `/ingresar`, `/elegir`) vive en la raíz: `midominio.com`
  (y `www.midominio.com` va a lo mismo).
- **Cada gimnasio** vive en su subdominio: `gimnasio.midominio.com` (el super admin lo arma
  solo al crear el gimnasio: `slug.dominio`).
- **Un gimnasio con dominio propio** (`migimnasio.com.ar`) sigue andando: se agrega desde la
  ficha del gimnasio en el super admin y en Vercel → Domains.
- El código no tiene ninguna dirección `vercel.app` escrita: todo sale de las dos variables de abajo.
  La resolución por host está probada en `src/lib/host.test.ts`.

## Pasos (en este orden)
1. **Vercel → el proyecto → Settings → Domains → Add.** Agregá dos dominios:
   - `midominio.com`
   - `*.midominio.com` (el comodín: hace que cada gimnasio funcione sin tocar nada más).
2. **DNS** (donde compraste el dominio). Vercel te muestra los valores exactos al agregar;
   lo habitual es:
   - Registro `A` de `@` (la raíz) → `76.76.21.21`.
   - Registro `CNAME` de `*` → `cname.vercel-dns.com`.
   - Para que el comodín funcione, Vercel pide usar **sus nameservers** (`ns1.vercel-dns.com` y
     `ns2.vercel-dns.com`) en lugar de los del registrador. Es lo más simple: cambiás los
     nameservers una vez y Vercel maneja el resto (incluido el certificado del comodín).
3. **Variables de entorno en Vercel** (Settings → Environment Variables, entorno Production):
   - `NEXT_PUBLIC_DOMINIO_BASE` = `midominio.com`
   - `NEXT_PUBLIC_DOMINIO_PLATAFORMA` = `midominio.com`
   (sin `https://` ni barra final; si la pegás con eso, el código la limpia igual).
4. **Redeploy** del último deploy de producción (Deployments → los tres puntos → Redeploy).
   Las variables `NEXT_PUBLIC_*` se fijan al compilar: sin redeploy no cambian.
5. **Supabase → Authentication → URL Configuration**: Site URL = `https://midominio.com` y en
   Redirect URLs agregá `https://midominio.com/**` y `https://*.midominio.com/**`.
6. **Los gimnasios que ya existen** tienen su dirección vieja (`...vercel.app`). Para pasarlos al
   dominio nuevo: super admin → la ficha del gimnasio → cambiar la dirección (aparece el aviso de
   que la vieja deja de andar) y probar el link.
7. **Probar**: `https://midominio.com` (plataforma), `https://midominio.com/super` (con la cuenta
   de Mateo), `https://gimnasio.midominio.com` (la landing del gimnasio), `/ingresar` y `/panel`
   de ese gimnasio. En el super admin, "Estado de la plataforma" tiene que mostrar las dos
   variables en verde.

## Si algo no anda
- "Gimnasio no encontrado" con la dirección escrita: el gimnasio no tiene esa dirección cargada
  (ficha del gimnasio → direcciones) o el comodín todavía no propagó.
- Certificado inválido en un subdominio: el comodín no está en Vercel (paso 1) o falta cambiar los
  nameservers (paso 2).
- Entra a la plataforma pero el gimnasio no: revisá que `NEXT_PUBLIC_DOMINIO_BASE` sea la raíz y no
  un subdominio.
