"use client";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { buscarSociosRapido, type ResultadoSocio } from "@/app/panel/acciones";
import { PildoraEstado, PuntoEstado } from "@/components/panel/Estado";
import { formatearPesos } from "@/lib/formato";
import { cobrar, preciosPara, type Venta } from "./acciones";
import { precioUnitario, totalCarrito, type Linea, type Medio, type PreciosVenta } from "./tipos";

const MEDIOS: { medio: Medio; texto: string }[] = [
  { medio: "efectivo", texto: "💵 Efectivo" },
  { medio: "transferencia", texto: "🏦 Transferencia" },
  { medio: "debito", texto: "💳 Débito" },
  { medio: "credito", texto: "💳 Crédito" },
];

type Socio = { socio_id: string; nombre: string; color: string; texto: string };

export function Carrito({ sedeId, turnoId, socioInicial, preciosIniciales }: {
  sedeId: string; turnoId: string | null; socioInicial: Socio | null; preciosIniciales: PreciosVenta;
}) {
  const [socio, setSocio] = useState<Socio | null>(socioInicial);
  const [precios, setPrecios] = useState(preciosIniciales);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [medio, setMedio] = useState<Medio>("efectivo");
  const [mixto, setMixto] = useState(false);
  const [partes, setPartes] = useState<{ medio: Medio; monto: string }[]>([{ medio: "efectivo", monto: "" }, { medio: "transferencia", monto: "" }]);
  const [buscando, setBuscando] = useState(!socioInicial);
  const [texto, setTexto] = useState("");
  const [encontrados, setEncontrados] = useState<ResultadoSocio[]>([]);
  const [otro, setOtro] = useState<{ descripcion: string; monto: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [venta, setVenta] = useState<Venta | null>(null);
  const [ocupado, empezar] = useTransition();

  useEffect(() => {
    if (!buscando || texto.trim().length < 2) { setEncontrados([]); return; }
    const t = setTimeout(async () => setEncontrados((await buscarSociosRapido(texto.trim())).socios ?? []), 150);
    return () => clearTimeout(t);
  }, [texto, buscando]);

  const elegirSocio = (s: Socio | null) => empezar(async () => {
    setSocio(s); setBuscando(false); setTexto("");
    // Las cuotas, pases y packs son de un socio: al cambiarlo se recalculan.
    setLineas((ls) => ls.filter((l) => l.tipo === "producto" || l.tipo === "otro"));
    const r = await preciosPara(sedeId, s?.socio_id ?? null);
    if (r.error) setError(r.error); else setPrecios(r.precios!);
  });

  const agregar = (l: Omit<Linea, "clave" | "cantidad">) => setLineas((ls) => {
    const igual = ls.find((x) => x.tipo === l.tipo && x.plan_id === l.plan_id && x.producto_id === l.producto_id && l.tipo !== "otro");
    if (igual) return ls.map((x) => (x === igual ? { ...x, cantidad: Math.min(x.cantidad + 1, x.tipo === "cuota" ? 12 : 50) } : x));
    return [...ls, { ...l, clave: crypto.randomUUID(), cantidad: 1 }];
  });
  const cambiar = (clave: string, cambio: Partial<Linea>) => setLineas((ls) => ls.map((l) => (l.clave === clave ? { ...l, ...cambio } : l)));
  const quitar = (clave: string) => setLineas((ls) => ls.filter((l) => l.clave !== clave));

  const medioPrecio = mixto ? null : medio;
  const total = useMemo(() => totalCarrito(lineas, medioPrecio), [lineas, medioPrecio]);
  const sumaMixto = partes.reduce((s, p) => s + (Number(p.monto) || 0), 0);
  const usaEfectivo = mixto ? partes.some((p) => p.medio === "efectivo" && Number(p.monto) > 0) : medio === "efectivo";
  const faltaCaja = usaEfectivo && !turnoId && (total ?? 0) > 0;

  const confirmar = () => empezar(async () => {
    setError(null);
    if (total == null) { setError("Hay algo en el carrito sin precio cargado"); return; }
    const pagos = total === 0 ? [] : mixto
      ? partes.filter((p) => Number(p.monto) > 0).map((p) => ({ medio: p.medio, monto: Number(p.monto) }))
      : [{ medio, monto: total }];
    const items = lineas.map((l) => ({
      tipo: l.tipo, cantidad: l.cantidad, plan_id: l.plan_id, producto_id: l.producto_id,
      descripcion: l.tipo === "otro" ? l.nombre : undefined, precio_unitario: l.tipo === "otro" ? l.precio_fijo : undefined,
      descuento: l.descuento || undefined, descuento_motivo: l.descuento_motivo || undefined,
    }));
    const r = await cobrar({ sedeId, socioId: socio?.socio_id ?? null, turnoId, items, pagos });
    if (r.error) setError(r.error); else { setVenta(r.venta!); setLineas([]); }
  });

  if (venta) {
    return (
      <section className="tarjeta p-6 sm:p-10 max-w-xl" aria-live="polite">
        <p className="text-5xl" aria-hidden>✅</p>
        <p className="titular text-5xl mt-4">Cobrado {formatearPesos(venta.total)}</p>
        {socio && venta.veredicto && <div className="mt-5"><PildoraEstado color={venta.veredicto.color}>{socio.nombre}: {venta.veredicto.texto}</PildoraEstado></div>}
        <div className="flex flex-wrap gap-2 mt-8">
          <button type="button" className="boton boton-principal" onClick={() => { setVenta(null); setSocio(null); setBuscando(true); }}>🛒 Nueva venta</button>
          {socio && <Link href={`/panel/socios/${socio.socio_id}`} className="boton">👤 Ver ficha</Link>}
          <Link href="/panel/entrada" className="boton">🚪 Ir a la entrada</Link>
        </div>
      </section>
    );
  }

  const Boton = ({ onClick, emoji, titulo, precio, deshabilitado }: { onClick: () => void; emoji: string; titulo: string; precio: number | null; deshabilitado?: string }) => (
    <button type="button" onClick={onClick} disabled={!!deshabilitado || precio == null} title={deshabilitado}
      className="boton !flex-col !items-start !justify-between !p-4 min-h-[104px] text-left">
      <span className="flex items-center gap-2"><span aria-hidden className="text-xl">{emoji}</span><span>{titulo}</span></span>
      <span className="numero text-xl texto-suave">{precio == null ? "Sin precio" : formatearPesos(precio)}</span>
    </button>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-8 items-start [&>*]:min-w-0">
      <div className="space-y-8">
        {/* ¿Para quién? */}
        <section>
          <h2 className="titulo text-2xl mb-3">👤 Para quién</h2>
          {socio && !buscando ? (
            <div className="tarjeta flex items-center gap-4 px-4 py-3">
              <PuntoEstado color={socio.color} grande />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-lg truncate">{socio.nombre}</span>
                <span className="block texto-suave truncate">{socio.texto}</span>
              </span>
              <button type="button" className="boton !min-h-11" onClick={() => setBuscando(true)}>Cambiar</button>
            </div>
          ) : (
            <div className="space-y-2">
              <input autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} className="campo !min-h-14 !text-lg" placeholder="🔍 Buscar socio (o vendé sin socio: productos)" aria-label="Buscar socio" />
              {encontrados.map((s) => (
                <button key={s.socio_id} type="button" onClick={() => elegirSocio(s)} className="tarjeta w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-[var(--tarjeta-alta)]">
                  <PuntoEstado color={s.color} />
                  <span className="font-semibold flex-1 truncate">{s.nombre}</span>
                  <span className="texto-tenue text-sm truncate">{s.texto}</span>
                </button>
              ))}
              {socio && <button type="button" className="boton" onClick={() => setBuscando(false)}>Seguir con {socio.nombre}</button>}
              {!socio && texto.trim().length >= 2 && encontrados.length === 0 && (
                <p className="texto-suave">No está. <Link className="underline" href="/panel/socios/nuevo">Darlo de alta</Link> y volver.</p>
              )}
            </div>
          )}
        </section>

        {/* Qué se vende */}
        <section>
          <h2 className="titulo text-2xl mb-3">🛒 Qué se lleva</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {precios.cuota && (
              <Boton emoji="🏷️" titulo={`Cuota ${precios.cuota.plan}`} precio={precioUnitario({ clave: "", tipo: "cuota", nombre: "", cantidad: 1, precios: precios.cuota.precios }, medioPrecio)}
                onClick={() => agregar({ tipo: "cuota", nombre: `Cuota ${precios.cuota!.plan}`, precios: precios.cuota!.precios })} />
            )}
            {precios.pases.map((p) => (
              <Boton key={p.plan_id} emoji="🎫" titulo={p.nombre} precio={precioUnitario({ clave: "", tipo: "pase", nombre: "", cantidad: 1, precios: p.precios }, medioPrecio)}
                deshabilitado={socio ? undefined : "Elegí un socio primero"} onClick={() => agregar({ tipo: "pase", nombre: p.nombre, plan_id: p.plan_id, precios: p.precios })} />
            ))}
            {precios.packs.map((p) => (
              <Boton key={p.plan_id} emoji="🎟️" titulo={p.nombre} precio={precioUnitario({ clave: "", tipo: "pack", nombre: "", cantidad: 1, precios: p.precios }, medioPrecio)}
                deshabilitado={socio ? undefined : "Elegí un socio primero"} onClick={() => agregar({ tipo: "pack", nombre: p.nombre, plan_id: p.plan_id, precios: p.precios })} />
            ))}
            {precios.productos.map((p) => (
              <Boton key={p.producto_id} emoji="🥤" titulo={p.nombre} precio={p.precio}
                onClick={() => agregar({ tipo: "producto", nombre: p.nombre, producto_id: p.producto_id, precio_fijo: p.precio })} />
            ))}
            <button type="button" className="boton !flex-col !items-start !justify-between !p-4 min-h-[104px]" onClick={() => setOtro({ descripcion: "", monto: "" })}>
              <span className="flex items-center gap-2"><span aria-hidden className="text-xl">✍️</span>Otra cosa</span>
              <span className="texto-tenue text-sm">Con descripción y precio</span>
            </button>
          </div>
          {socio && !precios.cuota && <p className="texto-tenue mt-3">Sin membresía activa: asignale un plan desde su ficha para cobrarle la cuota.</p>}
          {otro && (
            <form className="tarjeta p-4 mt-3 flex flex-col sm:flex-row gap-2" onSubmit={(e) => {
              e.preventDefault();
              if (!otro.descripcion.trim() || !(Number(otro.monto) >= 0)) return;
              agregar({ tipo: "otro", nombre: otro.descripcion.trim(), precio_fijo: Number(otro.monto) }); setOtro(null);
            }}>
              <input autoFocus className="campo" placeholder="Qué es (ej: candado)" value={otro.descripcion} onChange={(e) => setOtro({ ...otro, descripcion: e.target.value })} />
              <input className="campo sm:max-w-40" inputMode="decimal" placeholder="Precio" value={otro.monto} onChange={(e) => setOtro({ ...otro, monto: e.target.value.replace(",", ".") })} />
              <button type="submit" className="boton">Agregar</button>
            </form>
          )}
        </section>
      </div>

      {/* El ticket */}
      <aside className="tarjeta p-5 sm:p-6 lg:sticky lg:top-6">
        <h2 className="titulo text-2xl">🧾 Ticket</h2>
        {lineas.length === 0 ? <p className="texto-tenue mt-4">Tocá lo que se lleva.</p> : (
          <ul className="mt-4 divide-y divide-[var(--borde)]">
            {lineas.map((l) => {
              const p = precioUnitario(l, medioPrecio);
              return (
                <li key={l.clave} className="py-3">
                  <div className="flex items-start gap-2">
                    <span className="flex-1 font-semibold">{l.nombre}</span>
                    <span className="numero text-lg">{p == null ? "—" : formatearPesos(p * l.cantidad - (l.descuento ?? 0))}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button type="button" aria-label="Uno menos" className="boton !min-h-9 !px-3" onClick={() => (l.cantidad > 1 ? cambiar(l.clave, { cantidad: l.cantidad - 1 }) : quitar(l.clave))}>−</button>
                    <span className="numero text-lg w-6 text-center">{l.cantidad}</span>
                    <button type="button" aria-label="Uno más" className="boton !min-h-9 !px-3" onClick={() => cambiar(l.clave, { cantidad: Math.min(l.cantidad + 1, l.tipo === "cuota" ? 12 : 50) })}>+</button>
                    {l.descuento == null
                      ? <button type="button" className="text-sm texto-tenue ml-auto min-h-9" onClick={() => cambiar(l.clave, { descuento: 0 })}>🏷️ Descuento</button>
                      : <button type="button" className="text-sm texto-tenue ml-auto min-h-9" onClick={() => cambiar(l.clave, { descuento: undefined, descuento_motivo: undefined })}>Sin descuento</button>}
                  </div>
                  {l.descuento != null && (
                    <div className="grid grid-cols-[110px_1fr] gap-2 mt-2">
                      <input className="campo !min-h-10" inputMode="decimal" placeholder="$" value={l.descuento || ""}
                        onChange={(e) => cambiar(l.clave, { descuento: Number(e.target.value.replace(",", ".")) || 0 })} aria-label="Monto del descuento" />
                      <input className="campo !min-h-10" placeholder="Motivo (obligatorio)" value={l.descuento_motivo ?? ""}
                        onChange={(e) => cambiar(l.clave, { descuento_motivo: e.target.value })} aria-label="Motivo del descuento" />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {precios.tope_descuento != null && lineas.some((l) => l.descuento != null) && (
          <p className="text-sm texto-tenue mt-2">Tu descuento máximo es {precios.tope_descuento}%.</p>
        )}

        <div className="mt-6">
          <p className="etiqueta mb-2">¿Cómo paga?</p>
          {!mixto ? (
            <div className="grid grid-cols-2 gap-2">
              {MEDIOS.map((m) => (
                <button key={m.medio} type="button" aria-pressed={medio === m.medio} onClick={() => setMedio(m.medio)}
                  className={`boton !min-h-12 text-[15px] ${medio === m.medio ? "!border-[var(--acento)] !bg-[color-mix(in_oklab,var(--acento),var(--fondo)_82%)]" : ""}`}>{m.texto}</button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {partes.map((p, i) => (
                <div key={i} className="grid grid-cols-[1fr_120px] gap-2">
                  <select className="campo !min-h-12" value={p.medio} onChange={(e) => setPartes(partes.map((x, j) => (j === i ? { ...x, medio: e.target.value as Medio } : x)))}>
                    {MEDIOS.map((m) => <option key={m.medio} value={m.medio}>{m.texto}</option>)}
                  </select>
                  <input className="campo !min-h-12" inputMode="decimal" placeholder="$" value={p.monto} onChange={(e) => setPartes(partes.map((x, j) => (j === i ? { ...x, monto: e.target.value.replace(",", ".") } : x)))} />
                </div>
              ))}
              {total != null && sumaMixto !== total && <p className="text-sm pildora pildora-amarillo">Faltan {formatearPesos(total - sumaMixto)}</p>}
            </div>
          )}
          <button type="button" className="text-sm texto-tenue mt-2 min-h-9" onClick={() => setMixto(!mixto)}>{mixto ? "Un solo medio" : "➗ Paga con dos medios"}</button>
          {mixto && <p className="text-sm texto-tenue">Con dos medios rige el precio de lista.</p>}
        </div>

        <div className="flex items-baseline justify-between mt-6 pt-5 border-t border-[var(--borde)]">
          <span className="texto-suave text-lg">Total</span>
          <span className="numero text-5xl">{total == null ? "—" : formatearPesos(total)}</span>
        </div>
        {faltaCaja && <p className="pildora pildora-amarillo mt-4 !rounded-2xl !px-4 !py-3">💵 Para cobrar en efectivo abrí la caja. <Link href="/panel/caja" className="underline">Abrir caja</Link></p>}
        {error && <p role="alert" className="pildora pildora-rojo mt-4 !rounded-2xl !px-4 !py-3 w-full">⚠️ {error}</p>}
        <button type="button" onClick={confirmar} disabled={ocupado || lineas.length === 0 || total == null || faltaCaja || (mixto && sumaMixto !== total)}
          className="boton boton-principal text-lg w-full mt-5">{ocupado ? "Cobrando…" : `✅ Cobrar${total ? ` ${formatearPesos(total)}` : ""}`}</button>
      </aside>
    </div>
  );
}
