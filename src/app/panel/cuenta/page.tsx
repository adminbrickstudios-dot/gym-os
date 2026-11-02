import type { Metadata } from "next";
import { Encabezado } from "@/components/panel/Marco";
import { NOMBRE_ROL } from "@/lib/panel/secciones";
import { contextoPanel } from "@/lib/panel/servidor";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { CambiarContrasena } from "./CambiarContrasena";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function Cuenta() {
  const panel = await contextoPanel();
  const { data } = await (await crearClienteServidor()).auth.getUser();
  return (
    <>
      <Encabezado emoji="👤" titulo={panel.yo.nombre} bajada={`${NOMBRE_ROL[panel.yo.rol]} · ${data.user?.email ?? ""}`} />
      <CambiarContrasena />
      <form action="/salir" method="post" className="mt-8"><button className="boton">🚪 Cerrar sesión</button></form>
    </>
  );
}
