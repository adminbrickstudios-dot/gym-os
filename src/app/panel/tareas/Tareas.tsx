"use client";
import { useOptimistic, useState, useTransition } from "react";
import { LinkPanel } from "@/components/panel/LinkPanel";
import { AvisoSalud } from "@/components/ui/AvisoSalud";
import { Mensaje } from "@/components/ui/Mensaje";
import { detectarSalud } from "@/lib/salud";
import { crearTarea, marcarTarea } from "./acciones";
import { Icono } from "@/components/ui/Icono";

export type Tarea = { id: string; que: string; dia: string; socio_id: string | null; socio: string | null; para_id: string; para: string; mia: boolean;
  creada_por: string; repite?: string | null; hecha_en: string | null; hecha_por: string | null; atrasada: boolean };
export type Persona = { id: string; nombre: string; yo: boolean };

const REPITE: Record<string, string> = { diaria: "todos los días", semanal: "todas las semanas", mensual: "todos los meses" };
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Una tarea con su tilde. La usan Tareas y el Inicio. */
export function FilaTarea({ t, hoy, mostrarPara = false }: { t: Tarea; hoy: string; mostrarPara?: boolean }) {
  const [hechaReal, setHecha] = useState(!!t.hecha_en);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  // VD-47X: el tilde cambia al instante; si falla, vuelve atrás y dice por qué.
  const [hecha, tildarYa] = useOptimistic<boolean, boolean>(hechaReal, (_, nueva) => nueva);
  const cambiar = () => empezar(async () => {
    const nueva = !hecha;
    setError(null);
    tildarYa(nueva);
    const r = await marcarTarea(t.id, nueva);
    if (r.error) setError(r.error); else setHecha(nueva);
  });
  return (
    <li className={`tarjeta p-4 flex flex-wrap items-center gap-3 ${hecha ? "opacity-60" : ""}`} data-tarea={hecha ? "hecha" : t.atrasada ? "atrasada" : "pendiente"}>
      <button type="button" className="boton !min-h-11 !px-3" disabled={ocupado} onClick={cambiar} aria-label={hecha ? `Reabrir: ${t.que}` : `Marcar hecha: ${t.que}`}>
        {hecha ? <Icono nombre="deshacer" /> : <Icono nombre="ok" />}
      </button>
      <span className="min-w-0 flex-1">
        <span className={`block font-semibold ${hecha ? "line-through" : ""}`}>{t.que}</span>
        <span className="block text-sm texto-suave">
          {t.dia === hoy ? "Hoy" : t.atrasada ? `Era para el ${ddmm(t.dia)}` : ddmm(t.dia)}
          {t.repite && ` · ${REPITE[t.repite] ?? t.repite}`}
          {mostrarPara && ` · para ${t.mia ? "vos" : t.para}`}
          {t.socio && <> · <LinkPanel href={`/panel/socios/${t.socio_id}`} siNoEsta="texto" className="underline">{t.socio}</LinkPanel></>}
          {hecha && t.hecha_por && ` · hecha por ${t.hecha_por}`}
        </span>
      </span>
      {error && <Mensaje tipo="error" className="basis-full">{error}</Mensaje>}
    </li>
  );
}

export function NuevaTarea({ equipo, hoy, socio, abierta = false }: { equipo: Persona[]; hoy: string; socio: { id: string; nombre: string } | null; abierta?: boolean }) {
  const [abierto, setAbierto] = useState(abierta);
  const [que, setQue] = useState("");
  const [para, setPara] = useState(equipo.find((p) => p.yo)?.id ?? equipo[0]?.id ?? "");
  const [dia, setDia] = useState(hoy);
  const [repite, setRepite] = useState("");
  const [estado, setEstado] = useState<{ ok?: boolean; error?: string }>({});
  const [guardando, empezar] = useTransition();
  if (!abierto) return <button type="button" className="boton boton-principal" onClick={() => setAbierto(true)}><Icono nombre="mas" /> Nueva tarea</button>;
  return (
    <form className="tarjeta p-5 grid gap-3 sm:grid-cols-2" data-nueva-tarea
      onSubmit={(e) => { e.preventDefault(); empezar(async () => { const r = await crearTarea(que, para, dia, socio?.id ?? null, repite || null); setEstado(r.error ? { error: r.error } : { ok: true }); if (!r.error) setQue(""); }); }}>
      <label className="block space-y-1 sm:col-span-2"><span className="etiqueta">Qué hay que hacer</span>
        <input className="campo" maxLength={200} autoFocus value={que} onChange={(e) => setQue(e.target.value)} placeholder={socio ? `Llamar a ${socio.nombre.split(" ")[0]} para…` : "Ej: reponer agua, llamar a Juan"} /></label>
      <div className="sm:col-span-2 empty:hidden"><AvisoSalud texto={que} /></div>
      <label className="block space-y-1"><span className="etiqueta">Para quién</span>
        <select className="campo" value={para} onChange={(e) => setPara(e.target.value)}>{equipo.map((p) => <option key={p.id} value={p.id}>{p.yo ? `${p.nombre} (vos)` : p.nombre}</option>)}</select></label>
      <label className="block space-y-1"><span className="etiqueta">Para qué día</span>
        <input className="campo" type="date" min={hoy} value={dia} onChange={(e) => setDia(e.target.value)} /></label>
      <label className="block space-y-1"><span className="etiqueta">¿Se repite?</span>
        <select className="campo" value={repite} onChange={(e) => setRepite(e.target.value)} data-repite>
          <option value="">No, es una vez</option><option value="diaria">Todos los días</option><option value="semanal">Todas las semanas</option><option value="mensual">Todos los meses</option></select></label>
      {socio && <p className="texto-suave sm:col-span-2">Sobre <strong>{socio.nombre}</strong></p>}
      {estado.error && <Mensaje tipo="error" className="sm:col-span-2">{estado.error}</Mensaje>}
      {estado.ok && <Mensaje tipo="exito" className="sm:col-span-2">Tarea anotada.</Mensaje>}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className="boton boton-principal" disabled={guardando || que.trim().length < 2 || !!detectarSalud(que)}>{guardando ? "Guardando…" : "Anotar tarea"}</button>
        <button type="button" className="boton" onClick={() => setAbierto(false)}>Cerrar</button>
      </div>
    </form>
  );
}
