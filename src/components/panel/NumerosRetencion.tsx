import { LinkPanel } from "@/components/panel/LinkPanel";

export type NumerosRetencion = {
  altas: { socio_id: string; nombre: string; fecha: string }[];
  bajas: { socio_id: string; nombre: string; fecha: string; motivo: string | null }[];
  cohorte: { mes: string; entraron: number; siguen: { socio_id: string; nombre: string }[]; se_fueron: { socio_id: string; nombre: string }[] };
  pocas: { activos: number; lista: { socio_id: string; nombre: string; dias: number }[] };
};

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

function Lista({ personas, detalle }: { personas: { socio_id: string; nombre: string }[]; detalle?: (i: number) => string | null }) {
  if (!personas.length) return <p className="texto-tenue text-sm mt-2">Nadie.</p>;
  return (
    <ul className="mt-2 space-y-1 max-h-64 overflow-y-auto">
      {personas.map((p, i) => (
        <li key={p.socio_id} className="text-sm">
          <LinkPanel href={`/panel/socios/${p.socio_id}`} siNoEsta="texto" className="underline">{p.nombre}</LinkPanel>
          {detalle?.(i) && <span className="texto-tenue"> · {detalle(i)}</span>}
        </li>
      ))}
    </ul>
  );
}

/**
 * COM-5: la retención en números, cada uno con su lista de nombres (se abre
 * tocando el número). Lo calcula la base al abrir (retencion_numeros).
 */
export function NumerosDeRetencion({ n }: { n: NumerosRetencion }) {
  const neto = n.altas.length - n.bajas.length;
  const mesCohorte = MESES[Number(n.cohorte.mes.slice(5, 7)) - 1];
  const siguen = n.cohorte.siguen.length;
  return (
    <section className="grid sm:grid-cols-3 gap-3 mb-10" aria-label="Retención en números" data-retencion-numeros>
      <details className="tarjeta p-4" data-numero="neto">
        <summary className="cursor-pointer list-none">
          <span className="numero text-4xl">{neto > 0 ? `+${neto}` : neto}</span>
          <span className="block texto-suave text-[15px] mt-1">Neto del mes: {n.altas.length} {n.altas.length === 1 ? "alta" : "altas"} y {n.bajas.length} {n.bajas.length === 1 ? "baja" : "bajas"}</span>
        </summary>
        <p className="titulo-grupo mt-3">Altas</p>
        <Lista personas={n.altas} />
        <p className="titulo-grupo mt-3">Bajas</p>
        <Lista personas={n.bajas} detalle={(i) => n.bajas[i].motivo} />
      </details>
      <details className="tarjeta p-4" data-numero="cohorte">
        <summary className="cursor-pointer list-none">
          <span className="numero text-4xl">{n.cohorte.entraron ? `${pct(siguen, n.cohorte.entraron)}%` : "—"}</span>
          <span className="block texto-suave text-[15px] mt-1">{n.cohorte.entraron
            ? `De los ${n.cohorte.entraron} que se anotaron en ${mesCohorte}, ${siguen} siguen al día`
            : `Nadie se anotó en ${mesCohorte}`}</span>
        </summary>
        <p className="titulo-grupo mt-3">Siguen</p>
        <Lista personas={n.cohorte.siguen} />
        <p className="titulo-grupo mt-3">Se fueron</p>
        <Lista personas={n.cohorte.se_fueron} />
      </details>
      <details className="tarjeta p-4" data-numero="pocas">
        <summary className="cursor-pointer list-none">
          <span className="numero text-4xl">{n.pocas.activos ? `${pct(n.pocas.lista.length, n.pocas.activos)}%` : "—"}</span>
          <span className="block texto-suave text-[15px] mt-1">{n.pocas.lista.length} de {n.pocas.activos} al día vinieron menos de 4 días en los últimos 30</span>
        </summary>
        <Lista personas={n.pocas.lista} detalle={(i) => `${n.pocas.lista[i].dias} ${n.pocas.lista[i].dias === 1 ? "día" : "días"}`} />
      </details>
    </section>
  );
}
