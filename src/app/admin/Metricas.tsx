import { formatearNumero, formatearPesos } from "@/lib/formato";

export type MetricasPlataforma = {
  gimnasios: number; activos_hoy: number; cobrado_mes: number; por_vencer: number; vencidos: number; nuevos_30_dias: number;
  suspendidos: number; ayudas_pendientes: number;
  entradas_por_dia: { dia: string; entradas: number }[]; abonos_por_mes: { mes: string; monto: number }[];
};

const dia = (iso: string) => new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
const mes = (m: string) => new Intl.DateTimeFormat("es-AR", { month: "short", timeZone: "UTC" }).format(new Date(`${m}-15T12:00:00Z`));

/** VD-40: los números de la plataforma (BRIK), de un vistazo. */
export function Metricas({ m }: { m: MetricasPlataforma }) {
  const max = Math.max(1, ...m.entradas_por_dia.map((d) => d.entradas));
  const maxAbono = Math.max(1, ...m.abonos_por_mes.map((d) => Number(d.monto)));
  const tiles: [string, string, string][] = [
    [formatearNumero(m.gimnasios), "gimnasios", "gimnasios"],
    [formatearNumero(m.activos_hoy), "usaron el panel en 24 h", "activos"],
    [formatearPesos(Number(m.cobrado_mes)), "cobrado a BRIK este mes", "cobrado"],
    [formatearNumero(m.por_vencer + m.vencidos), `abono por vencer o vencido (${m.vencidos} vencidos)`, "abonos"],
    [formatearNumero(m.nuevos_30_dias), `nuevos en 30 días · ${m.suspendidos} suspendidos`, "nuevos"],
  ];
  return (
    <section className="space-y-4" data-metricas>
      <p className="titulo-grupo">La plataforma</p>
      <dl className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {tiles.map(([n, t, k]) => (
          <div key={k} className="tarjeta p-4" data-metrica={k}>
            <dd className="numero text-3xl break-words">{n}</dd>
            <dt className="text-sm texto-tenue">{t}</dt>
          </div>
        ))}
      </dl>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="tarjeta p-4 space-y-2">
          <p className="texto-suave text-sm">Entradas por día en toda la plataforma (14 días)</p>
          <div className="flex items-end gap-1 h-24" role="img" aria-label="Entradas por día">
            {m.entradas_por_dia.map((d) => (
              <div key={d.dia} className="flex-1 rounded-t bg-[var(--acento,#16a34a)]" style={{ height: `${Math.max(4, (d.entradas / max) * 100)}%` }} title={`${dia(d.dia)}: ${d.entradas}`} />
            ))}
          </div>
          <p className="texto-tenue text-xs flex justify-between"><span>{dia(m.entradas_por_dia[0]?.dia ?? "1970-01-01")}</span><span>{dia(m.entradas_por_dia.at(-1)?.dia ?? "1970-01-01")}</span></p>
        </div>
        <div className="tarjeta p-4 space-y-2">
          <p className="texto-suave text-sm">Ingreso por abonos, mes a mes</p>
          <div className="flex items-end gap-2 h-24" role="img" aria-label="Ingreso por abonos">
            {m.abonos_por_mes.map((d) => (
              <div key={d.mes} className="flex-1 flex flex-col justify-end h-full text-center">
                <div className="rounded-t bg-[var(--acento,#16a34a)]" style={{ height: `${Math.max(4, (Number(d.monto) / maxAbono) * 100)}%` }} title={formatearPesos(Number(d.monto))} />
              </div>
            ))}
          </div>
          <p className="texto-tenue text-xs flex gap-2">{m.abonos_por_mes.map((d) => <span key={d.mes} className="flex-1 text-center">{mes(d.mes)}</span>)}</p>
        </div>
      </div>
    </section>
  );
}
