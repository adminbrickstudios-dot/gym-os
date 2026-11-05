"use client";
import { useState, useTransition } from "react";
import { publicarNovedad, quitarNovedad } from "./acciones";

export type Novedad = { id: string; texto: string; hasta: string; por: string };

/** APP-6: lo que ven todos los socios arriba en la app ("El lunes abrimos a las 10"). */
export function Novedades({ gimnasioId, novedades, puede, hoy }: { gimnasioId: string; novedades: Novedad[]; puede: boolean; hoy: string }) {
  const [texto, setTexto] = useState("");
  const [hasta, setHasta] = useState(hoy);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const fecha = (d: string) => new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", month: "numeric", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
  const publicar = (e: React.FormEvent) => {
    e.preventDefault();
    empezar(async () => { const r = await publicarNovedad(gimnasioId, texto, hasta); if (r.error) setError(r.error); else { setError(null); setTexto(""); } });
  };
  if (!puede && novedades.length === 0) return null;
  return (
    <section className="tarjeta p-5 space-y-4 mb-10" data-novedades-panel>
      <div>
        <h2 className="titulo text-2xl">📣 En la app de los socios</h2>
        <p className="texto-suave">Un aviso corto que todos ven arriba en la app, hasta el día que elijas.</p>
      </div>
      {novedades.length > 0 && (
        <ul className="space-y-2">{novedades.map((n) => (
          <li key={n.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--borde)] px-4 py-3" data-novedad>
            <span className="flex-1 min-w-0">{n.texto}<span className="block text-sm texto-tenue">Hasta el {fecha(n.hasta)} · {n.por}</span></span>
            {puede && <button type="button" disabled={ocupado} className="boton !min-h-11 texto-suave"
              onClick={() => empezar(async () => { const r = await quitarNovedad(n.id); setError(r.error ?? null); })}>Quitar</button>}
          </li>
        ))}</ul>
      )}
      {puede && (
        <form onSubmit={publicar} className="flex flex-wrap gap-3 items-end">
          <label className="flex-1 basis-64 space-y-1"><span className="text-sm texto-suave">Novedad</span>
            <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={280} required placeholder="El lunes 24 abrimos a las 10" className="campo w-full" /></label>
          <label className="space-y-1"><span className="text-sm texto-suave">Se ve hasta</span>
            <input type="date" value={hasta} min={hoy} onChange={(e) => setHasta(e.target.value)} required className="campo" /></label>
          <button type="submit" disabled={ocupado || texto.trim().length < 3} className="boton boton-principal">{ocupado ? "Publicando…" : "Publicar"}</button>
        </form>
      )}
      {error && <p role="alert" className="pildora pildora-rojo">⚠️ {error}</p>}
    </section>
  );
}
