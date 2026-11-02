import type { Metadata } from "next";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol } from "@/lib/panel/servidor";
import { FormSocio } from "../FormSocio";

export const metadata: Metadata = { title: "Nuevo socio" };

export default async function NuevoSocio() {
  return intentar(async () => {
    exigirRol(await contextoPanel(), ["dueno", "encargado", "recepcion"]);
    return (
      <>
        <Encabezado emoji="➕" titulo="Nuevo socio" bajada="Con el nombre alcanza. El resto lo podés completar después." />
        <FormSocio socioId={null} />
      </>
    );
  });
}
