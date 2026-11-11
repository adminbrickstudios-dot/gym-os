"use client";
// VD-5 · Cobrar: un solo flujo en todos lados (docs/v2/02 §2). La hoja flotante que se abre desde la
// Entrada (C), la ficha, Vencen hoy, Retención y Ctrl+K. Reusa lo de Vender: las mismas acciones
// (cobrar, preciosPara, validarCupon, registrarUsoCupon) y las mismas cuentas de tipos.ts. El total que se
// ve es el de siempre (totalCarrito, la misma cuenta que vender() en la base); la base lo vuelve a calcular
// y exige que lo cobrado sea igual.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { PildoraEstado, PuntoEstado } from "@/components/panel/Estado";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { Hoja } from "@/components/ui/Hoja";
import { Mensaje } from "@/components/ui/Mensaje";
import { Tilde } from "@/components/ui/Tilde";
import { MotivoDescuento } from "@/components/panel/cobrar/MotivoDescuento";
import { AbrirTurnoCobrar } from "@/components/panel/cobrar/AbrirTurnoCobrar";
import { AvisoDobleCobro, motivoDobleValido, textoDobleCobro, type EstadoDobleCobro } from "@/components/panel/cobrar/AvisoDobleCobro";
import { formatearPesos, leerMonto } from "@/lib/formato";
import { cajaParaCobrar, cobrar, datosCobro, guardarMedioDefecto, registrarUsoCupon, subirComprobanteCobro, validarCupon, type CajaCobro, type DatosCobro, type Venta } from "@/app/panel/vender/acciones";
import { DeshacerVenta, MandarComprobante, MEDIOS } from "@/app/panel/vender/compartido";
import { aplicarCupon, armarItems, conRecargoLineas, descuentoConvenio, lineasIniciales, precioUnitario, totalCarrito, type Linea, type Medio } from "@/app/panel/vender/tipos";
import type { OrigenCobro } from "./evento";
import { Icono } from "@/components/ui/Icono";

const VUELTA: Record<OrigenCobro, string> = { entrada: "Volver a la entrada", ficha: "Volver a la ficha", vencen: "Volver a Vencen hoy", retencion: "Volver a Retención", buscador: "Listo", tarea: "Volver a Para hacer hoy", otro: "Listo" };

/** Un día "20/11" en la zona del gimnasio; `menos` resta milisegundos (el fin de un período es la medianoche siguiente). */
const diaCorto = (iso: string, zona: string, menos = 0) =>
  new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "2-digit", month: "2-digit" }).format(new Date(new Date(iso).getTime() - menos));

/** "2026-11-05T14:30" para un input datetime-local, en la hora de esta compu. */
const paraInput = (d: Date) => {
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
};

export function Cobrar({ sedeId, socioId, origen, alCerrar, alCobrado }: {
  sedeId: string; socioId: string; origen: OrigenCobro; alCerrar: () => void; alCobrado: (v: Venta) => void;
}) {
  const [d, setD] = useState<DatosCobro | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  // Mientras "Cobrando…" no se cierra la hoja (Esc, la X o tocar afuera): se perdería el resultado de una venta que ya salió.
  const cobrando = useRef(false);
  const cerrar = () => { if (!cobrando.current) alCerrar(); };

  useEffect(() => {
    let vivo = true;
    datosCobro(sedeId, socioId).then((r) => {
      if (!vivo) return;
      if (r.error || !r.datos) setError(r.error ?? "No se pudo abrir el cobro"); else { setD(r.datos); setError(null); }
    });
    return () => { vivo = false; };
  }, [sedeId, socioId, intento]);

  return (
    <Hoja abierta alCerrar={cerrar} etiqueta="Cobrar" className="!max-w-xl">
      <div data-cobrar data-origen={origen} data-estado={error ? "error" : d ? "listo" : "cargando"} className="max-h-[92dvh] overflow-y-auto">
        {error ? (
          <div className="p-6 sm:p-8 space-y-4">
            <p className="titulo text-2xl"><Icono nombre="plata" /> Cobrar</p>
            <Mensaje tipo="error">{error}</Mensaje>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="boton boton-principal" onClick={() => { setError(null); setD(null); setIntento((n) => n + 1); }}>Reintentar</button>
              <Link href={`/panel/vender?socio=${socioId}`} className="boton"><Icono nombre="carrito" /> Abrir Vender</Link>
              <button type="button" className="boton-texto" onClick={alCerrar}>Cerrar</button>
            </div>
          </div>
        ) : !d ? (
          <div className="p-6 sm:p-8 space-y-5" aria-busy="true" aria-label="Cargando el cobro">
            <div className="h-14 rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto" />
            <div className="h-24 rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto" />
            <div className="grid grid-cols-2 gap-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-12 rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto" />)}</div>
            <div className="h-14 rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto" />
          </div>
        ) : (
          <Cuerpo d={d} origen={origen} alCerrar={cerrar} alCobrado={alCobrado} cobrando={cobrando} />
        )}
      </div>
    </Hoja>
  );
}

function Cuerpo({ d, origen, alCerrar, alCobrado, cobrando }: { d: DatosCobro; origen: OrigenCobro; alCerrar: () => void; alCobrado: (v: Venta) => void; cobrando: { current: boolean } }) {
  const { precios, ctx, socio } = d;
  // Solo los medios que acepta el gimnasio (lo decide la base); "A cuenta" si el gimnasio fía.
  const medios = [...MEDIOS.filter((m) => precios.medios.includes(m.medio)), ...(precios.fiado ? [{ medio: "cuenta_corriente" as Medio, texto: "A cuenta" }] : [])];

  const [lineas, setLineas] = useState<Linea[]>(() => lineasIniciales(precios));
  const [otroDia, setOtroDia] = useState<{ fecha: string; motivo: string } | null>(null);
  // VD-49 (D32): mi turno de caja en esta sede. Se abre en la misma hoja (sin perder lo cargado) y el efectivo cae ahí.
  const [caja, setCaja] = useState<CajaCobro>(d.caja);
  const turnoId = caja.turno_id;
  // El de siempre del gimnasio; sin turno abierto no arranca en efectivo (elegirlo ofrece abrir el turno acá mismo).
  const [medio, setMedio] = useState<Medio | null>(() => {
    const opciones = [ctx.medio_defecto, ...medios.map((m) => m.medio)].filter((m) => medios.some((x) => x.medio === m));
    return opciones.find((m) => m !== "efectivo" || d.caja.turno_id) ?? opciones[0] ?? null;
  });
  const [defecto, setDefecto] = useState<Medio>(ctx.medio_defecto);
  // VD-50 (D29): la cuota ya cobrada hace poco frena y pide un motivo. Viene de contexto_cobro al abrir, o del error de la base al cobrar.
  const [doble, setDoble] = useState<EstadoDobleCobro | null>(() => (ctx.reciente ? { texto: textoDobleCobro(ctx.reciente, formatearPesos), abierto: false, motivo: "" } : null));
  const [mixto, setMixto] = useState(false);
  const [partes, setPartes] = useState<{ medio: Medio; monto: string }[]>(medios.slice(0, 2).map((m) => ({ medio: m.medio, monto: "" })));
  const [cupon, setCupon] = useState<string | null>(null);
  const [codigoCupon, setCodigoCupon] = useState("");
  const [msjCupon, setMsjCupon] = useState<{ ok?: string; error?: string }>({});
  const [agregando, setAgregando] = useState(false);
  const [otro, setOtro] = useState<{ descripcion: string; monto: string } | null>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [venta, setVenta] = useState<Venta | null>(null);
  const [usoCupon, setUsoCupon] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const clave = useRef<string | null>(null);
  const rutaComprobante = useRef<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  // Abre con el botón de cobrar a mano: Enter cobra (C → Enter desde la Entrada).
  useEffect(() => { document.querySelector<HTMLElement>("[data-cobrar-confirmar], [data-cobrar-volver]")?.focus(); }, [venta]);

  const permitido = (m: Medio) => !(otroDia && (m === "efectivo" || m === "cuenta_corriente"));
  const medioOk = medio && medios.some((m) => m.medio === medio) && permitido(medio) ? medio : (medios.find((m) => permitido(m.medio))?.medio ?? null);
  const medioPrecio = mixto ? null : medioOk;
  const total = useMemo(() => totalCarrito(lineas, medioPrecio, precios.convenio), [lineas, medioPrecio, precios.convenio]);
  // Montos escritos a mano: "1.500" es mil quinientos, no 1,5 (AUD-6).
  const monto = (x: string) => { const n = leerMonto(x); return Number.isNaN(n) ? 0 : n; };
  const sumaMixto = partes.reduce((s, p) => s + monto(p.monto), 0);
  const usaEfectivo = mixto ? partes.some((p) => p.medio === "efectivo" && monto(p.monto) > 0) : medioOk === "efectivo";
  const faltaCaja = usaEfectivo && !turnoId && !otroDia && (total ?? 0) > 0;
  const sinMedios = medios.length === 0;
  const hayCuota = lineas.some((l) => l.tipo === "cuota");
  const parcial = precios.cuota?.parcial ?? null;   // VD-7: la primera cuota con día fijo, con el cálculo a la vista
  const cuotas = lineas.filter((l) => l.tipo === "cuota").reduce((n, l) => n + l.cantidad, 0);
  const frenaDoble = hayCuota && !!doble;            // el aviso solo vale mientras haya una cuota en el cobro
  const faltaMotivoDoble = frenaDoble && !motivoDobleValido(doble);
  const faltaOtroDia = !!otroDia && (!otroDia.fecha || otroDia.motivo.trim().length < 3);

  const conRecargo = (ls: Linea[]) => conRecargoLineas(ls, precios.recargo, precios.servicios);
  const agregar = (l: Omit<Linea, "clave" | "cantidad">) => setLineas((ls) => {
    const igual = ls.find((x) => x.tipo === l.tipo && x.plan_id === l.plan_id && x.producto_id === l.producto_id && l.tipo !== "otro");
    if (igual) return ls.map((x) => (x === igual ? { ...x, cantidad: Math.min(x.cantidad + 1, x.tipo === "cuota" ? (parcial ? 1 : 12) : 50) } : x));
    return conRecargo([...ls, { ...l, clave: crypto.randomUUID(), cantidad: 1 }]);
  });
  const cambiar = (c: string, cambio: Partial<Linea>) => setLineas((ls) => conRecargo(ls.map((l) => (l.clave === c ? { ...l, ...cambio } : l))));
  const quitar = (c: string) => setLineas((ls) => conRecargo(ls.filter((l) => l.clave !== c)));

  const confirmar = async () => {
    cobrando.current = true;
    try { await cobrarYa(); } finally { cobrando.current = false; }
  };
  const cobrarYa = async () => {
    setError(null);
    if (total == null) { setError("Hay algo en el cobro sin precio cargado"); return; }
    const pagos = total === 0 ? [] : mixto
      ? partes.filter((p) => monto(p.monto) > 0).map((p) => ({ medio: p.medio, monto: monto(p.monto) }))
      : medioOk ? [{ medio: medioOk, monto: total }] : [];
    // La foto del comprobante (solo con un pago por transferencia); si no sube, no se cobra a ciegas.
    let comprobantePath: string | undefined;
    if (archivo && !mixto && medioOk === "transferencia") {
      if (!rutaComprobante.current) {
        const fd = new FormData(); fd.set("archivo", archivo);
        const s = await subirComprobanteCobro(socio.socio_id, fd);
        if (s.error || !s.path) { setError(s.error ?? "No se pudo subir el comprobante"); return; }
        rutaComprobante.current = s.path;
      }
      comprobantePath = rutaComprobante.current;
    }
    // VD-34: la misma operación lleva la misma clave hasta que se cobra; un reintento no cobra dos veces.
    clave.current ??= crypto.randomUUID();
    const r = await cobrar({
      sedeId: d.sedeId, socioId: socio.socio_id, turnoId: otroDia ? null : turnoId, items: armarItems(lineas), pagos, claveOperacion: clave.current, comprobantePath,
      ...(frenaDoble && doble ? { confirmarDoble: true, motivoDoble: doble.motivo.trim() } : {}),
      ...(otroDia ? { cobradoEn: new Date(otroDia.fecha).toISOString(), motivoOtroDia: otroDia.motivo.trim() } : {}),
    });
    if (r.codigo === "ya_cobrada") {
      // La base frenó: alguien cobró esta cuota hace un momento. Se muestra quién y hace cuánto; sigue solo con motivo.
      setDoble({ texto: r.error ?? "Esta cuota ya se cobró hace un momento.", abierto: false, motivo: "" });
      return;
    }
    if (r.error || !r.venta) {
      setError(r.error ?? "No se pudo cobrar");
      // La base dijo que la caja no sirve (se cerró, venció o es de otra persona): se vuelve a leer y se ofrece abrir el turno. Lo cargado queda.
      if (r.codigo === "sin_caja" || r.codigo === "caja_ajena" || /sin contar: nadie puede cobrar/.test(r.error ?? "")) {
        const c = await cajaParaCobrar(d.sedeId);
        if (c.caja) setCaja(c.caja);
      }
      return;
    }
    clave.current = null;
    setVenta(r.venta);
    if (cupon && lineas.some((l) => l.descuento_motivo === `Cupón ${cupon}`)) {
      const u = await registrarUsoCupon(r.venta.venta_id, cupon);
      setUsoCupon(u.error ? `El cobro quedó, pero no se anotó el uso del cupón: ${u.error}` : `Cupón ${cupon} anotado`);
    }
    alCobrado(r.venta);
  };

  const aplicar = () => empezar(async () => {
    const r = await validarCupon(codigoCupon);
    if (r.error || !r.cupon) { setMsjCupon({ error: r.error ?? "No se pudo validar el cupón" }); return; }
    const a = aplicarCupon(lineas, r.cupon, medioPrecio, precios.cuota?.plan_id ?? null);
    if (!a.aplicadas) { setMsjCupon({ error: `El cupón ${r.cupon.codigo} no aplica a nada de lo que se cobra.` }); return; }
    setLineas(a.lineas); setCupon(r.cupon.codigo);
    setMsjCupon({ ok: `Cupón ${r.cupon.codigo}: ${r.cupon.tipo === "porcentaje" ? `${Number(r.cupon.valor)}%` : formatearPesos(r.cupon.valor)}. Si cambiás el medio de pago, volvé a aplicarlo.` });
  });

  const fijarDefecto = () => empezar(async () => {
    if (!medioOk || medioOk === "cuenta_corriente") return;
    const r = await guardarMedioDefecto(medioOk);
    if (r.error) setError(r.error); else setDefecto(medioOk);
  });

  // ── Cobrado ──
  if (venta) {
    const cubre = hayCuota && ctx.cubre ? ` · cubre del ${diaCorto(ctx.cubre.desde, d.zona)}` : "";
    return (
      <div className="p-6 sm:p-8 space-y-4" data-cobrar-hecho data-total={venta.total} aria-live="polite">
        <p className="flex justify-center" aria-hidden><Tilde tamano={64} /></p>
        <p className="titular text-4xl sm:text-5xl text-center">Cobrado {formatearPesos(venta.total)}</p>
        {venta.veredicto && <div className="flex justify-center"><PildoraEstado color={venta.veredicto.color}>{socio.nombre}: {venta.veredicto.texto}</PildoraEstado></div>}
        {cubre && <p className="texto-suave text-center text-sm">{socio.nombre.split(" ")[0]}{cubre}</p>}
        {usoCupon && <p className="texto-suave text-center" data-uso-cupon>{usoCupon}</p>}
        <div className="flex flex-col items-center"><MandarComprobante ventaId={venta.venta_id} className="mt-1" /></div>
        <div className="flex flex-col items-center"><DeshacerVenta ventaId={venta.venta_id} puedeAnular={d.puedeAnular} socioId={socio.socio_id} /></div>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <button type="button" className="boton boton-principal text-lg px-8" data-cobrar-volver onClick={alCerrar}>{VUELTA[origen]} <kbd className="text-xs opacity-70 font-sans">Enter</kbd></button>
        </div>
      </div>
    );
  }

  return (
    <div onKeyDown={(e) => {
      // Enter fuera de un campo cobra (los botones y links hacen lo suyo).
      const t = e.target as HTMLElement;
      if (e.key !== "Enter" || e.defaultPrevented || ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(t.tagName)) return;
      const b = document.querySelector<HTMLButtonElement>("[data-cobrar-confirmar]");
      if (b && !b.disabled) { e.preventDefault(); b.click(); }
    }}>
      <div className="p-5 sm:p-7 space-y-5">
        {/* Quién, y cuánto lleva */}
        <div className="flex items-center gap-3">
          <PuntoEstado color={socio.color} grande />
          <div className="min-w-0 flex-1">
            <p className="titulo text-2xl truncate" data-cobrar-socio>{socio.nombre} {socio.numero != null && <span className="texto-tenue font-normal text-base">#{socio.numero}</span>}</p>
            <p className="texto-suave truncate">{socio.texto}</p>
          </div>
          <button type="button" className="boton-texto" onClick={alCerrar} aria-label="Cerrar">✕</button>
        </div>

        {/* Doble cobro (VD-50, D29): frena y pregunta; solo sigue con "Cobrar igual (con motivo)" */}
        {frenaDoble && doble && <AvisoDobleCobro estado={doble} alCambiar={setDoble} alCancelar={alCerrar} />}

        {/* Qué debe, qué cubre */}
        <section aria-label="Qué se cobra" data-cobrar-lineas>
          {lineas.length === 0 ? (
            <div className="tarjeta p-4 texto-suave">
              {precios.cuota ? "No hay nada para cobrar todavía." : "Sin membresía activa: asignale un plan desde su ficha para cobrarle la cuota."}
              {" "}Sumá algo con “＋ Agregar”.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--borde)]">
              {lineas.map((l) => {
                const p = precioUnitario(l, medioPrecio);
                const conv = descuentoConvenio(l, medioPrecio, precios.convenio);
                return (
                  <li key={l.clave} className="py-3" data-cobrar-linea={l.tipo}>
                    <div className="flex items-start gap-2">
                      <span className="flex-1 font-semibold">{l.cantidad > 1 ? `${l.cantidad} × ` : ""}{l.nombre}</span>
                      <span className="numero text-lg">{p == null ? "—" : formatearPesos(p * l.cantidad)}</span>
                    </div>
                    {l.tipo === "cuota" && ctx.cubre && (
                      <p className="texto-suave text-sm" data-cobrar-cubre>
                        {cuotas > 1 ? `Cubre ${cuotas} períodos desde el ${diaCorto(ctx.cubre.desde, d.zona)}` : `Cubre del ${diaCorto(ctx.cubre.desde, d.zona)} al ${diaCorto(ctx.cubre.hasta, d.zona, 1)}`}
                      </p>
                    )}
                    {l.tipo === "cuota" && parcial && (
                      <p className="text-sm mt-1" data-cobrar-parcial={parcial.modo}>
                        <Icono nombre="grafico" /> Primera cuota con día fijo: {parcial.modo === "proporcional" ? `${parcial.texto}${parcial.lista_entera != null ? ` de ${formatearPesos(parcial.lista_entera)}` : ""} = ${p == null ? "—" : formatearPesos(p)}`
                          : parcial.modo === "gratis" ? `no paga nada, ${parcial.texto}` : parcial.texto}.
                        {" "}Desde ahí entra al ciclo de todos.
                      </p>
                    )}
                    {conv > 0 && (
                      <div className="flex items-start gap-2 mt-1 texto-suave" data-convenio>
                        <span className="flex-1"><Icono nombre="usuarios" /> Convenio {precios.convenio!.nombre}</span><span className="numero">−{formatearPesos(conv)}</span>
                      </div>
                    )}
                    {l.descuento != null && l.descuento_motivo?.startsWith("Cupón ") && (
                      <div className="flex items-start gap-2 mt-1 texto-suave" data-cobrar-cupon-linea>
                        <span className="flex-1"><Icono nombre="etiqueta" /> {l.descuento_motivo}</span><span className="numero">−{formatearPesos(l.descuento)}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <button type="button" aria-label="Uno menos" className="boton !min-h-9 !px-3" disabled={l.tipo === "recargo" || l.tipo === "servicio"} title={l.tipo === "recargo" || l.tipo === "servicio" ? "Va con la cuota: si no lo cobrás, ponele un descuento" : undefined}
                        onClick={() => (l.cantidad > 1 ? cambiar(l.clave, { cantidad: l.cantidad - 1 }) : quitar(l.clave))}>−</button>
                      <span className="numero text-lg w-6 text-center">{l.cantidad}</span>
                      <button type="button" aria-label="Uno más" className="boton !min-h-9 !px-3" disabled={l.tipo === "matricula" || l.tipo === "recargo" || l.tipo === "servicio" || l.tipo === "deuda" || l.tipo === "otro" || (l.tipo === "cuota" && !!parcial)}
                        title={l.tipo === "cuota" && parcial ? "La primera cuota es parcial: se cobra sola" : undefined}
                        onClick={() => cambiar(l.clave, { cantidad: Math.min(l.cantidad + 1, l.tipo === "cuota" ? 12 : 50) })}>+</button>
                      {l.descuento == null
                        ? <button type="button" className="boton-texto ml-auto" onClick={() => cambiar(l.clave, { descuento: 0 })}><Icono nombre="etiqueta" /> Descuento</button>
                        : <button type="button" className="boton-texto ml-auto" onClick={() => cambiar(l.clave, { descuento: undefined, descuento_texto: undefined, descuento_motivo: undefined })}>Sin descuento</button>}
                    </div>
                    {l.descuento != null && (
                      <div className="grid grid-cols-[110px_1fr] gap-2 mt-2">
                        <input className="campo" inputMode="decimal" placeholder="$" value={l.descuento_texto ?? (l.descuento || "")} aria-label="Monto del descuento"
                          onChange={(e) => cambiar(l.clave, { descuento_texto: e.target.value, descuento: monto(e.target.value) })} />
                        <MotivoDescuento valor={l.descuento_motivo ?? ""} onChange={(m) => cambiar(l.clave, { descuento_motivo: m })} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {precios.tope_descuento != null && lineas.some((l) => l.descuento != null) && <p className="text-sm texto-tenue mt-2">Tu descuento máximo es {precios.tope_descuento}%.</p>}

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button type="button" className="boton !min-h-11" aria-expanded={agregando} data-cobrar-agregar onClick={() => setAgregando(!agregando)}>{agregando ? "Cerrar" : "＋ Agregar"}</button>
            {lineas.length > 0 && (
              <span className="flex flex-wrap items-center gap-2" data-cupon>
                <input className="campo !w-32 !min-h-11 uppercase" value={codigoCupon} onChange={(e) => setCodigoCupon(e.target.value.replace(/\s/g, ""))} placeholder="Cupón" aria-label="Código de cupón" maxLength={20} />
                <button type="button" className="boton !min-h-11" disabled={ocupado || codigoCupon.length < 3} onClick={aplicar}><Icono nombre="etiqueta" /> Aplicar</button>
              </span>
            )}
          </div>
          {msjCupon.ok && <p className="text-sm mt-2" style={{ color: "var(--acento)" }}>✓ {msjCupon.ok}</p>}
          {msjCupon.error && <p role="alert" className="text-sm pildora pildora-rojo whitespace-normal mt-2"><Icono nombre="alerta" /> {msjCupon.error}</p>}

          {agregando && (
            <div className="tarjeta p-3 mt-3 space-y-3" data-cobrar-picker>
              <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto">
                {precios.cuota && <Chip icono="etiqueta" texto={`Cuota ${precios.cuota.plan}`} onClick={() => agregar({ tipo: "cuota", nombre: `Cuota ${precios.cuota!.plan}`, precios: precios.cuota!.precios })} />}
                {precios.matricula && !lineas.some((l) => l.tipo === "matricula") && <Chip icono="lista" texto={`Matrícula ${precios.matricula.plan}`} onClick={() => agregar({ tipo: "matricula", nombre: `Matrícula ${precios.matricula!.plan}`, precio_fijo: Number(precios.matricula!.monto) })} />}
                {precios.deuda != null && Number(precios.deuda) > 0 && !lineas.some((l) => l.tipo === "deuda") && <Chip icono="" texto={`Lo que debe: ${formatearPesos(precios.deuda)}`} onClick={() => agregar({ tipo: "deuda", nombre: "Pago de deuda a cuenta", precio_fijo: Number(precios.deuda) })} />}
                {precios.pases.map((p) => <Chip key={p.plan_id} icono="ticket" texto={p.nombre} onClick={() => agregar({ tipo: "pase", nombre: p.nombre, plan_id: p.plan_id, precios: p.precios })} />)}
                {precios.packs.map((p) => <Chip key={p.plan_id} icono="ticket" texto={p.nombre} onClick={() => agregar({ tipo: "pack", nombre: p.nombre, plan_id: p.plan_id, precios: p.precios })} />)}
                {!d.sinProductos && precios.productos.map((p) => <Chip key={p.producto_id} icono="" texto={`${p.nombre} · ${formatearPesos(p.precio)}`} onClick={() => agregar({ tipo: "producto", nombre: p.nombre, producto_id: p.producto_id, precio_fijo: p.precio })} />)}
                <Chip icono="lapiz" texto="Otra cosa" onClick={() => setOtro({ descripcion: "", monto: "" })} />
              </div>
              {otro && (
                <form className="flex flex-col sm:flex-row gap-2" onSubmit={(e) => {
                  e.preventDefault();
                  if (!otro.descripcion.trim() || !(leerMonto(otro.monto) >= 0)) { setError("No entiendo el precio: escribilo como 84.500 o 84500,50"); return; }
                  agregar({ tipo: "otro", nombre: otro.descripcion.trim(), precio_fijo: leerMonto(otro.monto) }); setOtro(null);
                }}>
                  <input autoFocus className="campo" placeholder="Qué es (ej: candado)" value={otro.descripcion} onChange={(e) => setOtro({ ...otro, descripcion: e.target.value })} />
                  <input className="campo sm:max-w-32" inputMode="decimal" placeholder="Precio" value={otro.monto} onChange={(e) => setOtro({ ...otro, monto: e.target.value })} />
                  <button type="submit" className="boton">Sumar</button>
                </form>
              )}
            </div>
          )}
        </section>

        {/* Cómo paga */}
        <section aria-label="Cómo paga">
          <p className="etiqueta mb-2">¿Cómo paga?</p>
          {!mixto ? (
            <div className="grid grid-cols-2 gap-2">
              {medios.map((m) => (
                <button key={m.medio} type="button" aria-pressed={medioOk === m.medio} data-cobrar-medio={m.medio} disabled={!permitido(m.medio)}
                  title={!permitido(m.medio) ? "Un cobro de otro día no puede ser en efectivo ni a cuenta" : undefined}
                  onClick={() => setMedio(m.medio)}
                  className={`boton !min-h-12 text-[15px] ${medioOk === m.medio ? "!border-[var(--acento)] !bg-[color-mix(in_oklab,var(--acento),var(--fondo)_82%)]" : ""}`}>
                  {m.texto}{defecto === m.medio && <span className="texto-tenue text-xs" title="El medio de siempre en este gimnasio"> <Icono nombre="estrella" /></span>}
                </button>
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
              <p className="text-sm texto-tenue">Con dos medios rige el precio de lista.</p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-4">
            {medios.length >= 2 && !otroDia && <button type="button" className="boton-texto mt-2" onClick={() => setMixto(!mixto)}>{mixto ? "Un solo medio" : "Dos medios"}</button>}
            {ctx.puede_cambiar_medio && !mixto && medioOk && medioOk !== "cuenta_corriente" && medioOk !== defecto && (
              <button type="button" className="boton-texto mt-2" disabled={ocupado} onClick={fijarDefecto} data-cobrar-fijar-defecto><Icono nombre="estrella" /> Dejar este como el de siempre</button>
            )}
          </div>
          {sinMedios && <p className="pildora pildora-amarillo !rounded-[var(--radio)] !px-4 !py-3 mt-2">No hay medios de pago prendidos para cobrar acá. El dueño los elige en Configuración → Cobros.</p>}
          {precios.fiado && (medioOk === "cuenta_corriente" || mixto) && (
            <p className="text-sm texto-suave mt-2" data-fiado>Se le puede fiar hasta {formatearPesos(precios.fiado.disponible)} más (tope {formatearPesos(precios.fiado.tope)}).</p>
          )}

          {usaEfectivo && turnoId && !otroDia && <p className="text-sm texto-tenue mt-2" data-cobrar-caja><Icono nombre="plata" /> El efectivo queda en tu caja{caja.caja ? ` (${caja.caja})` : ""}.</p>}
          {/* VD-49: efectivo sin turno → abrirlo acá, con el fondo, y seguir con este cobro */}
          {faltaCaja && <div className="mt-3"><AbrirTurnoCobrar caja={caja} alAbrir={(id, nombre) => { setCaja({ ...caja, turno_id: id, caja: nombre, vencido: false, libres: [] }); setError(null); }} /></div>}

          {/* Transferencia: la foto del comprobante, si la trae */}
          {!mixto && medioOk === "transferencia" && (
            <div className="mt-3 flex flex-wrap items-center gap-2" data-cobrar-comprobante>
              <input ref={entrada} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" aria-label="Foto del comprobante"
                onChange={(e) => { const f = e.target.files?.[0] ?? null; rutaComprobante.current = null; setError(null);
                  if (f && f.size > 2.5 * 1024 * 1024) { setArchivo(null); e.target.value = ""; setError("El archivo pesa más de 2,5 MB: sacale una foto más chica"); } else setArchivo(f); }} />
              <button type="button" className="boton !min-h-11" onClick={() => entrada.current?.click()}><Icono nombre="camara" /> {archivo ? "Cambiar comprobante" : "Adjuntar comprobante"}</button>
              {archivo ? <span className="texto-suave text-sm truncate max-w-48" data-cobrar-archivo>{archivo.name}</span> : <span className="texto-tenue text-sm">opcional</span>}
              {archivo && <button type="button" className="boton-texto" onClick={() => { setArchivo(null); rutaComprobante.current = null; if (entrada.current) entrada.current.value = ""; }}>Quitar</button>}
            </div>
          )}
        </section>

        {/* Cuándo: ahora; "otro día" solo dueño o encargado */}
        {ctx.puede_otro_dia && (
          <section aria-label="Cuándo se cobró" data-cobrar-cuando>
            {!otroDia ? (
              <button type="button" className="boton-texto" data-cobrar-otro-dia
                onClick={() => { setMixto(false); setOtroDia({ fecha: paraInput(new Date(Date.now() - 24 * 3600_000)), motivo: "" }); }}><Icono nombre="reloj" /> Cobré otro día</button>
            ) : (
              <div className="tarjeta p-3 space-y-2" data-cobrar-otro-dia-campos>
                <div className="flex items-center justify-between gap-2">
                  <p className="etiqueta">Cuándo se cobró</p>
                  <button type="button" className="boton-texto" onClick={() => setOtroDia(null)}>Fue ahora</button>
                </div>
                <input type="datetime-local" className="campo" aria-label="Fecha y hora del cobro" value={otroDia.fecha} max={paraInput(new Date())} min={paraInput(new Date(Date.now() - 90 * 24 * 3600_000))}
                  onChange={(e) => setOtroDia({ ...otroDia, fecha: e.target.value })} />
                <input className="campo" placeholder="Motivo (obligatorio): ej. pagó ayer y no se anotó" aria-label="Motivo del cobro con otra fecha" value={otroDia.motivo}
                  onChange={(e) => setOtroDia({ ...otroDia, motivo: e.target.value })} />
                <p className="text-sm texto-tenue">Queda marcado en la venta con tu nombre. No se puede en efectivo ni a cuenta (el efectivo de hoy es el de la caja de hoy).</p>
              </div>
            )}
          </section>
        )}

        {/* Quién cobra */}
        <p className="texto-suave text-sm" data-cobrar-atiende>
          {ctx.operador ? <><Icono nombre="persona" /> Atiende {ctx.operador}</> : ctx.hay_pines ? <><Icono nombre="calculadora" /> Nadie puso su PIN: el cobro queda a nombre de esta sesión. <Link href={`/panel/pin?volver=${encodeURIComponent(typeof window === "undefined" ? "/panel" : window.location.pathname + window.location.search)}`} className="underline">¿Quién atiende?</Link></> : null}
        </p>
      </div>

      {/* El total y el botón, siempre a la vista */}
      <div className="sticky bottom-0 border-t border-[var(--borde)] bg-[var(--fondo)] px-5 sm:px-7 py-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="texto-suave text-lg">Total</span>
          <span className="numero text-4xl sm:text-5xl" data-cobrar-total={total ?? ""}>{total == null ? "—" : formatearPesos(total)}</span>
        </div>
        {faltaCaja && <p className="texto-suave text-sm" data-cobrar-falta-caja><Icono nombre="plata" /> Abrí tu turno (arriba, en “¿Cómo paga?”) para cobrar en efectivo.</p>}
        {error && <Mensaje tipo="error">{error}</Mensaje>}
        <BotonAccion data-cobrar-confirmar ocupadoTexto="Cobrando…" onClick={confirmar} className="boton boton-principal text-lg w-full"
          disabled={sinMedios || lineas.length === 0 || total == null || faltaCaja || faltaOtroDia || faltaMotivoDoble || (mixto && sumaMixto !== total)}>
          <Icono nombre="ok" /> Cobrar{frenaDoble ? " igual" : ""}{total ? ` ${formatearPesos(total)}` : ""} <kbd className="text-xs opacity-70 font-sans">Enter</kbd>
        </BotonAccion>
      </div>
    </div>
  );
}

function Chip({ icono, texto, onClick }: { icono?: string; texto: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="boton !min-h-11 !justify-start text-left"><span aria-hidden><Icono nombre={icono} /></span><span className="truncate">{texto}</span></button>;
}
