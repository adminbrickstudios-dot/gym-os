import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_GIMNASIO, OPCIONES_COOKIE_GIMNASIO } from "@/lib/cookie-gimnasio";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// El super admin entra al panel de un gimnasio como "Soporte BRIK". La base
// valida que sea admin, exige el MOTIVO (el dueño lo ve en su Control), deja
// escrito quién y cuándo, y lo suma al equipo por 60 minutos (admin_entrar_gimnasio);
// acá solo se elige el gimnasio (cookie) y se va al panel. POST: nadie lo dispara con un link.
export async function POST(req: NextRequest) {
  const f = await req.formData();
  const gimnasioId = String(f.get("gimnasio_id") ?? "");
  const motivo = String(f.get("motivo") ?? "");
  const rol = String(f.get("rol") ?? "dueno");
  const supabase = await crearClienteServidor();
  const { data: slug, error } = await supabase.rpc("admin_entrar_gimnasio", { p_gimnasio_id: gimnasioId, p_motivo: motivo, p_rol: rol });
  const destino = req.nextUrl.clone();
  destino.search = "";
  if (error || typeof slug !== "string") {
    destino.pathname = "/admin";
    destino.searchParams.set("error", error?.message ?? "No se pudo entrar al gimnasio");
    return NextResponse.redirect(destino, 303);
  }
  destino.pathname = "/panel";
  const r = NextResponse.redirect(destino, 303);
  r.cookies.set(COOKIE_GIMNASIO, slug, OPCIONES_COOKIE_GIMNASIO);
  return r;
}
