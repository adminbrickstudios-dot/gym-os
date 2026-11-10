"use client";
// VD-18 (D21) · Productos y stock: foto, precio, costo y margen, categoría, stock con "queda poco",
// entrada de mercadería con la foto del remito. El stock se calcula en la base (entradas + conteos - ventas).
import { useCallback, useEffect, useState, useTransition } from "react";
import { formatearPesos } from "@/lib/formato";
import { urlFotoProducto } from "@/lib/url-producto";
import {
  configurarStock, entradaMercaderia, guardarFichaProducto, guardarProducto, movimientosDe, moverStock, quitarFotoProducto, subirFotoProducto, verRemito,
  type Movimiento, type Stock,
} from "./acciones";
import { Icono } from "@/components/ui/Icono";

export type Producto = {
  producto_id: string; nombre: string; precio: number; activo: boolean;
  costo?: number | null; margen?: number | null; categoria?: string | null; foto_path?: string | null; permite_negativo?: boolean;
};

/** Queda poco: hay, pero no más que el mínimo que el dueño puso. */
export const quedaPoco = (s?: Pick<Stock, "controla" | "stock" | "minimo">) => !!s?.controla && s.stock > 0 && s.minimo != null && s.stock <= s.minimo;

function Miniatura({ p }: { p: Producto }) {
  const url = urlFotoProducto(p.foto_path);
  return url
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={url} alt={`Foto de ${p.nombre}`} className="size-12 rounded-xl object-cover flex-none" data-foto />
    : <span aria-hidden className="size-12 rounded-xl flex-none grid place-items-center text-2xl bg-[var(--tarjeta)] border border-[var(--borde)]"></span>;
}

function FilaProducto({ p, stock }: { p: Producto; stock?: Stock }) {
  const [panelStock, setPanelStock] = useState(false);
  const [editando, setEditando] = useState(false);
  const [datos, setDatos] = useState({ nombre: p.nombre, precio: String(p.precio).replace(".", ","), costo: p.costo != null ? String(p.costo).replace(".", ",") : "", categoria: p.categoria ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const correr = (f: () => Promise<{ error?: string }>, ok?: () => void) => empezar(async () => { const r = await f(); setError(r.error ?? null); if (!r.error) ok?.(); });
  const poco = quedaPoco(stock);
  return (
    <li className={`tarjeta px-4 py-3 ${p.activo ? "" : "opacity-55"}`} data-producto={p.nombre}>
      {editando ? (
        <form className="flex flex-wrap gap-2" onSubmit={(e) => {
          e.preventDefault();
          correr(async () => {
            const r = await guardarProducto(p.producto_id, datos.nombre, datos.precio, p.activo);
            if (r.error) return r;
            return guardarFichaProducto(p.producto_id, { costo: datos.costo, categoria: datos.categoria });
          }, () => setEditando(false));
        }}>
          <input autoFocus required aria-label="Nombre del producto" className="campo !w-auto flex-1 min-w-32" value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} />
          <input required aria-label="Precio del producto" inputMode="decimal" className="campo !w-28" value={datos.precio} onChange={(e) => setDatos({ ...datos, precio: e.target.value })} />
          <input aria-label="Costo del producto" placeholder="Costo" inputMode="decimal" className="campo !w-28" value={datos.costo} onChange={(e) => setDatos({ ...datos, costo: e.target.value })} />
          <input aria-label="Categoría del producto" placeholder="Categoría" maxLength={40} className="campo !w-36" value={datos.categoria} onChange={(e) => setDatos({ ...datos, categoria: e.target.value })} />
          <button type="submit" className="boton boton-principal" disabled={ocupado}>Guardar</button>
          <button type="button" className="boton" onClick={() => setEditando(false)}>Cancelar</button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Miniatura p={p} />
          <span className="flex-1 min-w-0">
            <span className="block font-semibold">{p.nombre}{!p.activo && <span className="texto-tenue font-normal text-sm"> · oculto en Vender</span>}</span>
            {(p.categoria || p.margen != null) && (
              <span className="block texto-tenue text-sm" data-ficha>
                {p.categoria}{p.categoria && p.margen != null ? " · " : ""}{p.margen != null && <span data-margen>costo {formatearPesos(Number(p.costo))} · margen {formatearPesos(Number(p.margen))}</span>}
              </span>
            )}
          </span>
          <span className="numero text-xl">{formatearPesos(p.precio)}</span>
          {stock?.controla && (
            <span className={`pildora text-sm ${stock.stock <= 0 ? "pildora-rojo" : poco ? "pildora-amarillo" : ""}`} data-stock={stock.stock} {...(poco ? { "data-queda-poco": "" } : {})}>
              <Icono nombre="caja" /> {stock.stock <= 0 ? "Sin stock" : `Quedan ${stock.stock}`}{poco ? " · queda poco" : ""}
            </span>
          )}
          <button type="button" className="boton-texto" onClick={() => setEditando(true)}><Icono nombre="lapiz" /> Editar</button>
          <button type="button" className="boton-texto" onClick={() => setPanelStock(!panelStock)}><Icono nombre="caja" /> Stock</button>
          <label className="boton-texto cursor-pointer"><Icono nombre="camara" /> Foto
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={`Foto de ${p.nombre}`} disabled={ocupado}
              onChange={(e) => {
                const f = e.target.files?.[0]; e.target.value = "";
                if (!f) return;
                const fd = new FormData(); fd.set("foto", f);
                correr(() => subirFotoProducto(p.producto_id, fd));
              }} />
          </label>
          {p.foto_path && <button type="button" className="boton-texto" disabled={ocupado} onClick={() => correr(() => quitarFotoProducto(p.producto_id))}>Sin foto</button>}
          <button type="button" className="boton-texto" disabled={ocupado} onClick={() => correr(() => guardarProducto(p.producto_id, p.nombre, p.precio, !p.activo))}>{p.activo ? "Ocultar" : "Mostrar"}</button>
        </div>
      )}
      {panelStock && <PanelStock p={p} stock={stock} cerrar={() => setPanelStock(false)} />}
      {error && <p role="alert" className="pildora pildora-rojo mt-2"><Icono nombre="alerta" /> {error}</p>}
    </li>
  );
}

/** VEN-4 + VD-18: llevar stock, entrada de mercadería (con remito), contar, desde cuánto avisar y si se puede vender sin stock. */
function PanelStock({ p, stock, cerrar }: { p: Producto; stock?: Stock; cerrar: () => void }) {
  const [cant, setCant] = useState("");
  const [motivo, setMotivo] = useState("");
  const [remito, setRemito] = useState<File | null>(null);
  const [contado, setContado] = useState("");
  const [minimo, setMinimo] = useState(stock?.minimo != null ? String(stock.minimo) : "");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const correr = (f: () => Promise<{ error?: string }>, ok?: () => void) => empezar(async () => { const r = await f(); setError(r.error ?? null); if (!r.error) ok?.(); });
  if (!stock?.controla) {
    return (
      <form className="mt-3 space-y-2" data-panel-stock onSubmit={(e) => { e.preventDefault(); correr(() => configurarStock(p.producto_id, true, minimo, contado), cerrar); }}>
        <p className="text-sm texto-suave">Llevar la cuenta de cuántos quedan. Vender lo muestra y no deja vender más de lo que hay (salvo que lo permitas).</p>
        <div className="flex flex-wrap gap-2">
          <input className="campo !w-36" inputMode="numeric" required placeholder="¿Cuántos hay?" aria-label="Cuántos hay ahora" value={contado} onChange={(e) => setContado(e.target.value)} />
          <input className="campo !w-40" inputMode="numeric" placeholder="Avisar con (opcional)" aria-label="Avisar cuando queden" value={minimo} onChange={(e) => setMinimo(e.target.value)} />
          <button type="submit" className="boton boton-principal" disabled={ocupado || !contado.trim()}><Icono nombre="caja" /> Llevar stock</button>
        </div>
        {error && <p role="alert" className="pildora pildora-rojo"><Icono nombre="alerta" /> {error}</p>}
      </form>
    );
  }
  return (
    <div className="mt-3 space-y-3" data-panel-stock>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(); fd.set("cantidad", cant); fd.set("motivo", motivo); if (remito) fd.set("remito", remito);
        correr(() => entradaMercaderia(p.producto_id, fd), () => { setCant(""); setMotivo(""); setRemito(null); });
      }}>
        <input className="campo !w-28" inputMode="numeric" placeholder="Cuántos" aria-label="Cuántos entraron" value={cant} onChange={(e) => setCant(e.target.value)} />
        <input className="campo !w-auto flex-1 min-w-32" placeholder="De dónde (opcional)" aria-label="Motivo de la entrada" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        <label className="boton cursor-pointer"><Icono nombre="documento" /> {remito ? remito.name.slice(0, 18) : "Foto del remito"}
          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" aria-label="Foto del remito" onChange={(e) => setRemito(e.target.files?.[0] ?? null)} />
        </label>
        <button type="submit" className="boton" disabled={ocupado || !cant.trim()}><Icono nombre="mas" /> Entró mercadería</button>
      </form>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); correr(() => moverStock(p.producto_id, "conteo", contado), () => setContado("")); }}>
        <input className="campo !w-28" inputMode="numeric" placeholder="Hay" aria-label="Cuántos contaste" value={contado} onChange={(e) => setContado(e.target.value)} />
        <button type="submit" className="boton" disabled={ocupado || !contado.trim()}><Icono nombre="calculadora" /> Conté: ajustar</button>
      </form>
      <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); correr(() => configurarStock(p.producto_id, true, minimo)); }}>
        <span className="text-sm">Avisar cuando queden</span>
        <input className="campo !w-24" inputMode="numeric" aria-label="Avisar cuando queden" value={minimo} onChange={(e) => setMinimo(e.target.value)} />
        <button type="submit" className="boton boton-chico" disabled={ocupado}>Guardar</button>
        <button type="button" className="boton-texto ml-auto" disabled={ocupado} onClick={() => correr(() => configurarStock(p.producto_id, false, ""), cerrar)}>Dejar de llevar stock</button>
      </form>
      <label className="flex items-center gap-2 min-h-11 text-sm">
        <input type="checkbox" className="w-5 h-5" aria-label="Vender aunque no quede stock" checked={!!stock.negativo} disabled={ocupado}
          onChange={(e) => correr(() => guardarFichaProducto(p.producto_id, { permiteNegativo: e.target.checked }))} />
        <span>Vender aunque no quede stock <span className="texto-tenue">(si no, Vender frena cuando llega a cero)</span></span>
      </label>
      <Historial productoId={p.producto_id} version={`${stock.stock}`} />
      {error && <p role="alert" className="pildora pildora-rojo"><Icono nombre="alerta" /> {error}</p>}
    </div>
  );
}

/** Las últimas entradas y conteos, con el remito para ver. */
function Historial({ productoId, version }: { productoId: string; version: string }) {
  const [lista, setLista] = useState<Movimiento[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cargar = useCallback(async () => { const r = await movimientosDe(productoId); if (r.error) setError(r.error); else setLista(r.movimientos ?? []); }, [productoId]);
  useEffect(() => { void cargar(); }, [cargar, version]);
  if (error) return <p role="alert" className="pildora pildora-rojo"><Icono nombre="alerta" /> {error}</p>;
  if (!lista?.length) return null;
  return (
    <ul className="text-sm space-y-1" data-movimientos>
      {lista.slice(0, 5).map((m) => (
        <li key={m.id} className="flex flex-wrap items-center gap-x-2 texto-suave" data-movimiento={m.tipo}>
          <span className="numero">{m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}</span>
          <span>{m.tipo === "entrada" ? "entró" : "ajuste"}{m.motivo ? ` · ${m.motivo}` : ""} · {m.por} · {new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit" }).format(new Date(m.fecha))}</span>
          {m.remito && <VerRemito id={m.id} />}
        </li>
      ))}
    </ul>
  );
}

function VerRemito({ id }: { id: string }) {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  return (
    <>
      <button type="button" className="boton-texto !min-h-0" data-ver-remito disabled={ocupado}
        onClick={() => empezar(async () => { const r = await verRemito(id); if (r.url) { setError(null); window.open(r.url, "_blank", "noopener,noreferrer"); } else setError(r.error ?? "No se pudo abrir"); })}><Icono nombre="recibo" /> Ver remito</button>
      {error && <span role="alert" className="pildora pildora-rojo"><Icono nombre="alerta" /> {error}</span>}
    </>
  );
}

export function Productos({ productos, stock }: { productos: Producto[]; stock: Record<string, Stock> }) {
  const [nuevo, setNuevo] = useState({ nombre: "", precio: "" });
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const bajos = productos.filter((p) => p.activo && stock[p.producto_id] && (quedaPoco(stock[p.producto_id]) || (stock[p.producto_id].controla && stock[p.producto_id].stock <= 0)));
  return (
    <section data-productos>
      <h2 className="titulo text-3xl mb-1">Productos y stock</h2>
      <p className="texto-suave mb-4">Lo que se vende en el mostrador además de los planes: agua, bebidas, suplementos. Aparecen en Vender con su foto. Las cuotas y los pases se cobran desde Cobrar.</p>
      {bajos.length > 0 && (
        <p className="pildora pildora-amarillo !rounded-2xl !px-4 !py-3 mb-4" data-por-reponer>
          <Icono nombre="caja" /> Para reponer: {bajos.map((p) => `${p.nombre} (${stock[p.producto_id].stock <= 0 ? "sin stock" : `quedan ${stock[p.producto_id].stock}`})`).join(", ")}
        </p>
      )}
      {productos.length === 0 ? <p className="texto-tenue mb-4">Todavía no cargaste productos. Agregá el primero acá abajo, y después sumale la foto y el stock.</p> : (
        <ul className="grid sm:grid-cols-2 gap-2 mb-4">{productos.map((p) => <FilaProducto key={p.producto_id} p={p} stock={stock[p.producto_id]} />)}</ul>
      )}
      <form className="flex flex-wrap gap-2" onSubmit={(e) => {
        e.preventDefault();
        empezar(async () => { const r = await guardarProducto(null, nuevo.nombre, nuevo.precio); setError(r.error ?? null); if (!r.error) setNuevo({ nombre: "", precio: "" }); });
      }}>
        <input className="campo !w-auto flex-1 min-w-40" aria-label="Producto nuevo" placeholder="Producto (ej: Agua)" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
        <input className="campo !w-32" inputMode="decimal" aria-label="Precio del producto nuevo" placeholder="$" value={nuevo.precio} onChange={(e) => setNuevo({ ...nuevo, precio: e.target.value })} />
        <button type="submit" className="boton" disabled={!nuevo.nombre.trim() || !nuevo.precio || ocupado}><Icono nombre="mas" /> Agregar</button>
      </form>
      {error && <p role="alert" className="pildora pildora-rojo mt-3"><Icono nombre="alerta" /> {error}</p>}
    </section>
  );
}
