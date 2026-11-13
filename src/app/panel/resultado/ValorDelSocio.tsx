import { formatearPesos } from "@/lib/formato";
import { Icono } from "@/components/ui/Icono";

export type ValorSocio = { deja_por_mes: number | null; socios_que_pagaron: number; ventana_dias: number; dura_meses: number | null; socios_que_se_fueron: number };

const meses = (n: number) => `${String(n).replace(".", ",")} ${n === 1 ? "mes" : "meses"}`;

/** N10 (función nueva `valor_del_socio`, apagada por defecto): lo que deja un socio por mes y cuánto se queda. Lo calcula la base con lo ya guardado. */
export function ValorDelSocio({ v }: { v: ValorSocio }) {
  return (
    <section aria-labelledby="valor-socio" data-valor-socio className="space-y-3">
      <h2 id="valor-socio" className="titulo text-2xl">Cuánto deja un socio</h2>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-8">
        <div className="flex flex-col-reverse">
          <dt className="texto-suave mt-2 text-[15px]"><span aria-hidden><Icono nombre="usuarios" sistema /></span> Lo que deja por mes</dt>
          <dd className="numero text-4xl sm:text-5xl" data-valor-deja>{v.deja_por_mes === null ? "—" : formatearPesos(v.deja_por_mes)}</dd>
        </div>
        <div className="flex flex-col-reverse">
          <dt className="texto-suave mt-2 text-[15px]"><span aria-hidden><Icono nombre="repetir" sistema /></span> Cuánto se queda</dt>
          <dd className="numero text-4xl sm:text-5xl" data-valor-dura>{v.dura_meses === null ? "—" : meses(v.dura_meses)}</dd>
        </div>
      </dl>
      <p className="text-sm texto-tenue" data-valor-explicacion>
        {v.deja_por_mes === null
          ? "Todavía no hay socios que hayan pagado: cuando haya cobros se calcula solo."
          : `Lo que pagó cada uno de los ${v.socios_que_pagaron} ${v.socios_que_pagaron === 1 ? "socio que pagó" : "socios que pagaron"} en los últimos ${v.ventana_dias} días, por mes. Es plata cobrada (sin la cuenta corriente ni las ventas sin socio), no el precio de lista.`}
        {" "}
        {v.dura_meses === null
          ? "Cuánto se queda no se puede calcular todavía: no se fue ningún socio que haya pagado."
          : `Cuánto se queda: el promedio de ${v.socios_que_se_fueron} ${v.socios_que_se_fueron === 1 ? "socio que ya se fue" : "socios que ya se fueron"}, desde que empezó su primera membresía hasta que terminó la última o se lo dio de baja.`}
      </p>
    </section>
  );
}
