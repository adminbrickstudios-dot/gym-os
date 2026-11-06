import type { Metadata } from "next";
import Link from "next/link";
import { CascaraIngreso, registroAbierto, traerMarca } from "./Encabezado";
import { FormularioIngreso } from "./FormularioIngreso";
import { IngresoSocio } from "./IngresoSocio";
import { Mensaje } from "@/components/ui/Mensaje";
import { AVISOS_GOOGLE, googleActivo } from "@/lib/google";

export const metadata: Metadata = { title: "Ingresar", robots: { index: false, follow: true } };

export default async function Ingresar({ searchParams }: { searchParams: Promise<{ siguiente?: string; modo?: string; google?: string }> }) {
  const { siguiente, modo, google } = await searchParams;
  const socio = modo === "socio";
  const marca = await traerMarca();
  const nuevo = socio ? await registroAbierto() : false;

  return (
    <CascaraIngreso marca={marca}>
      {marca && (
        <nav className="flex gap-2 mb-6" aria-label="Quién entra">
          <Link href="/ingresar?modo=socio" className={`boton flex-1 ${socio ? "!border-[var(--acento)]" : "opacity-70"}`}>💪 Soy socio</Link>
          <Link href="/ingresar" className={`boton flex-1 ${!socio ? "!border-[var(--acento)]" : "opacity-70"}`}>🛎️ Soy del equipo</Link>
        </nav>
      )}
      <h1 className="titular text-4xl">{!marca ? "Entrá a tu gimnasio" : socio ? "Tu gimnasio" : "Entrá al panel"}</h1>
      <p className="texto-suave text-lg mt-2">{!marca ? "Con el mail y la contraseña de tu cuenta." : socio ? "Con tu celular o tu mail: te mandamos un código." : "Con el mail y la contraseña que te dio el gimnasio."}</p>
      {marca && socio && google && googleActivo() && AVISOS_GOOGLE[google] && <div className="mt-4"><Mensaje tipo="aviso">{AVISOS_GOOGLE[google]}</Mensaje></div>}
      {marca && socio ? <IngresoSocio google={googleActivo()} /> : <div className="mt-6"><FormularioIngreso siguiente={siguiente ?? null} /></div>}
      {marca && socio && nuevo && (
        <p className="mt-6 text-center texto-suave" data-soy-nuevo>¿Todavía no sos socio? <Link href="/hacete-socio" className="underline font-semibold">Soy nuevo, quiero anotarme</Link></p>
      )}
    </CascaraIngreso>
  );
}
