import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { traerLanding, urlMarca } from "@/lib/landing";
import { nombreCorto } from "@/lib/nombre-corto";

// PUSH-1: para que el celular la instale como app (en iPhone, las
// notificaciones solo llegan a la app agregada a inicio). Con la marca del gimnasio.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const host = (await headers()).get("x-gimnasio-host");
  const landing = host ? await traerLanding(host).catch(() => null) : null;
  const icono = urlMarca(landing?.marca.favicon_path ?? landing?.marca.logo_path);
  const nombre = landing?.marca.nombre ?? "Base";
  return {
    name: nombre, short_name: nombreCorto(nombre), id: "/app", start_url: "/app", scope: "/", display: "standalone",
    description: landing ? `La app de ${nombre}: tu plan, tus pagos y las clases.` : "La app de tu gimnasio.",
    shortcuts: [{ name: "Mi QR", short_name: "Mi QR", url: "/app", description: "Abrir mi QR para entrar" }, { name: "Mis pagos", short_name: "Pagos", url: "/app/historial" }],
    // Los colores del gimnasio (sin gimnasio, el manifest no fija colores).
    ...(landing ? { background_color: landing.marca.color_fondo, theme_color: landing.marca.color_fondo } : {}), lang: "es-AR",
    // Sin logo: el cuadrado con las iniciales, en 192 y 512 (Android pide el de 512 para ofrecer "Instalar").
    icons: icono ? [{ src: icono, sizes: "any" }] : landing ? [{ src: "/icono", sizes: "192x192", type: "image/png" }, { src: "/icono?tam=512", sizes: "512x512", type: "image/png" }, { src: "/icono?tam=512", sizes: "512x512", type: "image/png", purpose: "maskable" }] : [{ src: "/favicon.ico", sizes: "any" }],
  };
}
