"use client";
// Grupo familiar: quiénes son de la misma familia (con su estado) y sumar a alguien.
import Link from "next/link";
import { useState, useTransition } from "react";
import { PuntoEstado } from "@/components/panel/Estado";
import { buscarSociosRapido, type ResultadoSocio } from "@/app/panel/acciones";
import { sacarDeFamilia, vincularFamilia } from "../acciones";

export type Familiar = { socio_id: string; numero: number; nombre: string; color: string; texto: string };

export function Familia({ socioId, familia }: { socioId: string; familia: Familiar[] }) {
  const [texto, setTexto] = useState("");
  const [encontrados, setEncontrados] = useState<ResultadoSocio[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const buscar = (t: string) => { setTexto(t); if (t.trim().length < 2) { setEncontrados([]); return; }
    void buscarSociosRapido(t).then((r) => { setEncontrados((r.socios ?? []).filter((s) => s.socio_id !== socioId && !familia.some((f) => f.socio_id === s.socio_id))); setError(r.error ?? null); }); };
  return (
    <div className="tarjeta p-6 sm:col-span-2 space-y-3 min-w-0" data-familia={familia.length}>
      <p className="titulo text-2xl">👨‍👩‍👧 Familia</p>
      {familia.length === 0 && <p className="texto-suave">No está vinculado con nadie. Sumá a quien viene con él (hermana, hijo…) para verlos juntos.</p>}
      <ul className="space-y-1">
        {familia.map((f) => (
          <li key={f.socio_id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-1">
            <PuntoEstado color={f.color} />
            <Link href={`/panel/socios/${f.socio_id}`} className="font-semibold hover:underline">{f.nombre} <span className="texto-tenue font-normal">#{f.numero}</span></Link>
            <span className="texto-suave text-sm min-w-0 flex-1 basis-40">{f.texto}</span>
            <button type="button" className="text-sm texto-suave underline" disabled={ocupado}
              onClick={() => empezar(async () => { const r = await sacarDeFamilia(socioId, f.socio_id); setError(r.error ?? null); })}>Sacar</button>
          </li>
        ))}
      </ul>
      <div className="space-y-2">
        <input value={texto} onChange={(e) => buscar(e.target.value)} placeholder="➕ Sumar a la familia: nombre o DNI" aria-label="Sumar a la familia" className="campo" />
        {encontrados.length > 0 && (
          <ul className="space-y-1">
            {encontrados.map((s) => (
              <li key={s.socio_id}>
                <button type="button" className="fila !min-h-12" disabled={ocupado}
                  onClick={() => empezar(async () => { const r = await vincularFamilia(socioId, s.socio_id); setError(r.error ?? null); if (!r.error) { setTexto(""); setEncontrados([]); } })}>
                  <PuntoEstado color={s.color} /> <span className="font-semibold">{s.nombre}</span> <span className="texto-tenue">#{s.numero}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <p role="alert" className="pildora pildora-rojo">⚠️ {error}</p>}
      <p className="text-sm texto-tenue">Estar en la misma familia no cambia el precio (los descuentos son otra cosa).</p>
    </div>
  );
}
