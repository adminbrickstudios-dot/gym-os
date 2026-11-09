import { NextResponse, type NextRequest } from "next/server";
import { csvGimnasios, type FilaGimnasio } from "@/lib/admin/lista";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// SA-2: exportar la lista (con los mismos filtros). La base valida que sea admin de BRIK.
const ok = (v: string | null, validos: string[]) => (v && validos.includes(v) ? v : null);
const fecha = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams;
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("admin_lista_gimnasios", {
    p_q: u.get("q")?.slice(0, 80) || null, p_salud: ok(u.get("salud"), ["verde", "amarillo", "rojo"]),
    p_abono: ok(u.get("abono"), ["al_dia", "por_vencer", "vencido", "sin_abono"]), p_plan: u.get("plan")?.slice(0, 60) || null,
    p_alta_desde: fecha(u.get("desde")), p_alta_hasta: fecha(u.get("hasta")),
    p_ciudad: u.get("ciudad")?.slice(0, 80) || null, p_modulo: ok(u.get("modulo"), ["clases", "caja", "vender", "rutinas", "retencion", "transferencias", "pt"]),
    p_con_bajas: u.get("bajas") === "1",
  });
  if (error) return new NextResponse(error.message, { status: 403 });
  return new NextResponse(csvGimnasios(data as FilaGimnasio[]), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="gimnasios.csv"', "cache-control": "no-store" },
  });
}
