"use client";
// Pase 2.0 · la llave "estilo" del gimnasio: el de siempre (clásico) o Pista, y el modo de Pista. Lo guarda el dueño; la base verifica que sea el dueño.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { guardarEstilo } from "./estilo-acciones";

export type EstiloGimnasio = { estilo: "clasico" | "pista"; modo: "claro" | "oscuro" };

export function EstiloMarca({ inicial, puedeEditar }: { inicial: EstiloGimnasio; puedeEditar: boolean }) {
  const router = useRouter();
  const [e, setE] = useState<EstiloGimnasio>(inicial);
  const [msj, setMsj] = useState<{ ok?: string; error?: string } | null>(null);
  const [pendiente, empezar] = useTransition();
  const guardar = (nuevo: EstiloGimnasio) => {
    const antes = e;
    setE(nuevo); setMsj(null);
    empezar(async () => {
      const r = await guardarEstilo(nuevo.estilo, nuevo.modo);
      if (r.error) { setE(antes); setMsj({ error: r.error }); return; }
      setMsj({ ok: "Guardado. Se aplica en las pantallas en menos de un minuto." });
      router.refresh();
    });
  };
  const opcion = (clave: "clasico" | "pista", titulo: string, texto: string) => (
    <label className="tarjeta p-4 flex gap-3 items-start cursor-pointer" data-estilo-opcion={clave}>
      <input type="radio" name="estilo-gimnasio" className="mt-1.5" checked={e.estilo === clave} disabled={!puedeEditar || pendiente} onChange={() => guardar({ ...e, estilo: clave })} />
      <span><span className="block font-semibold">{titulo}</span><span className="block texto-suave text-sm">{texto}</span></span>
    </label>
  );
  return (
    <div className="space-y-3" data-estilo-gimnasio={e.estilo}>
      <div className="grid gap-3 sm:grid-cols-2">
        {opcion("clasico", "Clásico", "El de siempre: claro, con tu color principal.")}
        {opcion("pista", "Pista", "Oscuro y deportivo, con títulos grandes. Las mismas pantallas y las mismas funciones.")}
      </div>
      {e.estilo === "pista" && (
        <fieldset className="space-y-2" data-estilo-modo={e.modo}>
          <legend className="etiqueta mb-1">Modo</legend>
          <div className="flex flex-wrap gap-3">
            {(["oscuro", "claro"] as const).map((m) => (
              <label key={m} className="inline-flex items-center gap-2">
                <input type="radio" name="modo-gimnasio" checked={e.modo === m} disabled={!puedeEditar || pendiente} onChange={() => guardar({ ...e, modo: m })} /> {m === "oscuro" ? "Oscuro" : "Claro"}
              </label>
            ))}
          </div>
          <p className="texto-tenue text-sm">Cada persona puede elegir el suyo en Mi cuenta.</p>
        </fieldset>
      )}
      {!puedeEditar && <p className="texto-tenue text-sm">Solo el dueño cambia el estilo.</p>}
      {msj?.ok && <p role="status" className="pildora pildora-verde whitespace-normal">{msj.ok}</p>}
      {msj?.error && <p role="alert" className="mensaje mensaje-error">{msj.error}</p>}
    </div>
  );
}
