import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { traerLanding, urlMarca } from "@/lib/landing";

// PUSH-1: para que el celular la instale como app (en iPhone, las
// notificaciones solo llegan a la app agregada a inicio). Con la marca del gimnasio.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const host = (await headers()).get("x-gimnasio-host");
  const landing = host ? await traerLanding(host).catch(() => null) : null;
  const icono = urlMarca(landing?.marca.favicon_path ?? landing?.marca.logo_path);
  const nombre = landing?.marca.nombre ?? "Gym OS";
  return {
    name: nombre, short_name: nombre.slice(0, 12), start_url: "/app", scope: "/", display: "standalone",
    // Los colores del gimnasio (sin gimnasio, el manifest no fija colores).
    ...(landing ? { background_color: landing.marca.color_fondo, theme_color: landing.marca.color_fondo } : {}), lang: "es-AR",
    icons: icono ? [{ src: icono, sizes: "any" }] : [{ src: "/favicon.ico", sizes: "any" }],
  };
}
