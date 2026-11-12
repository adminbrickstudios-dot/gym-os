"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { guardarNumerosInicio } from "@/app/panel/inicio-acciones";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { Icono } from "@/components/ui/Icono";

type Opcion = { clave: string; emoji: string; etiqueta: string };

/** VD-12: el dueño elige hasta 8 números para su Inicio (se guardan por gimnasio). */
export function ElegirNumeros({ disponibles, elegidos }: { disponibles: Opcion[]; elegidos: string[] }) {
  const router = useRouter();
  const [marcados, setMarcados] = useState<string[]>(elegidos);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const alternar = (c: string) => {
    setGuardado(false);
    setMarcados((m) => (m.includes(c) ? m.filter((x) => x !== c) : m.length >= 8 ? m : [...m, c]));
  };
  const guardar = async () => {
    setError(null);
    const r = await guardarNumerosInicio(marcados);
    if (r.error) { setError(r.error); return; }
    setGuardado(true);
    router.refresh();
  };
  return (
    <details className="mt-4" data-elegir-numeros>
      <summary className="texto-suave cursor-pointer select-none min-h-11 flex items-center"><Icono nombre="ajustes" /> Elegir mis números</summary>
      <div className="tarjeta p-4 mt-2 space-y-3">
        <p className="texto-suave">Marcá hasta 8. Si no marcás ninguno, se muestran los de siempre.</p>
        <ul className="grid sm:grid-cols-2 gap-2">
          {disponibles.map((o) => {
            const on = marcados.includes(o.clave);
            return (
              <li key={o.clave}>
                <label className="flex items-center gap-3 min-h-11 cursor-pointer">
                  <input type="checkbox" checked={on} disabled={!on && marcados.length >= 8} onChange={() => alternar(o.clave)} aria-label={o.etiqueta} className="size-5" />
                  <span><span aria-hidden><Icono nombre={o.emoji} sistema /></span> {o.etiqueta}</span>
                </label>
              </li>
            );
          })}
        </ul>
        {error && <p role="alert" className="text-[var(--rojo)]">{error}</p>}
        <div className="flex items-center gap-3">
          <BotonAccion onClick={guardar} ocupadoTexto="Guardando…">Guardar</BotonAccion>
          {guardado && <span className="texto-suave" role="status"><Icono nombre="ok" /> Guardado</span>}
        </div>
      </div>
    </details>
  );
}
