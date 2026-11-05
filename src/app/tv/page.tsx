import type { Metadata } from "next";
import { estadoTv } from "./acciones";
import { PantallaTv } from "./PantallaTv";

export const metadata: Metadata = { title: "TV de la sala", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** COM-14: la TV de la sala, sin menú y sin sesión de nadie. Se actualiza sola. */
export default async function PaginaTv({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error: errorLink } = await searchParams;
  const r = errorLink ? { error: "El link para autorizar la TV está incompleto. Copialo de nuevo desde Clases → 📺 TV de la sala." } : await estadoTv();
  if (!r.estado) {
    return (
      <main className="min-h-dvh grid place-items-center p-6">
        <div className="max-w-lg text-center space-y-4" data-tv="sin-autorizar">
          <p className="text-6xl" aria-hidden>📺</p>
          <h1 className="titular text-4xl">TV sin autorizar</h1>
          <p className="texto-suave text-lg">{r.error}</p>
        </div>
      </main>
    );
  }
  return <PantallaTv inicial={r.estado} />;
}
