"use client";
import { useState } from "react";

export type LinkReferido = { codigo: string; host: string; invitados: number; socios: number };

/** REF-1: el link personal para invitar a un amigo a probar una clase. */
export function Referir({ datos }: { datos: LinkReferido }) {
  const [copiado, setCopiado] = useState(false);
  const link = `https://${datos.host}/?ref=${datos.codigo}#probar`;
  const texto = `¡Vení a probar una clase a mi gimnasio! Dejá tus datos acá y te escriben: ${link}`;
  const copiar = async () => {
    try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { setCopiado(false); }
  };
  return (
    <section className="tarjeta p-5 space-y-3" data-referir>
      <h2 className="titulo text-2xl">🤝 Invitá a un amigo</h2>
      <p className="texto-suave">Mandale tu link: deja sus datos y el gimnasio le escribe para que pruebe una clase.</p>
      <div className="flex flex-wrap gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener noreferrer" className="boton flex-1">💬 Mandar por WhatsApp</a>
        <button type="button" className="boton" onClick={copiar} data-copiar-link={link}>{copiado ? "✓ Copiado" : "🔗 Copiar link"}</button>
      </div>
      {datos.invitados > 0 && (
        <p className="text-sm texto-suave" data-referidos>{datos.invitados === 1 ? "1 amigo dejó sus datos" : `${datos.invitados} amigos dejaron sus datos`}{datos.socios ? ` · ${datos.socios} ${datos.socios === 1 ? "se hizo socio" : "se hicieron socios"}` : ""}.</p>
      )}
    </section>
  );
}
