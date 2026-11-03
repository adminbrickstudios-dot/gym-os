import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_GIMNASIO, OPCIONES_COOKIE_GIMNASIO } from "@/lib/cookie-gimnasio";
import type { MiSesion } from "@/lib/panel/servidor";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// Elegir un gimnasio desde la dirección de la plataforma (lista de /elegir o
// del super admin). Solo se elige uno donde la persona es del equipo.
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const destino = req.nextUrl.clone();
  destino.search = "";
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("mi_sesion");
  const yo = data as MiSesion | null;
  if (error || !yo?.equipo.some((e) => e.slug === slug)) {
    destino.pathname = "/ingresar";
    return NextResponse.redirect(destino);
  }
  destino.pathname = "/panel";
  const r = NextResponse.redirect(destino);
  r.cookies.set(COOKIE_GIMNASIO, slug, OPCIONES_COOKIE_GIMNASIO);
  return r;
}
