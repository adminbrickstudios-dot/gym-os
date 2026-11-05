import type { MetadataRoute } from "next";
import { hostPublico } from "@/lib/host-publico";

export const dynamic = "force-dynamic";

/** Las páginas públicas del gimnasio de esta dirección (vacío si no está publicada). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { origen, esGimnasio, publicada, altas } = await hostPublico();
  if (!esGimnasio || !publicada) return [];
  return [
    { url: `${origen}/`, changeFrequency: "weekly", priority: 1 },
    ...(altas ? [{ url: `${origen}/hacete-socio`, changeFrequency: "monthly" as const, priority: 0.8 }] : []),
  ];
}
