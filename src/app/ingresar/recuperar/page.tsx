import type { Metadata } from "next";
import Link from "next/link";
import { CascaraIngreso, traerMarca } from "../Encabezado";
import { Recuperar } from "./Recuperar";

export const metadata: Metadata = { title: "Olvidé mi contraseña", robots: { index: false, follow: true } };

export default async function PaginaRecuperar({ searchParams }: { searchParams: Promise<{ siguiente?: string }> }) {
  const { siguiente } = await searchParams;
  const marca = await traerMarca();
  return (
    <CascaraIngreso marca={marca}>
      <h1 className="titular text-4xl">Olvidé mi contraseña</h1>
      <p className="texto-suave text-lg mt-2">Te mandamos un código al mail de tu cuenta y ahí elegís una contraseña nueva.</p>
      <div className="mt-6"><Recuperar siguiente={siguiente ?? null} /></div>
      <p className="text-sm text-center mt-6"><Link href="/ingresar" className="underline underline-offset-4 texto-suave">← Volver a ingresar</Link></p>
    </CascaraIngreso>
  );
}
