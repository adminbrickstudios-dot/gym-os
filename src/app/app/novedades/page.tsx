import type { Metadata } from "next";
import Link from "next/link";
import { miSocio } from "@/lib/app/socio";
import { intentar } from "@/lib/panel/intentar";
import { rpc } from "@/lib/panel/servidor";
import { MarcarLeidas } from "./Leidos";
import { ActivarPush } from "@/components/ActivarPush";

export const metadata: Metadata = { title: "Novedades" };
type Item = { clave: string; emoji: string; titulo: string; detalle: string | null; href: string; en: string | null; leido: boolean };

/** AVI-5: las novedades del socio (comprobantes, clases, si hoy no está al día). Se calculan al abrirlas. */
export default async function NovedadesSocio({ searchParams }: { searchParams: Promise<{ socio?: string }> }) {
  const pedido = (await searchParams).socio;
  return intentar(async () => {
    const { g, yo } = await miSocio(pedido);
    if (yo.elegir || !yo.socio) return <p className="texto-suave">Elegí primero <Link href="/app" className="underline">qué socio sos</Link>.</p>;
    const s = yo.socio;
    const c = await rpc<{ items: Item[]; sin_leer: number }>("campana_socio", { p_gimnasio_id: g.id, p_socio_id: s.socio_id });
    const q = yo.socios.length > 1 ? `?socio=${s.socio_id}` : "";
    const zona = yo.zona!;
    const cuando = (m: string | null) => (m ? new Intl.DateTimeFormat("es-AR", { timeZone: zona, weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m)) : null);
    return (
      <div className="space-y-6">
        <Link href={`/app${q}`} className="texto-suave">← Volver</Link>
        <h1 className="titular text-5xl">🔔 Novedades</h1>
        <MarcarLeidas claves={c.items.filter((i) => !i.leido).map((i) => i.clave)} />
        {c.items.length === 0 ? <p className="texto-suave text-lg">Nada nuevo por ahora. Cuando aprueben tu pago o cambie una clase, aparece acá. ✨</p> : (
          <ul className="space-y-2">
            {c.items.map((i) => (
              <li key={i.clave} data-novedad={i.leido ? "vista" : "nueva"}>
                <Link href={`${i.href}${q}`} className={`tarjeta flex items-start gap-3 p-4 ${i.leido ? "opacity-70" : ""}`}>
                  <span className="text-2xl" aria-hidden>{i.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-tight">{i.titulo}{!i.leido && <span className="pildora ml-2 !text-xs align-middle">Nuevo</span>}</span>
                    {i.detalle && <span className="block texto-suave text-[15px]">{i.detalle}</span>}
                    {cuando(i.en) && <span className="block text-sm texto-tenue mt-1 first-letter:uppercase">{cuando(i.en)}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <section className="tarjeta p-5 space-y-3" aria-labelledby="push">
          <h2 id="push" className="titulo text-xl">🔔 Que me lleguen al celular</h2>
          <p className="texto-suave">Cuando aprueben tu pago o se cancele una clase tuya, te llega un aviso aunque no tengas la app abierta.</p>
          <ActivarPush />
        </section>
      </div>
    );
  });
}
