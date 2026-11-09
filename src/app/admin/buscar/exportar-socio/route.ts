import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// SA-11 (Ley 25.326): todo lo de un socio en un archivo. Solo el principal (lo valida la base) y queda en el registro de BRIK.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function GET(req: NextRequest) {
  const g = req.nextUrl.searchParams.get("gimnasio") ?? "";
  const s = req.nextUrl.searchParams.get("socio") ?? "";
  if (!UUID.test(g) || !UUID.test(s)) return new NextResponse("Datos no válidos", { status: 400 });
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("admin_exportar_socio", { p_gimnasio_id: g, p_socio_id: s });
  if (error || !data) return new NextResponse(error?.message ?? "No se pudo exportar", { status: 403 });
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": 'attachment; filename="datos-del-socio.json"', "cache-control": "no-store" },
  });
}
