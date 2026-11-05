"use client";
import { useEffect, useState, useTransition } from "react";
import { buscarSociosRapido, type ResultadoSocio } from "@/app/panel/acciones";
import { PuntoEstado } from "@/components/panel/Estado";
import { asignarRutina } from "../acciones";

/** RUT-2: buscar un socio y darle esta rutina (el profe busca con nombre y semáforo). */
export function AsignarRutina({ rutinaId }: { rutinaId: string }) {
  const [texto, setTexto] = useState("");
  const [socios, setSocios] = useState<ResultadoSocio[]>([]);
  const [hechos, setHechos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  useEffect(() => {
    if (texto.trim().length < 2) return;
    const t = setTimeout(async () => { const r = await buscarSociosRapido(texto.trim()); setSocios(r.socios ?? []); setError(r.error ?? null); }, 200);
    return () => clearTimeout(t);
  }, [texto]);
  return (
    <section className="tarjeta p-4 sm:p-5 space-y-3" data-asignar-rutina>
      <h2 className="titulo text-2xl">👤 Asignar a un socio</h2>
      <p className="texto-suave text-sm">La ve en su app, día por día, y anota sus pesos. Si tenía otra, se reemplaza.</p>
      <input className="campo" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="🔍 Buscar socio por nombre" aria-label="Buscar socio para asignar" />
      {texto.trim().length >= 2 && socios.length > 0 && (
        <ul className="space-y-1">{socios.map((s) => (
          <li key={s.socio_id} className="flex items-center gap-3 min-h-[52px]">
            <PuntoEstado color={s.color} />
            <span className="flex-1 min-w-0 truncate font-semibold">{s.nombre}</span>
            {hechos.includes(s.socio_id) ? <span className="pildora pildora-verde">✓ Asignada</span> : (
              <button type="button" className="boton boton-chico" disabled={ocupado}
                onClick={() => empezar(async () => { const r = await asignarRutina(s.socio_id, rutinaId); if (r.error) setError(r.error); else setHechos((h) => [...h, s.socio_id]); })}>Asignar</button>
            )}
          </li>
        ))}</ul>
      )}
      {error && <p role="alert" className="pildora pildora-rojo">⚠️ {error}</p>}
    </section>
  );
}
