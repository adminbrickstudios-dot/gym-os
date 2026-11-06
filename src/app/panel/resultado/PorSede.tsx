import { formatearNumero, formatearPesos } from "@/lib/formato";

export type ResultadoPorSede = {
  mes: string; en_curso: boolean; cobrado: number; repartido: number; compartidos: number;
  sedes: { sede_id: string; nombre: string; cobrado: number; entradas: number; socios: number; repartido: number }[];
};

/** VD-46P: por sede, dónde se cobró y dónde se usó; "para repartir" divide lo que paga cada socio según en qué sede entrenó. */
export function PorSede({ d }: { d: ResultadoPorSede }) {
  return (
    <section aria-labelledby="por-sede" data-por-sede>
      <h2 id="por-sede" className="titulo text-2xl mb-1">🏢 Por sede</h2>
      <p className="texto-suave mb-3">Dónde se cobró, dónde se usó y cuánto le toca a cada sede si se reparte lo que paga cada socio según en qué sede entrenó.</p>
      <ul className="space-y-2">
        {d.sedes.map((s) => (
          <li key={s.sede_id} className="tarjeta p-4" data-sede={s.nombre}>
            <p className="font-semibold">{s.nombre}</p>
            <dl className="grid grid-cols-3 gap-3 mt-2">
              <div className="flex flex-col-reverse"><dt className="texto-suave text-sm">Se cobró</dt><dd className="numero text-xl sm:text-2xl">{formatearPesos(s.cobrado)}</dd></div>
              <div className="flex flex-col-reverse"><dt className="texto-suave text-sm">Se usó</dt><dd className="numero text-xl sm:text-2xl">{formatearNumero(s.entradas)}<span className="texto-tenue text-sm font-normal"> entradas · {formatearNumero(s.socios)} {s.socios === 1 ? "socio" : "socios"}</span></dd></div>
              <div className="flex flex-col-reverse"><dt className="texto-suave text-sm">Para repartir</dt><dd className="numero text-xl sm:text-2xl">{formatearPesos(s.repartido)}</dd></div>
            </dl>
          </li>
        ))}
      </ul>
      <p className="text-sm texto-tenue mt-2">
        {d.compartidos > 0 ? `${formatearNumero(d.compartidos)} ${d.compartidos === 1 ? "socio entrenó" : "socios entrenaron"} en más de una sede. ` : ""}
        Lo repartido suma {formatearPesos(d.repartido)}, igual que lo cobrado ({formatearPesos(d.cobrado)}). Se reparte solo la parte de cuotas, pases y packs; productos, matrículas y recargos, y quien no entró en el mes, quedan donde se cobró.
      </p>
    </section>
  );
}
