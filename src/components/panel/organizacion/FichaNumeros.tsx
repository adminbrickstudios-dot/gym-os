// Pase 2.0 · organización (26/11 · organizacion/ficha-socio.png): lo nuevo de la ficha, con la llave. Cuatro números (veces este mes con el
// promedio del gimnasio, semanas seguidas con la mejor racha, última vez con el horario en que suele venir), "Cuándo viene" por día de la
// semana y "Su historia" (pagos, entradas, avisos, reservas y congelamientos). Todo calculado por la base (numeros_socio, historia_socio):
// acá solo se dibuja. Lo vacío no se muestra.
import { Icono } from "@/components/ui/Icono";
import { formatearPesos } from "@/lib/formato";
import { fechaHumanaCorta } from "./fechas";

export type NumerosFicha = { ultima_vez: string | null; veces_mes: number; promedio_gimnasio_mes: number | string; semanas_seguidas: number; mejor_racha: number; cuando_viene: { dia: number; veces: number }[]; hora_habitual: number | null };
export type Historia = { tipo: "pago" | "entrada" | "aviso" | "reserva" | "congelamiento"; en: string; detalle: string; monto: number | string | null }[];

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const ICONO: Record<Historia[number]["tipo"], string> = { pago: "plata", entrada: "puerta", aviso: "mensaje", reserva: "calendario", congelamiento: "pausa" };

export function FichaNumeros({ n, historia, zona }: { n: NumerosFicha | null; historia: Historia | null; zona: string }) {
  if (!n && !historia?.length) return null;
  const cuando = new Map((n?.cuando_viene ?? []).map((x) => [x.dia, x.veces]));
  const max = Math.max(1, ...cuando.values());
  const cuando2 = (iso: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
  return (
    <section className="space-y-4" aria-label="Cómo viene" data-ficha-organizacion>
      {n && (
        <dl className="grid gap-3 grid-cols-2 lg:grid-cols-3">
          <div className="tarjeta p-4" data-ficha-veces-promedio><dd className="numero text-4xl">{n.veces_mes}</dd><dt className="font-semibold">Veces este mes</dt><span className="texto-suave text-sm">El promedio del gimnasio: {String(n.promedio_gimnasio_mes).replace(".", ",")}</span></div>
          <div className="tarjeta p-4" data-ficha-racha><dd className="numero text-4xl">{n.semanas_seguidas}</dd><dt className="font-semibold">Semanas seguidas</dt><span className="texto-suave text-sm">Su mejor racha: {n.mejor_racha}</span></div>
          <div className="tarjeta p-4" data-ficha-ultima><dd className="numero text-4xl">{fechaHumanaCorta(n.ultima_vez, zona)}</dd><dt className="font-semibold">Última vez</dt>{n.hora_habitual != null && <span className="texto-suave text-sm">Suele venir a las {n.hora_habitual} h</span>}</div>
        </dl>
      )}
      {n && cuando.size > 0 && (
        <section className="tarjeta p-4 space-y-2" aria-labelledby="cuando-viene" data-cuando-viene>
          <h2 id="cuando-viene" className="titulo text-xl"><Icono nombre="calendario" /> Cuándo viene</h2>
          <p className="texto-suave text-sm">Las últimas 12 semanas, por día.</p>
          <div className="flex items-end gap-2 h-24">
            {DIAS.map((d, i) => (
              <div key={d} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                <div className="w-full rounded-t-md" style={{ height: `${Math.max(4, ((cuando.get(i + 1) ?? 0) / max) * 100)}%`, background: (cuando.get(i + 1) ?? 0) === max ? "var(--acento)" : "var(--tarjeta-alta)" }} />
                <span className="text-xs texto-suave">{d}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      {historia && historia.length > 0 && (
        <section className="tarjeta p-4 space-y-2" aria-labelledby="su-historia" data-su-historia={historia.length}>
          <h2 id="su-historia" className="titulo text-xl"><Icono nombre="lista" /> Su historia</h2>
          <ol className="space-y-1.5">
            {historia.map((h, i) => (
              <li key={`${h.tipo}-${h.en}-${i}`} className="flex items-center gap-3 text-[15px]" data-historia={h.tipo}>
                <span className="texto-suave text-sm w-24 flex-none numero">{cuando2(h.en)}</span>
                <span aria-hidden><Icono nombre={ICONO[h.tipo]} /></span>
                <span className="min-w-0 flex-1 truncate">{h.detalle}</span>
                {h.monto != null && <span className="numero">{formatearPesos(h.monto)}</span>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </section>
  );
}
