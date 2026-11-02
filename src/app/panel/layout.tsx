import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Aviso } from "@/components/panel/Marco";
import { Marco } from "@/components/panel/Marco";
import { urlMarca } from "@/lib/landing";
import { contextoPanel, ErrorDatos } from "@/lib/panel/servidor";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const p = await contextoPanel();
    const icono = urlMarca(p.marca.favicon_path ?? p.marca.logo_path);
    return { title: { default: p.gimnasio.nombre, template: `%s · ${p.gimnasio.nombre}` }, icons: icono ? { icon: icono } : undefined };
  } catch {
    return { title: "Panel" };
  }
}

export default async function LayoutPanel({ children }: { children: ReactNode }) {
  let panel;
  try {
    panel = await contextoPanel();
  } catch (e) {
    if (e instanceof ErrorDatos && e.sinPermiso) {
      return (
        <main className="min-h-dvh flex items-center px-4">
          <div className="mx-auto w-full max-w-xl">
            <Aviso emoji="🔒" titulo="No tenés acceso a este gimnasio">
              Tu usuario no es parte del equipo acá. Si debería serlo, pedile al dueño que te agregue.
              <form action="/salir" method="post" className="mt-6"><button className="boton">🚪 Cerrar sesión</button></form>
            </Aviso>
          </div>
        </main>
      );
    }
    throw e;
  }
  return <Marco panel={panel}>{children}</Marco>;
}
