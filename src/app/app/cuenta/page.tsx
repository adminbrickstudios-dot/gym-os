import type { Metadata } from "next";
import Link from "next/link";
import { miSocio } from "@/lib/app/socio";
import { intentar } from "@/lib/panel/intentar";
import { rpc } from "@/lib/panel/servidor";
import { CrearContrasena, PedirBaja, PedirPausa } from "./Pedidos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { Sesiones } from "@/components/cuenta/Sesiones";
import type { MiSeguridad } from "@/lib/cuenta/dispositivo";

export const metadata: Metadata = { title: "Mi membresía" };

/** APP-8: pedir una pausa o la baja sin tener que ir al mostrador. */
export default async function Cuenta({ searchParams }: { searchParams: Promise<{ socio?: string }> }) {
  const pedido = (await searchParams).socio;
  return intentar(async () => {
    const { yo } = await miSocio(pedido);
    if (yo.elegir || !yo.socio) return <p className="texto-suave">Elegí primero <Link href="/app" className="underline">qué socio sos</Link>.</p>;
    const s = yo.socio;
    const q = yo.socios.length > 1 ? `?socio=${s.socio_id}` : "";
    const [baja, usuario, seguridad] = await Promise.all([
      rpc<{ motivo: string; pedido_en: string; codigo?: string } | null>("pedido_baja_socio", { p_socio_id: s.socio_id }),
      crearClienteServidor().then((c) => c.auth.getUser()),
      rpc<MiSeguridad>("mi_seguridad"),
    ]);
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: yo.zona! }).format(new Date());
    return (
      <div className="space-y-6">
        <Link href={`/app${q}`} className="texto-suave">← Volver</Link>
        <h1 className="titular text-5xl">Mi membresía</h1>
        {yo.plan && <p className="texto-suave text-lg">🏷️ {yo.plan.nombre}</p>}
        {yo.plan ? <PedirPausa socioId={s.socio_id} hoy={hoy} /> : <p className="texto-suave">No tenés una membresía mensual para pausar.</p>}
        <CrearContrasena email={usuario.data.user?.email || null} tieneContrasena={seguridad.tiene_contrasena} />
        {/* VD-33b: dónde está abierta mi cuenta y cerrar las demás. */}
        <Sesiones sesiones={seguridad.sesiones} zona={yo.zona!} />
        {/* SEG-6: lo que el gimnasio guarda de él. */}
        <p><a href={`/app/mis-datos${yo.socios.length > 1 ? `?socio=${s.socio_id}` : ""}`} className="texto-suave underline" download data-mis-datos>⬇️ Descargar mis datos</a></p>
        {baja
          ? <p className="mensaje mensaje-info" data-baja-pendiente>👋 Pediste la baja: el gimnasio te va a contactar.{baja.codigo && <> Tu código de baja: <strong data-codigo-baja>{baja.codigo}</strong>. Guardalo: es tu constancia.</>}</p>
          : <PedirBaja socioId={s.socio_id} ofrecePausa={!!yo.plan} />}
      </div>
    );
  });
}
