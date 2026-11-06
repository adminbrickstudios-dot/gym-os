"use client";
import Link from "next/link";
import { LinkPanel } from "@/components/panel/LinkPanel";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { buscarSociosRapido, type ResultadoSocio } from "@/app/panel/acciones";
import { PildoraEstado, PuntoEstado } from "@/components/panel/Estado";
import { formatearPesos, leerMonto } from "@/lib/formato";
import { cobrar, comprobante, preciosPara, registrarUsoCupon, validarCupon, type Venta } from "./acciones";
import { anularVenta, pedirAnulacion } from "../ventas-acciones";
import { linkWhatsappSocio } from "@/lib/whatsapp";
import { aplicarCupon, descuentoConvenio, lineaRecargo, precioUnitario, totalCarrito, type Linea, type Medio, type PreciosVenta } from "./tipos";
import { Tilde } from "@/components/ui/Tilde";

const MEDIOS: { medio: Medio; texto: string }[] = [
  { medio: "efectivo", texto: "💵 Efectivo" },
  { medio: "transferencia", texto: "🏦 Transferencia" },
  { medio: "debito", texto: "💳 Débito" },
  { medio: "credito", texto: "💳 Crédito" },
];

type Socio = { socio_id: string; nombre: string; color: string; texto: string };

export function Carrito({ sedeId, turnoId, socioInicial, preciosIniciales, conCuota = false, desdeEntrada = false, puedeAnular = false, stockInicial = {}, sinProductos = false }: {
  sedeId: string; turnoId: string | null; socioInicial: Socio | null; preciosIniciales: PreciosVenta; conCuota?: boolean; desdeEntrada?: boolean;
  /** Dueño y encargado anulan; la recepción pide (VEN-6). */
  puedeAnular?: boolean;
  /** EQU-1: la recepción no vende productos si el dueño lo apagó. */
  sinProductos?: boolean;
  stockInicial?: Record<string, { stock: number; minimo: number | null }>;
}) {
  const [socio, setSocio] = useState<Socio | null>(socioInicial);
  const [precios, setPrecios] = useState(preciosIniciales);
  const [stock, setStock] = useState(stockInicial);
  // COM-9: el cupón aplicado (se anota como uso al cobrar) y lo que dijo al aplicarlo.
  const [cupon, setCupon] = useState<string | null>(null);
  const [codigoCupon, setCodigoCupon] = useState("");
  const [msjCupon, setMsjCupon] = useState<{ ok?: string; error?: string }>({});
  const [usoCupon, setUsoCupon] = useState<string | null>(null);
  // DIS-4: la barra del celular se esconde cuando el carrito ya está a la vista.
  const [carritoVisible, setCarritoVisible] = useState(false);
  useEffect(() => {
    const el = document.getElementById("carrito");
    if (!el || typeof IntersectionObserver === "undefined") return;
    const o = new IntersectionObserver(([e]) => setCarritoVisible(e.isIntersecting), { threshold: 0.15 });
    o.observe(el);
    return () => o.disconnect();
  }, []);
  // Recién dado de alta con plan (SOC-13): arranca con la primera cuota en el carrito.
  // Si debe la matrícula de su plan (PLA-3), va también.
  const [lineas, setLineas] = useState<Linea[]>(() => conCuota && preciosIniciales.cuota
    ? [{ clave: "cuota-inicial", tipo: "cuota", nombre: `Cuota ${preciosIniciales.cuota.plan}`, precios: preciosIniciales.cuota.precios, cantidad: 1 },
       ...(preciosIniciales.matricula ? [{ clave: "matricula-inicial", tipo: "matricula" as const, nombre: `Matrícula ${preciosIniciales.matricula.plan}`,
         precio_fijo: Number(preciosIniciales.matricula.monto), cantidad: 1 }] : []),
       ...(preciosIniciales.recargo ? [lineaRecargo(preciosIniciales.recargo)] : [])] : []);
  // Solo los medios que acepta el gimnasio (lo decide la base: sin Caja, tampoco efectivo).
  // VEN-5: "A cuenta" aparece si el gimnasio fía y hay socio elegido.
  const medios = [...MEDIOS.filter((m) => preciosIniciales.medios.includes(m.medio)),
    ...(precios.fiado ? [{ medio: "cuenta_corriente" as Medio, texto: "📒 A cuenta" }] : [])];
  // Sin caja abierta no arranca en efectivo (no se podría cobrar, y mostraría su precio).
  const [medio, setMedio] = useState<Medio | null>((turnoId ? medios[0] : medios.find((m) => m.medio !== "efectivo") ?? medios[0])?.medio ?? null);
  const [mixto, setMixto] = useState(false);
  const [partes, setPartes] = useState<{ medio: Medio; monto: string }[]>(
    medios.slice(0, 2).map((m) => ({ medio: m.medio, monto: "" })));
  const [buscando, setBuscando] = useState(!socioInicial);
  const [texto, setTexto] = useState("");
  const [encontrados, setEncontrados] = useState<ResultadoSocio[]>([]);
  const [otro, setOtro] = useState<{ descripcion: string; monto: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [venta, setVenta] = useState<Venta | null>(null);
  const claveOperacion = useRef<string | null>(null);
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

  // El recargo por pagar tarde acompaña a la cuota: entra y sale con ella (PLA-7).
  const conRecargo = (ls: Linea[]) => {
    const hayCuota = ls.some((l) => l.tipo === "cuota");
    const sin = ls.filter((l) => l.tipo !== "recargo");
    if (!hayCuota || !precios.recargo) return sin;
    return ls.some((l) => l.tipo === "recargo") ? ls : [...ls, lineaRecargo(precios.recargo)];
  };
  const agregar = (l: Omit<Linea, "clave" | "cantidad">) => setLineas((ls) => {
    const igual = ls.find((x) => x.tipo === l.tipo && x.plan_id === l.plan_id && x.producto_id === l.producto_id && l.tipo !== "otro");
    if (igual) return ls.map((x) => (x === igual ? { ...x, cantidad: Math.min(x.cantidad + 1, x.tipo === "cuota" ? 12 : 50) } : x));
    return conRecargo([...ls, { ...l, clave: crypto.randomUUID(), cantidad: 1 }]);
  });
  const cambiar = (clave: string, cambio: Partial<Linea>) => setLineas((ls) => ls.map((l) => (l.clave === clave ? { ...l, ...cambio } : l)));
  const quitar = (clave: string) => setLineas((ls) => conRecargo(ls.filter((l) => l.clave !== clave)));

  const medioOk = medio && medios.some((m) => m.medio === medio) ? medio : (medios[0]?.medio ?? null);
  const medioPrecio = mixto ? null : medioOk;
  const sinMedios = medios.length === 0;
  const total = useMemo(() => totalCarrito(lineas, medioPrecio, precios.convenio), [lineas, medioPrecio, precios.convenio]);
  // Montos escritos a mano: "1.500" es mil quinientos, no 1,5 (AUD-6).
  const monto = (x: string) => { const n = leerMonto(x); return Number.isNaN(n) ? 0 : n; };
  const sumaMixto = partes.reduce((s, p) => s + monto(p.monto), 0);
  const usaEfectivo = mixto ? partes.some((p) => p.medio === "efectivo" && monto(p.monto) > 0) : medio === "efectivo";
  const faltaCaja = usaEfectivo && !turnoId && (total ?? 0) > 0;

  const confirmar = () => empezar(async () => {
    setError(null);
    if (total == null) { setError("Hay algo en el carrito sin precio cargado"); return; }
    const pagos = total === 0 ? [] : mixto
      ? partes.filter((p) => monto(p.monto) > 0).map((p) => ({ medio: p.medio, monto: monto(p.monto) }))
      : medioOk ? [{ medio: medioOk, monto: total }] : [];
    const items = lineas.map((l) => ({
      tipo: l.tipo, cantidad: l.cantidad, plan_id: l.plan_id, producto_id: l.producto_id,
      descripcion: l.tipo === "otro" ? l.nombre : undefined, precio_unitario: l.tipo === "otro" || l.tipo === "deuda" ? l.precio_fijo : undefined,
      descuento: l.descuento || undefined, descuento_motivo: l.descuento_motivo || undefined,
    }));
    // VD-34: la misma operación lleva la misma clave hasta que se cobra; un reintento no cobra dos veces.
    claveOperacion.current ??= crypto.randomUUID();
    const r = await cobrar({ sedeId, socioId: socio?.socio_id ?? null, turnoId, items, pagos, claveOperacion: claveOperacion.current });
    if (r.error) setError(r.error);
    else {
      // Lo vendido sale del stock que se muestra (la base lo calcula igual).
      setStock((st) => Object.fromEntries(Object.entries(st).map(([id, x]) => [id, { ...x, stock: x.stock - lineas.filter((l) => l.producto_id === id).reduce((n, l) => n + l.cantidad, 0) }])));
      claveOperacion.current = null;
      setVenta(r.venta!); setLineas([]);
      if (cupon && lineas.some((l) => l.descuento_motivo === `Cupón ${cupon}`)) {
        const u = await registrarUsoCupon(r.venta!.venta_id, cupon);
        setUsoCupon(u.error ? `⚠️ El cobro quedó, pero no se anotó el uso del cupón: ${u.error}` : `🏷️ Cupón ${cupon} anotado`);
      } else setUsoCupon(null);
      setCupon(null); setCodigoCupon(""); setMsjCupon({});
    }
  });
  const aplicar = () => empezar(async () => {
    const r = await validarCupon(codigoCupon);
    if (r.error || !r.cupon) { setMsjCupon({ error: r.error ?? "No se pudo validar el cupón" }); return; }
    const a = aplicarCupon(lineas, r.cupon, medioPrecio, precios.cuota?.plan_id ?? null);
    if (!a.aplicadas) { setMsjCupon({ error: `El cupón ${r.cupon.codigo} no aplica a nada del carrito (${r.cupon.planes.length ? "es de otros planes" : "va con cuotas, pases o packs"}).` }); return; }
    setLineas(a.lineas); setCupon(r.cupon.codigo);
    setMsjCupon({ ok: `Cupón ${r.cupon.codigo}: ${r.cupon.tipo === "porcentaje" ? `${Number(r.cupon.valor)}% en ${a.aplicadas === 1 ? "1 línea" : `${a.aplicadas} líneas`}` : formatearPesos(r.cupon.valor)}. Si cambiás el medio de pago, volvé a aplicarlo.` });
  });

  if (venta) {
    return (
      <section className="tarjeta p-6 sm:p-10 max-w-xl" aria-live="polite">
        <p className="text-5xl flex justify-center" aria-hidden><Tilde tamano={64} /></p>
        <p className="titular text-5xl mt-4">Cobrado {formatearPesos(venta.total)}</p>
        {socio && venta.veredicto && <div className="mt-5"><PildoraEstado color={venta.veredicto.color}>{socio.nombre}: {venta.veredicto.texto}</PildoraEstado></div>}
        {usoCupon && <p className="mt-3 texto-suave" data-uso-cupon>{usoCupon}</p>}
        {socio && <MandarComprobante ventaId={venta.venta_id} />}
        <DeshacerVenta ventaId={venta.venta_id} puedeAnular={puedeAnular} socioId={socio?.socio_id ?? null} />
        <div className="flex flex-wrap gap-2 mt-8">
          {/* Vino de la Entrada (ENT-9): vuelve con el socio y su veredicto nuevo, para anotarlo. */}
          {desdeEntrada && socio && <LinkPanel href={`/panel/entrada?socio=${socio.socio_id}`} className="boton boton-principal">🚪 Volver a la entrada con {socio.nombre.split(" ")[0]}</LinkPanel>}
          <button type="button" className={`boton ${desdeEntrada && socio ? "" : "boton-principal"}`} onClick={() => { setVenta(null); setSocio(null); setBuscando(true); }}>🛒 Nueva venta</button>
          {socio && <LinkPanel href={`/panel/socios/${socio.socio_id}`} className="boton">👤 Ver ficha</LinkPanel>}
          {!(desdeEntrada && socio) && <LinkPanel href="/panel/entrada" className="boton">🚪 Ir a la entrada</LinkPanel>}
        </div>
      </section>
    );
  }

  const Boton = ({ onClick, emoji, titulo, precio, deshabilitado, nota }: { onClick: () => void; emoji: string; titulo: string; precio: number | null; deshabilitado?: string; nota?: { texto: string; alerta: boolean } }) => (
    <button type="button" onClick={onClick} disabled={!!deshabilitado || precio == null} title={deshabilitado}
      className="boton !flex-col !items-start !justify-between !p-4 min-h-[104px] text-left">
      <span className="flex items-center gap-2"><span aria-hidden className="text-xl">{emoji}</span><span>{titulo}</span></span>
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span className="numero text-xl texto-suave">{precio == null ? "Sin precio" : formatearPesos(precio)}</span>
        {nota && <span className={`text-sm ${nota.alerta ? "text-[var(--rojo)]" : "texto-tenue"}`} data-quedan>{nota.texto}</span>}
      </span>
    </button>
  );
  // VEN-4: cuántos quedan (avisa; no frena la venta). Lo del carrito ya se descuenta.
  const notaStock = (id: string) => {
    const s = stock[id];
    if (!s) return undefined;
    const quedan = s.stock - lineas.filter((l) => l.producto_id === id).reduce((n, l) => n + l.cantidad, 0);
    return { texto: quedan <= 0 ? "Sin stock" : `Quedan ${quedan}`, alerta: quedan <= 0 || (s.minimo != null && quedan <= s.minimo) };
  };

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
              <input autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} className="campo !min-h-14 !text-lg" placeholder="🔍 Buscar socio (sin socio: solo productos)" aria-label="Buscar socio" />
              {encontrados.map((s) => (
                <button key={s.socio_id} type="button" onClick={() => elegirSocio(s)} className="fila gap-3">
                  <PuntoEstado color={s.color} />
                  <span className="font-semibold flex-1 truncate">{s.nombre}</span>
                  <span className="texto-tenue text-sm truncate">{s.texto}</span>
                </button>
              ))}
              {socio && <button type="button" className="boton" onClick={() => setBuscando(false)}>Seguir con {socio.nombre}</button>}
              {!socio && texto.trim().length >= 2 && encontrados.length === 0 && (
                <p className="texto-suave">No está.<LinkPanel href="/panel/socios/nuevo" className="underline"> Darlo de alta y volver.</LinkPanel></p>
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
            {precios.deuda != null && Number(precios.deuda) > 0 && !lineas.some((l) => l.tipo === "deuda") && (
              <Boton emoji="📒" titulo="Pagar lo que debe a cuenta" precio={Number(precios.deuda)}
                onClick={() => agregar({ tipo: "deuda", nombre: "Pago de deuda a cuenta", precio_fijo: Number(precios.deuda) })} />
            )}
            {precios.matricula && !lineas.some((l) => l.tipo === "matricula") && (
              <Boton emoji="📝" titulo={`Matrícula ${precios.matricula.plan}`} precio={Number(precios.matricula.monto)}
                onClick={() => agregar({ tipo: "matricula", nombre: `Matrícula ${precios.matricula!.plan}`, precio_fijo: Number(precios.matricula!.monto) })} />
            )}
            {precios.pases.map((p) => (
              <Boton key={p.plan_id} emoji="🎫" titulo={p.nombre} precio={precioUnitario({ clave: "", tipo: "pase", nombre: "", cantidad: 1, precios: p.precios }, medioPrecio)}
                deshabilitado={socio ? undefined : "Elegí un socio primero"} onClick={() => agregar({ tipo: "pase", nombre: p.nombre, plan_id: p.plan_id, precios: p.precios })} />
            ))}
            {precios.packs.map((p) => (
              <Boton key={p.plan_id} emoji="🎟️" titulo={p.nombre} precio={precioUnitario({ clave: "", tipo: "pack", nombre: "", cantidad: 1, precios: p.precios }, medioPrecio)}
                deshabilitado={socio ? undefined : "Elegí un socio primero"} onClick={() => agregar({ tipo: "pack", nombre: p.nombre, plan_id: p.plan_id, precios: p.precios })} />
            ))}
            {!sinProductos && precios.productos.map((p) => (
              <Boton key={p.producto_id} emoji="🥤" titulo={p.nombre} precio={p.precio} nota={notaStock(p.producto_id)}
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
              if (!otro.descripcion.trim() || !(leerMonto(otro.monto) >= 0)) { setError("No entiendo el precio: escribilo como 84.500 o 84500,50"); return; }
              agregar({ tipo: "otro", nombre: otro.descripcion.trim(), precio_fijo: leerMonto(otro.monto) }); setOtro(null);
            }}>
              <input autoFocus className="campo" placeholder="Qué es (ej: candado)" value={otro.descripcion} onChange={(e) => setOtro({ ...otro, descripcion: e.target.value })} />
              <input className="campo sm:max-w-40" inputMode="decimal" placeholder="Precio" value={otro.monto} onChange={(e) => setOtro({ ...otro, monto: e.target.value })} />
              <button type="submit" className="boton">Agregar</button>
            </form>
          )}
        </section>
      </div>

      {/* El ticket */}
      {/* DIS-4: en el celular el carrito queda abajo de todo: una barra con el total lleva hasta él. */}
      {lineas.length > 0 && !carritoVisible && (
        <a href="#carrito" data-barra-carrito
          className="lg:hidden fixed inset-x-3 z-20 bottom-[calc(76px+env(safe-area-inset-bottom))] boton !justify-between !border-[var(--acento)] shadow-lg">
          <span>🛒 {lineas.reduce((n, l) => n + l.cantidad, 0)} · {total == null ? "—" : formatearPesos(total)}</span>
          <span>Cobrar ↓</span>
        </a>
      )}
      <aside id="carrito" data-carrito className="tarjeta p-5 sm:p-6 lg:sticky lg:top-6 scroll-mt-4">
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
                  {descuentoConvenio(l, medioPrecio, precios.convenio) > 0 && (
                    <div className="flex items-start gap-2 mt-1 texto-suave" data-convenio>
                      <span className="flex-1">🤝 Convenio {precios.convenio!.nombre}</span>
                      <span className="numero">−{formatearPesos(descuentoConvenio(l, medioPrecio, precios.convenio))}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <button type="button" aria-label="Uno menos" className="boton !min-h-9 !px-3" disabled={l.tipo === "recargo"} title={l.tipo === "recargo" ? "Va con la cuota: si no lo cobrás, ponele un descuento" : undefined} onClick={() => (l.cantidad > 1 ? cambiar(l.clave, { cantidad: l.cantidad - 1 }) : quitar(l.clave))}>−</button>
                    <span className="numero text-lg w-6 text-center">{l.cantidad}</span>
                    <button type="button" aria-label="Uno más" className="boton !min-h-9 !px-3" disabled={l.tipo === "matricula" || l.tipo === "recargo" || l.tipo === "deuda"} onClick={() => cambiar(l.clave, { cantidad: Math.min(l.cantidad + 1, l.tipo === "cuota" ? 12 : 50) })}>+</button>
                    {l.descuento == null
                      ? <button type="button" className="boton-texto ml-auto" onClick={() => cambiar(l.clave, { descuento: 0 })}>🏷️ Descuento</button>
                      : <button type="button" className="boton-texto ml-auto" onClick={() => cambiar(l.clave, { descuento: undefined, descuento_texto: undefined, descuento_motivo: undefined })}>Sin descuento</button>}
                  </div>
                  {l.descuento != null && (
                    <div className="grid grid-cols-[110px_1fr] gap-2 mt-2">
                      <input className="campo" inputMode="decimal" placeholder="$" value={l.descuento_texto ?? (l.descuento || "")}
                        onChange={(e) => cambiar(l.clave, { descuento_texto: e.target.value, descuento: monto(e.target.value) })} aria-label="Monto del descuento" />
                      <input className="campo" placeholder="Motivo (obligatorio)" value={l.descuento_motivo ?? ""}
                        onChange={(e) => cambiar(l.clave, { descuento_motivo: e.target.value })} aria-label="Motivo del descuento" />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {lineas.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2" data-cupon>
            <input className="campo !w-40 uppercase" value={codigoCupon} onChange={(e) => setCodigoCupon(e.target.value.replace(/\s/g, ""))} placeholder="Cupón" aria-label="Código de cupón" maxLength={20} />
            <button type="button" className="boton" disabled={ocupado || codigoCupon.length < 3} onClick={aplicar}>🏷️ Aplicar</button>
            {msjCupon.ok && <span className="text-sm" style={{ color: "var(--acento)" }}>✓ {msjCupon.ok}</span>}
            {msjCupon.error && <span role="alert" className="text-sm pildora pildora-rojo whitespace-normal">⚠️ {msjCupon.error}</span>}
          </div>
        )}
        {precios.tope_descuento != null && lineas.some((l) => l.descuento != null) && (
          <p className="text-sm texto-tenue mt-2">Tu descuento máximo es {precios.tope_descuento}%.</p>
        )}

        <div className="mt-6">
          <p className="etiqueta mb-2">¿Cómo paga?</p>
          {!mixto ? (
            <div className="grid grid-cols-2 gap-2">
              {medios.map((m) => (
                <button key={m.medio} type="button" aria-pressed={medioOk === m.medio} onClick={() => setMedio(m.medio)}
                  className={`boton !min-h-12 text-[15px] ${medioOk === m.medio ? "!border-[var(--acento)] !bg-[color-mix(in_oklab,var(--acento),var(--fondo)_82%)]" : ""}`}>{m.texto}</button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {partes.map((p, i) => (
                <div key={i} className="grid grid-cols-[1fr_120px] gap-2">
                  <select className="campo !min-h-12" value={p.medio} onChange={(e) => setPartes(partes.map((x, j) => (j === i ? { ...x, medio: e.target.value as Medio } : x)))}>
                    {medios.map((m) => <option key={m.medio} value={m.medio}>{m.texto}</option>)}
                  </select>
                  <input className="campo !min-h-12" inputMode="decimal" placeholder="$" value={p.monto} onChange={(e) => setPartes(partes.map((x, j) => (j === i ? { ...x, monto: e.target.value } : x)))} />
                </div>
              ))}
              {total != null && sumaMixto !== total && <p className="text-sm pildora pildora-amarillo">Faltan {formatearPesos(total - sumaMixto)}</p>}
            </div>
          )}
          {medios.length >= 2 && <button type="button" className="boton-texto mt-2" onClick={() => setMixto(!mixto)}>{mixto ? "Un solo medio" : "➗ Paga con dos medios"}</button>}
          {sinMedios && <p className="pildora pildora-amarillo !rounded-2xl !px-4 !py-3">No hay medios de pago prendidos para cobrar acá. El dueño los elige en Configuración → Cobros.</p>}
          {mixto && <p className="text-sm texto-tenue">Con dos medios rige el precio de lista.</p>}
          {precios.fiado && (medioOk === "cuenta_corriente" || mixto) && (
            <p className="text-sm texto-suave mt-2" data-fiado>📒 Se le puede fiar hasta {formatearPesos(precios.fiado.disponible)} más (tope {formatearPesos(precios.fiado.tope)}).</p>
          )}
        </div>

        <div className="flex items-baseline justify-between mt-6 pt-5 border-t border-[var(--borde)]">
          <span className="texto-suave text-lg">Total</span>
          <span className="numero text-5xl">{total == null ? "—" : formatearPesos(total)}</span>
        </div>
        {faltaCaja && <p className="pildora pildora-amarillo mt-4 !rounded-2xl !px-4 !py-3">💵 Para cobrar en efectivo abrí la caja. <Link href="/panel/caja" className="underline">Abrir caja</Link></p>}
        {error && <p role="alert" className="pildora pildora-rojo mt-4 !rounded-2xl !px-4 !py-3 w-full">⚠️ {error}</p>}
        <button type="button" onClick={confirmar} disabled={ocupado || sinMedios || lineas.length === 0 || total == null || faltaCaja || (mixto && sumaMixto !== total)}
          className="boton boton-principal text-lg w-full mt-5">{ocupado ? "Cobrando…" : `✅ Cobrar${total ? ` ${formatearPesos(total)}` : ""}`}</button>
      </aside>
    </div>
  );
}

/** Se cobró mal: el dueño o el encargado la anulan acá; la recepción pide que la anulen (VEN-6). */
function DeshacerVenta({ ventaId, puedeAnular, socioId }: { ventaId: string; puedeAnular: boolean; socioId: string | null }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [hecho, setHecho] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  if (hecho) return <p role="status" className="mt-5 texto-suave" data-deshacer-hecho>{hecho}</p>;
  if (!abierto) return <button type="button" className="boton-texto mt-5" onClick={() => setAbierto(true)}>↩️ {puedeAnular ? "Anular esta venta" : "Me equivoqué: pedir que la anulen"}</button>;
  return (
    <form className="mt-5 flex flex-col sm:flex-row gap-2" onSubmit={(e) => {
      e.preventDefault();
      empezar(async () => {
        const r = puedeAnular ? await anularVenta(ventaId, motivo, socioId) : await pedirAnulacion(ventaId, motivo);
        if (r.error) setError(r.error); else setHecho(puedeAnular ? "↩️ Venta anulada: se revirtió lo que habilitó." : "↩️ Pedido enviado: el dueño o el encargado lo ven en Inicio.");
      });
    }}>
      <input autoFocus className="campo" placeholder="Por qué (obligatorio)" aria-label="Motivo de la anulación" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      <button type="submit" className="boton boton-peligro" disabled={!motivo.trim() || ocupado}>{puedeAnular ? "Anular" : "Pedir"}</button>
      {error && <p role="alert" className="pildora pildora-rojo">⚠️ {error}</p>}
    </form>
  );
}

/** VEN-1: el comprobante por WhatsApp, ya escrito (Configuración → Mensajes). Se arma apenas se cobra, así el toque abre WhatsApp directo. */
function MandarComprobante({ ventaId }: { ventaId: string }) {
  const [c, setC] = useState<{ link: string | null; mensaje: string; error?: string } | null>(null);
  useEffect(() => {
    let vivo = true;
    comprobante(ventaId).then((r) => { if (vivo) setC({ link: r.error ? null : linkWhatsappSocio(r.telefono, r.mensaje), mensaje: r.mensaje ?? "", error: r.error }); });
    return () => { vivo = false; };
  }, [ventaId]);
  if (!c) return null;
  if (c.error) return <p role="alert" className="pildora pildora-rojo mt-5">⚠️ {c.error}</p>;
  return c.link
    ? <a href={c.link} target="_blank" rel="noopener noreferrer" className="boton mt-5" data-comprobante>🧾 Mandar comprobante por WhatsApp</a>
    : <p className="mt-5 texto-suave" data-comprobante>Sin celular cargado para mandarle el comprobante.</p>;
}
