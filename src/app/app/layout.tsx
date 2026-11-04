import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { traerLanding } from "@/lib/landing";
import { propsMarca } from "@/lib/marca";

export const metadata: Metadata = { title: "Mi gimnasio" };

// La app del socio: celular primero, la marca del gimnasio, una sola columna.
export default async function LayoutApp({ children }: { children: ReactNode }) {
  const host = (await headers()).get("x-gimnasio-host");
  const landing = host ? await traerLanding(host) : null;
  if (!landing) throw new Error("La app del socio se abre desde la dirección del gimnasio.");
  return (
    <div {...propsMarca(landing.marca)} className="min-h-dvh">
      <header className="sticky top-0 z-20 backdrop-blur-md bg-[color-mix(in_oklab,var(--fondo)_85%,transparent)] border-b border-[var(--borde)]">
        <div className="mx-auto max-w-lg px-4 h-14 flex items-center justify-between">
          <a href="/app" className="titulo text-xl truncate">{landing.marca.nombre}</a>
          <form action="/salir" method="post"><button className="boton-texto">Salir</button></form>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 pt-6 pb-16">{children}</main>
    </div>
  );
}
