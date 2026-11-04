"use client";
import { useActionState, useState, useTransition } from "react";
import { formatearPesos } from "@/lib/formato";
import { activarPlan, cambiarPrecio, crearPlan, guardarProducto } from "./acciones";

export type Plan = { plan_id: string; tipo: string; nombre: string; descripcion: string | null; activo: boolean; duracion_meses: number | null;
  cantidad_clases: number | null; precio: number | null; proximo_precio: number | null; proximo_desde: string | null; socios_activos: number };
export type Producto = { producto_id: string; nombre: string; precio: number; activo: boolean };

const TIPO: Record<string, { emoji: string; titulo: string }> = {
  membresia: { emoji: "🏷️", titulo: "Membresías" }, pase_diario: { emoji: "🎫", titulo: "Pases" }, pack: { emoji: "🎟️", titulo: "Packs de clases" },
};

function FilaPlan({ p, fecha }: { p: Plan; fecha: (d: string) => string }) {
  const [precio, setPrecio] = useState(false);
  const [monto, setMonto] = useState("");
  const [desde, setDesde] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const correr = (f: () => Promise<{ error?: string }>) => empezar(async () => { const r = await f(); setError(r.error ?? null); if (!r.error) setPrecio(false); });
  return (
    <li className={`tarjeta p-5 ${p.activo ? "" : "opacity-55"}`}>
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-lg">{p.nombre}</p>
          <p className="texto-suave text-sm">{[p.duracion_meses && p.duracion_meses > 1 ? `${p.duracion_meses} meses` : null, p.cantidad_clases ? `${p.cantidad_clases} clases` : null,
            p.socios_activos ? `${p.socios_activos} socios activos` : null].filter(Boolean).join(" · ") || p.descripcion}</p>
          {p.proximo_precio != null && p.proximo_desde && <p className="text-sm mt-1" style={{ color: "var(--acento)" }}>📅 Desde el {fecha(p.proximo_desde)}: {formatearPesos(p.proximo_precio)}</p>}
        </div>
        <p className="numero text-3xl">{p.precio != null ? formatearPesos(p.precio) : "Sin precio"}</p>
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        {!precio && <button type="button" className="boton boton-chico" onClick={() => setPrecio(true)}>💲 Cambiar precio</button>}
        <button type="button" className="boton boton-chico texto-suave" disabled={ocupado} onClick={() => correr(() => activarPlan(p.plan_id, p.nombre, !p.activo))}>{p.activo ? "Dejar de vender" : "Volver a vender"}</button>
      </div>
      {precio && (
        <form className="grid sm:grid-cols-[1fr_1fr_auto_auto] gap-2 mt-4" onSubmit={(e) => { e.preventDefault(); correr(() => cambiarPrecio(p.plan_id, monto, desde)); }}>
          <input autoFocus className="campo" inputMode="decimal" placeholder="$ precio nuevo" value={monto} onChange={(e) => setMonto(e.target.value)} />
          <input className="campo" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Desde cuándo (vacío = hoy)" title="Desde cuándo (vacío = desde hoy)" />
          <button type="submit" className="boton boton-principal" disabled={!monto || ocupado}>Guardar</button>
          <button type="button" className="boton" onClick={() => setPrecio(false)}>Cancelar</button>
          <p className="text-sm texto-tenue sm:col-span-4">Lo ya cobrado no cambia. Sin fecha, rige desde hoy.</p>
        </form>
      )}
      {error && <p role="alert" className="pildora pildora-rojo mt-3">⚠️ {error}</p>}
    </li>
  );
}

function NuevoPlan() {
  const [estado, accion, guardando] = useActionState(crearPlan, {});
  const [tipo, setTipo] = useState("membresia");
  const [abierto, setAbierto] = useState(false);
  if (!abierto) return <button type="button" className="boton boton-principal" onClick={() => setAbierto(true)}>➕ Nuevo plan</button>;
  return (
    <form key={estado.ok} action={accion} className="tarjeta p-5 grid sm:grid-cols-2 gap-3">
      <p className="titulo text-2xl sm:col-span-2">➕ Nuevo plan</p>
      <div className="sm:col-span-2 flex flex-wrap gap-2">
        {Object.entries(TIPO).map(([k, v]) => (
          <label key={k} className={`boton !min-h-11 cursor-pointer ${tipo === k ? "!border-[var(--acento)]" : ""}`}>
            <input type="radio" name="tipo" value={k} checked={tipo === k} onChange={() => setTipo(k)} className="sr-only" />{v.emoji} {v.titulo.replace(/s$/, "").replace("Packs", "Pack")}
          </label>
        ))}
      </div>
      <label className="space-y-1"><span className="etiqueta">Nombre</span><input name="nombre" required className="campo" placeholder={tipo === "pack" ? "Pack 8 clases" : tipo === "pase_diario" ? "Pase diario" : "Pase libre"} /></label>
      <label className="space-y-1"><span className="etiqueta">Precio</span><input name="precio" required inputMode="decimal" className="campo" placeholder="$" /></label>
      {tipo === "membresia" && <label className="space-y-1"><span className="etiqueta">Dura (meses)</span><input name="duracion_meses" type="number" min={1} max={24} defaultValue={1} className="campo" /></label>}
      {tipo === "membresia" && <label className="space-y-1"><span className="etiqueta">Veces por semana (vacío = libre)</span><input name="max_ingresos_semana" type="number" min={1} max={7} className="campo" /></label>}
      {tipo === "pack" && <label className="space-y-1"><span className="etiqueta">Cantidad de clases</span><input name="cantidad_clases" type="number" min={1} required className="campo" /></label>}
      {tipo === "pack" && <label className="space-y-1"><span className="etiqueta">Vence a los (días)</span><input name="validez_dias" type="number" min={1} defaultValue={60} className="campo" /></label>}
      <label className="space-y-1 sm:col-span-2"><span className="etiqueta">Descripción (se ve en la página)</span><input name="descripcion" className="campo" /></label>
      {estado.error && <p role="alert" className="pildora pildora-rojo sm:col-span-2">⚠️ {estado.error}</p>}
      <div className="flex gap-2 sm:col-span-2"><button type="submit" disabled={guardando} className="boton boton-principal">✅ Crear</button><button type="button" className="boton" onClick={() => setAbierto(false)}>Cerrar</button></div>
    </form>
  );
}

function Productos({ productos }: { productos: Producto[] }) {
  const [nuevo, setNuevo] = useState({ nombre: "", precio: "" });
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const correr = (f: () => Promise<{ error?: string }>, ok?: () => void) => empezar(async () => { const r = await f(); setError(r.error ?? null); if (!r.error) ok?.(); });
  return (
    <section>
      <h2 className="titulo text-3xl mb-4">🥤 Productos</h2>
      <ul className="grid sm:grid-cols-2 gap-2 mb-4">
        {productos.map((p) => (
          <li key={p.producto_id} className={`tarjeta flex items-center gap-3 px-4 py-3 ${p.activo ? "" : "opacity-55"}`}>
            <span className="flex-1 font-semibold">{p.nombre}</span>
            <span className="numero text-xl">{formatearPesos(p.precio)}</span>
            <button type="button" className="boton-texto" disabled={ocupado} onClick={() => correr(() => guardarProducto(p.producto_id, p.nombre, String(p.precio), !p.activo))}>{p.activo ? "Ocultar" : "Mostrar"}</button>
          </li>
        ))}
      </ul>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); correr(() => guardarProducto(null, nuevo.nombre, nuevo.precio), () => setNuevo({ nombre: "", precio: "" })); }}>
        <input className="campo !w-auto flex-1 min-w-40" placeholder="Producto (ej: Agua)" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
        <input className="campo !w-32" inputMode="decimal" placeholder="$" value={nuevo.precio} onChange={(e) => setNuevo({ ...nuevo, precio: e.target.value })} />
        <button type="submit" className="boton" disabled={!nuevo.nombre.trim() || !nuevo.precio || ocupado}>➕ Agregar</button>
      </form>
      {error && <p role="alert" className="pildora pildora-rojo mt-3">⚠️ {error}</p>}
    </section>
  );
}

export function Editor({ planes, productos, zona }: { planes: Plan[]; productos: Producto[]; zona: string }) {
  const fecha = (d: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "2-digit", month: "2-digit" }).format(new Date(d));
  return (
    <div className="space-y-12">
      <NuevoPlan />
      {Object.entries(TIPO).map(([k, v]) => {
        const lista = planes.filter((p) => p.tipo === k);
        if (!lista.length) return null;
        return (
          <section key={k}>
            <h2 className="titulo text-3xl mb-4">{v.emoji} {v.titulo}</h2>
            <ul className="space-y-2">{lista.map((p) => <FilaPlan key={p.plan_id} p={p} fecha={fecha} />)}</ul>
          </section>
        );
      })}
      <Productos productos={productos} />
    </div>
  );
}
