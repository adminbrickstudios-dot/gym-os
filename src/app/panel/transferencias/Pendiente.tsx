"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { formatearPesos } from "@/lib/formato";
import { aprobar, rechazar, verComprobante } from "./acciones";

export function Pendiente({ p, cuando }: { p: { pago_id: string; socio_id: string; socio: string; monto: number; descripcion: string | null }; cuando: string }) {
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const correr = (f: () => Promise<{ error?: string }>, ok: string) => empezar(async () => { const r = await f(); if (r.error) setError(r.error); else setHecho(ok); });
  const abrir = () => empezar(async () => { const r = await verComprobante(p.pago_id); if (r.url) window.open(r.url, "_blank", "noopener"); else setError(r.error ?? null); });

  if (hecho) return <li className="tarjeta p-4 texto-suave">{hecho} · {p.socio}</li>;
  return (
    <li className="tarjeta p-5">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="numero text-4xl">{formatearPesos(p.monto)}</p>
          <Link href={`/panel/socios/${p.socio_id}`} className="font-semibold text-lg hover:underline">{p.socio}</Link>
          <p className="texto-suave">{p.descripcion ?? "Transferencia"} · {cuando}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="boton" onClick={abrir} disabled={ocupado}>🧾 Ver comprobante</button>
          <button type="button" className="boton boton-principal" disabled={ocupado} onClick={() => correr(() => aprobar(p.pago_id), "✅ Aprobada")}>✅ Aprobar</button>
          {!rechazando && <button type="button" className="boton" onClick={() => setRechazando(true)}>✕ Rechazar</button>}
        </div>
      </div>
      {rechazando && (
        <form className="mt-4 flex flex-col sm:flex-row gap-2" onSubmit={(e) => { e.preventDefault(); if (motivo.trim()) correr(() => rechazar(p.pago_id, motivo), "✕ Rechazada"); }}>
          <input autoFocus className="campo" placeholder="Motivo (le llega al socio): ej. el monto no coincide" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <button type="submit" disabled={!motivo.trim() || ocupado} className="boton boton-peligro">Rechazar</button>
        </form>
      )}
      {error && <p role="alert" className="pildora pildora-rojo mt-3">⚠️ {error}</p>}
    </li>
  );
}
