"use client";
import { useState, useTransition } from "react";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { Interruptor } from "@/components/ui/Interruptor";
import { Vacio } from "@/components/ui/Vacio";
import { formatearPesos } from "@/lib/formato";
import { CATEGORIAS_GASTO, NOMBRE_CATEGORIA, diaCorto, type GananciaMes } from "@/lib/gastos";
import { agregarFijo, anularGasto, cargarGasto, guardarPresupuesto, permitirEncargado, terminarFijo, verComprobante } from "./acciones";

const Falla = ({ texto }: { texto: string | null }) => texto ? <p role="alert" className="pildora pildora-rojo mt-3">⚠️ {texto}</p> : null;

/** Cargar un gasto del día, con la foto del comprobante si la tiene a mano. */
export function CargarGasto({ mes, hoy, ultimoDia }: { mes: string; hoy: string; ultimoDia: string }) {
  const [error, setError] = useState<string | null>(null);
  const [clave, setClave] = useState(0);
  const dentro = hoy >= mes && hoy <= ultimoDia;
  return (
    <form key={clave} className="tarjeta p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[auto_auto_1fr_10rem] items-end" data-cargar-gasto
      action={async (datos) => { setError(null); const r = await cargarGasto(datos); if (r.error) setError(r.error); else setClave((c) => c + 1); }}>
      <label className="grid gap-1 text-sm">Qué es
        <select name="categoria" className="campo" defaultValue="servicios">
          {CATEGORIAS_GASTO.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm">Día
        <input name="fecha" type="date" className="campo" defaultValue={dentro ? hoy : mes} min={mes} max={ultimoDia} required />
      </label>
      <label className="grid gap-1 text-sm">Detalle (opcional)
        <input name="detalle" className="campo" maxLength={120} placeholder="Luz, arreglo de la cinta…" />
      </label>
      <label className="grid gap-1 text-sm">Monto
        <input name="monto" className="campo" inputMode="decimal" placeholder="250.000" required />
      </label>
      <label className="grid gap-1 text-sm sm:col-span-2 lg:col-span-3">📷 Foto del comprobante (opcional)
        <input name="comprobante" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="text-sm" aria-label="Foto del comprobante" />
      </label>
      <BotonAccion type="submit" ocupadoTexto="Guardando…">➕ Cargar gasto</BotonAccion>
      <div className="sm:col-span-2 lg:col-span-4"><Falla texto={error} /></div>
    </form>
  );
}

/** Los gastos del mes: únicos con su comprobante y fijos con su "dejar de repetir". */
export function ListaGastos({ g, puedeVerFijos }: { g: GananciaMes; puedeVerFijos: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [, empezar] = useTransition();
  const abrir = (id: string) => {
    const pestana = window.open("", "_blank");
    empezar(async () => {
      const r = await verComprobante(id);
      if (r.url && pestana) { pestana.opener = null; pestana.location.href = r.url; }
      else { pestana?.close(); setError(r.error ?? null); }
    });
  };
  const fila = "flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 min-h-14";
  if (!g.gastos.length && !g.fijos.length && !(Number(g.total_fijos) > 0)) {
    return <Vacio emoji="🧮" titulo="Todavía no cargaste gastos de este mes">Cargá el primero arriba. Lo que se repite todos los meses (alquiler, sueldos) se carga una vez como fijo y aparece solo cada mes.</Vacio>;
  }
  return (
    <div>
      <ul className="tarjeta divide-y divide-[var(--borde)]" data-lista-gastos>
        {puedeVerFijos && g.fijos.map((x) => (
          <li key={x.fijo_id} className={fila} data-fijo>
            <span className="flex-1 min-w-0">{NOMBRE_CATEGORIA[x.categoria] ?? x.categoria}{x.detalle && <span className="texto-suave"> · {x.detalle}</span>} <span className="pildora">🔁 fijo</span></span>
            <span className="numero">{formatearPesos(x.monto)}</span>
            {g.es_dueno && <BotonAccion className="boton-texto texto-suave" ocupadoTexto="…" aria-label={`Dejar de repetir ${x.detalle ?? x.categoria} desde este mes`}
              onClick={async () => { const r = await terminarFijo(x.fijo_id, g.mes); setError(r.error ?? null); }}>Dejar de repetir</BotonAccion>}
          </li>
        ))}
        {!puedeVerFijos && Number(g.total_fijos) > 0 && (
          <li className={fila}><span className="flex-1">🔁 Gastos fijos del mes</span><span className="numero">{formatearPesos(g.total_fijos)}</span></li>
        )}
        {g.gastos.map((x) => (
          <li key={x.gasto_id} className={fila} data-gasto>
            <span className="texto-tenue text-sm w-12">{diaCorto(x.fecha)}</span>
            <span className="flex-1 min-w-0">{NOMBRE_CATEGORIA[x.categoria] ?? x.categoria}{x.detalle && <span className="texto-suave"> · {x.detalle}</span>}</span>
            {x.comprobante && <button type="button" className="boton-texto" aria-label={`Ver el comprobante de ${x.detalle ?? x.categoria}`} onClick={() => abrir(x.gasto_id)}>📎 Ver</button>}
            <span className="numero">{formatearPesos(x.monto)}</span>
            <BotonAccion className="boton-texto texto-suave" ocupadoTexto="…" aria-label={`Quitar ${x.detalle ?? x.categoria}`}
              onClick={async () => { const r = await anularGasto(x.gasto_id); setError(r.error ?? null); }}>Quitar</BotonAccion>
          </li>
        ))}
      </ul>
      <Falla texto={error} />
    </div>
  );
}

/** Gastos que se repiten todos los meses (solo el dueño): se calculan al mirar cada mes, nada los carga por cron. */
export function Fijos({ mes }: { mes: string }) {
  const [error, setError] = useState<string | null>(null);
  const [clave, setClave] = useState(0);
  const [categoria, setCategoria] = useState("alquiler");
  const [detalle, setDetalle] = useState("");
  const [monto, setMonto] = useState("");
  const [ocupado, empezar] = useTransition();
  return (
    <form key={clave} className="tarjeta p-4 grid gap-3 sm:grid-cols-[auto_1fr_10rem_auto] items-end" data-nuevo-fijo
      onSubmit={(e) => { e.preventDefault(); empezar(async () => { setError(null); const r = await agregarFijo(categoria, detalle, monto, mes); if (r.error) setError(r.error); else { setDetalle(""); setMonto(""); setClave((c) => c + 1); } }); }}>
      <label className="grid gap-1 text-sm">Qué es
        <select className="campo" value={categoria} onChange={(e) => setCategoria(e.target.value)}>{CATEGORIAS_GASTO.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
      </label>
      <label className="grid gap-1 text-sm">Detalle (opcional)
        <input className="campo" value={detalle} maxLength={120} onChange={(e) => setDetalle(e.target.value)} placeholder="Alquiler del local" />
      </label>
      <label className="grid gap-1 text-sm">Monto por mes
        <input className="campo" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="500.000" required />
      </label>
      <button type="submit" className="boton" disabled={ocupado}>{ocupado ? "Guardando…" : "🔁 Agregar fijo"}</button>
      <div className="sm:col-span-4"><Falla texto={error} /></div>
    </form>
  );
}

/** Cuánto esperás gastar por mes en cada categoría (solo el dueño). Vacío saca el presupuesto. */
export function Presupuesto({ g }: { g: GananciaMes }) {
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<string | null>(null);
  return (
    <div data-presupuesto>
      <ul className="tarjeta divide-y divide-[var(--borde)]">
        {g.por_categoria.map((c) => {
          const pasado = c.desvio != null && Number(c.desvio) > 0;
          return (
            <li key={c.categoria} className="px-4 py-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center" data-categoria={c.categoria}>
              <div>
                <p>{NOMBRE_CATEGORIA[c.categoria] ?? c.categoria}</p>
                <p className="texto-suave text-sm">
                  Este mes: {formatearPesos(c.gastado)}
                  {c.desvio != null && <span className={`pildora ml-2 ${pasado ? "pildora-rojo" : "pildora-verde"}`}>{pasado ? `+${formatearPesos(c.desvio)} de más` : `${formatearPesos(Math.abs(Number(c.desvio)))} de margen`}</span>}
                </p>
                {c.presupuesto != null && Number(c.presupuesto) > 0 && (
                  <div className="h-1.5 rounded-full bg-[var(--borde)] mt-2 overflow-hidden" aria-hidden>
                    <div className="h-full" style={{ width: `${Math.min(100, (Number(c.gastado) / Number(c.presupuesto)) * 100)}%`, background: pasado ? "var(--rojo)" : "var(--acento)" }} />
                  </div>
                )}
              </div>
              <form className="flex gap-2 items-center"
                action={async (datos) => { setError(null); setGuardado(null); const r = await guardarPresupuesto(c.categoria, String(datos.get("monto") ?? "")); if (r.error) setError(r.error); else setGuardado(c.categoria); }}>
                <input key={String(c.presupuesto)} name="monto" className="campo w-36" inputMode="decimal" defaultValue={c.presupuesto == null ? "" : String(Number(c.presupuesto)).replace(".", ",")}
                  placeholder="Sin presupuesto" aria-label={`Presupuesto mensual de ${NOMBRE_CATEGORIA[c.categoria] ?? c.categoria}`} />
                <BotonAccion className="boton" ocupadoTexto="…">{guardado === c.categoria ? "✅" : "Guardar"}</BotonAccion>
              </form>
            </li>
          );
        })}
      </ul>
      <Falla texto={error} />
    </div>
  );
}

/** El dueño decide si el encargado ve los gastos (hay sueldos): apagado de origen. */
export function PermisoEncargado({ prendido }: { prendido: boolean }) {
  const [valor, setValor] = useState(prendido);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  return (
    <div className="tarjeta p-4" data-permiso-gastos>
      <Interruptor etiqueta="🧭 El encargado ve y carga los gastos" ayuda="Apagado: solo vos ves los gastos y los sueldos. Los fijos y el presupuesto los manejás siempre vos."
        checked={valor} disabled={ocupado}
        onChange={(e) => { const nuevo = e.target.checked; setValor(nuevo); empezar(async () => { const r = await permitirEncargado(nuevo); if (r.error) { setValor(!nuevo); setError(r.error); } else setError(null); }); }} />
      <Falla texto={error} />
    </div>
  );
}
