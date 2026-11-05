import type { MetadataRoute } from "next";
import { hostPublico } from "@/lib/host-publico";

export const dynamic = "force-dynamic";

// Cada dirección tiene el suyo: la página publicada de un gimnasio se indexa
// (menos el panel, la app y el ingreso); sin publicar, nada.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const { origen, esGimnasio, publicada } = await hostPublico();
  if (esGimnasio && !publicada) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/panel", "/app", "/admin", "/ingresar", "/entrar", "/elegir", "/salir"] },
    sitemap: esGimnasio ? `${origen}/sitemap.xml` : undefined,
  };
}
