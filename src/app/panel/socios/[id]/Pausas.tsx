"use client";
// Pausas (D7): el dueño o el encargado pausan la membresía; la recepción la
// pide y la aprueban ellos. Los días pagos se devuelven solos (lo hace la base).
import { useState, useTransition } from "react";
import { AvisoSalud } from "@/components/ui/AvisoSalud";
import { detectarSalud } from "@/lib/salud";
import { anularPausa, darPausa, pedirPausa, resolverPedidoPausa, volvioAntes } from "../acciones";
import { Icono } from "@/components/ui/Icono";

type Pausa = { id: string; desde: string; vuelve: string; categoria: string; nota: string | null; estado: "programada" | "en_curso" | "terminada" | "anulada" };
type Pedido = { id: string; desde: string; vuelve: string; categoria: string; nota: string | null; pedido_por: string | null };
export type DatosPausas = { maximo: number; usados: number; anio: number; hoy: string; suscripcion_id: string | null; puede_dar: boolean; pausas: Pausa[]; pedidos: Pedido[] };

const MOTIVOS: [string, string][] = [["viaje", "Viaje"], ["trabajo", "Trabajo"], ["estudio", "Estudio"], ["otro", "Otro"]];
const MOTIVO: Record<string, string> = { ...Object.fromEntries(MOTIVOS), personal: "Personal", economico: "Económico" };
const ESTADO: Record<Pausa["estado"], string> = { programada: "Programada", en_curso: "En pausa", terminada: "✓ Terminó", anulada: "Anulada" };
const dia = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}`;
const sumar = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const dias = (desde: string, vuelve: string) => Math.round((Date.parse(vuelve) - Date.parse(desde)) / 864e5);

export function Pausas({ socioId, datos: p }: { socioId: string; datos: DatosPausas }) {
  const [abierto, setAbierto] = useState(false);
  const [desde, setDesde] = useState(p.hoy);
  const [vuelve, setVuelve] = useState(sumar(p.hoy, 7));
  const [motivo, setMotivo] = useState("viaje");
  const [nota, setNota] = useState("");
  const [anulando, setAnulando] = useState<string | null>(null);
  const [porque, setPorque] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const n = desde && vuelve ? dias(desde, vuelve) : 0;
  const quedan = Math.max(0, p.maximo - p.usados);

  const correr = (fn: () => Promise<{ error?: string }>, listo?: string) => empezar(async () => {
    const r = await fn();
    if (r.error) { setError(r.error); setAviso(null); return; }
    setError(null); setAviso(listo ?? null); setAbierto(false); setAnulando(null); setPorque(""); setNota("");
  });

  if (!p.suscripcion_id && p.pausas.length === 0 && p.pedidos.length === 0) return null;
  return (
    <div id="pausa" className="tarjeta p-6 sm:col-span-2 space-y-4 min-w-0 scroll-mt-6" data-pausas={p.pausas.filter((x) => x.estado !== "anulada").length} data-pedidos={p.pedidos.length}>
      <div>
        <p className="titulo text-2xl"><Icono nombre="pausa" /> Pausas</p>
        <p className="texto-suave mt-1">
          {p.maximo === 0 ? "Este gimnasio no da pausas (se cambia en Configuración → Reglas)."
            : `Usó ${p.usados} de ${p.maximo} días en ${p.anio}. Mientras está en pausa no entra, y los días que pagó se le corren para después.`}
        </p>
      </div>

      {p.pedidos.length > 0 && (
        <ul className="space-y-2">
          {p.pedidos.map((x) => (
            <li key={x.id} className="rounded-2xl border border-[var(--borde)] p-4 space-y-2" data-pedido>
              <p><span className="font-semibold"><Icono nombre="reloj-arena" /> Pedido de pausa</span>{x.pedido_por ? ` · lo pidió ${x.pedido_por}` : ""}</p>
              <p className="texto-suave">Del {dia(x.desde)}, vuelve el {dia(x.vuelve)} ({dias(x.desde, x.vuelve)} días) · {MOTIVO[x.categoria] ?? x.categoria}{x.nota ? ` · ${x.nota}` : ""}</p>
              {p.puede_dar
                ? <div className="flex flex-wrap gap-2">
                    <button type="button" className="boton boton-principal" disabled={ocupado} onClick={() => correr(() => resolverPedidoPausa(socioId, x.id, true), "Pausa aprobada.")}>✓ Aprobar</button>
                    <button type="button" className="boton" disabled={ocupado} onClick={() => correr(() => resolverPedidoPausa(socioId, x.id, false), "Pedido rechazado.")}>Rechazar</button>
                  </div>
                : <p className="text-sm texto-tenue">Esperando que la apruebe el dueño o el encargado.</p>}
            </li>
          ))}
        </ul>
      )}

      {p.pausas.length > 0 && (
        <ul className="divide-y divide-[var(--borde)]">
          {p.pausas.slice(0, 6).map((x) => (
            <li key={x.id} className={`py-3 space-y-2 ${x.estado === "anulada" ? "opacity-60" : ""}`} data-pausa={x.estado}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold">{ESTADO[x.estado]}</span>
                <span className="texto-suave min-w-0 flex-1 basis-48">Del {dia(x.desde)}, vuelve el {dia(x.vuelve)} · {MOTIVO[x.categoria] ?? x.categoria}{x.nota ? ` · ${x.nota}` : ""}</span>
                {x.estado === "en_curso" && <button type="button" className="boton" disabled={ocupado} onClick={() => correr(() => volvioAntes(socioId, x.id), "Listo: desde hoy ya entra.")}><Icono nombre="pesa" /> Volvió antes</button>}
                {x.estado === "programada" && p.puede_dar && anulando !== x.id && <button type="button" className="boton texto-suave" disabled={ocupado} onClick={() => setAnulando(x.id)}>Anular</button>}
              </div>
              {anulando === x.id && (
                <div className="flex flex-wrap gap-2">
                  <input className="campo flex-1 basis-48" value={porque} onChange={(e) => setPorque(e.target.value)} placeholder="¿Por qué se anula?" aria-label="Por qué se anula la pausa" />
                  <AvisoSalud texto={porque} />
                  <button type="button" className="boton" disabled={ocupado || !porque.trim() || !!detectarSalud(porque)} onClick={() => correr(() => anularPausa(socioId, x.id, porque), "Pausa anulada.")}>Anular la pausa</button>
                  <button type="button" className="boton texto-suave" onClick={() => setAnulando(null)}>Cancelar</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {p.suscripcion_id && p.maximo > 0 && (abierto ? (
        <form className="space-y-3" data-form-pausa onSubmit={(e) => { e.preventDefault();
          const accion = p.puede_dar ? darPausa : pedirPausa;
          correr(() => accion(socioId, p.suscripcion_id!, desde, vuelve, motivo, nota), p.puede_dar ? "Pausa cargada." : "Pedido enviado: lo aprueba el dueño o el encargado."); }}>
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="space-y-1"><span className="text-sm texto-suave">Desde</span>
              <input type="date" className="campo" value={desde} onChange={(e) => setDesde(e.target.value)} required aria-label="Desde" /></label>
            <label className="space-y-1"><span className="text-sm texto-suave">Vuelve el</span>
              <input type="date" className="campo" value={vuelve} min={desde ? sumar(desde, 1) : undefined} onChange={(e) => setVuelve(e.target.value)} required aria-label="Vuelve el" /></label>
            <label className="space-y-1"><span className="text-sm texto-suave">Motivo</span>
              <select className="campo" value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-label="Motivo">
                {MOTIVOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select></label>
          </div>
          <input className="campo" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300} placeholder="Nota (opcional): a dónde va, cuándo avisó…" aria-label="Nota de la pausa" />
          <AvisoSalud texto={nota} />
          <p className={`text-sm ${n > quedan ? "text-[var(--rojo)]" : "texto-tenue"}`} data-dias-pausa={n}>
            {n > 0 ? `Son ${n} ${n === 1 ? "día" : "días"}. Le ${quedan === 1 ? "queda" : "quedan"} ${quedan} este año.` : "El día que vuelve tiene que ser después del primero."}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="boton boton-principal" disabled={ocupado || n <= 0 || !!detectarSalud(nota)}>
              {ocupado ? "Guardando…" : p.puede_dar ? `Pausar ${n > 0 ? `${n} días` : ""}` : `Pedir pausa${n > 0 ? ` de ${n} días` : ""}`}
            </button>
            <button type="button" className="boton" onClick={() => { setAbierto(false); setError(null); }}>Cancelar</button>
          </div>
        </form>
      ) : (
        <button type="button" className="boton" onClick={() => { setAbierto(true); setAviso(null); }}>{p.puede_dar ? "Pausar la membresía" : "Pedir una pausa"}</button>
      ))}
      {error && <p role="alert" className="pildora pildora-rojo whitespace-normal"><Icono nombre="alerta" /> {error}</p>}
      {aviso && <p role="status" className="pildora pildora-verde whitespace-normal">✓ {aviso}</p>}
    </div>
  );
}
