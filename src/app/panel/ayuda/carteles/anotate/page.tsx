import type { Metadata } from "next";
import QRCode from "qrcode";
import { BotonImprimir } from "@/components/ayuda/BotonImprimir";
import { CartelA4, PasosCartel } from "@/components/ayuda/CartelA4";
import { Encabezado } from "@/components/panel/Marco";
import { PASOS_ANOTATE, PIE_ANOTATE } from "@/lib/carteles";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, rpcLectura } from "@/lib/panel/servidor";
import { urlGimnasio } from "@/lib/urls";
import type { QrAltaPanel } from "./acciones";
import { Controles } from "./Controles";

export const metadata: Metadata = { title: "Cartel Anotate acá" };

/**
 * C9: el cartel A4 "Anotate acá" y el link para WhatsApp. El QR abre /hacete-socio del gimnasio (el host ya dice cuál es: no pasa por la
 * landing). La dirección sale de lib/urls.ts, nunca escrita a mano. El plan sugerido NO va en el QR: lo lee la página de la base, así el
 * dueño lo cambia sin reimprimir.
 */
export default async function CartelAnotate() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado"]);
    const datos = await rpcLectura<QrAltaPanel>("qr_alta_panel", { p_gimnasio_id: panel.gimnasio.id });
    const url = urlGimnasio(panel.gimnasio.slug, "/hacete-socio");
    const completa = /^https?:\/\//.test(url);
    const svg = completa ? await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M" }) : null;
    return (
      <>
        <Encabezado icono="persona" titulo="Cartel “Anotate acá”" bajada="Un QR que abre directo el formulario para hacerse socio, y el link para mandar por WhatsApp." volver={{ href: "/panel/ayuda/carteles", texto: "Carteles" }} />
        <div className="space-y-5">
          <Controles inicial={datos} puedeEditar={panel.yo.rol === "dueno"} url={url} nombre={panel.gimnasio.nombre} />
          {svg ? (
            <>
              <div className="flex flex-wrap gap-3 items-center" data-no-imprimir>
                <BotonImprimir />
                <p className="texto-suave text-sm">Se guarda como PDF desde la ventana de impresión. Elegí hoja A4, sin márgenes y con gráficos de fondo.</p>
              </div>
              <CartelA4 nombre={panel.gimnasio.nombre} logoPath={panel.marca.logo_path} acento={panel.marca.color_acento} pie={<>{PIE_ANOTATE}</>}>
                <h2 className="cartel-titulo titular">Anotate acá</h2>
                <div className="cartel-qr" data-qr-anotate={url} aria-label={`QR de ${url}`} dangerouslySetInnerHTML={{ __html: svg }} />
                <p className="cartel-url">{url}</p>
                <PasosCartel pasos={PASOS_ANOTATE} />
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
