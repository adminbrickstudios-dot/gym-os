import type { Metadata } from "next";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { FormSocio } from "../../FormSocio";
import type { Ficha } from "../tipos";

export const metadata: Metadata = { title: "Editar socio" };

export default async function EditarSocio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    exigirSeccion(panel, "socios");
    const f = await rpc<Ficha>("ficha_socio", { p_socio_id: id });
    return (
      <>
        <Encabezado volver={{ href: `/panel/socios/${id}`, texto: "Ficha del socio" }} icono="lapiz" titulo={`${f.socio.nombre} ${f.socio.apellido}`.trim()} bajada="Editá sus datos." />
        <FormSocio socioId={id} socio={f.socio} />
      </>
    );
  });
}
