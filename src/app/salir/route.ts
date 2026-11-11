import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_GIMNASIO } from "@/lib/cookie-gimnasio";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// Cerrar sesión es un POST (un link GET lo podría disparar cualquier página).
export async function POST(_req: NextRequest) {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  // Redirección relativa, resuelta por el navegador contra la dirección que está usando. Armarla con req.nextUrl
  // daba el host interno del servidor (localhost:PUERTO) cuando la app corre detrás de otra dirección, y el CSP
  // `form-action 'self'` frena un formulario cuya redirección sale de su origen: el botón Salir cerraba la sesión
  // pero la persona se quedaba mirando la pantalla (F1.2).
  const r = new NextResponse(null, { status: 303, headers: { Location: "/ingresar" } });
  r.cookies.delete(COOKIE_GIMNASIO);
  return r;
}
