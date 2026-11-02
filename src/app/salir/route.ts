import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// Cerrar sesión es un POST (un link GET lo podría disparar cualquier página).
export async function POST(req: NextRequest) {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  const destino = req.nextUrl.clone();
  destino.pathname = "/ingresar";
  destino.search = "";
  return NextResponse.redirect(destino, { status: 303 });
}
