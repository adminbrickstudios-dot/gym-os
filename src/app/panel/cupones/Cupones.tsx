"use client";
import { useState, useTransition } from "react";
import { Mensaje } from "@/components/ui/Mensaje";
import { formatearPesos } from "@/lib/formato";
import { desactivarCupon, guardarCupon } from "./acciones";

export type CuponPanel = { cupon_id: string; codigo: string; tipo: "porcentaje" | "monto"; valor: number; tope_usos: number | null; vence_en: string | null;
  activo: boolean; planes: string[]; usos: number; socios: number };

export function NuevoCupon({ planes }: { planes: { plan_id: string; nombre: string }[] }) {
  const [abierto, setAbierto] = useState(false);
  const [d, setD] = useState({ codigo: "", tipo: "porcentaje", valor: "", tope: "", vence: "" });
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [estado, setEstado] = useState<{ ok?: boolean; error?: string }>({});
  const [guardando, empezar] = useTransition();
  const set = (k: keyof typeof d, v: string) => setD((x) => ({ ...x, [k]: v }));
  if (!abierto) return <button type="button" className="boton boton-principal" onClick={() => setAbierto(true)}>➕ Nuevo cupón</button>;
  return (
    <form className="tarjeta p-5 grid gap-3 sm:grid-cols-2" data-nuevo-cupon
      onSubmit={(e) => { e.preventDefault(); empezar(async () => {
        const valor = Number(d.valor.replace(/\./g, "").replace(",", "."));
        if (!valor || Number.isNaN(valor)) { setEstado({ error: d.tipo === "porcentaje" ? "Escribí el porcentaje (de 1 a 100)." : "Escribí el monto, como 2.000." }); return; }
        const r = await guardarCupon({ codigo: d.codigo, tipo: d.tipo, valor, tope: d.tope ? Number(d.tope) : null, vence: d.vence || null, planes: elegidos });
        setEstado(r.error ? { error: r.error } : { ok: true });
        if (!r.error) { setAbierto(false); setD({ codigo: "", tipo: "porcentaje", valor: "", tope: "", vence: "" }); setElegidos([]); }
      }); }}>
      <label className="block space-y-1"><span className="etiqueta">Código</span><input className="campo uppercase" maxLength={20} autoFocus value={d.codigo} onChange={(e) => set("codigo", e.target.value.replace(/\s/g, ""))} placeholder="VERANO25" /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-1"><span className="etiqueta">Descuento</span>
          <select className="campo" value={d.tipo} onChange={(e) => set("tipo", e.target.value)}><option value="porcentaje">Porcentaje</option><option value="monto">Monto fijo</option></select></label>
        <label className="block space-y-1"><span className="etiqueta">{d.tipo === "porcentaje" ? "%" : "$"}</span><input className="campo" inputMode="decimal" value={d.valor} onChange={(e) => set("valor", e.target.value)} /></label>
      </div>
      <label className="block space-y-1"><span className="etiqueta">Tope de usos</span><input className="campo" inputMode="numeric" value={d.tope} onChange={(e) => set("tope", e.target.value.replace(/\D/g, ""))} placeholder="Sin tope" /></label>
      <label className="block space-y-1"><span className="etiqueta">Vale hasta (inclusive)</span><input className="campo" type="date" value={d.vence} onChange={(e) => set("vence", e.target.value)} /></label>
      <fieldset className="sm:col-span-2 space-y-2"><legend className="etiqueta">Planes (ninguno tildado = todos)</legend>
        <div className="flex flex-wrap gap-2">{planes.map((p) => (
          <label key={p.plan_id} className="pildora cursor-pointer gap-2"><input type="checkbox" checked={elegidos.includes(p.plan_id)}
            onChange={(e) => setElegidos((x) => (e.target.checked ? [...x, p.plan_id] : x.filter((y) => y !== p.plan_id)))} />{p.nombre}</label>
        ))}</div></fieldset>
      {estado.error && <Mensaje tipo="error" className="sm:col-span-2">{estado.error}</Mensaje>}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className="boton boton-principal" disabled={guardando || d.codigo.length < 3}>{guardando ? "Guardando…" : "✅ Crear cupón"}</button>
        <button type="button" className="boton" onClick={() => setAbierto(false)}>Cancelar</button>
      </div>
    </form>
  );
}

export function FilaCupon({ c, puedeEditar, zona }: { c: CuponPanel; puedeEditar: boolean; zona: string }) {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const vence = c.vence_en ? new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "2-digit", month: "2-digit" }).format(new Date(new Date(c.vence_en).getTime() - 1000)) : null;
  const vencido = c.vence_en ? new Date(c.vence_en).getTime() <= Date.now() : false;
  const agotado = c.tope_usos != null && c.usos >= c.tope_usos;
  return (
    <li className={`tarjeta p-4 flex flex-wrap items-center gap-3 ${!c.activo || vencido ? "opacity-60" : ""}`} data-cupon-fila={c.codigo}>
      <span className="numero text-2xl">{c.codigo}</span>
      <span className="min-w-0 flex-1 texto-suave">
        {c.tipo === "porcentaje" ? `${Number(c.valor)}%` : formatearPesos(c.valor)} · {c.planes.length ? c.planes.join(", ") : "todos los planes"}
        {vence && ` · hasta el ${vence}`} · {c.usos}{c.tope_usos != null ? ` de ${c.tope_usos}` : ""} {c.usos === 1 ? "uso" : "usos"} · trajo {c.socios} {c.socios === 1 ? "socio" : "socios"}
        {!c.activo ? " · desactivado" : vencido ? " · vencido" : agotado ? " · agotado" : ""}
      </span>
      {puedeEditar && c.activo && <button type="button" className="boton boton-chico texto-suave" disabled={ocupado}
        onClick={() => empezar(async () => { const r = await desactivarCupon(c.cupon_id); setError(r.error ?? null); })}>Desactivar</button>}
      {error && <Mensaje tipo="error" className="basis-full">{error}</Mensaje>}
    </li>
  );
}
