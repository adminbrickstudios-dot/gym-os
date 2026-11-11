import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/panel/Marco";
import { Icono } from "@/components/ui/Icono";
import { GUIAS, guiasDeRolPanel } from "@/lib/guias";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel } from "@/lib/panel/servidor";

export const metadata: Metadata = { title: "Guías de uso" };

/** C3: las guías de uso que puede abrir este rol. El dueño y el encargado además llegan a los carteles. */
export default async function Guias() {
  return intentar(async () => {
    const panel = await contextoPanel();
    const mias = guiasDeRolPanel(panel.yo.rol);
    const guias = GUIAS.filter((g) => mias.includes(g.rol));
    const gestion = panel.yo.rol === "dueno" || panel.yo.rol === "encargado";
    return (
      <>
        <Encabezado icono="ayuda" titulo="Guías de uso" bajada="Una por rol, en pocos pasos, para leer acá o imprimir en A4." volver={{ href: "/panel/ayuda", texto: "Ayuda" }} />
        <ul className="space-y-3 max-w-3xl" data-guias>
          {guias.map((g) => (
            <li key={g.rol}>
              <Link href={`/panel/ayuda/guias/${g.rol}`} className="tarjeta p-4 flex items-center gap-4 min-h-[48px]" data-guia-link={g.rol}>
                <span className="min-w-0 flex-1">
                  <span className="titulo text-2xl block">{g.titulo}</span>
                  <span className="texto-suave block">{g.paraQuien}</span>
                </span>
                <Icono nombre="derecha" />
              </Link>
            </li>
          ))}
          {gestion && (
            <li>
              <Link href="/panel/ayuda/carteles" className="tarjeta p-4 flex items-center gap-4 min-h-[48px]" data-guia-link="carteles">
                <span className="min-w-0 flex-1">
                  <span className="titulo text-2xl block">Carteles para imprimir</span>
                  <span className="texto-suave block">La hoja de la puerta y la de “Descargá la app”, con tu logo y tu color.</span>
                </span>
                <Icono nombre="derecha" />
              </Link>
            </li>
          )}
        </ul>
      </>
    );
  });
}
