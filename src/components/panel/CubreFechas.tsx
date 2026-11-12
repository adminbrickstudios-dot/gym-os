"use client";
// H2c · Lo que cubre una cuota, dicho con letras ANTES de confirmar ("Cubre del 2/11 al 1/12", "Cubierto hasta el 1/12"),
// y, para el dueño y el encargado, "Cambiar fechas" con dos campos (desde y hasta, inclusive). Lo usan Cobrar y el alta en el pasado.
// La propuesta la calcula la base (periodo_cuota_propuesto / periodo_alta_propuesto, la misma función que decide la cobertura) y las
// fechas elegidas las valida la base al confirmar: acá no se calcula nada. El monto NO cambia al mover las fechas.
import { useState } from "react";
import { Icono } from "@/components/ui/Icono";

export type Fechas = { desde: string; hasta: string };   // AAAA-MM-DD, hasta inclusive

/** "2026-11-02" → "2/11". */
export const diaMes = (iso: string) => { const [, m, d] = iso.split("-"); return `${Number(d)}/${Number(m)}`; };

export function CubreFechas({ propuesta, hoy, puedeCambiar, valor, alCambiar, atributoTexto = true }: {
  propuesta: Fechas; hoy: string; puedeCambiar: boolean; valor: Fechas | null; alCambiar: (v: Fechas | null) => void; atributoTexto?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const actual = valor ?? propuesta;
  const cambiada = !!valor && (valor.desde !== propuesta.desde || valor.hasta !== propuesta.hasta);
  return (
    <div className="space-y-1" data-cubre>
      <p className="texto-suave text-sm" {...(atributoTexto ? { "data-cobrar-cubre": "" } : {})} data-cubre-texto>
        Cubre del {diaMes(actual.desde)} al {diaMes(actual.hasta)}
      </p>
      <p className="texto-suave text-sm" data-cubre-hasta>Cubierto hasta el {diaMes(actual.hasta)}</p>
      {cambiada && (
        <p className="text-sm" data-cubre-cambiada>
          <Icono nombre="calendario" /> La propuesta era del {diaMes(propuesta.desde)} al {diaMes(propuesta.hasta)}. El monto no cambia: si hace falta, ajustalo con un descuento.
        </p>
      )}
      {puedeCambiar && !abierto && (
        <button type="button" className="boton-texto text-sm" data-cubre-cambiar onClick={() => setAbierto(true)}>Cambiar fechas</button>
      )}
      {puedeCambiar && abierto && (
        <div className="grid gap-2 sm:grid-cols-2 items-end" data-cubre-campos>
          <label className="block"><span className="etiqueta">Desde</span>
            <input type="date" className="campo" max={hoy} value={actual.desde} data-cubre-desde
              onChange={(e) => e.target.value && alCambiar({ desde: e.target.value, hasta: actual.hasta < e.target.value ? e.target.value : actual.hasta })} /></label>
          <label className="block"><span className="etiqueta">Hasta (inclusive)</span>
            <input type="date" className="campo" min={actual.desde} value={actual.hasta} data-cubre-hasta-campo
              onChange={(e) => e.target.value && alCambiar({ desde: actual.desde, hasta: e.target.value })} /></label>
          <button type="button" className="boton-texto text-sm sm:col-span-2" data-cubre-propuesta onClick={() => { alCambiar(null); setAbierto(false); }}>Volver a la propuesta</button>
        </div>
      )}
    </div>
  );
}
