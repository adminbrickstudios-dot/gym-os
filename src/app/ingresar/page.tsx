import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CascaraIngreso, registroAbierto, traerMarca } from "./Encabezado";
import { FormularioIngreso } from "./FormularioIngreso";
import { IngresoSocio } from "./IngresoSocio";
import { ReclamarFicha } from "./ReclamarFicha";
import { destinoSeguro } from "./destino";
import { Mensaje } from "@/components/ui/Mensaje";
import { Icono } from "@/components/ui/Icono";
import { AVISOS_GOOGLE, googleActivo } from "@/lib/google";
import { sesionEnEsteGimnasio } from "@/lib/app/sesion-gimnasio";

export const metadata: Metadata = { title: "Ingresar", robots: { index: false, follow: true } };

// D41: las puertas fijas (/dueno, /recepcion, /profe) llegan con ?rol= y lo dicen en el título.
const TITULO_ROL: Record<string, string> = { dueno: "Ingreso del dueño", recepcion: "Ingreso de la recepción", profe: "Ingreso del profe" };

export default async function Ingresar({ searchParams }: { searchParams: Promise<{ siguiente?: string; modo?: string; google?: string; rol?: string; reclamar?: string; inactividad?: string }> }) {
  const { siguiente, modo, google, rol, reclamar, inactividad } = await searchParams;
  const socio = modo === "socio";
  const reclamando = socio && reclamar === "1";
  const marca = await traerMarca();
  // H3b: con la sesión abierta en este gimnasio, /ingresar no muestra el login: va a donde iba (o a su perfil / su panel).
  // Un cierre por inactividad (?inactividad=1) sí vuelve a mostrar el ingreso.
  if (marca && inactividad !== "1" && !reclamando) {
    const sesion = await sesionEnEsteGimnasio();
    if (sesion && socio && sesion.esSocio) {
      const destino = destinoSeguro(siguiente ?? null, "/app");
      redirect(destino === "/app" || destino.startsWith("/app/") || destino.startsWith("/app?") ? destino : "/app");
    }
    if (sesion && !socio && sesion.esEquipo) redirect(destinoSeguro(siguiente ?? null, "/panel"));
  }
  const nuevo = socio ? await registroAbierto() : false;

  return (
    <CascaraIngreso marca={marca}>
      {marca && (
        <nav className="flex gap-2 mb-6" aria-label="Quién entra">
          <Link href="/ingresar?modo=socio" className={`boton flex-1 ${socio ? "!border-[var(--acento)]" : "opacity-70"}`}><Icono nombre="persona" /> Soy socio</Link>
          <Link href="/ingresar" className={`boton flex-1 ${!socio ? "!border-[var(--acento)]" : "opacity-70"}`}><Icono nombre="llave" /> Soy del equipo</Link>
        </nav>
      )}
      <h1 className="titular text-4xl">{!marca ? "Entrá a tu gimnasio" : reclamando ? "Es mi primera vez" : socio ? "Tu gimnasio" : TITULO_ROL[rol ?? ""] ?? "Entrá al panel"}</h1>
      <p className="texto-suave text-lg mt-2">{!marca ? "Con el mail y la contraseña de tu cuenta." : reclamando ? "Si el gimnasio ya te cargó, escribí tu DNI y tu celular y elegí tu contraseña. No se crea otra ficha: es la tuya, con tu plan y tus pagos." : socio ? "Con tu mail y tu contraseña. ¿No la tenés? Creala con un código o entrá con tu celular." : "Con el mail y la contraseña que te dio el gimnasio."}</p>
      {marca && socio && google && googleActivo() && AVISOS_GOOGLE[google] && <div className="mt-4"><Mensaje tipo="aviso">{AVISOS_GOOGLE[google]}</Mensaje></div>}
      {marca && reclamando ? <ReclamarFicha /> : marca && socio ? <IngresoSocio google={googleActivo()} /> : <div className="mt-6"><FormularioIngreso siguiente={siguiente ?? null} /></div>}
      {marca && socio && !reclamando && (
        <p className="mt-6 text-center texto-suave" data-ya-cargado>¿Te cargó el gimnasio y es tu primera vez? <Link href="/ingresar?modo=socio&reclamar=1" className="underline font-semibold inline-flex items-center min-h-11" data-primera-vez>Reclamá tu ficha</Link></p>
      )}
      {marca && socio && nuevo && (
        <p className="mt-2 text-center texto-suave" data-soy-nuevo>¿Todavía no sos socio? <Link href="/hacete-socio" className="underline font-semibold inline-flex items-center min-h-11">Soy nuevo, quiero anotarme</Link></p>
      )}
      {marca && socio && !nuevo && (
        <p className="mt-2 text-center texto-suave" data-sin-cuenta>¿Todavía no sos socio? Pedile a la recepción que te anote y después entrás acá con tu celular.</p>
      )}
      {marca && !socio && (
        <p className="mt-4 text-center texto-suave text-sm" data-sin-cuenta>¿No tenés cuenta? Si sos socio, <Link href="/ingresar?modo=socio" className="underline font-semibold">entrá con tu celular</Link>. Si sos del equipo, el acceso lo crea el dueño del gimnasio.</p>
      )}
    </CascaraIngreso>
  );
}
