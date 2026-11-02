import type { Metadata } from "next";
import { headers } from "next/headers";
import { traerLanding, urlMarca } from "@/lib/landing";
import { iniciales } from "@/lib/landing-textos";
import { propsMarca } from "@/lib/marca";
import Link from "next/link";
import { FormularioIngreso } from "./FormularioIngreso";
import { IngresoSocio } from "./IngresoSocio";

export const metadata: Metadata = { title: "Ingresar" };

export default async function Ingresar({ searchParams }: { searchParams: Promise<{ siguiente?: string; modo?: string }> }) {
  const { siguiente, modo } = await searchParams;
  const socio = modo === "socio";
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
        {marca && (
          <nav className="flex gap-2 mt-10" aria-label="Quién entra">
            <Link href="/ingresar?modo=socio" className={`boton flex-1 ${socio ? "!border-[var(--acento)]" : "opacity-70"}`}>💪 Soy socio</Link>
            <Link href="/ingresar" className={`boton flex-1 ${!socio ? "!border-[var(--acento)]" : "opacity-70"}`}>🛎️ Soy del equipo</Link>
          </nav>
        )}
        <h1 className="titular text-6xl mt-10">{!marca ? "Entrá a tu gimnasio" : socio ? "Tu gimnasio" : "Entrá al panel"}</h1>
        <p className="texto-suave text-lg mt-3">{!marca ? "Con el mail y la contraseña de tu cuenta." : socio ? "Con tu celular: te mandamos un código." : "Con el mail y la contraseña que te dio el gimnasio."}</p>
        {marca && socio ? <IngresoSocio /> : <FormularioIngreso siguiente={siguiente ?? null} />}
      </div>
    </main>
  );
}
