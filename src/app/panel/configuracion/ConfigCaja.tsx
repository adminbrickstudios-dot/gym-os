"use client";
// VD-9 · Configuración → Cobros → Caja: por turno o una por día, pedir el conteo de billetes,
// fondo fijo, hora de corte y cuántas horas puede durar un turno. Solo el dueño la cambia.
import { useState, useTransition } from "react";
import { guardarConfigCaja } from "@/app/panel/caja/acciones";
import type { ConfigCaja as Config } from "@/app/panel/caja/tipos";
import { Interruptor } from "@/components/ui/Interruptor";
import { Mensaje } from "@/components/ui/Mensaje";
import { Restablecer } from "./Restablecer";
import { Icono } from "@/components/ui/Icono";

export function ConfigCaja({ inicial, puedeEditar }: { inicial: Config; puedeEditar: boolean }) {
  const [c, setC] = useState(inicial);
  const [guardado, setGuardado] = useState(inicial);
  const [msj, setMsj] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);
  const [ocupado, empezar] = useTransition();
  const sucio = JSON.stringify(c) !== JSON.stringify(guardado);
  const guardar = () => empezar(async () => {
    const r = await guardarConfigCaja(c);
    if (r.error || !r.config) { setMsj({ tipo: "error", texto: r.error ?? "No se pudo guardar." }); return; }
    setC(r.config); setGuardado(r.config);
    setMsj({ tipo: "exito", texto: "Guardado. Rige desde el próximo turno que se abra." });
  });
  return (
    <section className="tarjeta p-5 sm:p-6 space-y-4" data-config-caja>
      <div>
        <p className="titulo text-2xl"><Icono nombre="recibo" /> Caja</p>
        <p className="texto-suave">Una caja abierta de un día anterior se cierra sola, sin contar: nadie puede cobrar en ella y vos la contás después en Caja → Para revisar.{puedeEditar ? "" : " La cambia el dueño."}</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-2" role="group" aria-label="Cómo se usa la caja">
        {([["por_turno", "Caja por turno", "Cada persona abre y cierra la suya. Se pueden hacer varios turnos por día."], ["una_por_dia", "Una caja por día", "Se abre una vez y se cierra a la noche. Si ya se cerró, no se vuelve a abrir ese día."]] as const).map(([v, t, a]) => (
          <button key={v} type="button" aria-pressed={c.modo === v} disabled={!puedeEditar} onClick={() => setC({ ...c, modo: v })}
            className={`boton !flex-col !items-start !h-auto py-3 ${c.modo === v ? "!border-[var(--acento)]" : "opacity-70"}`}>
            <span>{t}</span><span className="text-sm texto-tenue font-normal">{a}</span>
          </button>
        ))}
      </div>
      <Interruptor etiqueta="Pedir el conteo de billetes al cerrar" ayuda={c.pedir_billetes ? "Prendido: para cerrar hay que usar la calculadora de billetes." : "Apagado: la calculadora está disponible, pero es opcional."}
        checked={c.pedir_billetes} disabled={!puedeEditar} onChange={(e) => setC({ ...c, pedir_billetes: e.target.checked })} />
      <div className="grid sm:grid-cols-3 gap-4">
        <label className="block space-y-1"><span className="etiqueta">Fondo fijo ($)</span>
          <input className="campo" type="number" inputMode="decimal" min={0} step="0.01" disabled={!puedeEditar} aria-label="Fondo fijo" value={Number.isNaN(c.fondo_fijo) ? "" : c.fondo_fijo}
            onChange={(e) => setC({ ...c, fondo_fijo: (e.target.value === "" ? NaN : Number(e.target.value)) })} />
          <span className="block text-sm texto-tenue">Lo que queda siempre en el cajón. Se sugiere al abrir un turno.</span></label>
        <label className="block space-y-1"><span className="etiqueta">Hora de corte</span>
          <input className="campo" type="time" disabled={!puedeEditar} aria-label="Hora de corte" value={c.hora_corte} onChange={(e) => setC({ ...c, hora_corte: e.target.value })} />
          <span className="block text-sm texto-tenue">Pasada esta hora, lo que sigue abierto queda sin contar. Un gimnasio 24 h pone la de su cambio de turno.</span></label>
        {c.modo === "por_turno" && (
          <label className="block space-y-1"><span className="etiqueta">Horas máximas de un turno</span>
            <input className="campo" type="number" inputMode="numeric" min={1} max={48} disabled={!puedeEditar} aria-label="Horas máximas de un turno" value={Number.isNaN(c.horas_max) ? "" : c.horas_max}
              onChange={(e) => setC({ ...c, horas_max: (e.target.value === "" ? NaN : Number(e.target.value)) })} />
            <span className="block text-sm texto-tenue">Un turno abierto más de estas horas también queda sin contar.</span></label>
        )}
      </div>
      {puedeEditar && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="boton boton-principal" disabled={!sucio || ocupado || Number.isNaN(c.fondo_fijo) || Number.isNaN(c.horas_max)} onClick={guardar}>{ocupado ? "Guardando…" : "Guardar"}</button>
          {sucio && <span className="texto-tenue text-sm">Hay cambios sin guardar</span>}
        </div>
      )}
      {msj && <Mensaje tipo={msj.tipo}>{msj.texto}</Mensaje>}
      {puedeEditar && (
        <Restablecer id="caja" recomendado="caja por turno, sin pedir el conteo de billetes, fondo fijo $0, corte a las 00:00 y turnos de hasta 14 horas."
          alConfirmar={async () => {
            const r = await guardarConfigCaja({ modo: "por_turno", pedir_billetes: false, fondo_fijo: 0, hora_corte: "00:00", horas_max: 14 });
            if (r.error || !r.config) return r.error ?? "No se pudo restablecer.";
            setC(r.config); setGuardado(r.config); return null;
          }} />
      )}
    </section>
  );
}
