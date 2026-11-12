"use client";
import { useState } from "react";
import { formatearPesos, leerMonto } from "@/lib/formato";
import { billetesRapidos, calcularVuelto } from "@/lib/vuelto";

/**
 * Cobrar en efectivo: "Paga con $…" y el vuelto, con billetes rápidos. Es solo una cuenta en pantalla para la recepción:
 * lo que se cobra es el total, no lo que entrega el socio (esto no cambia nada de lo que se guarda).
 */
export function VueltoEfectivo({ total }: { total: number }) {
  const [paga, setPaga] = useState("");
  const entregado = leerMonto(paga);
  const hay = paga.trim() !== "" && !Number.isNaN(entregado);
  const { vuelto, falta } = calcularVuelto(total, hay ? entregado : total);
  return (
    <div className="mt-3 tarjeta p-3 space-y-2" data-cobrar-vuelto>
      <div className="flex flex-wrap items-center gap-2">
        <label className="etiqueta" htmlFor="cobrar-paga-con">Paga con</label>
        <input id="cobrar-paga-con" className="campo !min-h-12 w-36" inputMode="decimal" placeholder="$" value={paga} onChange={(e) => setPaga(e.target.value)} autoComplete="off" data-cobrar-paga-con />
        <button type="button" className="boton !min-h-12" onClick={() => setPaga(String(total))} data-cobrar-justo>Justo</button>
        {billetesRapidos(total).map((b) => (
          <button key={b} type="button" className="boton !min-h-12" onClick={() => setPaga(String(b))} data-cobrar-billete={b}>{formatearPesos(b)}</button>
        ))}
      </div>
      {hay && (falta > 0
        ? <p className="pildora pildora-amarillo" data-cobrar-falta>Faltan {formatearPesos(falta)}</p>
        : <p className="text-lg font-semibold" data-cobrar-vuelto-monto>{vuelto > 0 ? <>Vuelto: <span className="numero">{formatearPesos(vuelto)}</span></> : "Sin vuelto: justo"}</p>)}
    </div>
  );
}
