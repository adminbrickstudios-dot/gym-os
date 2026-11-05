import type { Metadata } from "next";
import { Encabezado } from "@/components/panel/Marco";
import { SelectorSede } from "@/components/panel/SelectorSede";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { sedeActiva } from "@/lib/panel/sede";
import type { Ficha } from "../socios/[id]/tipos";
import { Carrito } from "./Carrito";
import type { PreciosVenta } from "./tipos";

export const metadata: Metadata = { title: "Vender" };
type Caja = { caja_id: string; nombre: string; activa: boolean; turno_id: string | null };

export default async function Vender({ searchParams }: { searchParams: Promise<{ socio?: string; sede?: string; cuota?: string; desde?: string }> }) {
  const sp = await searchParams;
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "vender");
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    const { sede, puedeCambiar } = sedeActiva(panel, sp.sede);
    const [precios, cajas, ficha] = await Promise.all([
      rpc<PreciosVenta>("precios_venta", { p_sede_id: sede.id, p_socio_id: sp.socio ?? null }),
      rpc<Caja[]>("cajas_sede", { p_sede_id: sede.id }),
      sp.socio ? rpc<Ficha>("ficha_socio", { p_socio_id: sp.socio }) : Promise.resolve(null),
    ]);
    const turno = cajas.find((c) => c.turno_id)?.turno_id ?? null;
    const socio = ficha ? { socio_id: ficha.socio.id, nombre: `${ficha.socio.nombre} ${ficha.socio.apellido}`.trim(), color: ficha.acceso.color, texto: ficha.acceso.texto } : null;
    return (
      <>
        <Encabezado emoji="🛒" titulo="Vender" bajada="Cuotas, pases, packs y productos. El precio lo pone el sistema." />
        {puedeCambiar && <SelectorSede sedes={panel.sedes} actual={sede.id} ruta="/panel/vender" />}
        <Carrito sedeId={sede.id} turnoId={turno} socioInicial={socio} preciosIniciales={precios} conCuota={!!socio && sp.cuota === "1"} desdeEntrada={sp.desde === "entrada"} />
      </>
    );
  });
}
