"use client";
// VD-46M · Modo emergencia de la puerta (dueño y encargado). Arranca apagado: el dueño lo prende para su gimnasio.
// Con la puerta rota o sin luz se activa con un motivo y una duración; vence sola. Al cerrarla (o después, desde
// el historial) se ve quiénes entraron en ese rato.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { Mensaje } from "@/components/ui/Mensaje";
import { CartelEmergencia } from "@/components/panel/CartelEmergencia";
import { activarEmergencia, cerrarEmergencia, entradasDeEmergencia, estadoEmergencia, habilitarEmergencia } from "./emergencia-acciones";
import type { EmergenciaHistorial, EntradaEmergencia, EstadoEmergencia } from "./emergencia-tipos";

const DURACIONES = [1, 2, 3, 4, 6, 8, 12];
const cuando = (m: string, zona: string) =>
  new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
const hora = (m: string, zona: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));

function Lista({ entradas, zona }: { entradas: EntradaEmergencia[]; zona: string }) {
  if (entradas.length === 0) return <p className="texto-suave" data-emergencia-vacia>En ese rato no entró nadie por la puerta.</p>;
  return (
    <ul className="space-y-1" data-emergencia-lista={entradas.length}>
      {entradas.map((x) => (
        <li key={x.ingreso_id} className="flex items-center gap-2 min-w-0">
          <span className="texto-tenue tabular-nums flex-none">{hora(x.momento, zona)}</span>
          <span className="truncate flex-1">{x.socio}</span>
          {x.no_al_dia && <span className="pildora pildora-amarillo flex-none" title={x.texto}>no estaba al día</span>}
        </li>
      ))}
    </ul>
  );
}

export function PanelEmergencia({ sedeId, zona, inicial, historial }: { sedeId: string; zona: string; inicial: EstadoEmergencia; historial: EmergenciaHistorial[] }) {
  const router = useRouter();
  const [est, setEst] = useState(inicial);
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [horas, setHoras] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [cerrada, setCerrada] = useState<EntradaEmergencia[] | null>(null);
  const [viendo, setViendo] = useState<{ id: string; entradas: EntradaEmergencia[] } | null>(null);

  const refrescar = async () => { const r = await estadoEmergencia(sedeId); if (r.e) setEst(r.e); router.refresh(); };
  const prender = async (v: boolean) => {
    setError(null);
    const r = await habilitarEmergencia(v);
    if (r.error) { setError(r.error); return; }
    await refrescar();
  };
  const activar = async () => {
    setError(null);
    const r = await activarEmergencia(sedeId, motivo, horas);
    if (r.error || !r.e) { setError(r.error ?? "No se pudo activar."); return; }
    setEst(r.e); setAbierto(false); setMotivo(""); setCerrada(null);
    router.refresh();
  };
  const cerrar = async () => {
    if (!est.activa) return;
    setError(null);
    const r = await cerrarEmergencia(est.activa.id);
    if (r.error || !r.entradas) { setError(r.error ?? "No se pudo cerrar."); return; }
    setCerrada(r.entradas);
    await refrescar();
  };
  const ver = async (id: string) => {
    if (viendo?.id === id) { setViendo(null); return; }
    const r = await entradasDeEmergencia(id);
    if (r.error || !r.entradas) { setError(r.error ?? "No se pudo leer."); return; }
    setError(null); setViendo({ id, entradas: r.entradas });
  };

  // Apagado: solo el dueño lo puede prender; el encargado no ve nada que hacer.
  if (!est.habilitada && !est.puede_habilitar) return null;

  return (
    <section data-panel-emergencia={est.activa ? "activa" : est.habilitada ? "lista" : "apagada"} className="tarjeta p-5 space-y-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>🚨</span>
        <div className="min-w-0 flex-1">
          <h2 className="titulo text-xl">Modo emergencia de la puerta</h2>
          <p className="texto-suave">Si el molinete se rompe o se corta la luz: la puerta deja pasar a todos, cada entrada queda marcada y, al cerrar, ves quiénes pasaron. Se corta solo al terminar el tiempo.</p>
        </div>
      </div>

      {error && <Mensaje tipo="error">{error}</Mensaje>}

      {!est.habilitada && (
        <div className="flex flex-wrap items-center gap-3" data-emergencia-apagada>
          <p className="texto-suave flex-1 min-w-48">Está apagado en tu gimnasio. Prendelo para poder activarlo el día que haga falta.</p>
          <BotonAccion className="boton" ocupadoTexto="Prendiendo…" onClick={() => prender(true)} data-emergencia-prender>Prender el modo emergencia</BotonAccion>
        </div>
      )}

      {est.habilitada && est.activa && (
        <div className="space-y-3">
          <CartelEmergencia e={est.activa} />
          <p className="texto-suave" data-emergencia-datos>Activada por {est.activa.por ?? "el equipo"} a las {hora(est.activa.desde, zona)} · entraron {est.activa.entradas} hasta ahora.</p>
          {est.puede_activar && <BotonAccion className="boton boton-peligro" ocupadoTexto="Cerrando…" onClick={cerrar} data-emergencia-cerrar>✅ Cerrar la emergencia</BotonAccion>}
        </div>
      )}

      {est.habilitada && !est.activa && est.puede_activar && (
        abierto ? (
          <form className="space-y-3" data-emergencia-form onSubmit={(e) => { e.preventDefault(); }}>
            <label className="block">
              <span className="block font-semibold mb-1">¿Qué pasó?</span>
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} placeholder="Ej.: molinete trabado" className="campo w-full" aria-label="Motivo de la emergencia" />
            </label>
            <label className="block">
              <span className="block font-semibold mb-1">Cuánto dura (se corta sola)</span>
              <select value={horas} onChange={(e) => setHoras(Number(e.target.value))} className="campo" aria-label="Duración en horas">
                {DURACIONES.map((h) => <option key={h} value={h}>{h} {h === 1 ? "hora" : "horas"}</option>)}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <BotonAccion className="boton boton-peligro" ocupadoTexto="Activando…" disabled={motivo.trim().length < 5} onClick={activar} data-emergencia-activar>🚨 Activar emergencia</BotonAccion>
              <button type="button" className="boton-texto px-3" onClick={() => setAbierto(false)}>Cancelar</button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="boton boton-peligro" onClick={() => setAbierto(true)} data-emergencia-abrir>🚨 Activar emergencia</button>
            {est.puede_habilitar && <BotonAccion className="boton-texto px-3" ocupadoTexto="Apagando…" onClick={() => prender(false)} data-emergencia-apagar>Apagar el modo emergencia</BotonAccion>}
          </div>
        )
      )}

      {cerrada && (
        <div className="space-y-2" data-emergencia-cerrada>
          <Mensaje tipo="exito">Emergencia cerrada. Esto es lo que pasó por la puerta en ese rato:</Mensaje>
          <Lista entradas={cerrada} zona={zona} />
        </div>
      )}

      {historial.length > 0 && (
        <details className="space-y-2" data-emergencia-historial>
          <summary className="cursor-pointer font-semibold">Emergencias anteriores ({historial.length})</summary>
          <ul className="space-y-3 mt-2">
            {historial.map((h) => (
              <li key={h.id} className="space-y-1 min-w-0">
                <p className="break-words"><strong>{cuando(h.desde, zona)}</strong> · {h.sede} · {h.motivo}</p>
                <p className="texto-suave">
                  {h.estado === "activa" ? "Activa ahora" : h.estado === "cerrada" ? `La cerró ${h.cerro ?? "el equipo"}` : "Se cortó sola"} · hasta las {hora(h.hasta, zona)} · entraron {h.entradas}{h.no_al_dia > 0 ? ` (${h.no_al_dia} sin estar al día)` : ""}
                </p>
                {h.entradas > 0 && <button type="button" className="boton-texto" onClick={() => ver(h.id)}>{viendo?.id === h.id ? "Ocultar" : "Ver quiénes entraron"}</button>}
                {viendo?.id === h.id && <Lista entradas={viendo.entradas} zona={zona} />}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
