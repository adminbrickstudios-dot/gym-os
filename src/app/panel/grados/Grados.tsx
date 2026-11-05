"use client";
import { useState, useTransition } from "react";
import { LinkPanel } from "@/components/panel/LinkPanel";
import { Mensaje } from "@/components/ui/Mensaje";
import { textoRequisitos, type GradoPanel, type GradosPanel } from "@/lib/clases/grados";
import { archivarGrado, guardarGrado, otorgarGrado } from "./acciones";

/** Un socio listo para rendir: lo que lleva y el botón para otorgarle el grado. */
export function FilaListo({ l, puedeOtorgar }: { l: GradosPanel["listos"][number]; puedeOtorgar: boolean }) {
  const [hecho, setHecho] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  return (
    <li className="tarjeta px-4 py-3 flex flex-wrap items-center gap-3" data-listo-rendir={l.nombre}>
      <span className="grow min-w-0">
        <LinkPanel href={`/panel/socios/${l.socio_id}`} siNoEsta="texto" className="font-semibold">{l.nombre}</LinkPanel>
        <span className="block text-sm texto-suave">{l.actividad} · {l.actual?.nombre ?? "Sin grado"} → {l.proximo?.nombre} · {textoRequisitos(l)}</span>
      </span>
      {hecho ? <span className="pildora pildora-verde">✅ {l.proximo?.nombre}</span> : puedeOtorgar && l.proximo && (
        <button type="button" className="boton" disabled={ocupado}
          onClick={() => empezar(async () => { const r = await otorgarGrado(l.socio_id, l.proximo!.grado_id, null); if (r.error) setError(r.error); else setHecho(true); })}>
          🥋 Rindió: {l.proximo.nombre}
        </button>
      )}
      {error && <Mensaje tipo="error" className="w-full">{error}</Mensaje>}
    </li>
  );
}

/** Los grados de una actividad: en orden, con lo que pide cada uno. El dueño y el encargado los arman. */
export function GradosActividad({ a, puedeEditar }: { a: GradosPanel["actividades"][number]; puedeEditar: boolean }) {
  const [nuevo, setNuevo] = useState(false);
  if (!a.grados.length && !puedeEditar) return null;
  const siguiente = (a.grados.at(-1)?.orden ?? 0) + 1;
  return (
    <section className="mb-8" data-grados-actividad={a.nombre}>
      <h3 className="titulo text-xl mb-2">{a.emoji ?? "🥋"} {a.nombre}</h3>
      {a.grados.length === 0 && <p className="texto-suave mb-2">Sin grados.</p>}
      <ol className="space-y-2">{a.grados.map((g) => <FilaGrado key={g.grado_id} actividadId={a.actividad_id} g={g} puedeEditar={puedeEditar} />)}</ol>
      {puedeEditar && (nuevo
        ? <EditorGrado actividadId={a.actividad_id} inicial={{ orden: siguiente }} alTerminar={() => setNuevo(false)} />
        : <button type="button" className="boton mt-2" onClick={() => setNuevo(true)}>➕ {a.grados.length ? "Otro grado" : "Armar los grados"}</button>)}
    </section>
  );
}

function FilaGrado({ actividadId, g, puedeEditar }: { actividadId: string; g: GradoPanel; puedeEditar: boolean }) {
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  if (editando) return <li><EditorGrado actividadId={actividadId} inicial={g} alTerminar={() => setEditando(false)} /></li>;
  const req = [g.clases_minimas ? `${g.clases_minimas} clases` : null, g.meses_minimos ? `${g.meses_minimos} ${g.meses_minimos === 1 ? "mes" : "meses"}` : null].filter(Boolean).join(" y ");
  return (
    <li className="tarjeta px-4 py-3 flex flex-wrap items-center gap-3" data-grado={g.nombre}>
      <span className="numero w-6 texto-suave">{g.orden}</span>
      {g.color && <span className="w-4 h-4 rounded-full border" style={{ background: g.color }} aria-hidden />}
      <span className="grow min-w-0"><span className="font-semibold">{g.nombre}</span>
        <span className="block text-sm texto-suave">{req ? `Pide ${req} desde el grado anterior` : "Sin requisitos"} · {g.socios} {g.socios === 1 ? "socio" : "socios"}</span></span>
      {puedeEditar && <>
        <button type="button" className="underline text-sm" onClick={() => setEditando(true)}>Cambiar</button>
        <button type="button" className="underline text-sm texto-suave" disabled={ocupado}
          onClick={() => empezar(async () => { const r = await archivarGrado(g.grado_id); if (r.error) setError(r.error); })}>Archivar</button>
      </>}
      {error && <Mensaje tipo="error" className="w-full">{error}</Mensaje>}
    </li>
  );
}

function EditorGrado({ actividadId, inicial, alTerminar }: { actividadId: string; inicial: Partial<GradoPanel>; alTerminar: () => void }) {
  const [nombre, setNombre] = useState(inicial.nombre ?? "");
  const [orden, setOrden] = useState(String(inicial.orden ?? 1));
  const [clases, setClases] = useState(String(inicial.clases_minimas ?? 0));
  const [meses, setMeses] = useState(String(inicial.meses_minimos ?? 0));
  const [color, setColor] = useState(inicial.color ?? "#ffffff");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const num = (v: string) => v.replace(/\D/g, "");
  return (
    <form className="tarjeta p-4 mt-2 space-y-3" data-editor-grado onSubmit={(e) => {
      e.preventDefault();
      empezar(async () => {
        const r = await guardarGrado(actividadId, inicial.grado_id ?? null, nombre, Number(orden), Number(clases) || 0, Number(meses) || 0, color);
        if (r.error) setError(r.error); else alTerminar();
      });
    }}>
      <div className="flex flex-wrap gap-3">
        <label className="block w-20"><span className="text-sm">Orden</span><input className="campo w-full" inputMode="numeric" value={orden} onChange={(e) => setOrden(num(e.target.value))} aria-label="Orden" /></label>
        <label className="block grow"><span className="text-sm">Nombre</span><input className="campo w-full" maxLength={40} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Cinturón amarillo" aria-label="Nombre del grado" /></label>
        <label className="block w-16"><span className="text-sm">Color</span><input type="color" className="campo w-full !p-1" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Color" /></label>
      </div>
      <p className="text-sm texto-suave">Para rendirlo, desde el grado anterior:</p>
      <div className="flex flex-wrap gap-3">
        <label className="block w-32"><span className="text-sm">Clases</span><input className="campo w-full" inputMode="numeric" value={clases} onChange={(e) => setClases(num(e.target.value))} aria-label="Clases mínimas" /></label>
        <label className="block w-32"><span className="text-sm">Meses</span><input className="campo w-full" inputMode="numeric" value={meses} onChange={(e) => setMeses(num(e.target.value))} aria-label="Meses mínimos" /></label>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="boton boton-principal" disabled={ocupado}>Guardar</button>
        <button type="button" className="boton" onClick={alTerminar}>Cancelar</button>
      </div>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
    </form>
  );
}
