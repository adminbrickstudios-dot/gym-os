import type { Metadata } from "next";
import Link from "next/link";
import { miSocio } from "@/lib/app/socio";
import { intentar } from "@/lib/panel/intentar";
import { rpc } from "@/lib/panel/servidor";

export const metadata: Metadata = { title: "Mi locker" };

type MiLocker = { prendido: boolean; lockers: { numero: string; ubicacion: string | null; sede: string; hasta: string; ultimo_dia: string; estado: "ocupado" | "vencido"; dias: number }[] };
const dia = (d: string) => d.split("-").reverse().join("/");

/** VD-55: el locker del socio y hasta cuándo lo tiene. Lo calcula la base; si el gimnasio no usa lockers, no hay nada para ver. */
export default async function MiLockerPagina({ searchParams }: { searchParams: Promise<{ socio?: string }> }) {
  const pedido = (await searchParams).socio;
  return intentar(async () => {
    const { yo } = await miSocio(pedido);
    if (yo.elegir || !yo.socio) return <p className="texto-suave">Elegí primero <Link href="/app" className="underline">qué socio sos</Link>.</p>;
    const q = yo.socios.length > 1 ? `?socio=${yo.socio.socio_id}` : "";
    const r = await rpc<MiLocker>("mi_locker", { p_socio_id: yo.socio.socio_id });
    return (
      <div className="space-y-6" data-mi-locker>
        <Link href={`/app/yo${q}`} className="texto-suave">← Volver</Link>
        <h1 className="titular text-5xl">Mi locker</h1>
        {!r.prendido || r.lockers.length === 0 ? (
          <p className="texto-suave text-lg" data-sin-locker>No tenés un locker alquilado. Si querés uno, pedíselo a la recepción.</p>
        ) : (
          <ul className="space-y-3">
            {r.lockers.map((l) => (
              <li key={l.numero} className="tarjeta p-5 space-y-1" data-locker-socio={l.numero} data-estado={l.estado}>
                <p className="titulo text-3xl">🔐 Locker {l.numero}</p>
                {l.ubicacion && <p className="texto-suave">{l.ubicacion}{yo.sedes && yo.sedes.length > 1 ? ` · ${l.sede}` : ""}</p>}
                {l.estado === "vencido"
                  ? <p className="mensaje mensaje-aviso"><span aria-hidden>🟡</span><span>Venció el {dia(l.ultimo_dia)}. Pasá por la recepción para renovarlo.</span></p>
                  : <p className="texto-suave text-lg">Es tuyo hasta el {dia(l.ultimo_dia)}{l.dias <= 7 ? ` (${l.dias === 0 ? "vence hoy" : l.dias === 1 ? "vence mañana" : `faltan ${l.dias} días`})` : ""}.</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  });
}
