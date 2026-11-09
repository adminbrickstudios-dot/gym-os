import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BuscarPersona } from "./BuscarPersona";

export const metadata: Metadata = { title: "BRIK · Buscar a una persona" };

/** SA-5: buscar a cualquiera (mail, DNI o teléfono) en todos los gimnasios. */
export default async function Buscar() {
  if ((await headers()).get("x-gymos-contexto") !== "plataforma") redirect("/");
  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-8 py-10 space-y-6">
      <header className="space-y-2">
        <Link href="/admin" className="texto-suave">← Tablero</Link>
        <h1 className="titular text-5xl">Buscar a una persona</h1>
        <p className="texto-suave">Sirve para &ldquo;me escribió alguien que no puede entrar y no sé de qué gimnasio es&rdquo;. Toca datos personales: pide el motivo y queda registrado. Muestra solo nombre, gimnasio y rol.</p>
      </header>
      <BuscarPersona />
    </main>
  );
}
