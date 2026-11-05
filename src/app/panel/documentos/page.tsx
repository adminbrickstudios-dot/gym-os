import type { Metadata } from "next";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, rpc } from "@/lib/panel/servidor";
import { EditorDocumentos, type Documento } from "./Documentos";

export const metadata: Metadata = { title: "Documentos para firmar" };

/** COM-6: los textos que firman los socios, con su versión. */
export default async function PaginaDocumentos() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado"]);
    const documentos = await rpc<Documento[]>("documentos_panel", { p_gimnasio_id: panel.gimnasio.id });
    return (
      <>
        <Encabezado emoji="✍️" titulo="Documentos para firmar" volver={{ href: "/panel/configuracion?pestana=reglas", texto: "Configuración" }}
          bajada="Reglamento, deslinde y autorización de menores. El socio firma en la app o en recepción; en la Entrada, al que le falta firmar le sale un aviso (no lo frena)." />
        <EditorDocumentos documentos={documentos} puedeEditar={panel.yo.rol === "dueno"} />
      </>
    );
  });
}
