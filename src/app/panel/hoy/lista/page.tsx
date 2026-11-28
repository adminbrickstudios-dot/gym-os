// Pase 2.0 · organización (26/11 · organizacion/para-hacer-hoy.png): PARA HACER HOY, cinco pantallas en una lista. Lo que la base calcula:
// vencen hoy y deben con su monto (plata_en_juego), las transferencias con "Debe $X (plan)" (transferencias_a_revisar), los interesados, los
// avisos con su mensaje listo (bandeja_avisos), mis tareas y lo resuelto hoy (hecho_hoy). Todo en UN viaje (lote) más el contexto.
// Es la primera pestaña de "Para hacer hoy" con la llave pase_2_organizacion. Nada de plata se calcula acá: se ordena y se muestra.
import { Encabezado } from "@/components/panel/Marco";
import { formatearPesos } from "@/lib/formato";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, fijo, lectura, rpcLote } from "@/lib/panel/servidor";
import { rutaDisponible } from "@/lib/panel/secciones";
import type { PlataEnJuegoDatos } from "@/components/panel/organizacion/PlataEnJuego";
import { ListaHoy, type FilaHoy, type HechoHoy } from "../ListaHoy";

type Socio = { socio_id: string; nombre: string; telefono: string | null; que: "vence" | "debe"; monto: number | string; plan: string | null };
type Transferencia = { pago_id: string; socio_id: string; nombre: string; comprobante: number | string; debe: number | string; plan: string | null; coincide: boolean };
type Aviso = { socio_id: string; nombre: string; telefono: string | null; clave: string; mensaje: string; referencia: string };
type Interesado = { id: string; nombre: string; telefono: string; estado: string; interes: string | null; mensaje: string; creado_en: string };
type Tarea = { id: string; que: string; dia: string; mia: boolean; hecha_en: string | null; socio: string | null };

export default async function ParaHacerHoy() {
  return intentar(async () => {
    const panel = await contextoPanel();
    const { rol } = panel.yo;
    const g = { p_gimnasio_id: panel.gimnasio.id };
    const ve = (ruta: string) => rutaDisponible(ruta, rol, panel.secciones_apagadas);
    const [plata, transferencias, avisos, interesados, tareas, hechos] = await rpcLote(
      lectura<PlataEnJuegoDatos & { socios: Socio[] }>("plata_en_juego", g),
      ve("/panel/transferencias") ? lectura<Transferencia[]>("transferencias_a_revisar", g) : fijo<Transferencia[]>([]),
      ve("/panel/avisos") ? lectura<Aviso[]>("bandeja_avisos", g, true) : fijo<Aviso[] | null>([]),
      ve("/panel/prospectos") ? lectura<Interesado[]>("prospectos_panel", g, true) : fijo<Interesado[] | null>([]),
      lectura<{ hoy: string; tareas: Tarea[] }>("tareas_panel", g),
      lectura<{ hechos: HechoHoy[] }>("hecho_hoy", g),
    );
    const mensajeDe = new Map((avisos ?? []).map((a) => [a.socio_id, a]));
    const filas: FilaHoy[] = [];
    for (const s of plata.socios ?? []) {
      const aviso = mensajeDe.get(s.socio_id);
      filas.push({
        clave: `${s.que}:${s.socio_id}`, tipo: s.que === "vence" ? "vencen" : "cobrar", socioId: s.socio_id, monto: Number(s.monto),
        titulo: s.que === "vence" ? `${s.nombre} vence hoy` : `${s.nombre} debe${s.plan ? ` ${s.plan}` : ""}`,
        linea: s.plan ?? "", telefono: s.telefono, mensaje: aviso?.mensaje ?? null, avisoClave: aviso?.clave ?? (s.que === "vence" ? "por_vencer" : "vencido"),
        avisoReferencia: aviso?.referencia ?? null, cobrar: ve("/panel/vender"),
      });
    }
    for (const t of transferencias) {
      filas.push({
        clave: `transferencia:${t.pago_id}`, tipo: "transferencias", socioId: t.socio_id, monto: Number(t.comprobante), pagoId: t.pago_id,
        titulo: `${t.nombre} mandó comprobante`, linea: `Debe ${formatearPesos(t.debe)}${t.plan ? ` (${t.plan})` : ""} · el comprobante dice ${formatearPesos(t.comprobante)}`,
        coincide: t.coincide,
      });
    }
    for (const p of (interesados ?? []).filter((x) => x.estado === "nuevo")) {
      filas.push({ clave: `interesado:${p.id}`, tipo: "interesados", monto: 0, titulo: `${p.nombre} quiere probar`, linea: p.interes ?? "Sin plan todavía", telefono: p.telefono, mensaje: p.mensaje, manual: true });
    }
    for (const t of tareas.tareas.filter((x) => x.mia && !x.hecha_en && x.dia <= tareas.hoy)) {
      filas.push({ clave: `tarea:${t.id}`, tipo: "tareas", monto: 0, titulo: t.que, linea: t.socio ? `Con ${t.socio}` : "Tarea", tareaId: t.id });
    }
    // Primero lo que deja plata (DISENO.md: "ordenada por plata en juego"), después el resto en su orden.
    filas.sort((a, b) => b.monto - a.monto);
    return (
      <>
        <Encabezado icono="ok" titulo="Para hacer hoy" bajada="Cobrar, avisar, aprobar y contestar, en una sola lista. Primero lo que deja plata." />
        <ListaHoy filas={filas} total={Number(plata.total)} hechos={hechos.hechos} zona={panel.gimnasio.zona_horaria} />
      </>
    );
  });
}
