// N10 · "Cuánto deja un socio" (función nueva, apagada por defecto). Solo lectura: lo calcula `valor_del_socio` de lo ya guardado (pagos y coberturas).
import { formatearPesos } from "@/lib/formato";

export type ValorDelSocio = {
  socios_que_pagaron: number; cobrado_total: number | string; deja_por_socio: number | string | null;
  ex_socios: number; meses_ex_socios: number | string | null; con_cobertura: number; meses_todos: number | string | null;
};

const meses = (n: number | string | null) => (n == null ? null : `${Number(n).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} meses`);

export function ValorSocio({ datos }: { datos: ValorDelSocio }) {
  const deja = datos.deja_por_socio == null ? null : formatearPesos(Number(datos.deja_por_socio));
  return (
    <section aria-labelledby="valor-socio" data-valor-socio>
      <h2 id="valor-socio" className="titulo text-2xl mb-1">Cuánto deja un socio</h2>
      <p className="texto-suave mb-3">Sale de todo lo cobrado y de las coberturas guardadas, desde que el gimnasio usa Base.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="tarjeta p-4" data-deja-por-socio>
          <p className="texto-suave">Lo que deja cada socio que pagó</p>
          <p className="numero text-3xl mt-1">{deja ?? "—"}</p>
          <p className="texto-tenue text-sm mt-1">{datos.socios_que_pagaron === 0 ? "Todavía no hay pagos." : `Promedio de ${datos.socios_que_pagaron} ${datos.socios_que_pagaron === 1 ? "socio" : "socios"} que pagaron alguna vez.`}</p>
        </div>
        <div className="tarjeta p-4" data-duracion-socio>
          <p className="texto-suave">Cuánto dura un socio</p>
          <p className="numero text-3xl mt-1">{meses(datos.meses_ex_socios) ?? meses(datos.meses_todos) ?? "—"}</p>
          <p className="texto-tenue text-sm mt-1">
            {datos.meses_ex_socios != null
              ? `Promedio de ${datos.ex_socios} ${datos.ex_socios === 1 ? "socio que ya se fue" : "socios que ya se fueron"}.`
              : datos.meses_todos != null ? `Todavía nadie se fue: promedio de los ${datos.con_cobertura} con cobertura hasta hoy.` : "Todavía no hay coberturas."}
          </p>
        </div>
      </div>
    </section>
  );
}
