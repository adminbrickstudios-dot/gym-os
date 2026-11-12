import { formatearPesos } from "@/lib/formato";
import { Icono } from "@/components/ui/Icono";
import type { Cobro, CobrosMedio } from "./tipos";

/**
 * H1 · Lo cobrado en el turno (o en el día), medio por medio. Se ve igual en el turno abierto, en el cierre y en los reportes X y Z.
 * Solo muestra lo que calculó la base (cobros_de_turnos): no suma ni resta plata. "Tiene que haber en el cajón" es solo el efectivo.
 */
const GRUPOS: { clave: string; texto: string; icono: string; medios: string[] }[] = [
  { clave: "efectivo", texto: "Efectivo", icono: "plata", medios: ["efectivo"] },
  { clave: "transferencia", texto: "Transferencia", icono: "banco", medios: ["transferencia"] },
  { clave: "tarjeta", texto: "Tarjeta", icono: "tarjeta", medios: ["debito", "credito"] },
  { clave: "mercadopago", texto: "MercadoPago", icono: "celular", medios: ["mercadopago"] },
];
const OTROS: Record<string, string> = { cuenta_corriente: "A cuenta", debito_automatico: "Débito automático" };
const SUBMEDIO: Record<string, string> = { debito: "Débito", credito: "Crédito" };

type Grupo = { clave: string; texto: string; icono: string; total: number; cantidad: number; cobros: (Cobro & { medio: string })[] };

/** Los cuatro medios de siempre (aunque no tengan cobros) y, si los hay, los otros (a cuenta, débito automático). */
function juntar(medios: CobrosMedio[]): Grupo[] {
  const grupos: Grupo[] = GRUPOS.map((g) => ({ clave: g.clave, texto: g.texto, icono: g.icono, total: 0, cantidad: 0, cobros: [] }));
  for (const m of medios) {
    const i = GRUPOS.findIndex((g) => g.medios.includes(m.medio));
    let g = i >= 0 ? grupos[i] : grupos.find((x) => x.clave === m.medio);
    if (!g) { g = { clave: m.medio, texto: OTROS[m.medio] ?? m.medio, icono: "lista", total: 0, cantidad: 0, cobros: [] }; grupos.push(g); }
    g.total += Number(m.total); g.cantidad += m.cantidad;
    g.cobros.push(...m.cobros.map((c) => ({ ...c, medio: m.medio })));
  }
  for (const g of grupos) g.cobros.sort((a, b) => a.en.localeCompare(b.en));
  return grupos;
}

export function PorMedio({ medios, zona, cajon, pasado = false, titulo = "Lo cobrado, por medio" }: {
  medios: CobrosMedio[]; zona: string; titulo?: string;
  /** Turno ya cerrado: "Tenía que haber" en vez de "Tiene que haber". */
  pasado?: boolean;
  /** Solo con el turno a la vista: lo que tiene que haber en el cajón (la cuenta la hizo la base: resumen_turno). */
  cajon?: { esperado: number; inicial: number; efectivo: number; ingresos: number; retiros: number } | null;
}) {
  const hora = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
  return (
    <section aria-label={titulo} data-por-medio className="space-y-3">
      <p className="font-semibold">{titulo}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {juntar(medios).map((g) => (
          <div key={g.clave} className="tarjeta p-4 space-y-2" data-medio={g.clave} data-total={g.total} data-cantidad={g.cantidad}>
            <p className="texto-tenue text-sm"><Icono nombre={g.icono} /> {g.texto}</p>
            <p className="numero text-3xl">{formatearPesos(g.total)}</p>
            <p className="texto-suave text-sm">{g.cantidad === 0 ? "Sin cobros" : `${g.cantidad} ${g.cantidad === 1 ? "cobro" : "cobros"}`}</p>
            {g.clave === "efectivo" && cajon && (
              <div className="tarjeta p-3 space-y-1" data-tiene-que-haber>
                <p className="text-sm texto-tenue">{pasado ? "Tenía que haber en el cajón" : "Tiene que haber en el cajón"}</p>
                <p className="numero text-2xl" style={{ color: "var(--acento)" }}>{formatearPesos(cajon.esperado)}</p>
                <p className="text-sm texto-suave">
                  {formatearPesos(cajon.inicial)} con los que se abrió +{formatearPesos(cajon.efectivo)} cobrados en efectivo
                  {cajon.ingresos > 0 ? ` + ${formatearPesos(cajon.ingresos)} que entraron` : ""}{cajon.retiros > 0 ? ` − ${formatearPesos(cajon.retiros)} que salieron` : ""}.
                  Es solo plata del cajón: la transferencia y la tarjeta no están ahí.
                </p>
              </div>
            )}
            {g.cantidad > 0 && (
              <details className="group">
                <summary className="cursor-pointer list-none min-h-11 flex items-center gap-2 text-sm font-semibold" data-ver-cobros={g.clave}>
                  <span aria-hidden className="texto-suave transition-transform group-open:rotate-45"><Icono nombre="mas" /></span> Ver los cobros
                </summary>
                <ul className="space-y-1 text-sm pt-1">
                  {g.cobros.map((c) => (
                    <li key={c.pago_id} className="flex flex-wrap items-baseline gap-x-2" data-cobro>
                      <span className="texto-tenue tabular-nums">{hora(c.en)}</span>
                      <span className="min-w-0 flex-1">{c.socio ?? "Sin socio"}
                        {c.cobro ? <span className="texto-tenue"> · cobró {c.cobro}</span> : null}
                        {g.clave === "tarjeta" && SUBMEDIO[c.medio] ? <span className="texto-tenue"> · {SUBMEDIO[c.medio]}</span> : null}</span>
                      <span className="numero">{formatearPesos(c.monto)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
