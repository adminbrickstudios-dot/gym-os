// VD-16: los números de Retención del período elegido, en CSV (se abre con Excel). Salen de la misma
// llamada que la pantalla (retencion_periodo): nada se recalcula acá. Solo dueño y encargado: lo decide
// la base. Sin permiso se dice, nunca un archivo vacío.
import { aCsv } from "@/lib/csv";
import { contextoPanel, rpc } from "@/lib/panel/servidor";
import type { NumerosDelPeriodo } from "@/components/panel/NumerosPeriodo";

const PERIODOS = ["mes", "mes_pasado", "3", "6", "12"];
const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const num = (n: number | string | null | undefined) => (n == null ? "" : String(n).replace(".", ","));
const texto = (m: string, status: number) => new Response(m, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

export async function GET(req: Request) {
  const panel = await contextoPanel();
  const p = new URL(req.url).searchParams.get("periodo") ?? "mes";
  if (!PERIODOS.includes(p)) return texto("Pedí ?periodo=mes|mes_pasado|3|6|12", 400);
  let n: NumerosDelPeriodo;
  try {
    n = await rpc<NumerosDelPeriodo>("retencion_periodo", { p_gimnasio_id: panel.gimnasio.id, p_periodo: p });
  } catch (e) {
    return texto(`No se pudo exportar: ${(e as Error).message}`, 403);
  }
  const filas: (string | number | null)[][] = [
    ["Período", `${n.desde} a ${n.hasta} (hasta, sin incluir)`, ""],
    ["Socios al día al empezar", n.socios.al_dia_inicio, ""],
    ["Socios al día al final", n.socios.al_dia_fin, ""],
    ["Altas", n.socios.altas, ""],
    ["Bajas", n.socios.bajas, ""],
    ["Neto (altas menos bajas)", n.socios.neto, ""],
    ["Churn general %", num(n.churn.general_pct), `${n.churn.bajas} bajas sobre ${n.churn.base} al día al empezar`],
    ["Churn 90 días %", num(n.churn.noventa_pct), `${n.churn.noventa_bajas} bajas de ${n.churn.noventa_altas} altas`],
    ["Cobrado", num(n.plata.cobrado), "pagos aprobados, sin ventas anuladas"],
    ["Ingreso por socio", num(n.plata.por_socio), `promedio de ${num(n.plata.socios_promedio)} socios al día`],
    ["Entradas", n.asistencia.entradas, ""],
    ["Días de visita por socio", num(n.asistencia.visitas_por_socio), `${n.asistencia.socios_que_vinieron} socios vinieron`],
    ["Al día con una visita por semana o menos", n.asistencia.pocas_visitas, `de ${n.asistencia.al_dia_fin} al día`],
    ["Ocupación de clases %", num(n.clases.ocupacion_pct), `${n.clases.reservas_con_cupo} reservas en ${n.clases.cupos} lugares`],
    ["Ausentes a clases", n.clases.ausentes, "reservaron y no vinieron"],
    ...n.clases.por_actividad.map((a) => [`Ocupación ${a.actividad} %`, num(a.ocupacion_pct), `${a.clases} clases, ${a.reservas} reservas en ${a.cupos} lugares`]),
    ...n.calor.map((c) => [`Entradas ${DIAS[c.dia - 1]} ${String(c.hora).padStart(2, "0")}h`, c.n, "mapa de calor"]),
  ];
  return new Response(aCsv(["Número", "Valor", "Detalle"], filas), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="retencion-${panel.gimnasio.slug}-${p}.csv"`,
      "cache-control": "no-store",
    },
  });
}
