import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/panel/Marco";
import { MEDIO } from "@/lib/caja";
import { formatearNumero, formatearPesos } from "@/lib/formato";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, rpc } from "@/lib/panel/servidor";
import { Icono } from "@/components/ui/Icono";

export const metadata: Metadata = { title: "Resumen" };

type Periodo = {
  cobrado: number; fiado: number; por_medio: { medio: string; total: number }[]; por_persona: { nombre: string; total: number; cobros: number }[];
  cajas_cerradas: number; diferencias: { caja: string; monto: number; por: string | null; en: string }[];
  retiros: { cantidad: number; total: number; lista: { monto: number; motivo: string; por: string | null; en: string }[] };
  descuentos: { cantidad: number; total: number; convenios: number }; anulaciones: { cantidad: number; total: number };
  dejados_pasar: number; entradas: number; socios_que_vinieron: number; rechazados: number; altas: number; bajas: number;
};
type Resumen = { desde: string; hasta: string; dias: number; actual: Periodo; anterior: Periodo };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const mover = (d: string, dias: number) => new Date(Date.parse(`${d}T12:00:00Z`) + dias * 86400000).toISOString().slice(0, 10);
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** AVI-6: el resumen del dueño, del día o de la semana. Lo calcula la base al abrirlo, comparado con el período anterior. */
export default async function ResumenDueno({ searchParams }: { searchParams: Promise<{ dia?: string; semana?: string }> }) {
  const sp = await searchParams;
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado"]);
    const zona = panel.gimnasio.zona_horaria;
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(new Date());
    const lunes = mover(hoy, -((new Date(`${hoy}T12:00:00Z`).getUTCDay() + 6) % 7));
    const semana = sp.semana && ISO.test(sp.semana) ? sp.semana : null;
    const dia = !semana && sp.dia && ISO.test(sp.dia) ? sp.dia : null;
    const [desde, dias] = semana ? [semana, 7] : [dia ?? hoy, 1];
    const r = await rpc<Resumen>("resumen_dueno", { p_gimnasio_id: panel.gimnasio.id, p_desde: desde, p_dias: dias });
    const a = r.actual, b = r.anterior;
    const opciones = [
      { texto: "Hoy", href: "/panel/resumen", activo: !semana && desde === hoy },
      { texto: "Ayer", href: `/panel/resumen?dia=${mover(hoy, -1)}`, activo: !semana && desde === mover(hoy, -1) },
      { texto: "Esta semana", href: `/panel/resumen?semana=${lunes}`, activo: semana === lunes },
      { texto: "Semana pasada", href: `/panel/resumen?semana=${mover(lunes, -7)}`, activo: semana === mover(lunes, -7) },
    ];
    const titulo = semana ? `Semana del ${ddmm(r.desde)} al ${ddmm(r.hasta)}` : desde === hoy ? "Hoy" : desde === mover(hoy, -1) ? "Ayer" : `El ${ddmm(desde)}`;
    const contra = semana ? "la semana anterior" : "el día anterior";
    const cambio = (x: number, y: number) => {
      if (Number(y) === 0) return Number(x) ? "nuevo" : null;
      const p = Math.round(((Number(x) - Number(y)) / Number(y)) * 100);
      return p === 0 ? `igual que ${contra}` : `${p > 0 ? "↑" : "↓"} ${Math.abs(p)}% contra ${contra}`;
    };
    const hora = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, ...(semana ? { weekday: "short" as const } : {}), hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
    const numeros = [
      { emoji: "plata", etiqueta: "Cobrado", valor: formatearPesos(a.cobrado), comp: cambio(a.cobrado, b.cobrado) },
      { emoji: "puerta", etiqueta: "Entradas", valor: formatearNumero(a.entradas), comp: `${formatearNumero(a.socios_que_vinieron)} socios distintos` },
      { emoji: "hoja", etiqueta: "Altas", valor: formatearNumero(a.altas), comp: cambio(a.altas, b.altas) },
      { emoji: "salir", etiqueta: "Bajas", valor: formatearNumero(a.bajas), comp: cambio(a.bajas, b.bajas) },
    ];
    const atencion = [
      a.diferencias.length > 0 && `${a.diferencias.length === 1 ? "1 caja cerró" : `${a.diferencias.length} cajas cerraron`} con diferencia`,
      a.retiros.cantidad > 0 && `${formatearPesos(a.retiros.total)} en ${a.retiros.cantidad === 1 ? "1 retiro" : `${a.retiros.cantidad} retiros`}`,
      a.descuentos.cantidad > 0 && `${formatearPesos(a.descuentos.total)} en descuentos${Number(a.descuentos.convenios) ? ` (${formatearPesos(a.descuentos.convenios)} de convenios)` : ""}`,
      a.anulaciones.cantidad > 0 && `${a.anulaciones.cantidad === 1 ? "1 venta anulada" : `${a.anulaciones.cantidad} ventas anuladas`} (${formatearPesos(a.anulaciones.total)})`,
      a.dejados_pasar > 0 && `${a.dejados_pasar === 1 ? "1 dejado pasar" : `${a.dejados_pasar} dejados pasar`}`,
      a.rechazados > 0 && `${a.rechazados === 1 ? "1 no pudo entrar" : `${a.rechazados} no pudieron entrar`}`,
      Number(a.fiado) > 0 && `${formatearPesos(a.fiado)} quedaron a cuenta (no es plata que entró)`,
    ].filter(Boolean) as string[];
    return (
      <div className="space-y-10">
        <Encabezado icono="grafico" titulo="Resumen" bajada={`${titulo}: plata, caja, entradas, altas y bajas. Comparado con ${contra}.`} />
        <nav className="flex flex-wrap gap-2" aria-label="Período">
          {opciones.map((o) => (
            <Link key={o.texto} href={o.href} aria-current={o.activo ? "page" : undefined}
              className="pestana">{o.texto}</Link>
          ))}
        </nav>
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-8" data-resumen-numeros>
          {numeros.map((n) => (
            <div key={n.etiqueta} className="flex flex-col-reverse">
              <dt className="texto-suave mt-2 text-[15px]"><span aria-hidden><Icono nombre={n.emoji} /></span> {n.etiqueta}{n.comp && <span className="block text-sm texto-tenue">{n.comp}</span>}</dt>
              <dd className="numero text-4xl sm:text-5xl">{n.valor}</dd>
            </div>
          ))}
        </dl>

        <section aria-labelledby="atencion">
          <h2 id="atencion" className="titulo text-2xl mb-3">Para mirar</h2>
          {atencion.length === 0 ? <p className="texto-suave text-lg">Nada raro: sin diferencias de caja, retiros, descuentos, anulaciones ni dejados pasar. <Icono nombre="estrella" /></p> : (
            <ul className="space-y-2" data-resumen-atencion>{atencion.map((x) => <li key={x} className="tarjeta px-4 py-3 text-lg">{x}</li>)}</ul>
          )}
        </section>

        {a.por_medio.length > 0 && (
          <div className="grid gap-8 md:grid-cols-2">
            <section aria-labelledby="medios">
              <h2 id="medios" className="titulo text-2xl mb-3">Por medio</h2>
              <ul className="tarjeta divide-y divide-[var(--borde)]">{a.por_medio.map((m) => (
                <li key={m.medio} className="flex justify-between gap-3 px-4 py-3"><span>{MEDIO[m.medio] ?? m.medio}</span><span className="numero">{formatearPesos(m.total)}</span></li>
              ))}</ul>
            </section>
            <section aria-labelledby="personas">
              <h2 id="personas" className="titulo text-2xl mb-3">Quién cobró</h2>
              <ul className="tarjeta divide-y divide-[var(--borde)]">{a.por_persona.map((p) => (
                <li key={p.nombre} className="flex justify-between gap-3 px-4 py-3"><span>{p.nombre} <span className="texto-tenue text-sm">· {p.cobros === 1 ? "1 cobro" : `${p.cobros} cobros`}</span></span><span className="numero">{formatearPesos(p.total)}</span></li>
              ))}</ul>
            </section>
          </div>
        )}

        {(a.diferencias.length > 0 || a.retiros.lista.length > 0) && (
          <section aria-labelledby="caja">
            <h2 id="caja" className="titulo text-2xl mb-3">Caja <span className="texto-tenue text-lg">· {a.cajas_cerradas === 1 ? "1 cierre" : `${a.cajas_cerradas} cierres`}</span></h2>
            <ul className="space-y-2">
              {a.diferencias.map((d) => (
                <li key={`d-${d.en}`} className="tarjeta px-4 py-3 flex flex-wrap justify-between gap-2">
                  <span>{d.caja} · {d.por ?? "—"} · {hora(d.en)}</span>
                  <span className="numero" style={{ color: d.monto < 0 ? "var(--rojo)" : undefined }}>{d.monto > 0 ? "Sobraron " : "Faltaron "}{formatearPesos(Math.abs(d.monto))}</span>
                </li>
              ))}
              {a.retiros.lista.map((m) => (
                <li key={`r-${m.en}`} className="tarjeta px-4 py-3 flex flex-wrap justify-between gap-2">
                  <span><Icono nombre="plata" /> {m.motivo} · {m.por ?? "—"} · {hora(m.en)}</span><span className="numero">{formatearPesos(m.monto)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3"><Link href="/panel/caja/historial" className="underline texto-suave">Ver los turnos de caja</Link></p>
          </section>
        )}
      </div>
    );
  });
}
