// VD-16: los números de Retención del período elegido, en CSV (se abre con Excel). Salen de la misma
// llamada que la pantalla (retencion_periodo): nada se recalcula acá. Solo dueño y encargado: lo decide
// la base. Sin permiso se dice, nunca un archivo vacío.
import { aCsv } from "@/lib/csv";
import { contextoPanel, rpc } from "@/lib/panel/servidor";
import type { NumerosDelPeriodo } from "@/components/panel/NumerosPeriodo";

const PERIODOS = ["mes", "mes_pasado", "3", "6", "12"];
const LISTAS = ["riesgo", "vencido", "por_vencer", "nuevo", "no_viene", "se_fue"];
const DIAS =["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const num = (n: number | string | null | undefined) => (n == null ? "" : String(n).replace(".", ","));
const texto = (m: string, status: number) => new Response(m, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

export async function GET(req: Request) {
  const panel = await contextoPanel();
  const params = new URL(req.url).searchParams;
  // Q2: ?lista=… exporta esa lista de Retención (la misma que se ve; solo dueño y encargado, lo decide la base).
  const lista = params.get("lista");
  if (lista) {
    if (!LISTAS.includes(lista)) return texto(`Pedí ?lista=${LISTAS.join("|")}`, 400);
    const etiqueta = /^[0-9a-f-]{36}$/.test(params.get("etiqueta") ?? "") ? params.get("etiqueta")! : null;
    try {
      const g = panel.gimnasio.id;
      const ids = etiqueta ? new Set(await rpc<string[]>("socios_con_etiqueta", { p_gimnasio_id: g, p_etiqueta_id: etiqueta })) : null;
      let filas: (string | number | null)[][];
      if (lista === "riesgo") {
        const r = (await rpc<{ socio_id: string; nombre: string; telefono: string | null; nivel: string; porque: string[] }[]>("riesgo_baja", { p_gimnasio_id: g })).filter((x) => !ids || ids.has(x.socio_id));
        filas = r.map((x) => [x.nombre, x.telefono, x.nivel === "alto" ? "Riesgo alto" : "Riesgo medio", x.porque.join(" · "), "", ""]);
      } else if (lista === "se_fue") {
        const r = (await rpc<{ filas: { socio_id: string; nombre: string; telefono: string | null; [k: string]: unknown }[] }>("ex_socios", { p_gimnasio_id: g, p_motivo: null, p_antiguedad: null })).filas.filter((x) => !ids || ids.has(x.socio_id));
        filas = r.map((x) => [x.nombre, x.telefono, "Se fue", "", "", ""]);
      } else {
        const r = (await rpc<{ socio_id: string; nombre: string; telefono: string | null; lista: string; texto: string; ultimo_contacto_en: string | null; ultimo_contacto_resultado: string | null }[]>("retencion", { p_gimnasio_id: g }))
          .filter((x) => x.lista === lista && (!ids || ids.has(x.socio_id)));
        filas = r.map((x) => [x.nombre, x.telefono, x.texto, "", x.ultimo_contacto_en ? x.ultimo_contacto_en.slice(0, 10) : "", x.ultimo_contacto_resultado ?? ""]);
      }
      return new Response(aCsv(["Nombre", "Teléfono", "Situación", "Señales", "Último contacto", "Resultado"], filas), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="retencion-${panel.gimnasio.slug}-${lista}.csv"`,
          "cache-control": "no-store",
        },
      });
    } catch (e) {
      return texto(`No se pudo exportar: ${(e as Error).message}`, 403);
    }
  }
  const p = params.get("periodo") ?? "mes";
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
