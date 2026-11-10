import type { Metadata } from "next";
import { BotonPin } from "@/components/panel/BotonPin";
import { Encabezado } from "@/components/panel/Marco";
import { SelectorSede } from "@/components/panel/SelectorSede";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { sedeActiva } from "@/lib/panel/sede";
import type { Ficha } from "../socios/[id]/tipos";
import { Carrito } from "./Carrito";
import type { PreciosVenta } from "./tipos";

export const metadata: Metadata = { title: "Vender" };
type MiCaja = { turno_id: string | null };

export default async function Vender({ searchParams }: { searchParams: Promise<{ socio?: string; sede?: string; cuota?: string; desde?: string }> }) {
  const sp = await searchParams;
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "vender");
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    const { sede, puedeCambiar } = sedeActiva(panel, sp.sede);
    const [precios, miCaja, ficha, stock] = await Promise.all([
      rpc<PreciosVenta>("precios_venta", { p_sede_id: sede.id, p_socio_id: sp.socio ?? null }),
      rpc<MiCaja>("caja_para_cobrar", { p_sede_id: sede.id }),
      sp.socio ? rpc<Ficha>("ficha_socio", { p_socio_id: sp.socio }) : Promise.resolve(null),
      rpc<Record<string, { stock: number; minimo: number | null }>>("stock_productos", { p_gimnasio_id: panel.gimnasio.id }),
    ]);
    // VD-9 / VD-49: el efectivo cae en MI turno de esta sede (con PIN, el de esa persona); uno abierto de otro día (sin contar) no sirve.
    const turno = miCaja.turno_id;
    const socio = ficha ? { socio_id: ficha.socio.id, nombre: `${ficha.socio.nombre} ${ficha.socio.apellido}`.trim(), color: ficha.acceso.color, texto: ficha.acceso.texto } : null;
    return (
      <>
        <Encabezado icono="carrito" titulo="Vender" bajada="Cuotas, pases, packs y productos. El precio lo pone el sistema."
          accion={<BotonPin gimnasioId={panel.gimnasio.id} volver="/panel/vender" />} />
        {puedeCambiar && <SelectorSede sedes={panel.sedes} actual={sede.id} ruta="/panel/vender" />}
        <Carrito sedeId={sede.id} turnoId={turno} socioInicial={socio} preciosIniciales={precios} conCuota={!!socio && sp.cuota === "1"} desdeEntrada={sp.desde === "entrada"}
          puedeAnular={panel.yo.rol === "dueno" || panel.yo.rol === "encargado"} stockInicial={stock}
          sinProductos={panel.yo.rol === "recepcion" && !panel.permisos.recepcion_vende_productos} />
      </>
    );
  });
}
