import type { MetadataRoute } from "next";
import { hostPublico } from "@/lib/host-publico";

export const dynamic = "force-dynamic";

/** Las páginas públicas del gimnasio de esta dirección (vacío si no está publicada). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { origen, esGimnasio, publicada, altas } = await hostPublico();
  // La dirección de la plataforma: la página de Gym OS.
  if (!esGimnasio) return [{ url: `${origen}/`, changeFrequency: "monthly", priority: 1 }];
  if (!publicada) return [];
  return [
    { url: `${origen}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${origen}/privacidad`, changeFrequency: "yearly" as const, priority: 0.3 },
    ...(altas ? [{ url: `${origen}/hacete-socio`, changeFrequency: "monthly" as const, priority: 0.8 }] : []),
  ];
}
