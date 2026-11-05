import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Hidratado } from "@/components/Hidratado";

// El título y el favicon de cada gimnasio salen de sus datos, en el
// layout de sus paneles. Este es el de la plataforma.
export const metadata: Metadata = {
  title: { default: "Gym OS", template: "%s · Gym OS" },
  description: "Sistema de gestión para gimnasios.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#14161b",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR">
      <body className="antialiased">{children}<Hidratado /></body>
    </html>
  );
}
