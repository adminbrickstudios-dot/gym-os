"use client";
import { useState, useTransition } from "react";
import { LinkPanel } from "@/components/panel/LinkPanel";
import { Icono } from "@/components/ui/Icono";
import { formatearPesos, fechaHoraHumana } from "@/lib/formato";
import { marcarVista } from "./acciones";

export type CobradaMostrador = {
  pago_id: string; en: string; monto: number; socio_id: string | null; socio: string | null; cobro: string | null; caja: string | null;
  visto_en: string | null; visto_por: string | null;
};
export type ListaMostrador = { dias: number; sin_ver_cantidad: number; sin_ver_total: number; filas: CobradaMostrador[] };

/**
 * H1 · "Cobradas en el mostrador": las transferencias que cobró la recepción, para chequear contra el banco.
 * La tilde "ya la vi en el banco" es solo una anotación (quién y cuándo): no cambia el pago ni la caja.
 */
export function Mostrador({ lista, zona }: { lista: ListaMostrador; zona: string }) {
  const [vistas, setVistas] = useState<Record<string, { visto_en: string | null; visto_por: string | null }>>({});
  const [soloFaltan, setSoloFaltan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const cuando = (m: string) => fechaHoraHumana(m, zona);
  const estado = (f: CobradaMostrador) => vistas[f.pago_id] ?? { visto_en: f.visto_en, visto_por: f.visto_por };
  const filas = lista.filas.map((f) => ({ ...f, ...estado(f) }));
  const sinVer = filas.filter((f) => !f.visto_en);
  const totalSinVer = sinVer.reduce((a, f) => a + Number(f.monto), 0);
  const mostradas = soloFaltan ? sinVer : filas;
  const marcar = (f: CobradaMostrador, vista: boolean) => empezar(async () => {
    setError(null);
    const r = await marcarVista(f.pago_id, vista);
    if (r.error) setError(r.error);
    else setVistas((v) => ({ ...v, [f.pago_id]: { visto_en: r.visto_en ?? null, visto_por: r.visto_por ?? null } }));
  });

  if (filas.length === 0) {
    return <p className="tarjeta p-6 texto-suave" data-mostrador-vacio>No hay transferencias cobradas en el mostrador en los últimos {lista.dias} días.</p>;
  }
  return (
    <div className="space-y-3" data-mostrador>
      <div className="tarjeta p-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div>
          <p className="texto-tenue text-sm">Sin chequear en el banco</p>
          <p className="numero text-3xl" data-sin-ver-total={totalSinVer}>{formatearPesos(totalSinVer)}</p>
          <p className="texto-suave text-sm">{sinVer.length === 0 ? "Todas chequeadas" : `${sinVer.length} ${sinVer.length === 1 ? "transferencia" : "transferencias"}`} · últimos {lista.dias} días</p>
        </div>
        <button type="button" className="boton ml-auto" aria-pressed={soloFaltan} onClick={() => setSoloFaltan(!soloFaltan)}>
          {soloFaltan ? "Ver todas" : "Ver solo las que faltan"}
        </button>
      </div>
      <p className="texto-suave text-sm">Estas ya están cobradas y sumadas: la tilde solo anota que viste la plata en el banco. No cambia la caja.</p>
      {error && <p role="alert" className="pildora pildora-rojo"><Icono nombre="alerta" /> {error}</p>}
      <ul className="space-y-2">
        {mostradas.map((f) => (
          <li key={f.pago_id} className="tarjeta p-4 flex flex-wrap items-center gap-3" data-cobrada={f.visto_en ? "vista" : "sin-ver"}>
            <div className="min-w-0 flex-1">
              <p className="numero text-2xl">{formatearPesos(f.monto)}</p>
              {f.socio_id
                ? <LinkPanel href={`/panel/socios/${f.socio_id}`} siNoEsta="texto" className="font-semibold hover:underline" textoClassName="font-semibold block">{f.socio ?? "Socio"}</LinkPanel>
                : <p className="font-semibold">Sin socio</p>}
              <p className="texto-suave text-sm">{cuando(f.en)}{f.cobro ? ` · cobró ${f.cobro}` : ""}{f.caja ? ` · ${f.caja}` : " · sin caja abierta"}</p>
              {f.visto_en && <p className="texto-suave text-sm" data-visto><Icono nombre="ok" /> La vio en el banco {f.visto_por ?? "—"} el {cuando(f.visto_en)}</p>}
            </div>
            <button type="button" disabled={ocupado} className={f.visto_en ? "boton" : "boton boton-principal"} aria-pressed={!!f.visto_en} data-tilde-banco onClick={() => marcar(f, !f.visto_en)}>
              <Icono nombre="ok" /> {f.visto_en ? "Sacar la tilde" : "Ya la vi en el banco"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
