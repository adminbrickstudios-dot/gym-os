"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { formatearPesos } from "@/lib/formato";
import { aplicarAumento, avisoPrevioAumento, guardarAvisoDias, vistaAumento, type AumentoHecho, type AvisoPrevio, type Aumento as Datos, type VistaAumento } from "../acciones";
import type { Plan } from "../Editor";
import { MEDIO } from "../Precios";
import { Icono } from "@/components/ui/Icono";

const REDONDEOS = [1, 10, 50, 100, 500, 1000];

const diaTxt = (d: string) => new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${d.slice(0, 10)}T00:00:00Z`));

export function Aumento({ planes, hoy, sugerido, zona, gimnasio, avisoDias, esDueno, hechos }: { planes: Plan[]; hoy: string; sugerido: string; zona: string; gimnasio: string; avisoDias: number; esDueno: boolean; hechos: AumentoHecho[] }) {
  const [datos, setDatos] = useState<Datos>({ planes: planes.filter((p) => p.precio != null).map((p) => p.plan_id), tipo: "porcentaje", valor: "", redondeo: 100, desde: sugerido });
  const [vista, setVista] = useState<VistaAumento | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<{ n: number; vista: VistaAumento; avisados: number } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [ocupado, empezar] = useTransition();
  const [previo, setPrevio] = useState<AvisoPrevio | null>(null);
  const [dias, setDias] = useState(String(avisoDias));
  const [diasMsg, setDiasMsg] = useState<string | null>(null);
  const fecha = (d: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "numeric", month: "long" }).format(new Date(d));

  // Vista previa a medida que se escribe (la cuenta es de la base, la misma que guarda).
  useEffect(() => {
    if (!datos.valor.trim() || !datos.planes.length) { setVista(null); setError(null); return; }
    let vivo = true;   // si se sale de la pantalla con el pedido a medias, no se actualiza nada ni queda un error en la consola
    const t = setTimeout(async () => { try { const r = await vistaAumento(datos); if (vivo) { setError(r.error ?? null); setVista(r.vista ?? null); } } catch { /* navegó: el pedido se cortó */ } }, 300);
    return () => { vivo = false; clearTimeout(t); };
  }, [datos]);

  // VD-46D: cuántos días de aviso lleva y a cuántos socios les llega (lo cuenta la base).
  useEffect(() => {
    if (!datos.planes.length) { setPrevio(null); return; }
    let vivo = true;
    const t = setTimeout(async () => { try { const r = await avisoPrevioAumento(datos.planes, datos.desde); if (vivo) setPrevio(r.aviso ?? null); } catch { /* navegó: el pedido se cortó */ } }, 200);
    return () => { vivo = false; clearTimeout(t); };
  }, [datos.planes, datos.desde, avisoDias]);

  const tildar = (id: string) => setDatos({ ...datos, planes: datos.planes.includes(id) ? datos.planes.filter((x) => x !== id) : [...datos.planes, id] });
  const conProblema = vista?.planes.some((p) => p.problema);
  const motivoOk = (datos.motivo ?? "").trim().length >= 10;
  const sinAviso = !!previo && !previo.cumple;
  const bloqueado = !previo || (sinAviso && !(previo.puede_excepcion && motivoOk));
  const aviso = (v: VistaAumento) => [
    `Hola! Te contamos que desde el ${fecha(v.desde)} actualizamos los precios en ${gimnasio}:`,
    ...v.planes.map((p) => `• ${p.nombre}: ${formatearPesos(p.nuevo)}${p.variantes.length ? ` (${p.variantes.map((x) => `${x.medio ? MEDIO[x.medio]?.replace(/^\S+ /, "").toLowerCase() : ""}${x.medio && x.hasta_dia ? " " : ""}${x.hasta_dia ? `pagando hasta el ${x.hasta_dia}` : ""} ${formatearPesos(x.monto)}`).join(", ")})` : ""}`),
    "Si pagás antes de esa fecha, se mantiene el precio actual. ¡Gracias por entrenar con nosotros!",
  ].join("\n");

  if (hecho) {
    const texto = aviso(hecho.vista);
    return (
      <div className="space-y-5" data-aumento-hecho>
        <p role="status" className="tarjeta p-5 text-lg font-semibold"><Icono nombre="ok" /> Aumento programado en {hecho.n} {hecho.n === 1 ? "plan" : "planes"} desde el {fecha(hecho.vista.desde)}.</p>
        <p className="tarjeta p-4" data-constancia><Icono nombre="recibo" /> {hecho.avisados === 0 ? "No hay socios con membresía activa en esos planes: no hizo falta avisar." : `Quedó la constancia: le avisamos en su app a ${hecho.avisados} ${hecho.avisados === 1 ? "socio" : "socios"}.`}</p>
        <section className="space-y-2">
          <h2 className="titulo text-2xl"><Icono nombre="campana" /> Avisales a tus socios</h2>
          <p className="texto-suave">Para mandar por WhatsApp a tu lista de difusión o pegar en el grupo:</p>
          <pre className="tarjeta p-4 whitespace-pre-wrap text-sm" data-aviso>{texto}</pre>
          <button type="button" className="boton" onClick={async () => { try { await navigator.clipboard.writeText(texto); setCopiado(true); } catch { setCopiado(false); } }}>{copiado ? <><Icono nombre="ok" /> Copiado</> : "Copiar el aviso"}</button>
        </section>
        <Link href="/panel/planes" className="boton boton-principal">← Volver a Planes</Link>
      </div>
    );
  }

  return (
    <form className="space-y-8" onSubmit={(e) => {
      e.preventDefault();
      empezar(async () => { const r = await aplicarAumento(datos); setError(r.error ?? null); if (!r.error && vista) setHecho({ n: r.n ?? 0, vista, avisados: previo?.socios_a_avisar ?? 0 }); });
    }}>
      <fieldset className="space-y-2">
        <legend className="etiqueta mb-2">¿Qué planes?</legend>
        {planes.length === 0 && <p className="texto-tenue">No hay planes a la venta. <Link href="/panel/planes" className="underline">Creá uno</Link>.</p>}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {planes.map((p) => (
            <label key={p.plan_id} className={`fila cursor-pointer ${datos.planes.includes(p.plan_id) ? "!border-[var(--acento)]" : ""}`}>
              <input type="checkbox" className="w-5 h-5 shrink-0" checked={datos.planes.includes(p.plan_id)} onChange={() => tildar(p.plan_id)} aria-label={p.nombre} />
              <span className="flex-1 min-w-0 font-semibold">{p.nombre}</span>
              <span className="numero">{p.precio != null ? formatearPesos(p.precio) : "Sin precio"}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid sm:grid-cols-3 gap-4">
        <fieldset className="space-y-2">
          <legend className="etiqueta mb-2">¿Cuánto?</legend>
          <div className="flex gap-2">
            {(["porcentaje", "monto"] as const).map((t) => (
              <label key={t} className={`boton !min-h-11 cursor-pointer ${datos.tipo === t ? "!border-[var(--acento)]" : ""}`}>
                <input type="radio" name="tipo" className="sr-only" checked={datos.tipo === t} onChange={() => setDatos({ ...datos, tipo: t })} />{t === "porcentaje" ? "%" : "$ fijo"}
              </label>
            ))}
          </div>
          <input className="campo" inputMode="decimal" aria-label="Cuánto aumenta" placeholder={datos.tipo === "porcentaje" ? "Ej: 10" : "Ej: 3.000"} value={datos.valor} onChange={(e) => setDatos({ ...datos, valor: e.target.value })} />
        </fieldset>
        <label className="space-y-2 block"><span className="etiqueta">Redondear a</span>
          <select className="campo" aria-label="Redondear a" value={datos.redondeo} onChange={(e) => setDatos({ ...datos, redondeo: Number(e.target.value) })}>
            {REDONDEOS.map((r) => <option key={r} value={r}>{r === 1 ? "No redondear" : formatearPesos(r)}</option>)}
          </select>
        </label>
        <label className="space-y-2 block"><span className="etiqueta">Desde</span>
          <input type="date" className="campo" aria-label="Desde" min={hoy} value={datos.desde} onChange={(e) => setDatos({ ...datos, desde: e.target.value })} />
        </label>
      </div>

      {previo && (
        <section className="tarjeta p-4 space-y-3" data-aviso-previo={previo.cumple ? "ok" : "falta"}>
          {previo.cumple ? (
            <p><Icono nombre="ok" /> <b>{previo.dias_de_aviso} días de aviso</b> (el mínimo son {previo.aviso_dias}). Les llega el aviso en la app a <b>{previo.socios_a_avisar}</b> {previo.socios_a_avisar === 1 ? "socio" : "socios"} y queda la constancia.</p>
          ) : (
            <>
              <p role="alert" className="pildora pildora-rojo !rounded-[var(--radio)] !px-4 !py-3 w-full"><Icono nombre="alerta" /> Con {previo.dias_de_aviso} {previo.dias_de_aviso === 1 ? "día" : "días"} de aviso no alcanza: hacen falta {previo.aviso_dias}. Avisar tarde es lo que termina en multas.</p>
              <button type="button" className="boton" onClick={() => setDatos({ ...datos, desde: previo.fecha_minima })}><Icono nombre="calendario" /> Poner el {diaTxt(previo.fecha_minima)}</button>
              {previo.puede_excepcion ? (
                <label className="block space-y-2"><span className="etiqueta">Si es urgente, aplicalo igual: ¿por qué? (queda registrado a tu nombre)</span>
                  <textarea className="campo" rows={2} maxLength={300} aria-label="Motivo para aplicar sin el aviso mínimo" value={datos.motivo ?? ""} onChange={(e) => setDatos({ ...datos, motivo: e.target.value })} />
                </label>
              ) : <p className="texto-suave text-sm">Si de verdad es urgente, lo tiene que aprobar el dueño.</p>}
            </>
          )}
        </section>
      )}
      {error && <p role="alert" className="pildora pildora-rojo"><Icono nombre="alerta" /> {error}</p>}
      {vista && (
        <section className="space-y-2" data-vista>
          <h2 className="titulo text-2xl">Así quedan desde el {fecha(vista.desde)}</h2>
          <ul className="space-y-2">
            {vista.planes.map((p) => (
              <li key={p.plan_id} className="tarjeta p-4" data-vista-plan={p.nombre}>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-semibold flex-1 min-w-0">{p.nombre}{p.socios ? <span className="texto-tenue font-normal text-sm"> · {p.socios} socios</span> : null}</span>
                  <span className="texto-tenue line-through">{formatearPesos(p.antes)}</span>
                  <span className="numero text-2xl">{p.nuevo != null ? formatearPesos(p.nuevo) : "—"}</span>
                </div>
                {p.variantes.map((v, i) => (
                  <p key={i} className="text-sm texto-suave">{v.medio ? MEDIO[v.medio] : ""}{v.medio && v.hasta_dia ? " · " : ""}{v.hasta_dia ? `hasta el día ${v.hasta_dia}` : ""}: <span className="line-through">{formatearPesos(v.antes)}</span> → {formatearPesos(v.monto)}</p>
                ))}
                {p.despues && <p className="text-sm" style={{ color: "var(--acento)" }}><Icono nombre="calendario" /> Ya tiene otro precio programado desde el {fecha(p.despues)}: ese va a regir después.</p>}
                {p.problema && <p className="pildora pildora-rojo mt-2"><Icono nombre="alerta" /> {p.problema}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
      <button type="submit" className="boton boton-principal" disabled={!vista || conProblema || ocupado || bloqueado}><Icono nombre="tendencia" /> Programar aumento</button>

      <section className="space-y-3 pt-4 border-t border-[var(--borde)]" data-config-aviso>
        <h2 className="titulo text-2xl">Aviso mínimo</h2>
        {esDueno ? (
          <div className="flex flex-wrap items-end gap-2">
            <label className="space-y-2 block"><span className="etiqueta">Días de aviso antes de un aumento (7 a 90)</span>
              <input className="campo !w-28" inputMode="numeric" aria-label="Días de aviso" value={dias} onChange={(e) => setDias(e.target.value)} /></label>
            <button type="button" className="boton" disabled={ocupado} onClick={() => empezar(async () => { const r = await guardarAvisoDias(dias); setDiasMsg(r.error ?? `Desde ahora, ${r.dias} días`); })}>Guardar</button>
            {diasMsg && <p role="status" className="texto-suave text-sm">{diasMsg}</p>}
          </div>
        ) : <p className="texto-suave">El gimnasio avisa con {avisoDias} días de anticipación. Lo cambia el dueño.</p>}
      </section>

      {hechos.length > 0 && (
        <section className="space-y-2" data-aumentos-hechos>
          <h2 className="titulo text-2xl">Aumentos anteriores</h2>
          <ul className="space-y-2">
            {hechos.map((h) => (
              <li key={h.id} className="tarjeta p-4 space-y-1" data-aumento-hecho-id={h.id}>
                <p className="font-semibold">{h.tipo === "porcentaje" ? `${h.valor}%` : formatearPesos(h.valor)} · {h.planes.join(", ")}</p>
                <p className="texto-suave text-sm">Desde el {fecha(h.vigente_desde)} · lo programó {h.por} el {fecha(h.creado_en)} con {h.aviso_dias_reales} días de aviso</p>
                <p className="text-sm"><Icono nombre="recibo" /> Avisados en la app: {h.avisados} · lo vieron: {h.vistos}</p>
                {h.excepcion_motivo && <p className="text-sm" style={{ color: "var(--acento)" }}>Sin el aviso mínimo ({h.aviso_dias_exigido} días). Motivo: {h.excepcion_motivo}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </form>
  );
}
