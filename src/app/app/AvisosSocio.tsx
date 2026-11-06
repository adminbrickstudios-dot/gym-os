"use client";
import { useState, useTransition } from "react";
import { marcarAvisoLeido } from "./acciones";

export type AvisoApp = { id: string; tipo: string; titulo: string; texto: string; creado_en: string };

/** VD-46D: avisos del gimnasio al socio (hoy, los cambios de precio). "Entendido" deja la constancia de que lo vio. */
export function AvisosSocio({ avisos }: { avisos: AvisoApp[] }) {
  const [vistos, setVistos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const lista = avisos.filter((a) => !vistos.includes(a.id));
  if (!lista.length) return null;
  return (
    <section className="space-y-3" aria-label="Avisos del gimnasio" data-avisos-app={lista.length}>
      {lista.map((a) => (
        <div key={a.id} className="tarjeta p-5 space-y-3" data-aviso-app={a.tipo}>
          <p className="titulo text-xl">📣 {a.titulo}</p>
          <p className="texto-suave">{a.texto}</p>
          <button type="button" className="boton" disabled={ocupado}
            onClick={() => empezar(async () => { const r = await marcarAvisoLeido(a.id); if (r.error) setError(r.error); else { setError(null); setVistos((v) => [...v, a.id]); } })}>
            ✓ Entendido
          </button>
        </div>
      ))}
      {error && <p role="alert" className="pildora pildora-rojo">⚠️ {error}</p>}
    </section>
  );
}
