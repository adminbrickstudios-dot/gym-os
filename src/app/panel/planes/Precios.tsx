"use client";
import { useState, useTransition } from "react";
import { formatearNumero, formatearPesos } from "@/lib/formato";
import { anularProgramado, programarLista, type Variante } from "./acciones";
import { Icono } from "@/components/ui/Icono";

type Fila = { medio: string | null; hasta_dia: number | null; monto: number };
type Lista = { desde: string; general: number | null; variantes: Fila[] };
export type ListaPrecios = { plan_id: string; tipo: string; medios: string[]; hoy: Lista | null; proxima: Lista | null; con_sede: boolean };

export const MEDIO: Record<string, string> = {
  efectivo: "Efectivo", transferencia: "Transferencia", debito: "Débito", credito: "Crédito", mercadopago: "Mercado Pago",
};
const aTexto = (n: number | null | undefined) => (n == null ? "" : formatearNumero(Number(n), 2));

/** "Efectivo $54.000 · hasta el día 10: $57.000" */
export function resumenVariantes(l: Lista | null): string {
  if (!l) return "";
  return l.variantes.map((v) => `${v.medio ? MEDIO[v.medio]?.replace(/^\S+ /, "") ?? v.medio : ""}${v.medio && v.hasta_dia ? " " : ""}${v.hasta_dia ? `hasta el día ${v.hasta_dia}` : ""}: ${formatearPesos(v.monto)}`).join(" · ");
}

export function Precios({ lista, hoy, fecha, cerrar }: { lista: ListaPrecios; hoy: string; fecha: (d: string) => string; cerrar: () => void }) {
  const base = lista.proxima ?? lista.hoy;
  const [general, setGeneral] = useState(aTexto(base?.general));
  const [porMedio, setPorMedio] = useState<Record<string, string>>(() =>
    Object.fromEntries(lista.medios.map((m) => [m, aTexto(base?.variantes.find((v) => v.medio === m && !v.hasta_dia)?.monto)])));
  const [porDia, setPorDia] = useState(() => base?.variantes.filter((v) => !v.medio && v.hasta_dia).map((v) => ({ dia: String(v.hasta_dia), monto: aTexto(v.monto) })) ?? []);
  // Las combinaciones (medio y día a la vez) no se editan acá, pero no se pierden.
  const combinadas = base?.variantes.filter((v) => v.medio && v.hasta_dia) ?? [];
  const [desde, setDesde] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const correr = (f: () => Promise<{ error?: string }>, fin?: () => void) => empezar(async () => { const r = await f(); setError(r.error ?? null); if (!r.error) fin?.(); });
  const guardar = () => {
    const vs: Variante[] = [
      ...Object.entries(porMedio).filter(([, m]) => m.trim()).map(([medio, monto]) => ({ medio, monto })),
      ...porDia.filter((d) => d.dia && d.monto.trim()).map((d) => ({ hasta_dia: Number(d.dia), monto: d.monto })),
      ...combinadas.map((v) => ({ medio: v.medio, hasta_dia: v.hasta_dia, monto: Number(v.monto) })),
    ];
    correr(() => programarLista(lista.plan_id, general, vs, desde), cerrar);
  };
  return (
    <form className="mt-4 space-y-4" data-precios onSubmit={(e) => { e.preventDefault(); guardar(); }}>
      {lista.proxima && (
        <p className="tarjeta p-3 text-sm flex flex-wrap items-center gap-2" data-proxima>
          <span className="flex-1 min-w-0"><Icono nombre="calendario" /> Desde el {fecha(lista.proxima.desde)} rige {formatearPesos(lista.proxima.general)}{lista.proxima.variantes.length ? ` (${resumenVariantes(lista.proxima)})` : ""}. Lo de abajo la reemplaza.</span>
          <button type="button" className="boton boton-chico" disabled={ocupado} onClick={() => correr(() => anularProgramado(lista.plan_id, lista.proxima!.desde), cerrar)}>✕ Anular ese aumento</button>
        </p>
      )}
      <label className="block space-y-1 max-w-xs"><span className="etiqueta">Precio general</span>
        <input autoFocus required className="campo" inputMode="decimal" placeholder="$" aria-label="Precio general" value={general} onChange={(e) => setGeneral(e.target.value)} />
      </label>
      {lista.medios.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="etiqueta">Más barato pagando con… (vacío = el general)</legend>
          <div className="grid sm:grid-cols-2 gap-2">
            {lista.medios.map((m) => (
              <label key={m} className="flex items-center gap-2"><span className="w-36 shrink-0">{MEDIO[m] ?? m}</span>
                <input className="campo" inputMode="decimal" placeholder="$" aria-label={`Precio con ${MEDIO[m]?.replace(/^\S+ /, "") ?? m}`} value={porMedio[m] ?? ""} onChange={(e) => setPorMedio({ ...porMedio, [m]: e.target.value })} />
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {lista.tipo === "membresia" && (
        <fieldset className="space-y-2">
          <legend className="etiqueta">Más barato pagando antes de un día del mes</legend>
          {porDia.map((d, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <span>Hasta el día</span>
              <input type="number" min={1} max={28} className="campo !w-20" aria-label="Hasta el día" value={d.dia} onChange={(e) => setPorDia(porDia.map((x, j) => (j === i ? { ...x, dia: e.target.value } : x)))} />
              <input className="campo !w-36" inputMode="decimal" placeholder="$" aria-label="Precio hasta ese día" value={d.monto} onChange={(e) => setPorDia(porDia.map((x, j) => (j === i ? { ...x, monto: e.target.value } : x)))} />
              <button type="button" className="boton boton-chico" aria-label="Quitar" onClick={() => setPorDia(porDia.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button type="button" className="boton boton-chico" onClick={() => setPorDia([...porDia, { dia: "10", monto: "" }])}><Icono nombre="mas" /> Precio por pagar antes</button>
        </fieldset>
      )}
      {combinadas.length > 0 && <p className="text-sm texto-tenue">Se mantienen: {resumenVariantes({ desde: "", general: null, variantes: combinadas })}.</p>}
      <label className="block space-y-1 max-w-xs"><span className="etiqueta">Desde (vacío = hoy)</span>
        <input className="campo" type="date" min={hoy} value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Desde cuándo (vacío = hoy)" />
      </label>
      <p className="text-sm texto-tenue">Se cobra el más barato que corresponde. Lo ya cobrado no cambia. La deuda y la página muestran el general.{lista.con_sede ? " Este plan tiene precios por sede: no se tocan desde acá." : ""}</p>
      {error && <p role="alert" className="pildora pildora-rojo"><Icono nombre="alerta" /> {error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="boton boton-principal" disabled={!general.trim() || ocupado}>Guardar precios</button>
        <button type="button" className="boton" onClick={cerrar}>Cancelar</button>
      </div>
    </form>
  );
}
