import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { LandingGimnasio, LandingOculta } from "@/components/landing/Landing";
import { traerAgenda, traerEventos, traerLanding, traerMedicion, urlMarca } from "@/lib/landing";
import { Medicion } from "@/components/landing/Medicion";
import { datosEstructurados } from "@/lib/datos-estructurados";
import { PlataformaLanding } from "@/components/landing/Plataforma";
import { contactoPlataforma, planesBrikPublicos } from "@/lib/plataforma-venta";
import { linkWhatsapp } from "@/lib/landing-textos";
import capturasGymos from "@/lib/capturas-gymos.json";

// La raíz responde distinto según el host (lo resolvió el middleware):
//   plataforma → la página de Gym OS
//   gimnasio   → la landing de ese gimnasio, con su marca

const landingDelHost = cache(async () => {
  const h = await headers();
  if (h.get("x-gymos-contexto") !== "gimnasio") return { tipo: "plataforma" as const };
  const host = h.get("x-gimnasio-host");
  if (!host) throw new Error("El middleware marcó un gimnasio pero no pasó el host.");
  const [landing, agenda, eventos, medicion] = await Promise.all([traerLanding(host), traerAgenda(host), traerEventos(host), traerMedicion(host)]);
  if (!landing) notFound();
  return { tipo: "gimnasio" as const, landing, agenda, eventos, medicion };
});

export async function generateMetadata(): Promise<Metadata> {
  const r = await landingDelHost();
  if (r.tipo === "plataforma") {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    const origen = `${h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https")}://${host}`;
    const descripcion = "Base responde si el socio puede entrar hoy, te deja cobrar en un toque y te muestra quién dejó de venir. Pedí una demo.";
    return { title: { absolute: "Base · El sistema para tu gimnasio" }, description: descripcion,
             openGraph: { type: "website", title: "Base", description: descripcion, siteName: "Base", locale: "es_AR", images: [{ url: `${origen}/og`, width: 1200, height: 630, alt: "Base" }] },
             twitter: { card: "summary_large_image", title: "Base", description: descripcion, images: [`${origen}/og`] },
             alternates: { canonical: `${origen}/` } };
  }
  const { marca } = r.landing;
  const icono = urlMarca(marca.favicon_path ?? marca.logo_path);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const origen = `${h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https")}://${host}`;
  // Al compartir el link: la foto de portada si hay; si no, la imagen con el nombre y los colores (/og).
  const foto = r.landing.publicada && r.landing.portada.foto_path ? urlMarca(r.landing.portada.foto_path) : null;
  const imagen = foto ?? `${origen}/og`;
  const titulo = r.landing.publicada ? `${marca.nombre} · ${r.landing.portada.titulo}` : marca.nombre;
  const descripcion = r.landing.publicada
    ? r.landing.portada.bajada ?? `${r.landing.portada.titulo}. Planes, horarios y cómo llegar.`
    : `${marca.nombre}. Soy socio · Quiero ser socio.`;   // U4: página oculta por el dueño; nunca un cartel de "en construcción"
  return {
    title: { absolute: titulo },
    description: descripcion,
    // Con logo, el logo; sin logo, el cuadrado con su color y sus iniciales (/icono): nunca una página sin favicon.
    icons: icono ? { icon: icono, apple: icono } : { icon: "/icono", apple: "/icono" },
    openGraph: { type: "website", title: titulo, description: descripcion, siteName: marca.nombre, locale: "es_AR",
                 images: [{ url: imagen, width: foto ? undefined : 1200, height: foto ? undefined : 630, alt: marca.nombre }] },
    twitter: { card: "summary_large_image", title: titulo, description: descripcion, images: [imagen] },
    // Oculta por el dueño: no se indexa.
    robots: r.landing.publicada ? { index: true, follow: true } : { index: false, follow: false },
    alternates: { canonical: `${origen}/` },
  };
}

export default async function Inicio() {
  const r = await landingDelHost();
  if (r.tipo === "gimnasio") {
    if (!r.landing.publicada) return <LandingOculta marca={r.landing.marca} contacto={r.landing.contacto} />;
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    const origen = `${h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https")}://${host}`;
    const ld = datosEstructurados(r.landing, r.agenda, origen, urlMarca(r.landing.marca.logo_path));
    return (
      <>
        {/* Para Google: nombre, dirección, teléfono y horarios del gimnasio. */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld.length === 1 ? ld[0] : ld).replace(/</g, "\\u003c") }} />
        <LandingGimnasio landing={r.landing} agenda={r.agenda} eventos={r.eventos} />
        <Medicion medicion={r.medicion} />
      </>
    );
  }
  // VD-26: la plataforma muestra la página para venderle Gym OS a los dueños. Los precios salen de los planes
  // que BRIK dejó activos en el super admin; si no hay ninguno, no se muestra ningún precio.
  const [planes, contacto] = await Promise.all([planesBrikPublicos(), contactoPlataforma()]);
  // Datos para Google: el producto y, solo si BRIK cargó planes, sus precios (nunca uno inventado).
  const ld = {
    "@context": "https://schema.org", "@type": "SoftwareApplication", name: "Base", applicationCategory: "BusinessApplication", operatingSystem: "Web",
    description: "Sistema de gestión para gimnasios: control de acceso, cobros y retención de socios.",
    ...(planes.length ? { offers: planes.map((p) => ({ "@type": "Offer", name: p.nombre, price: Number(p.precio_mensual), priceCurrency: "ARS" })) } : {}),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <PlataformaLanding planes={planes} linkDemo={linkWhatsapp(contacto.whatsapp, contacto.mensaje_demo)} capturas={capturasGymos} />
    </>
  );
}
