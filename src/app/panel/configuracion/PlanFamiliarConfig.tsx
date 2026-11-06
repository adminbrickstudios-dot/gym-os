"use client";
import { useState, useTransition } from "react";
import { Interruptor } from "@/components/ui/Interruptor";
import { Mensaje } from "@/components/ui/Mensaje";
import { guardarPlanFamiliar } from "./acciones";

/** VD-46G: el interruptor del plan familiar/corporativo. Arranca apagado; lo prende solo el dueño (guarda al tocarlo). */
export function PlanFamiliarConfig({ inicial, puedeEditar }: { inicial: boolean; puedeEditar: boolean }) {
  const [activo, setActivo] = useState(inicial);
  const [estado, setEstado] = useState<{ ok?: boolean; error?: string }>({});
  const [ocupado, empezar] = useTransition();
  return (
    <section className="tarjeta p-5 sm:p-6 space-y-2" data-plan-familiar-config={activo ? "prendido" : "apagado"}>
      <p className="titulo text-2xl">👨‍👩‍👧 Plan familiar y corporativo</p>
      <Interruptor etiqueta="Un titular paga por los demás" data-opcion="plan-familiar" checked={activo} disabled={!puedeEditar || ocupado}
        ayuda={activo
          ? "Prendido: en la ficha de un grupo familiar elegís quién paga; los demás entran con su plan. Si el titular vence o se da de baja, a cada uno se le explica. Los cobros van al titular."
          : "Apagado: cada socio entra solo con su propio plan, aunque esté vinculado a una familia."}
        onChange={(e) => {
          const nuevo = e.target.checked;
          setEstado({});
          empezar(async () => {
            const r = await guardarPlanFamiliar(nuevo);
            if (r.error) setEstado({ error: r.error }); else { setActivo(nuevo); setEstado({ ok: true }); }
          });
        }} />
      {!puedeEditar && <p className="texto-tenue text-sm">Lo prende el dueño.</p>}
      {estado.error && <Mensaje tipo="error">{estado.error}</Mensaje>}
      {estado.ok && <Mensaje tipo="exito">{activo ? "Plan familiar prendido. Armalo desde la ficha de cualquier socio de la familia." : "Plan familiar apagado: cada uno entra con su propio plan."}</Mensaje>}
    </section>
  );
}
