import type { Metadata } from "next";
import Link from "next/link";
import { BotonPin, type OperadorActual } from "@/components/panel/BotonPin";
import { ActualizarSola } from "@/components/ui/ActualizarSola";
import { Encabezado } from "@/components/panel/Marco";
import { SelectorSede } from "@/components/panel/SelectorSede";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, fijo, lectura, rpc, rpcLectura, rpcLote } from "@/lib/panel/servidor";
import { sedeActiva } from "@/lib/panel/sede";
import type { Resumen } from "./acciones";
import { ParaRevisar } from "./ParaRevisar";
import type { CobrosMedio, ConfigCaja, MiTurno, MovimientosTurno, ParaRevisar as ParaRevisarT } from "./tipos";
import { conSemaforo } from "@/lib/semaforo";
import { rutaDisponible } from "@/lib/panel/secciones";
import { fechaHoraHumana } from "@/lib/formato";
import { Pendiente } from "../transferencias/Pendiente";

type PorAprobar = { pago_id: string; socio_id: string; socio: string; monto: number; descripcion: string | null; informado_en: string };
import { AbrirCaja, TurnoAbierto } from "./Turno";
import { Icono } from "@/components/ui/Icono";
import { Vacio } from "@/components/ui/Vacio";

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
    // Cacería (16/11): las cuatro lecturas de la pantalla en UN viaje (lote_lecturas).
    const semaforo = await conSemaforo();
    // caja.png: "Para aprobar" al costado, con la aprobación de siempre (Transferencias). Va en el mismo viaje.
    const conAprobar = semaforo && rutaDisponible("/panel/transferencias", panel.yo.rol, panel.secciones_apagadas);
    const [todas, olvidadas, config, mi, operador, porAprobar] = await rpcLote(
      lectura<Caja[]>("cajas_sede", { p_sede_id: sede.id }),
      lectura<{ turno_id: string }[]>("cajas_olvidadas", { p_gimnasio_id: panel.gimnasio.id }),
      lectura<ConfigCaja>("config_caja", { p_gimnasio_id: panel.gimnasio.id }),
      lectura<MiTurno>("mi_turno_caja", { p_sede_id: sede.id }),
      lectura<OperadorActual>("operador_actual", { p_gimnasio_id: panel.gimnasio.id }),
      conAprobar ? lectura<PorAprobar[] | null>("pagos_por_aprobar", { p_gimnasio_id: panel.gimnasio.id }, true) : fijo<PorAprobar[] | null>(null),
    );
    const cajas = todas.filter((c) => c.activa);
    const sugerido = (id: string) => mi.libres.find((l) => l.caja_id === id)?.fondo_sugerido ?? 0;
    const resumenes = await Promise.all(cajas.map((c) => (c.turno_id && ve ? rpcLectura<Resumen>("resumen_caja", { p_turno_id: c.turno_id }) : Promise.resolve(null))));
    // H1: lo cobrado por medio de cada turno abierto (misma regla de permiso que el resumen: la recepción no lo ve con la caja abierta).
    // Cierre para vender (25/11): con Semáforo, movimientos_turno trae lo mismo (cobros_de_turnos, con su permiso) más los ingresos y retiros: el mismo viaje.
    // Contra una base sin la función, cae a cobros_de_turnos como antes.
    const movs = await Promise.all(cajas.map((c) => (c.turno_id && ve && semaforo
      ? rpcLectura<MovimientosTurno>("movimientos_turno", { p_turno_id: c.turno_id }).catch(() => null) : Promise.resolve(null))));
    const cobros = await Promise.all(cajas.map((c, i) => (movs[i] ? Promise.resolve(movs[i]!.cobros)
      : c.turno_id && ve ? rpcLectura<CobrosMedio[]>("cobros_de_turnos", { p_turno_ids: [c.turno_id] }) : Promise.resolve(null))));
    const paraAprobar = porAprobar && porAprobar.length > 0 ? (
      <section className="tarjeta p-5 space-y-3" aria-labelledby="para-aprobar" data-caja-para-aprobar={porAprobar.length}>
        <h2 id="para-aprobar" className="titulo">Para aprobar</h2>
        <ul className="space-y-2">{porAprobar.slice(0, 5).map((p) => <Pendiente key={p.pago_id} p={p} cuando={fechaHoraHumana(p.informado_en, panel.gimnasio.zona_horaria)} />)}</ul>
        {porAprobar.length > 5 && <Link href="/panel/transferencias" className="texto-suave underline">Ver las {porAprobar.length}</Link>}
      </section>
    ) : null;
    const hora = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: panel.gimnasio.zona_horaria, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
    return (
      <>
        <ActualizarSola />
        <Encabezado icono="plata" titulo="Caja" bajada="Abrís con lo que hay, cobrás, y al cerrar contás la plata."
          accion={<div className="flex flex-wrap gap-2"><BotonPin gimnasioId={panel.gimnasio.id} volver="/panel/caja" operador={operador} />
            {ve && <Link href={`/panel/caja/historial${sp.sede ? `?sede=${sp.sede}` : ""}`} className="boton"><Icono nombre="grilla" /> Turnos anteriores</Link>}
            {ve && <Link href={`/panel/caja/reporte${sp.sede ? `?sede=${sp.sede}` : ""}`} className="boton" data-reporte-dia><Icono nombre="lista" /> Cierre del día</Link>}</div>} />
        {puedeCambiar && <SelectorSede sedes={panel.sedes} actual={sede.id} ruta="/panel/caja" />}
        {revisar.length > 0 && <ParaRevisar cajas={revisar} zona={panel.gimnasio.zona_horaria} pedirBilletes={config.pedir_billetes} />}
        {cajas.length === 0 && <Vacio icono="caja" titulo="Esta sede no tiene cajas activas">{panel.yo.rol === "dueno" || panel.yo.rol === "encargado" ? "Sin una caja activa no se puede abrir un turno ni cobrar en efectivo." : "Pedile al dueño que active una caja en Configuración."}</Vacio>}
        <div className="space-y-4">
          {cajas.map((c, i) => c.turno_id
            ? <TurnoAbierto key={c.caja_id} turnoId={c.turno_id} cajaId={c.caja_id} nombre={c.nombre} desde={`Desde las ${hora(c.abierta_en!)}${c.abierta_por ? ` · la abrió ${c.abierta_por}` : ""}`} resumen={resumenes[i]} cobros={cobros[i]}
                olvidada={olvidadas.some((o) => o.turno_id === c.turno_id)} vencida={c.vencida} pedirBilletes={config.pedir_billetes} abrirCierre={sp.accion === "cerrar"} zona={panel.gimnasio.zona_horaria}
                movimientos={movs[i]} costado={i === 0 ? paraAprobar : null} />
            : <AbrirCaja key={c.caja_id} cajaId={c.caja_id} nombre={c.nombre} fondoSugerido={sugerido(c.caja_id)} />)}
        </div>
        {/* La recepción no ve los movimientos con la caja abierta (arqueo ciego), pero sí aprueba transferencias: van abajo. */}
        {paraAprobar && !movs.some(Boolean) && <div className="mt-6">{paraAprobar}</div>}
      </>
    );
  });
}
