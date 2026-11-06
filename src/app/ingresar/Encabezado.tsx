import { headers } from "next/headers";
import type { CSSProperties } from "react";
import { traerLanding, urlMarca } from "@/lib/landing";
import { iniciales } from "@/lib/landing-textos";
import { propsMarca } from "@/lib/marca";
import "./ingreso.css";

/** La marca de quien entra: la del gimnasio (si la dirección es suya) o la de Gym OS. */
export async function traerMarca() {
  const h = await headers();
  const host = h.get("x-gimnasio-host");
  const landing = h.get("x-gymos-contexto") === "gimnasio" && host ? await traerLanding(host) : null;
  return landing?.marca ?? null;
}

export type MarcaIngreso = Awaited<ReturnType<typeof traerMarca>>;

/** Cáscara de las pantallas de ingreso: fondo con degradé, logo y nombre, y la tarjeta de vidrio con el contenido. */
export function CascaraIngreso({ marca, children }: { marca: MarcaIngreso; children: React.ReactNode }) {
  const logo = urlMarca(marca?.logo_path);
  return (
    <main {...(marca ? propsMarca(marca) : {})} className="ingreso-fondo min-h-dvh flex items-center px-4 py-10" data-ingreso>
      <div className="mx-auto w-full max-w-sm">
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
            <span className="icono !size-12 !text-2xl" aria-hidden>🏋️</span>
          )}
          <span className="titulo text-2xl break-words min-w-0" data-marca-ingreso>{marca?.nombre ?? "Gym OS"}</span>
        </div>
        <section className="tarjeta ingreso-tarjeta">{children}</section>
      </div>
    </main>
  );
}
