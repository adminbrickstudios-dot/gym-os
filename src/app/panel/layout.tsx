import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { Aviso } from "@/components/panel/Marco";
import { Marco } from "@/components/panel/Marco";
import { dominioPlataforma } from "@/lib/dominios";
import { normalizarHost } from "@/lib/host";
import { urlMarca } from "@/lib/landing";
import { contextoPanel, ErrorDatos } from "@/lib/panel/servidor";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const p = await contextoPanel();
    const icono = urlMarca(p.marca.favicon_path ?? p.marca.logo_path);
    return { title: { default: p.gimnasio.nombre, template: `%s · ${p.gimnasio.nombre}` }, icons: icono ? { icon: icono } : undefined, robots: { index: false, follow: false } };
  } catch {
    return { title: "Panel", robots: { index: false, follow: false } };
  }
}

export default async function LayoutPanel({ children }: { children: ReactNode }) {
  // En la dirección de la plataforma (sin subdominio) se puede volver a elegir gimnasio.
  const enPlataforma = normalizarHost((await headers()).get("host")) === dominioPlataforma();
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
              <div className="mt-6 flex flex-wrap gap-2">
                {enPlataforma && <Link href="/elegir" className="boton boton-principal">🔁 Elegir otro gimnasio</Link>}
                <form action="/salir" method="post"><button className="boton">🚪 Cerrar sesión</button></form>
              </div>
            </Aviso>
          </div>
        </main>
      );
    }
    throw e;
  }
  return <Marco panel={panel} enPlataforma={enPlataforma}>{children}</Marco>;
}
