"use client";
// VD-52 · Una tarjeta por profe: lo que se le debe del mes, su regla, y (el dueño) pagar, cargar horas y cambiar la regla.
import { useRef, useState, useTransition } from "react";
import { Interruptor } from "@/components/ui/Interruptor";
import { Mensaje } from "@/components/ui/Mensaje";
import { fechaHumana, formatearPesos } from "@/lib/formato";
import { anularHoras, anularPago, cargarHoras, guardarConfigLiquidacion, guardarRegla, pagarProfe, verDetalle, type Detalle } from "./acciones";
import { Icono } from "@/components/ui/Icono";

export type FilaProfe = {
  profe_id: string; nombre: string; rol: string; activo: boolean;
  regla: { modo: string; monto: number; vigente_desde: string } | null;
  clases: number; presentes: number; horas_clases: number; horas_cargadas: number | null; horas_fuente?: "fichaje" | "carga" | null; fichajes_sin_salida?: number;
  total: number; pagado: number; pendiente: number; sin_regla: boolean;
};

const MODO: Record<string, string> = { por_clase: "por clase dictada", por_presente: "por alumno presente", por_hora: "por hora" };
const MEDIO: Record<string, string> = { efectivo: "Efectivo", transferencia: "Transferencia", otro: "Otro" };
const horas = (h: number) => `${String(h).replace(".", ",")} h`;
const dia = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
const reglaTexto = (r: FilaProfe["regla"]) => (r ? `${formatearPesos(r.monto)} ${MODO[r.modo]}` : null);

export function Liquidacion({ mes, profes, esDueno, turnoId, encargadoVe, hoy }: {
  mes: string; profes: FilaProfe[]; esDueno: boolean; turnoId: string | null; encargadoVe: boolean | null; hoy: string;
}) {
  const total = profes.reduce((a, p) => a + Number(p.total), 0);
  const pendiente = profes.reduce((a, p) => a + Number(p.pendiente), 0);
  return (
    <div className="space-y-6">
      <section className="tarjeta p-5 grid grid-cols-2 gap-4 max-w-xl" aria-label="Total del mes" data-total-mes>
        <div><p className="texto-suave text-sm">Se les debe en el mes</p><p className="numero text-3xl" data-total>{formatearPesos(total)}</p></div>
        <div><p className="texto-suave text-sm">Falta pagar</p><p className="numero text-3xl" data-pendiente>{formatearPesos(pendiente)}</p></div>
      </section>
      <ul className="space-y-4">
        {profes.map((p) => <Tarjeta key={p.profe_id} p={p} mes={mes} esDueno={esDueno} turnoId={turnoId} hoy={hoy} />)}
      </ul>
      {encargadoVe !== null && <Ajuste encargadoVe={encargadoVe} />}
    </div>
  );
}

function Ajuste({ encargadoVe }: { encargadoVe: boolean }) {
  const [valor, setValor] = useState(encargadoVe);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  return (
    <section className="tarjeta p-5 max-w-xl" aria-labelledby="quien-ve">
      <h2 id="quien-ve" className="titulo text-xl mb-1"><Icono nombre="ojo" /> Quién lo ve</h2>
      <Interruptor etiqueta="El encargado también ve la liquidación" ayuda="Solo mirar: pagar y cambiar reglas lo hace siempre el dueño. Cada profe ve su propio mes en Mi cuenta." checked={valor} disabled={ocupado}
        onChange={(e) => { const nuevo = e.target.checked; setValor(nuevo); empezar(async () => { const r = await guardarConfigLiquidacion(nuevo); if (r.error) { setError(r.error); setValor(!nuevo); } else setError(null); }); }} />
      {error && <Mensaje tipo="error">{error}</Mensaje>}
    </section>
  );
}

type Panel = null | "regla" | "horas" | "pagar" | "detalle";

function Tarjeta({ p, mes, esDueno, turnoId, hoy }: { p: FilaProfe; mes: string; esDueno: boolean; turnoId: string | null; hoy: string }) {
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [regla, setRegla] = useState({ modo: p.regla?.modo ?? "por_clase", monto: p.regla ? String(p.regla.monto).replace(".", ",") : "", desde: mes });
  const [h, setH] = useState({ fecha: hoy, horas: "", nota: "" });
  const [pago, setPago] = useState({ monto: String(p.pendiente).replace(".", ","), medio: "transferencia", nota: "" });
  const clave = useRef(crypto.randomUUID());   // el mismo pago mandado dos veces es uno solo (la base lo reconoce)
  const abrir = (x: Panel) => {
    const nuevo = panel === x ? null : x;
    setPanel(nuevo); setError(null); setOk(null);
    if (nuevo === "detalle" || nuevo === "horas" || nuevo === "pagar") empezar(async () => { const r = await verDetalle(p.profe_id, mes); if (r.detalle) setDetalle(r.detalle); else if (r.error) setError(r.error); });
  };
  const correr = (f: () => Promise<{ error?: string }>, msg: string, despues?: () => void) =>
    empezar(async () => { const r = await f(); if (r.error) { setError(r.error); setOk(null); } else { setError(null); setOk(msg); despues?.(); const d = await verDetalle(p.profe_id, mes); if (d.detalle) setDetalle(d.detalle); } });

  return (
    <li className="tarjeta p-5 space-y-4" data-profe={p.nombre}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="titulo text-2xl">{p.nombre}{!p.activo && <span className="pildora ml-2 text-sm">dado de baja</span>}</h2>
        {p.regla
          ? <p className="texto-suave" data-regla>{reglaTexto(p.regla)}{p.regla.vigente_desde ? ` · desde el ${dia(p.regla.vigente_desde)}` : ""}</p>
          : <p className="pildora pildora-amarillo" data-sin-regla>Sin regla de pago</p>}
      </div>
      {p.sin_regla && <Mensaje tipo="aviso">Dio {p.clases} {p.clases === 1 ? "clase" : "clases"} y todavía no tiene regla: no suma nada hasta que le pongas cómo se le paga.</Mensaje>}
      <dl className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-center">
        <Dato t="Clases" v={String(p.clases)} />
        <Dato t="Presentes" v={String(p.presentes)} />
        <Dato t={p.horas_fuente === "fichaje" ? "Horas fichadas" : p.horas_cargadas != null ? "Horas cargadas" : "Horas de clase"} v={horas(p.horas_cargadas ?? p.horas_clases)} />
        <Dato t="Se le debe" v={formatearPesos(p.total)} fuerte clave="total" />
        <Dato t="Pagado" v={formatearPesos(p.pagado)} clave="pagado" />
        <Dato t="Falta" v={formatearPesos(p.pendiente)} fuerte clave="pendiente" />
      </dl>
      <div className="flex flex-wrap gap-2">
        {esDueno && <button type="button" className="boton boton-principal" disabled={Number(p.pendiente) <= 0} onClick={() => abrir("pagar")} data-abrir-pagar><Icono nombre="plata" /> Pagar</button>}
        {esDueno && <button type="button" className="boton" onClick={() => abrir("regla")} data-abrir-regla><Icono nombre="grafico" /> Cómo se le paga</button>}
        {esDueno && <button type="button" className="boton" onClick={() => abrir("horas")} data-abrir-horas><Icono nombre="reloj" /> Cargar horas</button>}
        <button type="button" className="boton" onClick={() => abrir("detalle")} data-abrir-detalle>{panel === "detalle" ? "Ocultar el detalle" : "Ver el detalle"}</button>
      </div>
      {ok && <Mensaje tipo="exito">{ok}</Mensaje>}
      {error && <Mensaje tipo="error">{error}</Mensaje>}

      {panel === "regla" && (
        <form className="grid sm:grid-cols-4 gap-3 items-end border-t border-[var(--borde)] pt-4" data-form-regla
          onSubmit={(e) => { e.preventDefault(); correr(() => guardarRegla(p.profe_id, regla.modo, regla.monto, regla.desde), "Regla guardada. El mes se recalculó.", () => setPanel(null)); }}>
          <label className="space-y-1"><span className="etiqueta">Se le paga</span>
            <select className="campo" value={regla.modo} onChange={(e) => setRegla({ ...regla, modo: e.target.value })} name="modo">
              {Object.entries(MODO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></label>
          <label className="space-y-1"><span className="etiqueta">Monto ($)</span>
            <input className="campo" inputMode="decimal" name="monto" value={regla.monto} onChange={(e) => setRegla({ ...regla, monto: e.target.value })} placeholder="8.000" /></label>
          <label className="space-y-1"><span className="etiqueta">Desde el día</span>
            <input className="campo" type="date" name="desde" value={regla.desde} onChange={(e) => setRegla({ ...regla, desde: e.target.value })} /></label>
          <button type="submit" className="boton boton-principal" disabled={ocupado || !regla.monto.trim()}>Guardar</button>
          <p className="texto-tenue text-sm sm:col-span-4">Por defecto vale desde el primer día del mes que estás viendo, así el mes entero se recalcula. Si la ponés desde otro día, lo dictado antes sigue con la regla que tenía. Por hora usa los minutos de las clases, o las horas que cargues a mano.</p>
        </form>
      )}

      {panel === "horas" && (
        <div className="space-y-3 border-t border-[var(--borde)] pt-4" data-panel-horas>
          <form className="grid sm:grid-cols-4 gap-3 items-end" onSubmit={(e) => { e.preventDefault(); correr(() => cargarHoras(p.profe_id, h.fecha, h.horas, h.nota), "Horas cargadas.", () => setH({ ...h, horas: "", nota: "" })); }}>
            <label className="space-y-1"><span className="etiqueta">Día</span><input className="campo" type="date" max={hoy} name="fecha" value={h.fecha} onChange={(e) => setH({ ...h, fecha: e.target.value })} /></label>
            <label className="space-y-1"><span className="etiqueta">Horas</span><input className="campo" inputMode="decimal" name="horas" placeholder="2,5 o 2:30" value={h.horas} onChange={(e) => setH({ ...h, horas: e.target.value })} /></label>
            <label className="space-y-1"><span className="etiqueta">Nota (opcional)</span><input className="campo" name="nota" maxLength={120} value={h.nota} onChange={(e) => setH({ ...h, nota: e.target.value })} /></label>
            <button type="submit" className="boton boton-principal" disabled={ocupado || !h.horas.trim()}>Cargar</button>
          </form>
          <p className="texto-tenue text-sm">Si cargás horas en el mes, mandan sobre los minutos de las clases (sirve cuando el profe estuvo más tiempo que sus clases).</p>
          <ListaHoras detalle={detalle} correr={correr} />
        </div>
      )}

      {panel === "pagar" && (
        <div className="space-y-3 border-t border-[var(--borde)] pt-4" data-panel-pagar>
          <form className="grid sm:grid-cols-4 gap-3 items-end" onSubmit={(e) => { e.preventDefault(); correr(() => pagarProfe({ profeId: p.profe_id, mes, monto: pago.monto, medio: pago.medio, nota: pago.nota, turnoId, clave: clave.current }), "Pago registrado.", () => { clave.current = crypto.randomUUID(); setPanel(null); }); }}>
            <label className="space-y-1"><span className="etiqueta">Monto ($)</span><input className="campo" inputMode="decimal" name="monto" value={pago.monto} onChange={(e) => setPago({ ...pago, monto: e.target.value })} /></label>
            <label className="space-y-1"><span className="etiqueta">Cómo</span>
              <select className="campo" name="medio" value={pago.medio} onChange={(e) => setPago({ ...pago, medio: e.target.value })}>{Object.entries(MEDIO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="space-y-1"><span className="etiqueta">Nota (alias, comprobante…)</span><input className="campo" name="nota" maxLength={120} value={pago.nota} onChange={(e) => setPago({ ...pago, nota: e.target.value })} /></label>
            <button type="submit" className="boton boton-principal" disabled={ocupado || !pago.monto.trim() || (pago.medio === "efectivo" && !turnoId)}>Registrar el pago</button>
          </form>
          {pago.medio === "efectivo" && (turnoId
            ? <p className="texto-tenue text-sm">En efectivo, la plata sale de tu caja abierta y queda anotada como retiro.</p>
            : <Mensaje tipo="aviso">Para pagar en efectivo abrí tu turno de caja: la plata sale de ahí. <a className="underline" href="/panel/caja">Ir a Caja</a></Mensaje>)}
          <ListaPagos detalle={detalle} turnoId={turnoId} correr={correr} />
        </div>
      )}

      {panel === "detalle" && (
        <div className="space-y-3 border-t border-[var(--borde)] pt-4" data-panel-detalle>
          {!detalle ? <p className="texto-suave">Cargando…</p> : (
            <>
              {detalle.clases.length === 0 ? <p className="texto-suave">No dio clases este mes.</p> : (
                <table className="w-full text-sm">
                  <thead><tr className="texto-suave text-left"><th className="py-1 pr-2">Día</th><th className="pr-2">Clase</th><th className="pr-2 text-right">Presentes</th><th className="text-right">Suma</th></tr></thead>
                  <tbody>{detalle.clases.map((c) => (
                    <tr key={c.clase_id} className="border-t border-[var(--borde)]"><td className="py-1 pr-2">{dia(c.dia)}</td><td className="pr-2">{c.actividad} <span className="texto-tenue">· {c.minutos} min</span></td><td className="pr-2 text-right">{c.presentes}</td><td className="text-right numero">{c.modo ? formatearPesos(c.importe) : "—"}</td></tr>
                  ))}</tbody>
                </table>
              )}
              <ListaHoras detalle={detalle} correr={correr} soloVer />
              <ListaPagos detalle={detalle} turnoId={turnoId} correr={correr} soloVer />
            </>
          )}
        </div>
      )}
    </li>
  );
}

function Dato({ t, v, fuerte, clave }: { t: string; v: string; fuerte?: boolean; clave?: string }) {
  return <div><dt className="texto-suave text-xs">{t}</dt><dd className={`numero ${fuerte ? "text-xl" : "text-lg"}`} data-dato={clave}>{v}</dd></div>;
}

type Correr = (f: () => Promise<{ error?: string }>, msg: string, despues?: () => void) => void;

function ListaHoras({ detalle, correr, soloVer }: { detalle: Detalle | null; correr: Correr; soloVer?: boolean }) {
  if (!detalle || detalle.horas.length === 0) return null;
  return (
    <div><p className="etiqueta mb-1">Horas cargadas</p>
      <ul className="space-y-1 text-sm">{detalle.horas.map((x) => (
        <li key={x.id} className="flex flex-wrap items-center gap-2"><span>{dia(x.fecha)} · {horas(x.minutos / 60)}{x.nota ? ` · ${x.nota}` : ""}</span>
          {!soloVer && <AnularConMotivo pregunta="¿Por qué las anulás?" onAnular={(m) => correr(() => anularHoras(x.id, m), "Horas anuladas.")} />}</li>
      ))}</ul></div>
  );
}

function ListaPagos({ detalle, turnoId, correr, soloVer }: { detalle: Detalle | null; turnoId: string | null; correr: Correr; soloVer?: boolean }) {
  if (!detalle || detalle.pagos.length === 0) return null;
  return (
    <div><p className="etiqueta mb-1">Pagos</p>
      <ul className="space-y-1 text-sm">{detalle.pagos.map((x) => (
        <li key={x.id} className="flex flex-wrap items-center gap-2" data-pago={x.anulado_en ? "anulado" : "vigente"}>
          <span className={x.anulado_en ? "line-through texto-tenue" : ""}>{fechaHumana(x.pagado_en)} · {formatearPesos(x.monto)} · {MEDIO[x.medio]} · {x.pagado_por}{x.nota ? ` · ${x.nota}` : ""}</span>
          {x.anulado_en ? <span className="texto-tenue">anulado: {x.anulado_motivo}</span> : !soloVer && (
            <AnularConMotivo pregunta="¿Por qué anulás este pago?" onAnular={(m) => correr(() => anularPago(x.id, m, turnoId), "Pago anulado.")} />)}
        </li>
      ))}</ul></div>
  );
}

/** "Anular" pide el motivo ahí mismo (sin el cuadro del navegador, que frena todo). */
function AnularConMotivo({ pregunta, onAnular }: { pregunta: string; onAnular: (motivo: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  if (!abierto) return <button type="button" className="underline" onClick={() => setAbierto(true)} data-anular>Anular</button>;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <input className="campo !min-h-9 !py-1" aria-label={pregunta} placeholder={pregunta} maxLength={120} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      <button type="button" className="boton boton-chico boton-peligro" disabled={!motivo.trim()} onClick={() => { onAnular(motivo.trim()); setAbierto(false); setMotivo(""); }}>Anular</button>
      <button type="button" className="boton-texto texto-suave" onClick={() => setAbierto(false)}>No</button>
    </span>
  );
}
