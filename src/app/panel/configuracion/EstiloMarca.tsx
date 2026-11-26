"use client";
// Pase 2.0 · el modo de Pista del gimnasio (oscuro o claro). Pista es el único estilo desde el 26/11 (el clásico se borró). Lo guarda el dueño;
// la base verifica que sea el dueño.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { guardarModo } from "./estilo-acciones";

export type EstiloGimnasio = { modo: "claro" | "oscuro" };

export function EstiloMarca({ inicial, puedeEditar }: { inicial: EstiloGimnasio; puedeEditar: boolean }) {
  const router = useRouter();
  const [modo, setModo] = useState<EstiloGimnasio["modo"]>(inicial.modo);
  const [msj, setMsj] = useState<{ ok?: string; error?: string } | null>(null);
  const [pendiente, empezar] = useTransition();
  const guardar = (nuevo: EstiloGimnasio["modo"]) => {
    const antes = modo;
    setModo(nuevo); setMsj(null);
    empezar(async () => {
      const r = await guardarModo(nuevo);
      if (r.error) { setModo(antes); setMsj({ error: r.error }); return; }
      setMsj({ ok: "Guardado. Se aplica en las pantallas en menos de un minuto." });
      router.refresh();
    });
  };
  return (
    <div className="space-y-3" data-estilo-gimnasio="pista">
      <fieldset className="space-y-2" data-estilo-modo={modo}>
        <legend className="etiqueta mb-1">Modo</legend>
        <div className="flex flex-wrap gap-3">
          {(["oscuro", "claro"] as const).map((m) => (
            <label key={m} className="inline-flex items-center gap-2">
              <input type="radio" name="modo-gimnasio" checked={modo === m} disabled={!puedeEditar || pendiente} onChange={() => guardar(m)} /> {m === "oscuro" ? "Oscuro" : "Claro"}
            </label>
          ))}
        </div>
        <p className="texto-tenue text-sm">Cada persona puede elegir el suyo en Mi cuenta.</p>
      </fieldset>
      {!puedeEditar && <p className="texto-tenue text-sm">Solo el dueño cambia el modo.</p>}
      {msj?.ok && <p role="status" className="pildora pildora-verde whitespace-normal">{msj.ok}</p>}
      {msj?.error && <p role="alert" className="mensaje mensaje-error">{msj.error}</p>}
    </div>
  );
}
