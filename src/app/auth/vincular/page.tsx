import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CascaraIngreso, traerMarca } from "@/app/ingresar/Encabezado";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { MiSesion } from "@/lib/panel/servidor";
import { googleActivo } from "@/lib/google";
import { VincularGoogle } from "./VincularGoogle";

export const metadata: Metadata = { title: "Vincular tu Google", robots: { index: false, follow: false } };

/** VD-22 · La primera vez con Google: se vincula al socio con DNI + código. Si ya está vinculado, va directo a la app. */
export default async function Vincular({ searchParams }: { searchParams: Promise<{ sumar?: string }> }) {
  const { sumar } = await searchParams;
  const volver = "/ingresar?modo=socio";
  if (!googleActivo()) redirect(volver);
  const gimnasioId = (await headers()).get("x-gimnasio-id");
  if (!gimnasioId) redirect(volver);
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(volver);
  const { data: sesion, error } = await supabase.rpc("mi_sesion");
  if (error) throw new Error(`No pudimos leer tu cuenta: ${error.message}`);
  // Ya vinculado → directo a la app. Con ?sumar=1 se puede sumar a otra persona (un hijo, la pareja): pide confirmar.
  if (sumar !== "1" && (sesion as MiSesion).socios.some((s) => s.gimnasio_id === gimnasioId)) redirect("/app");

  const marca = await traerMarca();
  return (
    <CascaraIngreso marca={marca}>
      <h1 className="titular text-4xl">Una sola vez</h1>
      <p className="texto-suave text-lg mt-2">Vinculá tu cuenta de Google con tu ficha del gimnasio.</p>
      <div className="mt-6"><VincularGoogle cuenta={data.user.email ?? null} /></div>
    </CascaraIngreso>
  );
}
