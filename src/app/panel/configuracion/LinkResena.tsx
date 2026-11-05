"use client";
import { useState, useTransition } from "react";
import { Mensaje } from "@/components/ui/Mensaje";
import { guardarLinkResena } from "./acciones";

/** COM-10: el link de reseñas de Google. Con él, Avisos de hoy sugiere pedirla y la app se la ofrece a los que recomiendan. */
export function LinkResena({ inicial, puedeEditar }: { inicial: string | null; puedeEditar: boolean }) {
  const [link, setLink] = useState(inicial ?? "");
  const [msj, setMsj] = useState<{ ok?: string; error?: string }>({});
  const [ocupado, empezar] = useTransition();
  return (
    <section className="tarjeta p-5 space-y-3 mb-6" data-link-resena>
      <p className="titulo text-xl">⭐ Reseñas en Google</p>
      <p className="texto-suave">Pegá el link para que te dejen una reseña (en Google: tu perfil → “Pedir reseñas” → copiar el vínculo). Con él, Avisos de hoy te sugiere pedírsela al que llega a su entrada 10, y la app se lo ofrece a los que te recomiendan con 9 o 10.</p>
      <div className="flex flex-wrap gap-2">
        <input className="campo flex-1 min-w-60" inputMode="url" autoCapitalize="none" spellCheck={false} value={link} disabled={!puedeEditar}
          onChange={(e) => setLink(e.target.value)} placeholder="https://g.page/r/…/review" aria-label="Link de reseñas de Google" />
        {puedeEditar && <button type="button" className="boton" disabled={ocupado || link.trim() === (inicial ?? "")}
          onClick={() => empezar(async () => { const r = await guardarLinkResena(link); setMsj(r.error ? { error: r.error } : { ok: link.trim() ? "Guardado." : "Sacado: no se piden reseñas." }); })}>Guardar</button>}
      </div>
      {msj.ok && <Mensaje tipo="exito">{msj.ok}</Mensaje>}
      {msj.error && <Mensaje tipo="error">{msj.error}</Mensaje>}
    </section>
  );
}
