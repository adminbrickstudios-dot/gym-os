"use client";
// BASE-3 · Panel lateral con la ficha rápida del socio: se abre al tocar un aviso de la puerta.
// Nombre, estado (lo dice la base), plan y vigencia, último pago, historial, últimos ingresos y COBRAR AHORA si no está vigente.
// Esc y la ✕ lo cierran. Nunca queda trabado: si la ficha no carga, lo dice y se cierra igual.
import { useEffect, useRef, useState } from "react";
import { fichaRapida } from "@/app/panel/entrada/ventana-acciones";
import type { Ficha } from "@/app/panel/socios/[id]/tipos";
import { formatearPesos } from "@/lib/formato";
import { colorVar } from "./Estado";
import { abrirCobrar, hayHojaCobrar } from "./cobrar/evento";

/** Quien quiera abrir el panel lateral de un socio manda este evento (detail: { socioId }). */
export const EVENTO_ABRIR_PANEL_SOCIO = "gymos:abrir-panel-socio";

const dia = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "numeric", year: "2-digit" });

export function PanelSocioLateral({ sedeId }: { sedeId: string }) {
  const [socioId, setSocioId] = useState<string | null>(null);
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [puedeCobrar, setPuedeCobrar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cerrarBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const abrir = (e: Event) => { const id = (e as CustomEvent<{ socioId: string }>).detail?.socioId; if (id) { setSocioId(id); setFicha(null); setError(null); } };
    window.addEventListener(EVENTO_ABRIR_PANEL_SOCIO, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_PANEL_SOCIO, abrir);
  }, []);

  useEffect(() => {
    if (!socioId) return;
    let vivo = true;
    fichaRapida(socioId).then((r) => { if (!vivo) return; if (r.error || !r.ficha) setError(r.error ?? "No se pudo traer la ficha."); else { setFicha(r.ficha); setPuedeCobrar(!!r.puedeCobrar); } });
    cerrarBtn.current?.focus();
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setSocioId(null); };
    window.addEventListener("keydown", tecla);
    return () => { vivo = false; window.removeEventListener("keydown", tecla); };
  }, [socioId]);

  if (!socioId) return null;
  const a = ficha?.acceso;
  const debe = a?.para_regularizar ?? null;
  const vigente = !!a?.puede && !debe;
  const quedan = a?.vence_en ? Math.ceil((new Date(a.vence_en).getTime() - Date.now()) / 86400000) : null;
  const ultimo = ficha?.pagos?.[0];
  const cobrar = () => {
    if (!socioId) return;
    setSocioId(null);
    if (hayHojaCobrar()) abrirCobrar({ socioId, origen: "otro", sedeId });
    else window.location.href = `/panel/vender?socio=${socioId}&cuota=1`;
  };
  const tel = ficha?.socio.telefono?.replace(/\D/g, "");

  return (
    <div className="fixed inset-0 z-[60]" data-panel-socio-lateral>
      <button type="button" aria-label="Cerrar el panel" className="absolute inset-0 bg-black/30" onClick={() => setSocioId(null)} tabIndex={-1} />
      <aside role="dialog" aria-modal="true" aria-label="Ficha rápida del socio"
        className="absolute right-0 top-0 h-full w-full sm:w-[26rem] overflow-y-auto vidrio aparecer p-5 space-y-4 border-l-4" style={{ borderLeftColor: a ? colorVar(a.color) : "transparent" }}>
        <div className="flex items-start gap-2">
          <h2 className="titular text-2xl flex-1 min-w-0 break-words">{ficha ? `${ficha.socio.nombre} ${ficha.socio.apellido}` : "Cargando…"}</h2>
          <button ref={cerrarBtn} type="button" onClick={() => setSocioId(null)} aria-label="Cerrar" className="size-11 rounded-lg texto-suave active:opacity-60">✕</button>
        </div>
        {error && <p role="alert" className="pildora pildora-rojo whitespace-normal">⚠️ {error}</p>}
        {ficha && a && (
          <>
            <p className="texto-suave" data-panel-socio-dato>#{ficha.socio.numero}{ficha.socio.dni ? ` · DNI ${ficha.socio.dni}` : ""}</p>
            <div className="tarjeta p-4" data-panel-socio-estado={a.color}>
              <p className="font-bold text-lg">{a.texto}</p>
              <p className="texto-suave mt-1">
                {ficha.membresia ? `${ficha.membresia.plan}` : "Sin plan"}
                {a.vence_en ? ` · vigente hasta el ${dia(a.vence_en)}` : ""}
                {quedan != null && quedan >= 0 ? ` · quedan ${quedan} día${quedan === 1 ? "" : "s"}` : ""}
              </p>
              {ficha.membresia && <p className="texto-tenue text-sm mt-1">Desde el {dia(ficha.membresia.inicio)}</p>}
            </div>
            {!vigente && debe != null && debe > 0 && (
              <p className="font-semibold" data-panel-socio-debe>Debe {formatearPesos(debe)}</p>
            )}
            {puedeCobrar && !vigente && (
              <button type="button" onClick={cobrar} data-panel-socio-cobrar className="boton boton-principal w-full !min-h-14 text-xl">
                💵 COBRAR AHORA{debe ? ` ${formatearPesos(debe)}` : ""}
              </button>
            )}
            <section aria-label="Último pago">
              <h3 className="titulo text-lg">Último pago</h3>
              {ultimo ? <p data-panel-socio-ultimo-pago>{dia(ultimo.fecha)} · {formatearPesos(ultimo.monto)} · {ultimo.medio}</p> : <p className="texto-tenue">{ficha.pagos == null ? "No tenés permiso para ver los pagos." : "Todavía no pagó."}</p>}
              {ficha.pagos && ficha.pagos.length > 1 && (
                <ul className="mt-2 space-y-1 text-sm texto-suave" data-panel-socio-historial>
                  {ficha.pagos.slice(1, 6).map((p) => <li key={p.id}>{dia(p.fecha)} · {formatearPesos(p.monto)} · {p.medio}</li>)}
                </ul>
              )}
            </section>
            <section aria-label="Últimos ingresos">
              <h3 className="titulo text-lg">Últimos ingresos</h3>
              {ficha.ingresos.length === 0 ? <p className="texto-tenue">Sin ingresos todavía.</p> : (
                <ul className="space-y-1 text-sm texto-suave">
                  {ficha.ingresos.slice(0, 5).map((i) => <li key={i.id}>{new Date(i.momento).toLocaleString("es-AR", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })} · {i.resultado}</li>)}
                </ul>
              )}
            </section>
            <div className="flex flex-wrap gap-2">
              <a className="boton" href={`/panel/socios/${ficha.socio.id}`}>Ver la ficha completa</a>
              {tel && <a className="boton" href={`https://wa.me/${tel}`} target="_blank" rel="noreferrer">WhatsApp</a>}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
