import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Hidratado } from "@/components/Hidratado";

// El título y el favicon de cada gimnasio salen de sus datos, en el
// layout de sus paneles. Este es el de la plataforma.
export const metadata: Metadata = {
  title: { default: "Base", template: "%s · Base" },
  description: "Sistema de gestión para gimnasios.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR" className={`${barlow.variable} ${barlowCondensada.variable}`}>
      <body className="antialiased">{children}<Hidratado /></body>
    </html>
  );
}
