import type { Metadata } from "next";
import Link from "next/link";
import { MEDIO } from "@/lib/caja";
import { formatearPesos } from "@/lib/formato";
import { miSocio } from "@/lib/app/socio";
import { intentar } from "@/lib/panel/intentar";
import { rpc } from "@/lib/panel/servidor";
import { Icono } from "@/components/ui/Icono";

export const metadata: Metadata = { title: "Mi historial" };
type Historial = {
  pagos: { fecha: string; monto: number; medio: string; estado: string; detalle: string | null; motivo: string | null; venta_id?: string; recibo?: boolean }[];
  entradas: { momento: string; tipo: "entrada" | "clase"; actividad: string | null }[];
};
const ESTADO: Record<string, string> = { aprobado: "ok", pendiente: "revisando", rechazado: "rechazado" };

/** APP-3: lo que pagó y cuándo vino. */
export default async function HistorialSocio({ searchParams }: { searchParams: Promise<{ socio?: string }> }) {
  const pedido = (await searchParams).socio;
  return intentar(async () => {
    const { yo } = await miSocio(pedido);
    if (yo.elegir || !yo.socio) return <p className="texto-suave">Elegí primero <Link href="/app" className="underline">qué socio sos</Link>.</p>;
    const h = await rpc<Historial>("mi_historial", { p_socio_id: yo.socio.socio_id });
    const zona = yo.zona!;
    const q = yo.socios.length > 1 ? `?socio=${yo.socio.socio_id}` : "";
    const dia = (m: string, conHora = false) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, weekday: "short", day: "numeric", month: "numeric", ...(conHora ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const } : {}) }).format(new Date(m));
    return (
      <div className="space-y-8">
        <Link href={`/app${q}`} className="texto-suave">← Volver</Link>
        <h1 className="titular text-5xl"><Icono nombre="recibo" /> Mi historial</h1>
        <section aria-labelledby="pagos" data-historial-pagos>
          <h2 id="pagos" className="titulo text-2xl mb-3">Pagos</h2>
          {h.pagos.length === 0 ? <p className="texto-suave">Todavía no hay pagos.</p> : (
            <ul className="tarjeta divide-y divide-[var(--borde)]">{h.pagos.map((p, i) => (
              <li key={i} className="px-4 py-3">
                <div className="flex justify-between gap-3"><span className="first-letter:uppercase">{dia(p.fecha)} · {p.detalle ?? "Pago"}</span><span className="numero">{formatearPesos(p.monto)}</span></div>
                <p className="text-sm texto-suave">{MEDIO[p.medio] ?? p.medio} · {ESTADO[p.estado] ?? p.estado}{p.motivo ? `: ${p.motivo}` : ""}</p>
                {p.recibo && p.venta_id && <Link href={`/app/recibo/${p.venta_id}${q}`} className="text-sm underline" data-ver-recibo><Icono nombre="recibo" /> Ver recibo</Link>}
              </li>
            ))}</ul>
          )}
        </section>
        <section aria-labelledby="vino" data-historial-entradas>
          <h2 id="vino" className="titulo text-2xl mb-3">Cuándo viniste</h2>
          {h.entradas.length === 0 ? <p className="texto-suave">Todavía no hay entradas registradas.</p> : (
            <ul className="space-y-1">{h.entradas.map((e, i) => (
              <li key={i} className="texto-suave first-letter:uppercase">{dia(e.momento, true)} · {e.tipo === "clase" ? `${e.actividad}` : <><Icono nombre="puerta" /> Entrada</>}</li>
            ))}</ul>
          )}
        </section>
      </div>
    );
  });
}
