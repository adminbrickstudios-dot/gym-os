"use client";
import { useState, useTransition } from "react";
import { formatearPesos } from "@/lib/formato";
import { pagarConMercadoPago } from "./acciones";

/** PAY-1: pagar la cuota con MercadoPago. Acredita el aviso de MercadoPago, no la vuelta del navegador. */
export function PagarOnline({ socioId, monto, descripcion, adelantar = false }: { socioId: string; monto: number; descripcion: string; adelantar?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [yendo, empezar] = useTransition();
  const ir = () => empezar(async () => {
    setError(null);
    const r = await pagarConMercadoPago(socioId);
    if (r.error || !r.url) { setError(r.error ?? "No se pudo abrir MercadoPago"); return; }
    window.location.assign(r.url);
  });
  return (
    <section className="tarjeta p-5 space-y-3" data-pagar-online>
      <p className="titulo text-2xl">{adelantar ? "💳 Pagar el próximo mes" : "💳 Pagar ahora"}</p>
      <p><span className="numero text-4xl">{formatearPesos(monto)}</span> <span className="texto-suave">{descripcion}, con MercadoPago</span></p>
      <button type="button" className={`boton ${adelantar ? "" : "boton-principal"} w-full text-lg`} disabled={yendo} onClick={ir}>
        {yendo ? "Abriendo MercadoPago…" : "Pagar con MercadoPago"}
      </button>
      <p className="text-sm texto-tenue">Tarjeta, débito o dinero en cuenta. {adelantar ? "Se suma después de lo que ya tenés pago." : "Apenas MercadoPago confirma, quedás al día."}</p>
      {error && <p role="alert" className="pildora pildora-rojo">⚠️ {error}</p>}
    </section>
  );
}
