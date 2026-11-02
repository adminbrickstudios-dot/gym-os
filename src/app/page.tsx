import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { LandingGimnasio, LandingProximamente } from "@/components/landing/Landing";
import { traerLanding, urlMarca } from "@/lib/landing";

// La raíz responde distinto según el host (lo resolvió el middleware):
//   plataforma → la página de Gym OS
//   gimnasio   → la landing de ese gimnasio, con su marca

const landingDelHost = cache(async () => {
  const h = await headers();
  if (h.get("x-gymos-contexto") !== "gimnasio") return { tipo: "plataforma" as const };
  const host = h.get("x-gimnasio-host");
  if (!host) throw new Error("El middleware marcó un gimnasio pero no pasó el host.");
  const landing = await traerLanding(host);
  if (!landing) notFound();
  return { tipo: "gimnasio" as const, landing };
});

export async function generateMetadata(): Promise<Metadata> {
  const r = await landingDelHost();
  if (r.tipo === "plataforma") return { title: "Gym OS" };
  const { marca } = r.landing;
  const icono = urlMarca(marca.favicon_path ?? marca.logo_path);
  const descripcion = r.landing.publicada ? r.landing.portada.bajada ?? undefined : undefined;
  return {
    title: { absolute: r.landing.publicada ? `${marca.nombre} · ${r.landing.portada.titulo}` : marca.nombre },
    description: descripcion,
    icons: icono ? { icon: icono, apple: icono } : undefined,
    openGraph: { title: marca.nombre, description: descripcion, images: r.landing.publicada && r.landing.portada.foto_path ? [urlMarca(r.landing.portada.foto_path)!] : undefined },
  };
}

export default async function Inicio() {
  const r = await landingDelHost();
  if (r.tipo === "gimnasio") {
    return r.landing.publicada ? <LandingGimnasio landing={r.landing} /> : <LandingProximamente marca={r.landing.marca} />;
  }
  return (
    <main className="min-h-dvh flex flex-col justify-center px-4 py-16">
      <div className="mx-auto w-full max-w-5xl">
        <p className="text-6xl mb-8" aria-hidden>🏋️</p>
        <h1 className="titular text-[clamp(3.5rem,14vw,8rem)]">Gym OS</h1>
        <p className="texto-suave text-xl sm:text-2xl mt-6 max-w-[30ch]">
          El sistema para tu gimnasio: quién entra, quién paga y quién dejó de venir.
        </p>
        <a href="/ingresar" className="boton boton-principal text-lg px-8 mt-10">🔑 Ingresar</a>
      </div>
    </main>
  );
}
