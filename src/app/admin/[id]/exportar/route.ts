import { NextResponse, type NextRequest } from "next/server";
import { csv, zip } from "@/lib/admin/zip";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// SA-6 / SA-11: exportar un gimnasio entero (socios, pagos, ingresos y planes) en un zip de CSV. Solo el principal (lo valida la base).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse("Gimnasio no válido", { status: 400 });
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("admin_exportar_gimnasio", { p_gimnasio_id: id });
  if (error || !data) return new NextResponse(error?.message ?? "No se pudo exportar", { status: 403 });
  const enc = new TextEncoder();
  const listas = data as Record<string, Record<string, unknown>[]>;
  const archivo = zip(Object.entries(listas).map(([nombre, filas]) => ({ nombre: `${nombre}.csv`, contenido: enc.encode(csv(filas)) })));
  return new NextResponse(new Blob([archivo.buffer as ArrayBuffer], { type: "application/zip" }), {
    headers: { "content-disposition": 'attachment; filename="gimnasio.zip"', "cache-control": "no-store" },
  });
}
