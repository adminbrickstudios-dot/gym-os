import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { ComponentType } from "react";
import { BLOQUES, pestanasPara } from "@/lib/panel/organizacion";
import { DESTINO } from "@/lib/panel/rutas";
import { seccionesPara } from "@/lib/panel/secciones";
import { contextoPanel } from "@/lib/panel/servidor";
import P_hoy from "../../hoy/lista";
import P_tareas from "../../tareas/page";
import P_avisos from "../../avisos/page";
import P_vencen_hoy from "../../vencen-hoy/page";
import P_transferencias from "../../transferencias/page";
import P_prospectos from "../../prospectos/page";
import P_socios from "../../socios/page";
import P_retencion from "../../retencion/page";
import P_pt from "../../pt/page";
import P_lockers from "../../lockers/page";
import P_eventos from "../../eventos/page";
import P_caja from "../../caja/page";
import P_vender from "../../vender/page";
import P_resultado from "../../resultado/page";
import P_gastos from "../../gastos/page";
import P_resumen from "../../resumen/page";
import P_horas from "../../horas/page";
import P_profes from "../../profes/page";
import P_rutinas from "../../rutinas/page";
import P_maquinas from "../../maquinas/page";
import P_incidentes from "../../incidentes/page";
import P_configuracion from "../../configuracion/page";
import P_pagina from "../../pagina/page";
import P_equipo from "../../equipo/page";
import P_control from "../../control/page";

// Pase 2.0 · organización (26/11): una entrada del menú con varias pantallas de hoy como PESTAÑAS arriba (?pestana=). Cada pestaña dibuja la
// pantalla de siempre, con sus permisos y sus datos: nada se reescribe. La dirección vieja de cada una llega acá por el proxy (con la llave).
// Sin la llave, esta dirección no existe para el gimnasio: lleva a la pantalla de siempre.

type Pagina = ComponentType<{ searchParams: Promise<Record<string, string | undefined>>; params: Promise<Record<string, string>> }>;
// Importaciones fijas (no import() dinámico): con import() Turbopack juntaba el JS de cliente de estas pantallas en un pedazo compartido y
// todas las rutas (hasta /hacete-socio) pesaban ~3 KB más. Así el JS de cada pestaña queda solo en esta ruta.
const PANTALLAS: Partial<Record<keyof typeof DESTINO, unknown>> = {
  hoy: P_hoy, tareas: P_tareas, avisos: P_avisos, vencen_hoy: P_vencen_hoy, transferencias: P_transferencias, prospectos: P_prospectos, socios: P_socios, retencion: P_retencion, pt: P_pt, lockers: P_lockers, eventos: P_eventos, caja: P_caja, vender: P_vender, resultado: P_resultado, gastos: P_gastos, resumen: P_resumen, horas: P_horas, profes: P_profes, rutinas: P_rutinas, maquinas: P_maquinas, incidentes: P_incidentes, configuracion: P_configuracion, pagina: P_pagina, equipo: P_equipo, control: P_control,
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
  const Pantalla = PANTALLAS[enSocios ? "socios" : activa.seccion] as Pagina | undefined;
  if (!Pantalla) notFound();
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
