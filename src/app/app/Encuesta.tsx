"use client";
import { useState, useTransition } from "react";
import { Mensaje } from "@/components/ui/Mensaje";
import { responderEncuesta } from "./acciones";

/** COM-10: una sola pregunta, del 0 al 10. Los que recomiendan (9 y 10) ven la reseña y la invitación a traer a un amigo. */
export function Encuesta({ socioId }: { socioId: string }) {
  const [r, setR] = useState<{ promotor: boolean; link_resena: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  if (r) {
    return (
      <section className="tarjeta p-5 space-y-3" data-encuesta="respondida">
        <p className="titulo text-xl">🙏 ¡Gracias!</p>
        {r.promotor ? (
          <>
            <p className="texto-suave">Nos alegra un montón. ¿Nos ayudás a que más gente nos conozca?</p>
            <div className="flex flex-wrap gap-2">
              {r.link_resena && <a href={r.link_resena} target="_blank" rel="noopener noreferrer" className="boton boton-principal">⭐ Dejar una reseña en Google</a>}
              <a href="#referir" className="boton">🤝 Invitar a un amigo</a>
            </div>
          </>
        ) : <p className="texto-suave">Lo vamos a tener en cuenta. Si querés contarnos más, escribile a recepción.</p>}
      </section>
    );
  }
  return (
    <section className="tarjeta p-5 space-y-3" data-encuesta="pendiente">
      <p className="titulo text-xl">⭐ Una sola pregunta</p>
      <p className="texto-suave">Del 0 al 10, ¿cuánto nos recomendarías a un amigo?</p>
      <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5">
        {Array.from({ length: 11 }, (_, n) => (
          <button key={n} type="button" disabled={ocupado} className="boton !min-h-12 !px-0 numero" aria-label={`${n} de 10`}
            onClick={() => empezar(async () => { const x = await responderEncuesta(socioId, n); if (x.error) setError(x.error); else setR(x.r!); })}>{n}</button>
        ))}
      </div>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
    </section>
  );
}
