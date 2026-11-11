import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/panel/Marco";
import { Icono } from "@/components/ui/Icono";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol } from "@/lib/panel/servidor";

export const metadata: Metadata = { title: "Carteles" };

/** C4: los carteles A4 para imprimir. Los dos llevan el logo, el color y el nombre del gimnasio (Configuración, Marca). */
export default async function Carteles() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado"]);
    const filas = [
      { href: "/panel/ayuda/carteles/puerta", icono: "puerta", titulo: "Cartel de la puerta", texto: "Cómo entrar con el celular o con el DNI. Dice solo lo que tu gimnasio tiene prendido." },
      { href: "/panel/ayuda/carteles/app", icono: "celular", titulo: "Cartel “Descargá la app”", texto: "Con el QR de la página de tu gimnasio y los tres pasos para entrar a la app." },
    ];
    return (
      <>
        <Encabezado icono="puerta" titulo="Carteles" bajada="Hojas A4 con tu logo y tu color. Se imprimen o se guardan como PDF desde el navegador." volver={{ href: "/panel/ayuda/guias", texto: "Guías de uso" }} />
        <ul className="space-y-3 max-w-3xl" data-carteles>
          {filas.map((f) => (
            <li key={f.href}>
              <Link href={f.href} className="tarjeta p-4 flex items-center gap-4 min-h-[48px]" data-cartel-link={f.href.split("/").pop()}>
                <span className="text-3xl" aria-hidden><Icono nombre={f.icono} /></span>
                <span className="min-w-0 flex-1">
                  <span className="titulo text-2xl block">{f.titulo}</span>
                  <span className="texto-suave block">{f.texto}</span>
                </span>
                <Icono nombre="derecha" />
              </Link>
            </li>
          ))}
        </ul>
        <p className="texto-suave mt-6 max-w-3xl">¿No se ve tu logo o tu color? Se cambian en Configuración, Marca. El nombre sale en blanco o en negro según el contraste con tu color.</p>
      </>
    );
  });
}
