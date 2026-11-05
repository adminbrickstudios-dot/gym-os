import type { Metadata } from "next";
import { Encabezado } from "@/components/panel/Marco";
import { NOMBRE_ROL } from "@/lib/panel/secciones";
import { contextoPanel } from "@/lib/panel/servidor";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { cookies } from "next/headers";
import Link from "next/link";
import { CambiarContrasena } from "./CambiarContrasena";
import { MiPin } from "./MiPin";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function Cuenta() {
  const panel = await contextoPanel();
  const { data } = await (await crearClienteServidor()).auth.getUser();
  return (
    <>
      <Encabezado emoji="👤" titulo={panel.yo.nombre} bajada={`${NOMBRE_ROL[panel.yo.rol]} · ${data.user?.email ?? ""}`} />
      <CambiarContrasena />
      {/* Con un PIN puesto en esta compu, el PIN que se guarda es el de la sesión: se pide sin PIN puesto. */}
      {(await cookies()).get("gymos_operador")
        ? <p className="texto-suave mt-6">🔢 Para cambiar tu PIN, primero <Link href="/panel/pin" className="underline">salí del PIN</Link> de esta compu.</p>
        : <MiPin />}
      <form action="/salir" method="post" className="mt-8"><button className="boton">🚪 Cerrar sesión</button></form>
    </>
  );
}
