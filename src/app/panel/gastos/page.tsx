import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/panel/Marco";
import { formatearPesos } from "@/lib/formato";
import { NOMBRE_CATEGORIA, nombreMes, type GananciaMes } from "@/lib/gastos";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { CargarGasto, Fijos, ListaGastos, PermisoEncargado, Presupuesto } from "./Formularios";
import { Icono } from "@/components/ui/Icono";

export const metadata: Metadata = { title: "Gastos" };

const moverMes = (d: string, n: number) => new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1 + n, 1)).toISOString().slice(0, 10);

/** VD-41: lo que gastás, los fijos del mes, el presupuesto y la ganancia. Todo lo calcula la base al abrirla. */
export default async function Gastos({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const sp = await searchParams;
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "gastos");
    exigirRol(panel, ["dueno", "encargado"]);
    const pedido = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? `${sp.mes}-01` : null;
    // Sin permiso (encargado al que el dueño no se lo dio) la base responde con error: se ve, nunca una lista vacía.
    const g = await rpc<GananciaMes>("ganancia_mes", { p_gimnasio_id: panel.gimnasio.id, p_mes: pedido });
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: panel.gimnasio.zona_horaria }).format(new Date());
    const anterior = moverMes(g.mes, -1);
    const siguiente = moverMes(g.mes, 1);
    const ultimoDia = new Date(Date.UTC(Number(g.mes.slice(0, 4)), Number(g.mes.slice(5, 7)), 0)).toISOString().slice(0, 10);
    const ganancia = Number(g.ganancia);
    const conPresupuesto = g.por_categoria.filter((c) => c.presupuesto != null);
    const desvioTotal = conPresupuesto.reduce((a, c) => a + Number(c.desvio), 0);
    return (
      <div className="space-y-10">
        <Encabezado icono="calculadora" titulo="Gastos" bajada={`Lo que gastaste en ${nombreMes(g.mes)}${g.en_curso ? " hasta hoy" : ""} y lo que te quedó.`}
          volver={{ href: `/panel/resultado?mes=${g.mes.slice(0, 7)}`, texto: "Resultado" }} />
        <nav className="flex flex-wrap items-center gap-2" aria-label="Mes">
          <Link href={`/panel/gastos?mes=${anterior.slice(0, 7)}`} className="pestana">← {nombreMes(anterior).split(" ")[0]}</Link>
          <span className="pestana" aria-current="page">{nombreMes(g.mes)}</span>
          {!g.en_curso && <Link href={`/panel/gastos?mes=${siguiente.slice(0, 7)}`} className="pestana">{nombreMes(siguiente).split(" ")[0]} →</Link>}
        </nav>

        <section aria-label="Ganancia del mes" data-ganancia-mes>
          <p className="texto-suave">Ingresos <strong className="numero">{formatearPesos(g.ingresos)}</strong> − gastos <strong className="numero" data-total-gastos>{formatearPesos(g.total)}</strong> =</p>
          <p className="numero text-5xl sm:text-6xl mt-1" data-ganancia-gastos style={{ color: ganancia < 0 ? "var(--rojo)" : undefined }}>
            {ganancia < 0 ? "−" : ""}{formatearPesos(Math.abs(ganancia))} <span className="texto-suave text-lg">{ganancia < 0 ? "de pérdida" : "de ganancia"}</span>
          </p>
          <p className="texto-suave mt-2">
            {Number(g.total_fijos) > 0 ? `Incluye ${formatearPesos(g.total_fijos)} de gastos fijos. ` : ""}
            {conPresupuesto.length > 0
              ? `Contra tu presupuesto: ${desvioTotal > 0 ? `te pasaste ${formatearPesos(desvioTotal)} en total` : `estás ${formatearPesos(Math.abs(desvioTotal))} por debajo`}.`
              : g.es_dueno ? "Poné un presupuesto abajo y acá ves el desvío." : ""}
          </p>
          {g.en_curso && <p className="text-sm texto-tenue mt-1">Los ingresos son lo cobrado hasta hoy; los gastos fijos cuentan enteros desde el primer día del mes.</p>}
        </section>

        <section aria-labelledby="cargar">
          <h2 id="cargar" className="titulo text-2xl mb-3">Cargar un gasto</h2>
          <CargarGasto mes={g.mes} hoy={hoy} ultimoDia={ultimoDia} />
        </section>

        <section aria-labelledby="del-mes">
          <h2 id="del-mes" className="titulo text-2xl mb-3">Gastos de {nombreMes(g.mes)}</h2>
          <ListaGastos g={g} puedeVerFijos={g.es_dueno} />
          {g.por_categoria.some((c) => Number(c.gastado) > 0) && (
            <p className="texto-suave text-sm mt-3" data-por-categoria>
              {g.por_categoria.filter((c) => Number(c.gastado) > 0).map((c) => `${NOMBRE_CATEGORIA[c.categoria] ?? c.categoria} ${formatearPesos(c.gastado)}`).join(" · ")}
            </p>
          )}
        </section>

        {g.es_dueno && (
          <>
            <section aria-labelledby="fijos">
              <h2 id="fijos" className="titulo text-2xl mb-1"><Icono nombre="repetir" /> Gastos fijos</h2>
              <p className="texto-suave mb-3">Lo que pagás todos los meses. Lo cargás una vez y cuenta en cada mes desde {nombreMes(g.mes).split(" ")[0]}; no hay que volver a cargarlo.</p>
              <Fijos mes={g.mes} />
            </section>
            <section aria-labelledby="presupuesto">
              <h2 id="presupuesto" className="titulo text-2xl mb-1"><Icono nombre="objetivo" /> Presupuesto por mes</h2>
              <p className="texto-suave mb-3">Cuánto esperás gastar en cada categoría. Vacío = sin presupuesto.</p>
              <Presupuesto g={g} />
            </section>
            <section aria-labelledby="permiso">
              <h2 id="permiso" className="titulo text-2xl mb-3">Quién lo ve</h2>
              <PermisoEncargado prendido={g.encargado_ve_gastos} />
            </section>
          </>
        )}

        <section aria-labelledby="contador">
          <h2 id="contador" className="titulo text-2xl mb-1">Para el contador</h2>
          <p className="texto-suave mb-3">Los gastos del mes fila por fila, en una planilla que se abre con Excel.</p>
          <a href={`/panel/gastos/exportar?mes=${g.mes.slice(0, 7)}`} className="boton" download data-exportar-gastos><Icono nombre="calculadora" /> Gastos del mes</a>
        </section>
      </div>
    );
  });
}
