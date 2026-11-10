import type { Metadata } from "next";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, rpc } from "@/lib/panel/servidor";
import { LinkPanel } from "@/components/panel/LinkPanel";
import { EditorDocumentos, type Documento } from "./Documentos";
import { Icono } from "@/components/ui/Icono";

export const metadata: Metadata = { title: "Documentos para firmar" };

/** COM-6: los textos que firman los socios, con su versión. */
export default async function PaginaDocumentos() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado"]);
    const [documentos, mayores] = await Promise.all([
      rpc<Documento[]>("documentos_panel", { p_gimnasio_id: panel.gimnasio.id }),
      // VD-46R: los que cumplieron 18 y todavía no firmaron ellos mismos.
      rpc<{ socio_id: string; nombre: string; cumplio_18: string; documentos: number }[]>("firmas_propias_pendientes", { p_gimnasio_id: panel.gimnasio.id }),
    ]);
    return (
      <>
        <Encabezado icono="lapiz" titulo="Documentos para firmar" volver={{ href: "/panel/configuracion?pestana=reglas", texto: "Configuración" }}
          bajada="Reglamento, deslinde y autorización de menores. El socio firma en la app o en recepción; en la Entrada, al que le falta firmar le sale un aviso (no lo frena)." />
        {mayores.length > 0 && (
          <section className="mb-8 space-y-2" data-firmas-propias>
            <h2 className="titulo text-2xl"><Icono nombre="persona" /> Cumplieron 18: tienen que firmar ellos</h2>
            <p className="texto-suave">Lo que firmó su responsable de menor no alcanza. Abrí la ficha y que firme la propia persona (en recepción o desde su app).</p>
            <ul className="tarjeta divide-y divide-[var(--borde)]">{mayores.map((m) => (
              <li key={m.socio_id} className="flex flex-wrap justify-between gap-x-3 px-4 py-3">
                <LinkPanel href={`/panel/socios/${m.socio_id}`} siNoEsta="texto" className="underline min-w-0 truncate">{m.nombre}</LinkPanel>
                <span className="texto-suave text-sm">cumplió 18 el {m.cumplio_18.split("-").reverse().join("/")} · {m.documentos} {m.documentos === 1 ? "documento" : "documentos"}</span>
              </li>
            ))}</ul>
          </section>
        )}
        <EditorDocumentos documentos={documentos} puedeEditar={panel.yo.rol === "dueno"} />
      </>
    );
  });
}
