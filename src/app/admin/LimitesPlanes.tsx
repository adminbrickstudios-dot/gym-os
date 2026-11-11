"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { guardarLimitesPlan } from "./acciones";

export type PlanConLimites = { id: string; nombre: string; activo: boolean; max_socios: number | null; max_sedes: number | null; gimnasios: number };
const aNumero = (s: string) => (s.trim() === "" ? null : Number(s.replace(/\./g, "")));

function Fila({ plan }: { plan: PlanConLimites }) {
  const router = useRouter();
  const [socios, setSocios] = useState(plan.max_socios == null ? "" : String(plan.max_socios));
  const [sedes, setSedes] = useState(plan.max_sedes == null ? "" : String(plan.max_sedes));
  const [error, setError] = useState("");
  return (
    <li className="tarjeta p-3 flex flex-wrap items-end gap-3" data-plan-limites={plan.id}>
      <span className="min-w-[10rem] flex-1"><span className="font-semibold">{plan.nombre}</span> <span className="texto-tenue text-sm">({plan.gimnasios} {plan.gimnasios === 1 ? "gimnasio" : "gimnasios"})</span></span>
      <label className="space-y-1"><span className="etiqueta">Socios máximos</span><input className="campo !w-32" inputMode="numeric" value={socios} placeholder="sin límite" onChange={(e) => setSocios(e.target.value)} /></label>
      <label className="space-y-1"><span className="etiqueta">Sedes máximas</span><input className="campo !w-28" inputMode="numeric" value={sedes} placeholder="sin límite" onChange={(e) => setSedes(e.target.value)} /></label>
      <BotonAccion className="boton" data-guardar-limites onClick={async () => {
        const a = aNumero(socios), b = aNumero(sedes);
        if ((a !== null && !Number.isFinite(a)) || (b !== null && !Number.isFinite(b))) { setError("Escribí solo números"); return; }
        const r = await guardarLimitesPlan(plan.id, a, b);
        if (r.error) { setError(r.error); return; }
        setError(""); router.refresh();
      }}>Guardar</BotonAccion>
      {error && <span role="alert" className="pildora pildora-rojo basis-full">{error}</span>}
    </li>
  );
}

export function LimitesPlanes({ planes }: { planes: PlanConLimites[] }) {
  if (planes.length === 0) return <p className="texto-tenue">Todavía no hay planes de BRIK: creá uno en “Planes de Base”.</p>;
  return <ul className="space-y-2" data-limites-planes>{planes.map((p) => <Fila key={`${p.id}-${p.max_socios}-${p.max_sedes}`} plan={p} />)}</ul>;
}
