import type { Metadata } from "next";
import { fechaHoraHumana } from "@/lib/formato";
import { ActualizarSola } from "@/components/ui/ActualizarSola";
import { Encabezado } from "@/components/panel/Marco";
import { Pestanas } from "@/components/ui/Pestanas";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { Mostrador, type ListaMostrador } from "./Mostrador";
import { Pendiente } from "./Pendiente";
import { RevisarMP } from "./RevisarMP";
import { Vacio } from "@/components/ui/Vacio";

export const metadata: Metadata = { title: "Transferencias" };
type Fila = { pago_id: string; socio_id: string; socio: string; monto: number; descripcion: string | null; informado_en: string };

export default async function Transferencias({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const sp = await searchParams;
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "transferencias");
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    const [filas, mostrador] = await Promise.all([
      rpc<Fila[]>("pagos_por_aprobar", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<ListaMostrador>("cobradas_en_mostrador", { p_gimnasio_id: panel.gimnasio.id, p_dias: 30 }),
    ]);
    // H1 (VD-5C): dos listas que no se mezclan. Los comprobantes que suben los socios se aprueban; lo cobrado en el mostrador ya está cobrado y se chequea contra el banco.
    const enMostrador = sp.ver === "mostrador";
    // VD-46A: el dueño y el encargado pueden revisar con MercadoPago si el gimnasio lo tiene conectado.
    const puedeRevisar = panel.yo.rol === "dueno" || panel.yo.rol === "encargado";
    const mp = !enMostrador && puedeRevisar ? await rpc<{ conectado: boolean }>("estado_pagos_online", { p_gimnasio_id: panel.gimnasio.id }) : null;
    const cuando = (m: string) => fechaHoraHumana(m, panel.gimnasio.zona_horaria);
    return (
      <>
        <ActualizarSola />
        <Encabezado icono="recibo" titulo="Transferencias"
          bajada={enMostrador ? "Lo que se cobró por transferencia en el mostrador. Mirá que haya llegado al banco y tildala." : "Socios que pagaron por transferencia y subieron el comprobante. Mirá que haya llegado y aprobala."} />
        <Pestanas etiqueta="Transferencias" activa={enMostrador ? "mostrador" : "comprobantes"} pestanas={[
          { clave: "comprobantes", texto: `Comprobantes de socios${filas.length ? ` (${filas.length})` : ""}`, href: "/panel/transferencias" },
          { clave: "mostrador", texto: `Cobradas en el mostrador${mostrador.sin_ver_cantidad ? ` (${mostrador.sin_ver_cantidad} sin ver)` : ""}`, href: "/panel/transferencias?ver=mostrador" },
        ]} />
        {enMostrador ? <Mostrador lista={mostrador} zona={panel.gimnasio.zona_horaria} /> : (
          <>
            {mp?.conectado && <div className="mb-4"><RevisarMP /></div>}
            {filas.length === 0 ? <Vacio icono="estrella" titulo="Nada para revisar">Cuando un socio pague por transferencia desde su app y suba el comprobante, aparece acá para que lo apruebes.</Vacio> : (
              <ul className="space-y-2">{filas.map((p) => <Pendiente key={p.pago_id} p={p} cuando={cuando(p.informado_en)} />)}</ul>
            )}
          </>
        )}
      </>
    );
  });
}
