import type { Metadata } from "next";

export const metadata: Metadata = { title: "Gimnasio no encontrado" };

export default async function GimnasioNoEncontrado({
  searchParams,
}: {
  searchParams: Promise<{ host?: string }>;
}) {
  const { host } = await searchParams;
  return (
    <main className="min-h-dvh flex items-center px-4 py-16">
      <div className="mx-auto w-full max-w-xl">
        <p className="text-6xl mb-8" aria-hidden>🔍</p>
        <h1 className="titular text-5xl sm:text-6xl">No encontramos este gimnasio</h1>
        <p className="texto-suave text-lg mt-6">
          La dirección <strong className="text-[var(--texto)] break-all">{host || "(sin dirección)"}</strong> no corresponde a ningún gimnasio.
        </p>
        <p className="texto-suave text-lg mt-2">Revisá que esté bien escrita o pedile el link a tu gimnasio.</p>
        {/* Para quien configura: si esta dirección debía ser la de Gym OS, la variable no coincide. */}
        <p className="texto-tenue text-sm mt-10">
          Dirección de la plataforma configurada: <code>{process.env.NEXT_PUBLIC_DOMINIO_PLATAFORMA || "(vacía)"}</code>
        </p>
      </div>
    </main>
  );
}
