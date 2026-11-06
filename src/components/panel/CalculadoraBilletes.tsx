"use client";
// VD-9 · Calculadora de billetes (opcional): cuántos de cada uno, y el total sale solo.
// Solo suma lo que escribió la persona; el total lo vuelve a verificar la base al cerrar.
import { useState } from "react";
import { DENOMINACIONES, sumarBilletes } from "@/lib/caja";
import { formatearPesos } from "@/lib/formato";


export function CalculadoraBilletes({ alCambiar }: { alCambiar: (total: number, detalle: Record<string, number>) => void }) {
  const [cant, setCant] = useState<Record<string, string>>({});
  const [otros, setOtros] = useState("");
  const numeros = (c: Record<string, string>) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Math.max(0, Math.floor(Number(v) || 0))]));
  const { total } = sumarBilletes(numeros(cant), Math.max(0, Number(otros.replace(",", ".")) || 0));
  const cambiar = (c: Record<string, string>, o: string) => {
    const r = sumarBilletes(numeros(c), Math.max(0, Number(o.replace(",", ".")) || 0));
    alCambiar(r.total, r.detalle);
  };
  return (
    <fieldset className="space-y-3 rounded-2xl border border-[var(--borde)] p-4" data-billetes>
      <legend className="etiqueta px-1">🧮 Contá los billetes</legend>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {DENOMINACIONES.map((d) => (
          <label key={d} className="block space-y-1">
            <span className="text-sm texto-suave">{formatearPesos(d)}</span>
            <input className="campo" inputMode="numeric" placeholder="0" aria-label={`Billetes de ${formatearPesos(d)}`} value={cant[String(d)] ?? ""}
              onChange={(e) => { const c = { ...cant, [String(d)]: e.target.value.replace(/\D/g, "") }; setCant(c); cambiar(c, otros); }} />
          </label>
        ))}
        <label className="block space-y-1">
          <span className="text-sm texto-suave">Monedas y otros ($)</span>
          <input className="campo" inputMode="decimal" placeholder="0" aria-label="Monedas y otros" value={otros}
            onChange={(e) => { setOtros(e.target.value); cambiar(cant, e.target.value); }} />
        </label>
      </div>
      <p className="numero text-2xl" aria-live="polite">Suman {formatearPesos(total)}</p>
    </fieldset>
  );
}
