"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { marcarFavorito } from "../acciones";

/** Fijar un gimnasio arriba de la lista (cada usuario de BRIK tiene los suyos). */
export function Favorito({ gimnasioId, favorito }: { gimnasioId: string; favorito: boolean }) {
  const router = useRouter();
  const [pend, setPend] = useState(false);
  const [error, setError] = useState("");
  return (
    <span>
      <button type="button" disabled={pend} aria-pressed={favorito} aria-label={favorito ? "Sacar de favoritos" : "Fijar arriba"} title={favorito ? "Sacar de favoritos" : "Fijar arriba"}
        className={`boton ${favorito ? "!border-[var(--acento)]" : "texto-suave"}`} data-favorito={favorito ? "si" : "no"}
        onClick={async () => { setPend(true); const r = await marcarFavorito(gimnasioId, !favorito); setPend(false); if (r.error) { setError(r.error); return; } setError(""); router.refresh(); }}>
        {favorito ? "Fijado" : "Fijar"}
      </button>
      {error && <span role="alert" className="block text-sm texto-suave">{error}</span>}
    </span>
  );
}
