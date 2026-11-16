"use client";
// D83 · "Dar el alta y cobrar" para el socio con cuenta y SIN plan: se elige el plan (las mismas tarjetas del alta, con el primer pago que calcula la base),
// se le asigna (sin cobertura hasta pagar: la puerta sigue decidiendo con calcular_acceso) y se abre la hoja Cobrar.
import { useEffect, useRef, useState, useTransition } from "react";
import { Icono } from "@/components/ui/Icono";
import { Mensaje } from "@/components/ui/Mensaje";
import { planesParaAlta, type PlanParaAlta } from "@/app/panel/socios/acciones";
import { asignarPlanSocio } from "@/app/panel/entrada/ventana-acciones";
import { TarjetasPlan, PrimerPago } from "../TarjetasPlan";

export default function ElegirPlanSocio({ sedeId, socioId, alAsignar, alVolver, sinPlanes }: {
  sedeId: string; socioId: string; alAsignar: () => void; alVolver: () => void; sinPlanes: () => void;
}) {
  const [planes, setPlanes] = useState<PlanParaAlta[] | null>(null);
  const [plan, setPlan] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const sinPlanesRef = useRef(sinPlanes);
  useEffect(() => { sinPlanesRef.current = sinPlanes; });
  useEffect(() => {
    let vivo = true;
    void planesParaAlta(sedeId).then((r) => {
      if (!vivo) return;
      if (r.error) { setError(r.error); setPlanes([]); return; }
      setPlanes(r.planes ?? []);
      // Sin planes cargados no hay nada que elegir: se sigue directo a la hoja (pase o pack desde "Agregar", como antes).
      if (!r.planes?.length) sinPlanesRef.current();
    });
    return () => { vivo = false; };
  }, [sedeId]);
  const elegido = planes?.find((p) => p.plan_id === plan) ?? null;
  const asignar = () => empezar(async () => {
    const r = await asignarPlanSocio(socioId, plan);
    if (r.error) { setError(r.error); return; }
    alAsignar();
  });
  return (
    <div className="space-y-4" data-elegir-plan-socio>
      <p className="titulo text-2xl"><Icono nombre="pesa" /> Elegí el plan</p>
      {planes === null ? <div className="h-24 rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto" aria-hidden /> : <TarjetasPlan planes={planes} valor={plan} alElegir={setPlan} />}
      {elegido && <PrimerPago plan={elegido} />}
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="boton boton-principal text-lg px-8" disabled={!plan || ocupado} onClick={asignar} data-elegir-plan-cobrar>{ocupado ? "Asignando…" : "Asignar y cobrar"}</button>
        <button type="button" className="boton" onClick={alVolver} disabled={ocupado}>← Volver</button>
      </div>
    </div>
  );
}
