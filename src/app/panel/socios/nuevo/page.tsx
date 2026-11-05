import type { Metadata } from "next";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { FormSocio, type PlanAlta } from "../FormSocio";
import { rutaDisponible } from "@/lib/panel/secciones";

export const metadata: Metadata = { title: "Nuevo socio" };

type Prospecto = { id: string; nombre: string; telefono: string; estado: string };

export default async function NuevoSocio({ searchParams }: { searchParams: Promise<{ prospecto?: string }> }) {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "socios");
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    // "Hacerlo socio" desde Prospectos: el alta arranca con su nombre y WhatsApp, y al guardar queda atado.
    const { prospecto: prospectoId } = await searchParams;
    const prospecto = prospectoId
      ? (await rpc<Prospecto[]>("prospectos_panel", { p_gimnasio_id: panel.gimnasio.id })).find((x) => x.id === prospectoId && x.estado !== "socio") ?? null
      : null;
    if (prospectoId && !prospecto) throw new Error("Ese prospecto no existe o ya es socio. Volvé a Prospectos.");
    const [nombre, ...resto] = (prospecto?.nombre ?? "").split(" ");
    const planes = (await rpc<(PlanAlta & { tipo: string; activo: boolean })[]>("planes_gimnasio", { p_gimnasio_id: panel.gimnasio.id }))
      .filter((p) => p.tipo === "membresia" && p.activo);
    const puedeCobrar = rutaDisponible("/panel/vender", panel.yo.rol, panel.secciones_apagadas);
    return (
      <>
        <Encabezado volver={{ href: "/panel/socios", texto: "Socios" }} emoji="➕" titulo="Nuevo socio" bajada="Con el nombre alcanza. El resto lo podés completar después." />
        <FormSocio socioId={null} prospectoId={prospecto?.id} planes={planes} puedeCobrar={puedeCobrar} socio={prospecto ? { nombre, apellido: resto.join(" ") || null, telefono: prospecto.telefono } : undefined} />
      </>
    );
  });
}
