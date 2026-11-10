"use client";
// VD-55: la lista de lockers, alquilar (con un cobro ya hecho, o cortesía), renovar, liberar, y la configuración (tarifas y alta).
import Link from "next/link";
import { useState } from "react";
import { buscarSociosRapido, type ResultadoSocio } from "../acciones";
import { BotonCobrar } from "@/components/panel/cobrar/BotonCobrar";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { Mensaje } from "@/components/ui/Mensaje";
import { Vacio } from "@/components/ui/Vacio";
import { formatearPesos } from "@/lib/formato";
import { alquilarLocker, bajaLocker, crearLocker, crearLockersSerie, guardarTarifa, liberarLocker, renovarLocker } from "./acciones";
import { Icono } from "@/components/ui/Icono";

type Alquiler = { alquiler_id: string; socio_id: string; socio: string; desde: string; hasta: string; ultimo_dia: string; dias: number; cortesia: boolean; cortesia_motivo: string | null };
type Locker = { locker_id: string; numero: string; ubicacion: string | null; sede_id: string; sede: string; activo: boolean; estado: "libre" | "ocupado" | "vencido"; alquiler: Alquiler | null };
type PorAsignar = { venta_item_id: string; socio_id: string; socio: string; tarifa: string; meses: number; cobrado_en: string };
type Tarifa = { producto_id: string; nombre: string; precio: number; meses: number; activo: boolean };
export type DatosLockers = { puede_gestionar: boolean; sedes: { sede_id: string; nombre: string }[]; tarifas: Tarifa[]; lockers: Locker[]; por_asignar: PorAsignar[] };

const dia = (d: string) => d.split("-").reverse().slice(0, 2).join("/");
const cuanto = (n: number) => (n < 0 ? `venció hace ${-n} ${-n === 1 ? "día" : "días"}` : n === 0 ? "vence hoy" : n === 1 ? "vence mañana" : `vence en ${n} días`);

/** Con qué se asigna: un cobro ya hecho, cobrar ahora, o (dueño/encargado) una cortesía con motivo. */
function Asignar({ socioId, socioNombre, pendientes, gestiona, etiqueta, confirmar }: {
  socioId: string; socioNombre: string; pendientes: PorAsignar[]; gestiona: boolean; etiqueta: string;
  confirmar: (ventaItemId: string | null, meses: number | null, motivo: string | null) => Promise<{ error?: string }>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [cortesia, setCortesia] = useState(false);
  const [meses, setMeses] = useState(1);
  const [motivo, setMotivo] = useState("");
  const propios = pendientes.filter((x) => x.socio_id === socioId);
  const ir = async (item: string | null) => {
    setError(null);
    const r = await confirmar(item, item ? null : meses, item ? null : motivo);
    if (r.error) setError(r.error);
  };
  return (
    <div className="space-y-3" data-asignar-socio={socioId}>
      <p className="texto-suave text-sm">Socio: <span className="font-semibold text-[var(--texto)]">{socioNombre}</span></p>
      {propios.length > 0 && (
        <div className="space-y-2">
          <p className="etiqueta">Ya cobrado, sin locker</p>
          {propios.map((x) => (
            <BotonAccion key={x.venta_item_id} className="boton boton-principal w-full" onClick={() => ir(x.venta_item_id)} ocupadoTexto="Asignando…" data-asignar-cobro={x.venta_item_id}>
              {etiqueta} · {x.tarifa} ({x.meses} {x.meses === 1 ? "mes" : "meses"})
            </BotonAccion>
          ))}
        </div>
      )}
      {propios.length === 0 && (
        <p className="text-sm texto-suave">
          Primero se cobra el alquiler: <BotonCobrar socioId={socioId} origen="otro" className="boton boton-chico"><Icono nombre="plata" /> Cobrar el alquiler</BotonCobrar>{" "}
          y vuelve acá para asignar el locker.
        </p>
      )}
      {gestiona && (
        <div className="space-y-2">
          <button type="button" className="text-sm underline texto-suave" onClick={() => setCortesia(!cortesia)} data-cortesia-abrir>{cortesia ? "Ocultar la cortesía" : "Sin cobrar (cortesía)"}</button>
          {cortesia && (
            <div className="space-y-2 aparecer">
              <label className="block space-y-1"><span className="etiqueta">Meses</span>
                <select className="campo !w-auto" value={meses} onChange={(e) => setMeses(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
              <label className="block space-y-1"><span className="etiqueta">Motivo</span>
                <input className="campo" maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Por qué no se cobra" data-cortesia-motivo /></label>
              <BotonAccion className="boton" disabled={motivo.trim().length < 3} onClick={() => ir(null)} ocupadoTexto="Asignando…" data-asignar-cortesia>{etiqueta} sin cobrar</BotonAccion>
            </div>
          )}
        </div>
      )}
      {error && <Mensaje tipo="error">{error}</Mensaje>}
    </div>
  );
}

function ElegirSocio({ alElegir }: { alElegir: (s: ResultadoSocio) => void }) {
  const [busca, setBusca] = useState("");
  const [encontrados, setEncontrados] = useState<ResultadoSocio[]>([]);
  const [error, setError] = useState<string | null>(null);
  const buscar = async (texto: string) => {
    setBusca(texto);
    if (texto.trim().length < 2) { setEncontrados([]); return; }
    const r = await buscarSociosRapido(texto);
    if (r.error) { setError(r.error); return; }
    setError(null); setEncontrados(r.socios ?? []);
  };
  return (
    <div className="space-y-2">
      <input className="campo" value={busca} onChange={(e) => void buscar(e.target.value)} placeholder="Buscá al socio por nombre o DNI" aria-label="Buscar socio" data-buscar-socio-locker />
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {encontrados.length > 0 && (
        <ul className="space-y-1">
          {encontrados.map((s) => <li key={s.socio_id}><button type="button" className="fila w-full text-left px-3 min-h-[48px]" onClick={() => alElegir(s)} data-elegir-socio={s.socio_id}>{s.nombre}</button></li>)}
        </ul>
      )}
    </div>
  );
}

function TarjetaLocker({ l, datos }: { l: Locker; datos: DatosLockers }) {
  const [modo, setModo] = useState<null | "alquilar" | "renovar" | "liberar">(null);
  const [socio, setSocio] = useState<ResultadoSocio | null>(null);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const a = l.alquiler;
  const cerrar = () => { setModo(null); setSocio(null); setMotivo(""); setError(null); };
  return (
    <li className="tarjeta p-4 space-y-3 min-w-0" data-locker={l.numero} data-estado={l.estado}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold text-lg"><Icono nombre="candado" /> {l.numero}</span>
        {datos.sedes.length > 1 && <span className="texto-tenue text-sm">{l.sede}</span>}
        {l.ubicacion && <span className="texto-tenue text-sm">{l.ubicacion}</span>}
        {!l.activo ? <span className="pildora">de baja</span>
          : l.estado === "libre" ? <span className="pildora" data-pildora-estado="libre">Libre</span>
          : l.estado === "vencido" ? <span className="pildora" data-pildora-estado="vencido"><Icono nombre="punto-amarillo" /> Vencido</span>
          : <span className="pildora" data-pildora-estado="ocupado">Ocupado</span>}
      </div>
      {a && (
        <p className="text-sm break-words">
          <Icono nombre="persona" /> <Link href={`/panel/socios/${a.socio_id}`} className="underline">{a.socio}</Link> · hasta el {dia(a.ultimo_dia)} <span className="texto-tenue">({cuanto(a.dias)})</span>
          {a.cortesia && <span className="texto-tenue"> · cortesía: {a.cortesia_motivo}</span>}
        </p>
      )}
      {error && <Mensaje tipo="error">{error}</Mensaje>}

      {modo === "alquilar" && (
        <div className="space-y-3 aparecer" data-form-alquilar>
          {!socio ? <ElegirSocio alElegir={setSocio} /> : (
            <Asignar socioId={socio.socio_id} socioNombre={socio.nombre} pendientes={datos.por_asignar} gestiona={datos.puede_gestionar} etiqueta="Asignar el locker"
              confirmar={async (item, meses, mot) => { const r = await alquilarLocker(l.locker_id, socio.socio_id, item, meses, mot); if (!r.error) cerrar(); return r; }} />
          )}
          <button type="button" className="boton" onClick={cerrar}>Cancelar</button>
        </div>
      )}
      {modo === "renovar" && a && (
        <div className="space-y-3 aparecer" data-form-renovar>
          <Asignar socioId={a.socio_id} socioNombre={a.socio} pendientes={datos.por_asignar} gestiona={datos.puede_gestionar} etiqueta="Renovar"
            confirmar={async (item, meses, mot) => { const r = await renovarLocker(a.alquiler_id, item, meses, mot); if (!r.error) cerrar(); return r; }} />
          <button type="button" className="boton" onClick={cerrar}>Cancelar</button>
        </div>
      )}
      {modo === "liberar" && (
        <div className="space-y-2 aparecer" data-form-liberar>
          <label className="block space-y-1"><span className="etiqueta">¿Por qué se libera?</span>
            <input className="campo" maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Devolvió la llave, no renovó…" data-liberar-motivo /></label>
          <div className="flex flex-wrap gap-2">
            <BotonAccion className="boton boton-principal" disabled={motivo.trim().length < 3} ocupadoTexto="Liberando…" data-confirmar-liberar
              onClick={async () => { const r = await liberarLocker(l.locker_id, motivo); if (r.error) setError(r.error); else cerrar(); }}>Liberar el locker</BotonAccion>
            <button type="button" className="boton" onClick={cerrar}>Cancelar</button>
          </div>
        </div>
      )}

      {modo === null && l.activo && (
        <div className="flex flex-wrap items-center gap-2">
          {l.estado === "libre" && <button type="button" className="boton boton-principal" onClick={() => setModo("alquilar")} data-alquilar><Icono nombre="mas" /> Alquilar</button>}
          {a && <button type="button" className="boton" onClick={() => setModo("renovar")} data-renovar><Icono nombre="repetir" /> Renovar</button>}
          {a && <button type="button" className="boton" onClick={() => setModo("liberar")} data-liberar>Liberar</button>}
          {datos.puede_gestionar && l.estado === "libre" && (
            <BotonAccion className="text-sm underline texto-suave" ocupadoTexto="…" onClick={async () => { const r = await bajaLocker(l.locker_id, false); if (r.error) setError(r.error); }}>Dar de baja</BotonAccion>
          )}
        </div>
      )}
      {modo === null && !l.activo && datos.puede_gestionar && (
        <BotonAccion className="text-sm underline texto-suave" ocupadoTexto="…" onClick={async () => { const r = await bajaLocker(l.locker_id, true); if (r.error) setError(r.error); }}>Volver a dar de alta</BotonAccion>
      )}
    </li>
  );
}

function PorAsignarLista({ datos }: { datos: DatosLockers }) {
  const libres = datos.lockers.filter((l) => l.activo && l.estado === "libre");
  const [elegido, setElegido] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  if (datos.por_asignar.length === 0) return null;
  return (
    <section className="tarjeta p-4 space-y-3" data-por-asignar={datos.por_asignar.length}>
      <h2 className="titulo text-2xl"><Icono nombre="plata" /> Cobrado, falta asignar el locker</h2>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <ul className="space-y-2">
        {datos.por_asignar.map((x) => (
          <li key={x.venta_item_id} className="flex flex-wrap items-center gap-2" data-por-asignar-item={x.venta_item_id}>
            <span className="min-w-0 flex-1 break-words"><span className="font-semibold">{x.socio}</span> · {x.tarifa} ({x.meses} {x.meses === 1 ? "mes" : "meses"})</span>
            <select className="campo !w-auto !min-h-10" aria-label={`Locker para ${x.socio}`} value={elegido[x.venta_item_id] ?? ""} onChange={(e) => setElegido({ ...elegido, [x.venta_item_id]: e.target.value })}>
              <option value="">Elegí un locker libre</option>
              {libres.map((l) => <option key={l.locker_id} value={l.locker_id}>{l.numero}{l.ubicacion ? ` · ${l.ubicacion}` : ""}</option>)}
            </select>
            <BotonAccion className="boton" disabled={!elegido[x.venta_item_id]} ocupadoTexto="Asignando…"
              onClick={async () => { const r = await alquilarLocker(elegido[x.venta_item_id], x.socio_id, x.venta_item_id, null, null); setError(r.error ?? null); }}>Asignar</BotonAccion>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Configurar({ datos }: { datos: DatosLockers }) {
  const [msg, setMsg] = useState<{ tipo: "error" | "exito"; texto: string } | null>(null);
  const [sede, setSede] = useState(datos.sedes[0]?.sede_id ?? "");
  const [numero, setNumero] = useState("");
  const [ubic, setUbic] = useState("");
  const [desde, setDesde] = useState("1");
  const [hasta, setHasta] = useState("");
  const [prefijo, setPrefijo] = useState("");
  const [tNombre, setTNombre] = useState("Locker mensual");
  const [tPrecio, setTPrecio] = useState("");
  const [tMeses, setTMeses] = useState(1);
  return (
    <details className="tarjeta p-4" data-configurar-lockers>
      <summary className="cursor-pointer font-semibold"><Icono nombre="ajustes" /> Configurar: lockers y precios</summary>
      <div className="space-y-5 mt-4">
        {msg && <Mensaje tipo={msg.tipo}>{msg.texto}</Mensaje>}
        <div className="space-y-2" data-tarifas>
          <p className="etiqueta">Lo que cobrás por el alquiler</p>
          {datos.tarifas.length === 0 && <p className="texto-suave text-sm">Todavía no hay una tarifa: sin tarifa no se puede cobrar un locker.</p>}
          <ul className="space-y-1">
            {datos.tarifas.map((t) => <li key={t.producto_id} className="text-sm" data-tarifa={t.producto_id}>{t.nombre} · {t.meses} {t.meses === 1 ? "mes" : "meses"} · {formatearPesos(t.precio)}{!t.activo && " (no se ofrece)"}</li>)}
          </ul>
          <div className="grid sm:grid-cols-4 gap-2">
            <input className="campo" value={tNombre} onChange={(e) => setTNombre(e.target.value)} aria-label="Nombre de la tarifa" data-tarifa-nombre />
            <input className="campo" value={tPrecio} onChange={(e) => setTPrecio(e.target.value)} placeholder="Precio $" inputMode="decimal" aria-label="Precio" data-tarifa-precio />
            <select className="campo" value={tMeses} onChange={(e) => setTMeses(Number(e.target.value))} aria-label="Meses">{[1, 2, 3, 6, 12].map((n) => <option key={n} value={n}>{n} {n === 1 ? "mes" : "meses"}</option>)}</select>
            <BotonAccion className="boton" ocupadoTexto="Guardando…" data-guardar-tarifa
              onClick={async () => { const r = await guardarTarifa(null, tNombre, tPrecio, tMeses, true); setMsg(r.error ? { tipo: "error", texto: r.error } : { tipo: "exito", texto: "Tarifa guardada: ya sale en Vender." }); }}>Agregar tarifa</BotonAccion>
          </div>
          <p className="texto-tenue text-xs">El precio se cambia en Productos. El cobro siempre usa el precio de hoy.</p>
        </div>
        <div className="space-y-2">
          <p className="etiqueta">Cargar lockers</p>
          {datos.sedes.length > 1 && <select className="campo" value={sede} onChange={(e) => setSede(e.target.value)} aria-label="Sede">{datos.sedes.map((s) => <option key={s.sede_id} value={s.sede_id}>{s.nombre}</option>)}</select>}
          <div className="grid sm:grid-cols-4 gap-2">
            <input className="campo" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Número o nombre" aria-label="Número del locker" data-locker-numero />
            <input className="campo sm:col-span-2" value={ubic} onChange={(e) => setUbic(e.target.value)} placeholder="Dónde está (opcional)" aria-label="Ubicación" />
            <BotonAccion className="boton" disabled={!numero.trim()} ocupadoTexto="Guardando…" data-crear-locker
              onClick={async () => { const r = await crearLocker(sede, numero, ubic); setMsg(r.error ? { tipo: "error", texto: r.error } : { tipo: "exito", texto: `Locker ${numero} cargado.` }); if (!r.error) setNumero(""); }}>Agregar</BotonAccion>
          </div>
          <p className="texto-suave text-sm">O una tanda:</p>
          <div className="grid sm:grid-cols-4 gap-2">
            <input className="campo" value={prefijo} onChange={(e) => setPrefijo(e.target.value)} placeholder="Prefijo (A-)" aria-label="Prefijo" />
            <input className="campo" value={desde} onChange={(e) => setDesde(e.target.value)} inputMode="numeric" aria-label="Desde el número" data-serie-desde />
            <input className="campo" value={hasta} onChange={(e) => setHasta(e.target.value)} inputMode="numeric" placeholder="Hasta" aria-label="Hasta el número" data-serie-hasta />
            <BotonAccion className="boton" disabled={!hasta.trim()} ocupadoTexto="Creando…" data-crear-serie
              onClick={async () => { const r = await crearLockersSerie(sede, Number(desde), Number(hasta), prefijo, ubic); setMsg(r.error ? { tipo: "error", texto: r.error } : { tipo: "exito", texto: `Se cargaron ${r.creados} lockers.` }); }}>Crear la tanda</BotonAccion>
          </div>
        </div>
      </div>
    </details>
  );
}

export function Lockers({ datos }: { datos: DatosLockers; zona: string }) {
  const activos = datos.lockers.filter((l) => l.activo);
  const libres = activos.filter((l) => l.estado === "libre").length;
  const ocupados = activos.filter((l) => l.estado === "ocupado").length;
  const vencidos = activos.filter((l) => l.estado === "vencido").length;
  const vencen = activos.filter((l) => l.alquiler && l.alquiler.dias <= 7);
  const bajas = datos.lockers.filter((l) => !l.activo);
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="grid grid-cols-3 gap-3" data-totales-lockers>
        <div className="tarjeta p-3 text-center"><p className="numero text-3xl" data-total-libres>{libres}</p><p className="texto-suave text-sm">Libres</p></div>
        <div className="tarjeta p-3 text-center"><p className="numero text-3xl" data-total-ocupados>{ocupados}</p><p className="texto-suave text-sm">Ocupados</p></div>
        <div className="tarjeta p-3 text-center"><p className="numero text-3xl" data-total-vencidos>{vencidos}</p><p className="texto-suave text-sm">Vencidos</p></div>
      </div>

      {vencen.length > 0 && (
        <section className="tarjeta p-4 space-y-2" data-vencen-semana={vencen.length}>
          <h2 className="titulo text-2xl"><Icono nombre="reloj" /> Vencen esta semana</h2>
          <ul className="space-y-1">
            {vencen.map((l) => <li key={l.locker_id} className="text-sm break-words"><span className="font-semibold">Locker {l.numero}</span> · {l.alquiler!.socio} · {cuanto(l.alquiler!.dias)} ({dia(l.alquiler!.ultimo_dia)})</li>)}
          </ul>
        </section>
      )}

      <PorAsignarLista datos={datos} />
      {datos.puede_gestionar && <Configurar datos={datos} />}

      {activos.length === 0 ? (
        <Vacio icono="candado" titulo="Todavía no hay lockers cargados">
          {datos.puede_gestionar ? "Cargalos en “Configurar”: uno por uno o una tanda (del 1 al 60). Después poné la tarifa y ya se pueden alquilar." : "El dueño o el encargado tienen que cargar los lockers."}
        </Vacio>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-3 [&>*]:min-w-0" data-lista-lockers={activos.length}>
          {activos.map((l) => <TarjetaLocker key={l.locker_id} l={l} datos={datos} />)}
        </ul>
      )}
      {bajas.length > 0 && (
        <details className="tarjeta p-4">
          <summary className="cursor-pointer font-semibold">Lockers dados de baja ({bajas.length})</summary>
          <ul className="grid sm:grid-cols-2 gap-3 mt-3 [&>*]:min-w-0">{bajas.map((l) => <TarjetaLocker key={l.locker_id} l={l} datos={datos} />)}</ul>
        </details>
      )}
    </div>
  );
}
