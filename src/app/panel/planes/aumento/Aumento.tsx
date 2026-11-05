"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { formatearPesos } from "@/lib/formato";
import { aplicarAumento, vistaAumento, type Aumento as Datos, type VistaAumento } from "../acciones";
import type { Plan } from "../Editor";
import { MEDIO } from "../Precios";

const REDONDEOS = [1, 10, 50, 100, 500, 1000];

export function Aumento({ planes, hoy, sugerido, zona, gimnasio }: { planes: Plan[]; hoy: string; sugerido: string; zona: string; gimnasio: string }) {
  const [datos, setDatos] = useState<Datos>({ planes: planes.filter((p) => p.precio != null).map((p) => p.plan_id), tipo: "porcentaje", valor: "", redondeo: 100, desde: sugerido });
  const [vista, setVista] = useState<VistaAumento | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<{ n: number; vista: VistaAumento } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [ocupado, empezar] = useTransition();
  const fecha = (d: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "numeric", month: "long" }).format(new Date(d));

  // Vista previa a medida que se escribe (la cuenta es de la base, la misma que guarda).
  useEffect(() => {
    if (!datos.valor.trim() || !datos.planes.length) { setVista(null); setError(null); return; }
    const t = setTimeout(async () => { const r = await vistaAumento(datos); setError(r.error ?? null); setVista(r.vista ?? null); }, 300);
    return () => clearTimeout(t);
  }, [datos]);

  const tildar = (id: string) => setDatos({ ...datos, planes: datos.planes.includes(id) ? datos.planes.filter((x) => x !== id) : [...datos.planes, id] });
  const conProblema = vista?.planes.some((p) => p.problema);
  const aviso = (v: VistaAumento) => [
    `Hola! Te contamos que desde el ${fecha(v.desde)} actualizamos los precios en ${gimnasio}:`,
    ...v.planes.map((p) => `• ${p.nombre}: ${formatearPesos(p.nuevo)}${p.variantes.length ? ` (${p.variantes.map((x) => `${x.medio ? MEDIO[x.medio]?.replace(/^\S+ /, "").toLowerCase() : ""}${x.medio && x.hasta_dia ? " " : ""}${x.hasta_dia ? `pagando hasta el ${x.hasta_dia}` : ""} ${formatearPesos(x.monto)}`).join(", ")})` : ""}`),
    "Si pagás antes de esa fecha, se mantiene el precio actual. ¡Gracias por entrenar con nosotros!",
  ].join("\n");

  if (hecho) {
    const texto = aviso(hecho.vista);
    return (
      <div className="space-y-5" data-aumento-hecho>
        <p role="status" className="tarjeta p-5 text-lg font-semibold">✅ Aumento programado en {hecho.n} {hecho.n === 1 ? "plan" : "planes"} desde el {fecha(hecho.vista.desde)}.</p>
        <section className="space-y-2">
          <h2 className="titulo text-2xl">📣 Avisales a tus socios</h2>
          <p className="texto-suave">Para mandar por WhatsApp a tu lista de difusión o pegar en el grupo:</p>
          <pre className="tarjeta p-4 whitespace-pre-wrap text-sm" data-aviso>{texto}</pre>
          <button type="button" className="boton" onClick={async () => { try { await navigator.clipboard.writeText(texto); setCopiado(true); } catch { setCopiado(false); } }}>{copiado ? "✓ Copiado" : "📋 Copiar el aviso"}</button>
        </section>
        <Link href="/panel/planes" className="boton boton-principal">← Volver a Planes</Link>
      </div>
    );
  }

  return (
    <form className="space-y-8" onSubmit={(e) => {
      e.preventDefault();
      empezar(async () => { const r = await aplicarAumento(datos); setError(r.error ?? null); if (!r.error && vista) setHecho({ n: r.n ?? 0, vista }); });
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

      {error && <p role="alert" className="pildora pildora-rojo">⚠️ {error}</p>}
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
                {p.despues && <p className="text-sm" style={{ color: "var(--acento)" }}>📅 Ya tiene otro precio programado desde el {fecha(p.despues)}: ese va a regir después.</p>}
                {p.problema && <p className="pildora pildora-rojo mt-2">⚠️ {p.problema}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
      <button type="submit" className="boton boton-principal" disabled={!vista || conProblema || ocupado}>📈 Programar aumento</button>
    </form>
  );
}
