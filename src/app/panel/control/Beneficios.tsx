"use client";
// VD-46C · Cortesías y descuentos del mes, los topes y la lista de motivos. Lo ven el dueño y el encargado con Resultado; solo el dueño cambia.
// VD-46U: los topes y los motivos viven en Configuración → Reglas (tarjeta propia, el mismo componente); acá se siguen pudiendo ver y cambiar.
import { useState } from "react";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { formatearPesos } from "@/lib/formato";
import { guardarModoDevolucion, guardarMotivoBeneficio, guardarTopesBeneficios } from "@/app/panel/socios/moderacion-acciones";

export type TopesBeneficios = { max_dias_recepcion: number; max_dias_encargado: number; dias_mes_recepcion: number; dias_mes_encargado: number; alerta_repetidas: number; descuento_max_recepcion: number };
export type MotivosBeneficio = { id: string; nombre: string; activo: boolean }[];
export type BeneficiosMes = {
  mes: string; descuentos_total: number; descuentos_cantidad: number; cortesias_dias: number; cortesias_cantidad: number; puede_editar: boolean;
  por_persona: { nombre: string; rol: string; descuentos: number; cortesias_dias: number }[];
  topes: TopesBeneficios;
  motivos: MotivosBeneficio;
};

const MODOS_DEVOLUCION: [string, string][] = [["ninguna", "No se devuelve nada al dar de baja"], ["cuotas_adelantadas", "Se devuelven los períodos pagados que todavía no empezaron"], ["proporcional", "Además, los días sin usar del período en curso"]];

/** Los topes de cortesías, la regla de devolución al dar de baja y la lista de motivos. El mismo cuerpo en Control y en Configuración → Reglas. */
export function TopesYMotivos({ gimnasioId, topes, motivos, puedeEditar, devolucionModo }: {
  gimnasioId: string; topes: TopesBeneficios; motivos: MotivosBeneficio; puedeEditar: boolean; devolucionModo: string;
}) {
  const [modo, setModo] = useState(devolucionModo);
  const [t, setT] = useState({ recepcionDias: topes.max_dias_recepcion, encargadoDias: topes.max_dias_encargado, recepcionMes: topes.dias_mes_recepcion, encargadoMes: topes.dias_mes_encargado, alerta: topes.alerta_repetidas });
  const [nuevo, setNuevo] = useState("");
  const [msj, setMsj] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const num = (v: string) => (v === "" ? 0 : Number(v));
  const hecho = (r: { error?: string }, ok: string) => setMsj(r.error ? { tipo: "error", texto: r.error } : { tipo: "ok", texto: ok });
  return (
    <div className="space-y-4" data-topes-motivos>
      <p className="texto-suave text-sm">La recepción no puede dar un descuento de más de {topes.descuento_max_recepcion}% (se cambia en Configuración → Cobros).</p>
      <div className="grid grid-cols-2 gap-3">
        {([["recepcionDias", "Recepción: días por cortesía"], ["recepcionMes", "Recepción: días por mes"], ["encargadoDias", "Encargado: días por cortesía"], ["encargadoMes", "Encargado: días por mes"], ["alerta", "Avisar desde N cortesías en 60 días"]] as const).map(([k, etiqueta]) => (
          <label key={k} className="block space-y-1"><span className="text-sm">{etiqueta}</span>
            <input className="campo" inputMode="numeric" value={t[k]} disabled={!puedeEditar} onChange={(e) => setT({ ...t, [k]: num(e.target.value.replace(/\D/g, "")) })} /></label>
        ))}
      </div>
      {puedeEditar && <BotonAccion className="boton" onClick={async () => hecho(await guardarTopesBeneficios(gimnasioId, t), "Topes guardados. Rigen desde ahora.")}>Guardar topes</BotonAccion>}
      <label className="block space-y-1" data-devolucion-modo><span className="font-semibold">Devolución al dar de baja con cuota adelantada</span>
        <select className="campo" value={modo} disabled={!puedeEditar} aria-label="Regla de devolución al dar de baja"
          onChange={async (e) => { const nuevoModo = e.target.value; setModo(nuevoModo); hecho(await guardarModoDevolucion(gimnasioId, nuevoModo), "Regla guardada. Rige para las bajas desde ahora."); }}>
          {MODOS_DEVOLUCION.map(([v, texto]) => <option key={v} value={v}>{texto}</option>)}
        </select></label>
      <div className="space-y-2">
        <p className="font-semibold">Motivos de cortesías y descuentos</p>
        <ul className="space-y-1">
          {motivos.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2" data-motivo={m.activo ? "activo" : "apagado"}>
              <span className={m.activo ? "" : "texto-tenue line-through"}>{m.nombre}</span>
              {puedeEditar && <BotonAccion className="boton-texto" onClick={async () => hecho(await guardarMotivoBeneficio(gimnasioId, m.id, m.nombre, !m.activo), m.activo ? "Motivo apagado." : "Motivo prendido.")}>{m.activo ? "Apagar" : "Prender"}</BotonAccion>}
            </li>
          ))}
        </ul>
        {puedeEditar && (
          <div className="flex flex-wrap gap-2">
            <input className="campo flex-1 min-w-[12rem]" value={nuevo} onChange={(e) => setNuevo(e.target.value)} maxLength={60} placeholder="Un motivo nuevo" aria-label="Motivo nuevo" />
            <BotonAccion className="boton" disabled={nuevo.trim().length < 3} onClick={async () => { const r = await guardarMotivoBeneficio(gimnasioId, null, nuevo, true); hecho(r, "Motivo agregado."); if (!r.error) setNuevo(""); }}>Agregar</BotonAccion>
          </div>
        )}
      </div>
      {msj && <p role={msj.tipo === "error" ? "alert" : "status"} className={`pildora whitespace-normal ${msj.tipo === "error" ? "pildora-rojo" : ""}`}>{msj.tipo === "error" ? "⚠️" : "✅"} {msj.texto}</p>}
    </div>
  );
}

export function Beneficios({ gimnasioId, datos: d, devolucionModo }: { gimnasioId: string; datos: BeneficiosMes; devolucionModo: string }) {
  return (
    <section className="space-y-3" data-beneficios aria-label="Cortesías y descuentos del mes">
      <h2 className="titulo-grupo">🎁 Cortesías y descuentos de {d.mes}</h2>
      <div className="grid sm:grid-cols-2 gap-2">
        <div className="tarjeta px-4 py-3"><p className="texto-suave text-sm">Descuentos del mes</p><p className="numero text-2xl" data-descuentos-mes>{formatearPesos(Number(d.descuentos_total))}</p><p className="texto-tenue text-sm">{d.descuentos_cantidad} {d.descuentos_cantidad === 1 ? "línea con descuento" : "líneas con descuento"}</p></div>
        <div className="tarjeta px-4 py-3"><p className="texto-suave text-sm">Cortesías del mes</p><p className="numero text-2xl" data-cortesias-mes>{d.cortesias_dias} {d.cortesias_dias === 1 ? "día" : "días"}</p><p className="texto-tenue text-sm">{d.cortesias_cantidad} {d.cortesias_cantidad === 1 ? "cortesía" : "cortesías"}</p></div>
      </div>
      {d.por_persona.length > 0 && (
        <ul className="space-y-1 text-[15px]">
          {d.por_persona.map((p) => (
            <li key={p.nombre} className="tarjeta px-4 py-2 flex flex-wrap items-center justify-between gap-x-4">
              <span className="font-semibold">{p.nombre} <span className="texto-tenue font-normal">({p.rol})</span></span>
              <span className="texto-suave">{Number(p.descuentos) > 0 ? `Descuentos ${formatearPesos(Number(p.descuentos))}` : ""}{Number(p.descuentos) > 0 && p.cortesias_dias > 0 ? " · " : ""}{p.cortesias_dias > 0 ? `Cortesías ${p.cortesias_dias} ${p.cortesias_dias === 1 ? "día" : "días"}` : ""}</span>
            </li>
          ))}
        </ul>
      )}
      <details className="tarjeta p-4" data-topes>
        <summary className="font-semibold cursor-pointer">Topes y motivos{d.puede_editar ? "" : " (los cambia el dueño)"}</summary>
        <div className="mt-3">
          <TopesYMotivos gimnasioId={gimnasioId} topes={d.topes} motivos={d.motivos} puedeEditar={d.puede_editar} devolucionModo={devolucionModo} />
          <p className="texto-tenue text-sm mt-3">También están en Configuración → Reglas.</p>
        </div>
      </details>
    </section>
  );
}
