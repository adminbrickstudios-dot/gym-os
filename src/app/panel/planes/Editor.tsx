"use client";
import { useActionState, useState, useTransition } from "react";
import { formatearNumero, formatearPesos } from "@/lib/formato";
import { activarPlan, crearPlan, editarPlan, guardarProducto } from "./acciones";
import { Precios, resumenVariantes, type ListaPrecios } from "./Precios";

export type Plan = { plan_id: string; tipo: string; nombre: string; descripcion: string | null; activo: boolean; duracion_meses: number | null;
  cantidad_clases: number | null; validez_dias: number | null; max_ingresos_semana: number | null; hora_desde: string | null; hora_hasta: string | null;
  precio: number | null; proximo_precio: number | null; proximo_desde: string | null; socios_activos: number };
export type Producto = { producto_id: string; nombre: string; precio: number; activo: boolean };

/** PLA-1: una cuota cubre esos meses (la base ya lo calcula así). */
const DURACION: Record<string, string> = { "1": "Mensual", "3": "Trimestral", "6": "Semestral", "12": "Anual" };

const TIPO: Record<string, { emoji: string; titulo: string }> = {
  membresia: { emoji: "🏷️", titulo: "Membresías" }, pase_diario: { emoji: "🎫", titulo: "Pases" }, pack: { emoji: "🎟️", titulo: "Packs de clases" },
};

export type Actividad = { actividad_id: string; nombre: string; emoji: string | null; activa: boolean };

export type Matricula = { monto: number; anual: boolean };

function FilaPlan({ p, lista, fecha, hoy, actividades, incluye, matricula }: {
  p: Plan; lista?: ListaPrecios; fecha: (d: string) => string; hoy: string; actividades: Actividad[]; incluye: string[]; matricula?: Matricula;
}) {
  const [abierto, setAbierto] = useState<null | "precio" | "editar">(null);
  const [datos, setDatos] = useState({ nombre: p.nombre, descripcion: p.descripcion ?? "", veces: p.max_ingresos_semana ? String(p.max_ingresos_semana) : "",
    desde: p.hora_desde?.slice(0, 5) ?? "", hasta: p.hora_hasta?.slice(0, 5) ?? "", actividades: incluye,
    matricula: matricula ? formatearNumero(Number(matricula.monto), 2) : "", matriculaAnual: matricula?.anual ?? false });
  const nombresIncluye = actividades.filter((a) => incluye.includes(a.actividad_id)).map((a) => a.nombre);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const correr = (f: () => Promise<{ error?: string }>) => empezar(async () => { const r = await f(); setError(r.error ?? null); if (!r.error) setAbierto(null); });
  const detalle = [
    p.duracion_meses && p.duracion_meses > 1
      ? `${DURACION[p.duracion_meses] ?? `${p.duracion_meses} meses`}${p.precio != null ? ` (${formatearPesos(Math.round(p.precio / p.duracion_meses))} por mes)` : ""}` : null,
    p.cantidad_clases ? `${p.cantidad_clases} clases` : null,
    p.validez_dias ? `vence a los ${p.validez_dias} días` : null,
    p.max_ingresos_semana ? `${p.max_ingresos_semana} ${p.max_ingresos_semana === 1 ? "vez" : "veces"} por semana` : null,
    p.hora_desde && p.hora_hasta ? `de ${p.hora_desde.slice(0, 5)} a ${p.hora_hasta.slice(0, 5)}` : null,
    nombresIncluye.length ? `solo ${nombresIncluye.join(", ")}` : null,
    matricula ? `matrícula ${formatearPesos(matricula.monto)}${matricula.anual ? " cada año" : " al entrar"}` : null,
    p.socios_activos ? `${p.socios_activos} socios activos` : null,
  ].filter(Boolean).join(" · ");
  return (
    <li className={`tarjeta p-5 ${p.activo ? "" : "opacity-55"}`} data-plan={p.nombre}>
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-lg">{p.nombre}{!p.activo && <span className="pildora ml-2 text-sm">No se vende</span>}</p>
          {detalle && <p className="texto-suave text-sm">{detalle}</p>}
          {p.descripcion && <p className="texto-tenue text-sm">{p.descripcion}</p>}
          {lista?.hoy && lista.hoy.variantes.length > 0 && <p className="text-sm mt-1" data-variantes>{resumenVariantes(lista.hoy)}</p>}
          {p.proximo_precio != null && p.proximo_desde && <p className="text-sm mt-1" style={{ color: "var(--acento)" }}>📅 Desde el {fecha(p.proximo_desde)}: {formatearPesos(p.proximo_precio)}{lista?.proxima?.variantes.length ? ` (${resumenVariantes(lista.proxima)})` : ""}</p>}
        </div>
        <p className="numero text-3xl">{p.precio != null ? formatearPesos(p.precio) : "Sin precio"}</p>
      </div>
      {!abierto && (
        <div className="flex flex-wrap gap-2 mt-4">
          <button type="button" className="boton boton-chico" onClick={() => setAbierto("precio")}>💲 Precios</button>
          <button type="button" className="boton boton-chico" onClick={() => setAbierto("editar")}>✏️ Editar</button>
          <button type="button" className="boton boton-chico texto-suave" disabled={ocupado} onClick={() => correr(() => activarPlan(p.plan_id, !p.activo))}>{p.activo ? "Dejar de vender" : "Volver a vender"}</button>
        </div>
      )}
      {abierto === "precio" && lista && <Precios lista={lista} hoy={hoy} fecha={fecha} cerrar={() => setAbierto(null)} />}
      {abierto === "editar" && (
        <form className="grid sm:grid-cols-2 gap-3 mt-4" onSubmit={(e) => {
          e.preventDefault();
          correr(() => editarPlan(p.plan_id, {
            nombre: datos.nombre, descripcion: datos.descripcion,
            ...(p.tipo === "membresia" ? { max_ingresos_semana: datos.veces, hora_desde: datos.desde, hora_hasta: datos.hasta } : {}),
          }, actividades.length ? datos.actividades : undefined,
          p.tipo === "membresia" ? { monto: datos.matricula, anual: datos.matriculaAnual } : undefined));
        }}>
          <label className="space-y-1"><span className="etiqueta">Nombre</span><input autoFocus required className="campo" value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} /></label>
          {p.tipo === "membresia" && <label className="space-y-1"><span className="etiqueta">Veces por semana (vacío = libre)</span><input type="number" min={1} max={7} className="campo" value={datos.veces} onChange={(e) => setDatos({ ...datos, veces: e.target.value })} /></label>}
          {p.tipo === "membresia" && (
            <fieldset className="sm:col-span-2 space-y-1"><legend className="etiqueta mb-1">Horario en que puede entrar (vacío = todo el día)</legend>
              <div className="flex flex-wrap items-center gap-2">
                <span>De</span><input type="time" className="campo !w-36" aria-label="Horario desde" value={datos.desde} onChange={(e) => setDatos({ ...datos, desde: e.target.value })} />
                <span>a</span><input type="time" className="campo !w-36" aria-label="Horario hasta" value={datos.hasta} onChange={(e) => setDatos({ ...datos, hasta: e.target.value })} />
                {(datos.desde || datos.hasta) && <button type="button" className="boton boton-chico" onClick={() => setDatos({ ...datos, desde: "", hasta: "" })}>Todo el día</button>}
              </div>
            </fieldset>
          )}
          {actividades.length > 0 && (
            <fieldset className="sm:col-span-2 space-y-1"><legend className="etiqueta mb-1">Clases que puede reservar (ninguna tildada = todas)</legend>
              <div className="flex flex-wrap gap-2">
                {actividades.map((a) => {
                  const si = datos.actividades.includes(a.actividad_id);
                  return (
                    <label key={a.actividad_id} className={`boton !min-h-11 cursor-pointer ${si ? "!border-[var(--acento)]" : ""}`}>
                      <input type="checkbox" className="sr-only" checked={si} aria-label={a.nombre}
                        onChange={() => setDatos({ ...datos, actividades: si ? datos.actividades.filter((x) => x !== a.actividad_id) : [...datos.actividades, a.actividad_id] })} />
                      {si ? "✓ " : ""}{a.emoji ?? ""} {a.nombre}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
          {p.tipo === "membresia" && (
            <fieldset className="sm:col-span-2 space-y-1"><legend className="etiqueta mb-1">Matrícula (vacío = sin matrícula)</legend>
              <div className="flex flex-wrap items-center gap-3">
                <input className="campo !w-40" inputMode="decimal" placeholder="$" aria-label="Matrícula" value={datos.matricula} onChange={(e) => setDatos({ ...datos, matricula: e.target.value })} />
                <label className="flex items-center gap-2 min-h-11"><input type="checkbox" className="w-5 h-5" checked={datos.matriculaAnual} onChange={(e) => setDatos({ ...datos, matriculaAnual: e.target.checked })} />Se vuelve a cobrar cada año</label>
              </div>
            </fieldset>
          )}
          <label className="space-y-1 sm:col-span-2"><span className="etiqueta">Descripción (se ve en la página)</span><input className="campo" value={datos.descripcion} onChange={(e) => setDatos({ ...datos, descripcion: e.target.value })} /></label>
          <p className="text-sm texto-tenue sm:col-span-2">El tipo y la duración no se cambian: cambiarían lo que ya se vendió. Para eso, un plan nuevo.</p>
          <div className="flex gap-2 sm:col-span-2"><button type="submit" className="boton boton-principal" disabled={ocupado}>Guardar</button><button type="button" className="boton" onClick={() => setAbierto(null)}>Cancelar</button></div>
        </form>
      )}
      {error && <p role="alert" className="pildora pildora-rojo mt-3">⚠️ {error}</p>}
    </li>
  );
}

function NuevoPlan() {
  const [estado, accion, guardando] = useActionState(crearPlan, {});
  const [tipo, setTipo] = useState("membresia");
  const [meses, setMeses] = useState("1");
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
      {tipo === "membresia" && (
        <fieldset className="space-y-1 sm:col-span-2"><legend className="etiqueta mb-1">Cada cuánto paga</legend>
          <div className="flex flex-wrap gap-2">
            {Object.entries(DURACION).map(([m, nombre]) => (
              <label key={m} className={`boton !min-h-11 cursor-pointer ${meses === m ? "!border-[var(--acento)]" : ""}`}>
                <input type="radio" name="duracion_meses" value={m} checked={meses === m} onChange={() => setMeses(m)} className="sr-only" />{nombre}
              </label>
            ))}
          </div>
          {meses !== "1" && <p className="text-sm texto-tenue">El precio es el total de los {meses} meses; una cuota cubre los {meses}.</p>}
        </fieldset>
      )}
      {tipo === "membresia" && <label className="space-y-1"><span className="etiqueta">Veces por semana (vacío = libre)</span><input name="max_ingresos_semana" type="number" min={1} max={7} className="campo" /></label>}
      {tipo === "membresia" && (
        <fieldset className="space-y-1"><legend className="etiqueta mb-1">Horario (vacío = todo el día)</legend>
          <div className="flex items-center gap-2"><input name="hora_desde" type="time" aria-label="Horario desde" className="campo" /><span>a</span><input name="hora_hasta" type="time" aria-label="Horario hasta" className="campo" /></div>
        </fieldset>
      )}
      {tipo === "membresia" && (
        <fieldset className="space-y-1"><legend className="etiqueta mb-1">Matrícula (vacío = sin matrícula)</legend>
          <div className="flex flex-wrap items-center gap-3">
            <input name="matricula" inputMode="decimal" placeholder="$" aria-label="Matrícula" className="campo !w-40" />
            <label className="flex items-center gap-2 min-h-11"><input type="checkbox" name="matricula_anual" className="w-5 h-5" />Cada año</label>
          </div>
        </fieldset>
      )}
      {tipo === "pack" && <label className="space-y-1"><span className="etiqueta">Cantidad de clases</span><input name="cantidad_clases" type="number" min={1} required className="campo" /></label>}
      {tipo === "pack" && <label className="space-y-1"><span className="etiqueta">Vence a los (días)</span><input name="validez_dias" type="number" min={1} defaultValue={60} className="campo" /></label>}
      <label className="space-y-1 sm:col-span-2"><span className="etiqueta">Descripción (se ve en la página)</span><input name="descripcion" className="campo" /></label>
      {estado.error && <p role="alert" className="pildora pildora-rojo sm:col-span-2">⚠️ {estado.error}</p>}
      <div className="flex gap-2 sm:col-span-2"><button type="submit" disabled={guardando} className="boton boton-principal">✅ Crear</button><button type="button" className="boton" onClick={() => setAbierto(false)}>Cerrar</button></div>
    </form>
  );
}

function FilaProducto({ p }: { p: Producto }) {
  const [editando, setEditando] = useState(false);
  const [datos, setDatos] = useState({ nombre: p.nombre, precio: String(p.precio).replace(".", ",") });
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const correr = (f: () => Promise<{ error?: string }>) => empezar(async () => { const r = await f(); setError(r.error ?? null); if (!r.error) setEditando(false); });
  return (
    <li className={`tarjeta px-4 py-3 ${p.activo ? "" : "opacity-55"}`} data-producto={p.nombre}>
      {editando ? (
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); correr(() => guardarProducto(p.producto_id, datos.nombre, datos.precio, p.activo)); }}>
          <input autoFocus required aria-label="Nombre del producto" className="campo !w-auto flex-1 min-w-32" value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} />
          <input required aria-label="Precio del producto" inputMode="decimal" className="campo !w-28" value={datos.precio} onChange={(e) => setDatos({ ...datos, precio: e.target.value })} />
          <button type="submit" className="boton boton-principal" disabled={ocupado}>Guardar</button>
          <button type="button" className="boton" onClick={() => setEditando(false)}>Cancelar</button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex-1 font-semibold min-w-0">{p.nombre}{!p.activo && <span className="texto-tenue font-normal text-sm"> · oculto en Vender</span>}</span>
          <span className="numero text-xl">{formatearPesos(p.precio)}</span>
          <button type="button" className="boton-texto" onClick={() => setEditando(true)}>✏️ Editar</button>
          <button type="button" className="boton-texto" disabled={ocupado} onClick={() => correr(() => guardarProducto(p.producto_id, p.nombre, p.precio, !p.activo))}>{p.activo ? "Ocultar" : "Mostrar"}</button>
        </div>
      )}
      {error && <p role="alert" className="pildora pildora-rojo mt-2">⚠️ {error}</p>}
    </li>
  );
}

function Productos({ productos }: { productos: Producto[] }) {
  const [nuevo, setNuevo] = useState({ nombre: "", precio: "" });
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  return (
    <section>
      <h2 className="titulo text-3xl mb-1">🥤 Productos</h2>
      <p className="texto-suave mb-4">Lo que se vende en el mostrador además de los planes: agua, bebidas, suplementos. Aparecen en Vender.</p>
      {productos.length === 0 ? <p className="texto-tenue mb-4">Todavía no cargaste productos. Agregá el primero acá abajo.</p> : (
        <ul className="grid sm:grid-cols-2 gap-2 mb-4">{productos.map((p) => <FilaProducto key={p.producto_id} p={p} />)}</ul>
      )}
      <form className="flex flex-wrap gap-2" onSubmit={(e) => {
        e.preventDefault();
        empezar(async () => { const r = await guardarProducto(null, nuevo.nombre, nuevo.precio); setError(r.error ?? null); if (!r.error) setNuevo({ nombre: "", precio: "" }); });
      }}>
        <input className="campo !w-auto flex-1 min-w-40" aria-label="Producto nuevo" placeholder="Producto (ej: Agua)" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
        <input className="campo !w-32" inputMode="decimal" aria-label="Precio del producto nuevo" placeholder="$" value={nuevo.precio} onChange={(e) => setNuevo({ ...nuevo, precio: e.target.value })} />
        <button type="submit" className="boton" disabled={!nuevo.nombre.trim() || !nuevo.precio || ocupado}>➕ Agregar</button>
      </form>
      {error && <p role="alert" className="pildora pildora-rojo mt-3">⚠️ {error}</p>}
    </section>
  );
}

export function Editor({ planes, listas, productos, zona, actividades, incluyen, matriculas }: {
  planes: Plan[]; listas: Record<string, ListaPrecios>; productos: Producto[]; zona: string; actividades: Actividad[]; incluyen: Record<string, string[]>;
  matriculas: Record<string, Matricula>;
}) {
  const fecha = (d: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "2-digit", month: "2-digit" }).format(new Date(d));
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(new Date());
  return (
    <div className="space-y-12">
      <NuevoPlan />
      {planes.length === 0 && <p className="texto-tenue">Todavía no hay planes. Creá el primero: sin planes no se puede cobrar una cuota ni dar de alta con plan.</p>}
      {Object.entries(TIPO).map(([k, v]) => {
        const lista = planes.filter((p) => p.tipo === k);
        if (!lista.length) return null;
        return (
          <section key={k}>
            <h2 className="titulo text-3xl mb-4">{v.emoji} {v.titulo}</h2>
            <ul className="space-y-2">{lista.map((p) => <FilaPlan key={p.plan_id} p={p} lista={listas[p.plan_id]} fecha={fecha} hoy={hoy} actividades={actividades} incluye={incluyen[p.plan_id] ?? []} matricula={matriculas[p.plan_id]} />)}</ul>
          </section>
        );
      })}
      <Productos productos={productos} />
    </div>
  );
}
