import { Icono } from "@/components/ui/Icono";
// VD-23: la semana (● ● ○), la racha y la meta del mes. Todo viene calculado de la base (progreso_inicio).
export type ProgresoSocio = {
  semana: { dia: string; hoy: boolean; vino: boolean }[];
  semanas_seguidas: number; entradas_mes: number; entradas_mes_anterior: number; vino_esta_semana: boolean;
  meta_mes: number; total_entradas: number; hito: number | null; entro_hoy: string | null; bienvenida_pendiente: boolean;
};

const LETRA = ["L", "M", "M", "J", "V", "S", "D"];

export function ProgresoInicio({ p }: { p: ProgresoSocio }) {
  // Sin nada todavía (socio nuevo): lo vacío está vacío, salvo que invite.
  if (p.entradas_mes === 0 && p.semanas_seguidas === 0 && p.total_entradas === 0) {
    return (
      <section className="tarjeta p-4" data-progreso="vacio">
        <p className="font-semibold">Tu primera semana empieza con tu primera entrada <Icono nombre="pesa" /></p>
        <p className="texto-suave text-sm">Acá vas a ver cuántas veces venís, tu racha y la meta del mes ({p.meta_mes} visitas).</p>
      </section>
    );
  }
  const pct = Math.min(100, Math.round((p.entradas_mes / p.meta_mes) * 100));
  const cumplida = p.entradas_mes >= p.meta_mes;
  return (
    <section className="space-y-3" data-racha data-progreso>
      <div className="tarjeta p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">Esta semana</p>
          <p className="texto-suave text-sm" data-racha-semanas>{p.semanas_seguidas >= 2 ? <><Icono nombre="fuego" /> </> : ""}{p.semanas_seguidas} {p.semanas_seguidas === 1 ? "semana" : "semanas"} seguidas{p.semanas_seguidas > 0 && !p.vino_esta_semana ? " · vení esta semana para seguir" : ""}</p>
        </div>
        <ol className="grid grid-cols-7 gap-1 text-center" aria-label="Días de esta semana">
          {p.semana.map((d, i) => (
            <li key={d.dia} data-dia-vino={d.vino ? "si" : "no"} aria-label={`${LETRA[i]}: ${d.vino ? "viniste" : d.hoy ? "hoy" : "no viniste"}`}>
              <span className={`mx-auto grid place-items-center size-8 rounded-full text-sm ${d.vino ? "text-white" : "texto-tenue border border-[var(--borde)]"} ${d.hoy ? "ring-2 ring-[var(--acento)]" : ""}`}
                style={d.vino ? { background: "var(--acento)" } : undefined}>{d.vino ? "✓" : ""}</span>
              <span className="block text-xs texto-tenue mt-1">{LETRA[i]}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="tarjeta p-4 space-y-2" data-meta-mes={`${p.entradas_mes}/${p.meta_mes}`}>
        <div className="flex items-end justify-between gap-2">
          <p className="texto-suave text-sm"><span className="numero text-3xl">{p.entradas_mes}</span> {p.entradas_mes === 1 ? "vez" : "veces"} este mes{p.entradas_mes_anterior ? ` · ${p.entradas_mes_anterior} el anterior` : ""}</p>
          <p className="text-sm font-semibold">Meta {p.entradas_mes}/{p.meta_mes}{cumplida ? <> <Icono nombre="ok" /></> : ""}</p>
        </div>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={p.meta_mes} aria-valuenow={Math.min(p.entradas_mes, p.meta_mes)} aria-label="Meta del mes"
          className="h-2 rounded-full overflow-hidden" style={{ background: "var(--borde)" }}>
          <div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, background: "var(--acento)" }} />
        </div>
      </div>
    </section>
  );
}
