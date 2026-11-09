import type { Metadata } from "next";
import Link from "next/link";
import { miSocio } from "@/lib/app/socio";
import { intentar } from "@/lib/panel/intentar";
import { rpc } from "@/lib/panel/servidor";
import { frasesDelAnio, type ResumenApp } from "@/lib/app/resumen";

export const metadata: Metadata = { title: "Mi año" };

/** FA-14: mis insignias y el resumen de mi año. Todo lo calcula la base de lo que ya pasó; no decide nada sobre la entrada. */
export default async function MiAnio({ searchParams }: { searchParams: Promise<{ socio?: string }> }) {
  const pedido = (await searchParams).socio;
  return intentar(async () => {
    const { yo } = await miSocio(pedido);
    if (yo.elegir || !yo.socio) return <p className="texto-suave">Elegí primero <Link href="/app" className="underline">qué socio sos</Link>.</p>;
    const q = yo.socios.length > 1 ? `?socio=${yo.socio.socio_id}` : "";
    const r = await rpc<ResumenApp>("resumen_app_socio", { p_socio_id: yo.socio.socio_id });
    const frases = frasesDelAnio(r.anio);
    const logradas = r.insignias.filter((i) => i.lograda);
    return (
      <div className="space-y-6" data-mi-anio>
        <Link href={`/app/yo${q}`} className="texto-suave">← Volver</Link>
        <h1 className="titular text-5xl">Mi año {r.anio.anio}</h1>
        <section className="tarjeta p-5 space-y-2" aria-label="Resumen del año" data-resumen-anio>
          {frases.length ? frases.map((f) => <p key={f} className="text-lg">{f}</p>) : <p className="texto-suave text-lg">Todavía no hay entradas este año. Cuando vengas, acá vas a ver cómo te va.</p>}
        </section>
        <section className="space-y-3" aria-label="Insignias">
          <h2 className="titulo text-3xl">Mis insignias <span className="texto-tenue text-xl">{logradas.length}/{r.insignias.length}</span></h2>
          <ul className="grid grid-cols-2 gap-3">
            {r.insignias.map((i) => (
              <li key={i.clave} data-insignia={i.clave} data-lograda={i.lograda ? "si" : "no"} className={`tarjeta p-4 text-center space-y-1 ${i.lograda ? "" : "opacity-60"}`}>
                <span className="text-4xl block" aria-hidden>{i.emoji}</span>
                <span className="block font-semibold">{i.titulo}</span>
                <span className="block texto-suave text-sm">{i.lograda ? "¡Conseguida!" : `${i.avance} de ${i.meta}`}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  });
}
