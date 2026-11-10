"use client";
import { useState, useTransition } from "react";
import { cerrarNovedadGymOS } from "@/app/panel/acciones";
import { Icono } from "@/components/ui/Icono";

export type NovedadGymOS = { id: string; titulo: string; texto: string; link: string | null };

/** ADM-6: lo que cuenta BRIK, arriba en el Inicio del dueño hasta que la cierra. */
export function NovedadesGymOS({ novedades }: { novedades: NovedadGymOS[] }) {
  const [cerradas, setCerradas] = useState<string[]>([]);
  const [, empezar] = useTransition();
  const visibles = novedades.filter((n) => !cerradas.includes(n.id));
  if (visibles.length === 0) return null;
  return (
    <div className="space-y-2" data-novedades-gymos>
      {visibles.map((n) => (
        <div key={n.id} className="mensaje mensaje-info flex flex-wrap items-start gap-3">
          <span className="flex-1 min-w-0"><span className="block font-semibold"><Icono nombre="estrella" /> {n.titulo}</span><span className="block">{n.texto}</span>
            {n.link && <a href={n.link} target="_blank" rel="noopener noreferrer" className="underline text-sm">Ver más</a>}</span>
          <button type="button" className="boton boton-chico" onClick={() => { setCerradas((c) => [...c, n.id]); empezar(async () => { await cerrarNovedadGymOS(n.id); }); }}>Entendido</button>
        </div>
      ))}
    </div>
  );
}
