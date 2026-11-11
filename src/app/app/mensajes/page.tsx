import type { Metadata } from "next";
import Link from "next/link";
import { Vacio } from "@/components/ui/Vacio";
import { miSocio } from "@/lib/app/socio";
import { estadoDe, motivoDe, type FilaSocio } from "@/lib/mensajes";
import { intentar } from "@/lib/panel/intentar";
import { rpc } from "@/lib/panel/servidor";
import { Icono } from "@/components/ui/Icono";

export const metadata: Metadata = { title: "Escribile al gimnasio" };

/** VD-38 (D27): mis mensajes al gimnasio y lo que me contestaron. */
export default async function MisMensajes({ searchParams }: { searchParams: Promise<{ socio?: string }> }) {
  const pedido = (await searchParams).socio;
  return intentar(async () => {
    const { yo } = await miSocio(pedido);
    if (yo.elegir || !yo.socio) return <p className="texto-suave">Elegí primero <Link href="/app" className="underline">qué socio sos</Link>.</p>;
    const s = yo.socio;
    const q = yo.socios.length > 1 ? `?socio=${s.socio_id}` : "";
    const [hilos, estado] = await Promise.all([
      rpc<FilaSocio[]>("mis_mensajes", { p_socio_id: s.socio_id }),
      rpc<{ activo: boolean }>("mensajes_estado_socio", { p_socio_id: s.socio_id }),
    ]);
    const cuando = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: yo.zona!, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
    return (
      <div className="space-y-6" data-mis-mensajes>
        <Link href={`/app/yo${q}`} className="texto-suave">← Volver</Link>
        <h1 className="titular text-5xl"><Icono nombre="mensaje" /> Escribile al gimnasio</h1>
        {estado.activo
          ? <Link href={`/app/mensajes/nuevo${q}`} className="boton boton-principal w-full !min-h-14" data-nuevo-mensaje><Icono nombre="mail" /> Escribir un mensaje</Link>
          : <p className="tarjeta p-5 texto-suave">Por ahora este gimnasio no recibe mensajes por la app. Hablá con la recepción.</p>}
        {hilos.length === 0 ? (
          <Vacio emoji="mensaje" titulo="Todavía no escribiste">Una consulta, una queja o algo que perdiste: escribinos y te contestamos acá, en la app.</Vacio>
        ) : (
          <ul className="space-y-2" aria-label="Mis mensajes">
            {hilos.map((h) => {
              const m = motivoDe(h.motivo);
              return (
                <li key={h.hilo_id}>
                  <Link href={`/app/mensajes/${h.hilo_id}${q}`} className="tarjeta flex items-start gap-3 p-4" data-hilo={h.sin_leer ? "sin-leer" : "leido"}>
                    <span className="text-2xl" aria-hidden>{m.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold leading-tight">{m.titulo}{h.sin_leer && <span className="pildora pildora-rojo ml-2 !text-xs align-middle">Te respondieron</span>}</span>
                      {h.extracto && <span className="block texto-suave text-[15px] truncate">{h.extracto}</span>}
                      <span className="block text-sm texto-tenue mt-1">{estadoDe(h.estado).titulo} · {cuando(h.ultimo_en)}</span>
                    </span>
                    <span aria-hidden className="texto-tenue">›</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  });
}
