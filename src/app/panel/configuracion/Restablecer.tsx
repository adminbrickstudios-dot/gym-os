"use client";
// VD-21 · "Restablecer a lo recomendado": un botón por tarjeta con confirmación en la misma tarjeta.
// No guarda nada por su cuenta: llama a la función de guardado que cada tarjeta ya tiene.
import { useState } from "react";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { Mensaje } from "@/components/ui/Mensaje";

export function Restablecer({ id, recomendado, alConfirmar }: {
  id: string;
  /** Qué va a quedar, en una línea (“Gracia 5 días, avisar 3 días antes…”). */
  recomendado: string;
  /** Devuelve el error, o null si quedó guardado. */
  alConfirmar: () => Promise<string | null>;
}) {
  const [pregunta, setPregunta] = useState(false);
  const [estado, setEstado] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);
  return (
    <div className="space-y-2" data-restablecer-caja={id}>
      {!pregunta ? (
        <button type="button" className="boton" data-restablecer={id} onClick={() => { setPregunta(true); setEstado(null); }}>↩️ Restablecer a lo recomendado</button>
      ) : (
        <div className="space-y-2" role="alertdialog" aria-label="Confirmar restablecer" data-restablecer-pregunta={id}>
          <Mensaje tipo="aviso">¿Volver esta tarjeta a lo recomendado? Queda guardado ahora: {recomendado}</Mensaje>
          <div className="flex flex-wrap gap-2">
            <BotonAccion className="boton boton-principal" data-restablecer-confirmar={id} ocupadoTexto="Restableciendo…"
              onClick={async () => {
                const error = await alConfirmar();
                setPregunta(false);
                setEstado(error ? { tipo: "error", texto: error } : { tipo: "exito", texto: "Listo: quedó en lo recomendado." });
              }}>Sí, restablecer</BotonAccion>
            <button type="button" className="boton" onClick={() => setPregunta(false)}>No, dejarlo como está</button>
          </div>
        </div>
      )}
      {estado && <Mensaje tipo={estado.tipo}>{estado.texto}</Mensaje>}
    </div>
  );
}
