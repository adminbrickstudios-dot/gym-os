# Gym OS — Arranque paso a paso

Cinco pasos, en este orden. Cada uno termina con algo que se verifica.
Tiempo total: ~30 minutos. **No hace falta instalar nada en tu compu**:
todo se hace desde GitHub, Supabase y Vercel en el navegador.

Las claves **nunca** van por el chat: solo en GitHub (Secrets) y en Vercel.

---

## Paso 1 · El repo en GitHub (2 min)

github.com → New repository → `gym-os`, **privado**, **sin README ni nada**.

Pasale el nombre exacto (`tu-usuario/gym-os`) al agente: lo conecta y
sube todo desde su lado.

**LISTO SI:** en el repo se ven las carpetas `src`, `supabase`, `docs`.

---

## Paso 2 · Supabase (5 min)

1. supabase.com → New project.
   - **Región: South America (São Paulo)**.
   - **Contraseña de la base: solo letras y números.** Un `@` o un `#`
     rompe la cadena de conexión y el error no lo dice.
2. En el repo de GitHub → Settings → Secrets and variables → Actions →
   **New repository secret**:
   - Nombre `SUPABASE_DB_URL`
   - Valor: Supabase → Project Settings → Database → Connection string →
     **Session pooler** (pegá la contraseña donde dice `[YOUR-PASSWORD]`).
3. Aplicar las migraciones: en GitHub → **Actions** → **Base de datos** →
   **Run workflow** → `prevuelo`. Si sale en verde, otra vez con `aplicar`.
   **Nunca pegar SQL en el editor de Supabase**: rompe los acentos.

**LISTO SI:** el workflow `aplicar` termina en verde y el último paso
dice "Todo en verde".

---

## Paso 3 · Vercel (5 min)

1. vercel.com → Add New → Project → Import `gym-os`. Framework: Next.js.
2. **Antes de Deploy**, en Environment Variables:

| Variable | De dónde | Entornos |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | todos |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | misma pantalla → `anon` `public` | todos |
| `SUPABASE_SERVICE_ROLE_KEY` | misma pantalla → `service_role` | **solo Production** |
| `NEXT_PUBLIC_DOMINIO_BASE` | tu dominio, sin `https://` (ej: `gymos.com.ar`) | todos |
| `NEXT_PUBLIC_DOMINIO_PLATAFORMA` | donde vive el panel de BRIK (ej: `app.gymos.com.ar`) | todos |

   `NEXT_PUBLIC_*` se graba en el build: si la cambiás después, hay que
   **redeployar**.
3. Deploy.

**Sin dominio todavía:** poné en las dos `NEXT_PUBLIC_DOMINIO_*` el
`tu-proyecto.vercel.app` que te da Vercel (sin `https://` ni barra).
Vercel no da subdominios de `.vercel.app`, así que todo se usa desde esa
misma dirección:

- **Panel de un gimnasio:** super admin → **Entrar al panel** (entrás como
  "Soporte BRIK"). El dueño y su equipo entran en `/ingresar` con su mail.
- **Página del gimnasio y app del socio:** `/g/<dirección>` (ej:
  `/g/olympo-gym`). Desde ahí, "Soy socio" lleva a la app.
- **Una dirección propia gratis:** en Vercel → Settings → Domains sumá
  `olympo-gym.vercel.app` (si está libre) y cargala en el super admin →
  el gimnasio → Direcciones.

Para tener un gimnasio con datos y mostrarlo: Actions → **Base de datos** →
`sembrar-demo`, con el dominio `tu-proyecto.vercel.app`. Crea el "Gimnasio
Demo" con 300 socios ficticios.

**LISTO SI:** la dirección de Vercel muestra "Gym OS · Ingresar".

---

## Paso 4 · Tu usuario de super admin (3 min)

1. Supabase → Authentication → Users → **Add user** → con tu mail y una
   contraseña. Tildá "Auto Confirm User".
2. GitHub → Actions → **Base de datos** → Run workflow → `hacer-admin`,
   con tu mail.
3. Entrá a `https://<dominio de la plataforma>/ingresar` con ese mail.

**LISTO SI:** ves la pantalla "Gimnasios" y podés crear uno.

---

## Paso 5 · Dominio (cuando lo tengas, 10 min)

1. Comprarlo en Vercel (Domains → Buy) es lo más simple: el DNS queda
   en Vercel solo.
2. Vercel → el proyecto → Settings → Domains → agregar:
   ```
   tudominio.com
   www.tudominio.com
   *.tudominio.com
   app.tudominio.com
   ```
   El comodín necesita que el dominio use los nameservers de Vercel.
3. Cambiar `NEXT_PUBLIC_DOMINIO_BASE` y `NEXT_PUBLIC_DOMINIO_PLATAFORMA`
   y **redeployar**.

**LISTO SI:** creás un gimnasio desde el super admin y su dirección
(`nombre.tudominio.com`) muestra su página.

---

## Para que funcione todo (cuando lo necesites)

| Qué | Dónde | Para qué |
|---|---|---|
| Proveedor de SMS (Twilio u otro) | Supabase → Authentication → Providers → Phone | Que los socios entren con su celular y un código |
| Nada (lo crea la migración 0009) | Supabase → Storage → `comprobantes` | Que los socios suban el comprobante de transferencia. Verificá que el bucket exista después de aplicar |
| Nada (lo crea la migración 0008) | Supabase → Storage → `marcas` | Logos y fotos de la landing |

---

## Probar en tu compu (opcional)

Con Node 22 y un Postgres 15+ instalados:

```bash
scripts/local/levantar.sh nueva
```

Levanta la base, una imitación local de Supabase (login y funciones) y la
app con dos gimnasios demo. Abrí `http://demo.localhost:3123` y entrá a
`/ingresar` con `duena@ejemplo.invalid` / `demo-gymos` (los demás
usuarios los imprime al final).

---

## Cuando cargues el primer gimnasio real

Crear el archivo `.claude/BASE_CON_DATOS_REALES`. Desde ese momento el
agente escribe las migraciones y vos las corrés con el botón de Actions.
