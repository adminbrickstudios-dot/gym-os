import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DosPasos } from "@/app/panel/cuenta/DosPasos";
import { Sesiones } from "@/components/cuenta/Sesiones";
import type { MiSeguridad } from "@/lib/cuenta/dispositivo";
import { rpc } from "@/lib/panel/servidor";
import { EquipoBrik, type EstadoSeguridad } from "./EquipoBrik";

export const metadata: Metadata = { title: "BRIK · Seguridad" };

/** SA-10: segundo factor del super admin y los usuarios de BRIK con sus roles. */
export default async function Seguridad() {
  if ((await headers()).get("x-gymos-contexto") !== "plataforma") redirect("/");
  // Con el segundo factor exigido y sin confirmar, la base no deja ver el estado: la pantalla igual muestra cómo confirmarlo.
  const estado = await rpc<EstadoSeguridad>("admin_estado_seguridad").catch(() => null);
  const mia = await rpc<MiSeguridad>("mi_seguridad").catch(() => null);   // F2.8: dónde está abierta mi cuenta, y cerrar las demás
  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-8 py-10 space-y-8">
      <header className="space-y-2">
        <Link href="/admin" className="texto-suave">← Tablero</Link>
        <h1 className="titular text-[28px]">Seguridad</h1>
      </header>
      <section className="space-y-3">
        <p className="titulo-grupo">Tu verificación en dos pasos</p>
        {!estado && <p className="texto-suave" data-pide-codigo>Si ya la tenés activa, confirmá el código de ahora para volver a entrar al super admin.</p>}
        <DosPasos recomendada />
      </section>
      {mia && <Sesiones sesiones={mia.sesiones} zona="America/Argentina/Buenos_Aires" />}
      {estado && <EquipoBrik estado={estado} />}
      {estado && <p><Link href="/admin/registro" className="boton">Ver el registro de BRIK</Link></p>}
    </main>
  );
}
