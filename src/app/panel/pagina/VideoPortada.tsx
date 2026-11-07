"use client";
import { useState, useTransition } from "react";
import { Mensaje } from "@/components/ui/Mensaje";
import { guardarVideoPortada } from "./acciones";

/** VD-62: un video corto de fondo en la portada (mudo y en bucle). El dueño pega el link directo a un .mp4 o .webm. */
export function VideoPortada({ inicial, puedeEditar }: { inicial: string | null; puedeEditar: boolean }) {
  const [guardado, setGuardado] = useState(inicial ?? "");
  const [url, setUrl] = useState(inicial ?? "");
  const [msj, setMsj] = useState<{ ok?: string; error?: string }>({});
  const [ocupado, empezar] = useTransition();
  return (
    <section className="tarjeta p-5 space-y-3 mt-6" data-video-portada-panel>
      <p className="titulo text-xl">🎬 Video de portada</p>
      <p className="texto-suave">Un video corto (unos 10 segundos, sin sonido) que se repite de fondo arriba de todo. Pegá el link directo a un archivo .mp4 o .webm. La foto de portada queda como respaldo mientras carga. Dejalo vacío para usar solo la foto.</p>
      <label className="block max-w-xl"><span className="text-sm">Link del video</span>
        <input className="campo w-full" type="url" inputMode="url" maxLength={400} value={url} disabled={!puedeEditar} onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…/portada.mp4" aria-label="Link del video de portada" /></label>
      {puedeEditar && <button type="button" className="boton" disabled={ocupado || url.trim() === guardado}
        onClick={() => empezar(async () => {
          setMsj({});
          const r = await guardarVideoPortada(url);
          if (r.error) { setMsj({ error: r.error }); return; }
          setGuardado(r.url ?? ""); setUrl(r.url ?? "");
          setMsj({ ok: "Guardado." });
        })}>Guardar video</button>}
      {msj.ok && <Mensaje tipo="exito">{msj.ok}</Mensaje>}
      {msj.error && <Mensaje tipo="error">{msj.error}</Mensaje>}
    </section>
  );
}
