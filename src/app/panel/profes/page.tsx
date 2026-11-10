import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/panel/Marco";
import { Mensaje } from "@/components/ui/Mensaje";
import { nombreMes } from "@/lib/gastos";
import { intentar } from "@/lib/panel/intentar";
import { sedeActiva } from "@/lib/panel/sede";
import { contextoPanel, exigirRol, rpc, rpcLectura } from "@/lib/panel/servidor";
import type { MiTurno } from "@/app/panel/caja/tipos";
import { Liquidacion, type FilaProfe } from "./Liquidacion";

export const metadata: Metadata = { title: "Liquidación de profes" };

const moverMes = (d: string, n: number) => new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1 + n, 1)).toISOString().slice(0, 10);

/** VD-52 (D33): lo que se le debe a cada profe en el mes. Todo lo calcula la base desde las clases dictadas y la asistencia. */
export default async function Profes({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const sp = await searchParams;
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado"]);
    const esDueno = panel.yo.rol === "dueno";
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: panel.gimnasio.zona_horaria }).format(new Date());
    const actual = `${hoy.slice(0, 7)}-01`;
    const mes = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) && `${sp.mes}-01` <= actual ? `${sp.mes}-01` : actual;
    // Sin permiso (encargado al que el dueño no se lo dio) la base responde con error: se ve, nunca una lista vacía.
    const [r, config, turno] = await Promise.all([
      rpc<{ mes: string; profes: FilaProfe[] }>("liquidacion_profes", { p_gimnasio_id: panel.gimnasio.id, p_mes: mes }),
      esDueno ? rpc<{ encargado_ve: boolean }>("config_liquidacion", { p_gimnasio_id: panel.gimnasio.id }) : Promise.resolve(null),
      esDueno ? rpcLectura<MiTurno>("mi_turno_caja", { p_sede_id: sedeActiva(panel, undefined).sede.id }).catch(() => null) : Promise.resolve(null),
    ]);
    const anterior = moverMes(mes, -1), siguiente = moverMes(mes, 1);
    return (
      <div className="space-y-8">
        <Encabezado icono="persona" titulo="Liquidación de profes" bajada={`Lo que se le debe a cada profe en ${nombreMes(mes)}${mes === actual ? ", hasta hoy" : ""}. Sale de las clases que dio y de quiénes vinieron: si corregís una asistencia, se recalcula solo.`} />
        <nav className="flex flex-wrap items-center gap-2" aria-label="Mes">
          <Link href={`/panel/profes?mes=${anterior.slice(0, 7)}`} className="pestana" data-mes-anterior>← {nombreMes(anterior).split(" ")[0]}</Link>
          <span className="pestana" aria-current="page">{nombreMes(mes)}</span>
          {mes < actual && <Link href={`/panel/profes?mes=${siguiente.slice(0, 7)}`} className="pestana">{nombreMes(siguiente).split(" ")[0]} →</Link>}
        </nav>
        {r.profes.length === 0
          ? <Mensaje tipo="info">Todavía no hay profes ni clases con profe asignado. Sumá a alguien al equipo con el rol Profe y asignale clases en la grilla.</Mensaje>
          : <Liquidacion mes={mes} profes={r.profes} esDueno={esDueno} turnoId={turno?.turno?.turno_id ?? null} encargadoVe={config?.encargado_ve ?? null} hoy={hoy} />}
      </div>
    );
  });
}
