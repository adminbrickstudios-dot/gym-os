import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_GIMNASIO } from "@/lib/cookie-gimnasio";
import { clasificarHost } from "@/lib/host";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { dominioBase, dominioPlataforma } from "@/lib/dominios";
import { rutaGimnasio } from "@/lib/urls";

// Cerrar sesión es un POST (un link GET lo podría disparar cualquier página).
// H3b: el socio (el formulario manda a=socio) vuelve a la página de su gimnasio, no al login del equipo. El equipo vuelve a /ingresar.
export async function POST(req: NextRequest) {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  let destino = "/ingresar";
  const form = await req.formData().catch(() => null);
  if (String(form?.get("a") ?? "") === "socio") {
    const clase = clasificarHost(req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "", dominioBase(), dominioPlataforma());
    if (clase.tipo === "gimnasio") destino = "/";
    else {
      // Desde la dirección de la plataforma el gimnasio sale de la cookie: su página es /g/<slug>. Sin cookie, el ingreso del socio.
      const slug = req.cookies.get(COOKIE_GIMNASIO)?.value;
      destino = slug && /^[a-z0-9-]{1,42}$/.test(slug) ? rutaGimnasio(slug) : "/ingresar?modo=socio";
    }
  }
  // Redirección relativa, resuelta por el navegador contra la dirección que está usando. Armarla con req.nextUrl
  // daba el host interno del servidor (localhost:PUERTO) cuando la app corre detrás de otra dirección, y el CSP
  // `form-action 'self'` frena un formulario cuya redirección sale de su origen: el botón Salir cerraba la sesión
  // pero la persona se quedaba mirando la pantalla (F1.2).
  const r = new NextResponse(null, { status: 303, headers: { Location: destino } });
  r.cookies.delete(COOKIE_GIMNASIO);
  return r;
}
