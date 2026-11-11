import type { Metadata } from "next";
import QRCode from "qrcode";
import { BotonImprimir } from "@/components/ayuda/BotonImprimir";
import { CartelA4, PasosCartel } from "@/components/ayuda/CartelA4";
import { Encabezado } from "@/components/panel/Marco";
import { PASOS_DESCARGAR_APP } from "@/lib/carteles";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol } from "@/lib/panel/servidor";
import { urlGimnasio } from "@/lib/urls";

export const metadata: Metadata = { title: "Cartel Descargá la app" };

/** C4: el cartel A4 "Descargá la app", con el QR de la página del gimnasio. La dirección sale de lib/urls.ts, nunca escrita a mano. */
export default async function CartelApp() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado"]);
    const url = urlGimnasio(panel.gimnasio.slug);
    // Sin dirección completa (falta cargar el dominio de la plataforma) el QR no llevaría a ningún lado: se dice, no se imprime algo roto.
    const completa = /^https?:\/\//.test(url);
    const svg = completa ? await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M" }) : null;
    return (
      <>
        <Encabezado icono="celular" titulo="Cartel “Descargá la app”" bajada="Una hoja A4 con el QR de tu página, para que los socios se bajen la app." volver={{ href: "/panel/ayuda/carteles", texto: "Carteles" }} />
        <div className="space-y-5">
          {svg ? (
            <>
              <div className="flex flex-wrap gap-3 items-center" data-no-imprimir>
                <BotonImprimir />
                <p className="texto-suave text-sm">Se guarda como PDF desde la ventana de impresión. Elegí hoja A4, sin márgenes y con gráficos de fondo.</p>
              </div>
              <CartelA4 nombre={panel.gimnasio.nombre} logoPath={panel.marca.logo_path} acento={panel.marca.color_acento}
                pie={<>Después de entrar, la app queda en tu pantalla de inicio.</>}>
                <h2 className="cartel-titulo titular">Descargá la app de {panel.gimnasio.nombre}</h2>
                <div className="cartel-qr" data-qr-app={url} aria-label={`QR de ${url}`} dangerouslySetInnerHTML={{ __html: svg }} />
                <p className="cartel-url">{url}</p>
                <PasosCartel pasos={PASOS_DESCARGAR_APP} />
              </CartelA4>
            </>
          ) : (
            <p role="alert" className="pildora pildora-rojo whitespace-normal max-w-2xl" data-cartel-sin-direccion>
              Todavía no hay una dirección completa para la página del gimnasio ({url}). Falta cargar el dominio de la plataforma; con eso el QR ya sale.
            </p>
          )}
        </div>
      </>
    );
  });
}
