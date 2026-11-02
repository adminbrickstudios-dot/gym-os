"use client";
import { useEffect, useState, useTransition } from "react";
import { buscarSociosRapido, type ResultadoSocio } from "@/app/panel/acciones";
import { PuntoEstado } from "@/components/panel/Estado";
import { anotar, cancelarClase, presente } from "../acciones";

type Fila = { socio_id: string; nombre: string; estado: string; posicion: number | null; presente: boolean };
const ESTADO: Record<string, string> = { confirmada: "Reservó", espera: "En espera", sin_reserva: "Vino sin reservar" };

export function Lista({ claseId, filas, reserva, puedeCancelar, cancelada, buscaSocios }: { claseId: string; filas: Fila[]; reserva: boolean; puedeCancelar: boolean; cancelada: boolean; buscaSocios: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const [texto, setTexto] = useState("");
  const [encontrados, setEncontrados] = useState<ResultadoSocio[]>([]);
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const correr = (f: () => Promise<{ error?: string }>) => empezar(async () => { const r = await f(); setError(r.error ?? null); if (!r.error) { setTexto(""); setEncontrados([]); } });

  useEffect(() => {
    if (!buscaSocios || texto.trim().length < 2) { setEncontrados([]); return; }
    const t = setTimeout(async () => setEncontrados((await buscarSociosRapido(texto.trim())).socios ?? []), 150);
    return () => clearTimeout(t);
  }, [texto, buscaSocios]);

  return (
    <div className="space-y-8">
      {error && <p role="alert" className="pildora pildora-rojo !rounded-2xl !px-4 !py-3 w-full">⚠️ {error}</p>}
      {filas.length === 0 ? <p className="texto-suave text-lg">Todavía no se anotó nadie.</p> : (
        <ul className="space-y-2">
          {filas.map((f) => (
            <li key={f.socio_id} className="tarjeta flex items-center gap-4 px-4 py-3 min-h-[64px]">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-lg truncate">{f.nombre}</span>
                <span className="block texto-suave text-sm">{f.estado === "espera" && f.posicion ? `${f.posicion}° en espera` : ESTADO[f.estado] ?? f.estado}</span>
              </span>
              {f.presente ? <span className="pildora pildora-verde">✅ Presente</span>
                : !cancelada && f.estado !== "espera" && <button type="button" disabled={ocupado} className="boton boton-principal !min-h-11" onClick={() => correr(() => presente(claseId, f.socio_id))}>✅ Presente</button>}
            </li>
          ))}
        </ul>
      )}

      {!cancelada && buscaSocios && (
        <section>
          <p className="titulo text-xl mb-2">➕ Agregar a alguien</p>
          <input value={texto} onChange={(e) => setTexto(e.target.value)} className="campo" placeholder="🔍 Buscar socio" aria-label="Buscar socio para la clase" />
          <ul className="mt-2 space-y-1">
            {encontrados.map((s) => (
              <li key={s.socio_id} className="flex items-center gap-3 px-2 py-2">
                <PuntoEstado color={s.color} />
                <span className="flex-1 truncate font-semibold">{s.nombre}</span>
                {reserva && <button type="button" disabled={ocupado} className="boton !min-h-10" onClick={() => correr(() => anotar(claseId, s.socio_id))}>Reservar</button>}
                <button type="button" disabled={ocupado} className="boton boton-principal !min-h-10" onClick={() => correr(() => presente(claseId, s.socio_id))}>Presente</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!cancelada && puedeCancelar && (
        cancelando ? (
          <form className="tarjeta p-4 space-y-3" onSubmit={(e) => { e.preventDefault(); if (motivo.trim()) correr(() => cancelarClase(claseId, motivo)); }}>
            <p className="font-semibold">¿Por qué se cancela? Les llega a los anotados.</p>
            <input autoFocus className="campo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: el profe está enfermo" />
            <div className="flex gap-2"><button type="submit" className="boton boton-peligro" disabled={!motivo.trim() || ocupado}>Cancelar la clase</button><button type="button" className="boton" onClick={() => setCancelando(false)}>Volver</button></div>
          </form>
        ) : <button type="button" className="boton texto-suave" onClick={() => setCancelando(true)}>🚫 Cancelar esta clase</button>
      )}
    </div>
  );
}
