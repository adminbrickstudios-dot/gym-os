import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/panel/Marco";
import { nombreMes } from "@/lib/gastos";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, rpc } from "@/lib/panel/servidor";
import { HorasEquipo, type FilaHoras } from "./HorasEquipo";

export const metadata: Metadata = { title: "Horas del equipo" };

const moverMes = (d: string, n: number) => new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1 + n, 1)).toISOString().slice(0, 10);

/** VD-53: las horas fichadas de cada uno en el mes. Dueño y encargado ven; solo el dueño corrige (con motivo) y prende el fichaje. */
export default async function Horas({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const sp = await searchParams;
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado"]);
    const esDueno = panel.yo.rol === "dueno";
    const zona = panel.gimnasio.zona_horaria;
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(new Date());
    const actual = `${hoy.slice(0, 7)}-01`;
    const mes = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) && `${sp.mes}-01` <= actual ? `${sp.mes}-01` : actual;
    const [r, config] = await Promise.all([
      rpc<{ mes: string; personas: FilaHoras[] }>("horas_equipo", { p_gimnasio_id: panel.gimnasio.id, p_mes: mes }, { lectura: true }),
      rpc<{ usa: boolean; tope_horas: number }>("config_fichaje", { p_gimnasio_id: panel.gimnasio.id }, { lectura: true }),
    ]);
    const anterior = moverMes(mes, -1), siguiente = moverMes(mes, 1);
    return (
      <div className="space-y-8">
        <Encabezado emoji="⏱️" titulo="Horas del equipo" bajada={`Las horas que fichó cada uno en ${nombreMes(mes)}. Un turno sin salida no suma hasta que el dueño lo corrige; lo corregido queda anotado con motivo.`} />
        <nav className="flex flex-wrap items-center gap-2" aria-label="Mes">
          <Link href={`/panel/horas?mes=${anterior.slice(0, 7)}`} className="pestana" data-mes-anterior>← {nombreMes(anterior).split(" ")[0]}</Link>
          <span className="pestana" aria-current="page">{nombreMes(mes)}</span>
          {mes < actual && <Link href={`/panel/horas?mes=${siguiente.slice(0, 7)}`} className="pestana">{nombreMes(siguiente).split(" ")[0]} →</Link>}
        </nav>
        <HorasEquipo mes={mes} personas={r.personas} esDueno={esDueno} usa={config.usa} tope={config.tope_horas} zona={zona} />
      </div>
    );
  });
}
