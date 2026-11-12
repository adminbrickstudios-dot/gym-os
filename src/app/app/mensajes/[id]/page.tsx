import type { Metadata } from "next";
import Link from "next/link";
import { miSocio } from "@/lib/app/socio";
import { estadoDe, motivoDe, type HiloSocio } from "@/lib/mensajes";
import { conFotos } from "@/lib/mensajes-servidor";
import { intentar } from "@/lib/panel/intentar";
import { rpc } from "@/lib/panel/servidor";
import { FormMensaje } from "../FormMensaje";
import { Icono } from "@/components/ui/Icono";

export const metadata: Metadata = { title: "Mi mensaje" };

/** Una conversación con el gimnasio. Al abrirla se marcan como leídas las respuestas (la base lo hace). */
export default async function MiHilo({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ socio?: string }> }) {
  const { id } = await params;
  const pedido = (await searchParams).socio;
  return intentar(async () => {
    const { yo } = await miSocio(pedido);
    if (yo.elegir || !yo.socio) return <p className="texto-suave">Elegí primero <Link href="/app" className="underline">qué socio sos</Link>.</p>;
    const q = yo.socios.length > 1 ? `?socio=${yo.socio.socio_id}` : "";
    const hilo = await rpc<HiloSocio>("mi_hilo", { p_hilo_id: id });
    const mensajes = await conFotos(hilo.mensajes);
    const m = motivoDe(hilo.motivo), e = estadoDe(hilo.estado);
    const cuando = (x: string) => new Intl.DateTimeFormat("es-AR", { timeZone: yo.zona!, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(x));
    return (
      <div className="space-y-6" data-mi-hilo>
        <Link href={`/app/mensajes${q}`} className="texto-suave">← Mis mensajes</Link>
        <div>
          <h1 className="titular text-5xl"><Icono nombre={m.emoji} /> {m.titulo}</h1>
          <p className="mt-2"><span className={`pildora pildora-${e.color}`}>{e.titulo}</span></p>
        </div>
        <ul className="space-y-3" aria-label="Conversación">
          {mensajes.map((x) => (
            <li key={x.id} className={`flex ${x.autor === "socio" ? "justify-end" : "justify-start"}`} data-autor={x.autor}>
              <div className={`tarjeta p-4 max-w-[88%] min-w-0 ${x.autor === "socio" ? "bg-[var(--tarjeta-alta)]" : ""}`}>
                <p className="text-sm texto-tenue mb-1">{x.autor === "socio" ? "Vos" : "El gimnasio"} · {cuando(x.creado_en)}</p>
                <p className="whitespace-pre-wrap break-words">{x.texto}</p>
                {x.con_foto && (x.foto_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <a href={x.foto_url} target="_blank" rel="noreferrer"><img src={x.foto_url} alt="Foto que mandaste" className="mt-2 rounded-[var(--radio)] max-h-64 w-auto max-w-full" data-foto-hilo /></a>
                  : <p className="texto-tenue text-sm mt-2"><Icono nombre="camara" /> La foto no se pudo abrir ahora.</p>)}
              </div>
            </li>
          ))}
        </ul>
        {hilo.estado === "resuelto" && <p className="texto-suave">El gimnasio dio esto por resuelto. Si todavía necesitás algo, escribí abajo y se vuelve a abrir.</p>}
        <FormMensaje socioId={hilo.socio_id} hilo={hilo.hilo_id} q={q} />
      </div>
    );
  });
}
