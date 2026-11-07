"use client";
// VD-6 · Elegir el plan del alta con tarjetas, y el primer pago que calculó la base (cuota + matrícula).
// Acá no se suma nada: planes_para_alta trae la cuota de lista, la de efectivo, la matrícula y los totales.
import type { PlanParaAlta } from "@/app/panel/socios/acciones";
import { formatearPesos } from "@/lib/formato";

export function TarjetasPlan({ planes, valor, alElegir }: { planes: PlanParaAlta[]; valor: string; alElegir: (planId: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Plan" className="grid sm:grid-cols-2 gap-3" data-plan-alta>
      {planes.map((p) => {
        const marcado = p.plan_id === valor;
        return (
          <button key={p.plan_id} type="button" role="radio" aria-checked={marcado} data-plan-tarjeta={p.plan_id} data-plan-nombre={p.nombre}
            onClick={() => alElegir(marcado ? "" : p.plan_id)}
            className={`tarjeta p-4 text-left space-y-1 active:scale-[.99] transition-transform ${marcado ? "!border-[var(--acento)] ring-2 ring-[var(--acento)]" : ""}`}>
            <span className="block font-semibold text-lg break-words">{p.nombre}</span>
            {p.duracion_meses ? <span className="block texto-tenue text-sm">{p.duracion_meses === 1 ? "Mensual" : `${p.duracion_meses} meses`}</span> : null}
            <span className="block text-2xl font-bold numero">{p.lista != null ? formatearPesos(p.lista) : "Sin precio"}</span>
            {p.matricula ? <span className="block texto-suave text-sm">+ matrícula {formatearPesos(p.matricula)}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** El primer pago del plan elegido: cuota, matrícula y total, como lo calcula la base. */
export function PrimerPago({ plan }: { plan: PlanParaAlta }) {
  return (
    <div className="tarjeta p-4 space-y-1" data-primer-pago data-total={plan.total_lista ?? ""} aria-live="polite">
      <p className="titulo-grupo">Primer pago · {plan.nombre}</p>
      <p className="flex justify-between gap-3"><span className="texto-suave">Cuota</span><span className="numero">{plan.lista != null ? formatearPesos(plan.lista) : "—"}</span></p>
      {plan.matricula ? <p className="flex justify-between gap-3"><span className="texto-suave">Matrícula</span><span className="numero">{formatearPesos(plan.matricula)}</span></p> : null}
      <p className="flex justify-between gap-3 text-xl font-bold border-t border-[var(--borde)] pt-2"><span>Total</span><span className="numero">{plan.total_lista != null ? formatearPesos(plan.total_lista) : "—"}</span></p>
      {plan.total_efectivo != null && plan.total_efectivo !== plan.total_lista
        ? <p className="texto-tenue text-sm">En efectivo o transferencia: {formatearPesos(plan.total_efectivo)}</p> : null}
      {plan.renovacion === "dia_fijo" && plan.dia_fijo ? <p className="texto-suave text-sm" data-dia-fijo>Este plan vence cada día {plan.dia_fijo} del mes.</p> : null}
      <p className="texto-tenue text-sm">El total final lo confirma la hoja de cobro (medio de pago, descuentos, convenio).</p>
    </div>
  );
}
