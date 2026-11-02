import type { Metadata } from "next";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion } from "@/lib/panel/servidor";
import { FormSocio } from "../FormSocio";

export const metadata: Metadata = { title: "Nuevo socio" };

export default async function NuevoSocio() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "socios");
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    return (
      <>
        <Encabezado emoji="➕" titulo="Nuevo socio" bajada="Con el nombre alcanza. El resto lo podés completar después." />
        <FormSocio socioId={null} />
      </>
    );
  });
}
