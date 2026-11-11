import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_GIMNASIO } from "@/lib/cookie-gimnasio";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// Cerrar sesión es un POST (un link GET lo podría disparar cualquier página).
export async function POST(req: NextRequest) {
  // El socio sale desde su app (/salir?a=socio) y vuelve a SU ingreso, no al del equipo.
  const destino = req.nextUrl.searchParams.get("a") === "socio" ? "/ingresar?modo=socio" : "/ingresar";
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  // Redirección relativa, resuelta por el navegador contra la dirección que está usando. Armarla con req.nextUrl
  // daba el host interno del servidor (localhost:PUERTO) cuando la app corre detrás de otra dirección, y el CSP
  // `form-action 'self'` frena un formulario cuya redirección sale de su origen: el botón Salir cerraba la sesión
  // pero la persona se quedaba mirando la pantalla (F1.2).
  const r = new NextResponse(null, { status: 303, headers: { Location: destino } });
  r.cookies.delete(COOKIE_GIMNASIO);
  return r;
}
