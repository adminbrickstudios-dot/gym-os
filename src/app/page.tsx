import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { LandingGimnasio, LandingProximamente } from "@/components/landing/Landing";
import { traerAgenda, traerEventos, traerLanding, traerMedicion, urlMarca } from "@/lib/landing";
import { Medicion } from "@/components/landing/Medicion";
import { datosEstructurados } from "@/lib/datos-estructurados";
import { PlataformaLanding } from "@/components/landing/Plataforma";
import { planesBrikPublicos } from "@/lib/plataforma-venta";

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
    const descripcion = "Gym OS responde si el socio puede entrar hoy, te deja cobrar en un toque y te muestra quién dejó de venir. Pedí una demo.";
    return { title: { absolute: "Gym OS · El sistema para tu gimnasio" }, description: descripcion,
             openGraph: { type: "website", title: "Gym OS", description: descripcion, locale: "es_AR" } };
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
    : "Estamos armando nuestra página. Escribinos por WhatsApp.";
  return {
    title: { absolute: titulo },
    description: descripcion,
    icons: icono ? { icon: icono, apple: icono } : undefined,
    openGraph: { type: "website", title: titulo, description: descripcion, siteName: marca.nombre, locale: "es_AR",
                 images: [{ url: imagen, width: foto ? undefined : 1200, height: foto ? undefined : 630, alt: marca.nombre }] },
    twitter: { card: "summary_large_image", title: titulo, description: descripcion, images: [imagen] },
    // Sin publicar no se indexa: Google no guarda un "Estamos armando nuestra página".
    robots: r.landing.publicada ? { index: true, follow: true } : { index: false, follow: false },
    alternates: { canonical: `${origen}/` },
  };
}

export default async function Inicio() {
  const r = await landingDelHost();
  if (r.tipo === "gimnasio") {
    if (!r.landing.publicada) return <LandingProximamente marca={r.landing.marca} contacto={r.landing.contacto} />;
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
  return <PlataformaLanding planes={await planesBrikPublicos()} />;
}
