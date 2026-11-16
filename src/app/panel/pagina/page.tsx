import type { Metadata } from "next";
import { headers } from "next/headers";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, lectura, rpcLote } from "@/lib/panel/servidor";
import { traerAgenda, traerClasesSemana } from "@/lib/landing";
import { direccionPagina } from "@/lib/panel/direccion-pagina";
import { Editor, type PaginaPanel, type ReglasImagenes } from "./Editor";
import { Altas, type AltasPanel } from "./Altas";
import { PruebaSocial, type PruebaSocialPanel } from "./PruebaSocial";
import { VideoPortada } from "./VideoPortada";
import { MedicionPagina, type MedicionPanel } from "./MedicionPagina";

export const metadata: Metadata = { title: "Tu página" };

export default async function Pagina() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado"]);
    const host = (await headers()).get("x-gimnasio-host");
    // E8: lo de la base en UN viaje (lote_lecturas); la agenda y las clases de la landing salen de su propio caché, en paralelo.
    const [[pagina, altas, medicion, prueba, datos, crearCuenta], agenda, clases] = await Promise.all([
      rpcLote(
        lectura<PaginaPanel>("pagina_panel", { p_gimnasio_id: panel.gimnasio.id }),
        lectura<AltasPanel>("altas_panel", { p_gimnasio_id: panel.gimnasio.id }),
        lectura<MedicionPanel>("medicion_panel", { p_gimnasio_id: panel.gimnasio.id }),
        lectura<PruebaSocialPanel>("prueba_social_panel", { p_gimnasio_id: panel.gimnasio.id }),
        // Las reglas de las imágenes (tipos y tamaño) las decide la base; el editor las usa para subir el logo y las fotos.
        lectura<{ reglas_imagenes: ReglasImagenes }>("datos_gimnasio_panel", { p_gimnasio_id: panel.gimnasio.id }),
        // D83: si el botón "Crear mi cuenta" se muestra en la página (prendido por defecto).
        lectura<boolean>("crear_cuenta_panel", { p_gimnasio_id: panel.gimnasio.id }),
      ),
      host ? traerAgenda(host) : Promise.resolve(null),
      host ? traerClasesSemana(host) : Promise.resolve([]),
    ]);
    return (
      <>
        <Encabezado icono="web" titulo="Tu página" bajada="Lo que ve la gente antes de hacerse socio. Cambiá logo, colores, letra, fotos y textos, mostrá u ocultá secciones, ordenalas arrastrando y mirá cómo queda al lado antes de guardar." />
        <Editor inicial={pagina} agenda={agenda} clases={clases} reglas={datos.reglas_imagenes} puedeEditar={panel.yo.rol === "dueno"} direccion={await direccionPagina(pagina.vista.marca.slug)}
          altas={<Altas inicial={altas} crearCuenta={crearCuenta} puedeEditar={panel.yo.rol === "dueno"} />} />
        <VideoPortada inicial={pagina.vista.portada?.video_url ?? null} puedeEditar={panel.yo.rol === "dueno"} />
        <PruebaSocial inicial={prueba} puedeEditar={panel.yo.rol === "dueno"} />
        <MedicionPagina inicial={medicion} puedeEditar={panel.yo.rol === "dueno"} />
      </>
    );
  });
}
