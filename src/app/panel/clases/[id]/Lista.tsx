"use client";
import { useEffect, useState, useTransition } from "react";
import { buscarSociosRapido, type ResultadoSocio } from "@/app/panel/acciones";
import { PuntoEstado } from "@/components/panel/Estado";
import { anotar, cancelarClase, deshacerPresente, perdonarFalta, presente } from "../acciones";
import { AvisoSalud } from "@/components/ui/AvisoSalud";
import { detectarSalud } from "@/lib/salud";
import { Mensaje } from "@/components/ui/Mensaje";
import { Vacio } from "@/components/ui/Vacio";

type Fila = { socio_id: string; nombre: string; estado: string; posicion: number | null; presente: boolean; telefono?: string | null };
const ESTADO: Record<string, string> = { confirmada: "Reservó", espera: "En espera", sin_reserva: "Vino sin reservar" };

export type FaltaClase = { socio_id: string; perdonada: boolean; motivo: string | null };

export function Lista({ claseId, filas, reserva, puedeCancelar, cancelada, buscaSocios, faltas = [], fotos = {} }: { claseId: string; filas: Fila[]; reserva: boolean; puedeCancelar: boolean; cancelada: boolean; buscaSocios: boolean; faltas?: FaltaClase[]; fotos?: Record<string, string> }) {
  const [error, setError] = useState<string | null>(null);
  // VD-46Q: perdonar una falta desde la lista (solo llega `faltas` al dueño y al encargado, con la clase ya terminada).
  const [perdonando, setPerdonando] = useState<string | null>(null);
  const [motivoPerdon, setMotivoPerdon] = useState("");
  const [ocupado, empezar] = useTransition();
  const [texto, setTexto] = useState("");
  const [encontrados, setEncontrados] = useState<ResultadoSocio[]>([]);
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState("");
  // CLA-7: deshacer un presente (se pide el motivo en la misma fila).
  const [deshaciendo, setDeshaciendo] = useState<string | null>(null);
  const [porQue, setPorQue] = useState("");
  const correr = (f: () => Promise<{ error?: string }>) => empezar(async () => { const r = await f(); setError(r.error ?? null); if (!r.error) { setTexto(""); setEncontrados([]); } });

  useEffect(() => {
    if (!buscaSocios || texto.trim().length < 2) { setEncontrados([]); return; }
    const t = setTimeout(async () => setEncontrados((await buscarSociosRapido(texto.trim())).socios ?? []), 150);
    return () => clearTimeout(t);
  }, [texto, buscaSocios]);

  return (
    <div className="space-y-8">
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {filas.length === 0 ? <Vacio emoji="🙋" titulo="Todavía no se anotó nadie">Los socios se anotan desde su app; también los podés sumar desde la recepción.</Vacio> : (
        <ul className="space-y-2">
          {filas.map((f) => (
            <li key={f.socio_id} className="tarjeta flex flex-wrap items-center gap-4 px-4 py-3 min-h-[64px]">
              {/* FA-11: la foto de cada anotado (o sus iniciales), para reconocerlo en la sala. */}
              <span className="flex-none size-12 rounded-2xl overflow-hidden grid place-items-center titulo text-xl bg-[var(--tarjeta-alta)]" data-foto-anotado={fotos[f.socio_id] ? "si" : "no"} aria-hidden>
                {fotos[f.socio_id]
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={`/panel/socios/${f.socio_id}/foto?v=${fotos[f.socio_id]}`} alt="" loading="lazy" className="w-full h-full object-cover" />
                  : f.nombre.trim().split(/\s+/).map((x) => x[0]).slice(0, 2).join("").toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-lg truncate">{f.nombre}</span>
                {f.telefono && <a href={`https://wa.me/${f.telefono.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="block text-sm texto-suave underline" data-telefono-lista>💬 {f.telefono}</a>}
                <span className="block texto-suave text-sm">{f.estado === "espera" && f.posicion ? `${f.posicion}° en espera` : ESTADO[f.estado] ?? f.estado}</span>
              </span>
              {f.presente && deshaciendo === f.socio_id ? (
                <form className="flex flex-wrap items-center gap-2 basis-full sm:basis-auto" onSubmit={(e) => { e.preventDefault(); if (porQue.trim()) correr(() => deshacerPresente(claseId, f.socio_id, porQue)); setDeshaciendo(null); setPorQue(""); }}>
                  <input autoFocus className="campo !w-auto flex-1 min-w-40" value={porQue} onChange={(e) => setPorQue(e.target.value)} placeholder="¿Por qué? Ej: lo marqué por error" aria-label={`Por qué se deshace el presente de ${f.nombre}`} />
                  <button type="submit" className="boton !min-h-11" disabled={!porQue.trim() || ocupado}>Deshacer</button>
                  <button type="button" className="boton-texto texto-suave" onClick={() => setDeshaciendo(null)}>Volver</button>
                </form>
              ) : f.presente ? (
                <span className="flex items-center gap-2">
                  <span className="pildora pildora-verde">✅ Presente</span>
                  <button type="button" className="boton-texto texto-suave text-sm" onClick={() => setDeshaciendo(f.socio_id)} aria-label={`Deshacer el presente de ${f.nombre}`}>↩️ Deshacer</button>
                </span>
              )
                : !cancelada && f.estado !== "espera" && <button type="button" disabled={ocupado} className="boton !min-h-11" onClick={() => correr(() => presente(claseId, f.socio_id))}>✅ Presente</button>}
              {!f.presente && faltas.find((x) => x.socio_id === f.socio_id) && (() => {
                const x = faltas.find((y) => y.socio_id === f.socio_id)!;
                if (x.perdonada) return <span className="pildora basis-full sm:basis-auto" data-falta-perdonada>🤝 Falta perdonada: {x.motivo}</span>;
                if (perdonando !== f.socio_id) return <button type="button" className="boton !min-h-11" onClick={() => { setPerdonando(f.socio_id); setMotivoPerdon(""); }} data-perdonar-falta aria-label={`Perdonar la falta de ${f.nombre}`}>🤝 Perdonar falta</button>;
                return (
                  <form className="flex flex-wrap items-center gap-2 basis-full" onSubmit={(e) => { e.preventDefault(); if (motivoPerdon.trim().length >= 3 && !detectarSalud(motivoPerdon)) { const m = motivoPerdon.trim(); setPerdonando(null); correr(() => perdonarFalta(claseId, f.socio_id, m)); } }} data-form-perdon>
                    <input autoFocus className="campo !w-auto flex-1 min-w-40" maxLength={300} value={motivoPerdon} onChange={(e) => setMotivoPerdon(e.target.value)} placeholder="¿Por qué? Ej: avisó por teléfono" aria-label={`Motivo para perdonar la falta de ${f.nombre}`} />
                    <button type="submit" className="boton !min-h-11" disabled={motivoPerdon.trim().length < 3 || !!detectarSalud(motivoPerdon) || ocupado} data-confirmar-perdon>Perdonar</button>
                    <button type="button" className="boton-texto texto-suave" onClick={() => setPerdonando(null)}>Volver</button>
                    <span className="basis-full"><AvisoSalud texto={motivoPerdon} /></span>
                  </form>
                );
              })()}
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
                {reserva && <button type="button" disabled={ocupado} className="boton boton-chico" onClick={() => correr(() => anotar(claseId, s.socio_id))}>Reservar</button>}
                <button type="button" disabled={ocupado} className="boton boton-chico" onClick={() => correr(() => presente(claseId, s.socio_id))}>Presente</button>
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
