import type { Metadata } from "next";

export const metadata: Metadata = { title: "Gimnasio no encontrado" };

export default async function GimnasioNoEncontrado({
  searchParams,
}: {
  searchParams: Promise<{ host?: string }>;
}) {
  const { host } = await searchParams;
  return (
    <main className="min-h-dvh flex items-center justify-center px-4">
      <div className="tarjeta max-w-md w-full p-8 text-center">
        <p className="text-5xl mb-4" aria-hidden>🔍</p>
        <h1 className="text-2xl font-semibold mb-2">No encontramos este gimnasio</h1>
        <p className="texto-suave mb-6">
          La dirección <strong className="break-all">{host || "(sin dirección)"}</strong> no corresponde a ningún gimnasio.
        </p>
        <p className="texto-suave text-sm">Revisá que esté bien escrita o pedile el link correcto a tu gimnasio.</p>
      </div>
    </main>
  );
}
