import type { Metadata } from "next";
import Link from "next/link";
import { BotonPin } from "@/components/panel/BotonPin";
import { Encabezado } from "@/components/panel/Marco";
import { SelectorSede } from "@/components/panel/SelectorSede";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpc, rpcLectura } from "@/lib/panel/servidor";
import { sedeActiva } from "@/lib/panel/sede";
import type { Resumen } from "./acciones";
import { ParaRevisar } from "./ParaRevisar";
import type { CobrosMedio, ConfigCaja, MiTurno, ParaRevisar as ParaRevisarT } from "./tipos";
import { AbrirCaja, TurnoAbierto } from "./Turno";
import { Icono } from "@/components/ui/Icono";

export const metadata: Metadata = { title: "Caja" };
type Caja = { caja_id: string; nombre: string; activa: boolean; turno_id: string | null; abierta_en: string | null; abierta_por: string | null; vencida: boolean };

export default async function PaginaCaja({ searchParams }: { searchParams: Promise<{ sede?: string; accion?: string }> }) {
  const sp = await searchParams;
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "caja");
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    const { sede, puedeCambiar } = sedeActiva(panel, sp.sede);
    const ve = panel.yo.rol !== "recepcion";   // arqueo ciego: la recepción no ve lo esperado con la caja abierta
    // VD-9 (D20): el dueño y el encargado, al mirar, registran las cajas que quedaron abiertas de otro día
    // (sin cron, al primer acceso). Va antes de leer las cajas para que no aparezcan abiertas y sin contar a la vez.
    const revisar = ve ? await rpc<ParaRevisarT[]>("cajas_para_revisar", { p_gimnasio_id: panel.gimnasio.id }) : [];
    const [todas, olvidadas, config, mi] = await Promise.all([
      rpcLectura<Caja[]>("cajas_sede", { p_sede_id: sede.id }),
      rpcLectura<{ turno_id: string }[]>("cajas_olvidadas", { p_gimnasio_id: panel.gimnasio.id }),
      rpcLectura<ConfigCaja>("config_caja", { p_gimnasio_id: panel.gimnasio.id }),
      rpcLectura<MiTurno>("mi_turno_caja", { p_sede_id: sede.id }),
    ]);
    const cajas = todas.filter((c) => c.activa);
    const sugerido = (id: string) => mi.libres.find((l) => l.caja_id === id)?.fondo_sugerido ?? 0;
    const resumenes = await Promise.all(cajas.map((c) => (c.turno_id && ve ? rpcLectura<Resumen>("resumen_caja", { p_turno_id: c.turno_id }) : Promise.resolve(null))));
    // H1: lo cobrado por medio de cada turno abierto (misma regla de permiso que el resumen: la recepción no lo ve con la caja abierta).
    const cobros = await Promise.all(cajas.map((c) => (c.turno_id && ve ? rpcLectura<CobrosMedio[]>("cobros_de_turnos", { p_turno_ids: [c.turno_id] }) : Promise.resolve(null))));
    const hora = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: panel.gimnasio.zona_horaria, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
    return (
      <>
        <Encabezado icono="plata" titulo="Caja" bajada="Abrís con lo que hay, cobrás, y al cerrar contás la plata."
          accion={<div className="flex flex-wrap gap-2"><BotonPin gimnasioId={panel.gimnasio.id} volver="/panel/caja" />
            {ve && <Link href={`/panel/caja/historial${sp.sede ? `?sede=${sp.sede}` : ""}`} className="boton"><Icono nombre="grilla" /> Turnos anteriores</Link>}
            {ve && <Link href={`/panel/caja/reporte${sp.sede ? `?sede=${sp.sede}` : ""}`} className="boton" data-reporte-dia><Icono nombre="lista" /> Cierre del día</Link>}</div>} />
        {puedeCambiar && <SelectorSede sedes={panel.sedes} actual={sede.id} ruta="/panel/caja" />}
        {revisar.length > 0 && <ParaRevisar cajas={revisar} zona={panel.gimnasio.zona_horaria} pedirBilletes={config.pedir_billetes} />}
        {cajas.length === 0 && <p className="texto-suave text-lg">Esta sede no tiene cajas activas.</p>}
        <div className="space-y-4">
          {cajas.map((c, i) => c.turno_id
            ? <TurnoAbierto key={c.caja_id} turnoId={c.turno_id} cajaId={c.caja_id} nombre={c.nombre} desde={`Desde las ${hora(c.abierta_en!)}${c.abierta_por ? ` · la abrió ${c.abierta_por}` : ""}`} resumen={resumenes[i]} cobros={cobros[i]}
                olvidada={olvidadas.some((o) => o.turno_id === c.turno_id)} vencida={c.vencida} pedirBilletes={config.pedir_billetes} abrirCierre={sp.accion === "cerrar"} zona={panel.gimnasio.zona_horaria} />
            : <AbrirCaja key={c.caja_id} cajaId={c.caja_id} nombre={c.nombre} fondoSugerido={sugerido(c.caja_id)} />)}
        </div>
      </>
    );
  });
}
