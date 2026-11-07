import { formatearPesos } from "@/lib/formato";
import { nombreMes } from "@/lib/gastos";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

type Mia = {
  mes: string;
  resumen: { nombre: string; regla: { modo: string; monto: number } | null; clases: number; presentes: number; horas_clases: number; horas_cargadas: number | null; total: number; pagado: number; pendiente: number } | null;
  clases: { dia: string; actividad: string; minutos: number; presentes: number; importe: number }[];
  pagos: { monto: number; medio: string; pagado_en: string }[];
};
const MODO: Record<string, string> = { por_clase: "por clase dictada", por_presente: "por alumno presente", por_hora: "por hora" };
const dia = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);

/** VD-52 (D33): el profe ve SU mes en Mi cuenta. La base devuelve solo lo de quien pregunta. Los demás roles lo ven solo si tienen clases o regla. */
export async function MiLiquidacion() {
  const panel = await contextoPanel();
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: panel.gimnasio.zona_horaria }).format(new Date());
  const mes = `${hoy.slice(0, 7)}-01`;
  const m = await rpc<Mia>("mi_liquidacion", { p_gimnasio_id: panel.gimnasio.id, p_mes: mes }, { lectura: true });
  const r = m.resumen;
  const esProfe = panel.yo.rol === "profe";
  if (!esProfe && !(r && (r.clases > 0 || r.regla))) return null;
  return (
    <section className="tarjeta p-5 sm:p-6 max-w-xl mt-6" aria-labelledby="mi-liq" data-mi-liquidacion>
      <h2 id="mi-liq" className="titulo text-2xl mb-1">🧑‍🏫 Mi liquidación · {nombreMes(m.mes)}</h2>
      {!r || (!r.regla && r.clases === 0)
        ? <p className="texto-suave">Todavía no tenés clases este mes ni una forma de pago cargada. Cuando el dueño te la ponga, la ves acá.</p>
        : (
          <>
            <p className="texto-suave mb-3">{r.regla ? `Se te paga ${formatearPesos(r.regla.monto)} ${MODO[r.regla.modo]}.` : "Todavía no tenés una forma de pago cargada: hablá con el dueño."}</p>
            <dl className="grid grid-cols-3 gap-3 text-center mb-3">
              <div><dt className="texto-suave text-xs">Clases</dt><dd className="numero text-lg" data-mi="clases">{r.clases}</dd></div>
              <div><dt className="texto-suave text-xs">Presentes</dt><dd className="numero text-lg" data-mi="presentes">{r.presentes}</dd></div>
              <div><dt className="texto-suave text-xs">Se te debe</dt><dd className="numero text-xl" data-mi="total">{formatearPesos(r.total)}</dd></div>
            </dl>
            <p className="texto-suave text-sm mb-2">Pagado: <strong data-mi="pagado">{formatearPesos(r.pagado)}</strong> · Falta: <strong data-mi="pendiente">{formatearPesos(r.pendiente)}</strong></p>
            {m.clases.length > 0 && (
              <details className="mt-2"><summary className="cursor-pointer texto-suave text-sm">Ver mis clases del mes</summary>
                <ul className="text-sm mt-2 space-y-1">{m.clases.map((c, i) => <li key={i}>{dia(c.dia)} · {c.actividad} · {c.presentes} {c.presentes === 1 ? "presente" : "presentes"} · {formatearPesos(c.importe)}</li>)}</ul></details>)}
            {m.pagos.length > 0 && <ul className="text-sm mt-2 space-y-1">{m.pagos.map((p, i) => <li key={i}>💵 Te pagaron {formatearPesos(p.monto)} el {dia(p.pagado_en.slice(0, 10))}</li>)}</ul>}
          </>
        )}
    </section>
  );
}
