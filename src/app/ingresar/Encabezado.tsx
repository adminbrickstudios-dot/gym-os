import { headers } from "next/headers";
import type { CSSProperties } from "react";
import { traerLanding, urlMarca } from "@/lib/landing";
import { iniciales } from "@/lib/landing-textos";
import { propsMarca } from "@/lib/marca";
import { SinInternetIngreso } from "./SinInternetIngreso";
import "./ingreso.css";
import { Icono } from "@/components/ui/Icono";

/** La marca de quien entra: la del gimnasio (si la dirección es suya) o la de Gym OS. */
export async function traerMarca() {
  const h = await headers();
  const host = h.get("x-gimnasio-host");
  const landing = h.get("x-gymos-contexto") === "gimnasio" && host ? await traerLanding(host) : null;
  if (!landing) return null;
  // VD-61: si la página del gimnasio tiene foto de portada, es el fondo del ingreso (la misma foto, nada se carga dos veces).
  const foto = landing.publicada && landing.portada.foto_path ? urlMarca(landing.portada.foto_path) : null;
  return { ...landing.marca, foto };
}

/** VD-35: ¿el gimnasio de esta dirección tiene el registro abierto? Si lo apagó el dueño, "Soy nuevo" no aparece. */
export async function registroAbierto() {
  const h = await headers();
  const host = h.get("x-gimnasio-host");
  const landing = h.get("x-gymos-contexto") === "gimnasio" && host ? await traerLanding(host) : null;
  return !!landing && landing.publicada && !!landing.altas_online;
}

export type MarcaIngreso = Awaited<ReturnType<typeof traerMarca>>;

/** Cáscara de las pantallas de ingreso: fondo con degradé, logo y nombre, y la tarjeta de vidrio con el contenido. */
export function CascaraIngreso({ marca, children }: { marca: MarcaIngreso; children: React.ReactNode }) {
  const logo = urlMarca(marca?.logo_path);
  return (
    <main {...(marca ? propsMarca(marca) : {})} className="ingreso-fondo min-h-dvh flex items-center px-4 pt-10 pb-[max(2.5rem,env(safe-area-inset-bottom))]" data-ingreso {...(marca?.foto ? { "data-con-foto": "" } : {})}>
      {marca?.foto && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={marca.foto} alt="" className="ingreso-foto" fetchPriority="high" decoding="async" />
      )}
      <div className="mx-auto w-full max-w-sm">
        <SinInternetIngreso />
        <div className="ingreso-logo flex items-center gap-3 mb-6">
          {marca ? (
            logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="size-12 rounded-2xl object-cover" />
            ) : (
              <span className="size-12 rounded-2xl grid place-items-center titulo text-lg" style={{ background: "var(--acento)", color: "var(--acento-texto)" } as CSSProperties}>
                {iniciales(marca.nombre)}
              </span>
            )
          ) : (
            <span className="icono !size-12 !text-2xl" aria-hidden><Icono nombre="pesa" /></span>
          )}
          <span className="titulo text-2xl break-words min-w-0" data-marca-ingreso>{marca?.nombre ?? "Base"}</span>
        </div>
        <section className="tarjeta ingreso-tarjeta">{children}</section>
      </div>
    </main>
  );
}
