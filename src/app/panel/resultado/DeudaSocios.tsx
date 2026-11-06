import { formatearNumero, formatearPesos } from "@/lib/formato";
import { LinkPanel } from "@/components/panel/LinkPanel";

export type DeudaConSocios = {
  momento: string; total: number;
  packs: { valor: number; usos: number; socios: number; usos_sin_venta: number; por_plan: { plan: string; usos: number; valor: number; socios: number }[] };
  cuotas: { valor: number; adelantadas: number; en_curso: number; socios: number; sin_venta: number; por_plan: { plan: string; valor: number; socios: number }[] };
  mayores: { socio_id: string; nombre: string; valor: number; usos: number; cuotas: number; packs: number }[];
};

/** VD-46L: lo cobrado por un servicio que todavía no se dio. Lo calcula la base (deuda_con_socios) con los hechos de hoy. */
export function DeudaSocios({ d }: { d: DeudaConSocios }) {
  const hay = Number(d.total) > 0 || d.packs.usos > 0 || d.cuotas.sin_venta > 0;
  return (
    <section aria-labelledby="deuda" data-deuda-socios>
      <h2 id="deuda" className="titulo text-2xl mb-1">🧾 Lo que les debés a los socios</h2>
      {!hay ? (
        <p className="texto-suave">Hoy no hay clases de packs ni cuotas pagadas por adelantado pendientes: no le debés servicio a nadie.</p>
      ) : (
        <>
          <p className="texto-suave mb-3">Plata que ya cobraste por un servicio que todavía no dieron: usos de packs que les quedan y la parte de las cuotas que aún no pasó.</p>
          <p className="numero text-4xl sm:text-5xl" data-deuda-total>{formatearPesos(d.total)}</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-6 mt-5">
            <div className="flex flex-col-reverse">
              <dt className="texto-suave mt-1 text-[15px]">🎟️ Packs · {formatearNumero(d.packs.usos)} {d.packs.usos === 1 ? "uso" : "usos"} · {formatearNumero(d.packs.socios)} {d.packs.socios === 1 ? "socio" : "socios"}</dt>
              <dd className="numero text-3xl">{formatearPesos(d.packs.valor)}</dd>
            </div>
            <div className="flex flex-col-reverse">
              <dt className="texto-suave mt-1 text-[15px]">📅 Cuotas · {formatearNumero(d.cuotas.socios)} {d.cuotas.socios === 1 ? "socio" : "socios"}</dt>
              <dd className="numero text-3xl">{formatearPesos(d.cuotas.valor)}</dd>
            </div>
          </dl>
          {Number(d.cuotas.adelantadas) > 0 && <p className="texto-suave text-sm mt-3">De las cuotas, {formatearPesos(d.cuotas.adelantadas)} son de períodos que ni empezaron (pagados por adelantado).</p>}
          {(d.packs.usos_sin_venta > 0 || d.cuotas.sin_venta > 0) && (
            <p className="texto-tenue text-sm mt-2">No suma lo que no se cobró acá (cortesías, packs o cuotas cargados sin venta): {d.packs.usos_sin_venta > 0 ? `${formatearNumero(d.packs.usos_sin_venta)} usos de packs` : ""}{d.packs.usos_sin_venta > 0 && d.cuotas.sin_venta > 0 ? " y " : ""}{d.cuotas.sin_venta > 0 ? `${formatearNumero(d.cuotas.sin_venta)} cuotas` : ""}.</p>
          )}
          {d.mayores.length > 0 && (
            <details className="tarjeta p-4 mt-4"><summary className="cursor-pointer">Los {d.mayores.length === 1 ? "socio con más" : `${d.mayores.length} socios con más`} a favor</summary>
              <ul className="mt-2 space-y-1">{d.mayores.map((m) => (
                <li key={m.socio_id} className="flex justify-between gap-3 text-sm">
                  <LinkPanel href={`/panel/socios/${m.socio_id}`} siNoEsta="texto" className="underline min-w-0 truncate">{m.nombre}</LinkPanel>
                  <span className="numero">{formatearPesos(m.valor)}</span>
                </li>
              ))}</ul>
            </details>
          )}
          <p className="text-sm texto-tenue mt-3">Se valúa a lo que pagó cada uno (precio menos descuento, ventas no anuladas), proporcional a lo que le queda. Es una foto de hoy: no es plata guardada ni sale de tu cobrado.</p>
        </>
      )}
    </section>
  );
}
