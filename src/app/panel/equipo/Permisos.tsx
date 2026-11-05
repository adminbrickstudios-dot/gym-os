"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { guardarPermiso } from "./acciones";

export type Permisos = { recepcion_ve_cobrado: boolean; recepcion_vende_productos: boolean; profe_ve_telefono: boolean; encargado_ve_resultado: boolean; descuento_max_recepcion: number };
const LISTA: [keyof Omit<Permisos, "descuento_max_recepcion">, string, string][] = [
  ["recepcion_ve_cobrado", "🛎️ La recepción ve lo cobrado del día", "El número “Cobrado hoy” en su Inicio."],
  ["recepcion_vende_productos", "🛎️ La recepción vende productos", "Si lo apagás, en Vender solo ve cuotas, pases y packs."],
  ["profe_ve_telefono", "💪 El profe ve el teléfono del socio", "En la lista de sus clases, para escribirle."],
  ["encargado_ve_resultado", "🧭 El encargado ve el Resultado", "Lo cobrado, los gastos y la exportación del mes."],
];

/** EQU-1 (D4): roles fijos y estos interruptores, para todo el gimnasio (no persona por persona). */
export function PermisosEquipo({ inicial, puedeEditar }: { inicial: Permisos; puedeEditar: boolean }) {
  const [p, setP] = useState(inicial);
  const [error, setError] = useState<string | null>(null);
  const [, empezar] = useTransition();
  const cambiar = (k: (typeof LISTA)[number][0], v: boolean) => {
    setP((x) => ({ ...x, [k]: v })); setError(null);
    empezar(async () => { const r = await guardarPermiso(k, v); if (r.error) { setError(r.error); setP((x) => ({ ...x, [k]: !v })); } });
  };
  return (
    <section className="tarjeta p-5 space-y-4" data-permisos>
      <div>
        <h2 className="titulo text-2xl">🔐 Qué puede hacer cada rol</h2>
        <p className="texto-suave">Valen para todo el equipo de ese rol.{puedeEditar ? " Se guarda al tocar." : " Los cambia el dueño."}</p>
      </div>
      <ul className="space-y-2">{LISTA.map(([k, t, a]) => (
        <li key={k}>
          <label className="flex items-start gap-3 min-h-[52px] cursor-pointer">
            <input type="checkbox" className="mt-1.5 size-5 flex-none" checked={p[k]} disabled={!puedeEditar} onChange={(e) => cambiar(k, e.target.checked)} data-permiso={k} />
            <span><span className="block font-semibold">{t}</span><span className="block text-sm texto-tenue">{a}</span></span>
          </label>
        </li>
      ))}</ul>
      <p className="text-sm texto-suave">🏷️ La recepción hace descuentos de hasta el {p.descuento_max_recepcion}%{puedeEditar ? <> (se cambia en <Link href="/panel/configuracion?pestana=cobros" className="underline">Configuración → Cobros</Link>)</> : null}.</p>
      {error && <p role="alert" className="pildora pildora-rojo">⚠️ {error}</p>}
    </section>
  );
}
