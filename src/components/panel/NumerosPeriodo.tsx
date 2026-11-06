import Link from "next/link";
import { LinkPanel } from "@/components/panel/LinkPanel";
import { formatearPesos } from "@/lib/formato";

/** VD-16: lo que devuelve retencion_periodo (cada número lo calcula la base; acá solo se muestra). */
export type NumerosDelPeriodo = {
  periodo: string; desde: string; hasta: string; dias: number;
  socios: { al_dia_inicio: number; al_dia_fin: number; altas: number; bajas: number; neto: number };
  churn: { general_pct: number | null; bajas: number; base: number; noventa_pct: number | null; noventa_bajas: number; noventa_altas: number };
  plata: { cobrado: number; socios_promedio: number; por_socio: number | null };
  asistencia: { entradas: number; dias_de_visita: number; socios_que_vinieron: number; visitas_por_socio: number | null; pocas_visitas: number; al_dia_fin: number };
  calor: { dia: number; hora: number; n: number }[];
  clases: { cupos: number; reservas: number; reservas_con_cupo: number; ocupacion_pct: number | null; ausentes: number;
    por_actividad: { actividad: string; clases: number; cupos: number; reservas: number; ocupacion_pct: number | null }[] };
};

export const PERIODOS = [
  { clave: "mes", titulo: "Este mes" },
  { clave: "mes_pasado", titulo: "Mes pasado" },
  { clave: "3", titulo: "3 meses" },
  { clave: "6", titulo: "6 meses" },
  { clave: "12", titulo: "12 meses" },
] as const;

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const pct = (n: number | null) => (n == null ? "—" : `${String(n).replace(".", ",")}%`);
const fecha = (iso: string) => iso.split("-").reverse().join("/");

function Tarjeta({ clave, cifra, titulo, ayuda, children }: { clave: string; cifra: string; titulo: string; ayuda: string; children?: React.ReactNode }) {
  return (
    <div className="tarjeta p-4" data-numero-periodo={clave}>
      <span className="numero text-4xl block" data-valor>{cifra}</span>
      <span className="block texto-suave text-[15px] mt-1">{titulo}</span>
      {children}
      <details className="mt-2">
        <summary className="cursor-pointer text-sm texto-tenue">¿Qué es esto?</summary>
        <p className="text-sm texto-suave mt-1">{ayuda}</p>
      </details>
    </div>
  );
}

/**
 * VD-16: Retención en números del período elegido. Cada número trae su explicación y,
 * donde hay una lista que lo forma, el camino a esa lista. Se exporta a Excel (CSV) con el mismo período.
 */
export function NumerosDelPeriodo({ n, ruta, hayClases, puedeVerResultado }: {
  n: NumerosDelPeriodo; ruta: (periodo: string) => string; hayClases: boolean; puedeVerResultado: boolean;
}) {
  const maxCalor = Math.max(1, ...n.calor.map((c) => c.n));
  const horas = n.calor.map((c) => c.hora);
  const h0 = Math.min(6, ...(horas.length ? horas : [6])), h1 = Math.max(22, ...(horas.length ? horas : [22]));
  const columnas = Array.from({ length: h1 - h0 + 1 }, (_, i) => h0 + i);
  const celda = (d: number, h: number) => n.calor.find((c) => c.dia === d && c.hora === h)?.n ?? 0;
  const hasta = new Date(`${n.hasta}T00:00:00Z`); hasta.setUTCDate(hasta.getUTCDate() - 1);
  const ultimo = hasta.toISOString().slice(0, 10);
  return (
    <section className="mb-10" aria-label="Números del período" data-numeros-periodo={n.periodo}>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <h2 className="titulo text-2xl">Los números</h2>
          <p className="texto-suave text-sm" data-rango>Del {fecha(n.desde)} al {fecha(ultimo)}</p>
        </div>
        <a href={`/panel/retencion/exportar?periodo=${n.periodo}`} className="boton !min-h-11" data-exportar download>📥 Exportar a Excel</a>
      </div>
      <nav className="pestanas mb-4" aria-label="Período" data-periodos>
        {PERIODOS.map((p) => (
          <Link key={p.clave} href={ruta(p.clave)} data-transicion className="pestana" data-periodo={p.clave} aria-current={p.clave === n.periodo ? "page" : undefined}>{p.titulo}</Link>
        ))}
      </nav>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Tarjeta clave="activos" cifra={String(n.socios.al_dia_fin)} titulo={`Socios al día (había ${n.socios.al_dia_inicio} al empezar)`}
          ayuda="Los que tienen la cuota cubierta hoy (o el último día del período). Se compara con los que estaban al día el primer día." />
        <Tarjeta clave="altas_bajas" cifra={n.socios.neto > 0 ? `+${n.socios.neto}` : String(n.socios.neto)} titulo={`${n.socios.altas} altas y ${n.socios.bajas} bajas`}
          ayuda="Altas menos bajas del período. Una baja es un socio al que se le dio de baja (no alcanza con que venza la cuota).">
          <LinkPanel href="/panel/retencion?lista=se_fue" className="underline text-sm">Ver los que se fueron</LinkPanel>
        </Tarjeta>
        <Tarjeta clave="churn" cifra={pct(n.churn.general_pct)} titulo={`Churn general: ${n.churn.bajas} ${n.churn.bajas === 1 ? "baja" : "bajas"} de ${n.churn.base} al día al empezar`}
          ayuda="Las bajas del período divididas por los socios que estaban al día el primer día. Cuanto más bajo, mejor." />
        <Tarjeta clave="churn90" cifra={pct(n.churn.noventa_pct)} titulo={`Churn de los primeros 90 días: ${n.churn.noventa_bajas} de ${n.churn.noventa_altas} que se anotaron`}
          ayuda="De los que se anotaron en el período, cuántos se dieron de baja a los 90 días o menos de anotarse. Los que todavía no cumplieron 90 días y siguen cuentan como que siguen. Mide si los nuevos se quedan." />
        <Tarjeta clave="ingreso" cifra={n.plata.por_socio == null ? "—" : formatearPesos(n.plata.por_socio)} titulo={`Ingreso por socio (${formatearPesos(n.plata.cobrado)} cobrados)`}
          ayuda="Lo cobrado en el período (pagos aprobados, sin ventas anuladas) dividido por el promedio de socios al día entre el primer y el último día.">
          {puedeVerResultado && <LinkPanel href="/panel/resultado" className="underline text-sm">Ver el resultado del mes</LinkPanel>}
        </Tarjeta>
        <Tarjeta clave="visitas" cifra={n.asistencia.visitas_por_socio == null ? "—" : String(n.asistencia.visitas_por_socio).replace(".", ",")}
          titulo={`Días de visita por socio (${n.asistencia.socios_que_vinieron} socios vinieron)`}
          ayuda="Días distintos en que vino cada socio, dividido por los socios al día. Venir dos veces el mismo día cuenta una." />
        <Tarjeta clave="pocas" cifra={String(n.asistencia.pocas_visitas)} titulo={`de ${n.asistencia.al_dia_fin} al día vinieron una vez por semana o menos`}
          ayuda="Socios al día que vinieron una vez por semana o menos en el período: los que más fácil se van. Escribiles antes de que dejen de pagar.">
          <LinkPanel href="/panel/retencion?lista=riesgo" className="underline text-sm">Ver los que están en riesgo</LinkPanel>
        </Tarjeta>
        {hayClases && <>
          <Tarjeta clave="ocupacion" cifra={pct(n.clases.ocupacion_pct)} titulo={`Ocupación de clases (${n.clases.reservas_con_cupo} reservas en ${n.clases.cupos} lugares)`}
            ayuda="Reservas confirmadas dividido por el cupo de las clases del período (no cuentan las canceladas ni las que no tienen cupo).">
            {n.clases.por_actividad.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-sm" data-por-actividad>
                {n.clases.por_actividad.map((a) => <li key={a.actividad}>{a.actividad}: <b>{pct(a.ocupacion_pct)}</b> <span className="texto-tenue">({a.clases} {a.clases === 1 ? "clase" : "clases"})</span></li>)}
              </ul>
            )}
          </Tarjeta>
          <Tarjeta clave="ausentes" cifra={String(n.clases.ausentes)} titulo="Ausentes: reservaron y no vinieron"
            ayuda="Reservas confirmadas de clases que ya terminaron y en las que la persona no figura en la asistencia.">
            <LinkPanel href="/panel/clases" className="underline text-sm">Ir a las clases</LinkPanel>
          </Tarjeta>
        </>}
      </div>
      <div className="tarjeta p-4 mt-3" data-calor>
        <h3 className="font-semibold">🔥 ¿Cuándo vienen?</h3>
        <p className="texto-suave text-sm mb-3">{n.asistencia.entradas} {n.asistencia.entradas === 1 ? "entrada" : "entradas"} por día de la semana y hora. Más oscuro, más gente.</p>
        {n.asistencia.entradas === 0 ? <p className="texto-tenue text-sm">Todavía no hay entradas en este período.</p> : (
          <div className="grid gap-[2px]" style={{ gridTemplateColumns: `1.75rem repeat(${columnas.length}, minmax(0, 1fr))` }} role="img"
            aria-label={`Mapa de calor de entradas: ${n.calor.map((c) => `${DIAS[c.dia - 1]} ${c.hora}h ${c.n}`).join(", ")}`}>
            <span />
            {columnas.map((h) => <span key={h} className="text-[10px] texto-tenue text-center">{h % 2 === 0 ? h : ""}</span>)}
            {DIAS.map((d, i) => (
              <div key={d} className="contents">
                <span className="text-[11px] texto-tenue self-center">{d}</span>
                {columnas.map((h) => {
                  const v = celda(i + 1, h);
                  return <span key={h} className="h-5 rounded-[3px]" data-celda={`${i + 1}-${h}`} data-n={v} title={`${d} ${h}:00 · ${v}`}
                    style={{ background: v ? "var(--acento)" : "var(--borde, rgba(127,127,127,.15))", opacity: v ? 0.2 + 0.8 * (v / maxCalor) : 0.5 }} />;
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
