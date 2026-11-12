"use client";
import { LinkPanel } from "@/components/panel/LinkPanel";
import { useState, useTransition } from "react";
import { formatearPesos } from "@/lib/formato";
import { refrescarPendientes } from "@/lib/panel/pendientes";
import { aprobar, rechazar, verComprobante } from "./acciones";
import { Icono } from "@/components/ui/Icono";

export function Pendiente({ p, cuando }: { p: { pago_id: string; socio_id: string; socio: string; monto: number; descripcion: string | null }; cuando: string }) {
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const correr = (f: () => Promise<{ error?: string }>, ok: string) => empezar(async () => { const r = await f(); if (r.error) setError(r.error); else { setHecho(ok); refrescarPendientes(); } });
  // Z6: el comprobante se ve ahí mismo, en miniatura (el link firmado dura 10 minutos y se pide recién al tocar). Tocar la imagen la abre grande.
  const [url, setUrl] = useState<string | null>(null);
  const [noEsImagen, setNoEsImagen] = useState(false);
  const abrir = () => {
    if (url) { setUrl(null); setNoEsImagen(false); return; }
    empezar(async () => {
      const r = await verComprobante(p.pago_id);
      if (r.url) { setError(null); setUrl(r.url); } else setError(r.error ?? "No se pudo abrir el comprobante");
    });
  };

  if (hecho) return <li className="tarjeta p-4 texto-suave">{hecho} · {p.socio}</li>;
  return (
    <li className="tarjeta p-5">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="numero text-4xl">{formatearPesos(p.monto)}</p>
          <LinkPanel href={`/panel/socios/${p.socio_id}`} siNoEsta="texto" className="font-semibold text-lg hover:underline" textoClassName="font-semibold text-lg block">{p.socio}</LinkPanel>
          <p className="texto-suave">{p.descripcion ?? "Transferencia"} · {cuando}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="boton" onClick={abrir} disabled={ocupado}><Icono nombre="recibo" /> {url ? "Ocultar comprobante" : "Ver comprobante"}</button>
          <button type="button" className="boton boton-principal" disabled={ocupado} onClick={() => correr(() => aprobar(p.pago_id), `Aprobada ${formatearPesos(p.monto)}`)}>{ocupado ? "Aprobando…" : <><Icono nombre="ok" /> Aprobar</>}</button>
          {!rechazando && <button type="button" className="boton" onClick={() => setRechazando(true)}><Icono nombre="cerrar" /> Rechazar</button>}
        </div>
      </div>
      {url && (
        <div className="mt-4" data-comprobante>
          {noEsImagen
            ? <a href={url} target="_blank" rel="noopener noreferrer" className="boton"><Icono nombre="recibo" /> Abrir el comprobante</a>
            : <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Abrir el comprobante en grande">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Comprobante de ${p.socio}`} loading="lazy" onError={() => setNoEsImagen(true)} className="max-h-72 w-auto max-w-full rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--tarjeta-alta)]" />
              </a>}
        </div>
      )}
      {rechazando && (
        <form className="mt-4 flex flex-col sm:flex-row gap-2" onSubmit={(e) => { e.preventDefault(); if (motivo.trim()) correr(() => rechazar(p.pago_id, motivo), `Rechazada ${formatearPesos(p.monto)}`); }}>
          <input autoFocus className="campo" placeholder="Motivo (le llega al socio): ej. el monto no coincide" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <button type="submit" disabled={!motivo.trim() || ocupado} className="boton boton-peligro">{ocupado ? "Rechazando…" : "Rechazar"}</button>
        </form>
      )}
      {error && <p role="alert" className="pildora pildora-rojo mt-3"><Icono nombre="alerta" /> {error}</p>}
    </li>
  );
}
