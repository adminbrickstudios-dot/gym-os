import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NOMBRE_ROL } from "@/lib/panel/secciones";
import { ErrorDatos, rpc, type MiSesion } from "@/lib/panel/servidor";

export const metadata: Metadata = { title: "Elegí el gimnasio" };

// Para quien trabaja en más de un gimnasio y entra desde la dirección de Gym OS.
export default async function Elegir() {
  let yo: MiSesion;
  try {
    yo = await rpc<MiSesion>("mi_sesion");
  } catch (e) {
    if (e instanceof ErrorDatos) redirect("/ingresar");
    throw e;
  }
  return (
    <main className="min-h-dvh flex items-center px-4 py-12">
      <div className="mx-auto w-full max-w-md">
        <p className="text-5xl" aria-hidden>🏋️</p>
        <h1 className="titular text-5xl mt-6">¿A qué gimnasio entrás?</h1>
        <ul className="mt-8 space-y-2">
          {yo.equipo.map((e) => (
            <li key={e.equipo_id}>
              <a href={`/entrar/${e.slug}`} className="boton w-full !justify-between text-lg">
                <span>{e.gimnasio}</span><span className="texto-tenue text-sm">{NOMBRE_ROL[e.rol]}</span>
              </a>
            </li>
          ))}
          {yo.es_admin && <li><Link href="/admin" className="boton w-full text-lg">🧱 Super admin de BRIK</Link></li>}
        </ul>
        {yo.equipo.length === 0 && !yo.es_admin && <p className="texto-suave mt-6">Tu cuenta no tiene ningún gimnasio.</p>}
        <form action="/salir" method="post" className="mt-8"><button className="boton-texto">Salir</button></form>
      </div>
    </main>
  );
}
