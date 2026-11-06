import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/panel/Marco";
import { SelectorSede } from "@/components/panel/SelectorSede";
import { Vacio } from "@/components/ui/Vacio";
import { linkCompartir, textoCierre } from "@/lib/caja";
import { formatearPesos } from "@/lib/formato";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { sedeActiva } from "@/lib/panel/sede";

export const metadata: Metadata = { title: "Turnos de caja" };

type Turno = {
  turno_id: string; caja: string; abierto_en: string; cerrado_en: string | null; abierto_por: string | null; cerrado_por: string | null;
  monto_inicial: number; efectivo: number; ingresos: number; retiros: number; esperado: number; contado: number | null; diferencia: number | null;
  otros_medios: Record<string, number>; nota: string | null; ventas: number; anuladas: number; estado?: string;
  movimientos: { tipo: "ingreso" | "retiro"; monto: number; motivo: string; en: string; por: string | null }[];
};
const MEDIO: Record<string, string> = { transferencia: "🏦 Transferencia", debito: "💳 Débito", credito: "💳 Crédito", mercadopago: "📲 MercadoPago", cuenta_corriente: "📒 A cuenta" };

/** CAJ-1: cada turno con quién abrió y cerró, lo esperado contra lo contado y los retiros. */
export default async function HistorialCaja({ searchParams }: { searchParams: Promise<{ sede?: string }> }) {
  const sp = await searchParams;
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "caja");
    exigirRol(panel, ["dueno", "encargado"]);
    const { sede, puedeCambiar } = sedeActiva(panel, sp.sede);
    const turnos = await rpc<Turno[]>("historial_caja", { p_sede_id: sede.id, p_limite: 60 });
    const zona = panel.gimnasio.zona_horaria;
    const cuando = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
    const hora = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
    return (
      <>
        <Encabezado emoji="🗂️" titulo="Turnos de caja" volver={{ href: "/panel/caja", texto: "Caja" }}
          bajada="Quién abrió y cerró, cuánto tenía que haber, cuánto se contó y qué entró o salió del cajón." />
        {puedeCambiar && <SelectorSede sedes={panel.sedes} actual={sede.id} ruta="/panel/caja/historial" />}
        {turnos.length === 0 ? <Vacio emoji="🗂️" titulo="Todavía no hubo turnos">Cuando se abra y se cierre la caja, cada turno queda acá.</Vacio> : (
          <ul className="space-y-3" data-turnos>
            {turnos.map((t) => {
              const dif = t.diferencia ?? 0;
              const otros = Object.entries(t.otros_medios ?? {});
              return (
                <li key={t.turno_id} className="tarjeta p-5" data-turno={t.turno_id} data-diferencia={t.diferencia ?? ""}>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <p className="font-semibold text-lg flex-1 min-w-0">{t.caja} · {cuando(t.abierto_en)}{t.cerrado_en ? ` a ${hora(t.cerrado_en)}` : ""}</p>
                    {t.estado === "sin_contar" || t.estado === "sin_contar_dejada"
                      ? <span className="pildora pildora-amarillo" data-sin-contar>🧾 Sin contar</span>
                      : t.cerrado_en
                      ? <span className={`pildora ${dif === 0 ? "pildora-verde" : dif > 0 ? "pildora-amarillo" : "pildora-rojo"}`}>{dif === 0 ? "✅ Justa" : dif > 0 ? `Sobraron ${formatearPesos(dif)}` : `Faltaron ${formatearPesos(-dif)}`}</span>
                      : <span className="pildora pildora-azul">🔓 Abierta</span>}
                  </div>
                  <p className="texto-suave text-sm">Abrió {t.abierto_por ?? "—"}{t.cerrado_por ? ` · cerró ${t.cerrado_por}` : ""} · {t.ventas} {t.ventas === 1 ? "venta" : "ventas"}{t.anuladas ? ` (${t.anuladas} anulada${t.anuladas === 1 ? "" : "s"})` : ""}</p>
                  <dl className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3">
                    <div><dt className="texto-tenue text-xs">Inicial</dt><dd className="numero text-lg">{formatearPesos(t.monto_inicial)}</dd></div>
                    <div><dt className="texto-tenue text-xs">💵 Efectivo cobrado</dt><dd className="numero text-lg">{formatearPesos(t.efectivo)}</dd></div>
                    <div><dt className="texto-tenue text-xs">Ingresos − retiros</dt><dd className="numero text-lg">{formatearPesos(t.ingresos - t.retiros)}</dd></div>
                    <div><dt className="texto-tenue text-xs">Tenía que haber</dt><dd className="numero text-lg">{formatearPesos(t.esperado)}</dd></div>
                    <div><dt className="texto-tenue text-xs">Contado</dt><dd className="numero text-lg">{t.contado == null ? "—" : formatearPesos(t.contado)}</dd></div>
                  </dl>
                  {otros.length > 0 && <p className="texto-suave text-sm mt-2">Además: {otros.map(([m, v]) => `${MEDIO[m] ?? m} ${formatearPesos(v)}`).join(" · ")}</p>}
                  {t.movimientos.length > 0 && (
                    <ul className="mt-3 space-y-1 text-sm">
                      {t.movimientos.map((m, i) => (
                        <li key={i}>{m.tipo === "retiro" ? "➖" : "➕"} {formatearPesos(m.monto)} · {m.motivo} <span className="texto-tenue">({hora(m.en)}{m.por ? `, ${m.por}` : ""})</span></li>
                      ))}
                    </ul>
                  )}
                  {t.nota && <p className="text-sm mt-2">📝 {t.nota}</p>}
                  <Link className="boton boton-chico mt-3 mr-2" href={`/panel/caja/reporte?turno=${t.turno_id}`}>📋 Reporte</Link>
                  {t.cerrado_en && (
                    <a className="boton boton-chico mt-3" target="_blank" rel="noopener noreferrer" data-compartir-cierre
                      href={linkCompartir(textoCierre({ ...t, abrio: t.abierto_por, cerro: t.cerrado_por, cuando: `${cuando(t.abierto_en)} a ${hora(t.cerrado_en)}` }))}>📲 Compartir</a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </>
    );
  });
}
