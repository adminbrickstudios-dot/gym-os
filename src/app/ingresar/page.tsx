import type { Metadata } from "next";
import { headers } from "next/headers";
import { traerLanding, urlMarca } from "@/lib/landing";
import { iniciales } from "@/lib/landing-textos";
import { propsMarca } from "@/lib/marca";
import { FormularioIngreso } from "./FormularioIngreso";

export const metadata: Metadata = { title: "Ingresar" };

export default async function Ingresar({ searchParams }: { searchParams: Promise<{ siguiente?: string }> }) {
  const { siguiente } = await searchParams;
  const h = await headers();
  const host = h.get("x-gimnasio-host");
  const landing = h.get("x-gymos-contexto") === "gimnasio" && host ? await traerLanding(host) : null;
  const marca = landing?.marca;
  const logo = urlMarca(marca?.logo_path);

  return (
    <main {...(marca ? propsMarca(marca) : {})} className="min-h-dvh flex items-center px-4 py-12">
      <div className="mx-auto w-full max-w-sm">
        <div className="flex items-center gap-3">
          {marca ? (
            logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="size-12 rounded-2xl object-cover" />
            ) : (
              <span className="size-12 rounded-2xl grid place-items-center titulo text-lg" style={{ background: "var(--acento)", color: "var(--acento-texto)" }}>
                {iniciales(marca.nombre)}
              </span>
            )
          ) : (
            <span className="icono !size-12 !text-2xl" aria-hidden>🏋️</span>
          )}
          <span className="titulo text-2xl">{marca?.nombre ?? "Gym OS"}</span>
        </div>
        <h1 className="titular text-6xl mt-12">{marca ? "Entrá al panel" : "Entrada de BRIK"}</h1>
        <p className="texto-suave text-lg mt-3">{marca ? "Con el mail y la contraseña que te dio el gimnasio." : "Solo para administradores de la plataforma."}</p>
        <FormularioIngreso siguiente={siguiente ?? null} />
      </div>
    </main>
  );
}
