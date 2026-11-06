// VD-41: los gastos del mes para el contador, en CSV (se abre con Excel). Quién puede lo decide la base (exportar_gastos).
import { aCsv } from "@/lib/csv";
import { NOMBRE_CATEGORIA } from "@/lib/gastos";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

type Fila = { fecha: string; categoria: string; detalle: string | null; monto: number; tipo: string; comprobante: boolean; por: string | null };
const plata = (n: number) => Number(n).toFixed(2).replace(".", ",");
const sinEmoji = (t: string) => t.replace(/^[^\p{L}]+/u, "");

export async function GET(req: Request) {
  const panel = await contextoPanel();
  const mes = new URL(req.url).searchParams.get("mes") ?? "";
  if (!/^\d{4}-\d{2}$/.test(mes)) return new Response("Pedí ?mes=AAAA-MM", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
  let filas: Fila[];
  try {
    filas = await rpc<Fila[]>("exportar_gastos", { p_gimnasio_id: panel.gimnasio.id, p_mes: `${mes}-01` });
  } catch (e) {
    return new Response(`No se pudo exportar: ${(e as Error).message}`, { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const csv = aCsv(["Fecha", "Categoría", "Detalle", "Monto", "Tipo", "Con comprobante", "Cargó"],
    filas.map((f) => [f.fecha, sinEmoji(NOMBRE_CATEGORIA[f.categoria] ?? f.categoria), f.detalle, plata(f.monto), f.tipo, f.comprobante ? "Sí" : "No", f.por]));
  return new Response(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="gastos-${panel.gimnasio.slug}-${mes}.csv"`, "cache-control": "no-store" },
  });
}
