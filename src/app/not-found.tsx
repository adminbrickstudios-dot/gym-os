import Link from "next/link";
import { headers } from "next/headers";
import { Aviso } from "@/components/panel/Marco";
import { traerLanding } from "@/lib/landing";
import { propsMarca } from "@/lib/marca";
import { Icono } from "@/components/ui/Icono";
import { estiloTipografia } from "@/lib/landing-estilo";

/** WEB-05 · La 404 de la dirección de un gimnasio lleva su nombre y su color, y vuelve a SU página (no a la de la plataforma). */
export default async function NoEncontrada() {
  const h = await headers();
  const host = h.get("x-gymos-contexto") === "gimnasio" ? h.get("x-gimnasio-host") : null;
  const landing = host ? await traerLanding(host).catch(() => null) : null;
  if (landing) {
    return (
      <main {...propsMarca(landing.marca)} style={{ ...propsMarca(landing.marca).style, ...estiloTipografia(landing.marca.tipografia) }} className="min-h-dvh grid place-items-center px-4" data-404-gimnasio>
        <div className="text-center max-w-md">
          <p className="titulo text-xl texto-suave">{landing.marca.nombre}</p>
          <h1 className="titular text-5xl sm:text-6xl mt-4">No encontramos esta página</h1>
          <p className="texto-suave text-lg mt-4">La dirección no existe o ya no está.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/" className="boton boton-principal text-lg px-8">Ir a la página de {landing.marca.nombre}</Link>
            <a href="/ingresar?modo=socio" className="boton text-lg px-8">Soy socio</a>
          </div>
        </div>
      </main>
    );
  }
  return (
    <main className="min-h-screen p-6 flex items-center justify-center">
      <Aviso emoji="buscar" titulo="No encontramos esta página">
        <p>La dirección no existe o ya no está.</p>
        <div className="flex flex-wrap gap-2 mt-6">
          <Link href="/" className="boton boton-principal"><Icono nombre="inicio" /> Ir al inicio</Link>
        </div>
      </Aviso>
    </main>
  );
}
