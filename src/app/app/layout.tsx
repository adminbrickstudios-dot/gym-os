import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { traerLanding, urlMarca } from "@/lib/landing";
import { propsMarca } from "@/lib/marca";
import { SinConexion } from "@/components/ui/SinConexion";
import { Suspense } from "react";
import { crearClienteServidor, gimnasioActual } from "@/lib/supabase/servidor";
import { rpc } from "@/lib/panel/servidor";
import { AyudaPantalla } from "@/components/ui/AyudaPantalla";
import { ayudasDeUsuario } from "@/lib/ayuda-servidor";
import { NavSocio } from "./NavSocio";
import { FranjaMantenimiento } from "@/components/panel/FranjaMantenimiento";

// El ícono del gimnasio en la pestaña y al guardar la app en el celular.
export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get("x-gimnasio-host");
  const landing = host ? await traerLanding(host).catch(() => null) : null;
  const icono = urlMarca(landing?.marca.favicon_path ?? landing?.marca.logo_path);
  return { title: landing ? `Mi gimnasio · ${landing.marca.nombre}` : "Mi gimnasio", icons: icono ? { icon: icono, apple: icono } : { icon: "/icono", apple: "/icono" }, robots: { index: false, follow: false } };
}

// La app del socio: celular primero, la marca del gimnasio, una sola columna.
export default async function LayoutApp({ children }: { children: ReactNode }) {
  const host = (await headers()).get("x-gimnasio-host");
  const landing = host ? await traerLanding(host) : null;
  if (!landing) throw new Error("La app del socio se abre desde la dirección del gimnasio.");
  const logo = urlMarca(landing.marca.logo_path);
  // Las pestañas salen de la configuración del gimnasio (la base). Sin sesión no hay pestañas (la página redirige a ingresar).
  // Si la base falla se muestran solo Inicio y Yo, que existen siempre.
  const gimnasio = await gimnasioActual();
  const sesion = (await (await crearClienteServidor()).auth.getUser()).data.user;
  const pestanas = sesion ? await rpc<{ clases: boolean; rutina: boolean }>("pestanas_app", { p_gimnasio_id: gimnasio.id }).catch(() => ({ clases: false, rutina: false })) : null;
  const ayudas = sesion ? await ayudasDeUsuario() : null;   // VD-31
  return (
    <div {...propsMarca(landing.marca)} className="min-h-dvh">
      <header className="sticky top-0 z-20 backdrop-blur-md bg-[color-mix(in_oklab,var(--fondo)_85%,transparent)] border-b border-[var(--borde)]">
        <div className="mx-auto max-w-lg px-4 h-14 flex items-center justify-between">
          <Link href="/app" className="titulo text-xl flex items-center gap-2 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo && <img src={logo} alt="" className="h-8 w-auto max-w-24 flex-none rounded-lg object-contain" />}
            <span className="truncate">{landing.marca.nombre}</span>
          </Link>
          <div className="flex items-center gap-1">
            <span id="ayuda-lugar" />
            <form action="/salir" method="post"><button className="boton-texto">Salir</button></form>
          </div>
        </div>
      </header>
      <main className={`mx-auto max-w-lg px-4 pt-6 ${pestanas ? "pb-28" : "pb-16"}`}><SinConexion /><FranjaMantenimiento />{ayudas && <AyudaPantalla ambito="app" inicial={ayudas} />}{children}</main>
      {pestanas && <Suspense fallback={null}><NavSocio clases={pestanas.clases} rutina={pestanas.rutina} /></Suspense>}
    </div>
  );
}
