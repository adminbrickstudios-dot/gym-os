import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/panel/Marco";
import { Vacio } from "@/components/ui/Vacio";
import { formatearPesos } from "@/lib/formato";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, rpc } from "@/lib/panel/servidor";
import { NOMBRE_ROL, type Rol } from "@/lib/panel/secciones";

export const metadata: Metadata = { title: "Qué hizo cada uno" };

type Persona = { equipo_id: string; nombre: string; rol: Rol; ventas: number; vendido: number; descuentos: number; anulaciones: number;
  dejados_pasar: number; entradas: number; cierres: number; diferencia_caja: number };
type ParaMirar = { tipo: "descuento" | "anulacion" | "dejo_pasar" | "caja"; momento: string; quien: string; monto: number | null; detalle: string };
const TIPO: Record<ParaMirar["tipo"], string> = { descuento: "🏷️ Descuento", anulacion: "↩️ Anulación", dejo_pasar: "🚪 Dejó pasar", caja: "💵 Caja no cerró justa" };

/** EQU-3: qué hizo cada uno en el día (de los hechos; nada se guarda aparte). */
export default async function ActividadEquipo({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const sp = await searchParams;
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado"]);
    const zona = panel.gimnasio.zona_horaria;
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(new Date());
    const dia = /^\d{4}-\d{2}-\d{2}$/.test(sp.dia ?? "") && sp.dia! <= hoy ? sp.dia! : hoy;
    const a = await rpc<{ dia: string; personas: Persona[]; para_mirar: ParaMirar[] }>("actividad_equipo", { p_gimnasio_id: panel.gimnasio.id, p_dia: dia });
    const mover = (n: number) => { const d = new Date(`${dia}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
    const fecha = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${dia}T12:00:00Z`));
    const hora = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
    return (
      <>
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/panel/equipo" className="texto-suave">← Equipo</Link>
          {!panel.secciones_apagadas.includes("control") && <Link href="/panel/control" className="texto-suave underline" data-link-control>🛡️ Todo en una línea: Control</Link>}
        </p>
        <Encabezado emoji="📋" titulo="Qué hizo cada uno" bajada="Ventas, descuentos, anulaciones, dejados pasar y cierres de caja, por persona." />
        <nav className="flex flex-wrap items-center gap-2 mb-8" aria-label="Día">
          <Link href={`/panel/equipo/actividad?dia=${mover(-1)}`} className="boton !min-h-11">← Anterior</Link>
          <span className="titulo text-xl px-2 first-letter:uppercase" data-dia-actividad>{dia === hoy ? "Hoy" : fecha}</span>
          {dia < hoy && <Link href={`/panel/equipo/actividad?dia=${mover(1)}`} className="boton !min-h-11">Siguiente →</Link>}
        </nav>
        {a.personas.length === 0 ? <Vacio emoji="🌙" titulo="Nadie anotó nada este día">Cuando alguien venda, anote una entrada o cierre la caja, aparece acá.</Vacio> : (
          <div className="space-y-10">
            <ul className="grid sm:grid-cols-2 gap-3" data-personas-actividad>{a.personas.map((p) => (
              <li key={p.equipo_id} className="tarjeta p-5 space-y-2">
                <p className="titulo text-2xl">{p.nombre} <span className="texto-tenue text-base font-normal">{NOMBRE_ROL[p.rol]}</span></p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[15px]">
                  {p.ventas > 0 && <><dt className="texto-suave">🛒 Ventas</dt><dd className="numero text-right">{p.ventas} · {formatearPesos(p.vendido)}</dd></>}
                  {Number(p.descuentos) > 0 && <><dt className="texto-suave">🏷️ Descuentos</dt><dd className="numero text-right">{formatearPesos(p.descuentos)}</dd></>}
                  {p.anulaciones > 0 && <><dt className="texto-suave">↩️ Anuló</dt><dd className="numero text-right">{p.anulaciones}</dd></>}
                  {p.entradas > 0 && <><dt className="texto-suave">🚪 Entradas</dt><dd className="numero text-right">{p.entradas}{p.dejados_pasar ? ` · ${p.dejados_pasar} sin poder` : ""}</dd></>}
                  {p.cierres > 0 && <><dt className="texto-suave">💵 Cerró caja</dt><dd className="numero text-right">{p.cierres}{Number(p.diferencia_caja) ? ` · ${Number(p.diferencia_caja) > 0 ? "+" : ""}${formatearPesos(p.diferencia_caja)}` : " · justa"}</dd></>}
                </dl>
              </li>
            ))}</ul>
            {a.para_mirar.length > 0 && (
              <section>
                <h2 className="titulo text-2xl mb-3">👀 Para mirar</h2>
                <ul className="space-y-2" data-para-mirar>{a.para_mirar.map((m, i) => (
                  <li key={i} className="tarjeta flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="numero texto-suave w-12">{hora(m.momento)}</span>
                    <span className="min-w-0 flex-1"><span className="block font-semibold">{TIPO[m.tipo]} · {m.quien}</span><span className="block text-sm texto-suave">{m.detalle}</span></span>
                    {m.monto != null && <span className="numero">{formatearPesos(m.monto)}</span>}
                  </li>
                ))}</ul>
              </section>
            )}
          </div>
        )}
      </>
    );
  });
}
