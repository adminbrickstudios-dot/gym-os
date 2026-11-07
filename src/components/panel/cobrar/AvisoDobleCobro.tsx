"use client";
// VD-50 (D29) · "Sofi ya cobró esta cuota hace 40 s": frena y pregunta. Solo se sigue con "Cobrar igual (con motivo)"
// y un motivo escrito (que la base guarda en la venta). Lo usan la hoja Cobrar y Vender; el texto lo escribe la base
// (o, al abrir la hoja, sale de lo que contexto_cobro devolvió).
import { Mensaje } from "@/components/ui/Mensaje";

export type EstadoDobleCobro = { texto: string; abierto: boolean; motivo: string };

/** El motivo escrito alcanza (la base exige 3 letras como mínimo). */
export const motivoDobleValido = (e: EstadoDobleCobro | null) => !e || (e.abierto && e.motivo.trim().length >= 3);

/** "Sofi ya cobró esta cuota hace 40 s (por $25.000)…", armado con lo estructurado que devuelve contexto_cobro. */
export function textoDobleCobro(r: { hace_seg: number; quien: string | null; total: number }, pesos: (n: number) => string) {
  const hace = r.hace_seg < 90 ? `${r.hace_seg} s` : `${Math.round(r.hace_seg / 60)} min`;
  return `${r.quien ?? "Alguien"} ya cobró esta cuota hace ${hace} (por ${pesos(r.total)}). Si es otro cobro, confirmalo con un motivo.`;
}

export function AvisoDobleCobro({ estado, alCambiar, alCancelar }: {
  estado: EstadoDobleCobro; alCambiar: (e: EstadoDobleCobro) => void; alCancelar: () => void;
}) {
  return (
    <div className="space-y-3" data-cobrar-doble role="alert">
      <Mensaje tipo="aviso"><span data-cobrar-doble-texto>⚠️ {estado.texto}</span></Mensaje>
      {!estado.abierto ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="boton !min-h-11" data-cobrar-doble-igual onClick={() => alCambiar({ ...estado, abierto: true })}>Cobrar igual (con motivo)</button>
          <button type="button" className="boton !min-h-11" data-cobrar-doble-cancelar onClick={alCancelar}>Cancelar</button>
        </div>
      ) : (
        <div className="space-y-2">
          <input autoFocus className="campo !min-h-11" data-cobrar-doble-motivo aria-label="Por qué se cobra igual" placeholder="Motivo (obligatorio): ej. paga también el mes que viene"
            value={estado.motivo} onChange={(e) => alCambiar({ ...estado, motivo: e.target.value })} />
          <p className="text-sm texto-tenue">Queda anotado en la venta con tu nombre. Si no es otro cobro, cancelá.</p>
          <button type="button" className="boton-texto" data-cobrar-doble-cancelar onClick={alCancelar}>Cancelar</button>
        </div>
      )}
    </div>
  );
}
