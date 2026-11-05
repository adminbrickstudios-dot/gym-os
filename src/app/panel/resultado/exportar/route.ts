// RES-2: el mes para el contador, en CSV (se abre con Excel). Solo dueño y
// encargado: lo decide la base (exportar_mes). Sin permiso, se dice: nunca un archivo vacío.
import { MEDIO } from "@/lib/caja";
import { aCsv } from "@/lib/csv";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

type Fila = Record<string, string | number | null>;
const plata = (n: string | number | null) => (n == null ? "" : Number(n).toFixed(2).replace(".", ","));
const ESTADO: Record<string, string> = { confirmada: "Cobrada", pendiente: "Pendiente", anulada: "Anulada", aprobado: "Aprobado", rechazado: "Rechazado", anulado: "Anulado" };

const COLUMNAS: Record<string, { titulos: string[]; fila: (f: Fila) => (string | number | null)[] }> = {
  ventas: {
    titulos: ["Fecha", "Venta", "Socio", "Detalle", "Bruto", "Descuento", "Total", "Estado", "Cobró", "Sede", "Anulada"],
    fila: (f) => [f.fecha, f.venta, f.socio, f.detalle, plata(f.bruto), plata(f.descuento), plata(f.total), ESTADO[String(f.estado)] ?? f.estado, f.cobro, f.sede, f.anulada],
  },
  pagos: {
    titulos: ["Fecha", "Venta", "Socio", "Medio", "Monto", "Estado", "Quién"],
    fila: (f) => [f.fecha, f.venta, f.socio, MEDIO[String(f.medio)] ?? f.medio, plata(f.monto), ESTADO[String(f.estado)] ?? f.estado, f.quien],
  },
  caja: {
    titulos: ["Fecha", "Caja", "Movimiento", "Monto", "Detalle", "Quién"],
    fila: (f) => [f.fecha, f.caja, f.tipo, plata(f.monto), f.motivo, f.quien],
  },
};

export async function GET(req: Request) {
  const panel = await contextoPanel();
  const u = new URL(req.url);
  const que = u.searchParams.get("que") ?? "";
  const mes = /^\d{4}-\d{2}$/.test(u.searchParams.get("mes") ?? "") ? u.searchParams.get("mes")! : null;
  const columnas = COLUMNAS[que];
  if (!columnas || !mes) return new Response("Pedí ?que=ventas|pagos|caja&mes=AAAA-MM", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
  let filas: Fila[];
  try {
    filas = await rpc<Fila[]>("exportar_mes", { p_gimnasio_id: panel.gimnasio.id, p_mes: `${mes}-01`, p_que: que });
  } catch (e) {
    return new Response(`No se pudo exportar: ${(e as Error).message}`, { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  return new Response(aCsv(columnas.titulos, filas.map(columnas.fila)), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${que}-${panel.gimnasio.slug}-${mes}.csv"`,
      "cache-control": "no-store",
    },
  });
}
