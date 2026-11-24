import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import localFont from "next/font/local";
import "./globals.css";
import { Hidratado } from "@/components/Hidratado";
import { NOMBRE_PRODUCTO } from "@/lib/producto";

// El título y el favicon de cada gimnasio salen de sus datos, en el
// layout de sus paneles. Este es el de la plataforma.
export const metadata: Metadata = {
  title: { default: NOMBRE_PRODUCTO, template: `%s · ${NOMBRE_PRODUCTO}` },
  description: "Sistema de gestión para gimnasios.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Regla 18 de FLUIDEZ: con el teclado abierto la página se achica (no se tapa con él): el botón de guardar y la barra de abajo quedan a la vista.
  interactiveWidget: "resizes-content",
  themeColor: "#F4F5F6",
};

// Barlow para el texto y Barlow Condensed para títulos y números (DISENO.md): archivos propios, sin pedidos a Google.
const barlow = localFont({
  src: [{ path: "./fuentes/barlow-latin-400-normal.woff2", weight: "400" }, { path: "./fuentes/barlow-latin-500-normal.woff2", weight: "500" }],
  variable: "--font-barlow", display: "swap",
});
const barlowCondensada = localFont({
  src: [{ path: "./fuentes/barlow-condensed-latin-600-normal.woff2", weight: "600" }, { path: "./fuentes/barlow-condensed-latin-700-normal.woff2", weight: "700" }],
  variable: "--font-barlow-condensed", display: "swap",
});

// Pase 2.0 (Pista): títulos y números grandes en Big Shoulders Display 800, un solo archivo propio (OFL, ver fuentes/LICENCIA-BigShoulders.txt). Sin preload:
// solo lo piden las pantallas de Pista, y el estilo clásico no tiene que bajar nada de más (font-display: swap con respaldo condensado).
const bigShoulders = localFont({
  src: [{ path: "./fuentes/big-shoulders-display-latin-800-normal.woff2", weight: "800" }],
  variable: "--font-big-shoulders", display: "swap", preload: false,
});

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Pase 2.0: el estilo del gimnasio (la llave por gimnasio) lo pone el servidor en el <html>: nunca se ve el estilo viejo antes del nuevo.
  // Sale de la dirección que ya resolvió el proxy (no es un viaje más a la base). Sin gimnasio (la plataforma) es el clásico.
  const cab = await headers();
  const estilo = cab.get("x-gimnasio-estilo") === "pista" ? "pista" : "clasico";
  // El modo de Pista: lo que eligió la persona en Mi cuenta (cookie `tema`, D37) manda; si no, el del gimnasio (oscuro por defecto).
  const tema = (await cookies()).get("tema")?.value;
  const modo = tema === "claro" || tema === "oscuro" ? tema : cab.get("x-gimnasio-modo") === "claro" ? "claro" : "oscuro";
  // Pista Semáforo (24/11): solo con el estilo Pista y la llave pista_semaforo del gimnasio. Sin el atributo, Pista queda como estaba.
  const semaforo = estilo === "pista" && cab.get("x-gimnasio-semaforo") === "si" ? "si" : undefined;
  return (
    <html lang="es-AR" data-estilo={estilo} data-modo={modo} data-semaforo={semaforo} className={`${barlow.variable} ${barlowCondensada.variable} ${bigShoulders.variable}`}>
      <body className="antialiased">{children}<Hidratado /></body>
    </html>
  );
}
