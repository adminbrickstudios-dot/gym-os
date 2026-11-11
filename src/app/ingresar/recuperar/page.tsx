import type { Metadata } from "next";
import Link from "next/link";
import { CascaraIngreso, traerMarca } from "../Encabezado";
import { Recuperar } from "./Recuperar";
import { Mensaje } from "@/components/ui/Mensaje";
import { smtpActivo } from "@/lib/smtp";

/** El mail que viene en el link para crear la contraseña: solo llena el campo, nunca decide nada. */
function mailDelLink(m?: string) {
  return m && m.length <= 200 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m) ? m : undefined;
}

export const metadata: Metadata = { title: "Olvidé mi contraseña", robots: { index: false, follow: true } };

export default async function PaginaRecuperar({ searchParams }: { searchParams: Promise<{ siguiente?: string; email?: string; nueva?: string }> }) {
  const { siguiente, email, nueva } = await searchParams;
  const primera = nueva === "1";
  const marca = await traerMarca();
  const conMail = smtpActivo();
  return (
    <CascaraIngreso marca={marca}>
      <h1 className="titular text-4xl">{primera ? "Creá tu contraseña" : "Olvidé mi contraseña"}</h1>
      <p className="texto-suave text-lg mt-2">
        {primera
          ? "Te mandamos un código al mail que diste en el gimnasio y ahí elegís tu contraseña. Después entrás con tu mail y esa contraseña."
          : "Te mandamos un código al mail de tu cuenta y ahí elegís una contraseña nueva."}
      </p>
      {!conMail && (
        <div className="mt-4" data-sin-smtp>
          <Mensaje tipo="aviso">
            <p className="font-semibold">{marca ? "Pedile una clave nueva a la recepción (si sos del equipo, al dueño)." : "Pedile una clave nueva al dueño de tu gimnasio (si sos el dueño, a BRIK)."}</p>
            <p className="mt-1">Te la dan en un toque y entrás enseguida con tu mail. Los mails de código pueden demorar o no llegar.</p>
            {marca && <p className="mt-1">Si sos socio, también podés <Link href="/ingresar?modo=socio" className="underline font-semibold">entrar con un código por celular</Link>.</p>}
          </Mensaje>
        </div>
      )}
      <div className="mt-6"><Recuperar siguiente={siguiente ?? null} emailInicial={mailDelLink(email)} /></div>
      <p className="text-sm text-center mt-6"><Link href="/ingresar" className="underline underline-offset-4 texto-suave inline-flex items-center min-h-11">← Volver a ingresar</Link></p>
    </CascaraIngreso>
  );
}
