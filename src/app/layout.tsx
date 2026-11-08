import type { Metadata, Viewport } from "next";
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR">
      <body className="antialiased">{children}<Hidratado /></body>
    </html>
  );
}
