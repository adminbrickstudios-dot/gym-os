"use client";
// VD-13 · Para hacer hoy: las automáticas (calculadas), el checklist de apertura y cierre y la configuración.
import { useOptimistic, useState, useTransition } from "react";
import { BotonCobrar } from "@/components/panel/cobrar/BotonCobrar";
import { LinkPanel } from "@/components/panel/LinkPanel";
import { Mensaje } from "@/components/ui/Mensaje";
import { guardarItemChecklist, guardarTareaAuto, tildarChecklist } from "./acciones";
import { Icono } from "@/components/ui/Icono";

export type Automatica = {
  clave: string; emoji: string; titulo: string; texto: string; cantidad: number; href: string; cobrar?: boolean;
  socios?: { socio_id: string; nombre: string }[];
};

/** Las automáticas de hoy: cada una con su dato; salen solas cuando se resuelven (nada se guarda). */
export function AutomaticasHoy({ items }: { items: Automatica[] }) {
  return (
    <ul className="space-y-2" data-automaticas={items.length}>
      {items.map((x) => (
        <li key={x.clave} data-automatica={x.clave} data-cantidad={x.cantidad} className="tarjeta p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="icono" aria-hidden><Icono nombre={x.emoji} sistema /></span>
            <span className="min-w-0 flex-1 font-semibold text-lg leading-tight">{x.texto}</span>
            <LinkPanel href={`/panel${x.href}`} className="boton !min-h-11">Ver</LinkPanel>
          </div>
          {x.socios && x.socios.length > 0 && (
            <ul className="grid gap-2">
              {x.socios.map((s) => (
                <li key={s.socio_id} data-automatica-socio={s.socio_id} className="flex flex-wrap items-center gap-2 pl-1">
                  <LinkPanel href={`/panel/socios/${s.socio_id}`} siNoEsta="texto" className="min-w-0 flex-1 underline truncate">{s.nombre}</LinkPanel>
                  {x.cobrar && <BotonCobrar socioId={s.socio_id} origen="tarea" cuota className="boton boton-principal !min-h-11"><Icono nombre="plata" /> Cobrar</BotonCobrar>}
                </li>
              ))}
              {x.cantidad > x.socios.length && <li className="texto-tenue text-sm pl-1">y {x.cantidad - x.socios.length} más: tocá “Ver”.</li>}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

export type ItemChecklist = { id: string; momento: "apertura" | "cierre"; texto: string; hecho: boolean; hecha_por: string | null };

function FilaChecklist({ i }: { i: ItemChecklist }) {
  const [real, setReal] = useState(i.hecho);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const [hecho, tildarYa] = useOptimistic<boolean, boolean>(real, (_, n) => n);
  const cambiar = () => empezar(async () => {
    const n = !hecho;
    setError(null); tildarYa(n);
    const r = await tildarChecklist(i.id, n);
    if (r.error) setError(r.error); else setReal(n);
  });
  return (
    <li data-checklist-item={hecho ? "hecho" : "pendiente"} className={`tarjeta p-3 flex flex-wrap items-center gap-3 ${hecho ? "opacity-60" : ""}`}>
      <button type="button" className="boton !min-h-11 !px-3" disabled={ocupado} onClick={cambiar} aria-label={hecho ? `Reabrir: ${i.texto}` : `Marcar hecho: ${i.texto}`}>{hecho ? "" : ""}</button>
      <span className={`min-w-0 flex-1 ${hecho ? "line-through" : ""}`}>{i.texto}{hecho && i.hecha_por && <span className="texto-suave no-underline"> · {i.hecha_por}</span>}</span>
      {error && <Mensaje tipo="error" className="basis-full">{error}</Mensaje>}
    </li>
  );
}

/** Checklist de apertura y de cierre; el dueño y el encargado lo arman. */
export function ChecklistHoy({ items, puedeEditar }: { items: ItemChecklist[]; puedeEditar: boolean }) {
  const [texto, setTexto] = useState("");
  const [momento, setMomento] = useState<"apertura" | "cierre">("apertura");
  const [estado, setEstado] = useState<{ error?: string }>({});
  const [guardando, empezar] = useTransition();
  const grupos: { m: "apertura" | "cierre"; titulo: string }[] = [{ m: "apertura", titulo: "Apertura" }, { m: "cierre", titulo: "Cierre" }];
  if (items.length === 0 && !puedeEditar) return null;
  return (
    <section aria-labelledby="checklist" className="space-y-4" data-checklist>
      <h2 id="checklist" className="titulo text-3xl"><Icono nombre="ok" /> Apertura y cierre</h2>
      {items.length === 0 && <p className="texto-suave">Todavía no hay nada en el checklist. Sumá lo que se revisa al abrir y al cerrar: “prender los aires”, “revisar los baños”.</p>}
      <div className="grid gap-6 md:grid-cols-2">
        {grupos.map((g) => {
          const l = items.filter((i) => i.momento === g.m);
          if (l.length === 0) return null;
          return (
            <div key={g.m} className="space-y-2" data-checklist-grupo={g.m}>
              <h3 className="titulo-grupo">{g.titulo} <span className="texto-tenue">{l.filter((i) => i.hecho).length}/{l.length}</span></h3>
              <ul className="space-y-2">{l.map((i) => <FilaChecklist key={i.id} i={i} />)}</ul>
            </div>
          );
        })}
      </div>
      {puedeEditar && (
        <form className="flex flex-wrap items-end gap-2" data-checklist-nuevo
          onSubmit={(e) => { e.preventDefault(); empezar(async () => { const r = await guardarItemChecklist(momento, texto); setEstado(r); if (!r.error) setTexto(""); }); }}>
          <label className="block space-y-1 min-w-0 flex-1"><span className="etiqueta">Sumar al checklist</span>
            <input className="campo" maxLength={120} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej: prender los aires" /></label>
          <label className="block space-y-1"><span className="etiqueta">Cuándo</span>
            <select className="campo" value={momento} onChange={(e) => setMomento(e.target.value as "apertura" | "cierre")}><option value="apertura">Al abrir</option><option value="cierre">Al cerrar</option></select></label>
          <button type="submit" className="boton" disabled={guardando || texto.trim().length < 2}>{guardando ? "Guardando…" : "Sumar"}</button>
          {estado.error && <Mensaje tipo="error" className="basis-full">{estado.error}</Mensaje>}
        </form>
      )}
    </section>
  );
}

export type ConfigAuto = {
  clave: string; emoji: string; titulo: string; roles: string[]; gestion: boolean; dias: number | null;
  activa: boolean; para_rol: string | null; para_equipo: string | null; dias_actual: number | null;
};
export type PersonaConfig = { id: string; nombre: string; rol: string };

const ROL: Record<string, string> = { dueno: "el dueño", encargado: "el encargado", recepcion: "la recepción" };

function FilaConfig({ a, equipo }: { a: ConfigAuto; equipo: PersonaConfig[] }) {
  const [activa, setActiva] = useState(a.activa);
  const [para, setPara] = useState(a.para_equipo ? `p:${a.para_equipo}` : a.para_rol ? `r:${a.para_rol}` : "");
  const [dias, setDias] = useState(a.dias_actual ?? 0);
  const [estado, setEstado] = useState<{ ok?: boolean; error?: string }>({});
  const [guardando, empezar] = useTransition();
  const opciones = equipo.filter((p) => !a.gestion || p.rol !== "recepcion");
  const guardar = () => empezar(async () => {
    const r = await guardarTareaAuto(a.clave, activa, para.startsWith("r:") ? para.slice(2) : null, para.startsWith("p:") ? para.slice(2) : null, a.dias ? dias : null);
    setEstado(r.error ? { error: r.error } : { ok: true });
  });
  return (
    <li className="tarjeta p-4 grid gap-3 sm:grid-cols-[1fr_auto]" data-config-auto={a.clave}>
      <div className="space-y-2 min-w-0">
        <label className="flex items-center gap-3 font-semibold text-lg">
          <input type="checkbox" className="size-5" checked={activa} onChange={(e) => setActiva(e.target.checked)} data-config-activa />
          <span aria-hidden><Icono nombre={a.emoji} sistema /></span> {a.titulo}
        </label>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="block space-y-1"><span className="etiqueta">Para quién</span>
            <select className="campo" value={para} onChange={(e) => setPara(e.target.value)} data-config-para>
              <option value="">Lo de siempre ({a.roles.map((r) => ROL[r]).join(" y ")})</option>
              {["encargado", "recepcion"].filter((r) => !a.gestion || r !== "recepcion").map((r) => <option key={r} value={`r:${r}`}>Todos: {ROL[r]}</option>)}
              {opciones.map((p) => <option key={p.id} value={`p:${p.id}`}>{p.nombre}</option>)}
            </select></label>
          {a.dias != null && (
            <label className="block space-y-1"><span className="etiqueta">Días</span>
              <input className="campo !w-24" type="number" min={1} max={30} value={dias} onChange={(e) => setDias(Number(e.target.value))} /></label>
          )}
        </div>
        {estado.error && <Mensaje tipo="error">{estado.error}</Mensaje>}
        {estado.ok && <Mensaje tipo="exito">Guardado.</Mensaje>}
      </div>
      <button type="button" className="boton self-end" disabled={guardando} onClick={guardar}>{guardando ? "Guardando…" : "Guardar"}</button>
    </li>
  );
}

/** Cada gimnasio prende o apaga cada automática y elige para quién es (dueño y encargado). */
export function ConfigurarAutomaticas({ automaticas, equipo }: { automaticas: ConfigAuto[]; equipo: PersonaConfig[] }) {
  return (
    <details className="tarjeta p-4" data-config-automaticas>
      <summary className="cursor-pointer font-semibold text-lg min-h-11 flex items-center"><Icono nombre="ajustes" /> Qué se avisa y a quién</summary>
      <p className="texto-suave my-3">Prendé o apagá cada aviso automático y elegí para quién es. Los que no tienen nada para hacer no aparecen.</p>
      <ul className="space-y-3">{automaticas.map((a) => <FilaConfig key={a.clave} a={a} equipo={equipo} />)}</ul>
    </details>
  );
}
