import type { Metadata } from "next";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { Pendiente } from "./Pendiente";
import { Vacio } from "@/components/ui/Vacio";

export const metadata: Metadata = { title: "Transferencias" };
type Fila = { pago_id: string; socio_id: string; socio: string; monto: number; descripcion: string | null; informado_en: string };

export default async function Transferencias() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "transferencias");
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    const filas = await rpc<Fila[]>("pagos_por_aprobar", { p_gimnasio_id: panel.gimnasio.id });
    const cuando = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: panel.gimnasio.zona_horaria, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
    return (
      <>
        <Encabezado emoji="🧾" titulo="Transferencias" bajada="Socios que pagaron por transferencia y subieron el comprobante. Mirá que haya llegado y aprobala." />
        {filas.length === 0 ? <Vacio emoji="✨" titulo="Nada para revisar">Cuando un socio pague por transferencia desde su app y suba el comprobante, aparece acá para que lo apruebes.</Vacio> : (
          <ul className="space-y-2">{filas.map((p) => <Pendiente key={p.pago_id} p={p} cuando={cuando(p.informado_en)} />)}</ul>
        )}
      </>
    );
  });
}
