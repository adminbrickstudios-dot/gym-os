"use client";
// VD-46C · El motivo de un descuento sale de la lista del gimnasio (el dueño la edita en Control), no de texto libre.
import { useEffect, useState } from "react";
import { motivosBeneficio } from "@/app/panel/socios/moderacion-acciones";

export function MotivoDescuento({ valor, onChange }: { valor: string; onChange: (motivo: string) => void }) {
  const [motivos, setMotivos] = useState<{ id: string; nombre: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    motivosBeneficio().then((r) => { if (!vivo) return; if (r.error) setError(r.error); else setMotivos(r.motivos ?? []); });
    return () => { vivo = false; };
  }, []);
  if (error) return <p role="alert" className="pildora pildora-rojo whitespace-normal">⚠️ No se pudo traer la lista de motivos: {error}</p>;
  const lista = motivos ?? [];
  return (
    <select className="campo" value={valor} onChange={(e) => onChange(e.target.value)} aria-label="Motivo del descuento" data-motivo-descuento disabled={motivos === null}>
      <option value="">{motivos === null ? "Cargando motivos…" : "Motivo (obligatorio)"}</option>
      {valor && !lista.some((m) => m.nombre === valor) && <option value={valor}>{valor}</option>}
      {lista.map((m) => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
    </select>
  );
}
