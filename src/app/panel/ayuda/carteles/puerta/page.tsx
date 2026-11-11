import type { Metadata } from "next";
import { BotonImprimir } from "@/components/ayuda/BotonImprimir";
import { CartelA4, PasosCartel } from "@/components/ayuda/CartelA4";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { cartelPuerta } from "@/lib/carteles";
import { contextoPanel, exigirRol, rpcLectura } from "@/lib/panel/servidor";

export const metadata: Metadata = { title: "Cartel de la puerta" };

/** C4: el cartel A4 de la puerta. Lo que dice sale de cómo entra la gente en ESTE gimnasio (Configuración, Reglas). */
export default async function CartelPuerta() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado"]);
    const formas = await rpcLectura<string[]>("formas_de_entrada", { p_gimnasio_id: panel.gimnasio.id });
    const c = cartelPuerta(formas, panel.gimnasio.nombre);
    return (
      <>
        <Encabezado icono="puerta" titulo="Cartel de la puerta" bajada="Una hoja A4 para pegar donde la gente entra." volver={{ href: "/panel/ayuda/carteles", texto: "Carteles" }} />
        <div className="space-y-5">
          <div className="flex flex-wrap gap-3 items-center" data-no-imprimir>
            <BotonImprimir />
            <p className="texto-suave text-sm">Se guarda como PDF desde la ventana de impresión. Elegí hoja A4, sin márgenes y con gráficos de fondo.</p>
          </div>
          {c.aviso && <p className="pildora whitespace-normal max-w-2xl" data-no-imprimir data-cartel-aviso>{c.aviso}</p>}
          <CartelA4 nombre={panel.gimnasio.nombre} logoPath={panel.marca.logo_path} acento={panel.marca.color_acento}
            pie={<>{c.pie}</>}>
            <h2 className="cartel-titulo titular">{c.titulo}</h2>
            {c.pasos.length > 0 && <PasosCartel pasos={c.pasos} />}
          </CartelA4>
        </div>
      </>
    );
  });
}
