import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// El super admin deja el equipo de un gimnasio (su acceso de soporte queda desactivado).
export async function POST(req: NextRequest) {
  const f = await req.formData();
  const gimnasioId = String(f.get("gimnasio_id") ?? "");
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("admin_salir_gimnasio", { p_gimnasio_id: gimnasioId });
  const destino = req.nextUrl.clone();
  destino.pathname = "/admin";
  destino.search = "";
  if (error) destino.searchParams.set("error", error.message);
  return NextResponse.redirect(destino, 303);
}
