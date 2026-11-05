// El mes del socio: los días que vino marcados, cuántas veces (y el mes
// anterior) y la racha de semanas seguidas. Se cambia de mes con flechas.
import Link from "next/link";

export type Asistencia = { mes: string; hoy: string; dias: string[]; veces: number; racha_semanas: number; veces_mes_anterior: number };
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function Calendario({ a, socioId }: { a: Asistencia; socioId: string }) {
  const [anio, m] = a.mes.split("-").map(Number);
  const primero = new Date(Date.UTC(anio, m - 1, 1));
  const dias = new Date(Date.UTC(anio, m, 0)).getUTCDate();
  const blancos = (primero.getUTCDay() + 6) % 7;   // lunes primero
  const vino = new Set(a.dias);
  const mesDe = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const anterior = mesDe(new Date(Date.UTC(anio, m - 2, 1))), siguiente = mesDe(new Date(Date.UTC(anio, m, 1)));
  const esFuturo = siguiente > a.hoy.slice(0, 7);
  const href = (x: string) => `/panel/socios/${socioId}?pestana=asistencia&mes=${x}`;
  return (
    <section className="space-y-5" data-asistencia={a.veces}>
      <div className="grid grid-cols-3 gap-3">
        <div className="tarjeta p-4"><p className="numero text-4xl">{a.veces}</p><p className="text-sm texto-suave">veces en {MESES[m - 1]}</p></div>
        <div className="tarjeta p-4"><p className="numero text-4xl">{a.veces_mes_anterior}</p><p className="text-sm texto-suave">el mes anterior</p></div>
        <div className="tarjeta p-4"><p className="numero text-4xl">{a.racha_semanas}</p><p className="text-sm texto-suave">semanas seguidas viniendo</p></div>
      </div>
      <div className="tarjeta p-4 sm:p-6 space-y-4 max-w-lg">
        <div className="flex items-center justify-between gap-2">
          <Link href={href(anterior)} className="boton px-4" aria-label="Mes anterior">◀</Link>
          <p className="titulo text-2xl capitalize">{MESES[m - 1]} {anio}</p>
          {esFuturo ? <span className="w-[52px]" /> : <Link href={href(siguiente)} className="boton px-4" aria-label="Mes siguiente">▶</Link>}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center" role="grid" aria-label={`Asistencia de ${MESES[m - 1]}`}>
          {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => <span key={i} className="text-sm texto-tenue py-1">{d}</span>)}
          {Array.from({ length: blancos }).map((_, i) => <span key={`b${i}`} />)}
          {Array.from({ length: dias }, (_, i) => {
            const fecha = `${a.mes}-${String(i + 1).padStart(2, "0")}`;
            const si = vino.has(fecha), hoy = fecha === a.hoy;
            return (
              <span key={fecha} role="gridcell" aria-label={`${i + 1}${si ? ": vino" : ""}`} data-vino={si || undefined}
                className={`aspect-square grid place-items-center rounded-xl text-lg ${si ? "font-bold" : "texto-tenue"} ${hoy ? "ring-2 ring-[var(--borde)]" : ""}`}
                style={si ? { background: "color-mix(in oklab, var(--acento), transparent 70%)" } : undefined}>{i + 1}</span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
