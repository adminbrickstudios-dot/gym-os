import type { Metadata } from "next";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { ErrorDatos, contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { FormSocio, type PlanAlta } from "../FormSocio";
import { rutaDisponible } from "@/lib/panel/secciones";
import { sedeActiva } from "@/lib/panel/sede";

export const metadata: Metadata = { title: "Nuevo socio" };

type Prospecto = { id: string; nombre: string; telefono: string; dni?: string | null; estado: string };

export default async function NuevoSocio({ searchParams }: { searchParams: Promise<{ prospecto?: string; listo?: string; cobrar?: string }> }) {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "socios");
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    // "Hacerlo socio" desde Prospectos: el alta arranca con su nombre y WhatsApp, y al guardar queda atado.
    const { prospecto: prospectoId, listo, cobrar } = await searchParams;
    // VD-6: vuelve de un Interesado con el alta ya hecha: sigue en el cobro, sin volver a pedir los datos.
    if (listo) {
      const ficha = await rpc<{ socio: { nombre: string; apellido: string } }>("ficha_socio", { p_socio_id: listo });
      return (
        <>
          <Encabezado volver={{ href: "/panel/socios", texto: "Socios" }} volverAlOrigen icono="mas" titulo="Nuevo socio" bajada="El alta ya está hecha." />
          <FormSocio socioId={null} creado={{ socioId: listo, nombre: `${ficha.socio.nombre} ${ficha.socio.apellido}`.trim(), cobrar: cobrar === "1" }} />
        </>
      );
    }
    const prospecto = prospectoId
      ? (await rpc<Prospecto[]>("prospectos_panel", { p_gimnasio_id: panel.gimnasio.id })).find((x) => x.id === prospectoId) ?? null
      : null;
    if (prospectoId && !prospecto) throw new ErrorDatos("Ese interesado no existe. Volvé a Interesados.");
    const [nombre, ...resto] = (prospecto?.nombre ?? "").split(" ");
    // Las membresías con su primer pago (cuota + matrícula), calculado por la base.
    const planes = await rpc<PlanAlta[]>("planes_para_alta", { p_sede_id: sedeActiva(panel).sede.id });
    const puedeCobrar = rutaDisponible("/panel/vender", panel.yo.rol, panel.secciones_apagadas);
    return (
      <>
        <Encabezado volver={{ href: "/panel/socios", texto: "Socios" }} volverAlOrigen icono="mas" titulo="Nuevo socio" bajada="Con el nombre alcanza. El resto lo podés completar después." />
        <FormSocio socioId={null} prospectoId={prospecto?.id} planes={planes} puedeCobrar={puedeCobrar} socio={prospecto ? { nombre, apellido: resto.join(" ") || null, telefono: prospecto.telefono, dni: prospecto.dni ?? null } : undefined} />
      </>
    );
  });
}
