import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { rpc } from "@/lib/panel/servidor";
import { PlataformaNueva } from "@/components/landing/PlataformaNueva";
import { contactoPlataforma, planesBrikPublicos } from "@/lib/plataforma-venta";
import { linkWhatsapp } from "@/lib/landing-textos";
import capturasGymos from "@/lib/capturas-gymos.json";
import { LlaveLandingVenta } from "./LlaveLandingVenta";

export const metadata: Metadata = { title: "BRIK · Vista previa de la landing", robots: { index: false, follow: false } };

/** Vuelta final (22/11): la página de venta nueva, para el super admin, con su llave. admin_landing_venta da error a cualquier otro. */
export default async function VistaLanding() {
  if ((await headers()).get("x-gymos-contexto") !== "plataforma") redirect("/");
  const [prendida, planes, contacto] = await Promise.all([rpc<boolean>("admin_landing_venta"), planesBrikPublicos(), contactoPlataforma()]);
  return (
    <>
      <div className="mx-auto max-w-5xl px-5 pt-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin" className="texto-suave">← Tablero</Link>
        <LlaveLandingVenta prendida={prendida} />
      </div>
      <PlataformaNueva planes={planes} linkWhatsapp={linkWhatsapp(contacto.whatsapp, contacto.mensaje_demo)} capturas={capturasGymos} vistaPrevia={!prendida} />
    </>
  );
}
