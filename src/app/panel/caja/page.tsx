import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/panel/Marco";
import { SelectorSede } from "@/components/panel/SelectorSede";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { sedeActiva } from "@/lib/panel/sede";
import type { Resumen } from "./acciones";
import { AbrirCaja, TurnoAbierto } from "./Turno";

export const metadata: Metadata = { title: "Caja" };
type Caja = { caja_id: string; nombre: string; activa: boolean; turno_id: string | null; abierta_en: string | null; abierta_por: string | null };

export default async function PaginaCaja({ searchParams }: { searchParams: Promise<{ sede?: string }> }) {
  const sp = await searchParams;
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "caja");
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    const { sede, puedeCambiar } = sedeActiva(panel, sp.sede);
    const cajas = (await rpc<Caja[]>("cajas_sede", { p_sede_id: sede.id })).filter((c) => c.activa);
    const ve = panel.yo.rol !== "recepcion";   // arqueo ciego: la recepción no ve lo esperado con la caja abierta
    const resumenes = await Promise.all(cajas.map((c) => (c.turno_id && ve ? rpc<Resumen>("resumen_caja", { p_turno_id: c.turno_id }) : Promise.resolve(null))));
    const hora = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: panel.gimnasio.zona_horaria, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
    return (
      <>
        <Encabezado emoji="💵" titulo="Caja" bajada="Abrís con lo que hay, cobrás, y al cerrar contás la plata."
          accion={ve ? <Link href={`/panel/caja/historial${sp.sede ? `?sede=${sp.sede}` : ""}`} className="boton">🗂️ Turnos anteriores</Link> : undefined} />
        {puedeCambiar && <SelectorSede sedes={panel.sedes} actual={sede.id} ruta="/panel/caja" />}
        {cajas.length === 0 && <p className="texto-suave text-lg">Esta sede no tiene cajas activas.</p>}
        <div className="space-y-4">
          {cajas.map((c, i) => c.turno_id
            ? <TurnoAbierto key={c.caja_id} turnoId={c.turno_id} nombre={c.nombre} desde={`Desde las ${hora(c.abierta_en!)}${c.abierta_por ? ` · la abrió ${c.abierta_por}` : ""}`} resumen={resumenes[i]} />
            : <AbrirCaja key={c.caja_id} cajaId={c.caja_id} nombre={c.nombre} />)}
        </div>
      </>
    );
  });
}
