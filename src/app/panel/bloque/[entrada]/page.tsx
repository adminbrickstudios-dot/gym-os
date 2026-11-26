import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { ComponentType } from "react";
import { BLOQUES, pestanasPara } from "@/lib/panel/organizacion";
import { DESTINO } from "@/lib/panel/rutas";
import { seccionesPara } from "@/lib/panel/secciones";
import { contextoPanel } from "@/lib/panel/servidor";

// Pase 2.0 · organización (26/11): una entrada del menú con varias pantallas de hoy como PESTAÑAS arriba (?pestana=). Cada pestaña dibuja la
// pantalla de siempre, con sus permisos y sus datos: nada se reescribe. La dirección vieja de cada una llega acá por el proxy (con la llave).
// Sin la llave, esta dirección no existe para el gimnasio: lleva a la pantalla de siempre.

type Pagina = ComponentType<{ searchParams: Promise<Record<string, string | undefined>>; params: Promise<Record<string, string>> }>;
const PANTALLAS: Partial<Record<keyof typeof DESTINO, () => Promise<{ default: unknown }>>> = {
  hoy: () => import("../../hoy/lista"), tareas: () => import("../../tareas/page"), avisos: () => import("../../avisos/page"), vencen_hoy: () => import("../../vencen-hoy/page"),
  transferencias: () => import("../../transferencias/page"), prospectos: () => import("../../prospectos/page"), socios: () => import("../../socios/page"),
  retencion: () => import("../../retencion/page"), pt: () => import("../../pt/page"), lockers: () => import("../../lockers/page"), eventos: () => import("../../eventos/page"),
  caja: () => import("../../caja/page"), vender: () => import("../../vender/page"), resultado: () => import("../../resultado/page"), gastos: () => import("../../gastos/page"),
  resumen: () => import("../../resumen/page"), horas: () => import("../../horas/page"), profes: () => import("../../profes/page"), rutinas: () => import("../../rutinas/page"),
  maquinas: () => import("../../maquinas/page"), incidentes: () => import("../../incidentes/page"), configuracion: () => import("../../configuracion/page"),
  pagina: () => import("../../pagina/page"), equipo: () => import("../../equipo/page"), control: () => import("../../control/page"),
};

export async function generateMetadata({ params }: { params: Promise<{ entrada: string }> }): Promise<Metadata> {
  const { entrada } = await params;
  const b = BLOQUES.find((x) => x.clave === entrada);
  return { title: b?.titulo ?? "Panel" };
}

export default async function PaginaBloque({ params, searchParams }: { params: Promise<{ entrada: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ entrada }, sp] = await Promise.all([params, searchParams]);
  const bloque = BLOQUES.find((x) => x.clave === entrada);
  if (!bloque || bloque.pestanas.length < 2) notFound();
  const llave = (await headers()).get("x-gimnasio-organizacion") === "si";
  if (!llave) redirect(DESTINO[bloque.pestanas[0].seccion]);
  const panel = await contextoPanel();
  const visibles = pestanasPara(bloque, seccionesPara(panel.yo.rol, panel.secciones_apagadas));
  if (!visibles.length) redirect("/panel");
  // ?pestana= es la de este bloque; si no lo es (una pantalla que usa ?pestana= para lo suyo, como Configuración), va a la primera y se le pasa tal cual.
  const elegida = visibles.find((p) => p.seccion === sp.pestana);
  // Socios con la vista de interesados es la pestaña Interesados (los links de siempre llevan a /panel/socios?vista=interesados).
  const activa = (!elegida || elegida.seccion === "socios") && sp.vista === "interesados" ? (visibles.find((p) => p.seccion === "prospectos") ?? elegida ?? visibles[0]) : (elegida ?? visibles[0]);
  const { pestana, sub, ...resto } = sp;
  const suyos = { ...resto, ...(elegida ? (sub ? { pestana: sub } : {}) : (pestana ? { pestana } : {})) };
  // Interesados vive dentro de Socios desde VD-15 (/panel/prospectos lleva a Socios con la vista de interesados): la pestaña dibuja eso mismo.
  const enSocios = activa.seccion === "prospectos" && !panel.secciones_apagadas.includes("socios");
  if (enSocios) Object.assign(suyos, { vista: "interesados" });
  const cargar = PANTALLAS[enSocios ? "socios" : activa.seccion];
  if (!cargar) notFound();
  const Pantalla = (await cargar()).default as Pagina;
  return (
    <div className="space-y-5" data-bloque={bloque.clave} data-pestana-activa={activa.seccion}>
      {visibles.length > 1 && (
        <nav aria-label={bloque.titulo} className="flex flex-wrap gap-2 -mb-1" data-pestanas-bloque>
          {visibles.map((p) => (
            <Link key={p.seccion} href={`/panel/bloque/${bloque.clave}?pestana=${p.seccion}`} className="pestana" data-transicion data-pestana-bloque={p.seccion}
              aria-current={p.seccion === activa.seccion ? "page" : undefined}>{p.titulo}</Link>
          ))}
        </nav>
      )}
      <Pantalla searchParams={Promise.resolve(suyos)} params={Promise.resolve({})} />
    </div>
  );
}
