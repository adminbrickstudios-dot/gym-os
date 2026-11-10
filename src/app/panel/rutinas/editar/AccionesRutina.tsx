"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { copiarRutina, marcarPlantilla } from "../acciones";
import { Icono } from "@/components/ui/Icono";

/** VD-20: marcar la rutina como plantilla, o sacar una copia propia para editar sin tocar la original. */
export function AccionesRutina({ rutinaId, nombre, plantilla, asignados }: { rutinaId: string; nombre: string; plantilla: boolean; asignados: number }) {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-2" data-acciones-rutina>
      {plantilla && <span className="pildora pildora-azul"><Icono nombre="estrella" /> Plantilla</span>}
      {asignados > 0 && <span className="pildora">{asignados === 1 ? "1 socio la tiene" : `${asignados} socios la tienen`}</span>}
      <button type="button" className="boton" disabled={ocupado} data-copiar-rutina
        onClick={() => empezar(async () => { const r = await copiarRutina(rutinaId, `${nombre} (copia)`); if (r.error || !r.id) setError(r.error ?? "No se pudo copiar"); else router.push(`/panel/rutinas/editar?id=${r.id}`); })}><Icono nombre="documento" /> {plantilla ? "Usar esta plantilla (copia)" : "Hacer una copia"}</button>
      <button type="button" className="boton" disabled={ocupado} data-plantilla
        onClick={() => empezar(async () => { const r = await marcarPlantilla(rutinaId, !plantilla); if (r.error) setError(r.error); else { setError(null); router.refresh(); } })}>{plantilla ? "Dejar de ser plantilla" : "Marcar como plantilla"}</button>
      {error && <p role="alert" className="pildora pildora-rojo whitespace-normal"><Icono nombre="alerta" /> {error}</p>}
    </div>
  );
}
