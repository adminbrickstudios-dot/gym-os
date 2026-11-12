import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { rpc } from "@/lib/panel/servidor";
import { Plantillas } from "./Plantillas";
import type { TextoPlantilla } from "../acciones";

export const metadata: Metadata = { title: "BRIK · Plantillas" };

/** EDIT-S07: los textos que BRIK define para todos los gimnasios (o para un tipo), con "Restaurar por defecto". */
export default async function PaginaPlantillas() {
  if ((await headers()).get("x-gymos-contexto") !== "plataforma") redirect("/");
  const datos = await rpc<{ tipos: string[]; textos: TextoPlantilla[] }>("admin_plantillas_texto");
  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-8 py-10 space-y-6">
      <header className="space-y-2">
        <Link href="/admin" className="texto-suave">← Tablero</Link>
        <h1 className="titular text-[28px]">Plantillas de textos</h1>
        <p className="texto-suave">Cada texto se resuelve en capas: lo que escribió el gimnasio, después la plantilla de su tipo, después la de la plataforma y, al final, la de fábrica. Al cambiar una plantilla se actualizan los gimnasios que no editaron ese texto; el que escribió el suyo lo conserva.</p>
      </header>
      <Plantillas tipos={datos.tipos} textos={datos.textos} />
    </main>
  );
}
