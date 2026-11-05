"use client";
import { useState, useTransition } from "react";
import { LinkPanel } from "@/components/panel/LinkPanel";
import { linkWhatsappSocio } from "@/lib/whatsapp";
import { marcarAvisado } from "./acciones";

export type Aviso = { socio_id: string; nombre: string; telefono: string | null; clave: string; motivo: string; mensaje: string; referencia: string;
  avisado_en: string | null; avisado_por: string | null };

/** Una persona a la que escribirle: el WhatsApp ya escrito; al tocarlo queda "avisado ✓". */
export function FilaAviso({ a, hora }: { a: Aviso; hora: string | null }) {
  // Lo que dice la base manda (al refrescar, por ejemplo después de "Avisar a todos"); lo local, hasta que llegue.
  const [local, setHecho] = useState<string | null>(null);
  const hecho = a.avisado_en ? `Avisado${a.avisado_por ? ` por ${a.avisado_por}` : ""}${hora ? ` a las ${hora}` : ""}` : local;
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const wa = linkWhatsappSocio(a.telefono, a.mensaje);
  const marcar = () => empezar(async () => { const r = await marcarAvisado(a.socio_id, a.clave, a.referencia); if (r.error) setError(r.error); else setHecho("Avisado recién"); });
  return (
    <li className={`tarjeta p-4 ${hecho ? "opacity-60" : ""}`} data-aviso={a.clave} data-avisado={hecho ? "si" : "no"}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <LinkPanel href={`/panel/socios/${a.socio_id}`} siNoEsta="texto" className="font-semibold text-lg hover:underline" textoClassName="font-semibold text-lg">{a.nombre}</LinkPanel>
          <p className="texto-suave">{a.motivo}</p>
          <p className="text-sm texto-tenue mt-1 line-clamp-2">“{a.mensaje}”</p>
          {hecho && <p className="text-sm mt-1" style={{ color: "var(--acento)" }}>✓ {hecho}</p>}
        </div>
        {!hecho && (
          <div className="flex flex-wrap gap-2">
            {wa
              ? <a href={wa} target="_blank" rel="noopener noreferrer" className="boton !min-h-11" onClick={marcar}>💬 WhatsApp</a>
              : <span className="pildora">📵 Sin teléfono</span>}
            <button type="button" className="boton !min-h-11 texto-suave" disabled={ocupado} onClick={marcar}>✓ Ya le avisé</button>
          </div>
        )}
      </div>
      {error && <p role="alert" className="pildora pildora-rojo mt-2">⚠️ {error}</p>}
    </li>
  );
}
