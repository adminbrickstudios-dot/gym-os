import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/panel/Marco";
import { MEDIO } from "@/lib/caja";
import { formatearNumero, formatearPesos } from "@/lib/formato";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, rpc } from "@/lib/panel/servidor";
import { Gastos, type GastosMes } from "./Gastos";
import { NumerosDeRetencion, type NumerosRetencion } from "@/components/panel/NumerosRetencion";

export const metadata: Metadata = { title: "Resultado" };

type Resultado = {
  mes: string; en_curso: boolean; dias: number; cobrado: number; anterior_mismo_periodo: number; anterior_total: number; fiado: number;
  por_medio: { medio: string; total: number }[]; por_concepto: { concepto: string; total: number; cantidad: number }[];
  por_dia: { dia: string; total: number }[]; activos: number; altas: number; bajas: number; recurrente: number; horas: number[];
};

const MOTIVO_BAJA: Record<string, string> = { precio: "💸 Precio", horario: "⏰ Horario", mudanza: "📦 Se mudó", otro_gimnasio: "🏋️ Otro gimnasio", sin_tiempo: "⌛ Sin tiempo", insatisfecho: "😕 No le gustó", otro: "Otro" };
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const nombreMes = (d: string) => `${MESES[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
const moverMes = (d: string, n: number) => { const x = new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1 + n, 1)); return x.toISOString().slice(0, 10); };

/** RES-1: la plata del mes, clara. Todo lo calcula la base al abrirla (mismas reglas que Inicio y el Resumen). */
export default async function ResultadoMes({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const sp = await searchParams;
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado"]);
    const pedido = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? `${sp.mes}-01` : null;
    const [r, gastos, motivos, numeros, cupones] = await Promise.all([
      rpc<Resultado>("resultado_mes", { p_gimnasio_id: panel.gimnasio.id, p_mes: pedido }),
      // RES-3: los gastos (hay sueldos) los ve solo el dueño.
      panel.yo.rol === "dueno" ? rpc<GastosMes>("gastos_mes", { p_gimnasio_id: panel.gimnasio.id, p_mes: pedido }) : null,
      // RET-3: por qué se fue la gente este mes.
      rpc<{ motivo: string; cantidad: number }[]>("motivos_baja_mes", { p_gimnasio_id: panel.gimnasio.id, p_mes: pedido }),
      // COM-5: la retención en números (es de hoy: solo se muestra en el mes en curso).
      pedido ? Promise.resolve(null) : rpc<NumerosRetencion>("retencion_numeros", { p_gimnasio_id: panel.gimnasio.id }),
      // COM-9: cuántos socios trajo cada cupón.
      rpc<{ codigo: string; usos: number; socios: number }[]>("cupones_panel", { p_gimnasio_id: panel.gimnasio.id }),
    ]);
    const anterior = moverMes(r.mes, -1);
    const base = Number(r.anterior_mismo_periodo);
    const cambio = base ? Math.round(((Number(r.cobrado) - base) / base) * 100) : null;
    const contra = r.en_curso ? `los primeros ${r.dias} días de ${MESES[Number(anterior.slice(5, 7)) - 1]}` : MESES[Number(anterior.slice(5, 7)) - 1];
    const maxDia = Math.max(1, ...r.por_dia.map((d) => Number(d.total)));
    const maxHora = Math.max(1, ...r.horas);
    const pico = r.horas.indexOf(Math.max(...r.horas));
    const totalConcepto = r.por_concepto.reduce((a, c) => a + Number(c.total), 0) || 1;
    return (
      <div className="space-y-10">
        <Encabezado emoji="📈" titulo="Resultado" bajada={`La plata de ${nombreMes(r.mes)}${r.en_curso ? " hasta hoy" : ""}: cuánto entró, de dónde y contra el mes anterior.`} />
        <nav className="flex flex-wrap items-center gap-2" aria-label="Mes">
          <Link href={`/panel/resultado?mes=${anterior.slice(0, 7)}`} className="pestana">← {MESES[Number(anterior.slice(5, 7)) - 1]}</Link>
          <span className="pestana" aria-current="page">{nombreMes(r.mes)}</span>
          {!r.en_curso && <Link href={`/panel/resultado?mes=${moverMes(r.mes, 1).slice(0, 7)}`} className="pestana">{MESES[Number(moverMes(r.mes, 1).slice(5, 7)) - 1]} →</Link>}
        </nav>

        <section aria-label="Cobrado" data-resultado-cobrado>
          <p className="numero text-6xl sm:text-7xl">{formatearPesos(r.cobrado)}</p>
          <p className="texto-suave text-lg mt-2">
            Cobrado{cambio === null ? "" : cambio === 0 ? `, igual que ${contra}` : `, ${cambio > 0 ? "↑" : "↓"} ${Math.abs(cambio)}% contra ${contra} (${formatearPesos(base)})`}.
            {Number(r.fiado) > 0 && ` Además quedaron ${formatearPesos(r.fiado)} a cuenta.`}
          </p>
        </section>

        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-8">
          {[
            { e: "👥", t: "Socios al día", v: formatearNumero(r.activos) },
            { e: "🌱", t: "Altas", v: formatearNumero(r.altas) },
            { e: "👋", t: "Bajas", v: formatearNumero(r.bajas) },
            { e: "🔁", t: "Recurrente por mes", v: formatearPesos(r.recurrente) },
          ].map((n) => (
            <div key={n.t} className="flex flex-col-reverse">
              <dt className="texto-suave mt-2 text-[15px]"><span aria-hidden>{n.e}</span> {n.t}</dt>
              <dd className="numero text-4xl sm:text-5xl">{n.v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm texto-tenue -mt-6">Recurrente: lo que entra por mes si todos los que hoy tienen la membresía al día la renuevan, al precio de hoy.</p>

        <section aria-labelledby="dias">
          <h2 id="dias" className="titulo text-2xl mb-3">Día por día</h2>
          <div className="tarjeta p-4">
            <div className="flex items-end gap-[2px] h-32" role="img" aria-label={`Cobrado por día en ${nombreMes(r.mes)}`}>
              {r.por_dia.map((d) => (
                <div key={d.dia} className="flex-1 rounded-t-sm" title={`${d.dia.slice(8, 10)}: ${formatearPesos(d.total)}`}
                  style={{ height: `${Math.max(2, (Number(d.total) / maxDia) * 100)}%`, background: Number(d.total) ? "var(--acento)" : "var(--borde)" }} />
              ))}
            </div>
            <div className="flex justify-between text-xs texto-tenue mt-2"><span>1</span><span>{r.por_dia.length}</span></div>
          </div>
        </section>

        <div className="grid gap-8 md:grid-cols-2">
          <section aria-labelledby="concepto">
            <h2 id="concepto" className="titulo text-2xl mb-3">De dónde</h2>
            {r.por_concepto.length === 0 ? <p className="texto-suave">Sin ventas este mes.</p> : (
              <ul className="tarjeta divide-y divide-[var(--borde)]">{r.por_concepto.map((c) => (
                <li key={c.concepto} className="px-4 py-3">
                  <div className="flex justify-between gap-3"><span>{c.concepto} <span className="texto-tenue text-sm">· {c.cantidad}</span></span><span className="numero">{formatearPesos(c.total)}</span></div>
                  <div className="h-1.5 rounded-full mt-2" style={{ width: `${(Number(c.total) / totalConcepto) * 100}%`, background: "var(--acento)" }} />
                </li>
              ))}</ul>
            )}
            <p className="text-sm texto-tenue mt-2">Por lo vendido en el mes (sin ventas anuladas).</p>
          </section>
          <section aria-labelledby="medios">
            <h2 id="medios" className="titulo text-2xl mb-3">Cómo pagaron</h2>
            {r.por_medio.length === 0 ? <p className="texto-suave">Sin cobros este mes.</p> : (
              <ul className="tarjeta divide-y divide-[var(--borde)]">{r.por_medio.map((m) => (
                <li key={m.medio} className="flex justify-between gap-3 px-4 py-3"><span>{MEDIO[m.medio] ?? m.medio}</span><span className="numero">{formatearPesos(m.total)}</span></li>
              ))}</ul>
            )}
          </section>
        </div>

        {numeros && r.en_curso && (
          <section aria-labelledby="socios-numeros">
            <h2 id="socios-numeros" className="titulo text-2xl mb-3">Socios</h2>
            <NumerosDeRetencion n={numeros} />
          </section>
        )}

        {cupones.some((c) => c.usos > 0) && (
          <section aria-labelledby="cupones" data-cupones-resultado>
            <h2 id="cupones" className="titulo text-2xl mb-3">🏷️ Cupones</h2>
            <ul className="tarjeta divide-y divide-[var(--borde)]">{cupones.filter((c) => c.usos > 0).map((c) => (
              <li key={c.codigo} className="flex justify-between gap-3 px-4 py-3"><span className="numero">{c.codigo}</span><span className="texto-suave">{c.usos} {c.usos === 1 ? "uso" : "usos"} · trajo {c.socios} {c.socios === 1 ? "socio" : "socios"}</span></li>
            ))}</ul>
          </section>
        )}

        {motivos.length > 0 && (
          <section aria-labelledby="motivos" data-motivos-baja>
            <h2 id="motivos" className="titulo text-2xl mb-3">Por qué se fueron</h2>
            <ul className="tarjeta divide-y divide-[var(--borde)]">{motivos.map((m) => (
              <li key={m.motivo} className="flex justify-between gap-3 px-4 py-3"><span>{MOTIVO_BAJA[m.motivo] ?? m.motivo}</span><span className="numero">{m.cantidad}</span></li>
            ))}</ul>
          </section>
        )}

        {gastos && <Gastos g={gastos} />}

        <section aria-labelledby="contador">
          <h2 id="contador" className="titulo text-2xl mb-1">Para el contador</h2>
          <p className="texto-suave mb-3">El mes fila por fila, en planillas que se abren con Excel.</p>
          <div className="flex flex-wrap gap-2" data-exportar>
            {[["ventas", "🧾 Ventas"], ["pagos", "💳 Pagos"], ["caja", "💵 Caja"]].map(([q, t]) => (
              <a key={q} href={`/panel/resultado/exportar?que=${q}&mes=${r.mes.slice(0, 7)}`} className="boton" download>{t}</a>
            ))}
          </div>
        </section>

        <section aria-labelledby="horas">
          <h2 id="horas" className="titulo text-2xl mb-1">Horas pico</h2>
          <p className="texto-suave mb-3">{Math.max(...r.horas) ? `La hora con más gente: de ${pico} a ${pico + 1} h.` : "Sin entradas registradas este mes."}</p>
          <div className="tarjeta p-4">
            <div className="flex items-end gap-[3px] h-24" role="img" aria-label="Entradas por hora del día">
              {r.horas.slice(6).map((n, i) => (
                <div key={i} className="flex-1 rounded-t-sm" title={`${i + 6} h: ${n}`}
                  style={{ height: `${Math.max(2, (n / maxHora) * 100)}%`, background: n ? "var(--acento)" : "var(--borde)", opacity: i + 6 === pico ? 1 : 0.6 }} />
              ))}
            </div>
            <div className="flex justify-between text-xs texto-tenue mt-2"><span>6 h</span><span>15 h</span><span>23 h</span></div>
          </div>
        </section>
      </div>
    );
  });
}
